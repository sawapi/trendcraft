import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "screening/index": resolve(__dirname, "src/screening/index.ts"),
        "indicators/incremental/index": resolve(__dirname, "src/indicators/incremental/index.ts"),
        "indicators/safe/index": resolve(__dirname, "src/indicators/safe/index.ts"),
        "manifest/index": resolve(__dirname, "src/manifest/index.ts"),
        "bin/trendcraft-screen": resolve(__dirname, "bin/trendcraft-screen.ts"),
        "bin/trendcraft-backtest": resolve(__dirname, "bin/trendcraft-backtest.ts"),
        "bin/trendcraft-analyze": resolve(__dirname, "bin/trendcraft-analyze.ts"),
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) => {
        const ext = format === "es" ? "js" : "cjs";
        return `${entryName}.${ext}`;
      },
    },
    sourcemap: true,
    minify: "esbuild",
    rollupOptions: {
      external: [
        "node:fs",
        "node:path",
        "node:url",
      ],
    },
  },
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/__tests__/**", "src/**/types/**", "src/**/*.d.ts", "src/__benchmarks__/**"],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 80,
        lines: 85,
      },
    },
  },
});
