// Parsing of bundled knowledge base articles. Pure, so studio/scripts/import.ts can use it too.

export const tagSlug = (title: string) =>
    title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Frontmatter fields of a bundled article, before tags and dates are normalised. */
export interface LocalArticle {
    id: string;
    categoryId: string;
    title: string;
    summary: string;
    date: string;
    author: string;
    readTime: string;
    tags: string[];
    content: string;
}

// Helper to parse simple Frontmatter
export function parseArticle(fileContent: string): LocalArticle {
    // Normalize line endings (Windows CRLF -> LF)
    const normalizedContent = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = normalizedContent.match(frontmatterRegex);

    if (!match) {
        throw new Error('Invalid Markdown file format: Missing Frontmatter');
    }

    const [, frontmatterBlock, content] = match;
    const metadata: Record<string, unknown> = { tags: [] };

    frontmatterBlock.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
            const value = valueParts.join(':').trim();
            // Handle array for tags
            if (key.trim() === 'tags') {
                metadata.tags = value.replace(/[\[\]]/g, '').split(',').map(t => t.trim().replace(/^"|"$/g, '')).filter(Boolean);
            } else {
                // Remove quotes if present
                metadata[key.trim()] = value.replace(/^"|"$/g, '');
            }
        }
    });

    return { ...metadata, content: content.trim() } as unknown as LocalArticle;
}
