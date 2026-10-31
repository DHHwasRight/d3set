// Read and highlight the source files a gallery's docs show (Node only: at build time, or in a
// Server Component). The same kind of highlighting as the Rust gallery's (giallo): TextMate
// grammars and the Original style's VS Code theme, and the same `pre.giallo` element its CSS styles.

import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { codeToHtml } from "shiki";
import type { Snippets } from "./docs.ts";

/** The grammar, and the name the code block shows, of each file extension. */
const LANGS: Record<string, [string, string]> = {
  ".ts": ["ts", "TypeScript"],
  ".tsx": ["tsx", "TSX"],
  ".js": ["js", "JavaScript"],
  ".mjs": ["js", "JavaScript"],
  ".json": ["json", "JSON"],
  ".rs": ["rust", "Rust"],
};

/** The themes of the Rust gallery (`styles::CODE_THEME_LIGHT`, `styles::CODE_THEME`). */
const THEMES = { light: "night-owl-light", dark: "night-owl" };

/** `paths`, from the repository root `root`, read and highlighted. */
export async function readSnippets(root: string, paths: string[]): Promise<Snippets> {
  const out: Snippets = {};
  for (const path of paths) {
    const [lang, name] = LANGS[extname(path)] ?? ["text", "Text"];
    const code = await readFile(join(root, path), "utf8");
    const html = await codeToHtml(code.trimEnd(), {
      lang,
      themes: THEMES,
      // Each color as `light-dark(light, dark)`, like giallo: the page's color scheme picks one.
      defaultColor: "light-dark()",
      transformers: [
        {
          pre(node) {
            node.properties.class = "giallo";
            delete node.properties.tabindex;
          },
        },
      ],
    });
    out[path] = { path, lang: name, html };
  }
  return out;
}
