import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));
const useDist = process.env.USE_DIST === "1";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@trendcraft/chart/react": resolve(__dirname, useDist ? "../../dist/react/TrendChart.js" : "../../react/TrendChart.tsx"),
      "@trendcraft/chart": resolve(__dirname, useDist ? "../../dist/index.js" : "../../src/index.ts"),
      "trendcraft": resolve(__dirname, useDist ? "../../../core/dist/index.js" : "../../../core/src/index.ts"),
    },
  },
});
