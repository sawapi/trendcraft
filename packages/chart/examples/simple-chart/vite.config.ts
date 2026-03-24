import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@trendcraft/chart": resolve(__dirname, "../../src/index.ts"),
      "trendcraft": resolve(__dirname, "../../../core/src/index.ts"),
    },
  },
});
