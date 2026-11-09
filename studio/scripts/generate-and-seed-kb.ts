// ============================================================================
// Generate Branded Cover Images & Seed Knowledge Base to Sanity
// ============================================================================
// Creates 16:10 high-resolution (1200x750) branded cover cards for every KB article,
// featuring real embedded token icons (BCH, XMR, USDC, USDT, ETH, SOL, etc.),
// glowing mesh grids, and live metric badges.
// Converts vector SVGs to crisp PNGs using sharp, saves local copies, uploads
// image assets to Sanity, and patches each kbArticle.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@sanity/client';
import { config } from 'dotenv';
import sharp from 'sharp';
import { parseArticle, tagSlug } from '../../src/components/knowledge-base/kbParse';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = resolve(HERE, '../..');
const LOGOS_DIR = join(FRONTEND, 'public/logos');
const KB_DIR = join(FRONTEND, 'src/components/knowledge-base/data');
const LOCAL_COVERS_DIR = join(FRONTEND, 'public/images/kb/covers');

config({ path: join(HERE, '../.env') });

const projectId = process.env.SANITY_STUDIO_PROJECT_ID;
const token = process.env.SANITY_WRITE_TOKEN;
const dataset = process.env.SANITY_STUDIO_DATASET || 'production';

if (!projectId || !token) {
    throw new Error('Missing SANITY_STUDIO_PROJECT_ID or SANITY_WRITE_TOKEN in studio/.env');
}

const client = createClient({
    projectId,
    dataset,
    token,
    apiVersion: '2025-02-19',
    useCdn: false,
});

if (!existsSync(LOCAL_COVERS_DIR)) {
    mkdirSync(LOCAL_COVERS_DIR, { recursive: true });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function wrapText(text: string, maxCharsPerLine = 26): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = '';

    for (const w of words) {
        if (!cur) {
            cur = w;
        } else if ((cur + ' ' + w).length <= maxCharsPerLine) {
            cur += ' ' + w;
        } else {
            lines.push(cur);
            cur = w;
        }
    }
    if (cur) lines.push(cur);
    return lines;
}

function loadLogoDataUri(filename: string): string {
    const p = join(LOGOS_DIR, filename);
    if (!existsSync(p)) return '';
    const raw = readFileSync(p);
    return `data:image/svg+xml;base64,${raw.toString('base64')}`;
}

const LOGOS = {
    bch: loadLogoDataUri('bitcoin-cash-bch-logo.svg'),
    xmr: loadLogoDataUri('monero.svg'),
    usdc: loadLogoDataUri('usd-coin-usdc-logo.svg'),
    usdt: loadLogoDataUri('usdt-svgrepo-com.svg'),
    eth: loadLogoDataUri('ethereum-eth-logo.svg'),
    btc: loadLogoDataUri('bitcoin-btc-logo.svg'),
    base: loadLogoDataUri('Base_square_blue.svg'),
    sol: loadLogoDataUri('solana.svg'),
    arb: loadLogoDataUri('arbitrum-arb-logo.svg'),
};

interface CoverConfig {
    category: string;
    badge: string;
    accent: string;
    token1: keyof typeof LOGOS;
    token2?: keyof typeof LOGOS;
    metricLabel1: string;
    metricValue1: string;
    metricLabel2: string;
    metricValue2: string;
    chartType: 'bars' | 'curve' | 'loop' | 'mesh' | 'blocks' | 'pipeline';
}

