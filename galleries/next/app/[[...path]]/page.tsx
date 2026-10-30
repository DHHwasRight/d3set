import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fill } from "@d3set/gallery-shared/docs";
import { markLibrary, parseLibraries } from "@d3set/gallery-shared/libraries";
import { siteFromEnv, withBase, withStreams } from "@d3set/gallery-shared/site";
import { docs, snippets } from "../../lib/docs";
import { PATHS, readPage, toPath, toSegments } from "../../lib/fixtures";
import { render } from "../../lib/render";

interface Props {
  params: Promise<{ path?: string[] }>;
}

// Every page is drawn at build time: the rows are fixed, so are the charts. Other paths are 404.
export const dynamicParams = false;
export function generateStaticParams() {
  return PATHS.map((path) => ({ path: toSegments(path) }));
}

async function page({ params }: Props) {
  const path = toPath((await params).path);
  if (!PATHS.includes(path)) notFound();
  return readPage(path);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  await page(props);
  return { title: docs.title };
}

/** A page of the gallery: its exported tree, charts and dashboards drawn by Server Components. */
export default async function Page(props: Props) {
  // The parts of the page this gallery writes itself: its own code, and the words about it.
  const { body, path } = await page(props);
  // The library switch: this gallery's item current, each link to this page in its gallery.
  const libraries = parseLibraries(process.env.GALLERY_LIBRARIES);
  // The links under this gallery's prefix, and the charts' data where the site keeps it (site.ts).
  const site = siteFromEnv(process.env);
  const own = withStreams(withBase(fill(body, docs, await snippets()), site.base), site.data);
  return markLibrary(own, "next", libraries, path).map(render);
}
