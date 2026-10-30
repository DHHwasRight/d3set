import type { Metadata } from "next";
import type { ReactNode } from "react";
import { readPage } from "../lib/fixtures";
import { parseLibraries } from "@d3set/gallery-shared/libraries";
import { FollowLibrarySwitch, Ready } from "./Ready";

export const metadata: Metadata = { icons: { icon: { url: "/favicon.svg", type: "image/svg+xml" } } };

/**
 * The shell of every page: the shared stylesheets and the `<body>` attributes. They are the same on
 * every page, so the overview's are used. `headStyle` and `preload` are empty in the Original
 * design; they are kept so the layout follows the export.
 */
export default function Layout({ children }: { children: ReactNode }) {
  const { bodyAttrs, headStyle, preload } = readPage("/");
  return (
    <html lang="en">
      <head>
        {preload.map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="" />
        ))}
        {headStyle && <style dangerouslySetInnerHTML={{ __html: headStyle }} />}
        <link rel="stylesheet" href="/css/d3set.css" />
        <link rel="stylesheet" href="/css/gallery.css" />
      </head>
      <body {...bodyAttrs}>
        {children}
        <Ready />
        <FollowLibrarySwitch bases={parseLibraries(process.env.GALLERY_LIBRARIES)} />
      </body>
    </html>
  );
}