const ARTICLE_CONFIGS: Record<string, CoverConfig> = {
    'utxo-liquidity-revolution': {
        category: 'BCHMESH & LIQUIDITY',
        badge: 'UTXO LIQUIDITY',
        accent: '#0ac18e',
        token1: 'bch',
        token2: 'eth',
        metricLabel1: 'LP Fee Retention',
        metricValue1: '100% Direct',
        metricLabel2: 'Rebalance Gas',
        metricValue2: '< $0.01 USD',
        chartType: 'curve',
    },
    'bchmesh-v3-v4-mastery': {
        category: 'BCHMESH & LIQUIDITY',
        badge: 'V4 CONCENTRATED BINS',
        accent: '#06b6d4',
        token1: 'bch',
        token2: 'usdt',
        metricLabel1: 'Capital Velocity',
        metricValue1: '24.8x Efficiency',
        metricLabel2: 'Configurable Tiers',
        metricValue2: '5 / 25 / 100 bps',
        chartType: 'bars',
    },
    'closed-loop-auto-recycling': {
        category: 'BCHMESH & LIQUIDITY',
        badge: 'AUTO-RECYCLING',
        accent: '#10b981',
        token1: 'bch',
        token2: 'usdc',
        metricLabel1: 'Reverse Buy Mint',
        metricValue1: 'Instant Covenant',
        metricLabel2: 'Bot Infrastructure',
        metricValue2: '0 Hot Keys',
        chartType: 'loop',
    },
    'multi-market-shared-liquidity': {
        category: 'BCHMESH & LIQUIDITY',
        badge: 'SHARED MESH',
        accent: '#8b5cf6',
        token1: 'bch',
        token2: 'xmr',
        metricLabel1: 'Inventory Reuse',
        metricValue1: '1 Balance / N Pairs',
        metricLabel2: 'Double Spend Risk',
        metricValue2: '0% (Atomic UTXO)',
        chartType: 'mesh',
    },
    'bchmesh-lp-guide': {
        category: 'BCHMESH & LIQUIDITY',
        badge: 'LP & MARKET MAKER',
        accent: '#0ac18e',
        token1: 'bch',
        token2: 'usdc',
        metricLabel1: 'Single Asset Inflow',
        metricValue1: '100% Pure BCH',
        metricLabel2: 'Exit Safety',
        metricValue2: 'Unilateral Dock',
        chartType: 'bars',
    },
    'bchmesh-protocol-intro': {
        category: 'BCHMESH & LIQUIDITY',
        badge: 'PROTOCOL FABRIC',
        accent: '#14b8a6',
        token1: 'bch',
        token2: 'usdt',
        metricLabel1: 'Covenant Architecture',
        metricValue1: 'CashTokens Native',
        metricLabel2: 'Settlement Mode',
        metricValue2: 'Discrete UTXO',
        chartType: 'mesh',
    },
    'bch-xmr-atomic-swaps': {
        category: 'CROSS-CHAIN & MONERO',
        badge: 'ATOMIC PRIVACY SWAPS',
        accent: '#f26822',
        token1: 'bch',
        token2: 'xmr',
        metricLabel1: 'Settlement Model',
        metricValue1: 'Adaptor Signatures',
        metricLabel2: 'Custodial Risk',
        metricValue2: '0% Trustless',
        chartType: 'loop',
    },
    'developer-crosschain-guide': {
        category: 'DEVELOPERS & MONETIZATION',
        badge: 'SDK & INTEGRATION',
        accent: '#3b82f6',
        token1: 'bch',
        token2: 'base',
        metricLabel1: 'Cross-Chain Quoting',
        metricValue1: 'Zero-Inventory Solvers',
        metricLabel2: 'Integration SDK',
        metricValue2: 'TypeScript / CLI',
        chartType: 'blocks',
    },
    'developer-monetization-guide': {
        category: 'DEVELOPERS & MONETIZATION',
        badge: 'DEVELOPER REVENUE',
        accent: '#f59e0b',
        token1: 'bch',
        token2: 'usdc',
        metricLabel1: 'Fee Capture',
        metricValue1: '100% Retained',
        metricLabel2: 'Relayer Split',
        metricValue2: 'Custom Basis Points',
        chartType: 'bars',
    },
    'intro': {
        category: 'GETTING STARTED',
        badge: 'INTENTS QUICKSTART',
        accent: '#0ac18e',
        token1: 'bch',
        token2: 'eth',
        metricLabel1: 'Execution Style',
        metricValue1: 'Declarative Intents',
        metricLabel2: 'Cross-Chain Speed',
        metricValue2: 'Sub-Minute Finality',
        chartType: 'pipeline',
    },
    'intents-deep-dive': {
        category: 'GETTING STARTED',
        badge: 'ARCHITECTURE DEEP DIVE',
        accent: '#8b5cf6',
        token1: 'bch',
        token2: 'btc',
        metricLabel1: 'Verification',
        metricValue1: 'Cryptographic Covenants',
        metricLabel2: 'MEV Resistance',
        metricValue2: 'Deterministic Dutch',
        chartType: 'pipeline',
    },
    'limit-orders': {
        category: 'PROTOCOL FEATURES',
        badge: 'LIMIT SWAPS',
        accent: '#10b981',
        token1: 'bch',
        token2: 'usdt',
        metricLabel1: 'Order Expiration',
        metricValue1: 'GTC or Block-Height',
        metricLabel2: 'Cancellation Gas',
        metricValue2: 'Standard BCH Fee',
        chartType: 'bars',
    },
    'cross-chain': {
        category: 'CROSS-CHAIN & MONERO',
        badge: 'CROSS-CHAIN FABRIC',
        accent: '#2563eb',
        token1: 'bch',
        token2: 'sol',
        metricLabel1: 'Supported Chains',
        metricValue1: 'BCH · EVM · XMR · SOL',
        metricLabel2: 'Bridge Security',
        metricValue2: 'No Wrapped Escrows',
        chartType: 'mesh',
    },
    'official-docs': {
        category: 'DOCUMENTATION',
        badge: 'SPECIFICATION',
        accent: '#64748b',
        token1: 'bch',
        token2: 'usdc',
        metricLabel1: 'Smart Contracts',
        metricValue1: 'CashScript v0.10',
        metricLabel2: 'Audit Status',
        metricValue2: 'Formally Verified',
        chartType: 'blocks',
    },
};

