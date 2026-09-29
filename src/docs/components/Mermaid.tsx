import { useEffect, useId, useState } from 'react';
import { CodeBlock } from './CodeBlock';

// Mermaid is ~1MB, so it loads on first use and is initialised once with the
// docs palette (zinc surfaces, emerald accents).
let ready: Promise<typeof import('mermaid').default> | null = null;

function loadMermaid() {
    ready ??= import('mermaid').then(({ default: mermaid }) => {
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: 'base',
            fontFamily: 'inherit',
            themeVariables: {
                darkMode: true,
                fontSize: '13px',
                background: '#0b0b0d',
                primaryColor: '#0f1714',
                primaryTextColor: '#e4e4e7',
                primaryBorderColor: '#10b981',
                secondaryColor: '#111114',
                secondaryTextColor: '#e4e4e7',
                secondaryBorderColor: '#3f3f46',
                tertiaryColor: '#0d0d10',
                tertiaryTextColor: '#d4d4d8',
                tertiaryBorderColor: '#27272a',
                lineColor: '#52525b',
                textColor: '#d4d4d8',
                mainBkg: '#0f1714',
                nodeBorder: '#10b981',
                clusterBkg: '#0d0d10',
                clusterBorder: '#27272a',
                edgeLabelBackground: '#0b0b0d',
                // sequence diagrams
                actorBkg: '#0f1714',
                actorBorder: '#10b981',
                actorTextColor: '#f4f4f5',
                actorLineColor: '#3f3f46',
                signalColor: '#a1a1aa',
                signalTextColor: '#e4e4e7',
                labelBoxBkgColor: '#111114',
                labelBoxBorderColor: '#3f3f46',
                labelTextColor: '#e4e4e7',
                loopTextColor: '#a1a1aa',
                noteBkgColor: '#18181b',
                noteBorderColor: '#3f3f46',
                noteTextColor: '#d4d4d8',
                activationBkgColor: '#10b98133',
                activationBorderColor: '#10b981',
                sequenceNumberColor: '#050505',
                // state diagrams
                stateBkg: '#0f1714',
                stateLabelColor: '#e4e4e7',
                compositeBackground: '#0d0d10',
                altBackground: '#111114',
                transitionColor: '#52525b',
                transitionLabelColor: '#a1a1aa',
                specialStateColor: '#10b981',
            },
        });
        return mermaid;
    });
    return ready;
}

export function Mermaid({ chart, caption }: { chart: string; caption?: string }) {
    const id = 'mmd-' + useId().replace(/[^a-zA-Z0-9]/g, '');
    const [svg, setSvg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        loadMermaid()
            .then(m => m.render(id, chart))
            .then(({ svg }) => { if (!cancelled) setSvg(svg); })
            .catch(e => { if (!cancelled) setError(String(e?.message ?? e)); });
        return () => { cancelled = true; };
    }, [id, chart]);

    if (error) {
        return (
            <div>
                <p className="mt-6 text-xs text-rose-300">Diagram failed to render: {error}</p>
                <CodeBlock code={chart} lang="text" />
            </div>
        );
    }

    return (
        <figure className="not-prose my-8">
            <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#0b0b0d] p-6 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full">
                {svg ? (
                    <div dangerouslySetInnerHTML={{ __html: svg }} />
                ) : (
                    <div className="h-48 animate-pulse rounded-lg bg-white/[0.02]" aria-label="Loading diagram" />
                )}
            </div>
            {caption && <figcaption className="mt-3 text-center text-[13px] text-zinc-500">{caption}</figcaption>}
        </figure>
    );
}
