import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// ============================================================================
// ScrollToTop — resets scroll position on route change
// ============================================================================
// React Router does not reset scroll on navigation, so a new page would open
// at whatever position the previous page was scrolled to. This component
// scrolls the window to the top whenever the path changes — unless the URL
// carries a hash, in which case it scrolls that anchor into view instead.

export function ScrollToTop() {
    const { pathname, hash } = useLocation();

    useEffect(() => {
        if (hash) {
            const el = document.getElementById(hash.slice(1));
            if (el) {
                el.scrollIntoView();
                return;
            }
        }
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    }, [pathname, hash]);

    return null;
}

export default ScrollToTop;
