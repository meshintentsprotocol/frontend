import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function PWAUpdatePrompt() {
    const [visible, setVisible] = useState(false);
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const handleUpdateFound = (registration: ServiceWorkerRegistration) => {
            const worker = registration.installing;
            if (!worker) return;

            worker.addEventListener('statechange', () => {
                // A new SW installed while one already controls the page → update available
                if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                    setWaitingWorker(worker);
                    setVisible(true);
                }
            });
        };

        navigator.serviceWorker.ready.then((registration) => {
            registration.addEventListener('updatefound', () => handleUpdateFound(registration));
        });
    }, []);

    if (!visible) return null;

    const refresh = () => {
        waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
    };

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3 bg-card border border-primary/30 shadow-lg shadow-primary/10 rounded-xl px-4 py-3 text-sm">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
                <span className="text-foreground/80">New version available</span>
                <Button
                    size="sm"
                    className="h-7 text-xs font-semibold"
                    onClick={refresh}
                >
                    Refresh
                </Button>
                <button
                    className="text-muted-foreground hover:text-foreground transition-colors ml-1"
                    onClick={() => setVisible(false)}
                    aria-label="Dismiss"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
