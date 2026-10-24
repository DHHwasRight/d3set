import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "d3set.js",
      cssFileName: "d3set",
    },
    rollupOptions: { external: [/^d3/] },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
  },
});
