// The source files the docs show, highlighted by the `snippets` Vite plugin.
declare module "virtual:snippets" {
  const snippets: import("@d3set/gallery-shared/docs").Snippets;
  export default snippets;
}

/** `GALLERY_LIBRARIES` when the gallery was built: where the other galleries run. */
declare const __GALLERY_LIBRARIES__: string;

/** Where the gallery is published and where its data is (site.ts), from the build's environment. */
declare const __GALLERY_SITE__: import("@d3set/gallery-shared/site").Site;
