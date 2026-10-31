// The theme switch of the framework galleries: the same logic as the Rust gallery's
// `assets/js/_src/theme.js`, with the same storage key, so the choice follows the library switch
// on one origin (GitHub Pages).
//
// The page follows the system (`color-scheme: light dark` in gallery.css) until a click stores a
// choice. THEME_SCRIPT, at the top of <head>, applies a stored choice before the first paint.
// Every color is a `light-dark()` pair, the charts' too, so a change draws nothing again.

const KEY = "d3set-theme";

/** The head script: the stored choice on `<html data-theme>`, before the first paint. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/** Whether the page shows dark colors now: the stored choice, else the system. */
function isDark(): boolean {
  const chosen = document.documentElement.dataset.theme;
  return chosen ? chosen === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}

/** `aria-pressed` of the switch, after a page drew a new top bar or the system changed. */
export function syncThemeSwitch(): void {
  document.getElementById("theme-switch")?.setAttribute("aria-pressed", String(isDark()));
}

/** Handle clicks on `#theme-switch`, wherever the page draws it. Returns the cleanup. */
export function followThemeSwitch(): () => void {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const onClick = (event: MouseEvent) => {
    const button = event.target instanceof Element ? event.target.closest("#theme-switch") : null;
    if (!button) return;
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage off (a private window): the choice lasts until the page closes.
    }
    syncThemeSwitch();
  };
  document.addEventListener("click", onClick);
  media.addEventListener("change", syncThemeSwitch);
  syncThemeSwitch();
  return () => {
    document.removeEventListener("click", onClick);
    media.removeEventListener("change", syncThemeSwitch);
  };
}
