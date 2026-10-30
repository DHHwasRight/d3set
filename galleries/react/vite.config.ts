import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { siteFromEnv } from "../shared/src/site.ts";
import { snippets } from "../shared/src/vite.ts";
import { docs } from "./src/docs.ts";

const root = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Dev: the root of its port, fixed rows. `build:pages`: a path prefix and polled data (site.ts).
const site = siteFromEnv(process.env);

// A single-page app: `vite preview` answers every path with index.html, and the router draws the
// page. The stylesheets, fonts and favicon are the ones the Rust gallery exported, served as is.
// The library and its React bindings resolve to their sources: no build of the packages needed.
export default defineConfig({
  root: root("."),
  publicDir: root("../shared/public"),
  appType: "spa",
  base: `${site.base}/`,
  // The library switch's links: `GALLERY_LIBRARIES` when the gallery builds (see libraries.ts).
  define: {
    __GALLERY_LIBRARIES__: JSON.stringify(process.env.GALLERY_LIBRARIES ?? ""),
    __GALLERY_SITE__: JSON.stringify(site),
  },
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
