# Charts (Chart.js) & Diagrams (Mermaid) Dedicated Style Guide

Whenever an HTML report includes **Chart.js** charts or **Mermaid** diagrams, the agent MUST follow this dedicated style guide. Visuals must be responsive across all Tailwind breakpoints (`sm` through `2xl`), dynamically synchronize with all **32 DaisyUI themes**, and render cleanly in print/PDF export.

---

## 1. Universal DaisyUI Theme Color Resolver (`#rrggbb` & `rgba`)

DaisyUI v4 defines theme colors using modern `oklch(...)` CSS variables. While browsers render `oklch(...)` in CSS, **Mermaid's `themeVariables` parser** and some Canvas 2D operations require standard `#rrggbb` hex or `rgba(r, g, b, a)` strings.

Always include this lightweight resolver so every DaisyUI theme change converts semantic DaisyUI classes (`bg-primary`, `bg-secondary`, `bg-accent`, `bg-info`, `bg-success`, `bg-warning`, `bg-error`, `bg-base-100`, `bg-base-200`, `bg-base-300`, `text-base-content`) into universal `#rrggbb` and `rgba(...)` strings:

```javascript
function cssColorToHexAndRgba(cssColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = cssColor;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  const hex = "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return {
    hex,
    rgb: `rgb(${r}, ${g}, ${b})`,
    rgba: (alpha = 1) => `rgba(${r}, ${g}, ${b}, ${alpha})`
  };
}

function resolveDaisyUIThemePalette() {
  const probeContainer = document.createElement("div");
  probeContainer.style.cssText = "position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;";
  const roles = {
    primary: "bg-primary",
    secondary: "bg-secondary",
    accent: "bg-accent",
    neutral: "bg-neutral",
    base100: "bg-base-100",
    base200: "bg-base-200",
    base300: "bg-base-300",
    info: "bg-info",
    success: "bg-success",
    warning: "bg-warning",
    error: "bg-error"
  };

  const nodes = {};
  for (const [key, cls] of Object.entries(roles)) {
    const el = document.createElement("span");
    el.className = cls;
    probeContainer.appendChild(el);
    nodes[key] = el;
  }
  const textNode = document.createElement("span");
  textNode.className = "text-base-content";
  probeContainer.appendChild(textNode);

  document.body.appendChild(probeContainer);

  const palette = {};
  for (const [key, el] of Object.entries(nodes)) {
    palette[key] = cssColorToHexAndRgba(getComputedStyle(el).backgroundColor);
  }
  palette.content = cssColorToHexAndRgba(getComputedStyle(textNode).color);

  probeContainer.remove();
  return palette;
}
```

---

## 2. Chart.js Standards

### 2.1 Container & Sizing Rules (Preventing Overflow & Resize Loops)
1. **Never place a `<canvas>` directly inside a flex/grid item without a relative fixed-height wrapper.**
2. Always wrap `<canvas>` in `<div class="relative w-full h-72 sm:h-80">` and set `responsive: true, maintainAspectRatio: false`.
3. Add `break-inside-avoid` to the parent card so PDF/print export never splits a chart across pages.

```html
<div class="card bg-base-100 shadow-sm border border-base-300 break-inside-avoid">
  <div class="card-body p-4 sm:p-6">
    <h3 id="chart-revenue-heading" class="card-title text-base sm:text-lg scroll-mt-20">
      Quarterly Revenue & Margin Trend
    </h3>
    <p class="text-xs sm:text-sm opacity-75"> Figures in USD ($M) — Synchronized with active DaisyUI theme </p>
    <div class="relative w-full h-72 sm:h-80 mt-2">
      <canvas id="revenueChart" aria-label="Quarterly Revenue Chart" role="img"></canvas>
    </div>
  </div>
</div>
```

### 2.2 Palette, Typography & Theme Reactivity
1. Maintain a global `window.reportCharts = []` array of active Chart.js instances.
2. Bind datasets to `palette.primary`, `palette.secondary`, `palette.accent`, `palette.info`, `palette.success`, and `palette.warning`.
3. Set axis tick colors to `palette.content.rgba(0.8)` and grid lines to `palette.content.rgba(0.12)`.
4. Whenever the user changes the DaisyUI theme in the navbar, call `updateChartsForTheme(palette)` and invoke `chart.update('none')` so every chart updates immediately without jarring re-entry animations.

