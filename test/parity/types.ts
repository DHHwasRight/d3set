import type { ChartSpec, Row } from "../../src/index";

/** Parity cases by name. `rows` defaults to `sampleRows`; `width` defaults to 400. */
export type Cases = Record<string, { spec: ChartSpec; rows?: Row[]; width?: number }>;
