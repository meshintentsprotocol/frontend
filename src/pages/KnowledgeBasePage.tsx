import { KBHeader } from '../components/knowledge-base/KBHeader';
import { KBCategoryList } from '../components/knowledge-base/KBCategoryList';
import { KBArticleList } from '../components/knowledge-base/KBArticleList';
import { kbService } from '../components/knowledge-base/kbService';
import { Footer } from '@/components/common/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    ArrowUpRight,
    Mail,
    Sparkles,
    Flame,
    Compass,
    Github,
    MessagesSquare,
    FileCode2,
    Activity,
    Clock,
    User,
    ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const QUICK_RESOURCES = [
    {
        title: 'Developer Docs',
        description: 'API reference, SDK, and contract specs',
        icon: FileCode2,
        href: '#',
        tone: 'primary' as const,
    },
    {
        title: 'GitHub',
        description: 'Open-source repos and audited contracts',
        icon: Github,
        href: '#',
        tone: 'foreground' as const,
    },
    {
        title: 'Community',
        description: 'Join solvers and traders on Discord',
        icon: MessagesSquare,
        href: '#',
        tone: 'purple' as const,
    },
    {
        title: 'Protocol Status',
        description: 'Live solver, relayer, and chain status',
        icon: Activity,
        href: '#',
        tone: 'emerald' as const,
    },
];

const toneIcon: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    foreground: 'bg-zinc-200/70 dark:bg-zinc-800/70 text-foreground',
    purple: 'bg-purple-500/10 text-purple-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
};

