import { Component, createContext, useContext, type ReactNode } from 'react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { CMS_STALE_TIME, siteOf } from '@/lib/sanity';
import type { Site } from '@/shared/seo';
import type { Docs } from './content';
import { loadDocs } from './source';

const DOCS_KEY = ['cms', 'docs'];

interface DocsState {
    docs: Docs;
    site: Site;
}

const DocsContext = createContext<DocsState | null>(null);

function Loaded({ children }: { children: ReactNode }) {
    const { data } = useSuspenseQuery({ queryKey: DOCS_KEY, queryFn: loadDocs, staleTime: CMS_STALE_TIME });
    return <DocsContext.Provider value={{ docs: data.docs, site: siteOf(data.settings) }}>{children}</DocsContext.Provider>;
}

class Boundary extends Component<{ onRetry: () => void; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#050505] px-6 text-center">
                <p className="text-[17px] font-semibold text-white">The docs could not be loaded</p>
                <p className="max-w-sm text-[14px] leading-6 text-zinc-500">The content service did not respond. Check your connection and try again.</p>
                <button
                    type="button"
                    onClick={() => { this.props.onRetry(); this.setState({ failed: false }); }}
                    className="h-10 rounded-lg bg-emerald-500 px-4 text-[13.5px] font-semibold text-black transition-colors hover:bg-emerald-400"
                >
                    Try again
                </button>
            </div>
        );
    }
}

/** Loads the docs once (suspending while it does) and serves them to everything below. */
export function DocsProvider({ children }: { children: ReactNode }) {
    const client = useQueryClient();
    return (
        <Boundary onRetry={() => client.resetQueries({ queryKey: DOCS_KEY })}>
            <Loaded>{children}</Loaded>
        </Boundary>
    );
}

function useDocsState(): DocsState {
    const state = useContext(DocsContext);
    if (!state) throw new Error('useDocs must be used inside <DocsProvider>');
    return state;
}

export const useDocs = (): Docs => useDocsState().docs;
export const useDocsSite = (): Site => useDocsState().site;