// ── SVG Diagram Generators ───────────────────────────────────────────────────

function renderGraphic(type: CoverConfig['chartType'], accent: string): string {
    switch (type) {
        case 'bars':
            return `
                <g transform="translate(680, 420)">
                    <rect x="0" y="80" width="22" height="60" rx="4" fill="${accent}" opacity="0.3"/>
                    <rect x="30" y="50" width="22" height="90" rx="4" fill="${accent}" opacity="0.5"/>
                    <rect x="60" y="20" width="22" height="120" rx="4" fill="${accent}" opacity="0.8"/>
                    <rect x="90" y="0" width="26" height="140" rx="4" fill="${accent}"/>
                    <rect x="124" y="15" width="22" height="125" rx="4" fill="${accent}" opacity="0.85"/>
                    <rect x="154" y="40" width="22" height="100" rx="4" fill="${accent}" opacity="0.6"/>
                    <rect x="184" y="70" width="22" height="70" rx="4" fill="${accent}" opacity="0.4"/>
                    <rect x="214" y="95" width="22" height="45" rx="4" fill="${accent}" opacity="0.25"/>
                    <line x1="-10" y1="140" x2="250" y2="140" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
                    <circle cx="103" cy="-12" r="6" fill="#fff"/>
                    <line x1="103" y1="-5" x2="103" y2="140" stroke="#fff" stroke-dasharray="3,3" opacity="0.6"/>
                </g>
            `;
        case 'curve':
            return `
                <g transform="translate(680, 415)">
                    <path d="M 0,130 Q 80,120 120,70 T 240,10" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2" stroke-dasharray="4,4"/>
                    <path d="M 0,130 H 40 V 100 H 90 V 70 H 150 V 40 H 200 V 15 H 240" fill="none" stroke="${accent}" stroke-width="3.5"/>
                    <circle cx="40" cy="100" r="5" fill="${accent}"/>
                    <circle cx="90" cy="70" r="5" fill="${accent}"/>
                    <circle cx="150" cy="40" r="6" fill="#fff"/>
                    <circle cx="200" cy="15" r="5" fill="${accent}"/>
                </g>
            `;
        case 'loop':
            return `
                <g transform="translate(790, 475)">
                    <circle cx="0" cy="0" r="65" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
                    <path d="M -45,-45 A 65 65 0 0 1 45,-45" fill="none" stroke="${accent}" stroke-width="4"/>
                    <polygon points="50,-40 45,-55 35,-42" fill="${accent}"/>
                    <path d="M 45,45 A 65 65 0 0 1 -45,45" fill="none" stroke="${accent}" stroke-width="4"/>
                    <polygon points="-50,40 -45,55 -35,42" fill="${accent}"/>
                    <circle cx="0" cy="0" r="28" fill="${accent}" opacity="0.15"/>
                    <circle cx="0" cy="0" r="8" fill="#fff"/>
                </g>
            `;
        case 'mesh':
            return `
                <g transform="translate(670, 420)">
                    <line x1="120" y1="70" x2="30" y2="20" stroke="${accent}" stroke-width="2" opacity="0.6"/>
                    <line x1="120" y1="70" x2="210" y2="20" stroke="${accent}" stroke-width="2" opacity="0.6"/>
                    <line x1="120" y1="70" x2="40" y2="130" stroke="${accent}" stroke-width="2" opacity="0.6"/>
                    <line x1="120" y1="70" x2="200" y2="130" stroke="${accent}" stroke-width="2" opacity="0.6"/>
                    <line x1="30" y1="20" x2="210" y2="20" stroke="rgba(255,255,255,0.15)" stroke-dasharray="3,3"/>
                    <line x1="40" y1="130" x2="200" y2="130" stroke="rgba(255,255,255,0.15)" stroke-dasharray="3,3"/>
                    <circle cx="30" cy="20" r="14" fill="#131b2e" stroke="${accent}" stroke-width="2"/>
                    <circle cx="210" cy="20" r="14" fill="#131b2e" stroke="${accent}" stroke-width="2"/>
                    <circle cx="40" cy="130" r="14" fill="#131b2e" stroke="${accent}" stroke-width="2"/>
                    <circle cx="200" cy="130" r="14" fill="#131b2e" stroke="${accent}" stroke-width="2"/>
                    <circle cx="120" cy="70" r="26" fill="${accent}" opacity="0.25"/>
                    <circle cx="120" cy="70" r="18" fill="#131b2e" stroke="#fff" stroke-width="2.5"/>
                    <circle cx="120" cy="70" r="6" fill="${accent}"/>
                </g>
            `;
        case 'blocks':
            return `
                <g transform="translate(670, 430)">
                    <rect x="0" y="0" width="105" height="55" rx="8" fill="#131b2e" stroke="${accent}" stroke-width="1.5"/>
                    <text x="14" y="25" fill="${accent}" font-size="11" font-family="monospace" font-weight="bold">COVENANT</text>
                    <text x="14" y="42" fill="rgba(255,255,255,0.6)" font-size="10" font-family="monospace">0x4a9b...c12f</text>
                    <line x1="105" y1="27" x2="135" y2="27" stroke="${accent}" stroke-width="2"/>
                    <rect x="135" y="0" width="115" height="55" rx="8" fill="#131b2e" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
                    <text x="148" y="25" fill="#fff" font-size="11" font-family="monospace" font-weight="bold">VERIFIED</text>
                    <text x="148" y="42" fill="${accent}" font-size="10" font-family="monospace">SpendPath: OK</text>
                    <rect x="40" y="70" width="170" height="42" rx="8" fill="rgba(10,193,142,0.1)" stroke="${accent}" stroke-dasharray="3,3"/>
                    <text x="65" y="96" fill="${accent}" font-size="12" font-family="monospace">Unilateral Dock</text>
                </g>
            `;
        case 'pipeline':
        default:
            return `
                <g transform="translate(670, 445)">
                    <rect x="0" y="0" width="70" height="42" rx="6" fill="#131b2e" stroke="${accent}" stroke-width="1.5"/>
                    <text x="15" y="26" fill="#fff" font-size="11" font-weight="bold" font-family="sans-serif">Intent</text>
                    <line x1="70" y1="21" x2="95" y2="21" stroke="${accent}" stroke-width="2"/>
                    <rect x="95" y="0" width="70" height="42" rx="6" fill="#131b2e" stroke="${accent}" stroke-width="1.5"/>
                    <text x="108" y="26" fill="${accent}" font-size="11" font-weight="bold" font-family="sans-serif">Solver</text>
                    <line x1="165" y1="21" x2="190" y2="21" stroke="${accent}" stroke-width="2"/>
                    <rect x="190" y="0" width="65" height="42" rx="6" fill="${accent}" opacity="0.9"/>
                    <text x="202" y="26" fill="#090d16" font-size="11" font-weight="bold" font-family="sans-serif">Settle</text>
                </g>
            `;
    }
}

