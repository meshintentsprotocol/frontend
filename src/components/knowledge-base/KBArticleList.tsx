/**
 * KBArticleList - Premium Article Grid
 * 
 * Features:
 * - Responsive bento-style grid
 * - Staggered animation on scroll
 * - Empty state with styling
 */

import { KBArticleCard } from './KBArticleCard';
import { useKb, type KBArticle } from './kbService';
import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';

interface KBArticleListProps {
    categoryId?: string;
    limit?: number;
    articles?: KBArticle[];
}

export function KBArticleList({ categoryId, limit, articles: propArticles }: KBArticleListProps) {
    const kbService = useKb();
    let articles = propArticles || (categoryId
        ? kbService.getArticlesByCategory(categoryId)
        : kbService.getAllArticles());

    if (limit) {
        articles = articles.slice(0, limit);
    }

    if (articles.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16"
            >
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-lg text-muted-foreground">
                    No articles found in this category.
                </p>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
        >
            {articles.map((article, index) => (
                <KBArticleCard
                    key={article.id}
                    {...article}
                    index={index}
                />
            ))}
        </motion.div>
    );
}

export default KBArticleList;
