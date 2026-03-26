import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@trendcraft/chart/react": resolve(__dirname, "../../react/TrendChart.tsx"),
      "@trendcraft/chart": resolve(__dirname, "../../src/index.ts"),
      "trendcraft": resolve(__dirname, "../../../core/src/index.ts"),
    },
  },
});
