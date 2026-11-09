/**
 * KBCategoryCard - Production-grade Sharp Category Card
 */

import { cn } from '@/lib/utils';
import { BookOpen, FileText, GitCommit, AlertCircle, Lightbulb, Newspaper, ArrowRight, Layers, Code, Globe, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const iconMap: Record<string, any> = {
    'book-open': BookOpen,
    'file-text': FileText,
    'git-commit': GitCommit,
    'alert-circle': AlertCircle,
    'lightbulb': Lightbulb,
    'newspaper': Newspaper,
    'layers': Layers,
    'code': Code,
    'globe': Globe,
    'zap': Zap,
};

const gradientMap: Record<string, string> = {
    'book-open': 'from-primary/15 to-transparent',
    'file-text': 'from-blue-500/15 to-transparent',
    'git-commit': 'from-purple-500/15 to-transparent',
    'alert-circle': 'from-red-500/15 to-transparent',
    'lightbulb': 'from-secondary/15 to-transparent',
    'newspaper': 'from-orange-500/15 to-transparent',
    'layers': 'from-emerald-500/15 to-transparent',
    'code': 'from-cyan-500/15 to-transparent',
    'globe': 'from-indigo-500/15 to-transparent',
    'zap': 'from-amber-500/15 to-transparent',
};

const iconColorMap: Record<string, string> = {
    'book-open': 'text-primary',
    'file-text': 'text-blue-500',
    'git-commit': 'text-purple-500',
    'alert-circle': 'text-red-500',
    'lightbulb': 'text-secondary',
    'newspaper': 'text-orange-500',
    'layers': 'text-emerald-500',
    'code': 'text-cyan-500',
    'globe': 'text-indigo-500',
    'zap': 'text-amber-500',
};

interface KBCategoryCardProps {
    id: string;
    title: string;
    description: string;
    articleCount: number;
    icon: string;
    index?: number;
    compact?: boolean;
}

export function KBCategoryCard({
    id,
    title,
    description,
    articleCount,
    icon,
    index = 0,
    compact = false,
}: KBCategoryCardProps) {
    const Icon = iconMap[icon] || FileText;
    const gradient = gradientMap[icon] || 'from-primary/15 to-transparent';
    const iconColor = iconColorMap[icon] || 'text-primary';

    if (compact) {
        return (
            <Link to={`/kb/${id}`} className="block group h-full">
                <div className="h-full flex items-center gap-3.5 p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-card/60 dark:bg-zinc-900/60 hover:border-primary/50 hover:bg-card dark:hover:bg-zinc-900 transition-all duration-200">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-zinc-100 dark:bg-zinc-800', iconColor)}>
                        <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {title}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate font-mono">
                            {articleCount} {articleCount === 1 ? 'article' : 'articles'}
                        </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </div>
            </Link>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: Math.min(index * 0.05, 0.25) }}
            className="h-full"
        >
            <Link to={`/kb/${id}`} className="block h-full group">
                <div className={cn(
                    'h-full min-h-[170px] flex flex-col p-5 md:p-6 rounded-xl relative overflow-hidden',
                    'bg-card dark:bg-zinc-900/80 backdrop-blur-sm',
                    'border border-zinc-200/80 dark:border-zinc-800/80',
                    'hover:border-primary/50 dark:hover:border-primary/50',
                    'hover:shadow-lg hover:shadow-primary/5',
                    'transition-all duration-300 hover:-translate-y-0.5'
                )}>
                    {/* Subtle gradient wash on hover */}
                    <div className={cn(
                        'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl pointer-events-none',
                        gradient
                    )} />

                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-3">
                            <div className={cn(
                                'w-10 h-10 rounded-lg flex items-center justify-center',
                                'bg-zinc-100 dark:bg-zinc-800 group-hover:scale-105 transition-transform duration-200',
                                iconColor
                            )}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-muted/60 text-muted-foreground">
                                {articleCount} {articleCount === 1 ? 'doc' : 'docs'}
                            </span>
                        </div>

                        <h3 className="text-base md:text-lg font-bold mb-1.5 group-hover:text-primary transition-colors">
                            {title}
                        </h3>

                        <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 mb-3 flex-grow leading-relaxed">
                            {description}
                        </p>

                        <div className="flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity pt-2 border-t border-border/50">
                            Explore track <ArrowRight className="w-3.5 h-3.5 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}

export default KBCategoryCard;
