/**
 * html-report client runtime (report-runtime.js)
 * Pre-bundled runtime for 32 DaisyUI themes, canvas 2D OKLCH palette resolution,
 * Mermaid list syntax defense, dynamic TOC generation, snapshot bundler,
 * and horizontal space detection.
 */

const DAISYUI_THEMES = [
  "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
  "synthwave", "retro", "cyberpunk", "valentine", "halloween", "garden",
  "forest", "aqua", "lofi", "pastel", "fantasy", "wireframe", "black",
  "luxury", "dracula", "cmyk", "autumn", "business", "acid", "lemonade",
  "night", "coffee", "winter", "dim", "nord", "sunset"
];

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
  if (!doc) return {};

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
}

/**
 * Initializes the 32 DaisyUI theme color swatch picker dropdown.
 */
function initThemeDropdown() {
  if (typeof document === "undefined") return;
  const listEl = document.getElementById("theme-swatch-list");
  if (!listEl) return;
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  listEl.innerHTML = "";

  DAISYUI_THEMES.forEach((theme) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-theme", theme);
    btn.setAttribute("data-set-theme", theme);
    btn.className = "theme-swatch-item outline-base-content text-start outline-offset-4 rounded-btn w-full cursor-pointer font-sans";
    btn.innerHTML = `
      <span class="bg-base-100 rounded-btn text-base-content block w-full cursor-pointer font-sans border border-base-300 hover:border-primary transition">
        <span class="grid grid-cols-5 grid-rows-3">
          <span class="col-span-5 row-span-3 row-start-1 flex items-center gap-2 px-3 py-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="theme-check h-3.5 w-3.5 shrink-0 ${theme === currentTheme ? "opacity-100" : "opacity-0"}">
              <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"></path>
            </svg>
            <span class="flex-grow text-xs font-semibold capitalize">${theme}</span>
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
    btn.addEventListener("click", () => setReportTheme(theme));
    listEl.appendChild(btn);
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

  document.querySelectorAll("#theme-swatch-list .theme-swatch-item").forEach((btn) => {
    const check = btn.querySelector(".theme-check");
    if (check) {
      const isCurrent = btn.getAttribute("data-set-theme") === themeName;
      check.classList.toggle("opacity-100", isCurrent);
      check.classList.toggle("opacity-0", !isCurrent);
    }
  });

  const palette = resolveDaisyUIThemePalette();

  // Dynamic Chart.js color sync
  if (typeof window !== "undefined" && window.reportCharts && Array.isArray(window.reportCharts)) {
    window.reportCharts.forEach((chart, idx) => {
      if (chart?.data?.datasets) {
        chart.data.datasets.forEach((ds, dsIdx) => {
          const colorKey = dsIdx % 3 === 0 ? "primary" : dsIdx % 3 === 1 ? "secondary" : "accent";
          const chosen = palette[colorKey] ? palette[colorKey].hex : "#3b82f6";
          if (ds.borderColor) ds.borderColor = chosen;
          if (ds.backgroundColor && typeof ds.backgroundColor === "string" && ds.backgroundColor.includes("rgba")) {
            ds.backgroundColor = palette[colorKey] ? palette[colorKey].rgba(0.2) : "rgba(59, 130, 246, 0.2)";
          }
        });
        chart.update();
      }
    });
  }

  // Dynamic Mermaid sync
  await renderMermaidWithTheme(palette);
}

/**
 * Builds Table of Contents from main h1, h2, h3 elements.
 */
function initTOC() {
  if (typeof document === "undefined") return;
  const tocList = document.getElementById("report-toc-list");
  if (!tocList) return;
  const headings = document.querySelectorAll("main h1, main h2, main h3");
  tocList.innerHTML = "";

  headings.forEach((h) => {
    if (!h.id) {
      h.id = h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    }
    const level = parseInt(h.tagName.substring(1), 10);
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#${h.id}`;
    a.textContent = h.textContent.trim();
    a.className = level === 1 ? "font-bold text-xs" : level === 2 ? "pl-3 text-xs" : "pl-6 text-2xs opacity-80";
    a.addEventListener("click", () => {
      const dropdown = document.getElementById("toc-dropdown");
      if (dropdown) dropdown.removeAttribute("open");
    });
    li.appendChild(a);
    tocList.appendChild(li);
  });
}

