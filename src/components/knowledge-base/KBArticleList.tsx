/**
 * KBArticleList - Production-grade Article Grid with Load More
 * 
 * Features:
 * - Responsive 3-column sharp bento grid
 * - Interactive "Load More" pagination with counter & progress indicator
 * - Category title resolution for rich card badges
 * - Staggered entrance animations
 * - Empty state with quick reset
 */

import { useState, useMemo } from 'react';
import { KBArticleCard } from './KBArticleCard';
import { useKb, type KBArticle } from './kbService';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ChevronDown, CheckCircle2 } from 'lucide-react';

interface KBArticleListProps {
    categoryId?: string;
    initialLimit?: number;
    step?: number;
    articles?: KBArticle[];
    showLoadMore?: boolean;
}

export function KBArticleList({
    categoryId,
    initialLimit = 6,
    step = 6,
    articles: propArticles,
    showLoadMore = true,
}: KBArticleListProps) {
    const kbService = useKb();
    const categories = kbService.getCategories();

    // Map categoryId to friendly title
    const categoryTitleMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const c of categories) {
            map.set(c.id, c.title);
        }
        return map;
    }, [categories]);

    const allMatchingArticles = useMemo(() => {
        if (propArticles) return propArticles;
        return categoryId && categoryId !== 'all'
            ? kbService.getArticlesByCategory(categoryId)
            : kbService.getAllArticles();
    }, [propArticles, categoryId, kbService]);

    const [visibleCount, setVisibleCount] = useState(initialLimit);

    // Reset visible count when category filter changes
    useMemo(() => {
        setVisibleCount(initialLimit);
    }, [categoryId, initialLimit]);

    const visibleArticles = allMatchingArticles.slice(0, visibleCount);
    const hasMore = showLoadMore && visibleCount < allMatchingArticles.length;
    const progressPercent = Math.min(100, Math.round((visibleArticles.length / Math.max(1, allMatchingArticles.length)) * 100));

    if (allMatchingArticles.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20 rounded-xl border border-dashed border-border/70 p-8"
            >
                <div className="w-14 h-14 rounded-xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No articles found</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    There are no guides or documentation published under this track yet.
                </p>
            </motion.div>
        );
    }

    return (
        <div className="space-y-10">
            {/* Grid */}
            <motion.div
                layout
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6"
            >
                <AnimatePresence mode="popLayout">
                    {visibleArticles.map((article, index) => (
                        <KBArticleCard
                            key={article.id}
                            {...article}
                            categoryTitle={categoryTitleMap.get(article.categoryId)}
                            index={index}
                        />
                    ))}
                </AnimatePresence>
            </motion.div>

            {/* Pagination / Load More */}
            {showLoadMore && allMatchingArticles.length > initialLimit && (
                <div className="relative pt-8">
                    {/* Thin progress line spanning full width */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-border/60">
                        <motion.div
                            className="h-full bg-gradient-to-r from-primary via-emerald-500 to-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                    </div>

                    <div className="flex items-center justify-center">
                        {hasMore ? (
                            <button
                                onClick={() => setVisibleCount(prev => prev + step)}
                                className="group relative flex items-center gap-3 px-6 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-300"
                            >
                                {/* Animated border glow on hover */}
                                <div className="absolute inset-0 rounded-xl border border-border/60 group-hover:border-primary/50 transition-colors duration-300" />
                                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-primary/[0.03]" />

                                <span className="relative flex items-center gap-2.5">
                                    <span className="font-mono text-xs text-muted-foreground/70">
                                        {visibleArticles.length}<span className="text-border mx-1">/</span>{allMatchingArticles.length}
                                    </span>
                                    <span className="w-px h-4 bg-border/60" />
                                    <span className="group-hover:text-primary transition-colors">
                                        Show more
                                    </span>
                                    <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 group-hover:text-primary transition-all" />
                                </span>
                            </button>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-2 text-xs text-muted-foreground font-mono"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span>All {allMatchingArticles.length} articles loaded</span>
                            </motion.div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default KBArticleList;
