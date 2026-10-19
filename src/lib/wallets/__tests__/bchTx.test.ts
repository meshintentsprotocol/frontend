import { describe, it, expect } from 'vitest';
import {
    checkSigned,
    txidOf,
    TxMismatchError,
} from '../bchTx';
import {
    encodeTransaction,
    binToHex,
    hexToBin,
    type TransactionCommon,
} from '@bitauth/libauth';

describe('bchTx validation', () => {
    const baseTx: TransactionCommon = {
        version: 2,
        locktime: 0,
        inputs: [
            {
                outpointTransactionHash: hexToBin('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
                outpointIndex: 0,
                unlockingBytecode: new Uint8Array([0x00]),
                sequenceNumber: 0xffffffff,
            },
        ],
        outputs: [
            {
                lockingBytecode: hexToBin('76a914123456789012345678901234567890123456789088ac'),
                valueSatoshis: 10000n,
            },
        ],
    };

    const unsignedHex = binToHex(encodeTransaction(baseTx));

    it('passes when signed transaction differs only in unlockingBytecode', () => {
        const signedTx: TransactionCommon = {
            ...baseTx,
            inputs: [
                {
                    ...baseTx.inputs[0],
                    unlockingBytecode: hexToBin('4730440220...signature...'),
                },
            ],
        };
        const signedHex = binToHex(encodeTransaction(signedTx));

        expect(() => checkSigned(unsignedHex, signedHex)).not.toThrow();
    });

    it('throws when output value is tampered', () => {
        const tamperedTx: TransactionCommon = {
            ...baseTx,
            outputs: [
                {
                    ...baseTx.outputs[0],
                    valueSatoshis: 5000n, // tampered value
                },
            ],
        };
        const tamperedHex = binToHex(encodeTransaction(tamperedTx));

        expect(() => checkSigned(unsignedHex, tamperedHex)).toThrowError(TxMismatchError);
    });

    it('throws when output locking bytecode is tampered', () => {
        const tamperedTx: TransactionCommon = {
            ...baseTx,
            outputs: [
                {
                    ...baseTx.outputs[0],
                    lockingBytecode: hexToBin('76a914deadbeefdeadbeefdeadbeefdeadbeefdeadbeef88ac'),
                },
            ],
        };
        const tamperedHex = binToHex(encodeTransaction(tamperedTx));

        expect(() => checkSigned(unsignedHex, tamperedHex)).toThrowError(TxMismatchError);
    });

    it('throws when input outpoint is swapped or altered', () => {
        const tamperedTx: TransactionCommon = {
            ...baseTx,
            inputs: [
                {
                    ...baseTx.inputs[0],
                    outpointIndex: 1, // tampered outpoint index
                },
            ],
        };
        const tamperedHex = binToHex(encodeTransaction(tamperedTx));

        expect(() => checkSigned(unsignedHex, tamperedHex)).toThrowError(TxMismatchError);
    });

    it('throws when an output is added or removed', () => {
        const extraOutputTx: TransactionCommon = {
            ...baseTx,
            outputs: [
                baseTx.outputs[0],
                {
                    lockingBytecode: baseTx.outputs[0].lockingBytecode,
                    valueSatoshis: 1000n,
                },
            ],
        };
        const extraOutputHex = binToHex(encodeTransaction(extraOutputTx));

        expect(() => checkSigned(unsignedHex, extraOutputHex)).toThrowError(TxMismatchError);
    });

    it('computes consistent txidOf in UI order', () => {
        const txid = txidOf(unsignedHex);
        expect(typeof txid).toBe('string');
        expect(txid).toHaveLength(64);
        expect(txid).toMatch(/^[0-9a-f]{64}$/);
    });
});
