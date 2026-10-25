import { resolve } from "node:path";
import { defineConfig } from "vite";

// Serves the e2e fixture page straight from package source.
export default defineConfig({
  root: resolve(import.meta.dirname, "fixture"),
  server: { port: 5310, strictPort: true },
});
