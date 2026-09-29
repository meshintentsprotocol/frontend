// ============================================================================
// Remark plugins for docs markdown
// ============================================================================
// Kept dependency-free: a minimal mdast node shape and a recursive walk.

import { ANCHOR_DEPTHS, createSlugger } from './content';

interface MdNode {
    type: string;
    depth?: number;
    value?: string;
    children?: MdNode[];
    data?: { hName?: string; hProperties?: Record<string, unknown> };
}

function walk(node: MdNode, fn: (n: MdNode) => void) {
    fn(node);
    node.children?.forEach(c => walk(c, fn));
}

function textOf(node: MdNode): string {
    if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? '';
    return (node.children ?? []).map(textOf).join('');
}

/** Assigns ids to h2–h4 using the same slugger as the TOC extractor. */
export function remarkHeadingIds() {
    return (tree: MdNode) => {
        const slug = createSlugger();
        walk(tree, n => {
            if (n.type === 'heading' && n.depth && ANCHOR_DEPTHS.includes(n.depth)) {
                n.data = { ...n.data, hProperties: { ...n.data?.hProperties, id: slug(textOf(n).trim()) } };
            }
        });
    };
}

export const CALLOUT_TYPES = ['note', 'tip', 'info', 'warning', 'danger'] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

/**
 * GitHub-style alerts:  > [!WARNING] optional title
 * Rewrites the blockquote to <aside data-callout="warning" data-title="...">.
 */
export function remarkCallouts() {
    return (tree: MdNode) => {
        walk(tree, n => {
            if (n.type !== 'blockquote') return;
            const para = n.children?.[0];
            const first = para?.type === 'paragraph' ? para.children?.[0] : undefined;
            if (!first || first.type !== 'text' || !first.value) return;
            const m = /^\[!(\w+)\][ \t]*([^\n]*)\n?/.exec(first.value);
            if (!m) return;
            const type = m[1].toLowerCase();
            if (!(CALLOUT_TYPES as readonly string[]).includes(type)) return;
            first.value = first.value.slice(m[0].length);
            n.data = { hName: 'aside', hProperties: { 'data-callout': type, 'data-title': m[2] || undefined } };
        });
    };
}
