import { useState, useMemo } from 'react';
import { KBHeader } from '../components/knowledge-base/KBHeader';
import { KBArticleList } from '../components/knowledge-base/KBArticleList';
import { useKb, KB_FALLBACK_COVER } from '../components/knowledge-base/kbService';
import { imageUrl } from '@/shared/sanity';
import { kbIndexSeo } from '@/shared/seo';
import { useSeo } from '@/lib/useSeo';
import { Footer } from '@/components/common/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    ArrowUpRight,
    Mail,
    Flame,
    Github,
    MessagesSquare,
    FileCode2,
    Activity,
    Clock,
    User,
    ShieldCheck,
    Layers,
    Calendar,
    ChevronDown,
    SlidersHorizontal,
    CheckCircle2,
    Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { KBCategoryCard } from '../components/knowledge-base/KBCategoryCard';
import { useSubscribe } from '@/lib/useSubscribe';

const QUICK_RESOURCES = [
    {
        title: 'Developer Docs',
        description: 'API, SDK & contract specs',
        icon: FileCode2,
        href: '/docs',
        badge: 'v4.2',
        tone: 'primary' as const,
    },
    {
        title: 'GitHub',
        description: 'Open-source contracts',
        icon: Github,
        href: 'https://github.com',
        badge: 'Audited',
        tone: 'foreground' as const,
    },
    {
        title: 'Community',
        description: 'Solvers & LP traders',
        icon: MessagesSquare,
        href: 'https://discord.gg',
        badge: 'Discord',
        tone: 'purple' as const,
    },
    {
        title: 'Protocol Status',
        description: 'Live solver & chain telemetry',
        icon: Activity,
        href: '/status',
        badge: '99.98%',
        tone: 'emerald' as const,
    },
];

const toneIcon: Record<string, string> = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    foreground: 'bg-zinc-200/70 dark:bg-zinc-800/70 text-foreground border-zinc-300 dark:border-zinc-700',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

