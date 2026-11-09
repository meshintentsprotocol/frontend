import { useState, useEffect, useRef } from 'react';
import { useInView } from 'framer-motion';

/**
 * useBentoAnimationTrigger
 * 
 * Controls interactive movements in Bento cards:
 * - On desktop: active when hovered (mouse enter/leave)
 * - On mobile/touch: active when scrolled into view (useInView with comfortable threshold)
 */
export function useBentoAnimationTrigger() {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // In-view trigger with 25% threshold for responsive mobile triggering
    const inView = useInView(cardRef, {
        amount: 0.25,
    });

    useEffect(() => {
        const check = () => {
            setIsMobile(window.innerWidth < 768 || ('ontouchstart' in window && window.innerWidth < 1024));
        };
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // Movement happens on hover on desktop, or when scrolled into view on mobile
    const isActive = isMobile ? inView : isHovered;

    return {
        cardRef,
        isActive,
        isHovered,
        isMobile,
        inView,
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
    };
}

