import type { Page } from "@d3set/gallery-shared";
import { fill } from "@d3set/gallery-shared/docs";
import { followLibrarySwitch, markLibrary, parseLibraries } from "@d3set/gallery-shared/libraries";
import snippets from "virtual:snippets";
import { docs } from "./docs";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { preload } from "react-dom";
import { applyHead, loadPage, normalize } from "./fixtures";
import { interceptLinks, useLocation } from "./router";
import { countDrawn, Drawn, render } from "./Tree";

/** Where the other galleries run, for the library switch. */
const libraries = parseLibraries(__GALLERY_LIBRARIES__);

/** Tell the conformity tests (and anyone waiting) whether the current page is fully drawn. */
function setReady(ready: boolean) {
  document.documentElement.dataset.galleryReady = String(ready);
}

/** The gallery: the page of the current URL. */
export function App() {
  const path = normalize(useLocation().pathname);
  // `undefined` while the first page loads; `page: undefined` for a path the gallery lacks.
  const [shown, setShown] = useState<{ key: string; page?: Page }>();

  useEffect(() => interceptLinks(), []);
  useEffect(() => followLibrarySwitch(libraries), []);

  useEffect(() => {
    let alive = true;
    setReady(false);
    void (async () => {
      const page = await loadPage(path);
      if (page) await applyHead(page);
      // The previous page, and its charts, unmount when the new one replaces it.
      // The parts of the page this gallery writes itself: its own code, and the words about it.
      if (alive)
        setShown({
          key: path,
          page: page && { ...page, body: markLibrary(fill(page.body, docs, snippets), "react", libraries, page.path) },
        });
    })();
    return () => {
      alive = false;
    };
  }, [path]);

  if (!shown) return null;
  return shown.page ? <PageView key={shown.key} page={shown.page} /> : <NotFound />;
}

/** One page. Ready once every chart and dashboard in it has drawn its first frame. */
function PageView({ page }: { page: Page }) {
  const expected = useMemo(() => countDrawn(page.body), [page]);
  const drawn = useRef(0);
  for (const href of page.preload) preload(href, { as: "font", type: "font/woff2", crossOrigin: "" });

  // Braces: `scrollTo` returns a promise in recent Chrome, and an effect may return only a cleanup.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Drawn without entry transitions (`animate={false}`): the last `onReady` is the final frame.
  const onDrawn = useCallback(() => {
    if (++drawn.current === expected) setReady(true);
  }, [expected]);
  useEffect(() => {
    if (expected === 0) setReady(true);
  }, [expected]);

  return <Drawn value={onDrawn}>{render(page.body)}</Drawn>;
}

function NotFound() {
  useEffect(() => {
    document.title = "Not found · d3set";
    setReady(true);
  }, []);
  return (
    <main className="main">
      <article className="page">
        <h1>Not found</h1>
        <p>
          The gallery has no page here. <a href="/">Back to the overview</a>.
        </p>
      </article>
    </main>
  );
}
