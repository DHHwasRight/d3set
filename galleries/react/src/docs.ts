// The parts of the pages this gallery writes itself (see galleries/shared/src/docs.ts). The code
// blocks show the files in `snippets/`: the components that draw every chart of this gallery.
import type { Docs } from "@d3set/gallery-shared/docs";

const DIR = "galleries/react/src/snippets";

const parts: Docs["parts"] = {
  mode: [
    { badge: "Client" },
    { text: " Drawn in the browser by `<Chart>`, from the spec and rows of the page. No server rendering." },
  ],
  feed: [],
  rendered: [{ text: ", drawn in the browser by React" }],
  intro: [
    { h1: "Charts as React components" },
    {
      lead: "Every chart on these pages is a `<Chart>` or a `<Dashboard>` from `@d3set/react`, drawn in the browser from the same specs and rows as the Rust gallery. The components wrap the TypeScript library: a new spec draws a new chart, new rows update it in place.",
    },
    {
      modes: [
        { tag: "1 · Spec", title: "One JSON spec", text: "Each chart is a spec and rows, the same in every gallery." },
        { tag: "2 · Chart", title: "`<Chart>`", text: "One chart from a spec and rows. New rows update it in place." },
        { tag: "3 · Dashboard", title: "`<Dashboard>`", text: "Charts that share rows, filters, and a time window." },
      ],
    },
  ],
  guide: [
    { h2: "1. Draw a chart" },
    {
      p: "`<Chart>` draws one chart and removes it on unmount. This is the component that draws every chart of this gallery.",
    },
    { code: `${DIR}/GalleryChart.tsx` },
    { h2: "2. Draw a dashboard" },
    {
      p: "`<Dashboard>` draws its charts from one source of rows. Its filters, cross-filtering, brush zoom, and time window apply to all of them.",
    },
    { code: `${DIR}/GalleryDashboard.tsx` },
  ],
  chart: [
    {
      section: {
        title: "Component",
        note: "The component that draws every chart of this page, in the browser, from the spec above.",
        code: `${DIR}/GalleryChart.tsx`,
      },
    },
  ],
};

export const docs: Docs = { title: "d3set · React components", parts };
