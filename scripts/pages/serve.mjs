// Serve the GitHub Pages build like GitHub does, rebuild what changed, and reload the browser.
//
//   npm run pages:serve            http://localhost:4000/d3set/
//   PORT=4100 npm run pages:serve
//   PAGES_OUT=dist-other npm run pages:serve    another output directory
//   npm run pages:serve -- --no-watch    serve only, no rebuild and no reload
//
// The site is built for this address (PAGES_URL), so the library switch stays on this server.
// Like GitHub Pages: a directory answers its index.html, `/a` redirects to `/a/` when `a` is a
// directory, an unknown path answers the root 404.html with status 404. Every HTML page gets a
// small script that reloads it when a rebuild finishes (server-sent events on /__reload).

import { spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync, statSync, watch } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const port = Number(process.env.PORT ?? 4000);
const site = `http://localhost:${port}/d3set`;
const base = "/d3set";
const out = resolve(root, process.env.PAGES_OUT ?? "dist-pages");
const watching = !process.argv.includes("--no-watch");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

const RELOAD = `<script>(() => { const s = new EventSource("/__reload"); s.onmessage = () => location.reload(); })();</script>`;
const clients = new Set();

function reload() {
  for (const res of clients) res.write("data: reload\n\n");
}

async function send(res, file, status = 200) {
  const type = TYPES[extname(file)] ?? "application/octet-stream";
  if (type.startsWith("text/html") && watching) {
    const html = await readFile(file, "utf8");
    const body = html.includes("</body>") ? html.replace("</body>", `${RELOAD}</body>`) : html + RELOAD;
    res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
    res.end(body);
    return;
  }
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/__reload") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
    res.write(": open\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  if (url.pathname === "/" || url.pathname === "") {
    res.writeHead(302, { location: `${base}/` });
    return res.end();
  }
  const notFound = () => {
    const page = join(out, "404.html");
    if (existsSync(page)) return send(res, page, 404);
    res.writeHead(404, { "content-type": "text/plain" });
    res.end(existsSync(out) ? "not found" : "no build yet: the first build is running");
  };
  if (!url.pathname.startsWith(`${base}/`)) return notFound();
  const path = decodeURIComponent(url.pathname.slice(base.length));
  const file = join(out, path);
  if (relative(out, file).split(sep)[0] === "..") return notFound();
  if (!existsSync(file)) return notFound();
  if (statSync(file).isDirectory()) {
    if (!url.pathname.endsWith("/")) {
      res.writeHead(301, { location: `${url.pathname}/${url.search}` });
      return res.end();
    }
    const index = join(file, "index.html");
    return existsSync(index) ? send(res, index) : notFound();
  }
  return send(res, file);
});

// ------------------------------------------------------------------ rebuild

// Which part of the site a changed file belongs to. The library (src/, packages/) is in all.
function partsFor(file) {
  const rel = relative(root, file).split(sep).join("/");
  // Build output, written by the build itself: watching it would rebuild forever.
  if (/(^|\/)(node_modules|dist|out|\.next|target|test-results|fixtures)(\/|$)/.test(rel)) return [];
  if (/^(rust\/gallery\/public|galleries\/shared\/public)\//.test(rel)) return [];
  if (/(next-env\.d\.ts|\.tsbuildinfo)$/.test(rel)) return [];
  // Anything else git ignores is generated too (the bundles build.rs writes, for one).
  if (spawnSync("git", ["check-ignore", "-q", rel], { cwd: root }).status === 0) return [];
  if (rel.startsWith("rust/")) return ["rsx", "fixtures", "vanilla", "react", "next"];
  if (rel.startsWith("src/") || rel.startsWith("packages/")) return ["rsx", "vanilla", "react", "next"];
  if (rel.startsWith("galleries/shared/")) return ["vanilla", "react", "next"];
  for (const name of ["vanilla", "react", "next"]) if (rel.startsWith(`galleries/${name}/`)) return [name];
  return [];
}

let pending = new Set();
let building = false;
let timer;

function build(parts) {
  building = true;
  const args = ["scripts/pages/build.mjs", "--out", out];
  if (parts) args.push("--only", [...parts].join(","));
  const child = spawn("node", args, { cwd: root, stdio: "inherit", env: { ...process.env, PAGES_URL: site } });
  child.on("exit", (code) => {
    building = false;
    if (code === 0) {
      console.log(`pages: built, reloading ${clients.size} page(s)`);
      reload();
    } else {
      console.log("pages: build failed, the previous site is still served");
    }
    if (pending.size) flush();
  });
}

function flush() {
  if (building) return;
  const parts = pending;
  pending = new Set();
  build(parts);
}

server.listen(port, "127.0.0.1", () => {
  console.log(`pages: serving ${out} at ${site}/`);
  if (!watching) return;
  build(null);
  for (const dir of ["src", "packages", "rust", "galleries"]) {
    watch(join(root, dir), { recursive: true }, (_event, name) => {
      if (!name) return;
      const parts = partsFor(join(root, dir, name));
      if (!parts.length) return;
      if (process.env.PAGES_DEBUG) console.log(`pages: changed ${dir}/${name}`);
      for (const p of parts) pending.add(p);
      clearTimeout(timer);
      timer = setTimeout(flush, 300);
    });
  }
  console.log("pages: watching src, packages, rust, galleries");
});
