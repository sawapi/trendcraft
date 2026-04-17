import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: {
    port: 5175,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@trendcraft/chart/presets": resolve(__dirname, "../../src/presets.ts"),
      "@trendcraft/chart": resolve(__dirname, "../../src/index.ts"),
      trendcraft: resolve(__dirname, "../../../core/src/index.ts"),
    },
  },
});
