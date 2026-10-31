// The theme switch: light or dark. The page follows the system (`color-scheme: light dark`)
// until a click stores a choice in localStorage; the head script applies a stored choice before
// the first paint. A click picks the opposite of what the page shows now. Every color is a
// `light-dark()` pair, the charts' too, so nothing is drawn again.
//
// The framework galleries run the same logic from galleries/shared/src/theme.ts.

const KEY = "d3set-theme";
const media = window.matchMedia("(prefers-color-scheme: dark)");

/** Whether the page shows dark colors now: the stored choice, else the system. */
function isDark() {
  const chosen = document.documentElement.dataset.theme;
  return chosen ? chosen === "dark" : media.matches;
}

function sync() {
  const button = document.getElementById("theme-switch");
  if (button) button.setAttribute("aria-pressed", String(isDark()));
}

export function themeSwitch() {
  sync();
  document.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("#theme-switch") : null;
    if (!button) return;
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage off (a private window): the choice lasts until the page closes.
    }
    sync();
  });
  // No choice stored: the page follows the system, and so does the button.
  media.addEventListener("change", sync);
}
