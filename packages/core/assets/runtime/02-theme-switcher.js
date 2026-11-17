/**
 * Resolves any valid CSS color string (including oklch, color-mix, rgb, hsl, hex)
 * into a strict 8-bit hex string and rgba generator via an offscreen 2D canvas.
 */
function cssColorToHexAndRgba(colorStr, customCtx = null) {
  if (!colorStr) {
    return { hex: "#3b82f6", r: 59, g: 130, b: 246, a: 1, rgba: (a = 1) => `rgba(59, 130, 246, ${a})` };
  }

  try {
    let ctx = customCtx;
    if (!ctx && typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      ctx = canvas.getContext("2d", { willReadFrequently: true });
    }

    if (ctx) {
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, aRaw] = ctx.getImageData(0, 0, 1, 1).data;
      const a = aRaw / 255;
      const hex = "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
      return {
        hex,
        r,
        g,
        b,
        a,
        rgba: (alpha = a) => `rgba(${r}, ${g}, ${b}, ${alpha})`
      };
    }
  } catch (_) {}

  // Fallback if canvas is unavailable or failed
  return { hex: "#3b82f6", r: 59, g: 130, b: 246, a: 1, rgba: (alpha = 1) => `rgba(59, 130, 246, ${alpha})` };
}

/**
 * Resolves active DaisyUI semantic palette tokens (primary, secondary, accent, neutral, base, content)
 * into deterministic hex/rgba colors.
 */
function resolveDaisyUIThemePalette(doc = (typeof document !== "undefined" ? document : null)) {
  if (!doc || !doc.body || typeof doc.body.appendChild !== "function") return {};

  const probeContainer = doc.createElement("div");
  probeContainer.style.cssText = "position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;";
  const roles = {
    primary: "bg-primary",
    secondary: "bg-secondary",
    accent: "bg-accent",
    neutral: "bg-neutral",
    base100: "bg-base-100",
    base200: "bg-base-200",
    base300: "bg-base-300"
  };

  const nodes = {};
  for (const [key, cls] of Object.entries(roles)) {
    const el = doc.createElement("span");
    el.className = cls;
    probeContainer.appendChild(el);
    nodes[key] = el;
  }
  const textNode = doc.createElement("span");
  textNode.className = "text-base-content";
  probeContainer.appendChild(textNode);
  doc.body.appendChild(probeContainer);

  const palette = {};
  const getStyle = (typeof window !== "undefined" && window.getComputedStyle) ? window.getComputedStyle : () => ({ backgroundColor: "#3b82f6", color: "#1f2937" });

  for (const [key, el] of Object.entries(nodes)) {
    palette[key] = cssColorToHexAndRgba(getStyle(el).backgroundColor);
  }
  palette.content = cssColorToHexAndRgba(getStyle(textNode).color);
  probeContainer.remove();
  return palette;
}

/**
 * Sanitizes Mermaid diagram source code to defend against Mermaid 11.4 markdown list parser bugs.
 * Disallows starting subgraph or node titles with numbered list tokens (e.g. `1. `, `2. `).
 */
