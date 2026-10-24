import { defineConfig } from "vite";

// A self-contained ES module for pages without a bundler: d3 is included, not external.
export default defineConfig({
  build: {
    outDir: "dist-browser",
    emptyOutDir: true,
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "d3set.js",
      cssFileName: "d3set",
    },
  },
});
