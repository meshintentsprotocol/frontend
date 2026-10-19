import { describe, it, expect } from 'vitest';
import {
    connectFlowReducer,
    INITIAL_CONNECT_STATE,
    ConnectFlowState,
} from '../useConnectFlow';
import { ExternalWallet } from '@/lib/wallets/types';

describe('connectFlowReducer', () => {
    it('initializes in pick step with default BCH and WizardConnect', () => {
        expect(INITIAL_CONNECT_STATE.step).toBe('pick');
        expect(INITIAL_CONNECT_STATE.selectedFamily).toBe('bch');
        expect(INITIAL_CONNECT_STATE.selectedProtocol).toBe('wizardconnect');
        expect(INITIAL_CONNECT_STATE.qrValue).toBeNull();
        expect(INITIAL_CONNECT_STATE.error).toBeNull();
    });

    it('handles GO_TO_CHAIN', () => {
        const next = connectFlowReducer(INITIAL_CONNECT_STATE, { type: 'GO_TO_CHAIN' });
        expect(next.step).toBe('chain');
        expect(next.error).toBeNull();
    });

    it('handles GO_TO_PICK', () => {
        const inChain: ConnectFlowState = { ...INITIAL_CONNECT_STATE, step: 'chain' };
        const next = connectFlowReducer(inChain, { type: 'GO_TO_PICK' });
        expect(next.step).toBe('pick');
    });

    it('handles PICK_CHAIN for bch: advances to qr step and defaults to wizardconnect', () => {
        const inChain: ConnectFlowState = { ...INITIAL_CONNECT_STATE, step: 'chain' };
        const next = connectFlowReducer(inChain, { type: 'PICK_CHAIN', family: 'bch' });
        expect(next.step).toBe('qr');
        expect(next.selectedFamily).toBe('bch');
        expect(next.selectedProtocol).toBe('wizardconnect');
    });

    it('handles SELECT_PROTOCOL: updates protocol and clears previous pairing URIs', () => {
        const inQr: ConnectFlowState = {
            ...INITIAL_CONNECT_STATE,
            step: 'qr',
            qrValue: 'old-qr',
            linkText: 'old-link',
        };
        const next = connectFlowReducer(inQr, { type: 'SELECT_PROTOCOL', protocol: 'walletconnect' });
        expect(next.selectedProtocol).toBe('walletconnect');
        expect(next.qrValue).toBeNull();
        expect(next.linkText).toBeNull();
    });

    it('handles PAIRING_START, PAIRING_READY, and PAIRING_ERROR', () => {
        const s1 = connectFlowReducer(INITIAL_CONNECT_STATE, { type: 'PAIRING_START' });
        expect(s1.isLoading).toBe(true);

        const s2 = connectFlowReducer(s1, {
            type: 'PAIRING_READY',
            qrValue: 'wiz://qr',
            linkText: 'wiz://link',
            expiresAt: 123456,
        });
        expect(s2.isLoading).toBe(false);
        expect(s2.qrValue).toBe('wiz://qr');
        expect(s2.linkText).toBe('wiz://link');
        expect(s2.expiresAt).toBe(123456);

        const s3 = connectFlowReducer(s2, { type: 'PAIRING_ERROR', error: 'Relay timeout' });
        expect(s3.isLoading).toBe(false);
        expect(s3.error).toBe('Relay timeout');
    });

    it('handles PAIRING_SUCCESS: advances to connected step and sets connectedWallet', () => {
        const inQr: ConnectFlowState = {
            ...INITIAL_CONNECT_STATE,
            step: 'qr',
            qrValue: 'wiz://qr',
            linkText: 'wiz://link',
        };
        const fakeWallet: ExternalWallet = {
            id: 'wiz-1',
            source: 'wizardconnect',
            family: 'bch',
            network: 'testnet',
            label: 'Paytaca Mobile',
            address: 'bchtest:qqq123',
            connectedAt: Date.now(),
        };

        const next = connectFlowReducer(inQr, { type: 'PAIRING_SUCCESS', wallet: fakeWallet });
        expect(next.step).toBe('connected');
        expect(next.connectedWallet).toEqual(fakeWallet);
        expect(next.isLoading).toBe(false);
    });

    it('handles RESET: returns to initial state', () => {
        const connected: ConnectFlowState = {
            step: 'connected',
            selectedFamily: 'bch',
            selectedProtocol: 'walletconnect',
            qrValue: 'abc',
            linkText: 'def',
            expiresAt: 999,
            connectedWallet: {
                id: '1',
                source: 'walletconnect',
                family: 'bch',
                network: 'mainnet',
                label: 'Test',
                address: 'bitcoincash:q',
                connectedAt: 1,
            },
            isLoading: false,
            error: null,
        };

        const next = connectFlowReducer(connected, { type: 'RESET' });
        expect(next).toEqual(INITIAL_CONNECT_STATE);
    });
});
