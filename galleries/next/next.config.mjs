import { fileURLToPath } from "node:url";
import { withD3set } from "@d3set/next/config";

// The repository root: the workspace's packages are linked from there.
const root = fileURLToPath(new URL("../..", import.meta.url));

// `build:pages` (GALLERY_STATIC=1): a static export under a path prefix, for GitHub Pages. Every
// page is already drawn at build; the export writes it to out/ as `<path>/index.html`.
const base = (process.env.GALLERY_BASE ?? "").replace(/\/+$/, "");
const pages = process.env.GALLERY_STATIC === "1" ? { output: "export", trailingSlash: true } : {};

export default withD3set({
  ...pages,
  ...(base ? { basePath: base } : {}),
  turbopack: { root },
  outputFileTracingRoot: root,
  // The shared fixture helpers are TypeScript sources, not a build.
  transpilePackages: ["@d3set/gallery-shared"],
  // The docs' highlighter: TextMate grammars and themes, loaded at runtime, not bundled.
  serverExternalPackages: ["shiki"],
});
