import { defineConfig } from "@playwright/test";

// End-to-end checks of the Rust gallery in a real browser: layout shift while fonts load,
// hydration parity, partial navigation, and the library switch.
// Build first: `mise exec -- cargo build -p gallery` (build.rs bundles the JS and CSS).
const PORT = Number(process.env.GALLERY_PORT ?? 3100);
// A second server with the swap ring on (`GALLERY_SWAP_RING=1`), for the tests tagged `@ring`.
const RING_PORT = Number(process.env.GALLERY_RING_PORT ?? 3110);
// The gallery as a static site (`GALLERY_STATIC=1`): streams poll the recorded timelines and
// dp-swap reads `partials/{depth}{path}`, which `serve` answers like a static host. `static.spec.ts`.
const STATIC_PORT = Number(process.env.GALLERY_STATIC_PORT ?? 3120);
// The Next.js example (examples/next), built then served, for `next.spec.ts`.
const NEXT_PORT = 3200;
// Conformity (`D3SET_CONFORMITY=1`): the Rust gallery with a fixed clock, and the framework
// galleries drawing the pages exported from it (galleries/).
const CONFORMITY = process.env.D3SET_CONFORMITY === "1";
// The GitHub Pages build (`npm run pages:build`), served on its own port: `D3SET_PAGES=1`.
const PAGES = process.env.D3SET_PAGES === "1";
const PAGES_PORT = 4010;
const REFERENCE_PORT = Number(process.env.GALLERY_REFERENCE_PORT ?? 3140);
// `D3SET_GALLERIES=vanilla,react` limits the run to some galleries.
const GALLERIES = [
  { name: "vanilla", port: 3300 },
  { name: "react", port: 3310 },
  { name: "next", port: 3320 },
].filter((g) => !process.env.D3SET_GALLERIES || process.env.D3SET_GALLERIES.split(",").includes(g.name));

const server = (port: number, env: Record<string, string> = {}) => ({
  command: "./target/debug/gallery",
  env: { GALLERY_ADDR: `127.0.0.1:${port}`, ...env },
  url: `http://127.0.0.1:${port}/guide`,
  reuseExistingServer: true,
  timeout: 30_000,
});

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    // The installed Chrome: no browser download.
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
    // A high-density screen, like the Macs the gallery is viewed on: d3-axis offsets lines by 0.5px
    // at density 1, and the server draws for high density.
    deviceScaleFactor: 2,
  },
  projects: [
    {
      name: "default",
      grepInvert: /@ring/,
      testIgnore: /(next|conformity|static|pages)\.spec\.ts/,
      use: { baseURL: `http://127.0.0.1:${PORT}` },
    },
    {
      name: "ring",
      testMatch: /navigation\.spec\.ts/,
      grep: /@ring/,
      use: { baseURL: `http://127.0.0.1:${RING_PORT}` },
    },
    {
      name: "static",
      testMatch: /static\.spec\.ts/,
      use: { baseURL: `http://127.0.0.1:${STATIC_PORT}` },
    },
    {
      name: "next",
      testMatch: /next\.spec\.ts/,
      use: { baseURL: `http://127.0.0.1:${NEXT_PORT}` },
    },
    ...(PAGES
      ? [{ name: "pages", testMatch: /pages\.spec\.ts/, use: { baseURL: `http://localhost:${PAGES_PORT}` } }]
      : []),
    ...(CONFORMITY
      ? GALLERIES.map((g) => ({
          name: `conformity-${g.name}`,
          testMatch: /conformity\.spec\.ts/,
          use: { baseURL: `http://127.0.0.1:${g.port}` },
        }))
      : []),
  ],
  webServer: [
    ...(PAGES
      ? [
          {
            // The GitHub Pages build, served like GitHub serves it, for this address.
            command: `node scripts/pages/build.mjs --out dist-pages-e2e && node scripts/pages/serve.mjs --no-watch`,
            env: {
              PAGES_URL: `http://localhost:${PAGES_PORT}/d3set`,
              PAGES_OUT: "dist-pages-e2e",
              PORT: String(PAGES_PORT),
            },
            url: `http://localhost:${PAGES_PORT}/d3set/`,
            reuseExistingServer: false,
            timeout: 600_000,
          },
        ]
      : []),
    server(PORT),
    server(RING_PORT, { GALLERY_SWAP_RING: "1" }),
    server(STATIC_PORT, { GALLERY_STATIC: "1" }),
    {
      command: "npm run build -w examples/next && npm run start -w examples/next",
      url: `http://127.0.0.1:${NEXT_PORT}/`,
      reuseExistingServer: true,
      timeout: 180_000,
    },
    ...(CONFORMITY
      ? [
          server(REFERENCE_PORT, { GALLERY_NOW: "2026-10-01T00:00:00Z" }),
          ...GALLERIES.map((g) => ({
            command: `npm run serve -w galleries/${g.name}`,
            url: `http://127.0.0.1:${g.port}/`,
            reuseExistingServer: true,
            timeout: 300_000,
          })),
        ]
      : []),
  ],
});
