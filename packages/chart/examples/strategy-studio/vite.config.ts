import type { IncomingMessage } from "node:http";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));
const useDist = process.env.USE_DIST === "1";

/**
 * Proxy `bypass` that forwards only GET requests whose path matches `pattern`
 * and answers everything else with 404. The proxy attaches the Alpaca keys,
 * so it must not become a general gateway: the studio only reads market data
 * and the asset list, never trading endpoints such as orders.
 */
function allowGetOnly(pattern: RegExp) {
  return (req: IncomingMessage) => (req.method === "GET" && pattern.test(req.url ?? "") ? undefined : false);
}

export default defineConfig(({ mode }) => {
  // ALPACA_ env vars stay in the dev server process; the proxy below injects
  // them as request headers so browser bundles never see the keys.
  const env = loadEnv(mode, process.cwd(), "ALPACA_");
  const hasAlpaca = !!(env.ALPACA_API_KEY && env.ALPACA_API_SECRET);

  const authHeaders: Record<string, string> = hasAlpaca
    ? {
        "APCA-API-KEY-ID": env.ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": env.ALPACA_API_SECRET,
      }
    : {};

  const proxy: Record<string, ProxyOptions> = hasAlpaca
    ? {
        "/api/alpaca/data": {
          target: "https://data.alpaca.markets",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/alpaca\/data/, ""),
          headers: authHeaders,
          bypass: allowGetOnly(/^\/api\/alpaca\/data\/v2\/stocks\/[A-Za-z0-9.-]+\/bars(\?|$)/),
        },
        "/api/alpaca/trading": {
          target: "https://paper-api.alpaca.markets",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/alpaca\/trading/, ""),
          headers: authHeaders,
          bypass: allowGetOnly(/^\/api\/alpaca\/trading\/v2\/assets(\?|$)/),
        },
      }
    : {};

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_ALPACA_ENABLED": JSON.stringify(hasAlpaca ? "true" : ""),
    },
    server: {
      proxy,
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
          find: "@trendcraft/chart/features",
          replacement: resolve(__dirname, useDist ? "../../dist/features.js" : "../../src/features/index.ts"),
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
