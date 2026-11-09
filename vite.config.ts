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
    root: path.resolve(__dirname),
    cacheDir: path.resolve(__dirname, './node_modules/.vite'),
    define: {
        'global': 'window',
    },
    optimizeDeps: {
        include: [
            '@reown/appkit',
            '@reown/appkit-adapter-ethers',
            '@reown/appkit-adapter-solana',
            '@reown/appkit-adapter-bitcoin',
            '@reown/appkit/networks',
            'viem',
            'abitype',
            '@noble/hashes/sha3',
            '@noble/hashes/sha256',
            '@noble/hashes/ripemd160',
        ],
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@walletconnect/universal-provider": path.resolve(__dirname, "./node_modules/@walletconnect/universal-provider/dist/index.es.js"),
            // sodium-native is a C++ Node.js addon — cannot run in the browser.
            "sodium-native": "sodium-javascript",
            // mainnet-js has an optional dynamic import of this package (try/catch wrapped).
            "@mem-cash/validation": fileURLToPath(
                new URL("./src/lib/mem-cash-validation-stub.ts", import.meta.url)
            ),
            "@telegram-apps/bridge": fileURLToPath(
                new URL("./src/lib/telegram-bridge-stub.ts", import.meta.url)
            ),
        },
    },
    build: {
        rollupOptions: {
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
            // Prices / market data come from the mesh server (lib/marketData.ts), not vendor proxies.
        }
    }
})
