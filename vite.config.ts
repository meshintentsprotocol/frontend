import path from "path"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"

export default defineConfig({
    plugins: [
        react(),
        nodePolyfills({
            globals: {
                Buffer: true,
                global: true,
                process: true,
            },
            protocolImports: true,
        }),
    ],
    define: {
        'global': 'window',
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            // sodium-native is a C++ Node.js addon — cannot run in the browser.
            "sodium-native": "sodium-javascript",
            // mainnet-js has an optional dynamic import of this package (try/catch wrapped).
            "@mem-cash/validation": fileURLToPath(
                new URL("./src/lib/mem-cash-validation-stub.ts", import.meta.url)
            ),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'chunk-solana': [
                        '@solana/web3.js',
                        '@solana/wallet-adapter-react',
                        '@solana/wallet-adapter-react-ui',
                        '@solana/wallet-adapter-wallets',
                        '@solana/spl-token',
                    ],
                    'chunk-aptos': [
                        '@aptos-labs/ts-sdk',
                        '@aptos-labs/wallet-adapter-react',
                        '@aptos-labs/wallet-adapter-core',
                        '@aptos-labs/wallet-standard',
                    ],
                    'chunk-ui': [
                        'framer-motion',
                        'recharts',
                        'lucide-react',
                        'embla-carousel-react',
                    ],
                    'chunk-react': [
                        'react',
                        'react-dom',
                        'react-router-dom',
                        '@tanstack/react-query',
                    ],
                },
            },
        },
    },
    server: {
        proxy: {
            '/api/bardock': {
                target: 'https://aptos.testnet.bardock.movementlabs.xyz',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/bardock/, ''),
                secure: true,
            },
            '/api/pyth': {
                target: 'https://hermes.pyth.network',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/pyth/, ''),
                secure: true,
            },
        }
    }
})
