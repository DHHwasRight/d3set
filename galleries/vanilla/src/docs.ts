// The parts of the pages this gallery writes itself (see galleries/shared/src/docs.ts). The code
// blocks show the files in `snippets/`: the code that draws every chart of this gallery.
import type { Docs } from "@d3set/gallery-shared/docs";

const DIR = "galleries/vanilla/src/snippets";

const parts: Docs["parts"] = {
  mode: [
    { badge: "Client" },
    { text: " Drawn in the browser from the spec and rows of the page. No server rendering." },
  ],
  feed: [],
  rendered: [{ text: ", drawn in the browser" }],
  intro: [
    { h1: "Charts drawn in the browser, in plain TypeScript" },
    {
      lead: "Every chart on these pages is drawn in the browser by `d3set/core`, from the same specs and rows as the Rust gallery. No server rendering and no framework: a page loads the code of the chart types it shows, and only those.",
    },
    {
      modes: [
        { tag: "1 · Spec", title: "One JSON spec", text: "Each chart is a spec and rows, the same in every gallery." },
        {
          tag: "2 · Draw",
          title: "Into an element",
          text: "`createChart` and `createDashboard` draw into any element.",
        },
        {
          tag: "3 · Load",
          title: "Only what a page uses",
          text: "`d3set/lazy` loads each chart type as a chunk of its own.",
        },
      ],
    },
  ],
  guide: [
    { h2: "1. Draw a chart" },
    {
      p: "`createChart` draws one chart in an element and returns a handle: `setTheme`, `destroy`. This is the function that draws every chart of this gallery.",
    },
    { code: `${DIR}/chart.ts` },
    { h2: "2. Draw a dashboard" },
    {
      p: "A dashboard draws its charts from one source of rows. Its filters, cross-filtering, brush zoom, and time window apply to all of them.",
    },
    { code: `${DIR}/dashboard.ts` },
    { h2: "3. Load only the chart types a page draws" },
    {
      p: "`d3set` registers every chart type. `d3set/core` registers none, and `d3set/lazy` loads them one chunk each, when a page first shows one.",
    },
    { code: `${DIR}/load.ts` },
  ],
  chart: [
    {
      section: {
        title: "Client code",
        note: "The function that draws every chart of this page, in the browser, from the spec above.",
        code: `${DIR}/chart.ts`,
      },
    },
  ],
};

export const docs: Docs = { title: "d3set · charts drawn in the browser", parts };
