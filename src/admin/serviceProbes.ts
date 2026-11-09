/**
 * Probes every backend and outside dependency this build of the app is configured
 * with (import.meta.env, resolved like src/lib/config.ts), from the browser, so the
 * answer is what a visitor's browser gets. Same registry and probe code as the stack
 * script in devrel-agent-context/deployscritps/stack.
 *
 * Needs no admin key: it only reads public /health endpoints whose URLs ship in the bundle.
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import registryJson from '@/lib/services/endpoints.json';
import { probeAll, summarize, type ProbeRow, type Registry } from '@/lib/services/probe';
import { useAdmin } from './AdminContext';

export const serviceRegistry = registryJson as unknown as Registry;

export interface ServiceProbes {
    rows: ProbeRow[];
    summary: ReturnType<typeof summarize>;
    checkedAt: number;
}

async function runProbes(): Promise<ServiceProbes> {
    const env = import.meta.env as unknown as Record<string, string | undefined>;
    const rows = await probeAll(serviceRegistry, env, {
        browser: true,
        timeoutMs: 6000,
        pageOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
    });
    return { rows, summary: summarize(rows), checkedAt: Date.now() };
}

/**
 * `factor` multiplies the console's poll interval (the sidebar badge checks less often
 * than the Services page). A full round reaches ~30 hosts and the slowest health check
 * takes ~10 s, so never more often than every 30 s.
 */
export function useServiceProbes(factor = 1) {
    const { interval } = useAdmin();
    const every = interval(factor);
    return useQuery({
        queryKey: ['admin', 'service-probes'],
        queryFn: runProbes,
        refetchInterval: every === false ? false : Math.max(30_000, every),
        staleTime: 10_000,
        placeholderData: keepPreviousData,
        retry: 0,
    });
}
