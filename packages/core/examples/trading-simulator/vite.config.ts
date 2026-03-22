import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Load ALPACA_ prefixed env vars from .env
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
  };
});
