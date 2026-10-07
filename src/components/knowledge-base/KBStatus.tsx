import { Button } from '@/components/ui/button';
import type { KbService } from './kbService';

/**
 * Full-page placeholder while the knowledge base loads, or the retry state when
 * it could not be loaded. Returns null once content is available.
 */
export function KBStatus({ kb }: { kb: Pick<KbService, 'loading' | 'failed' | 'retry'> }) {
    if (kb.failed) {
        return (
            <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="text-lg font-semibold">The knowledge base could not be loaded</p>
                <p className="max-w-sm text-sm text-muted-foreground">The content service did not respond. Check your connection and try again.</p>
                <Button onClick={kb.retry}>Try again</Button>
            </div>
        );
    }
    if (kb.loading) {
        return (
            <div className="container mx-auto max-w-5xl px-4 pt-32" aria-busy="true" aria-label="Loading">
                <div className="h-4 w-48 animate-pulse rounded bg-muted/60" />
                <div className="mt-8 h-12 w-3/4 animate-pulse rounded-lg bg-muted/60" />
                <div className="mt-4 h-5 w-1/2 animate-pulse rounded bg-muted/40" />
                <div className="mt-10 grid gap-6 md:grid-cols-3">
                    {[0, 1, 2].map(i => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted/40" />)}
                </div>
            </div>
        );
    }
    return null;
}