// ── Master SVG Generator (Standard SVG - 100% librsvg/sharp compatible) ───────

function generateCoverSvg(title: string, summary: string, cfg: CoverConfig): string {
    const token1Uri = LOGOS[cfg.token1];
    const token2Uri = cfg.token2 ? LOGOS[cfg.token2] : '';

    const cleanSummary = summary.length > 135 ? summary.slice(0, 132) + '...' : summary;
    const titleLines = wrapText(title, 24);
    const summaryLines = wrapText(cleanSummary, 42);

    const titleTspans = titleLines
        .map((line, i) => `<tspan x="80" dy="${i === 0 ? 0 : 46}">${escapeXml(line)}</tspan>`)
        .join('');

    const summaryTspans = summaryLines
        .map((line, i) => `<tspan x="80" dy="${i === 0 ? 0 : 26}">${escapeXml(line)}</tspan>`)
        .join('');

    return `<?xml version="1.0" encoding="utf-8"?>
<svg width="1200" height="750" viewBox="0 0 1200 750" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#080c16"/>
            <stop offset="50%" stop-color="#0d1424"/>
            <stop offset="100%" stop-color="#070a12"/>
        </linearGradient>

        <radialGradient id="glowGrad1" cx="85%" cy="30%" r="60%">
            <stop offset="0%" stop-color="${cfg.accent}" stop-opacity="0.32"/>
            <stop offset="70%" stop-color="#0d1424" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="glowGrad2" cx="15%" cy="85%" r="50%">
            <stop offset="0%" stop-color="${cfg.accent}" stop-opacity="0.14"/>
            <stop offset="80%" stop-color="#080c16" stop-opacity="0"/>
        </radialGradient>

        <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="rgba(255, 255, 255, 0.08)"/>
            <stop offset="100%" stop-color="rgba(255, 255, 255, 0.02)"/>
        </linearGradient>

        <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.035)" stroke-width="1"/>
        </pattern>
    </defs>

    <!-- Canvas Background -->
    <rect width="1200" height="750" fill="url(#bgGrad)"/>
    <rect width="1200" height="750" fill="url(#gridPattern)"/>

    <!-- Ambient Glows -->
    <rect width="1200" height="750" fill="url(#glowGrad1)"/>
    <rect width="1200" height="750" fill="url(#glowGrad2)"/>

    <!-- Top Ambient Accent Line -->
    <line x1="0" y1="0" x2="1200" y2="0" stroke="${cfg.accent}" stroke-width="4" opacity="0.85"/>

    <!-- Left Header Meta / Category Pill -->
    <g transform="translate(80, 75)">
        <rect x="0" y="0" width="230" height="34" rx="17" fill="rgba(255, 255, 255, 0.05)" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1"/>
        <circle cx="17" cy="17" r="5" fill="${cfg.accent}"/>
        <text x="32" y="22" fill="#e2e8f0" font-size="11" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" letter-spacing="1.5">${escapeXml(cfg.category)}</text>
    </g>

    <!-- Right Brand Badge -->
    <g transform="translate(870, 75)">
        <rect x="0" y="0" width="250" height="34" rx="17" fill="rgba(10, 193, 142, 0.08)" stroke="${cfg.accent}" stroke-opacity="0.3" stroke-width="1"/>
        <text x="125" y="22" fill="${cfg.accent}" font-size="11" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" letter-spacing="1.5" text-anchor="middle">${escapeXml(cfg.badge)}</text>
    </g>

    <!-- Title Block (Left Column) -->
    <text x="80" y="220" fill="#ffffff" font-size="38" font-weight="800" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" letter-spacing="-0.5">
        ${titleTspans}
    </text>

    <!-- Summary Block -->
    <text x="80" y="440" fill="#94a3b8" font-size="17" font-weight="400" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
        ${summaryTspans}
    </text>

    <!-- Protocol Footer Indicator -->
    <g transform="translate(80, 600)">
        <rect x="0" y="0" width="340" height="42" rx="21" fill="rgba(255, 255, 255, 0.04)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1"/>
        <text x="24" y="26" fill="#cbd5e1" font-size="12" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600">BCHMesh Liquidity Layer</text>
        <circle cx="215" cy="21" r="3" fill="#64748b"/>
        <text x="230" y="26" fill="${cfg.accent}" font-size="12" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700">Verified</text>
    </g>

    <!-- Right Column: Bento Graphic Box & Token Badges -->
    <g transform="translate(660, 150)">
        <rect x="0" y="0" width="460" height="490" rx="24" fill="url(#glassGrad)" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1.5"/>
        <circle cx="230" cy="180" r="160" fill="${cfg.accent}" opacity="0.08"/>

        <!-- Token Pair Floating Spheres -->
        <g transform="translate(140, 50)">
            <circle cx="60" cy="60" r="48" fill="#131b2e" stroke="${cfg.accent}" stroke-width="3"/>
            <image href="${token1Uri}" x="22" y="22" width="76" height="76"/>

            ${token2Uri
            ? `
            <circle cx="135" cy="60" r="40" fill="#131b2e" stroke="rgba(255,255,255,0.3)" stroke-width="2.5"/>
            <image href="${token2Uri}" x="103" y="28" width="64" height="64"/>
            `
            : ''
        }
        </g>

        <!-- Visual Diagram in the Bento box -->
        ${renderGraphic(cfg.chartType, cfg.accent)}

        <!-- Bottom Metric Glass Badges -->
        <g transform="translate(30, 375)">
            <rect x="0" y="0" width="190" height="85" rx="14" fill="rgba(15, 23, 42, 0.7)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1"/>
            <text x="18" y="32" fill="#94a3b8" font-size="12" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="500">${escapeXml(cfg.metricLabel1)}</text>
            <text x="18" y="64" fill="${cfg.accent}" font-size="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800">${escapeXml(cfg.metricValue1)}</text>

            <rect x="210" y="0" width="190" height="85" rx="14" fill="rgba(15, 23, 42, 0.7)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1"/>
            <text x="228" y="32" fill="#94a3b8" font-size="12" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="500">${escapeXml(cfg.metricLabel2)}</text>
            <text x="228" y="64" fill="#ffffff" font-size="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800">${escapeXml(cfg.metricValue2)}</text>
        </g>
    </g>

    <rect x="660" y="640" width="460" height="2" fill="${cfg.accent}" opacity="0.4"/>
</svg>`;
}

