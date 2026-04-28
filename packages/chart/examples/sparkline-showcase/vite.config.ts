import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const useDist = process.env.USE_DIST === "1";

export default defineConfig({
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
