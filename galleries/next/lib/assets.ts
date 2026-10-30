// The shared stylesheets, fonts, and icon (galleries/shared/public), served at the URLs the
// exported pages use. Route handlers rather than a copy into public/: one source, nothing to sync.
import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

const DIR = join(process.cwd(), "../shared/public");
const TYPES: Record<string, string> = { ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml" };

/** The file `name` of `dir` (relative to the shared public directory). */
export function file(dir: string, name: string): Response {
  const body = readFileSync(join(DIR, dir, name));
  return new Response(body, { headers: { "content-type": TYPES[extname(name)] ?? "application/octet-stream" } });
}

/** The route handlers of a directory: every file, prerendered at build. */
export function directory(dir: string) {
  return {
    generateStaticParams: () => readdirSync(join(DIR, dir)).map((name) => ({ name })),
    GET: async (_: Request, { params }: { params: Promise<{ name: string }> }) => file(dir, (await params).name),
  };
}