// ── Main Pipeline ────────────────────────────────────────────────────────────

async function main() {
    console.log('🚀 Starting KB Image Generation & Sanity Seed Pipeline...\n');

    const articlesDir = join(KB_DIR, 'articles');
    const files = [
        'utxo-liquidity-revolution.md',
        'bchmesh-v3-v4-mastery.md',
        'closed-loop-auto-recycling.md',
        'multi-market-shared-liquidity.md',
        'bchmesh-lp-guide.md',
        'bchmesh-protocol-intro.md',
        'bch-xmr-atomic-swaps.md',
        'developer-crosschain-guide.md',
        'developer-monetization-guide.md',
        'intro.md',
        'intents-deep-dive.md',
        'limit-orders.md',
        'cross-chain.md',
        'official-docs.md',
    ];

    for (const file of files) {
        const fullPath = join(articlesDir, file);
        if (!existsSync(fullPath)) {
            console.warn(`⚠️  File not found: ${file}`);
            continue;
        }

        const raw = readFileSync(fullPath, 'utf8');
        const parsed = parseArticle(raw);
        const articleId = parsed.id;
        const cfg = ARTICLE_CONFIGS[articleId] || {
            category: 'KNOWLEDGE BASE',
            badge: 'BCH INTENTS',
            accent: '#0ac18e',
            token1: 'bch',
            token2: 'usdc',
            metricLabel1: 'Protocol',
            metricValue1: 'BCHMesh',
            metricLabel2: 'Finality',
            metricValue2: 'Instant',
            chartType: 'bars',
        };

        console.log(`🎨 [${articleId}] "${parsed.title}"`);

        // 1. Generate SVG
        const svgContent = generateCoverSvg(parsed.title, parsed.summary, cfg);

        // 2. Render to high-DPI PNG via sharp
        const pngBuffer = await sharp(Buffer.from(svgContent, 'utf8')).png().toBuffer();

        // 3. Save local copies (both SVG and PNG)
        writeFileSync(join(LOCAL_COVERS_DIR, `${articleId}.svg`), svgContent, 'utf8');
        writeFileSync(join(LOCAL_COVERS_DIR, `${articleId}.png`), pngBuffer);

        // 4. Ensure Taxonomy & Article Document exist in Sanity
        const docId = `kbArticle-${articleId}`;
        const authorId = `author-${tagSlug(parsed.author)}`;
        const tagDocs = parsed.tags.map(t => ({
            _id: `tag-${tagSlug(t)}`,
            _type: 'tag',
            title: t,
            slug: { _type: 'slug', current: tagSlug(t) },
        }));

        await client.createIfNotExists({
            _id: authorId,
            _type: 'author',
            name: parsed.author,
            slug: { _type: 'slug', current: tagSlug(parsed.author) },
        });

        for (const t of tagDocs) {
            await client.createIfNotExists(t);
        }

        const dateIso = parsed.date ? new Date(`${parsed.date} UTC`).toISOString().slice(0, 10) : undefined;
        await client.createIfNotExists({
            _id: docId,
            _type: 'kbArticle',
            title: parsed.title,
            slug: { _type: 'slug', current: articleId },
            summary: parsed.summary,
            body: parsed.content,
            category: { _type: 'reference', _ref: `kbCategory-${parsed.categoryId}` },
            tags: tagDocs.map(t => ({ _type: 'reference', _ref: t._id, _key: t._id })),
            author: { _type: 'reference', _ref: authorId },
            ...(dateIso ? { publishedAt: dateIso } : {}),
            readTime: parsed.readTime,
            featured: articleId === 'utxo-liquidity-revolution',
        });

        // 5. Upload PNG asset to Sanity
        process.stdout.write(`  ⬆️  Uploading PNG asset... `);
        const asset = await client.assets.upload('image', pngBuffer, {
            filename: `${articleId}-cover.png`,
            contentType: 'image/png',
        });
        console.log(`Asset: ${asset._id}`);

        // 6. Patch kbArticle with coverImage reference
        process.stdout.write(`  🔗 Linking to ${docId}... `);
        await client
            .patch(docId)
            .set({
                summary: parsed.summary,
                body: parsed.content,
                readTime: parsed.readTime,
                ...(dateIso ? { publishedAt: dateIso } : {}),
                featured: articleId === 'utxo-liquidity-revolution',
                coverImage: {
                    _type: 'image',
                    asset: {
                        _type: 'reference',
                        _ref: asset._id,
                    },
                    alt: parsed.title,
                },
            })
            .commit();
        console.log(`✅ Linked\n`);
    }

    console.log('🎉 Successfully created covers and seeded all 14 articles into Sanity!');
}

main().catch(err => {
    console.error('❌ Pipeline failed:', err);
    process.exit(1);
});
