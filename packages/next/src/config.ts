// `next.config` setup for d3set.
//
//   // next.config.mjs
//   import { withD3set } from "@d3set/next/config";
//   export default withD3set({});

/** The part of a Next.js config this helper sets; the rest passes through. */
export interface NextConfigLike {
  serverExternalPackages?: string[];
  [key: string]: unknown;
}

/**
 * Server rendering runs the charts against linkedom, a server-side DOM. It stays a Node.js
 * package, loaded at runtime rather than bundled into the server build.
 */
export function withD3set<T extends NextConfigLike>(config: T = {} as T): T {
  const external = new Set([...(config.serverExternalPackages ?? []), "linkedom"]);
  return { ...config, serverExternalPackages: [...external] };
}
