import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    // Four entries: everything (`d3set`), the library without chart types (`d3set/core`), chart
    // types on demand (`d3set/lazy`), and server rendering in Node (`d3set/server`). Shared code
    // is split into chunks, so an app that imports `core` and `lazy` ships only what it uses.
    lib: {
      entry: { d3set: "src/index.ts", core: "src/core.ts", lazy: "src/lazy.ts", server: "src/server.ts" },
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`,
      cssFileName: "d3set",
    },
    rollupOptions: { external: [/^d3/, "linkedom"] },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts", "packages/*/test/**/*.test.{ts,tsx}"],
    // The bindings' tests run against the library's sources, not a build of it.
    alias: {
      "d3set/core": new URL("./src/core.ts", import.meta.url).pathname,
      "d3set/lazy": new URL("./src/lazy.ts", import.meta.url).pathname,
      "d3set/server": new URL("./src/server.ts", import.meta.url).pathname,
    },
  },
});
