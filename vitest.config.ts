import path from "path"
import { defineConfig } from "vitest/config"

// Unit tests for pure modules (e.g. src/lib/mesh). Runs in node: no DOM, no Vite plugins.
export default defineConfig({
    resolve: {
        alias: { "@": path.resolve(__dirname, "./src") },
    },
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
        testTimeout: 30_000,
    },
})
