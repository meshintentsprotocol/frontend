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
            // sodium-universal falls back to this pure-JS/WASM implementation.
            "sodium-native": "sodium-javascript",
            // mainnet-js has an optional dynamic import of this package (try/catch wrapped).
            // Alias to a stub so Vite doesn't 500 on the missing package.
            "@mem-cash/validation": fileURLToPath(
                new URL("./src/lib/mem-cash-validation-stub.ts", import.meta.url)
            ),
        },
    },
    server: {
        proxy: {
            '/api/bardock': {
                target: 'https://aptos.testnet.bardock.movementlabs.xyz',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/bardock/, ''),
                secure: true,
            }
        }
    }
})
