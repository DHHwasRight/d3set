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
    /** Low and high ends of the scale for continuous values (heatmap, gauge). */
    sequential: [string, string];
  };
  space: { xs: number; sm: number; md: number; lg: number };
  radius: number;
  /** Transition length in ms. Set 0 to disable animation. */
  motion: number;
}

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
  space: { xs: 4, sm: 8, md: 16, lg: 24 },
  radius: 6,
  motion: 250,
};

export const darkTheme: Theme = {
  ...lightTheme,
  name: "dark",
  color: {
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
  },
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
    space: { ...base.space, ...overrides.space },
  } as Theme;
}

/** Map a theme to CSS custom properties (`--d3s-*`). */
export function themeToCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {
    "--d3s-font": theme.font.family,
    "--d3s-font-axis": `${theme.font.sizeAxis}px`,
    "--d3s-font-label": `${theme.font.sizeLabel}px`,
    "--d3s-font-title": `${theme.font.sizeTitle}px`,
    "--d3s-bg": theme.color.background,
    "--d3s-surface": theme.color.surface,
    "--d3s-text": theme.color.text,
    "--d3s-text-muted": theme.color.textMuted,
    "--d3s-grid": theme.color.grid,
    "--d3s-axis": theme.color.axis,
    "--d3s-accent": theme.color.accent,
    "--d3s-positive": theme.color.positive,
    "--d3s-warning": theme.color.warning,
    "--d3s-negative": theme.color.negative,
    "--d3s-radius": `${theme.radius}px`,
    "--d3s-space-sm": `${theme.space.sm}px`,
    "--d3s-space-md": `${theme.space.md}px`,
  };
  theme.color.series.forEach((c, i) => (vars[`--d3s-series-${i}`] = c));
  return vars;
}

export function applyTheme(el: HTMLElement, theme: Theme): void {
  for (const [k, v] of Object.entries(themeToCssVars(theme))) el.style.setProperty(k, v);
  el.dataset.d3sTheme = theme.name;
}
