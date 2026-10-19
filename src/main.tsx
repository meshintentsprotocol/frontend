import './polyfills';

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from '@/context/theme-provider'
import { LanguageProvider } from '@/context/language-provider'
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

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
                <LanguageProvider>
                    <SolanaWalletProvider>
                        <App />
                        <Toaster />
                    </SolanaWalletProvider>
                </LanguageProvider>
            </ThemeProvider>
        </QueryClientProvider>
    </React.StrictMode>,
);

// Register service worker (production only)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {/* SW optional */});
    });
}
