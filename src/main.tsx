import './polyfills';

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from '@/context/theme-provider'
import { LanguageProvider } from '@/context/language-provider'
import { WalletProvider } from '@/context/wallet-provider'
import { Toaster } from './components/ui/sonner'
import './index.css'
import { SolanaWalletProvider } from '@/context/SolanaWalletProvider'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'

// After a new deploy, old chunk hashes 404. Recover by reloading once onto the
// fresh index.html instead of leaving the user on a broken dynamic-import error.
window.addEventListener('vite:preloadError', () => {
    const KEY = 'vite-preload-reloaded';
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, '1');
    window.location.reload();
});

// Dismiss splash after React renders. Honour a minimum display time so all
// animations play fully regardless of how fast the JS bundle loads.
const MIN_SPLASH_MS = 1500;

function dismissSplash() {
    const splash = document.getElementById('splash');
    if (!splash) return;

    const elapsed = Date.now() - ((window as any).__splashStart ?? Date.now());
    const delay = Math.max(0, MIN_SPLASH_MS - elapsed);

    setTimeout(() => {
        splash.classList.add('splash-exit');
        // Remove from DOM after exit animation completes (0.55s)
        setTimeout(() => splash.remove(), 560);
    }, delay);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
                <LanguageProvider>
                    <WalletProvider>
                        <SolanaWalletProvider>
                            <App />
                            <Toaster />
                        </SolanaWalletProvider>
                    </WalletProvider>
                </LanguageProvider>
            </ThemeProvider>
        </QueryClientProvider>
    </React.StrictMode>,
);

dismissSplash();

// Register service worker (production only)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {/* SW optional */});
    });
}
