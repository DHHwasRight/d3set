import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { snippets } from "../shared/src/vite.ts";
import { docs } from "./src/docs.ts";

const root = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// A single-page app: `vite preview` answers every path with index.html, and the router draws the
// page. The stylesheets, fonts and favicon are the ones the Rust gallery exported, served as is.
// The library and its React bindings resolve to their sources: no build of the packages needed.
export default defineConfig({
  root: root("."),
  publicDir: root("../shared/public"),
  appType: "spa",
  // The library switch's links: `GALLERY_LIBRARIES` when the gallery builds (see libraries.ts).
  define: { __GALLERY_LIBRARIES__: JSON.stringify(process.env.GALLERY_LIBRARIES ?? "") },
  plugins: [react(), snippets(docs, root("../.."))],
  resolve: {
    alias: {
      "d3set/core": root("../../src/core.ts"),
      "d3set/lazy": root("../../src/lazy.ts"),
      "@d3set/react": root("../../packages/react/src/index.ts"),
    },
  },
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 2048 },
});