function sanitizeMermaidSource(source) {
  if (!source || typeof source !== "string") return "";

  // 1. Replace numbered list pattern in subgraphs: e.g. subgraph ["1. Title"] or subgraph sub1 ["1. Title"]
  let sanitized = source.replace(
    /(subgraph\s+(?:[a-zA-Z0-9_-]+\s*)?\[\s*")(\d+)\.\s+/g,
    "$1Step $2 - "
  );

  // 2. Replace numbered list pattern in unquoted subgraphs: e.g. subgraph 1. Title
  sanitized = sanitized.replace(
    /(subgraph\s+)(\d+)\.\s+/g,
    "$1Step $2 - "
  );

  // 3. Replace numbered list tokens in bracketed nodes: e.g. ["1. Step Description"]
  sanitized = sanitized.replace(
    /(\[\s*")(\d+)\.\s+/g,
    "$1Step $2 - "
  );

  // 4. Replace numbered list tokens in unquoted node brackets: e.g. [1. Step Description]
  sanitized = sanitized.replace(
    /(\[\s*)(\d+)\.\s+/g,
    "$1Step $2 - "
  );

  return sanitized;
}

/**
 * Dynamic Mermaid theme re-rendering synced with DaisyUI theme palette.
 */
async function renderMermaidWithTheme(palette) {
  if (typeof window === "undefined" || !window.mermaid) return;
  const mermaidNodes = document.querySelectorAll(".mermaid");
  if (!mermaidNodes.length) return;

  mermaidNodes.forEach((node) => {
    if (!node.dataset.mermaidSource) {
      node.dataset.mermaidSource = node.textContent.trim();
    }
    node.removeAttribute("data-processed");
    node.textContent = sanitizeMermaidSource(node.dataset.mermaidSource);
  });

  const base100 = palette.base100 ? palette.base100.hex : "#ffffff";
  const base200 = palette.base200 ? palette.base200.hex : "#f3f4f6";
  const base300 = palette.base300 ? palette.base300.hex : "#e5e7eb";
  const content = palette.content ? palette.content.hex : "#1f2937";
  const primary = palette.primary ? palette.primary.hex : "#3b82f6";
  const secondary = palette.secondary ? palette.secondary.hex : "#6b7280";
  const accent = palette.accent ? palette.accent.hex : "#10b981";

  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: "base",
    themeVariables: {
      background: base100,
      primaryColor: base200,
      primaryTextColor: content,
      primaryBorderColor: primary,
      secondaryColor: base300,
      secondaryTextColor: content,
      secondaryBorderColor: secondary,
      tertiaryColor: base100,
      tertiaryTextColor: content,
      tertiaryBorderColor: accent,
      lineColor: primary,
      textColor: content,
      mainBkg: base100,
      nodeBorder: primary,
      clusterBkg: base200,
      clusterBorder: base300,
      titleColor: content,
      edgeLabelBackground: base200,
      nodeTextColor: content
    }
  });

  try {
    await window.mermaid.run({ querySelector: ".mermaid" });
  } catch (err) {
    console.warn("[html-report] Mermaid render notice:", err);
  }
  try {
    if (typeof HTMLReportMermaid !== "undefined") HTMLReportMermaid.initEnlarge();
  } catch (_) {}
}

/**
 * Builds a single DaisyUI theme swatch row button matching the navbar picker.
 */
function createThemeSwatchButton(theme, currentTheme, { attrName = "data-set-theme", onSelect } = {}) {
  const isCustom = !STANDARD_DAISYUI_THEMES.has(theme);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("data-theme", theme);
  btn.setAttribute(attrName, theme);
  btn.className = "theme-swatch-item outline-base-content text-start outline-offset-4 rounded-btn w-full cursor-pointer font-sans";
  btn.innerHTML = `
    <span class="bg-base-100 rounded-btn text-base-content block w-full cursor-pointer font-sans border border-base-300 hover:border-primary transition">
      <span class="grid grid-cols-5 grid-rows-3">
        <span class="col-span-5 row-span-3 row-start-1 flex items-center gap-2 px-3 py-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="theme-check h-3.5 w-3.5 shrink-0 ${theme === currentTheme ? "opacity-100" : "opacity-0"}">
            <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"></path>
          </svg>
          <span class="flex-grow text-xs font-semibold capitalize flex items-center gap-1.5">
            <span>${theme}</span>
            ${isCustom ? '<span class="badge badge-primary badge-outline text-3xs px-1 py-0 h-4">custom</span>' : ''}
          </span>
          <span class="flex h-full shrink-0 flex-wrap gap-1" data-swatch-preview="${theme}">
            <span class="bg-primary rounded-badge w-2 h-4"></span>
            <span class="bg-secondary rounded-badge w-2 h-4"></span>
            <span class="bg-accent rounded-badge w-2 h-4"></span>
            <span class="bg-neutral rounded-badge w-2 h-4"></span>
          </span>
        </span>
      </span>
    </span>
  `;
  btn.addEventListener("click", () => {
    if (typeof onSelect === "function") onSelect(theme);
    else setReportTheme(theme);
  });
  return btn;
}

/**
 * Initializes the 32 DaisyUI theme color swatch picker dropdown.
 */
function initThemeDropdown() {
  if (typeof document === "undefined") return;
  const listEl = document.getElementById("theme-swatch-list");
  if (!listEl) return;
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  const activeLabel = document.getElementById("active-theme-label");
  if (activeLabel) activeLabel.textContent = currentTheme;
  const modalActiveLabel = document.getElementById("modal-active-theme-label");
  if (modalActiveLabel) modalActiveLabel.textContent = currentTheme;
  listEl.innerHTML = "";

  DAISYUI_THEMES.forEach((theme) => {
    listEl.appendChild(createThemeSwatchButton(theme, currentTheme, {
      attrName: "data-set-theme",
      onSelect: (t) => setReportTheme(t)
    }));
  });
}

/**
 * Sets active DaisyUI theme dynamically and updates charts/Mermaid.
 */
async function setReportTheme(themeName) {
  if (!DAISYUI_THEMES.includes(themeName)) return;
  if (typeof document === "undefined") return;

  document.documentElement.setAttribute("data-theme", themeName);
  const activeLabel = document.getElementById("active-theme-label");
  if (activeLabel) activeLabel.textContent = themeName;
  const modalActiveLabel = document.getElementById("modal-active-theme-label");
  if (modalActiveLabel) modalActiveLabel.textContent = themeName;
  const styleSelect = document.getElementById("edit-style-theme-select");
  if (styleSelect && styleSelect.value !== themeName) styleSelect.value = themeName;
  const editStyleLabel = document.getElementById("edit-style-theme-label");
  if (editStyleLabel) editStyleLabel.textContent = themeName;
  const editStyleSwatches = document.getElementById("edit-style-theme-swatches");
  if (editStyleSwatches) editStyleSwatches.setAttribute("data-theme", themeName);
  if (typeof HTMLReportSettings !== "undefined" && typeof HTMLReportSettings.refreshModalState === "function") {
    HTMLReportSettings.refreshModalState();
  }

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("html_report_active_theme", themeName);
    }
  } catch (_) {}

  if (typeof document.querySelectorAll === "function") {
    document.querySelectorAll("#theme-swatch-list .theme-swatch-item, #edit-style-theme-swatch-list .theme-swatch-item").forEach((btn) => {
      const check = btn.querySelector(".theme-check");
      if (check) {
        const themeKey = btn.getAttribute("data-set-theme") || btn.getAttribute("data-edit-set-theme");
        const isCurrent = themeKey === themeName;
        check.classList.toggle("opacity-100", isCurrent);
        check.classList.toggle("opacity-0", !isCurrent);
      }
    });
  }

  const palette = resolveDaisyUIThemePalette();

  // Dynamic Chart.js color sync (scalar & array datasets, scales, and legend)
  const paletteSequence = ["primary", "secondary", "accent", "info", "success", "warning", "error"];
  const activeCharts = (typeof window !== "undefined" && Array.isArray(window.reportCharts) && window.reportCharts.length > 0)
    ? window.reportCharts
    : (typeof document !== "undefined" && typeof Chart !== "undefined" && typeof Chart.getChart === "function"
        ? Array.from(document.querySelectorAll("canvas")).map((c) => Chart.getChart(c)).filter(Boolean)
        : []);
  if (activeCharts.length > 0) {
    activeCharts.forEach((chart) => {
      if (chart?.data?.datasets) {
        chart.data.datasets.forEach((ds, dsIdx) => {
          const colorKey = paletteSequence[dsIdx % paletteSequence.length];
          const chosenEntry = palette[colorKey] || palette.primary || { hex: "#3b82f6", rgba: (a) => `rgba(59, 130, 246, ${a})` };

          if (Array.isArray(ds.borderColor)) {
            ds.borderColor = ds.borderColor.map((_, i) => {
              const k = paletteSequence[i % paletteSequence.length];
              return palette[k] ? palette[k].hex : chosenEntry.hex;
            });
          } else if (ds.borderColor) {
            ds.borderColor = chosenEntry.hex;
          }

          if (Array.isArray(ds.backgroundColor)) {
            ds.backgroundColor = ds.backgroundColor.map((orig, i) => {
              const k = paletteSequence[i % paletteSequence.length];
              const entry = palette[k] || chosenEntry;
              if (typeof orig === "string" && orig.includes("rgba")) {
                return entry.rgba ? entry.rgba(0.75) : entry.hex;
              }
              return entry.hex;
            });
          } else if (ds.backgroundColor && typeof ds.backgroundColor === "string") {
            if (ds.backgroundColor.includes("rgba")) {
              ds.backgroundColor = chosenEntry.rgba ? chosenEntry.rgba(0.2) : "rgba(59, 130, 246, 0.2)";
            } else {
              ds.backgroundColor = chosenEntry.hex;
            }
          }
        });
      }

      if (chart?.options?.scales && typeof chart.options.scales === "object") {
        const textHex = palette.text ? palette.text.hex : "#64748b";
        const gridColor = palette.grid ? palette.grid.rgba(0.25) : "rgba(148, 163, 184, 0.2)";
        for (const scale of Object.values(chart.options.scales)) {
          if (!scale || typeof scale !== "object") continue;
          if (scale.ticks && typeof scale.ticks === "object") scale.ticks.color = textHex;
          if (scale.grid && typeof scale.grid === "object") scale.grid.color = gridColor;
          if (scale.pointLabels && typeof scale.pointLabels === "object") scale.pointLabels.color = textHex;
          if (scale.angleLines && typeof scale.angleLines === "object") scale.angleLines.color = gridColor;
        }
      }

      if (chart?.options?.plugins?.legend?.labels && typeof chart.options.plugins.legend.labels === "object") {
        chart.options.plugins.legend.labels.color = palette.text ? palette.text.hex : "#64748b";
      }

      if (typeof chart?.update === "function") {
        chart.update();
      }
    });
  }
  if (typeof window !== "undefined" && typeof window.onReportThemeChange === "function") {
    try { window.onReportThemeChange(themeName, palette); } catch (_) {}
  }

  // Dynamic Mermaid sync
  await renderMermaidWithTheme(palette);

  // Dynamic FullCalendar sync
  if (typeof window !== "undefined" && window.reportCalendars && Array.isArray(window.reportCalendars)) {
    window.reportCalendars.forEach((cal) => {
      try {
        cal.render();
      } catch (_) {}
    });
  }

  // Dynamic Datastar reactive $theme signal sync
  syncDatastarTheme(themeName);

  // Dynamic PWA meta theme-color sync
  syncPwaThemeColor(palette);
}

