import { useState, type CSSProperties } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import ts from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import js from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import solidity from 'react-syntax-highlighter/dist/esm/languages/prism/solidity';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import { Check, Copy, FileCode2, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

SyntaxHighlighter.registerLanguage('typescript', ts);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('javascript', js);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('solidity', solidity);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('diff', diff);
SyntaxHighlighter.registerLanguage('rust', rust);

const ALIASES: Record<string, string> = {
    ts: 'typescript', js: 'javascript', sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash',
    cashscript: 'solidity', cash: 'solidity', yml: 'yaml', rs: 'rust',
};

const LABELS: Record<string, string> = {
    typescript: 'TypeScript', tsx: 'TSX', javascript: 'JavaScript', jsx: 'JSX', bash: 'Terminal',
    json: 'JSON', yaml: 'YAML', diff: 'Diff', rust: 'Rust', cashscript: 'CashScript', text: 'Text',
};

// Brand-tuned token colors: zinc base, emerald strings, violet keywords.
const MONO = 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace';
const base: CSSProperties = {
    color: '#d4d4d8', fontFamily: MONO, fontSize: '13px', lineHeight: '1.7',
    background: 'transparent', whiteSpace: 'pre', tabSize: 2,
};
const THEME: Record<string, CSSProperties> = {
    'code[class*="language-"]': base,
    'pre[class*="language-"]': { ...base, margin: 0, padding: 0, overflow: 'auto' },
    comment: { color: '#71717a', fontStyle: 'italic' },
    prolog: { color: '#71717a' },
    punctuation: { color: '#a1a1aa' },
    property: { color: '#7dd3fc' }, tag: { color: '#7dd3fc' }, constant: { color: '#7dd3fc' }, symbol: { color: '#7dd3fc' },
    deleted: { color: '#fda4af' },
    boolean: { color: '#fcd34d' }, number: { color: '#fcd34d' },
    string: { color: '#6ee7b7' }, char: { color: '#6ee7b7' }, 'attr-value': { color: '#6ee7b7' }, inserted: { color: '#6ee7b7' },
    selector: { color: '#6ee7b7' }, 'attr-name': { color: '#7dd3fc' }, builtin: { color: '#7dd3fc' },
    operator: { color: '#a1a1aa' }, url: { color: '#6ee7b7' },
    keyword: { color: '#c4b5fd' }, atrule: { color: '#c4b5fd' },
    function: { color: '#93c5fd' }, 'class-name': { color: '#93c5fd' },
    regex: { color: '#fda4af' }, important: { color: '#fda4af', fontWeight: 600 }, variable: { color: '#fda4af' },
};

export function normalizeLang(lang?: string) {
    const l = (lang || 'text').toLowerCase();
    return { highlight: ALIASES[l] ?? l, label: LABELS[l] ?? LABELS[ALIASES[l] ?? ''] ?? l.toUpperCase() };
}

/** Parses "{1,4-6}" from a fence meta string into a set of line numbers. */
function parseHighlights(meta?: string): Set<number> {
    const out = new Set<number>();
    const m = /\{([\d,\s-]+)\}/.exec(meta ?? '');
    if (!m) return out;
    for (const part of m[1].split(',')) {
        const [a, b] = part.split('-').map(s => parseInt(s.trim(), 10));
        if (Number.isNaN(a)) continue;
        for (let i = a; i <= (Number.isNaN(b) || b === undefined ? a : b); i++) out.add(i);
    }
    return out;
}

export function parseTitle(meta?: string): string | undefined {
    return /title="([^"]+)"/.exec(meta ?? '')?.[1];
}

export function CopyButton({ text, className }: { text: string; className?: string }) {
    const [done, setDone] = useState(false);
    return (
        <button
            type="button"
            aria-label={done ? 'Copied' : 'Copy code'}
            onClick={() => {
                navigator.clipboard?.writeText(text).then(() => {
                    setDone(true);
                    setTimeout(() => setDone(false), 1500);
                });
            }}
            className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200',
                className,
            )}
        >
            {done ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
    );
}

