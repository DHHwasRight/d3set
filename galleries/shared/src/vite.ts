// `virtual:snippets` for the Vite galleries: the source files their docs show, highlighted when
// the gallery builds. In `vite dev`, editing one of those files reloads the page with it.

import type { Plugin } from "vite";
import { codePaths, type Docs } from "./docs.ts";
import { readSnippets } from "./highlight.ts";
import { join } from "node:path";

const ID = "virtual:snippets";

export function snippets(docs: Docs, root: string): Plugin {
  return {
    name: "d3set-snippets",
    resolveId: (id) => (id === ID ? `\0${ID}` : undefined),
    async load(id) {
      if (id !== `\0${ID}`) return;
      const paths = codePaths(docs);
      for (const path of paths) this.addWatchFile(join(root, path));
      return `export default ${JSON.stringify(await readSnippets(root, paths))};`;
    },
  };
}
