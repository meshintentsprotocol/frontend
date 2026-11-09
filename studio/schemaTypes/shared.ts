import { defineArrayMember, defineField, defineType } from 'sanity';

export const tag = defineType({
    name: 'tag',
    title: 'Tag',
    type: 'document',
    fields: [
        defineField({ name: 'title', type: 'string', validation: r => r.required() }),
        defineField({ name: 'slug', type: 'slug', options: { source: 'title', maxLength: 64 }, validation: r => r.required() }),
        defineField({
            name: 'description',
            type: 'text',
            rows: 3,
            description: 'Shown at the top of the tag page and used as its meta description.',
        }),
        defineField({ name: 'seo', type: 'seo' }),
    ],
    preview: { select: { title: 'title', subtitle: 'slug.current' } },
});

export const author = defineType({
    name: 'author',
    title: 'Author',
    type: 'document',
    fields: [
        defineField({ name: 'name', type: 'string', validation: r => r.required() }),
        defineField({ name: 'slug', type: 'slug', options: { source: 'name', maxLength: 64 }, validation: r => r.required() }),
        defineField({ name: 'bio', type: 'text', rows: 3 }),
        defineField({ name: 'avatar', type: 'image', options: { hotspot: true } }),
        defineField({
            name: 'links',
            type: 'array',
            description: 'Profile URLs (X, GitHub, website). Used in structured data.',
            of: [defineArrayMember({ type: 'url' })],
        }),
    ],
    preview: { select: { title: 'name', media: 'avatar' } },
});

export const siteSettings = defineType({
    name: 'siteSettings',
    title: 'Site settings',
    type: 'document',
    fields: [
        defineField({ name: 'siteName', type: 'string', validation: r => r.required() }),
        defineField({
            name: 'description',
            title: 'Default description',
            type: 'text',
            rows: 3,
            validation: r => r.max(160).warning('Descriptions over 160 characters are usually truncated.'),
        }),
        defineField({
            name: 'ogImage',
            title: 'Default social share image',
            type: 'image',
            description: 'Used when a page has no cover or share image. 1200 × 630.',
        }),
        defineField({ name: 'twitterHandle', title: 'X handle', type: 'string', description: 'Including the @.' }),
        defineField({
            name: 'sameAs',
            title: 'Official profiles',
            type: 'array',
            description: 'Social and code-hosting profile URLs, listed in the Organization structured data.',
            of: [defineArrayMember({ type: 'url' })],
        }),
    ],
    preview: { prepare: () => ({ title: 'Site settings' }) },
});

export const subscriber = defineType({
    name: 'subscriber',
    title: 'Newsletter Subscriber',
    type: 'document',
    fields: [
        defineField({
            name: 'email',
            title: 'Email',
            type: 'string',
            validation: r => r.required().email('Must be a valid email address'),
        }),
        defineField({
            name: 'subscribedAt',
            title: 'Subscribed At',
            type: 'datetime',
            readOnly: true,
            initialValue: () => new Date().toISOString(),
        }),
        defineField({
            name: 'source',
            title: 'Source',
            type: 'string',
            description: 'Where the user subscribed from.',
            options: {
                list: [
                    { title: 'KB Homepage', value: 'kb-page' },
                    { title: 'Article Page', value: 'article-page' },
                    { title: 'Other', value: 'other' },
                ],
            },
            initialValue: 'other',
        }),
    ],
    preview: {
        select: { title: 'email', subtitle: 'source', date: 'subscribedAt' },
        prepare: ({ title, subtitle, date }) => ({
            title: title || 'Unknown email',
            subtitle: `${subtitle || 'unknown'} · ${date ? new Date(date).toLocaleDateString() : ''}`,
        }),
    },
    orderings: [
        {
            title: 'Newest first',
            name: 'newestFirst',
            by: [{ field: 'subscribedAt', direction: 'desc' }],
        },
    ],
});