export function KnowledgeBasePage() {
    const kbService = useKb();
    const allArticles = kbService.getAllArticles();
    const categories = kbService.getCategories();
    const featured = allArticles.find(a => a.featured) ?? allArticles[0];
    useSeo(kbIndexSeo(kbService.site));

    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [showCategoryGrid, setShowCategoryGrid] = useState<boolean>(false);
    const [newsletterEmail, setNewsletterEmail] = useState('');
    const { status: subStatus, message: subMessage, subscribe: handleSubscribe } = useSubscribe();

    const onNewsletterSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSubscribe(newsletterEmail, 'kb-page');
    };

    // Compute category counts
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { all: allArticles.length };
        for (const a of allArticles) {
            counts[a.categoryId] = (counts[a.categoryId] || 0) + 1;
        }
        return counts;
    }, [allArticles]);

    return (
        <main className="flex-1 relative overflow-x-hidden bg-background">
            {/* Hero & Search Header */}
            <KBHeader />

            {/* Featured Article Hero Card */}
            {featured && (
                <section className="container mx-auto px-4 -mt-28 md:-mt-32 relative z-20 max-w-7xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.35 }}
                    >
                        <Link to={`/kb/${featured.categoryId}/${featured.id}`} className="block group">
                            <div className={cn(
                                'relative overflow-hidden rounded-xl md:rounded-2xl p-0',
                                'bg-card dark:bg-zinc-900/90 backdrop-blur-xl',
                                'border border-zinc-200/80 dark:border-zinc-800/90',
                                'hover:border-primary/50 dark:hover:border-primary/50',
                                'hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300'
                            )}>
                                {/* Ambient Glow */}
                                <div className="absolute -top-24 -right-24 w-[380px] h-[380px] bg-primary/15 blur-[100px] rounded-full pointer-events-none" />
                                <div className="absolute -bottom-24 -left-24 w-[320px] h-[320px] bg-emerald-500/10 blur-[90px] rounded-full pointer-events-none" />

                                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-0">
                                    {/* Copy */}
                                    <div className="relative z-10 p-6 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center">
                                        <div className="flex items-center gap-2.5 mb-4">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold tracking-wide uppercase bg-primary/10 text-primary border border-primary/20">
                                                <Flame className="w-3.5 h-3.5 text-primary" />
                                                Featured Article
                                            </span>
                                            <span className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
                                                Editor's Pick
                                            </span>
                                        </div>

                                        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1] mb-4 group-hover:text-primary transition-colors">
                                            {featured.title}
                                        </h2>

                                        <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed mb-6 line-clamp-3">
                                            {featured.summary}
                                        </p>

                                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-muted-foreground mb-8">
                                            <div className="flex items-center gap-1.5 font-medium text-foreground">
                                                <User className="w-3.5 h-3.5 text-primary" />
                                                <span>{featured.author}</span>
                                            </div>
                                            <span className="opacity-30">·</span>
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span>{featured.readTime}</span>
                                            </div>
                                            {featured.date && (
                                                <>
                                                    <span className="opacity-30">·</span>
                                                    <div className="flex items-center gap-1.5 font-mono">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        <span>{featured.date}</span>
                                                    </div>
                                                </>
                                            )}
                                            {featured.tags?.slice(0, 2).map((t) => (
                                                <Badge
                                                    key={t.slug}
                                                    variant="secondary"
                                                    className="text-[10px] uppercase font-mono tracking-wider font-medium bg-zinc-100 dark:bg-zinc-800 text-muted-foreground border border-zinc-200/50 dark:border-zinc-700/50"
                                                >
                                                    {t.title}
                                                </Badge>
                                            ))}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Button
                                                size="lg"
                                                className="rounded-xl px-7 h-12 font-semibold shadow-lg shadow-primary/20 group-hover:shadow-primary/30"
                                            >
                                                Read article
                                                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                            </Button>
                                            <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
                                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                                Verified by core contributors
                                            </div>
                                        </div>
                                    </div>

                                    {/* Cover Media */}
                                    <div className="relative aspect-[16/10] lg:aspect-auto lg:min-h-[440px] overflow-hidden border-t lg:border-t-0 lg:border-l border-border/60 bg-zinc-950/70">
                                        <img
                                            src={imageUrl(featured.cover, { w: 1200, h: 750 }) ?? KB_FALLBACK_COVER}
                                            alt={featured.coverAlt || featured.title}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-tr from-background/70 via-background/10 to-transparent lg:bg-gradient-to-r" />
                                        <div className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 text-white shadow-lg">
                                            <ArrowUpRight className="w-5 h-5" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                </section>
            )}

            {/* Quick Builder Dock (Space-efficient 1-row quick bar) */}
            <section className="container mx-auto px-4 max-w-7xl pt-10">
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {QUICK_RESOURCES.map((r, i) => {
                        const Icon = r.icon;
                        return (
                            <motion.a
                                key={r.title}
                                href={r.href}
                                target={r.href.startsWith('http') ? '_blank' : undefined}
                                rel={r.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                                initial={{ opacity: 0, y: 12 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="group block"
                            >
                                <div className={cn(
                                    'h-full p-4 rounded-xl flex items-center gap-3.5',
                                    'bg-card/70 dark:bg-zinc-900/70 backdrop-blur-sm',
                                    'border border-zinc-200/80 dark:border-zinc-800/80',
                                    'hover:border-primary/50 dark:hover:border-primary/50',
                                    'hover:shadow-md transition-all duration-200'
                                )}>
                                    <div className={cn(
                                        'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border',
                                        toneIcon[r.tone]
                                    )}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-semibold group-hover:text-primary transition-colors truncate">
                                                {r.title}
                                            </h4>
                                            {r.badge && (
                                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                                                    {r.badge}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {r.description}
                                        </p>
                                    </div>
                                    <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                                </div>
                            </motion.a>
                        );
                    })}
                </div>
            </section>

            {/* Main Articles Hub & Interactive Category Filters */}
            <section className="container mx-auto px-4 max-w-7xl pt-16 pb-24">
                {/* Hub Header & Category Pill Filter Bar */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pb-6 border-b border-border/60">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <Layers className="w-3 h-3" />
                                Protocol Knowledge
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                                {allArticles.length} guides published
                            </span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                            Articles & Technical Documentation
                        </h2>
                        <p className="text-sm text-muted-foreground max-w-xl">
                            Field-tested guides for liquidity providers, cross-chain solvers, and developers building on Bitcoin Cash.
                        </p>
                    </div>

                    {/* Toggle Category Overview Cards */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCategoryGrid(prev => !prev)}
                        className="rounded-lg h-9 px-3.5 text-xs font-medium self-start md:self-auto border-border/80 hover:border-primary/50"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-primary" />
                        {showCategoryGrid ? 'Hide Track Cards' : 'Browse All Tracks'}
                        <ChevronDown className={cn('w-3.5 h-3.5 ml-1.5 transition-transform duration-200', showCategoryGrid && 'rotate-180')} />
                    </Button>
                </div>

                {/* Collapsible Category Matrix */}
                <AnimatePresence>
                    {showCategoryGrid && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden mb-10"
                        >
                            <div className="p-4 md:p-6 rounded-xl bg-muted/30 border border-border/60 mb-8">
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 font-mono">
                                    Curated Learning Tracks
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                    {categories.map((cat, i) => (
                                        <KBCategoryCard
                                            key={cat.id}
                                            {...cat}
                                            index={i}
                                            compact={true}
                                        />
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Interactive Horizontal Category Filter Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none no-scrollbar">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={cn(
                            'px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 border',
                            selectedCategory === 'all'
                                ? 'bg-primary text-primary-foreground border-primary shadow-sm font-semibold'
                                : 'bg-card/70 dark:bg-zinc-900/70 text-muted-foreground border-border/70 hover:border-border hover:text-foreground'
                        )}
                    >
                        All Articles ({categoryCounts.all || allArticles.length})
                    </button>

                    {categories.map(c => {
                        const count = categoryCounts[c.id] || 0;
                        const isSelected = selectedCategory === c.id;
                        return (
                            <button
                                key={c.id}
                                onClick={() => setSelectedCategory(c.id)}
                                className={cn(
                                    'px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 border flex items-center gap-1.5',
                                    isSelected
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm font-semibold'
                                        : 'bg-card/70 dark:bg-zinc-900/70 text-muted-foreground border-border/70 hover:border-border hover:text-foreground'
                                )}
                            >
                                <span>{c.title}</span>
                                <span className={cn(
                                    'text-[10px] font-mono px-1.5 py-0.2 rounded',
                                    isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                                )}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Dynamic Article Grid with Load More */}
                <KBArticleList
                    categoryId={selectedCategory}
                    initialLimit={6}
                    step={6}
                    showLoadMore={true}
                />
            </section>

            {/* Newsletter CTA Section */}
            <section className="container mx-auto px-4 pb-20">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="max-w-5xl mx-auto"
                >
                    <div className={cn(
                        'relative overflow-hidden p-8 sm:p-10 md:p-12 rounded-2xl',
                        'bg-card dark:bg-zinc-900/90 backdrop-blur-xl',
                        'border border-zinc-200/80 dark:border-zinc-800/80'
                    )}>
                        <div className="absolute inset-0 mesh-gradient-primary opacity-50" />
                        <div className="absolute -top-20 -left-20 w-[420px] h-[260px] bg-primary/20 blur-[100px] rounded-full pointer-events-none" />

                        <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-8">
                            <div>
                                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 border border-primary/20">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <h3 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight">
                                    The Intent Dispatch
                                </h3>
                                <p className="text-sm md:text-base text-muted-foreground mb-6 max-w-xl leading-relaxed">
                                    Weekly protocol updates, solver telemetry, and Bitcoin Cash liquidity alpha — straight to your inbox.
                                </p>

                                <form onSubmit={onNewsletterSubmit} className="flex flex-col sm:flex-row max-w-lg gap-2.5">
                                    <div className="relative flex-1">
                                        <input
                                            type="email"
                                            value={newsletterEmail}
                                            onChange={(e) => setNewsletterEmail(e.target.value)}
                                            placeholder="you@protocol.dev"
                                            disabled={subStatus === 'loading' || subStatus === 'success'}
                                            className={cn(
                                                'w-full h-12 px-4 rounded-xl',
                                                'bg-background/90 backdrop-blur-md',
                                                'border border-border/80',
                                                'text-foreground placeholder:text-muted-foreground text-sm',
                                                'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                                                'transition-all duration-200 disabled:opacity-60'
                                            )}
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        size="lg"
                                        disabled={subStatus === 'loading' || subStatus === 'success'}
                                        className="h-12 px-6 rounded-xl font-semibold shadow-md shadow-primary/25 disabled:opacity-60"
                                    >
                                        {subStatus === 'loading' ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Joining…
                                            </>
                                        ) : subStatus === 'success' ? (
                                            <>
                                                <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-300" />
                                                Subscribed
                                            </>
                                        ) : (
                                            <>
                                                Subscribe
                                                <ArrowRight className="w-4 h-4 ml-1.5" />
                                            </>
                                        )}
                                    </Button>
                                </form>

                                {subMessage && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={cn(
                                            'mt-3 text-xs font-medium flex items-center gap-1.5',
                                            subStatus === 'success' ? 'text-emerald-500' :
                                            subStatus === 'duplicate' ? 'text-amber-500' : 'text-red-500'
                                        )}
                                    >
                                        {subStatus === 'success' && <CheckCircle2 className="w-3.5 h-3.5" />}
                                        {subMessage}
                                    </motion.div>
                                )}

                                <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                    No spam. Unsubscribe in one click.
                                </div>
                            </div>

                            {/* Metrics */}
                            <div className="hidden md:flex flex-col items-end gap-4 pl-8 border-l border-border/60">
                                <div className="text-right">
                                    <div className="text-3xl font-bold tracking-tight tabular-nums">14+</div>
                                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-mono mt-0.5">
                                        Guides Live
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-bold tracking-tight tabular-nums">Weekly</div>
                                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-mono mt-0.5">
                                        Dispatch
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </section>

            <Footer />
        </main>
    );
}

export default KnowledgeBasePage;