```javascript
function applyThemeToCharts(palette) {
  if (!window.reportCharts) return;
  const seriesColors = [
    palette.primary,
    palette.secondary,
    palette.accent,
    palette.info,
    palette.success,
    palette.warning
  ];

  for (const chart of window.reportCharts) {
    chart.data.datasets.forEach((ds, idx) => {
      const color = seriesColors[idx % seriesColors.length];
      if (ds.type === "line" || chart.config.type === "line") {
        ds.borderColor = color.hex;
        ds.backgroundColor = color.rgba(0.2);
        ds.pointBackgroundColor = color.hex;
      } else {
        ds.backgroundColor = color.rgba(0.82);
        ds.borderColor = color.hex;
        ds.borderWidth = 1.5;
        ds.borderRadius = 6;
      }
    });

    if (chart.options.scales) {
      for (const scale of Object.values(chart.options.scales)) {
        if (scale.ticks) scale.ticks.color = palette.content.rgba(0.8);
        if (scale.grid) scale.grid.color = palette.content.rgba(0.12);
        if (scale.title) scale.title.color = palette.content.rgba(0.9);
      }
    }
    if (chart.options.plugins?.legend?.labels) {
      chart.options.plugins.legend.labels.color = palette.content.hex;
    }
    chart.update("none");
  }
}
```

---

## 3. Mermaid Diagram Standards

### 3.1 Container & Readability Rules
1. Wrap every `.mermaid` block inside a responsive, scrollable card container (`overflow-x-auto flex justify-center p-4 bg-base-200/50 rounded-box break-inside-avoid`) so wide diagrams never cause horizontal page overflow at `640px` (`sm`).
2. Keep node labels concise (max 4–6 words per node) and quote labels containing parentheses or special characters (`A["Ingestion Service (v2)"]`).
3. Prefer `flowchart LR` or `flowchart TD` with at most 12 nodes per diagram for clarity.

### 3.2 Dynamic DaisyUI Theme Re-Rendering for Mermaid
Before running `mermaid.run()` for the first time, store the raw Mermaid definition in `el.dataset.mermaidSource = el.textContent.trim()`. When the DaisyUI theme changes:
1. Restore each element's raw source (`el.removeAttribute("data-processed"); el.textContent = el.dataset.mermaidSource;`).
2. Re-initialize `mermaid.initialize({ startOnLoad: false, theme: "base", themeVariables: { ... } })` using `#rrggbb` hex values from `resolveDaisyUIThemePalette()`.
3. Call `await mermaid.run({ querySelector: ".mermaid" })`.

```javascript
async function renderMermaidWithTheme(palette) {
  if (!window.mermaid) return;
  const mermaidNodes = document.querySelectorAll(".mermaid");
  if (!mermaidNodes.length) return;

  mermaidNodes.forEach((node) => {
    if (!node.dataset.mermaidSource) {
      node.dataset.mermaidSource = node.textContent.trim();
    }
    node.removeAttribute("data-processed");
    node.innerHTML = node.dataset.mermaidSource;
  });

  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: "base",
    themeVariables: {
      background: palette.base100.hex,
      primaryColor: palette.base200.hex,
      primaryTextColor: palette.content.hex,
      primaryBorderColor: palette.primary.hex,
      secondaryColor: palette.base300.hex,
      secondaryTextColor: palette.content.hex,
      secondaryBorderColor: palette.secondary.hex,
      tertiaryColor: palette.base100.hex,
      tertiaryTextColor: palette.content.hex,
      tertiaryBorderColor: palette.accent.hex,
      lineColor: palette.primary.hex,
      textColor: palette.content.hex,
      mainBkg: palette.base200.hex,
      nodeBorder: palette.primary.hex,
      clusterBkg: palette.base200.hex,
      clusterBorder: palette.secondary.hex,
      titleColor: palette.content.hex,
      edgeLabelBackground: palette.base100.hex
    }
  });

  await window.mermaid.run({ querySelector: ".mermaid" });
}
```

---

## 4. Print & PDF Export Checklist for Visuals

- Listen for `window.addEventListener("beforeprint", () => window.reportCharts?.forEach(c => c.resize()))` so Chart.js canvases fit A4/Letter print margins cleanly.
- Ensure `.mermaid svg` has `max-width: 100%; height: auto;` so vector diagrams scale cleanly inside PDF pages.