/**
 * Horizontal Scrollbar -> Insufficient Space Detector.
 * Flags elements where scrollWidth > clientWidth with [data-insufficient-space="true"].
 */
function checkInsufficientHorizontalSpace() {
  if (typeof document === "undefined") return [];
  const mainEl = document.querySelector("main");
  if (!mainEl) return [];

  const insufficient = [];
  const candidates = mainEl.querySelectorAll("section, div, pre, table, .card, .overflow-x-auto, .gridjs-wrapper");

  candidates.forEach((el) => {
    const style = (typeof window !== "undefined" && window.getComputedStyle) ? window.getComputedStyle(el) : el.style;
    if (style.display === "none" || style.visibility === "hidden" || el.clientWidth === 0) {
      el.removeAttribute("data-insufficient-space");
      return;
    }
    const hasHorizontalScrollbar =
      el.scrollWidth > el.clientWidth + 2 &&
      ["auto", "scroll"].includes(style.overflowX);

    if (hasHorizontalScrollbar) {
      el.setAttribute("data-insufficient-space", "true");
      insufficient.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        className: typeof el.className === "string" ? el.className : "",
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        message: "Element has a horizontal scrollbar and does not have enough space"
      });
    } else {
      el.removeAttribute("data-insufficient-space");
    }
  });

  return insufficient;
}

/**
 * Builds a standalone, inlined HTML snapshot with fetched CSS and JS bundled directly.
 */
