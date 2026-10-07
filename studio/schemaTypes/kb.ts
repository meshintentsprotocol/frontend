import { defineArrayMember, defineField, defineType } from 'sanity';

/** Keys of `iconMap` in frontend/src/components/knowledge-base/KBCategoryCard.tsx. */
const CATEGORY_ICONS = ['book-open', 'file-text', 'git-commit', 'alert-circle', 'lightbulb', 'newspaper', 'layers', 'code', 'globe', 'zap'];

export const kbCategory = defineType({
    name: 'kbCategory',
    title: 'KB category',
    type: 'document',
    fields: [
        defineField({ name: 'title', type: 'string', validation: r => r.required() }),
        defineField({
            name: 'slug',
            type: 'slug',
            description: 'URL segment: /kb/<slug>',
            options: { source: 'title', maxLength: 64 },
            validation: r => r.required(),
        }),
        defineField({ name: 'description', type: 'text', rows: 2 }),
        defineField({ name: 'icon', type: 'string', options: { list: CATEGORY_ICONS }, initialValue: 'book-open' }),
        defineField({ name: 'order', type: 'number', description: 'Lower numbers are listed first.', initialValue: 100 }),
        defineField({ name: 'seo', type: 'seo' }),
    ],
    orderings: [{ title: 'Display order', name: 'order', by: [{ field: 'order', direction: 'asc' }] }],
    preview: { select: { title: 'title', subtitle: 'slug.current' } },
});

export const kbArticle = defineType({
    name: 'kbArticle',
    title: 'KB article',
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
            description: 'URL segment: /kb/<category>/<slug>. Changing it breaks existing links.',
            options: { source: 'title', maxLength: 96 },
            validation: r => r.required(),
        }),
        defineField({
            name: 'summary',
            type: 'text',
            rows: 3,
            group: 'content',
            description: 'Shown on cards, in the "Key takeaways" box and as the default meta description.',
            validation: r => r.required().max(240),
        }),
        defineField({ name: 'body', type: 'markdown', group: 'content', validation: r => r.required() }),
        defineField({
            name: 'coverImage',
            type: 'image',
            group: 'content',
            options: { hotspot: true },
            fields: [defineField({ name: 'alt', title: 'Alt text', type: 'string' })],
        }),
        defineField({ name: 'category', type: 'reference', to: [{ type: 'kbCategory' }], group: 'meta', validation: r => r.required() }),
        defineField({
            name: 'tags',
            type: 'array',
            group: 'meta',
            of: [defineArrayMember({ type: 'reference', to: [{ type: 'tag' }] })],
            validation: r => r.unique(),
        }),
        defineField({ name: 'author', type: 'reference', to: [{ type: 'author' }], group: 'meta' }),
        defineField({ name: 'publishedAt', title: 'Published', type: 'date', group: 'meta', validation: r => r.required() }),
        defineField({ name: 'readTime', title: 'Read time', type: 'string', group: 'meta', description: 'For example "5 min read". Estimated from the body when empty.' }),
        defineField({ name: 'featured', type: 'boolean', group: 'meta', description: 'Shown as the hero article on /kb.', initialValue: false }),
        defineField({ name: 'seo', type: 'seo', group: 'seo' }),
    ],
    orderings: [{ title: 'Newest first', name: 'publishedDesc', by: [{ field: 'publishedAt', direction: 'desc' }] }],
    preview: { select: { title: 'title', subtitle: 'category.title', media: 'coverImage' } },
});
