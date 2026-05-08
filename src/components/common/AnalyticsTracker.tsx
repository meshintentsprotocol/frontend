import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function AnalyticsTracker() {
    const location = useLocation();

    useEffect(() => {
        // Trigger a page_view event whenever the route changes
        if (typeof window.gtag === 'function') {
            window.gtag('event', 'page_view', {
                page_path: location.pathname + location.search,
            });
        }
    }, [location]);

    // This component renders nothing; it just listens to route changes
    return null;
}
