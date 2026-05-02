import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));
const useDist = process.env.USE_DIST === "1";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Order matters: longer / more specific keys must come first so
    // `@trendcraft/chart/react/sparkline` doesn't get re-mapped through the
    // generic `@trendcraft/chart/react` alias before its own entry runs.
    alias: [
      {
        find: "@trendcraft/chart/react/sparkline",
        replacement: resolve(__dirname, useDist ? "../../dist/react/sparkline.js" : "../../react/sparkline.tsx"),
      },
      {
        find: "@trendcraft/chart/react",
        replacement: resolve(__dirname, useDist ? "../../dist/react/TrendChart.js" : "../../react/TrendChart.tsx"),
      },
      {
        find: "@trendcraft/chart/presets",
        replacement: resolve(__dirname, useDist ? "../../dist/presets.js" : "../../src/presets.ts"),
      },
      {
        find: "@trendcraft/chart",
        replacement: resolve(__dirname, useDist ? "../../dist/index.js" : "../../src/index.ts"),
      },
      {
        find: "trendcraft/manifest",
        replacement: resolve(__dirname, useDist ? "../../../core/dist/manifest/index.js" : "../../../core/src/manifest/index.ts"),
      },
      {
        find: "trendcraft",
        replacement: resolve(__dirname, useDist ? "../../../core/dist/index.js" : "../../../core/src/index.ts"),
      },
    ],
  },
});
