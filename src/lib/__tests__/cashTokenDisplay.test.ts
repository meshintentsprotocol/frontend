import { describe, it, expect } from 'vitest';
import { getChainMeta } from '../chains';
import { cashTokenDisplay } from '../cashTokenDisplay';
import { CauldronService } from '../cauldron';
import { getIconFallbackUrls } from '../tokenIcons';

const category = '7fab3da44f2138e51aa056ee2b29835f70f10d3d96b06ef959937763e82c3137';
describe('CashToken identity display', () => {
    it('keeps published metadata', () => {
        expect(cashTokenDisplay(category, 'ParyonUSD', 'PUSD')).toEqual({ name: 'ParyonUSD', symbol: 'PUSD' });
    });
    it('does not present a category hash as a token name or invent a ticker', () => {
        const result = cashTokenDisplay(category, category, '7FAB3D');
        expect(result.name).toBe('Unnamed CashToken');
        expect(result.symbol).toContain(category.slice(-4));
        expect(result.symbol.length).toBeLessThan(20);
    });
    it('lets BCMR replace a listing placeholder, including its decimals and icon', () => {
        const raw = { token_id: category, display_name: category, display_symbol: '', bcmr: undefined } as Parameters<typeof CauldronService.metadataOf>[0];
        const bcmr = { name: 'Published name', symbol: 'PUB', decimals: 8, icon: 'ipfs://logo' } as Parameters<typeof CauldronService.metadataOf>[1];
        expect(CauldronService.metadataOf(raw, bcmr)).toMatchObject({ name: 'Published name', symbol: 'PUB', decimals: 8, iconRaw: 'ipfs://logo' });
    });
    it('resolves chain badges for the portfolio testnet labels', () => {
        expect(getChainMeta('Arc Testnet')?.id).toBe('arc');
        expect(getChainMeta('Base Sepolia')?.id).toBe('base');
        expect(getChainMeta('OP Sepolia')?.id).toBe('optimism');
        expect(getChainMeta('eth-sepolia')?.id).toBe('ethereum');
    });
    it('renders deterministic local placeholders without an external image service', () => {
        const icon = getIconFallbackUrls(null, category)[0];
        expect(icon.startsWith('data:image/svg+xml,')).toBe(true);
        expect(getIconFallbackUrls(null, category)[0]).toBe(icon);
        expect(getIconFallbackUrls(null, 'another-category')[0]).not.toBe(icon);
    });
});
