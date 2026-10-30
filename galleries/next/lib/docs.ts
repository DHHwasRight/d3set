// The parts of the pages this gallery writes itself (see galleries/shared/src/docs.ts). The code
// blocks show the files in `lib/snippets/` and the Next.js config: the code that draws every
// chart of this gallery.
import "server-only";
import { join } from "node:path";
import { codePaths, type Docs, type Snippets } from "@d3set/gallery-shared/docs";
import { readSnippets } from "@d3set/gallery-shared/highlight";

const DIR = "galleries/next/lib/snippets";

const parts: Docs["parts"] = {
  mode: [{ badge: "Server", live: true }, { text: " Rendered on the server when the page builds, then hydrated." }],
  feed: [],
  rendered: [{ text: ", rendered on the server and hydrated" }],
  intro: [
    { h1: "Charts rendered by React Server Components" },
    {
      lead: "Every chart on these pages is drawn on the server by `@d3set/next/server` when the page builds, from the same specs and rows as the Rust gallery. The page is complete before any JavaScript runs. Then the browser hydrates each chart in place.",
    },
    {
      modes: [
        {
          tag: "1 · Server",
          title: "Server Components",
          text: "`<ServerChart>` draws the first frame on the server, at build time here.",
        },
        {
          tag: "2 · Hydrate",
          title: "Interactive, same data",
          text: "The markup embeds the spec and rows. The browser makes each chart live without a flash.",
        },
        {
          tag: "3 · Live",
          title: "Live rows",
          text: 'With `stream`, a hydrated chart follows new rows: server-sent events from an `sseResponse` route, or on a static host a JSON file polled with `transport: "poll"`.',
        },
      ],
    },
  ],
  guide: [
    { h2: "1. Render on the server" },
    {
      p: "`<ServerChart>` is a Server Component: it draws the chart on the server and sends its markup with the spec and rows. In the browser, the chart hydrates. This is the component that draws every chart of this gallery.",
    },
    { code: `${DIR}/chart.tsx` },
    { h2: "2. Draw a dashboard" },
    {
      p: "`<ServerDashboard>` draws the dashboard the same way. After hydration, its filters, cross-filtering, brush zoom, and time window work in the browser.",
    },
    { code: `${DIR}/dashboard.tsx` },
    { h2: "3. Configure Next.js" },
    { p: "`withD3set` keeps the server-side DOM of `d3set/server` out of the server bundle." },
    { code: "galleries/next/next.config.mjs" },
  ],
  chart: [
    {
      section: {
        title: "Server Component",
        note: "The component that draws every chart of this page, on the server, from the spec above.",
        code: `${DIR}/chart.tsx`,
      },
    },
  ],
};

export const docs: Docs = { title: "d3set · React Server Components", parts };

// `next build` and `next start` run in galleries/next: the repository root is two levels up.
let read: Promise<Snippets> | undefined;

/** The source files `docs` shows, read and highlighted once. */
export function snippets(): Promise<Snippets> {
  return (read ??= readSnippets(join(process.cwd(), "../.."), codePaths(docs)));
}
