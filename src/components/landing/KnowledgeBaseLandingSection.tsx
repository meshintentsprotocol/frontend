import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    BookOpen,
    ArrowRight,
    ArrowUpRight,
    Clock,
    User,
    Sparkles,
    Search,
    Layers,
    Globe,
    Code,
    Lightbulb,
    FileText,
    TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { kbService, KBArticle } from '@/components/knowledge-base/kbService';
import { cn } from '@/lib/utils';

const CATEGORY_TABS = [
    { id: 'all', label: 'All Articles', icon: BookOpen },
    { id: 'bchmesh', label: 'BCHMesh & Liquidity', icon: Layers },
    { id: 'cross-chain', label: 'Cross-Chain & Monero', icon: Globe },
    { id: 'developers', label: 'Developers & SDK', icon: Code },
    { id: 'getting-started', label: 'Getting Started', icon: Lightbulb },
];

export function KnowledgeBaseLandingSection() {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const allArticles = kbService.getAllArticles();

    // Featured flagship article
    const featuredArticle = allArticles.find(a => a.id === 'bchmesh-protocol-intro') || allArticles[0];

    // Filtered articles list (excluding featured in the grid, up to 6 cards)
    const filteredArticles = allArticles
        .filter(article => {
            const matchesCategory = selectedCategory === 'all' || article.categoryId === selectedCategory;
            const matchesSearch = !searchQuery || 
                article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                article.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
                article.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesCategory && matchesSearch;
        })
        .filter(article => article.id !== featuredArticle?.id)
        .slice(0, 6);

    return (
        <section className="relative py-24 md:py-32 bg-[#050505] overflow-hidden border-t border-white/5">
            {/* Ambient Background Lights */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="container mx-auto px-4 md:px-6 relative z-10">
                {/* Section Header */}
                <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4 backdrop-blur-md">
                            <Sparkles className="w-3.5 h-3.5" />
                            Knowledge Base & Deep Dives
                        </div>
                        <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                            Master <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">BCHMesh & Intents</span>
                        </h2>
                        <p className="mt-4 text-zinc-400 text-base md:text-lg">
                            Explore comprehensive architectural breakdowns, LP strategy guides, Monero atomic swap mechanics, and developer integration tutorials.
                        </p>
                    </motion.div>

                    {/* Quick Search Bar */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="w-full max-w-xl mt-8 relative"
                    >
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search guides (e.g. '100% shared liquidity', 'Monero swaps', 'rebalancing')..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-zinc-900/80 border border-white/10 rounded-2xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all backdrop-blur-md"
                        />
                    </motion.div>

                    {/* Category Filter Pills */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="flex flex-wrap items-center justify-center gap-2 mt-6"
                    >
                        {CATEGORY_TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = selectedCategory === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setSelectedCategory(tab.id)}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-medium transition-all duration-300",
                                        isActive
                                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/10"
                                            : "bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.07] border border-white/5"
                                    )}
                                >
                                    <Icon className={cn("w-3.5 h-3.5", isActive ? "text-emerald-400" : "text-zinc-500")} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </motion.div>
                </div>

                {/* Featured Hero Article */}
                {featuredArticle && (!searchQuery || featuredArticle.title.toLowerCase().includes(searchQuery.toLowerCase())) && (
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="mb-12"
                    >
                        <Link
                            to={`/kb/${featuredArticle.categoryId}/${featuredArticle.id}`}
                            className="group block relative rounded-3xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 hover:border-emerald-500/40 p-6 md:p-10 transition-all duration-500 overflow-hidden shadow-2xl hover:shadow-emerald-500/10"
                        >
                            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full blur-[100px] pointer-events-none group-hover:scale-110 transition-transform duration-700" />
                            
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
                                <div className="lg:col-span-8 space-y-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 px-3 py-1 text-xs">
                                            🌟 Featured Protocol Blueprint
                                        </Badge>
                                        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                                            <Clock className="w-3.5 h-3.5" />
                                            {featuredArticle.readTime}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                                            <User className="w-3.5 h-3.5" />
                                            {featuredArticle.author}
                                        </span>
                                    </div>

                                    <h3 className="text-2xl md:text-4xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                                        {featuredArticle.title}
                                    </h3>

                                    <p className="text-zinc-400 text-sm md:text-base leading-relaxed line-clamp-3">
                                        {featuredArticle.summary}
                                    </p>

                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {featuredArticle.tags.map((tag, idx) => (
                                            <span
                                                key={idx}
                                                className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/[0.04] text-zinc-400 border border-white/5"
                                            >
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="lg:col-span-4 flex lg:justify-end">
                                    <div className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-500 text-black font-bold text-sm group-hover:bg-emerald-400 transition-all duration-300 shadow-lg shadow-emerald-500/20 group-hover:translate-x-1">
                                        <span>Read Complete Architecture</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                )}

                {/* Articles Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence>
                        {filteredArticles.map((article, idx) => (
                            <motion.div
                                key={article.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.4, delay: idx * 0.05 }}
                            >
                                <Link
                                    to={`/kb/${article.categoryId}/${article.id}`}
                                    className="group flex flex-col h-full rounded-2xl bg-zinc-900/50 border border-white/5 hover:border-emerald-500/30 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/5 relative overflow-hidden"
                                >
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                                            {article.categoryId}
                                        </span>
                                        <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                                            <Clock className="w-3 h-3" />
                                            {article.readTime}
                                        </span>
                                    </div>

                                    <h4 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-2 mb-2">
                                        {article.title}
                                    </h4>

                                    <p className="text-zinc-400 text-xs md:text-sm leading-relaxed line-clamp-3 mb-6 flex-1">
                                        {article.summary}
                                    </p>

                                    <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
                                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                            <User className="w-3 h-3" />
                                            <span>{article.author}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
                                            <span>Read guide</span>
                                            <ArrowUpRight className="w-3.5 h-3.5" />
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Bottom CTA to Knowledge Base Hub */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-16 p-8 rounded-3xl bg-gradient-to-r from-emerald-950/20 via-zinc-900/60 to-teal-950/20 border border-emerald-500/20"
                >
                    <div className="space-y-1 text-center sm:text-left">
                        <h4 className="text-lg md:text-xl font-bold text-white">
                            Looking for more guides, specs, or contract audits?
                        </h4>
                        <p className="text-xs md:text-sm text-zinc-400">
                            Explore the complete library of articles in our interactive Knowledge Base Hub.
                        </p>
                    </div>

                    <Link to="/kb">
                        <Button className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl px-6 py-6 h-auto shadow-lg shadow-emerald-500/20 gap-2 shrink-0">
                            <BookOpen className="w-4 h-4" />
                            <span>Browse All Articles & Categories</span>
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}
