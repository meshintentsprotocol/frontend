/**
 * Local logos for native / bridged assets, keyed by market symbol. Every path
 * here exists in /public/logos — add the file before adding an entry.
 * CashToken logos come from BCMR (see tokenIcons.ts), not from this map.
 */
import { marketSymbolFor } from './marketData';

const LOGOS: Record<string, string> = {
    BCH: '/logos/bitcoin-cash-bch-logo.svg',
    BTC: '/logos/bitcoin-btc-logo.svg',
    ETH: '/logos/ethereum-eth-logo.svg',
    SOL: '/logos/solana.svg',
    BNB: '/logos/bnb-bnb-logo.svg',
    XMR: '/logos/monero.svg',
    MOVE: '/logos/movement.svg',
    USDC: '/logos/usd-coin-usdc-logo.svg',
    USDT: '/logos/usdt-svgrepo-com.svg',
};

/** ParyonUSD ships its own logo; keyed by symbol for rows without BCMR data. */
const CASHTOKEN_LOGOS: Record<string, string> = {
    PUSD: '/logos/paryonlog.svg',
    PUSDTEST: '/logos/paryonlog.svg',
};

/** Local logo for a symbol ("USDC (MOVE)", "WETH.e", "BCH", "PUSD"…), or null. */
export function logoForSymbol(symbol: string | null | undefined): string | null {
    if (!symbol) return null;
    const market = marketSymbolFor(symbol);
    if (market) return LOGOS[market] ?? null;
    return CASHTOKEN_LOGOS[symbol.toUpperCase()] ?? null;
}
