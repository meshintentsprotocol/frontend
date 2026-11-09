/**
 * KBArticleCard - Production-grade Sharp Article Card
 * 
 * Features:
 * - Crisp developer-centric silhouette (rounded-xl)
 * - Category & Date overlay pills directly on 16:10 cover
 * - Real token-aware cover display with retina CDN sizing
 * - Subtle glassmorphic hover state with emerald highlight
 * - Author, read time, and smooth animated reading indicator
 */

import { imageUrl } from '@/shared/sanity';
import { KB_FALLBACK_COVER, type KBTag } from './kbService';
import { cn } from '@/lib/utils';
import { Clock, User, ArrowUpRight, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface KBArticleCardProps {
    id: string;
    categoryId: string;
    categoryTitle?: string;
    title: string;
    summary: string;
    date?: string;
    author: string;
    readTime: string;
    tags: KBTag[];
    cover?: string;
    coverAlt?: string;
    index?: number;
}

export function KBArticleCard({
    id,
    categoryId,
    categoryTitle,
    title,
    summary,
    date,
    author,
    readTime,
    tags,
    cover,
    coverAlt,
    index = 0,
}: KBArticleCardProps) {
    const formattedCategory = categoryTitle || categoryId.replace(/-/g, ' ');

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
            className="h-full"
        >
            <Link to={`/kb/${categoryId}/${id}`} className="block h-full group">
                <article
                    className={cn(
                        'h-full flex flex-col overflow-hidden rounded-xl',
                        'bg-card dark:bg-zinc-900/90 backdrop-blur-sm',
                        'border border-zinc-200/80 dark:border-zinc-800/80',
                        'hover:border-primary/50 dark:hover:border-primary/50',
                        'hover:shadow-xl hover:shadow-primary/5',
                        'transition-all duration-300 ease-out hover:-translate-y-1'
                    )}
                >
                    {/* Cover Container */}
                    <div className="relative aspect-[16/10] overflow-hidden bg-zinc-950/60 rounded-t-xl">
                        <img
                            src={imageUrl(cover, { w: 800, h: 500 }) ?? KB_FALLBACK_COVER}
                            alt={coverAlt || title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                        />
                        {/* Gradient Vignette */}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/15 to-transparent" />

                        {/* Top-Left Category Badge */}
                        <div className="absolute top-3 left-3 z-10">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide uppercase bg-background/90 dark:bg-zinc-950/85 backdrop-blur-md text-primary border border-primary/25 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                {formattedCategory}
                            </span>
                        </div>

                        {/* Top-Right Date Badge */}
                        {date && (
                            <div className="absolute top-3 right-3 z-10">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono text-zinc-300 bg-black/60 backdrop-blur-md border border-white/10 shadow-sm">
                                    <Calendar className="w-3 h-3 text-zinc-400" />
                                    {date}
                                </span>
                            </div>
                        )}

                        {/* Floating Arrow on Hover */}
                        <div
                            className={cn(
                                'absolute bottom-3 right-3 w-8 h-8 rounded-lg',
                                'bg-primary text-primary-foreground',
                                'flex items-center justify-center',
                                'opacity-0 group-hover:opacity-100 transition-all duration-300',
                                'translate-y-2 group-hover:translate-y-0 shadow-lg shadow-primary/25'
                            )}
                        >
                            <ArrowUpRight className="w-4 h-4" />
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex flex-col flex-grow p-5 md:p-6">
                        {/* Tags */}
                        {tags && tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {tags.slice(0, 3).map(tag => (
                                    <span
                                        key={tag.slug}
                                        className={cn(
                                            'text-[10px] uppercase font-mono tracking-wider font-medium px-2 py-0.5 rounded',
                                            'bg-zinc-100 dark:bg-zinc-800/80 text-muted-foreground',
                                            'border border-zinc-200/60 dark:border-zinc-700/60'
                                        )}
                                    >
                                        {tag.title}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Title */}
                        <h3 className="font-bold text-lg md:text-xl leading-snug mb-2.5 text-foreground group-hover:text-primary transition-colors line-clamp-2">
                            {title}
                        </h3>

                        {/* Summary */}
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-5 flex-grow">
                            {summary}
                        </p>

                        {/* Metadata Footer */}
                        <div className="flex items-center justify-between pt-4 border-t border-border/60 text-xs text-muted-foreground">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-muted-foreground/80" />
                                    <span className="font-medium truncate max-w-[120px]">{author}</span>
                                </div>
                                <span className="text-border">·</span>
                                <div className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-muted-foreground/80" />
                                    <span>{readTime}</span>
                                </div>
                            </div>

                            <span className="text-primary font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                Read
                                <ArrowUpRight className="w-3.5 h-3.5" />
                            </span>
                        </div>
                    </div>
                </article>
            </Link>
        </motion.div>
    );
}

export default KBArticleCard;
