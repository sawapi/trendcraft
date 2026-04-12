import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

// USE_DIST=1 pnpm dev → use built output (tree-shaking enabled, faster load)
// pnpm dev             → use TS source (hot reload on core changes)
const useDist = process.env.USE_DIST === "1";

export default defineConfig({
  resolve: {
    alias: {
      "@trendcraft/chart/presets": resolve(__dirname, useDist ? "../../dist/presets.js" : "../../src/presets.ts"),
      "@trendcraft/chart": resolve(__dirname, useDist ? "../../dist/index.js" : "../../src/index.ts"),
      "trendcraft": resolve(__dirname, useDist ? "../../../core/dist/index.js" : "../../../core/src/index.ts"),
    },
  },
});
