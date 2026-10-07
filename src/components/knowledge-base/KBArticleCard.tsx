/**
 * KBArticleCard - Premium Article Card
 * 
 * Features:
 * - Bento-style card with glassmorphism
 * - Image with gradient overlay
 * - Tag badges with morphic styling
 * - Smooth hover effects and animations
 * - Read time and author metadata
 */

import { imageUrl } from '@/shared/sanity';
import { KB_FALLBACK_COVER, type KBTag } from './kbService';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Clock, User, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface KBArticleCardProps {
    id: string;
    categoryId: string;
    title: string;
    summary: string;
    date: string;
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
    title,
    summary,
    author,
    readTime,
    tags,
    cover,
    coverAlt,
    index = 0
}: KBArticleCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
        >
            <Link to={`/kb/${categoryId}/${id}`} className="block h-full group">
                <div className={cn(
                    "bento-card-interactive h-full flex flex-col overflow-hidden p-0",
                    "grainy"
                )}>
                    {/* Image Container */}
                    <div className="relative aspect-[16/10] overflow-hidden">
                        <img
                            src={imageUrl(cover, { w: 800, h: 500 }) ?? KB_FALLBACK_COVER}
                            alt={coverAlt || title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

                        {/* Floating Arrow on Hover */}
                        <div className={cn(
                            "absolute top-4 right-4 w-10 h-10 rounded-full",
                            "bg-white/10 backdrop-blur-md border border-white/20",
                            "flex items-center justify-center",
                            "opacity-0 group-hover:opacity-100 transition-all duration-300",
                            "translate-y-2 group-hover:translate-y-0"
                        )}>
                            <ArrowUpRight className="w-5 h-5 text-white" />
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex flex-col flex-grow p-6">
                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            {tags.slice(0, 3).map(tag => (
                                <Badge
                                    key={tag.slug}
                                    variant="secondary"
                                    className={cn(
                                        "text-[10px] uppercase tracking-wider font-medium",
                                        "bg-zinc-100 dark:bg-zinc-800 text-muted-foreground",
                                        "border-0"
                                    )}
                                >
                                    {tag.title}
                                </Badge>
                            ))}
                        </div>

                        {/* Title */}
                        <h3 className="font-bold text-xl leading-tight mb-3 group-hover:text-primary transition-colors line-clamp-2">
                            {title}
                        </h3>

                        {/* Summary */}
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-grow">
                            {summary}
                        </p>

                        {/* Metadata Footer */}
                        <div className="flex items-center gap-4 pt-4 border-t border-border/50 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" />
                                <span>{author}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{readTime}</span>
                            </div>
                            <span className={cn(
                                "ml-auto text-primary font-medium",
                                "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            )}>
                                Read more
                                <ArrowUpRight className="w-3.5 h-3.5" />
                            </span>
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}

export default KBArticleCard;
