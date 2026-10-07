/**
 * KBCategoryList - Premium Category Grid
 * 
 * Features:
 * - Responsive bento-style grid
 * - Staggered animation on scroll
 * - Glass container with grainy texture
 */

import { KBCategoryCard } from './KBCategoryCard';
import { useKb } from './kbService';
import { motion } from 'framer-motion';

export function KBCategoryList() {
    const categories = useKb().getCategories();

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
        >
            {categories.map((category, index) => (
                <KBCategoryCard
                    key={category.id}
                    {...category}
                    index={index}
                />
            ))}
        </motion.div>
    );
}

export default KBCategoryList;
