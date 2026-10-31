import { describe, expect, it } from "vitest";
import { hydrate, lightTheme } from "../src/index";

const rows = [
  { region: "EU", amount: 10 },
  { region: "US", amount: 30 },
];

const payload = (p: unknown) => `<script type="application/json" class="d3s-payload">${JSON.stringify(p)}</script>`;

describe("hydrate", () => {
  it("replaces a server-rendered dashboard with live charts, using the server's theme", () => {
    const host = document.createElement("div");
    const theme = { ...lightTheme, name: "brand", color: { ...lightTheme.color, accent: "#635bff" } };
    host.innerHTML = `
      <div class="d3s-root" data-d3s-dashboard>
        <div class="d3s-grid"><section class="d3s-card"><p class="ssr">server markup</p></section></div>
        ${payload({
          theme,
          rows,
          charts: [
            { type: "kpi", y: "amount" },
            { type: "bar", x: "region", y: "amount" },
          ],
        })}
      </div>`;
    const h = hydrate(host);
    expect(h.dashboards).toHaveLength(1);
    expect(host.querySelector(".ssr")).toBeNull();
    expect(host.querySelector(".d3s-kpi-value")!.textContent).toBe("40");
    expect(host.querySelectorAll(".d3s-plot rect")).toHaveLength(2);
    const root = host.querySelector<HTMLElement>(".d3s-root")!;
    // The server's accent in light mode, the default dark accent in dark mode.
    expect(root.style.getPropertyValue("--d3s-accent")).toBe("light-dark(#635bff, #818cf8)");
    expect(root.hasAttribute("data-d3s-dashboard")).toBe(false);
    h.destroy();
  });

  it("hydrates a single figure and leaves an element without payload static", () => {
    const host = document.createElement("div");
    host.innerHTML = `
      <figure data-d3s-chart><div class="d3s-chart">ssr</div>${payload({ spec: { type: "kpi", y: "amount" }, rows })}</figure>
      <figure data-d3s-chart><div class="d3s-chart static">static</div></figure>`;
    const h = hydrate(host);
    expect(h.charts).toHaveLength(1);
    expect(host.querySelector(".d3s-kpi-value")!.textContent).toBe("40");
    expect(host.querySelector(".static")!.textContent).toBe("static");
  });
});
