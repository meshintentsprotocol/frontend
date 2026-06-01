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
)
