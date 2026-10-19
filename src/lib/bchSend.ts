/**
 * bchSend — unified Bitcoin Cash and CashToken send path.
 *
 * One implementation for both built-in (LocalWifSigner) and external
 * (ExternalWcSigner) wallets via the MeshSigner interface.
 *
 * Phase 4: Portfolio, Send, Receive and Mesh NFTs
 */

import { decodeCashAddress } from '@bitauth/libauth';
import type { Utxo } from 'cashscript';
import {
    DEFAULT_FEE_RATE,
    balance,
    makeBuilder,
    measure,
    selectTokens,
    sum,
    type In,
    type Out,
} from '@/lib/mesh/poolTx';
import { TOKEN_DUST, normCategory } from '@/lib/mesh/pool';
import type { MeshSigner } from '@/lib/mesh/signer';

export const P2PKH_DUST = 546n;

export type BchSendAmount =
    | { sats: bigint }
    | { category: string; amount: bigint };

export interface BchSendOpts {
    sendMax?: boolean;
    feeRate?: number;
}

/**
 * Check whether an address is a valid CashAddr and whether it is token-aware.
 */
export function checkRecipientAddress(to: string, networkPrefix?: string): {
    isValid: boolean;
    isTokenAware: boolean;
    formattedAddress: string;
    error?: string;
} {
    let addr = to;
    let res = decodeCashAddress(addr);
    if (typeof res === 'string' && networkPrefix && !addr.includes(':')) {
        addr = `${networkPrefix}:${addr}`;
        res = decodeCashAddress(addr);
    }

    if (typeof res === 'string') {
        return { isValid: false, isTokenAware: false, formattedAddress: to, error: res };
    }

    const isTokenAware = res.type === 'p2pkhWithTokens' || res.type === 'p2shWithTokens';
    return { isValid: true, isTokenAware, formattedAddress: addr };
}

/**
 * Builds, signs and broadcasts a BCH or CashToken transaction.
 */
export async function buildAndSendBch(
    signer: MeshSigner,
    to: string,
    amount: BchSendAmount,
    userPrompt: string,
    opts?: BchSendOpts,
): Promise<string> {
    const feeRate = opts?.feeRate ?? DEFAULT_FEE_RATE;
    const prefix = signer.network === 'mainnet' ? 'bitcoincash' : 'bchtest';

    const addrInfo = checkRecipientAddress(to, prefix);
    if (!addrInfo.isValid) {
        throw new Error(`Invalid recipient address: ${addrInfo.error ?? to}`);
    }

    const recipient = addrInfo.formattedAddress;
    const isToken = 'category' in amount;

    if (isToken) {
        if (!addrInfo.isTokenAware) {
            throw new Error('CashToken sends require a token-aware recipient address (starts with z)');
        }
        if (amount.amount <= 0n) {
            throw new Error('Token amount must be greater than zero');
        }

        const utxos = await signer.getUtxos();
        const cat = normCategory(amount.category);
        const { picked, change } = selectTokens(utxos, cat, amount.amount);

        const ins: In[] = picked.map(u => ({
            utxo: u,
            unlocker: signer.p2pkhUnlocker(),
            p2pkh: true,
        }));

        const outs: Out[] = [
            {
                to: recipient,
                amount: TOKEN_DUST,
                token: { category: cat, amount: amount.amount },
            },
        ];

        if (change > 0n) {
            outs.push({
                to: signer.tokenAddress,
                amount: TOKEN_DUST,
                token: { category: cat, amount: change },
            });
        }

        const walletPlain = utxos.filter(u => !u.token);
        const built = balance(signer, ins, outs, walletPlain, feeRate);
        return await signer.send(built.builder, userPrompt);
    }

    // Sats transfer
    if (!opts?.sendMax && amount.sats < P2PKH_DUST) {
        throw new Error(`Amount is below dust limit (${P2PKH_DUST} sats)`);
    }

    const utxos = await signer.getUtxos();
    const walletPlain = (utxos || []).filter(u => !u.token);

    if (opts?.sendMax) {
        if (walletPlain.length === 0) {
            throw new Error('No BCH available to send');
        }
        const satsIn = sum(walletPlain.map(u => u.satoshis));
        const ins: In[] = walletPlain.map(u => ({
            utxo: u,
            unlocker: signer.p2pkhUnlocker(),
            p2pkh: true,
        }));

        const testOuts: Out[] = [{ to: recipient, amount: satsIn }];
        const size = measure(signer, ins, testOuts);
        const fee = BigInt(Math.ceil(size * feeRate));
        const sendAmt = satsIn - fee;

        if (sendAmt < P2PKH_DUST) {
            throw new Error(`Insufficient funds: balance (${satsIn} sats) does not cover network fee (${fee} sats)`);
        }

        const finalOuts: Out[] = [{ to: recipient, amount: sendAmt }];
        const builder = makeBuilder(signer, ins, finalOuts);
        return await signer.send(builder, userPrompt);
    }

    const outs: Out[] = [{ to: recipient, amount: amount.sats }];
    const built = balance(signer, [], outs, walletPlain, feeRate);
    return await signer.send(built.builder, userPrompt);
}
