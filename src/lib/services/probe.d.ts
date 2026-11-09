/** Types for ./probe.js (plain JS so the stack script can load it in Node too). */

export type EndpointGroup = 'testnet' | 'mainnet' | 'shared';
export type ProbeKind = 'health' | 'http' | 'evm-rpc' | 'sol-rpc';
export type ProbeStatus = 'live' | 'degraded' | 'mismatch' | 'reachable' | 'down' | 'unset';

export interface EndpointDef {
    id: string;
    group: EndpointGroup;
    kind: 'service' | 'dependency';
    /** Which process serves it in the stack script (mesh:testnet, cctp:mainnet, evm, solzk, mcp, remote). */
    service?: string;
    label: string;
    purpose: string;
    var?: string;
    fallbackVars?: string[];
    fallback?: string;
    fixed?: string;
    template?: string;
    probe: ProbeKind;
    path?: string;
    readyPath?: string;
    fromOrigin?: boolean;
    check?: { path: string; equals?: string; includes?: string; present?: boolean };
    detailPath?: string;
    optional?: boolean;
    /** Longer probe timeout for a health check that does slow work. */
    timeoutMs?: number;
    unsetNote?: string;
}

export interface Registry { endpoints: EndpointDef[] }

export interface ResolvedEndpoint extends EndpointDef {
    url: string;
    /** The setting the URL came from, "code default", "built in" or "not set". */
    source: string;
}

export interface ProbeResult {
    id: string;
    url: string;
    probeUrl: string;
    source: string;
    checkedAt: number;
    status: ProbeStatus;
    httpStatus?: number;
    latencyMs?: number;
    /** What the server says about itself: its network, a chain id, "enabled". */
    reported?: string;
    detail?: string;
    error?: string;
    warning?: string;
}

export interface ProbeRow { endpoint: ResolvedEndpoint; result: ProbeResult }

export interface ProbeOptions {
    fetch?: typeof fetch;
    timeoutMs?: number;
    /** In a browser: retry opaquely to tell "CORS-blocked" from "down". */
    browser?: boolean;
    /** The page's own origin: localhost URLs are flagged when the page is not local. */
    pageOrigin?: string;
}

export function getPath(obj: unknown, path?: string): unknown;
export function isLocalUrl(url: string): boolean;
export function resolveEndpoints(registry: Registry, env: Record<string, string | undefined>): ResolvedEndpoint[];
export function probeUrl(ep: ResolvedEndpoint): string;
export function probeEndpoint(ep: ResolvedEndpoint, opts?: ProbeOptions): Promise<ProbeResult>;
export function probeAll(registry: Registry, env: Record<string, string | undefined>, opts?: ProbeOptions): Promise<ProbeRow[]>;
export function summarize(rows: ProbeRow[]): {
    total: number; live: number; degraded: number; mismatch: number; reachable: number; down: number; unset: number; problems: number;
};
