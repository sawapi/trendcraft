import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));
const useDist = process.env.USE_DIST === "1";

export default defineConfig(({ mode }) => {
  // ALPACA_ env vars stay in the dev server process; the proxy below injects
  // them as request headers so browser bundles never see the keys.
  const env = loadEnv(mode, process.cwd(), "ALPACA_");
  const hasAlpaca = !!(env.ALPACA_API_KEY && env.ALPACA_API_SECRET);

  const authHeaders = hasAlpaca
    ? {
        "APCA-API-KEY-ID": env.ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": env.ALPACA_API_SECRET,
      }
    : {};

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_ALPACA_ENABLED": JSON.stringify(hasAlpaca ? "true" : ""),
    },
    server: {
      proxy: hasAlpaca
        ? {
            "/api/alpaca/data": {
              target: "https://data.alpaca.markets",
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api\/alpaca\/data/, ""),
              headers: authHeaders,
            },
            "/api/alpaca/trading": {
              target: "https://paper-api.alpaca.markets",
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api\/alpaca\/trading/, ""),
              headers: authHeaders,
            },
          }
        : {},
    },
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
          find: "@trendcraft/chart/replay",
          replacement: resolve(__dirname, useDist ? "../../dist/replay.js" : "../../src/replay.ts"),
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
  };
});
