// d3set for Next.js, client side: use in Client Components ("use client" files), or render these
// from Server Components as client islands. Server rendering is in "@d3set/next/server".
export {
  Chart,
  Dashboard,
  Hydrate,
  useSseSource,
  useStreamSource,
  type ChartProps,
  type DashboardProps,
  type HydrateProps,
} from "@d3set/react";
export { useSseSource as useLiveRows } from "@d3set/react";
