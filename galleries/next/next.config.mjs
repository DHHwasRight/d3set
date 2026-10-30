import { fileURLToPath } from "node:url";
import { withD3set } from "@d3set/next/config";

// The repository root: the workspace's packages are linked from there.
const root = fileURLToPath(new URL("../..", import.meta.url));

export default withD3set({
  turbopack: { root },
  outputFileTracingRoot: root,
  // The shared fixture helpers are TypeScript sources, not a build.
  transpilePackages: ["@d3set/gallery-shared"],
  // The docs' highlighter: TextMate grammars and themes, loaded at runtime, not bundled.
  serverExternalPackages: ["shiki"],
});
