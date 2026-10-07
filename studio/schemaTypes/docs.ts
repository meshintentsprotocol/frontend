import { defineArrayMember, defineField, defineType } from 'sanity';

/** Keys of `ICONS` in frontend/src/docs/nav.ts. */
const SECTION_ICONS = ['rocket', 'zap', 'network', 'file-code', 'package', 'server', 'bot', 'book-open', 'shield', 'layers', 'wallet', 'terminal'];

export const docsPage = defineType({
    name: 'docsPage',
    title: 'Docs page',
    type: 'document',
    groups: [
        { name: 'content', title: 'Content', default: true },
        { name: 'meta', title: 'Details' },
        { name: 'seo', title: 'SEO' },
    ],
    fields: [
        defineField({ name: 'title', type: 'string', group: 'content', validation: r => r.required() }),
        defineField({
            name: 'slug',
            type: 'slug',
            group: 'content',
            description: 'Full path under /docs, for example mesh/pools/lifecycle. Changing it breaks existing links.',
            options: { source: 'title', slugify: input => input.toLowerCase().trim().replace(/[^a-z0-9/]+/g, '-').replace(/^-+|-+$/g, '') },
            validation: r =>
                r.required().custom(slug =>
                    /^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(slug?.current ?? '') ? true : 'Lowercase letters, numbers and dashes, with "/" between segments.',
                ),
        }),
        defineField({
            name: 'description',
            type: 'text',
            rows: 2,
            group: 'content',
            description: 'One sentence shown under the title, in search and as the default meta description.',
        }),
        defineField({
            name: 'body',
            type: 'markdown',
            group: 'content',
            description: 'Markdown with the docs blocks (endpoint, diagram, chart, mermaid, codegroup, cards, screenshot, callouts). Leave empty for a planned page.',
        }),
        defineField({
            name: 'status',
            type: 'string',
            group: 'meta',
            options: { list: ['ready', 'draft', 'planned'], layout: 'radio', direction: 'horizontal' },
            initialValue: 'draft',
            validation: r => r.required(),
        }),
        defineField({ name: 'navTitle', title: 'Sidebar label', type: 'string', group: 'meta', description: 'Defaults to the title.' }),
        defineField({ name: 'badge', type: 'string', group: 'meta', options: { list: ['new', 'beta', 'soon'] } }),
        defineField({ name: 'method', title: 'HTTP method', type: 'string', group: 'meta', description: 'API pages show this as a pill in the sidebar.', options: { list: ['GET', 'POST', 'WS'] } }),
        defineField({ name: 'updated', title: 'Last reviewed', type: 'date', group: 'meta' }),
        defineField({
            name: 'sources',
            type: 'array',
            group: 'meta',
            description: 'Code files and spec documents this page was written from.',
            of: [defineArrayMember({ type: 'string' })],
        }),
        defineField({
            name: 'tags',
            type: 'array',
            group: 'meta',
            of: [defineArrayMember({ type: 'reference', to: [{ type: 'tag' }] })],
            validation: r => r.unique(),
        }),
        defineField({ name: 'seo', type: 'seo', group: 'seo' }),
    ],
    preview: {
        select: { title: 'title', slug: 'slug.current', status: 'status' },
        prepare: ({ title, slug, status }) => ({ title, subtitle: `${status ?? 'draft'} · /docs/${slug ?? ''}` }),
    },
});

/** A sidebar group. Groups nest, so `items` holds pages and further groups. */
export const navGroup = defineType({
    name: 'navGroup',
    title: 'Sidebar group',
    type: 'object',
    fields: [
        defineField({ name: 'title', type: 'string', validation: r => r.required() }),
        defineField({ name: 'collapsed', title: 'Start collapsed', type: 'boolean', initialValue: false }),
        defineField({
            name: 'items',
            type: 'array',
            of: [
                defineArrayMember({ type: 'reference', title: 'Page', to: [{ type: 'docsPage' }] }),
                defineArrayMember({ type: 'navGroup', title: 'Nested group' }),
            ],
        }),
    ],
    preview: {
        select: { title: 'title', items: 'items' },
        prepare: ({ title, items }) => ({ title, subtitle: `${items?.length ?? 0} items` }),
    },
});

export const docsSection = defineType({
    name: 'docsSection',
    title: 'Docs section',
    type: 'document',
    fields: [
        defineField({ name: 'title', type: 'string', description: 'Header tab label.', validation: r => r.required() }),
        defineField({
            name: 'slug',
            title: 'ID',
            type: 'slug',
            description: 'Short id, also the first path segment of the pages in it: /docs/<id>/…',
            options: { source: 'title', maxLength: 32 },
            validation: r => r.required(),
        }),
        defineField({ name: 'tagline', type: 'string' }),
        defineField({ name: 'icon', type: 'string', options: { list: SECTION_ICONS }, initialValue: 'book-open' }),
        defineField({ name: 'order', type: 'number', description: 'Position in the header tabs. Lower numbers come first.', initialValue: 100 }),
        defineField({ name: 'groups', title: 'Sidebar', type: 'array', of: [defineArrayMember({ type: 'navGroup' })] }),
    ],
    orderings: [{ title: 'Display order', name: 'order', by: [{ field: 'order', direction: 'asc' }] }],
    preview: { select: { title: 'title', subtitle: 'tagline' } },
});
