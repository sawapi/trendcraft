import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    target: "node18",
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "bin/trendcraft-mcp": resolve(__dirname, "src/bin/trendcraft-mcp.ts"),
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) => {
        const ext = format === "es" ? "js" : "cjs";
        return `${entryName}.${ext}`;
      },
    },
    sourcemap: true,
    minify: false,
    rollupOptions: {
      external: [
        /^node:/,
        "@modelcontextprotocol/sdk",
        /^@modelcontextprotocol\/sdk\//,
        "trendcraft",
        /^trendcraft\//,
        "zod",
      ],
      output: {
        banner: (chunk) =>
          chunk.fileName.startsWith("bin/") ? "#!/usr/bin/env node" : "",
      },
    },
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      exclude: ["**/__tests__/**"],
    }),
  ],
  test: {
    globals: true,
    environment: "node",
  },
});
