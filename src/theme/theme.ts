/**
 * Design tokens for every chart. A theme is plain data: the library maps it
 * to CSS custom properties on the host element, so host apps can also
 * override any token with their own CSS.
 */
export interface Theme {
  name: string;
  font: { family: string; sizeAxis: number; sizeLabel: number; sizeTitle: number };
  color: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    grid: string;
    axis: string;
    accent: string;
    /** Status colors: good changes and `ok`, `warning`, bad changes and `critical`. */
    positive: string;
    warning: string;
    negative: string;
    /** Categorical palette, used in order for series. */
    series: string[];
    /** Fixed colors for series by name, such as `{ Churn: "#dc3309" }`. Other series take `series` in order. */
    named?: Record<string, string>;
    /** Low and high ends of the scale for continuous values (heatmap, gauge). */
    sequential: [string, string];
  };
  /**
   * Colors in dark mode. Each color var is then `light-dark(<color>, <dark>)`, so a chart follows
   * the page's CSS `color-scheme` with no redraw. A color it leaves out stays the same in both.
   * `lightTheme` takes `darkTheme`'s colors.
   */
  dark?: Partial<Theme["color"]>;
  space: { xs: number; sm: number; md: number; lg: number };
  radius: number;
  /** Transition length in ms. Set 0 to disable animation. */
  motion: number;
}

/** The colors of `darkTheme`: also the dark mode of `lightTheme`. */
const darkColors: Theme["color"] = {
  background: "#111114",
  surface: "#1b1b20",
  text: "#ececf1",
  textMuted: "#9a9aa5",
  grid: "#2a2a31",
  axis: "#5c5c66",
  accent: "#818cf8",
  positive: "#34d399",
  warning: "#fbbf24",
  negative: "#f87171",
  series: ["#818cf8", "#38bdf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#94a3b8"],
  sequential: ["#1e1b4b", "#a5b4fc"],
};

export const lightTheme: Theme = {
  name: "light",
  font: {
    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    sizeAxis: 11,
    sizeLabel: 12,
    sizeTitle: 14,
  },
  color: {
    background: "#ffffff",
    surface: "#f7f7f8",
    text: "#1a1a1f",
    textMuted: "#6b6b76",
    grid: "#e6e6ea",
    axis: "#9a9aa5",
    accent: "#4f46e5",
    positive: "#059669",
    warning: "#d97706",
    negative: "#dc2626",
    series: ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#64748b"],
    sequential: ["#eef2ff", "#3730a3"],
  },
  dark: darkColors,
  space: { xs: 4, sm: 8, md: 16, lg: 24 },
  radius: 6,
  motion: 250,
};

/** Always dark, whatever the page's `color-scheme`. */
export const darkTheme: Theme = {
  ...lightTheme,
  name: "dark",
  color: darkColors,
  dark: undefined,
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K];
};

/** Build a theme from a base and a partial override. */
export function createTheme(overrides: DeepPartial<Theme>, base: Theme = lightTheme): Theme {
  return {
    ...base,
    ...overrides,
    font: { ...base.font, ...overrides.font },
    color: { ...base.color, ...overrides.color } as Theme["color"],
    dark: overrides.dark ? ({ ...base.dark, ...overrides.dark } as Theme["dark"]) : base.dark,
    space: { ...base.space, ...overrides.space },
  } as Theme;
}

/** `light-dark(light, dark)`, or `light` alone when dark mode keeps it. */
export function lightDark(light: string, dark: string | undefined): string {
  return dark === undefined || dark === light ? light : `light-dark(${light}, ${dark})`;
}

/**
 * Map a theme to CSS custom properties (`--d3s-*`). With `theme.dark`, each color is
 * `light-dark(light, dark)`: the page's CSS `color-scheme` picks one.
 */
export function themeToCssVars(theme: Theme): Record<string, string> {
  const c = theme.color;
  const d = theme.dark ?? {};
  const vars: Record<string, string> = {
    "--d3s-font": theme.font.family,
    "--d3s-font-axis": `${theme.font.sizeAxis}px`,
    "--d3s-font-label": `${theme.font.sizeLabel}px`,
    "--d3s-font-title": `${theme.font.sizeTitle}px`,
    "--d3s-bg": lightDark(c.background, d.background),
    "--d3s-surface": lightDark(c.surface, d.surface),
    "--d3s-text": lightDark(c.text, d.text),
    "--d3s-text-muted": lightDark(c.textMuted, d.textMuted),
    "--d3s-grid": lightDark(c.grid, d.grid),
    "--d3s-axis": lightDark(c.axis, d.axis),
    "--d3s-accent": lightDark(c.accent, d.accent),
    "--d3s-positive": lightDark(c.positive, d.positive),
    "--d3s-warning": lightDark(c.warning, d.warning),
    "--d3s-negative": lightDark(c.negative, d.negative),
    "--d3s-radius": `${theme.radius}px`,
    "--d3s-space-sm": `${theme.space.sm}px`,
    "--d3s-space-md": `${theme.space.md}px`,
  };
  c.series.forEach((s, i) => (vars[`--d3s-series-${i}`] = lightDark(s, d.series?.[i])));
  for (const [name, s] of Object.entries(c.named ?? {})) vars[namedVar(name)] = lightDark(s, d.named?.[name]);
  vars["--d3s-seq-0"] = lightDark(c.sequential[0], d.sequential?.[0]);
  vars["--d3s-seq-1"] = lightDark(c.sequential[1], d.sequential?.[1]);
  return vars;
}

/**
 * FNV-1a 32-bit over the UTF-16 code units of `s` (what `charCodeAt` gives), as 8 hex digits.
 * The server renderer computes the same hash, so ids and names made from it match.
 */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** The custom property of a series the theme names (`color.named`): `--d3s-named-<fnv1a(name)>`. */
export function namedVar(name: string): string {
  return `--d3s-named-${fnv1a(name)}`;
}

export function applyTheme(el: HTMLElement, theme: Theme): void {
  for (const [k, v] of Object.entries(themeToCssVars(theme))) el.style.setProperty(k, v);
  el.dataset.d3sTheme = theme.name;
}
