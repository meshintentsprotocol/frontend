/**
 * KBCategoryCard - Premium Category Card
 * 
 * Features:
 * - Bento-style card with hover effects
 * - Gradient icon backgrounds
 * - Smooth animations on hover
 * - Article count badge
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
    'book-open': 'from-primary/20 to-primary/5',
    'file-text': 'from-blue-500/20 to-blue-500/5',
    'git-commit': 'from-purple-500/20 to-purple-500/5',
    'alert-circle': 'from-red-500/20 to-red-500/5',
    'lightbulb': 'from-secondary/20 to-secondary/5',
    'newspaper': 'from-orange-500/20 to-orange-500/5',
};

const iconColorMap: Record<string, string> = {
    'book-open': 'text-primary',
    'file-text': 'text-blue-500',
    'git-commit': 'text-purple-500',
    'alert-circle': 'text-red-500',
    'lightbulb': 'text-secondary',
    'newspaper': 'text-orange-500',
};

interface KBCategoryCardProps {
    id: string;
    title: string;
    description: string;
    articleCount: number;
    icon: string;
    index?: number;
}

export function KBCategoryCard({ id, title, description, articleCount, icon, index = 0 }: KBCategoryCardProps) {
    const Icon = iconMap[icon] || FileText;
    const gradient = gradientMap[icon] || 'from-primary/20 to-primary/5';
    const iconColor = iconColorMap[icon] || 'text-primary';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
        >
            <Link to={`/kb/${id}`} className="block h-full group">
                <div className={cn(
                    "bento-card-interactive h-full min-h-[200px] flex flex-col",
                    "grainy"
                )}>
                    {/* Gradient background on hover */}
                    <div className={cn(
                        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl",
                        gradient
                    )} />

                    <div className="relative z-10 flex flex-col h-full">
                        {/* Icon */}
                        <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center mb-4",
                            "bg-zinc-100 dark:bg-zinc-800 group-hover:scale-110 transition-transform duration-300",
                            iconColor
                        )}>
                            <Icon className="w-6 h-6" />
                        </div>

                        {/* Title */}
                        <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                            {title}
                        </h3>

                        {/* Description */}
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-grow">
                            {description}
                        </p>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-4 border-t border-border/50">
                            <span className="text-xs font-medium text-muted-foreground">
                                {articleCount} articles
                            </span>
                            <span className={cn(
                                "flex items-center gap-1 text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0",
                                iconColor
                            )}>
                                Explore <ArrowRight className="w-4 h-4" />
                            </span>
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}

export default KBCategoryCard;
