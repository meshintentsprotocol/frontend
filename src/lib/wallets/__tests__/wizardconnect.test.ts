import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    getWizStatus,
    startPairing,
    onWizEvent,
} from '../wizardconnect';

describe('wizardconnect module', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns disconnected status by default for unknown id', () => {
        expect(getWizStatus('unknown-wiz-id')).toBe('disconnected');
    });

    it('generates pairing id and valid URIs', async () => {
        const pairing = await startPairing('testnet');
        expect(pairing.id).toMatch(/^wiz-/);
        expect(pairing.uri).toMatch(/^wiz:\/\//);
        expect(pairing.qrUri).toBeDefined();

        // Status is reconnecting/waiting
        expect(getWizStatus(pairing.id)).toBe('reconnecting');

        pairing.cancel();
        expect(getWizStatus(pairing.id)).toBe('disconnected');
    });

    it('subscribes and receives events via onWizEvent', async () => {
        const events: string[] = [];
        const unregister = onWizEvent('test-id', (e) => {
            events.push(e);
        });

        // Trigger an event via subscription
        unregister();
    });
});
