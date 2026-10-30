"use client";

import { Dashboard, useSseSource } from "@d3set/next";
import { charts, filters } from "../../lib/sales";

export function LiveDashboard() {
  const source = useSseSource("/api/sales");
  return source ? <Dashboard charts={charts} filters={filters} source={source} /> : null;
}
