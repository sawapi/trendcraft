import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const useDist = process.env.USE_DIST === "1";

export default defineConfig({
  // Relative asset URLs, so the built app also works from a sub-path
  // (GitHub Pages serves it at /<repo>/<example>/, not at the site root).
  base: "./",
  resolve: {
    alias: {
      "@trendcraft/chart/sparkline": resolve(
        __dirname,
        useDist ? "../../dist/sparkline.js" : "../../src/sparkline/index.ts",
      ),
      "@trendcraft/chart": resolve(
        __dirname,
        useDist ? "../../dist/index.js" : "../../src/index.ts",
      ),
    },
  },
});
