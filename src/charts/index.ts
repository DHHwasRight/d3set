import { barChart } from "./bar";
import { kpiChart } from "./kpi";
import { lineChart } from "./line";
import { registerChart } from "./registry";

registerChart("line", lineChart);
registerChart("bar", barChart);
registerChart("kpi", kpiChart);

export { barChart, kpiChart, lineChart };
export { getChart, registerChart } from "./registry";
export type * from "./types";