export function HighlightedCode({ code, lang, meta }: { code: string; lang?: string; meta?: string }) {
    const { highlight } = normalizeLang(lang);
    const marked = parseHighlights(meta);
    return (
        <SyntaxHighlighter
            language={highlight}
            style={THEME}
            PreTag="div"
            wrapLines={marked.size > 0}
            lineProps={(n: number) =>
                marked.has(n)
                    ? { style: { display: 'block', margin: '0 -1.25rem', padding: '0 1.25rem', background: 'rgba(16,185,129,0.08)', boxShadow: 'inset 2px 0 0 #10b981' } }
                    : { style: { display: 'block' } }
            }
            customStyle={{ margin: 0, padding: '1rem 1.25rem', background: 'transparent' }}
        >
            {code}
        </SyntaxHighlighter>
    );
}

export function CodeBlock({ code, lang, meta }: { code: string; lang?: string; meta?: string }) {
    const { label, highlight } = normalizeLang(lang);
    const title = parseTitle(meta);
    const Icon = highlight === 'bash' ? Terminal : FileCode2;
    return (
        <div className="group my-6 overflow-hidden rounded-xl border border-white/[0.06] bg-[#0b0b0d]">
            <div className="flex h-10 items-center justify-between border-b border-white/[0.06] bg-white/[0.015] pl-4 pr-2">
                <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-400">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    <span className="truncate font-mono">{title ?? label}</span>
                    {title && <span className="text-zinc-600">· {label}</span>}
                </div>
                <CopyButton text={code} />
            </div>
            <HighlightedCode code={code} lang={lang} meta={meta} />
        </div>
    );
}

// ── Code group ───────────────────────────────────────────────────────────────
// ```codegroup
// @@ npm | bash
// npm install @bch-intents/sdk
// @@ pnpm | bash
// pnpm add @bch-intents/sdk
// ```

export interface CodeTab { label: string; lang: string; code: string }

export function parseCodeGroup(src: string): CodeTab[] {
    const tabs: CodeTab[] = [];
    let cur: CodeTab | null = null;
    for (const line of src.split('\n')) {
        const m = /^@@\s*(.+?)\s*(?:\|\s*(\S+))?\s*$/.exec(line);
        if (m) {
            if (cur) tabs.push(cur);
            cur = { label: m[1], lang: m[2] ?? 'text', code: '' };
        } else if (cur) {
            cur.code += (cur.code ? '\n' : '') + line;
        }
    }
    if (cur) tabs.push(cur);
    return tabs.map(t => ({ ...t, code: t.code.replace(/\n+$/, '') }));
}

export function CodeGroup({ tabs }: { tabs: CodeTab[] }) {
    const [active, setActive] = useState(0);
    const tab = tabs[active] ?? tabs[0];
    if (!tab) return null;
    return (
        <div className="my-6 overflow-hidden rounded-xl border border-white/[0.06] bg-[#0b0b0d]">
            <div className="flex h-10 items-center justify-between border-b border-white/[0.06] bg-white/[0.015] pr-2">
                <div role="tablist" className="flex h-full overflow-x-auto scrollbar-none">
                    {tabs.map((t, i) => (
                        <button
                            key={t.label}
                            role="tab"
                            aria-selected={i === active}
                            onClick={() => setActive(i)}
                            className={cn(
                                'relative h-full whitespace-nowrap px-4 text-xs font-medium transition-colors',
                                i === active ? 'text-white' : 'text-zinc-500 hover:text-zinc-300',
                            )}
                        >
                            {t.label}
                            {i === active && <span className="absolute inset-x-3 bottom-0 h-px bg-emerald-400" />}
                        </button>
                    ))}
                </div>
                <CopyButton text={tab.code} />
            </div>
            <HighlightedCode code={tab.code} lang={tab.lang} />
        </div>
    );
}
