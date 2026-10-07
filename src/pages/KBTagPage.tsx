import { useParams, Link } from 'react-router-dom';
import { ChevronRight, FileText, Hash, Home } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { KBArticleList } from '../components/knowledge-base/KBArticleList';
import { KBStatus } from '../components/knowledge-base/KBStatus';
import { useKb } from '../components/knowledge-base/kbService';
import { Footer } from '@/components/common/Footer';
import { CMS_STALE_TIME, cmsQuery, sanityConfig } from '@/lib/sanity';
import { kbTagSeo } from '@/shared/seo';
import { useSeo } from '@/lib/useSeo';

interface TaggedDoc {
    slug: string;
    title: string;
    description?: string;
}

const DOCS_BY_TAG = `*[_type == "docsPage" && status != "planned" && $tag in tags[]->slug.current] | order(title asc){"slug": slug.current, title, description}`;

/** Developer docs pages carrying the tag. Docs tags only exist in Sanity. */
function useTaggedDocs(tag: string | undefined): TaggedDoc[] {
    const { data } = useQuery({
        queryKey: ['cms', 'docs-by-tag', tag],
        queryFn: () => cmsQuery<TaggedDoc[]>(DOCS_BY_TAG, { tag }),
        enabled: !!tag && !!sanityConfig,
        staleTime: CMS_STALE_TIME,
    });
    return data ?? [];
}

export function KBTagPage() {
    const { tagSlug } = useParams();
    const kbService = useKb();
    const tag = tagSlug ? kbService.getTag(tagSlug) : undefined;
    const articles = tagSlug ? kbService.getArticlesByTag(tagSlug) : [];
    const docs = useTaggedDocs(tag?.slug);

    useSeo(tag ? kbTagSeo(tag, articles.length + docs.length, kbService.site) : null);

    if (kbService.loading || kbService.failed) return <KBStatus kb={kbService} />;

    if (!tag) {
        return <div className="p-20 text-center">Tag not found</div>;
    }

    return (
        <div className="min-h-screen bg-background pb-20 relative overflow-x-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-full h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="pt-32 pb-12 px-4 relative z-10">
                <div className="container mx-auto max-w-6xl">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
                        <Link to="/home" className="hover:text-primary transition-colors"><Home className="h-4 w-4" /></Link>
                        <ChevronRight className="h-4 w-4 opacity-50" />
                        <Link to="/kb" className="hover:text-primary transition-colors">Knowledge Base</Link>
                        <ChevronRight className="h-4 w-4 opacity-50" />
                        <span className="text-foreground font-medium capitalize">{tag.title}</span>
                    </div>

                    <div className="flex items-start gap-6 mb-12">
                        <div className="w-20 h-20 shrink-0 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-primary shadow-2xl backdrop-blur-sm">
                            <Hash className="h-9 w-9" />
                        </div>
                        <div className="space-y-4">
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight capitalize">{tag.title}</h1>
                            <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
                                {tag.description || `Articles and guides about ${tag.title}.`}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto max-w-6xl px-4 relative z-20">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/40">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        {articles.length} {articles.length === 1 ? 'Article' : 'Articles'}
                    </h2>
                </div>

                <div className="min-h-[300px]">
                    <KBArticleList articles={articles} />
                </div>

                {docs.length > 0 && (
                    <div className="pt-16">
                        <h2 className="text-xl font-bold flex items-center gap-2 mb-6 pb-4 border-b border-border/40">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            In the developer docs
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            {docs.map(d => (
                                <Link key={d.slug} to={`/docs/${d.slug}`} className="group flex items-start gap-4 rounded-2xl border border-border/50 bg-card/50 p-5 transition-colors hover:border-primary/40">
                                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
                                    <div className="min-w-0">
                                        <p className="font-semibold group-hover:text-primary transition-colors">{d.title}</p>
                                        {d.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{d.description}</p>}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Other tags */}
                <div className="pt-16">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Browse other topics</h2>
                    <div className="flex flex-wrap gap-2">
                        {kbService.getTags().filter(t => t.slug !== tag.slug).map(t => (
                            <Link key={t.slug} to={`/kb/tag/${t.slug}`} className="rounded-full border border-border/50 bg-secondary/40 px-3 py-1 text-xs capitalize text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
                                #{t.title}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default KBTagPage;