async function buildInlinedHtmlSnapshot() {
  if (typeof document === "undefined") return "";
  const clone = document.documentElement.cloneNode(true);
  clone.setAttribute("data-theme", document.documentElement.getAttribute("data-theme") || "light");

  // Inline external stylesheets
  const linkEls = Array.from(clone.querySelectorAll('link[rel="stylesheet"][href]'));
  await Promise.allSettled(
    linkEls.map(async (linkEl) => {
      const href = linkEl.getAttribute("href");
      if (!href || (!href.startsWith("http://") && !href.startsWith("https://"))) return;
      try {
        const res = await fetch(href);
        if (!res.ok) return;
        let cssText = await res.text();
        cssText = cssText.replace(/url\((['"]?)(?!data:|https?:|#)([^'")]+)\1\)/g, (match, quote, relPath) => {
          try {
            return `url("${new URL(relPath, href).href}")`;
          } catch {
            return match;
          }
        });
        const styleEl = document.createElement("style");
        styleEl.setAttribute("data-inlined-href", href);
        styleEl.textContent = cssText;
        linkEl.replaceWith(styleEl);
      } catch (_) {}
    })
  );

  // Inline external scripts
  const scriptEls = Array.from(clone.querySelectorAll("script[src]"));
  await Promise.allSettled(
    scriptEls.map(async (scriptEl) => {
      const src = scriptEl.getAttribute("src");
      if (!src || (!src.startsWith("http://") && !src.startsWith("https://"))) return;
      if (src.includes("cdn.tailwindcss.com")) {
        const marker = document.createElement("script");
        marker.setAttribute("data-inlined-src", src);
        marker.textContent = "/* Tailwind CSS styles pre-compiled inline in <head> */";
        scriptEl.replaceWith(marker);
        return;
      }
      try {
        const res = await fetch(src);
        if (!res.ok) return;
        const jsText = await res.text();
        const inlineScript = document.createElement("script");
        inlineScript.setAttribute("data-inlined-src", src);
        inlineScript.textContent = jsText.replace(/<\/script>/gi, "<\\/script>");
        scriptEl.replaceWith(inlineScript);
      } catch (_) {}
    })
  );

  return "<!DOCTYPE html>\n" + clone.outerHTML;
}

/**
 * Triggers PDF export / print dialog.
 */
function exportReportPdf() {
  if (typeof window === "undefined") return;
  if (window.reportCharts && Array.isArray(window.reportCharts)) {
    window.reportCharts.forEach((c) => c?.resize?.());
  }
  if (window.reportLeafletMap && typeof window.reportLeafletMap.invalidateSize === "function") {
    window.reportLeafletMap.invalidateSize();
  }
  window.print();
}

/**
 * Initializes the download menu actions (HTML & PDF).
 */
function initDownloadButton() {
  if (typeof document === "undefined") return;
  const htmlBtn = document.getElementById("download-html-btn");
  const pdfBtn = document.getElementById("download-pdf-btn");

  if (htmlBtn) {
    htmlBtn.addEventListener("click", async () => {
      try {
        htmlBtn.disabled = true;
        const htmlContent = await buildInlinedHtmlSnapshot();
        const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const docTitle = document.title || "html-report";
        a.download = `${docTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-standalone.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("[html-report] Failed to bundle inlined HTML snapshot:", err);
      } finally {
        htmlBtn.disabled = false;
      }
    });
  }

  if (pdfBtn) {
    pdfBtn.addEventListener("click", () => {
      const reportMode = document.documentElement.getAttribute("data-report-mode") || "interactive";
      if (reportMode === "interactive") {
        const modal = document.getElementById("pdf-not-ready-modal");
        if (modal && typeof modal.showModal === "function") {
          modal.showModal();
          return;
        }
      }
      exportReportPdf();
    });
  }
}

// Global browser window bindings
if (typeof window !== "undefined") {
  window.DAISYUI_THEMES = DAISYUI_THEMES;
  window.cssColorToHexAndRgba = cssColorToHexAndRgba;
  window.resolveDaisyUIThemePalette = resolveDaisyUIThemePalette;
  window.sanitizeMermaidSource = sanitizeMermaidSource;
  window.renderMermaidWithTheme = renderMermaidWithTheme;
  window.initThemeDropdown = initThemeDropdown;
  window.setReportTheme = setReportTheme;
  window.initTOC = initTOC;
  window.checkInsufficientHorizontalSpace = checkInsufficientHorizontalSpace;
  window.buildInlinedHtmlSnapshot = buildInlinedHtmlSnapshot;
  window.exportReportPdf = exportReportPdf;
  window.initDownloadButton = initDownloadButton;

  window.addEventListener("DOMContentLoaded", async () => {
    try { if (window.lucide && typeof window.lucide.createIcons === "function") window.lucide.createIcons(); } catch (_) {}
    try { initTOC(); } catch (_) {}
    try { initThemeDropdown(); } catch (_) {}
    try { initDownloadButton(); } catch (_) {}
    try { if (window.hljs && typeof window.hljs.highlightAll === "function") window.hljs.highlightAll(); } catch (_) {}

    const palette = resolveDaisyUIThemePalette();
    try { await renderMermaidWithTheme(palette); } catch (_) {}
    try { checkInsufficientHorizontalSpace(); } catch (_) {}
    window.addEventListener("resize", () => checkInsufficientHorizontalSpace());
    window.__REPORT_READY__ = true;
  });
}

// Node.js CommonJS exports for unit testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DAISYUI_THEMES,
    cssColorToHexAndRgba,
    resolveDaisyUIThemePalette,
    sanitizeMermaidSource,
    renderMermaidWithTheme,
    initThemeDropdown,
    setReportTheme,
    initTOC,
    checkInsufficientHorizontalSpace,
    buildInlinedHtmlSnapshot,
    exportReportPdf,
    initDownloadButton
  };
}