export function KnowledgeBasePage() {
    const allArticles = kbService.getAllArticles();
    const featured = allArticles[0];

    return (
        <main className="flex-1 relative overflow-x-hidden bg-background">
            {/* Hero & Search */}
            <KBHeader />

            {/* Featured Article Showcase */}
            {featured && (
                <section className="container mx-auto px-4 -mt-24 relative z-20 max-w-7xl">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.45 }}
                    >
                        <Link to={`/kb/${featured.categoryId}/${featured.id}`} className="block group">
                            <div className={cn('bento-card grainy p-0 overflow-hidden relative')}>
                                {/* Ambient glow */}
                                <div className="absolute -top-24 -right-24 w-[420px] h-[420px] bg-primary/15 blur-[120px] rounded-full pointer-events-none" />
                                <div className="absolute -bottom-24 -left-24 w-[360px] h-[360px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />

                                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-0">
                                    {/* Copy */}
                                    <div className="relative z-10 p-8 md:p-12 flex flex-col justify-center">
                                        <div className="flex items-center gap-2 mb-5">
                                            <span className="tag-primary">
                                                <Flame className="w-3 h-3" />
                                                Featured
                                            </span>
                                            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                                Editor's pick
                                            </span>
                                        </div>

                                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.05] mb-4 group-hover:text-primary transition-colors">
                                            {featured.title}
                                        </h2>

                                        <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-6 line-clamp-3">
                                            {featured.summary}
                                        </p>

                                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-8">
                                            <div className="flex items-center gap-1.5">
                                                <User className="w-3.5 h-3.5" />
                                                <span>{featured.author}</span>
                                            </div>
                                            <span className="opacity-30">·</span>
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span>{featured.readTime}</span>
                                            </div>
                                            {featured.tags?.slice(0, 2).map((t) => (
                                                <Badge
                                                    key={t}
                                                    variant="secondary"
                                                    className="text-[10px] uppercase tracking-wider font-medium bg-zinc-100 dark:bg-zinc-800 text-muted-foreground border-0"
                                                >
                                                    {t}
                                                </Badge>
                                            ))}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Button
                                                size="lg"
                                                className="rounded-full px-6 h-12 font-semibold shadow-lg shadow-primary/25"
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

                                    {/* Image */}
                                    <div className="relative aspect-[16/11] lg:aspect-auto lg:min-h-[420px] overflow-hidden border-t lg:border-t-0 lg:border-l border-border/50">
                                        <img
                                            src="/images/kb/sample_article.png"
                                            alt={featured.title}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-tr from-background/80 via-background/10 to-transparent lg:bg-gradient-to-r" />
                                        <div className="absolute top-5 right-5 w-11 h-11 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                                            <ArrowUpRight className="w-5 h-5 text-white" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                </section>
            )}

            {/* Categories Section */}
            <section className="container mx-auto px-4 max-w-7xl pt-20">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10"
                >
                    <div className="space-y-2">
                        <span className="tag-primary">
                            <Compass className="w-3 h-3" />
                            Explore
                        </span>
                        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                            Browse by category
                        </h2>
                        <p className="text-muted-foreground max-w-md">
                            Pick a topic to dive in. Each track is curated for a specific role on the protocol.
                        </p>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className={cn('bento-card p-6 md:p-8 grainy')}
                >
                    <KBCategoryList />
                </motion.div>
            </section>

            {/* Quick Resources */}
            <section className="container mx-auto px-4 max-w-7xl pt-20">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10"
                >
                    <div className="space-y-2">
                        <span className="tag-primary">
                            <Sparkles className="w-3 h-3" />
                            Builder resources
                        </span>
                        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                            Plug into the protocol
                        </h2>
                        <p className="text-muted-foreground max-w-md">
                            Everything you need to ship — from source code to live operational status.
                        </p>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    {QUICK_RESOURCES.map((r, i) => {
                        const Icon = r.icon;
                        return (
                            <motion.a
                                key={r.title}
                                href={r.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.06 }}
                                className="group block"
                            >
                                <div className={cn('bento-card-interactive grainy h-full p-6 flex flex-col')}>
                                    <div className="flex items-start justify-between mb-6">
                                        <div
                                            className={cn(
                                                'w-11 h-11 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300',
                                                toneIcon[r.tone]
                                            )}
                                        >
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0 transition-all" />
                                    </div>
                                    <h3 className="text-base font-semibold mb-1 group-hover:text-primary transition-colors">
                                        {r.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {r.description}
                                    </p>
                                </div>
                            </motion.a>
                        );
                    })}
                </div>
            </section>

            {/* Recent Articles Section */}
            <section className="container mx-auto px-4 py-24 max-w-7xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12"
                >
                    <div className="space-y-2">
                        <span className="tag-primary">
                            <Sparkles className="w-3 h-3" />
                            Latest Updates
                        </span>
                        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                            Fresh from the protocol
                        </h2>
                        <p className="text-muted-foreground max-w-md">
                            New guides, deep-dives, and release notes — written by the core team.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        className="rounded-full px-6 group self-start md:self-auto"
                    >
                        View all articles
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </motion.div>

                <KBArticleList limit={6} />
            </section>

            {/* Newsletter CTA Section */}
            <section className="container mx-auto px-4 pb-24">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="max-w-5xl mx-auto"
                >
                    <div className={cn('bento-card relative overflow-hidden p-10 md:p-16 grainy')}>
                        {/* Gradient Mesh Background */}
                        <div className="absolute inset-0 mesh-gradient-primary opacity-60" />

                        {/* Glow Effects */}
                        <div className="absolute -top-20 -left-20 w-[500px] h-[300px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
                        <div className="absolute -bottom-20 -right-20 w-[420px] h-[260px] bg-emerald-500/15 blur-[100px] rounded-full pointer-events-none" />

                        <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-10">
                            <div>
                                <div className="icon-box-primary w-12 h-12 mb-6">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <h3 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">
                                    The Intent Dispatch
                                </h3>
                                <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-xl leading-relaxed">
                                    Weekly protocol updates, solver telemetry, and BCH cross-chain alpha — straight to your inbox.
                                </p>

                                <div className="flex flex-col sm:flex-row max-w-lg gap-3">
                                    <div className="relative flex-1">
                                        <input
                                            type="email"
                                            placeholder="you@protocol.dev"
                                            className={cn(
                                                'w-full h-14 px-5 rounded-2xl',
                                                'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl',
                                                'border border-white/30 dark:border-white/10',
                                                'text-foreground placeholder:text-muted-foreground',
                                                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',
                                                'transition-all duration-200'
                                            )}
                                        />
                                    </div>
                                    <Button
                                        size="lg"
                                        className={cn(
                                            'h-14 px-7 rounded-2xl font-semibold',
                                            'shadow-lg shadow-primary/25'
                                        )}
                                    >
                                        Subscribe
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>

                                <div className="flex items-center gap-2 mt-5 text-xs text-muted-foreground">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                    No spam. Unsubscribe in one click.
                                </div>
                            </div>

                            {/* Trust indicators */}
                            <div className="hidden md:flex flex-col items-end gap-4 pl-8 border-l border-border/50">
                                <div className="text-right">
                                    <div className="text-3xl font-bold tracking-tight tabular-nums">12k+</div>
                                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mt-1">
                                        Subscribers
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-bold tracking-tight tabular-nums">Weekly</div>
                                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mt-1">
                                        Cadence
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
