import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        headless: resolve(__dirname, "src/headless.ts"),
        "react/TrendChart": resolve(__dirname, "react/TrendChart.tsx"),
        "vue/TrendChart": resolve(__dirname, "vue/TrendChart.ts"),
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
      external: ["trendcraft", "react", "react/jsx-runtime", "vue"],
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
  },
});
