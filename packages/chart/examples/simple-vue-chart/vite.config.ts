import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const __dirname = dirname(fileURLToPath(import.meta.url));
const useDist = process.env.USE_DIST === "1";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@trendcraft/chart/vue": resolve(__dirname, useDist ? "../../dist/vue/TrendChart.js" : "../../vue/TrendChart.ts"),
      "@trendcraft/chart": resolve(__dirname, useDist ? "../../dist/index.js" : "../../src/index.ts"),
      "trendcraft": resolve(__dirname, useDist ? "../../../core/dist/index.js" : "../../../core/src/index.ts"),
    },
  },
});
