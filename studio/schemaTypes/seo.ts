import { defineField, defineType } from 'sanity';

/** Per-document search and social overrides. Every field is optional: the site
 *  falls back to the document's own title, summary and cover, then to site settings. */
export const seo = defineType({
    name: 'seo',
    title: 'SEO',
    type: 'object',
    options: { collapsible: true, collapsed: true },
    fields: [
        defineField({
            name: 'metaTitle',
            title: 'Meta title',
            type: 'string',
            description: 'Overrides the page title in search results and browser tabs.',
            validation: r => r.max(60).warning('Titles over 60 characters are usually truncated in search results.'),
        }),
        defineField({
            name: 'metaDescription',
            title: 'Meta description',
            type: 'text',
            rows: 3,
            validation: r => r.max(160).warning('Descriptions over 160 characters are usually truncated.'),
        }),
        defineField({
            name: 'ogImage',
            title: 'Social share image',
            type: 'image',
            description: 'Shown when the page is shared. 1200 × 630 works everywhere.',
            options: { hotspot: true },
        }),
        defineField({
            name: 'canonical',
            title: 'Canonical URL',
            type: 'url',
            description: 'Only set this when the page duplicates content that lives at another URL.',
        }),
        defineField({
            name: 'noindex',
            title: 'Hide from search engines',
            type: 'boolean',
            initialValue: false,
        }),
    ],
});
