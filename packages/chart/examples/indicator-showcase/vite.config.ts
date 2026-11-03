import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

// USE_DIST=1 pnpm dev → use built output (tree-shaking enabled, faster load)
// pnpm dev             → use TS source (hot reload on core changes)
const useDist = process.env.USE_DIST === "1";

export default defineConfig({
  // Relative asset URLs, so the built app also works from a sub-path
  // (GitHub Pages serves it at /<repo>/<example>/, not at the site root).
  base: "./",
  resolve: {
    alias: {
      "@trendcraft/chart/presets": resolve(__dirname, useDist ? "../../dist/presets.js" : "../../src/presets.ts"),
      "@trendcraft/chart/replay": resolve(__dirname, useDist ? "../../dist/replay.js" : "../../src/replay.ts"),
      "@trendcraft/chart/features": resolve(__dirname, useDist ? "../../dist/features.js" : "../../src/features/index.ts"),
      "@trendcraft/chart": resolve(__dirname, useDist ? "../../dist/index.js" : "../../src/index.ts"),
      "trendcraft": resolve(__dirname, useDist ? "../../../core/dist/index.js" : "../../../core/src/index.ts"),
    },
  },
});
