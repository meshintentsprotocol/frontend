import { useCallback } from 'react';
import { useWDK } from '@/context/WDKProvider';
import { useBCHWallet } from '@/context/BCHWalletProvider';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { fundCovenants, type FundingOutput } from '@/lib/fundCovenants';
import { addressSet as wizAddressSet } from '@/lib/wallets/wizardconnect';

/** Fund a server funding list in one transaction from the active BCH wallet (main or external). */
export function useFundCovenants() {
  const wdk = useWDK();
  const bchWallet = useBCHWallet();
  const extBCH = useExternalBCHWallet();
  const { activeWalletId, isMainActive, activeExtWallet } = useActiveWallet();

  return useCallback(async (outputs: FundingOutput[], prompt: string): Promise<string> => {
    const network = wdk.bchNetwork === 'mainnet' ? 'mainnet' : 'chipnet';
    if (isMainActive) {
      const wif = bchWallet.getWIF();
      if (!wif || !bchWallet.address) throw new Error('Connect your BCH wallet first');
      return fundCovenants({ network, address: bchWallet.address, tokenAddress: bchWallet.tokenAddress ?? undefined, wif }, outputs, prompt);
    }
    if (!activeExtWallet?.address) throw new Error('No external BCH wallet connected');
    // external wallets can omit the cashaddr prefix
    const address = activeExtWallet.address.includes(':')
      ? activeExtWallet.address
      : `${network === 'mainnet' ? 'bitcoincash' : 'bchtest'}:${activeExtWallet.address}`;
    const addressSet = activeExtWallet.source === 'wizardconnect'
      ? () => Promise.resolve(wizAddressSet(activeExtWallet.id))
      : undefined;
    return fundCovenants({
      network,
      address,
      signExternal: payload => extBCH.signTransaction(activeExtWallet.id, payload as any),
      addressSet,
    }, outputs, prompt);
  }, [wdk.bchNetwork, bchWallet, extBCH, activeWalletId, isMainActive, activeExtWallet]);
}
