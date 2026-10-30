// The source files the docs show, highlighted by the `snippets` Vite plugin.
declare module "virtual:snippets" {
  const snippets: import("@d3set/gallery-shared/docs").Snippets;
  export default snippets;
}

/** `GALLERY_LIBRARIES` when the gallery was built: where the other galleries run. */
declare const __GALLERY_LIBRARIES__: string;
