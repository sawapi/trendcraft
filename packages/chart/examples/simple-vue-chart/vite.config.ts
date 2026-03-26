import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@trendcraft/chart/vue": resolve(__dirname, "../../vue/TrendChart.ts"),
      "@trendcraft/chart": resolve(__dirname, "../../src/index.ts"),
      "trendcraft": resolve(__dirname, "../../../core/src/index.ts"),
    },
  },
});
