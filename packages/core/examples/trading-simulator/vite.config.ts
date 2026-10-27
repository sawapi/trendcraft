import type { IncomingMessage } from "node:http";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Proxy `bypass` that forwards only GET requests whose path matches `pattern`
 * and answers everything else with 404. The proxy attaches the Alpaca keys,
 * so it must not become a general gateway: the app only reads market data
 * and the asset list, never trading endpoints such as orders.
 */
function allowGetOnly(pattern: RegExp) {
  return (req: IncomingMessage) => (req.method === "GET" && pattern.test(req.url ?? "") ? undefined : false);
}

export default defineConfig(({ mode }) => {
  // Load ALPACA_ prefixed env vars from .env
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
  };
});
