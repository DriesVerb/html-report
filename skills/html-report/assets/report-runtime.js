/**
 * html-report client runtime (report-runtime.js)
 * Pre-bundled runtime for 32 DaisyUI themes, canvas 2D OKLCH palette resolution,
 * Mermaid list syntax defense, dynamic TOC generation, snapshot bundler,
 * and horizontal space detection.
 */

const STANDARD_DAISYUI_THEMES = new Set([
  "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
  "synthwave", "retro", "cyberpunk", "valentine", "halloween", "garden",
  "forest", "aqua", "lofi", "pastel", "fantasy", "wireframe", "black",
  "luxury", "dracula", "cmyk", "autumn", "business", "acid", "lemonade",
  "night", "coffee", "winter", "dim", "nord", "sunset"
]);

const DAISYUI_THEMES = Array.from(STANDARD_DAISYUI_THEMES);

// Zero-dependency pure JS OKLCH engine & compiler for browser runtime
function srgbToLinear(c) {
  const norm = c / 255;
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c) {
  const clamped = Math.max(0, Math.min(1, c));
  const srgb = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(srgb * 255);
}

function hexToRgb(hex) {
  let clean = String(hex).replace(/^#/, "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("") + "ff";
  } else if (clean.length === 4) {
    clean = clean.split("").map((c) => c + c).join("");
  } else if (clean.length === 6) {
    clean += "ff";
  }
  if (clean.length !== 8) return [0, 0, 0, 1];
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return [0, 0, 0, 1];
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    ((num & 255) / 255)
  ];
}

function hslToRgb(h, s, l) {
  const hNorm = (((h % 360) + 360) % 360) / 360;
  const sNorm = Math.max(0, Math.min(1, s / 100));
  const lNorm = Math.max(0, Math.min(1, l / 100));
  if (sNorm === 0) {
    const val = Math.round(lNorm * 255);
    return [val, val, val];
  }
  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;
  const hue2rgb = (t) => {
    let tNorm = t;
    if (tNorm < 0) tNorm += 1;
    if (tNorm > 1) tNorm -= 1;
    if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm;
    if (tNorm < 1 / 2) return q;
    if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(hNorm + 1 / 3) * 255),
    Math.round(hue2rgb(hNorm) * 255),
    Math.round(hue2rgb(hNorm - 1 / 3) * 255)
  ];
}

function parseColor(input) {
  if (!input || typeof input !== "string") {
    return { r: 59, g: 130, b: 246, a: 1, oklch: null };
  }
  const str = input.trim();
  const oklchMatch = str.match(/^(?:oklch\s*\(\s*)?([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)(?:\s*(?:\/|\s)\s*([0-9.]+%?))?\s*\)?$/i);
  if (oklchMatch) {
    let rawL = oklchMatch[1];
    let L = rawL.endsWith("%") ? parseFloat(rawL) / 100 : parseFloat(rawL);
    if (L > 1) L = L / 100;
    const C = parseFloat(oklchMatch[2]);
    const H = parseFloat(oklchMatch[3]);
    return {
      r: null,
      g: null,
      b: null,
      a: 1,
      oklch: {
        L,
        C,
        H,
        formatted: `${(L * 100).toFixed(2)}% ${C.toFixed(3)} ${H.toFixed(2)}`
      }
    };
  }
  if (str.startsWith("#")) {
    const [r, g, b, a] = hexToRgb(str);
    return { r, g, b, a, oklch: null };
  }
  const rgbMatch = str.match(/^rgba?\s*\(\s*(\d+)(?:,|\s+)\s*(\d+)(?:,|\s+)\s*(\d+)(?:(?:\s*[,/]\s*|\s+)([0-9.]+%?))?\s*\)$/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    let a = 1;
    if (rgbMatch[4]) {
      a = rgbMatch[4].endsWith("%") ? parseFloat(rgbMatch[4]) / 100 : parseFloat(rgbMatch[4]);
    }
    return { r, g, b, a, oklch: null };
  }
  const hslMatch = str.match(/^hsla?\s*\(\s*(\d+)(?:deg)?(?:,|\s+)\s*(\d+)%(?:,|\s+)\s*(\d+)%(?:(?:\s*[,/]\s*|\s+)([0-9.]+%?))?\s*\)$/i);
  if (hslMatch) {
    const h = parseInt(hslMatch[1], 10);
    const s = parseInt(hslMatch[2], 10);
    const l = parseInt(hslMatch[3], 10);
    const [r, g, b] = hslToRgb(h, s, l);
    let a = 1;
    if (hslMatch[4]) {
      a = hslMatch[4].endsWith("%") ? parseFloat(hslMatch[4]) / 100 : parseFloat(hslMatch[4]);
    }
    return { r, g, b, a, oklch: null };
  }
  return { r: 59, g: 130, b: 246, a: 1, oklch: null };
}

function rgbToOklch(r, g, b) {
  if (r === g && g === b) {
    const L = r === 0 ? 0 : r === 255 ? 1 : 0.2104542553 * Math.cbrt(srgbToLinear(r)) + 0.7936177850 * Math.cbrt(srgbToLinear(r)) - 0.0040720468 * Math.cbrt(srgbToLinear(r));
    return {
      L,
      C: 0,
      H: 0,
      formatted: `${(L * 100).toFixed(2)}% 0.000 0.00`
    };
  }
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(Math.max(0, l));
  const m_ = Math.cbrt(Math.max(0, m));
  const s_ = Math.cbrt(Math.max(0, s));

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  let C = Math.sqrt(a * a + b_ * b_);
  let H = Math.atan2(b_, a) * (180 / Math.PI);
  if (H < 0) H += 360;
  if (C < 0.0001) {
    C = 0;
    H = 0;
  }
  return {
    L,
    C,
    H,
    formatted: `${(L * 100).toFixed(2)}% ${C.toFixed(3)} ${H.toFixed(2)}`
  };
}

function autoContrastContent(colorInput) {
  const parsed = parseColor(colorInput);
  let L = 0.5;
  let H = 0;
  let luminance = 0.5;

  if (parsed.oklch) {
    L = parsed.oklch.L;
    H = parsed.oklch.H;
    luminance = L;
  } else {
    const oklch = rgbToOklch(parsed.r, parsed.g, parsed.b);
    L = oklch.L;
    H = oklch.H;
    const lr = srgbToLinear(parsed.r);
    const lg = srgbToLinear(parsed.g);
    const lb = srgbToLinear(parsed.b);
    luminance = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  }

  const hVal = Number.isFinite(H) ? H.toFixed(2) : "0";
  if (L > 0.65 || luminance > 0.4) {
    return `15% 0.02 ${hVal}`;
  }
  return `98% 0.01 ${hVal}`;
}

const RUNTIME_COLOR_MAP = {
  primary: "--p",
  "primary-content": "--pc",
  secondary: "--s",
  "secondary-content": "--sc",
  accent: "--a",
  "accent-content": "--ac",
  neutral: "--n",
  "neutral-content": "--nc",
  "base-100": "--b1",
  "base-200": "--b2",
  "base-300": "--b3",
  "base-content": "--bc",
  info: "--in",
  "info-content": "--inc",
  success: "--su",
  "success-content": "--suc",
  warning: "--wa",
  "warning-content": "--wac",
  error: "--er",
  "error-content": "--erc"
};

const RUNTIME_BASE_THEMES = {
  light: {
    "color-scheme": "light",
    "--p": "49.12% 0.3096 275.75",
    "--pc": "89.824% 0.06192 275.75",
    "--s": "69.71% 0.329 342.55",
    "--sc": "98.71% 0.0106 342.55",
    "--a": "76.76% 0.184 183.61",
    "--ac": "15.352% 0.0368 183.61",
    "--n": "32.1785% 0.02476 255.701624",
    "--nc": "89.4994% 0.011585 252.096176",
    "--b1": "100% 0 0",
    "--b2": "96.1151% 0 0",
    "--b3": "92.4169% 0.00108 197.137559",
    "--bc": "27.8078% 0.029596 256.847952",
    "--in": "72.06% 0.191 231.6",
    "--inc": "0% 0 0",
    "--su": "64.8% 0.150 160",
    "--suc": "0% 0 0",
    "--wa": "84.71% 0.199 83.87",
    "--wac": "0% 0 0",
    "--er": "71.76% 0.221 22.18",
    "--erc": "0% 0 0",
    "--rounded-box": "1rem",
    "--rounded-btn": "0.5rem",
    "--rounded-badge": "1.9rem",
    "--animation-btn": "0.25s",
    "--animation-input": ".2s",
    "--btn-focus-scale": "0.95",
    "--border-btn": "1px",
    "--tab-border": "1px",
    "--tab-radius": "0.5rem"
  },
  dark: {
    "color-scheme": "dark",
    "--p": "65.69% 0.196 275.75",
    "--pc": "13.138% 0.0392 275.75",
    "--s": "74.8% 0.26 342.55",
    "--sc": "14.96% 0.052 342.55",
    "--a": "74.51% 0.167 183.61",
    "--ac": "14.902% 0.0334 183.61",
    "--n": "31.3815% 0.021108 254.139175",
    "--nc": "74.6477% 0.0216 264.435964",
    "--b1": "25.3267% 0.015896 252.417568",
    "--b2": "23.2607% 0.013807 253.100675",
    "--b3": "21.1484% 0.01165 254.087939",
    "--bc": "74.6477% 0.0216 264.435964",
    "--in": "72.06% 0.191 231.6",
    "--inc": "0% 0 0",
    "--su": "64.8% 0.150 160",
    "--suc": "0% 0 0",
    "--wa": "84.71% 0.199 83.87",
    "--wac": "0% 0 0",
    "--er": "71.76% 0.221 22.18",
    "--erc": "0% 0 0",
    "--rounded-box": "1rem",
    "--rounded-btn": "0.5rem",
    "--rounded-badge": "1.9rem",
    "--animation-btn": "0.25s",
    "--animation-input": ".2s",
    "--btn-focus-scale": "0.95",
    "--border-btn": "1px",
    "--tab-border": "1px",
    "--tab-radius": "0.5rem"
  }
};

function compileTheme(themeDefinition, { defaultThemeName = "custom" } = {}) {
  if (typeof themeDefinition === "string") {
    const trimmed = themeDefinition.trim();
    if (trimmed.includes("[data-theme=")) {
      const match = trimmed.match(/\[data-theme=["']?([a-zA-Z0-9_\-]+)["']?\]/);
      const themeName = match ? match[1] : defaultThemeName;
      return { themeName, css: trimmed, variables: {}, isRawCss: true };
    }
    try {
      return compileTheme(JSON.parse(trimmed), { defaultThemeName });
    } catch (_) {
      throw new Error("Invalid theme definition");
    }
  }

  let themeObj = themeDefinition;
  let themeName = defaultThemeName;

  if (themeObj.themes && Array.isArray(themeObj.themes) && themeObj.themes.length > 0) {
    themeObj = themeObj.themes[0];
  }
  const topKeys = Object.keys(themeObj);
  if (topKeys.length === 1 && typeof themeObj[topKeys[0]] === "object" && !themeObj[topKeys[0]].r) {
    themeName = topKeys[0];
    themeObj = themeObj[topKeys[0]];
  } else if (themeObj.name) {
    themeName = themeObj.name;
  }

  const baseThemeName = themeObj.extends || "light";
  const baseVars = RUNTIME_BASE_THEMES[baseThemeName] ? { ...RUNTIME_BASE_THEMES[baseThemeName] } : { ...RUNTIME_BASE_THEMES.light };
  const resultVars = { ...baseVars };

  for (const [key, rawValue] of Object.entries(themeObj)) {
    if (key === "extends" || key === "name") continue;
    if (RUNTIME_COLOR_MAP[key]) {
      const parsed = parseColor(rawValue);
      resultVars[RUNTIME_COLOR_MAP[key]] = parsed.oklch ? parsed.oklch.formatted : rgbToOklch(parsed.r, parsed.g, parsed.b).formatted;
      continue;
    }
    if (key.startsWith("--")) {
      if (Object.values(RUNTIME_COLOR_MAP).includes(key)) {
        const parsed = parseColor(rawValue);
        resultVars[key] = parsed.oklch ? parsed.oklch.formatted : rgbToOklch(parsed.r, parsed.g, parsed.b).formatted;
      } else {
        resultVars[key] = String(rawValue).trim();
      }
      continue;
    }
    if (key === "color-scheme" || key === "colorScheme") {
      resultVars["color-scheme"] = String(rawValue).trim();
      continue;
    }
    resultVars[key] = String(rawValue).trim();
  }

  // Auto content
  const pairs = [["--p", "--pc"], ["--s", "--sc"], ["--a", "--ac"], ["--n", "--nc"], ["--b1", "--bc"]];
  for (const [pVar, cVar] of pairs) {
    if (resultVars[pVar] && !themeObj[cVar] && !themeObj[Object.keys(RUNTIME_COLOR_MAP).find((k) => RUNTIME_COLOR_MAP[k] === cVar)]) {
      resultVars[cVar] = autoContrastContent(resultVars[pVar]);
    }
  }

  const lines = [`[data-theme="${themeName}"] {`];
  if (resultVars["color-scheme"]) lines.push(`  color-scheme: ${resultVars["color-scheme"]};`);
  for (const [k, v] of Object.entries(resultVars)) {
    if (k === "color-scheme") continue;
    lines.push(`  ${k}: ${v};`);
  }
  lines.push(`}`);
  return { themeName, css: lines.join("\n"), variables: resultVars, isRawCss: false };
}

function tailwindConfigSnippet(themeName, variables) {
  return `daisyui: {\n  themes: [\n    {\n      "${themeName}": ${JSON.stringify(variables, null, 8).replace(/^ {8}/gm, "      ")}\n    }\n  ]\n}`;
}

/**
 * Registers a custom DaisyUI theme dynamically in runtime, injecting CSS if provided.
 */
function registerCustomTheme(themeName, css = null) {
  if (!themeName || typeof themeName !== "string") return false;
  const name = themeName.trim();
  if (!DAISYUI_THEMES.includes(name)) {
    DAISYUI_THEMES.push(name);
  }

  if (css && typeof document !== "undefined") {
    let styleEl = document.getElementById("daisyui-custom-themes");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "daisyui-custom-themes";
      styleEl.textContent = "";
      if (document.head && typeof document.head.appendChild === "function") {
        document.head.appendChild(styleEl);
      }
    }
    styleEl.textContent = styleEl.textContent || "";
    const themeSelector = `[data-theme="${name}"]`;
    if (styleEl.textContent.includes(themeSelector)) {
      const escaped = themeSelector.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      const regex = new RegExp(`${escaped}\\s*\\{[^}]*\\}`, "g");
      styleEl.textContent = styleEl.textContent.replace(regex, css);
    } else {
      styleEl.textContent += `\n${css}\n`;
    }
  }

  if (typeof document !== "undefined" && document.getElementById("theme-swatch-list")) {
    initThemeDropdown();
  }
  return true;
}

/**
 * Scans for build-time or localStorage custom themes and registers them.
 */
function scanAndRegisterExistingCustomThemes() {
  if (typeof document === "undefined") return;

  // 1. Scan pre-injected <style id="daisyui-custom-themes">
  const styleEl = document.getElementById("daisyui-custom-themes");
  if (styleEl && styleEl.textContent) {
    const themeRegex = /\[data-theme=["']?([a-zA-Z0-9_\-]+)["']?\]/g;
    let match;
    while ((match = themeRegex.exec(styleEl.textContent)) !== null) {
      const name = match[1];
      if (name && !DAISYUI_THEMES.includes(name)) {
        DAISYUI_THEMES.push(name);
      }
    }
  }

  // 2. Scan localStorage
  try {
    if (typeof localStorage !== "undefined") {
      const savedThemes = localStorage.getItem("html_report_custom_themes");
      if (savedThemes) {
        const parsed = JSON.parse(savedThemes);
        if (typeof parsed === "object") {
          for (const [themeName, entry] of Object.entries(parsed)) {
            const css = typeof entry === "string" ? entry : (entry.css || null);
            registerCustomTheme(themeName, css);
          }
        }
      }
      const savedActive = localStorage.getItem("html_report_active_theme");
      if (savedActive && DAISYUI_THEMES.includes(savedActive)) {
        document.documentElement.setAttribute("data-theme", savedActive);
        const activeLabel = document.getElementById("active-theme-label");
        if (activeLabel) activeLabel.textContent = savedActive;
      }
    }
  } catch (_) {}
}

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
  try {
    if (typeof HTMLReportMermaid !== "undefined") HTMLReportMermaid.initEnlarge();
  } catch (_) {}
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
    const isCustom = !STANDARD_DAISYUI_THEMES.has(theme);
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
  const modalActiveLabel = document.getElementById("modal-active-theme-label");
  if (modalActiveLabel) modalActiveLabel.textContent = themeName;
  if (typeof HTMLReportSettings !== "undefined" && typeof HTMLReportSettings.refreshModalState === "function") {
    HTMLReportSettings.refreshModalState();
  }

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("html_report_active_theme", themeName);
    }
  } catch (_) {}

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

/**
 * Builds Table of Contents from main h1, h2, h3 elements.
 */
function initTOC() {
  if (typeof document === "undefined") return;
  const tocList = document.getElementById("report-toc-list");
  if (!tocList) return;
  const headings = Array.from(document.querySelectorAll("main h1, main h2, main h3")).filter(
    (h) => !h.closest(".fc, .katex, .gridjs, [aria-hidden='true']") && !h.classList.contains("fc-toolbar-title")
  );
  tocList.innerHTML = "";

  headings.forEach((h) => {
    if (!h.id) {
      const slug = h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      h.id = slug || `section-${Math.random().toString(36).slice(2, 7)}`;
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
async function buildInlinedHtmlSnapshot(options = {}) {
  if (typeof document === "undefined") return "";
  const clone = document.documentElement.cloneNode(true);
  const publishedMode = Boolean(
    (options && options.mode === "published") ||
    (typeof HTMLReportPublisher !== "undefined" && typeof HTMLReportPublisher.isPublishedFlagOn === "function" && HTMLReportPublisher.isPublishedFlagOn())
  );
  if (publishedMode) HTMLReportPublisher.prepare(clone);
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

  const serialized = "<!DOCTYPE html>\n" + clone.outerHTML;
  return publishedMode ? HTMLReportPublisher.normalizeSerialized(serialized) : serialized;
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
 * Mode-adaptive navbar status badge and download options.
 */
function initModeBadge() {
  if (typeof document === "undefined") return;
  const rawMode = document.documentElement.getAttribute("data-report-mode") || "report";
  const badgeEl = document.getElementById("navbar-mode-badge");
  const pdfStatusBadge = document.querySelector("#download-pdf-btn .badge");

  if (badgeEl) {
    badgeEl.classList.remove("hidden", "badge-neutral", "badge-primary", "badge-secondary", "badge-accent", "badge-info", "badge-success", "badge-warning", "badge-ghost");

    switch (rawMode) {
      case "print":
        badgeEl.textContent = "PRINT";
        badgeEl.classList.add("badge-neutral");
        break;
      case "presentation":
        badgeEl.textContent = "PRESENTATION";
        badgeEl.classList.add("badge-secondary");
        break;
      case "dashboard":
        badgeEl.textContent = "DASHBOARD";
        badgeEl.classList.add("badge-info");
        break;
      case "working-report":
        badgeEl.textContent = "JOURNEY";
        badgeEl.classList.add("badge-accent");
        break;
      case "live-report":
        badgeEl.innerHTML = `<span class="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse mr-1"></span>LIVE`;
        badgeEl.classList.add("badge-success", "badge-outline");
        break;
      case "pwa":
        badgeEl.textContent = "PWA";
        badgeEl.classList.add("badge-accent");
        break;
      case "report":
      default:
        badgeEl.textContent = "REPORT";
        badgeEl.classList.add("badge-ghost");
        break;
    }
  }

  if (pdfStatusBadge && rawMode === "print") {
    pdfStatusBadge.textContent = "PDF-Ready";
    pdfStatusBadge.classList.remove("badge-warning");
    pdfStatusBadge.classList.add("badge-success");
  }
}

let deferredPwaInstallPrompt = null;

/**
 * Synchronizes <meta name="theme-color"> with the active DaisyUI theme palette.
 */
function syncPwaThemeColor(palette = null) {
  if (typeof document === "undefined") return;
  const meta = (typeof document.getElementById === "function" && document.getElementById("pwa-theme-color")) ||
               (typeof document.querySelector === "function" ? document.querySelector('meta[name="theme-color"]') : null);
  if (!meta) return;
  const pal = palette || (typeof resolveDaisyUIThemePalette === "function" ? resolveDaisyUIThemePalette() : {});
  const hex = pal?.primary?.hex || pal?.base100?.hex || "#2563eb";
  if (typeof meta.setAttribute === "function") {
    meta.setAttribute("content", hex);
  }
}

/**
 * Initializes Progressive Web App (PWA) client runtime:
 * - Service worker registration
 * - Native beforeinstallprompt interception and navbar install button wiring
 * - Online / Offline network health indicator
 * - Dynamic theme-color sync
 */
function initPwa() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const manifestLink = typeof document.querySelector === "function" ? document.querySelector('link[rel="manifest"]') : null;
  if (!manifestLink) {
    return; // Not a PWA-enabled report, skip Service Worker registration & install wiring
  }

  // 1. Service Worker Registration
  if ("serviceWorker" in navigator) {
    const isHttp = location.protocol === "http:" || location.protocol === "https:";
    if (isHttp && !window.__PWA_SW_REGISTERED__) {
      window.__PWA_SW_REGISTERED__ = true;
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js")
          .then((reg) => {
            window.__PWA_REGISTRATION__ = reg;
            reg.addEventListener("updatefound", () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                    console.log("[html-report PWA] New version available. Refresh to update.");
                  }
                });
              }
            });
          })
          .catch((err) => {
            // Local dev or sandbox
          });
      });
    }
  }

  // 2. Native PWA Install Prompt Interception
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPwaInstallPrompt = e;
    const installBtn = document.getElementById("pwa-install-btn");
    if (installBtn) installBtn.classList.remove("hidden");
    const menuItem = document.getElementById("pwa-install-menu-item");
    if (menuItem) menuItem.classList.remove("hidden");
  });

  const triggerInstall = async () => {
    if (!deferredPwaInstallPrompt) {
      alert("To install this report as an app, use your browser menu ('Install' or 'Add to Home Screen').");
      return;
    }
    deferredPwaInstallPrompt.prompt();
    const choice = await deferredPwaInstallPrompt.userChoice;
    if (choice && choice.outcome === "accepted") {
      const installBtn = document.getElementById("pwa-install-btn");
      if (installBtn) installBtn.classList.add("hidden");
    }
    deferredPwaInstallPrompt = null;
  };

  window.triggerPwaInstall = triggerInstall;

  const pwaBtn = document.getElementById("pwa-install-btn");
  if (pwaBtn) pwaBtn.addEventListener("click", triggerInstall);

  const pwaDropdownBtn = document.getElementById("pwa-install-dropdown-btn");
  if (pwaDropdownBtn) pwaDropdownBtn.addEventListener("click", triggerInstall);

  window.addEventListener("appinstalled", () => {
    const installBtn = document.getElementById("pwa-install-btn");
    if (installBtn) installBtn.classList.add("hidden");
    const statusBadge = document.getElementById("pwa-install-status-badge");
    if (statusBadge) {
      statusBadge.textContent = "Installed";
      statusBadge.className = "badge badge-success badge-xs font-mono";
    }
    deferredPwaInstallPrompt = null;
  });

  // 3. Online / Offline Status Detection
  function updateNetworkStatus() {
    const offlineBadge = document.getElementById("pwa-offline-badge");
    if (!offlineBadge) return;
    if (navigator.onLine === false) {
      offlineBadge.classList.remove("hidden");
    } else {
      offlineBadge.classList.add("hidden");
    }
  }
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  updateNetworkStatus();

  // 4. Initial Theme-Color Sync
  setTimeout(() => syncPwaThemeColor(), 100);
}

/**
 * Initializes the download menu actions (HTML & PDF).
 */
function initDownloadButton() {
  if (typeof document === "undefined") return;
  const htmlBtn = document.getElementById("download-html-btn");
  const pdfBtn = document.getElementById("download-pdf-btn");

  initModeBadge();

  if (htmlBtn) {
    htmlBtn.addEventListener("click", async () => {
      try {
        htmlBtn.disabled = true;
        const isPub = typeof HTMLReportPublisher !== "undefined" && typeof HTMLReportPublisher.isPublishedFlagOn === "function" && HTMLReportPublisher.isPublishedFlagOn();
        const htmlContent = await buildInlinedHtmlSnapshot(isPub ? { mode: "published" } : {});
        const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const docTitle = document.title || "html-report";
        const baseName = docTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        a.download = isPub ? `${baseName}-published.html` : `${baseName}-standalone.html`;
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
      const reportMode = document.documentElement.getAttribute("data-report-mode") || "report";
      if (reportMode !== "print") {
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

/**
 * Day.js runtime initialization & data-dayjs hydration.
 */
function initDayjs() {
  if (typeof window === "undefined" || !window.dayjs) return;
  try {
    if (window.dayjs_plugin_relativeTime) {
      window.dayjs.extend(window.dayjs_plugin_relativeTime);
    }
    if (window.dayjs_plugin_customParseFormat) {
      window.dayjs.extend(window.dayjs_plugin_customParseFormat);
    }
  } catch (err) {
    console.warn("[html-report] Day.js plugin registration notice:", err);
  }

  try {
    document.querySelectorAll("[data-dayjs]").forEach((el) => {
      const raw = el.getAttribute("data-dayjs");
      const format = el.getAttribute("data-dayjs-format") || "YYYY-MM-DD HH:mm:ss";
      const fromNow = el.hasAttribute("data-dayjs-from-now") || el.getAttribute("data-dayjs-relative") === "true";
      const d = (raw && raw !== "now" && raw !== "true") ? window.dayjs(raw) : window.dayjs();
      if (fromNow && typeof d.fromNow === "function") {
        el.textContent = d.fromNow();
      } else {
        el.textContent = d.format(format);
      }
    });
  } catch (err) {
    console.warn("[html-report] Day.js DOM hydration notice:", err);
  }
}

/**
 * Impress.js runtime initialization with strict presentation guard.
 * Only initializes 3D canvas when explicitly requested as a presentation.
 */
function initImpress() {
  if (typeof window === "undefined") return;

  const impressRoot = document.getElementById("impress");
  if (!impressRoot) return;

  // Setup presentation mode observer once
  if (!window._impressObserverInstalled) {
    window._impressObserverInstalled = true;
    const observer = new MutationObserver(() => {
      initImpress();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-presentation"] });
    if (document.body) {
      observer.observe(document.body, { attributes: true, attributeFilter: ["data-presentation"] });
    }
  }

  // Presentation Guard: Impress 3D initialization ONLY activates when explicitly requested
  const isPresentationRequested =
    document.documentElement.getAttribute("data-presentation") === "true" ||
    document.body.getAttribute("data-presentation") === "true" ||
    impressRoot.getAttribute("data-presentation") === "true" ||
    impressRoot.classList.contains("impress-presentation-active");

  if (!isPresentationRequested) {
    // Treat as print/static: slides remain stacked in standard document flow
    impressRoot.classList.add("impress-static-fallback");
    return;
  }

  // Presentation mode active: clear static fallback
  impressRoot.classList.remove("impress-static-fallback");

  if (!window.impress) {
    console.warn("[html-report] Impress.js script not loaded.");
    return;
  }

  try {
    if (!impressRoot.dataset.impressInitialized) {
      impressRoot.dataset.impressInitialized = "true";
      const api = window.impress("impress");
      api.init();
      window.impressApi = api;
    } else if (window.impressApi && typeof window.impressApi.goto === "function") {
      window.impressApi.goto(0);
    }
  } catch (err) {
    console.warn("[html-report] Impress.js initialization notice:", err);
  }
}

function impressNext() {
  if (typeof window !== "undefined" && window.impressApi && typeof window.impressApi.next === "function") {
    return window.impressApi.next();
  }
}

function impressPrev() {
  if (typeof window !== "undefined" && window.impressApi && typeof window.impressApi.prev === "function") {
    return window.impressApi.prev();
  }
}

function impressGoto(step) {
  if (typeof window !== "undefined" && window.impressApi && typeof window.impressApi.goto === "function") {
    return window.impressApi.goto(step);
  }
}

/**
 * Mock.js runtime initialization & data-mock hydration.
 */
function initMockjs() {
  if (typeof window === "undefined" || !window.Mock) return;
  try {
    document.querySelectorAll("[data-mock]").forEach((el) => {
      if (el.dataset.mockInitialized) return;
      el.dataset.mockInitialized = "true";
      const raw = el.getAttribute("data-mock");
      if (!raw) return;
      try {
        const schema = JSON.parse(raw);
        const data = window.Mock.mock(schema);
        if (el.tagName.toLowerCase() === "code" || el.tagName.toLowerCase() === "pre") {
          el.textContent = JSON.stringify(data, null, 2);
        } else if (el.hasAttribute("data-mock-target")) {
          const target = document.querySelector(el.getAttribute("data-mock-target"));
          if (target) target.textContent = JSON.stringify(data, null, 2);
        }
      } catch (parseErr) {
        const data = window.Mock.mock(raw);
        el.textContent = String(data);
      }
    });
  } catch (err) {
    console.warn("[html-report] Mock.js hydration notice:", err);
  }
}

/**
 * Auto-links any mentioned *.md files in text nodes to interactive viewer triggers.
 */
function autoLinkMarkdownFiles(root = document.body) {
  if (typeof document === "undefined" || !root) return;
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.includes(".md")) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (tag === "a" || tag === "script" || tag === "style" || tag === "button" || tag === "textarea") {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    const mdRegex = /\b([a-zA-Z0-9_\/-]+\.md)\b/g;
    for (const node of nodes) {
      const text = node.nodeValue;
      if (!text || !text.match(mdRegex)) continue;
      const span = document.createElement("span");
      span.innerHTML = text.replace(mdRegex, (match) => {
        return `<a href="${match}" onclick="if(window.openMarkdownViewer){window.openMarkdownViewer('${match}');return false;}" class="link link-primary font-mono text-xs underline decoration-primary/40 hover:decoration-primary cursor-pointer">${match}</a>`;
      });
      node.parentNode.replaceChild(span, node);
    }
  } catch (_) {}
}

/**
 * Showdown runtime initialization & data-showdown hydration.
 */
function initShowdown() {
  if (typeof window === "undefined" || !window.showdown) return;
  try {
    const converter = new window.showdown.Converter({
      tables: true,
      tasklists: true,
      strikethrough: true,
      emoji: true,
      ghCodeBlocks: true
    });
    window.showdownConverter = converter;

    document.querySelectorAll("[data-showdown], [data-markdown-showdown]").forEach((el) => {
      if (el._sdInitialized || el.dataset.sdInitialized) return;
      el._sdInitialized = true;
      el.dataset.sdInitialized = "true";
      const srcSelector = el.getAttribute("data-showdown-source") || el.getAttribute("data-markdown-showdown-source");
      let md = "";
      if (srcSelector) {
        const srcEl = document.querySelector(srcSelector);
        if (srcEl) {
          md = srcEl.value !== undefined ? srcEl.value : srcEl.textContent;
        }
      } else {
        const rawAttr = el.getAttribute("data-markdown-showdown") || el.getAttribute("data-showdown");
        md = (rawAttr && rawAttr !== "true") ? rawAttr : el.textContent;
      }
      if (md) {
        el.innerHTML = converter.makeHtml(md);
      }
    });
  } catch (err) {
    console.warn("[html-report] Showdown markdown rendering notice:", err);
  }
}

/**
 * FullCalendar runtime initialization & DaisyUI theme synchronization.
 */
function initFullCalendar(retries = 25) {
  if (typeof window === "undefined") return;
  const calendarEls = document.querySelectorAll(
    "div[data-fullcalendar], div#calendar, [data-fullcalendar]:not(style):not(head *)"
  );
  if (!calendarEls.length) return;

  if (!window.FullCalendar) {
    if (retries > 0) {
      setTimeout(() => initFullCalendar(retries - 1), 100);
    }
    return;
  }

  window.reportCalendars = window.reportCalendars || [];

  try {
    calendarEls.forEach((el) => {
      if (el.dataset.calendarInitialized || el.tagName === "STYLE" || el.closest("head")) return;
      el.dataset.calendarInitialized = "true";

      let events = [];
      const rawEvents = el.getAttribute("data-calendar-events");
      if (rawEvents) {
        try {
          events = JSON.parse(rawEvents);
        } catch (_) {}
      }

      const calendar = new window.FullCalendar.Calendar(el, {
        initialView: el.getAttribute("data-calendar-view") || "dayGridMonth",
        headerToolbar: {
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,listWeek"
        },
        height: el.getAttribute("data-calendar-height") || "auto",
        events: events
      });
      calendar.render();
      window.reportCalendars.push(calendar);
    });
  } catch (err) {
    console.warn("[html-report] FullCalendar initialization notice:", err);
  }
}

/**
 * Rehydrates Lucide icons in the DOM.
 */
function rehydrateLucideIcons(root = null) {
  if (typeof window === "undefined" || !window.lucide || typeof window.lucide.createIcons !== "function") return;
  try {
    if (root && root.nodeType === 1) {
      window.lucide.createIcons({ root });
    } else {
      window.lucide.createIcons();
    }
  } catch (err) {
    console.warn("[html-report] Lucide icon rehydration notice:", err);
  }
}

/**
 * Initializes MutationObserver to rehydrate Lucide icons post-morph and handle Datastar signal events.
 */
let _datastarObserverInstance = null;
let _lucideRehydrationTimer = null;

function initDatastarObserver() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return null;
  if (typeof document === "undefined" || !document.body) return null;
  if (_datastarObserverInstance) return _datastarObserverInstance;

  _datastarObserverInstance = new MutationObserver((mutations) => {
    let needsRehydrate = false;
    for (const m of mutations) {
      if (m.type === "childList" && m.addedNodes.length > 0) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            if (node.hasAttribute && node.hasAttribute("data-lucide")) {
              needsRehydrate = true;
              break;
            }
            if (node.querySelector && node.querySelector("[data-lucide]")) {
              needsRehydrate = true;
              break;
            }
          }
        }
      }
      if (needsRehydrate) break;
    }

    if (needsRehydrate) {
      if (_lucideRehydrationTimer) clearTimeout(_lucideRehydrationTimer);
      _lucideRehydrationTimer = setTimeout(() => {
        rehydrateLucideIcons();
      }, 16);
    }
  });

  _datastarObserverInstance.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also listen for explicit Datastar fragment events if dispatched
  document.addEventListener("datastar-fragment-applied", () => {
    rehydrateLucideIcons();
  });

  return _datastarObserverInstance;
}

/**
 * Synchronizes DaisyUI theme switcher selection with Datastar $theme reactive signal.
 */
function syncDatastarTheme(themeName) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // 1. Dispatch custom event for Datastar signals
  try {
    const evt = new CustomEvent("datastar-merge-signals", {
      bubbles: true,
      detail: { theme: themeName }
    });
    document.dispatchEvent(evt);
  } catch (_) {}

  // 2. Direct API call if Datastar is active on window
  if (window.datastar) {
    if (typeof window.datastar.mergeSignals === "function") {
      try { window.datastar.mergeSignals({ theme: themeName }); } catch (_) {}
    } else if (window.datastar.signals && typeof window.datastar.signals === "object") {
      try { window.datastar.signals.theme = themeName; } catch (_) {}
    }
  }

  // 3. Update DOM signal attributes for initial or bound elements
  try {
    const signalHolders = document.querySelectorAll("[data-signals]");
    signalHolders.forEach((el) => {
      if (el._dsSignals && typeof el._dsSignals === "object") {
        el._dsSignals.theme = themeName;
      }
    });
  } catch (_) {}
}

// =============================================================================
// Declarative Public Feeds & Signal Bus
// =============================================================================

let _activeFeedPollers = [];

/**
 * Parses and returns the Nickname Registry from <script id="feed-registry">.
 */
function getFeedRegistry(root) {
  const doc = (root && typeof root.querySelector === "function")
    ? root
    : (root && root.ownerDocument ? root.ownerDocument : (typeof document !== "undefined" ? document : null));
  if (!doc) return {};
  const script = doc.querySelector("script#feed-registry[type='application/json'], script#feed-registry");
  if (!script || !script.textContent) return {};
  try {
    return JSON.parse(script.textContent);
  } catch (err) {
    console.warn("[html-report] Failed to parse #feed-registry JSON:", err);
    return {};
  }
}

/**
 * Resolves a raw feed reference (either @nickname or direct URL).
 */
function resolveFeedUrl(rawFeed, registry = {}) {
  if (!rawFeed || typeof rawFeed !== "string") {
    return { url: null, error: "Empty feed declaration", nickname: null };
  }
  const trimmed = rawFeed.trim();
  if (trimmed.startsWith("@")) {
    const nickname = trimmed.slice(1);
    const resolved = registry[nickname];
    if (!resolved) {
      const msg = `Unknown feed nickname: @${nickname}`;
      console.warn(`[html-report] ${msg}`);
      return { url: null, error: msg, nickname };
    }
    return { url: resolved, nickname, error: null };
  }
  return { url: trimmed, nickname: null, error: null };
}

/**
 * Extracts specified top-level or dot-notated nested fields from JSON payload.
 */
function extractFeedFields(payload, fieldsAttr, prefix = "") {
  const result = {};
  if (payload === null || payload === undefined) {
    return result;
  }
  if (typeof payload !== "object") {
    const key = prefix ? `${prefix}val` : "val";
    result[key] = payload;
    return result;
  }

  if (fieldsAttr && typeof fieldsAttr === "string" && fieldsAttr.trim()) {
    const fields = fieldsAttr.split(",").map((s) => s.trim()).filter(Boolean);
    for (const field of fields) {
      const parts = field.split(".");
      let current = payload;
      let found = true;
      for (const p of parts) {
        if (current !== null && typeof current === "object" && p in current) {
          current = current[p];
        } else {
          found = false;
          break;
        }
      }
      if (found) {
        const keyName = prefix + field.replace(/\./g, "_");
        result[keyName] = current;
      }
    }
  } else {
    // Default: extract all top-level keys
    for (const [k, v] of Object.entries(payload)) {
      const keyName = prefix + k.replace(/\./g, "_");
      result[keyName] = v;
    }
  }
  return result;
}

/**
 * Dispatches Datastar signal updates to the document and runtime window.
 */
function mergeFeedSignals(signalsObj) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!signalsObj || Object.keys(signalsObj).length === 0) return;

  try {
    const evt = new CustomEvent("datastar-merge-signals", {
      bubbles: true,
      detail: signalsObj
    });
    document.dispatchEvent(evt);
  } catch (_) {}

  if (window.datastar) {
    if (typeof window.datastar.mergeSignals === "function") {
      try { window.datastar.mergeSignals(signalsObj); } catch (_) {}
    } else if (window.datastar.signals && typeof window.datastar.signals === "object") {
      try { Object.assign(window.datastar.signals, signalsObj); } catch (_) {}
    }
  }

  try {
    const signalHolders = document.querySelectorAll("[data-signals]");
    signalHolders.forEach((el) => {
      if (el._dsSignals && typeof el._dsSignals === "object") {
        Object.assign(el._dsSignals, signalsObj);
      }
    });
  } catch (_) {}
}

/**
 * Updates Chart.js canvases tagged with [data-feed-chart].
 */
function updateFeedCharts(signals, timestamp = Date.now()) {
  if (typeof document === "undefined" || !signals || typeof signals !== "object") return;
  const chartCanvases = document.querySelectorAll("canvas[data-feed-chart]");
  chartCanvases.forEach((canvas) => {
    const signalKey = canvas.getAttribute("data-feed-chart");
    if (!signalKey || signals[signalKey] === undefined) return;
    const rawVal = signals[signalKey];
    const numVal = Number(rawVal);
    if (isNaN(numVal)) return;

    const bufferMax = parseInt(canvas.getAttribute("data-feed-buffer") || "20", 10) || 20;

    // Resolve chart instance
    let chart = null;
    if (typeof window !== "undefined") {
      if (window.Chart && typeof window.Chart.getChart === "function") {
        chart = window.Chart.getChart(canvas);
      }
      if (!chart && canvas._chart) chart = canvas._chart;
      if (!chart && canvas.chart) chart = canvas.chart;
      if (!chart && window.reportCharts && Array.isArray(window.reportCharts)) {
        chart = window.reportCharts.find((c) => c && (c.canvas === canvas || c === canvas._chart));
      }
    }

    if (chart && chart.data && chart.data.datasets && chart.data.datasets[0]) {
      const d = new Date(timestamp);
      const timeLabel = d.toTimeString().split(" ")[0]; // HH:MM:SS
      if (!chart.data.labels) chart.data.labels = [];
      chart.data.labels.push(timeLabel);
      if (!chart.data.datasets[0].data) chart.data.datasets[0].data = [];
      chart.data.datasets[0].data.push(numVal);

      while (chart.data.labels.length > bufferMax) {
        chart.data.labels.shift();
      }
      while (chart.data.datasets[0].data.length > bufferMax) {
        chart.data.datasets[0].data.shift();
      }

      if (typeof chart.update === "function") {
        chart.update("none");
      }
    }
  });
}

/**
 * Stops all active polling intervals and aborts in-flight network requests.
 */
function cleanupPublicFeeds() {
  if (_activeFeedPollers && _activeFeedPollers.length > 0) {
    for (const poller of _activeFeedPollers) {
      if (poller.timerId) {
        clearInterval(poller.timerId);
      }
      if (poller.abortController) {
        try { poller.abortController.abort(); } catch (_) {}
      }
    }
    _activeFeedPollers = [];
  }
}

/**
 * Discovers and initializes all declarative public feed bindings.
 */
function initPublicFeeds(rootElement) {
  if (typeof document === "undefined") return [];
  const root = rootElement || document;

  cleanupPublicFeeds();

  const feedElements = Array.from(root.querySelectorAll("[data-public-feed]"));
  if (feedElements.length === 0) return [];

  const registry = getFeedRegistry(root);
  const isOfflineOrPdf = (typeof window !== "undefined" && (window.__PLAYWRIGHT_PDF_MODE__ || (typeof navigator !== "undefined" && navigator.onLine === false)));

  // 1. Process fallback data if present
  for (const el of feedElements) {
    const fallbackStr = el.getAttribute("data-feed-fallback");
    if (fallbackStr) {
      try {
        const fallbackData = JSON.parse(fallbackStr);
        const fields = el.getAttribute("data-feed-fields");
        const prefix = el.getAttribute("data-feed-prefix") || "";
        const signals = extractFeedFields(fallbackData, fields, prefix);
        mergeFeedSignals(signals);
        updateFeedCharts(signals, Date.now());
      } catch (e) {
        console.warn("[html-report] Invalid data-feed-fallback JSON:", e);
      }
    }
  }

  if (isOfflineOrPdf) {
    return feedElements;
  }

  // 2. Group by resolved URL & interval for request deduplication
  const groups = new Map();

  for (const el of feedElements) {
    const rawFeed = el.getAttribute("data-public-feed");
    const { url, nickname, error } = resolveFeedUrl(rawFeed, registry);

    if (error) {
      mergeFeedSignals({ feed_error: error });
      continue;
    }

    const intervalAttr = el.getAttribute("data-feed-interval");
    const parsedInterval = intervalAttr ? parseInt(intervalAttr, 10) : 60000;
    const minGuard = (typeof window !== "undefined" && window.__FEED_MIN_INTERVAL__ !== undefined) ? window.__FEED_MIN_INTERVAL__ : 10000;
    const interval = Math.max(minGuard, isNaN(parsedInterval) ? 60000 : parsedInterval);

    const groupKey = `${url}::${interval}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        url,
        interval,
        subscribers: []
      });
    }

    groups.get(groupKey).subscribers.push({
      el,
      nickname,
      url,
      fields: el.getAttribute("data-feed-fields"),
      prefix: el.getAttribute("data-feed-prefix") || ""
    });
  }

  // 3. Initiate single fetch and periodic poller for each unique group
  for (const [groupKey, group] of groups.entries()) {
    const abortController = typeof AbortController !== "undefined" ? new AbortController() : null;
    const pollerRecord = {
      groupKey,
      url: group.url,
      interval: group.interval,
      abortController,
      timerId: null,
      subscribers: group.subscribers
    };

    const executeFetch = async () => {
      if (pollerRecord.abortController && pollerRecord.abortController.signal.aborted) return;
      try {
        const fetchOptions = pollerRecord.abortController ? { signal: pollerRecord.abortController.signal } : {};
        const response = await fetch(group.url, fetchOptions);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const timestamp = Date.now();
        const combinedSignals = {};

        for (const sub of group.subscribers) {
          const signals = extractFeedFields(data, sub.fields, sub.prefix);
          Object.assign(combinedSignals, signals);
        }

        mergeFeedSignals(combinedSignals);
        updateFeedCharts(combinedSignals, timestamp);

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("feed:tick", {
            detail: {
              feedId: group.subscribers[0].nickname ? `@${group.subscribers[0].nickname}` : group.url,
              url: group.url,
              data,
              signals: combinedSignals,
              timestamp
            }
          }));
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        console.warn(`[html-report] Feed fetch failed for ${group.url}:`, err);
        mergeFeedSignals({ feed_error: err.message || "Fetch failed" });
      }
    };

    // Immediate initial fetch
    executeFetch();

    // Schedule interval
    pollerRecord.timerId = setInterval(executeFetch, group.interval);
    _activeFeedPollers.push(pollerRecord);
  }

  return feedElements;
}

// Global browser window bindings
if (typeof window !== "undefined") {
  window.STANDARD_DAISYUI_THEMES = STANDARD_DAISYUI_THEMES;
  window.DAISYUI_THEMES = DAISYUI_THEMES;
  window.registerCustomTheme = registerCustomTheme;
  window.scanAndRegisterExistingCustomThemes = scanAndRegisterExistingCustomThemes;
  window.srgbToLinear = srgbToLinear;
  window.linearToSrgb = linearToSrgb;
  window.hexToRgb = hexToRgb;
  window.hslToRgb = hslToRgb;
  window.parseColor = parseColor;
  window.rgbToOklch = rgbToOklch;
  window.autoContrastContent = autoContrastContent;
  window.compileTheme = compileTheme;
  window.tailwindConfigSnippet = tailwindConfigSnippet;
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
  window.initModeBadge = initModeBadge;
  window.initDownloadButton = initDownloadButton;
  window.initDayjs = initDayjs;
  window.initImpress = initImpress;
  window.impressNext = impressNext;
  window.impressPrev = impressPrev;
  window.impressGoto = impressGoto;
  window.initMockjs = initMockjs;
  window.initShowdown = initShowdown;
  window.initFullCalendar = initFullCalendar;
  window.rehydrateLucideIcons = rehydrateLucideIcons;
  window.initDatastarObserver = initDatastarObserver;
  window.syncDatastarTheme = syncDatastarTheme;
  window.autoLinkMarkdownFiles = autoLinkMarkdownFiles;
  window.reinitReportContent = reinitReportContent;
  window.initPublicFeeds = initPublicFeeds;
  window.cleanupPublicFeeds = cleanupPublicFeeds;
  window.resolveFeedUrl = resolveFeedUrl;
  window.getFeedRegistry = getFeedRegistry;
  window.extractFeedFields = extractFeedFields;
  window.updateFeedCharts = updateFeedCharts;
  window.syncPwaThemeColor = syncPwaThemeColor;
  window.initPwa = initPwa;

  window.addEventListener("DOMContentLoaded", async () => {
    try { scanAndRegisterExistingCustomThemes(); } catch (_) {}
    try { if (window.lucide && typeof window.lucide.createIcons === "function") window.lucide.createIcons(); } catch (_) {}
    try { initTOC(); } catch (_) {}
    try { initModeBadge(); } catch (_) {}
    try { initThemeDropdown(); } catch (_) {}
    try { initDownloadButton(); } catch (_) {}
    try { initPwa(); } catch (_) {}
    try { if (window.hljs && typeof window.hljs.highlightAll === "function") window.hljs.highlightAll(); } catch (_) {}
    try { initDayjs(); } catch (_) {}
    try { initShowdown(); } catch (_) {}
    try { initMockjs(); } catch (_) {}
    try { initFullCalendar(); } catch (_) {}
    try { initImpress(); } catch (_) {}
    try { initDatastarObserver(); } catch (_) {}
    try { autoLinkMarkdownFiles(); } catch (_) {}
    try { initPublicFeeds(); } catch (_) {}

    const palette = resolveDaisyUIThemePalette();
    try { await renderMermaidWithTheme(palette); } catch (_) {}
    try { if (typeof HTMLReportMermaid !== "undefined") HTMLReportMermaid.initEnlarge(); } catch (_) {}
    try { checkInsufficientHorizontalSpace(); } catch (_) {}
    try { if (typeof HTMLReportAgent !== "undefined") HTMLReportAgent.init(); } catch (_) {}
    try { initAuthoring(); } catch (err) { console.warn("[html-report] authoring init failed:", err); }
    window.addEventListener("resize", () => checkInsufficientHorizontalSpace());
    window.addEventListener("beforeunload", () => {
      try { cleanupPublicFeeds(); } catch (_) {}
      try { if (typeof HTMLReportAgent !== "undefined") HTMLReportAgent.stopHeartbeat(); } catch (_) {}
    });
    window.__REPORT_READY__ = true;
  });
}

/**
 * Re-runs content-level hydration after <main> was hot-swapped in place by the
 * live-reload dev server (no full page reload, so theme + scroll are preserved).
 * Only touches content hooks; navbar/theme/download wiring stays as-is.
 */
async function reinitReportContent() {
  if (typeof document === "undefined") return;
  try { cleanupPublicFeeds(); } catch (_) {}
  try { rehydrateLucideIcons(); } catch (_) {}
  try { initTOC(); } catch (_) {}
  try { if (window.hljs && typeof window.hljs.highlightAll === "function") window.hljs.highlightAll(); } catch (_) {}
  try { initDayjs(); } catch (_) {}
  try { autoLinkMarkdownFiles(); } catch (_) {}
  try { await renderMermaidWithTheme(resolveDaisyUIThemePalette()); } catch (_) {}
  try { if (typeof HTMLReportMermaid !== "undefined") HTMLReportMermaid.initEnlarge(); } catch (_) {}
  try { checkInsufficientHorizontalSpace(); } catch (_) {}
  try { initPublicFeeds(); } catch (_) {}
}

/**
 * Universal Two-Way Agent Bridge Client
 * Provides programmatic co-pilot inference and action execution from reports.
 */
const HTMLReportAgent = {
  _connectionState: "checking",
  _listeners: new Set(),
  _heartbeatTimer: null,
  _sessionId: null,
  _targetElement: null,
  _isDockOpen: false,
  _dockInitialized: false,
  _history: [],

  getState: function() {
    return this._connectionState;
  },

  onStateChange: function(fn) {
    if (typeof fn === "function") {
      this._listeners.add(fn);
      return () => this._listeners.delete(fn);
    }
    return () => {};
  },

  _updateState: function(newState, data) {
    this._connectionState = newState;
    if (typeof document !== "undefined") {
      const container = document.getElementById("agent-bridge-status-container");
      const btn = document.getElementById("agent-bridge-status-btn");
      const indicator = document.getElementById("agent-bridge-status-indicator");
      const text = document.getElementById("agent-bridge-status-text");

      const dockDot = document.getElementById("agent-dock-dot");
      const dockPing = document.getElementById("agent-dock-ping");
      const dockStatus = document.getElementById("agent-dock-status");

      if (container) {
        container.classList.remove("hidden");
        container.classList.add("flex");
      }

      if (btn && indicator && text) {
        if (newState === "connected") {
          btn.className = "badge badge-success badge-xs sm:badge-sm font-mono gap-1 transition shadow-sm cursor-pointer border border-success/40 text-success-content";
          indicator.className = "inline-block w-1.5 h-1.5 rounded-full bg-success-content animate-pulse";
          text.textContent = "LIVE AGENT";
          btn.title = `Two-Way Agent Bridge Connected (${data?.bridge || 'agy CLI'})`;
          const modal = document.getElementById("agent-reconnect-modal");
          if (modal && typeof modal.close === "function" && modal.open) {
            modal.close();
          }
        } else if (newState === "disconnected") {
          btn.className = "badge badge-warning badge-xs sm:badge-sm font-mono gap-1 transition shadow-sm cursor-pointer border border-warning/40 text-warning-content animate-pulse";
          indicator.className = "inline-block w-1.5 h-1.5 rounded-full bg-warning-content";
          text.textContent = "AGENT OFFLINE";
          btn.title = "Agent Bridge Disconnected. Click to restore connection.";
        } else {
          btn.className = "badge badge-ghost badge-xs sm:badge-sm font-mono gap-1 transition shadow-sm cursor-pointer border border-base-300";
          indicator.className = "inline-block w-1.5 h-1.5 rounded-full bg-base-content/40 animate-pulse";
          text.textContent = "CHECKING...";
        }
      }

      if (dockDot && dockPing) {
        if (newState === "connected") {
          dockDot.className = "relative inline-flex rounded-full h-2.5 w-2.5 bg-success-content";
          dockPing.className = "animate-ping absolute inline-flex h-full w-full rounded-full bg-success-content opacity-75";
          if (dockStatus) dockStatus.textContent = "Online • Live AI Assistant";
        } else if (newState === "disconnected") {
          dockDot.className = "relative inline-flex rounded-full h-2.5 w-2.5 bg-warning-content";
          dockPing.className = "hidden";
          if (dockStatus) dockStatus.textContent = "Offline • Local Fallback";
        } else {
          dockDot.className = "relative inline-flex rounded-full h-2.5 w-2.5 bg-base-content/40";
          dockPing.className = "hidden";
          if (dockStatus) dockStatus.textContent = "Probing Agent...";
        }
      }
    }

    for (const listener of this._listeners) {
      try { listener(newState, data); } catch (_) {}
    }
  },

  checkConnection: async function(btnEl) {
    if (btnEl) {
      btnEl.disabled = true;
      const originalText = btnEl.innerHTML;
      btnEl.innerHTML = `<span class="loading loading-spinner loading-xs mr-1"></span> Probing...`;
      setTimeout(() => {
        btnEl.disabled = false;
        btnEl.innerHTML = originalText;
      }, 1000);
    }

    // In standalone file:// mode, fetch scheme is unsupported by browsers; flag disconnected without probing
    if (typeof window !== "undefined" && window.location && window.location.protocol === "file:") {
      this._updateState("disconnected");
      return false;
    }

    try {
      const endpoint = (typeof window === "undefined" && typeof process !== "undefined")
        ? `http://127.0.0.1:${process.env.REPORT_PORT || 3000}/__agent_status__`
        : "/__agent_status__";

      const res = await fetch(endpoint, { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          this._updateState("connected", data);
          return true;
        }
      }
    } catch (_) {}

    this._updateState("disconnected");
    return false;
  },

  isAvailable: async function() {
    return await this.checkConnection();
  },

  registerPersona: async function(persona) {
    if (!persona || !persona.id) return { ok: false, error: "Invalid persona object" };
    try {
      const res = await fetch("/api/agent/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(persona)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {}
    return { ok: true, registered: persona.id, localOnly: true, persona };
  },

  getPersonas: async function() {
    try {
      const res = await fetch("/api/agent/personas", { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        return data.personas || [];
      }
    } catch (_) {}
    return [
      { id: "analyst", name: "Telemetry Analyst", badgeColor: "badge-primary", icon: "trending-up" },
      { id: "debugger", name: "Systems Debugger", badgeColor: "badge-error", icon: "bug" },
      { id: "strategist", name: "Competitive Strategist", badgeColor: "badge-secondary", icon: "target" },
      { id: "executive", name: "Executive Advisor", badgeColor: "badge-neutral", icon: "briefcase" },
      { id: "sarcastic", name: "Sarcastic Critic", badgeColor: "badge-warning", icon: "flame" },
      { id: "oak", name: "Professor Oak", badgeColor: "badge-accent", icon: "book-open" },
      { id: "hype", name: "Esports Shoutcaster", badgeColor: "badge-info", icon: "zap" }
    ];
  },

  getReconnectPrompt: function(options = {}) {
    let filename = options.filename;
    if (!filename && typeof document !== "undefined") {
      const srcMeta = document.querySelector('meta[name="html-report-source"]');
      if (srcMeta && srcMeta.getAttribute("content")) filename = srcMeta.getAttribute("content").replace(/^\.\//, "");
    }
    if (!filename && typeof window !== "undefined") {
      filename = window.location.pathname.split("/").filter(Boolean).pop();
    }
    if (!filename || filename === "" || filename === "/") {
      filename = "report.html";
    }
    const port = options.port || 3000;
    const title = options.title || (typeof document !== "undefined" && document.title) || "Interactive HTML Report";

    return `I am viewing an interactive publication report: "${title}" (${filename}).
This report features an active Two-Way AI Agent Bridge and Datastar live hypermedia, but the local development server is currently offline or disconnected.

Please restore the two-way agent bridge by starting the report dev server in the background:
\`\`\`bash
node skills/html-report/scripts/serve-report.mjs ${filename} --port ${port} --no-open
\`\`\`

Prerequisites & Instructions:
- Requires Node.js (v18+) in your workspace to run the dev server (uses standard node libraries; zero npm dependencies or npm install required).
- If Node.js is not installed on this machine, please inform the user that this report is already 100% readable and interactive in static offline mode without Node.
- Once started, keep this process running in the background. The report in my browser will automatically detect the connection, update its live badges, and unlock interactive co-pilot queries.${options.extra ? "\n\nAfter the bridge is up, also apply this edit request:\n" + options.extra : ""}`;
  },

  copyReconnectPrompt: async function(btnEl, options = {}) {
    const promptText = this.getReconnectPrompt(options);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(promptText);
      }
      if (btnEl) {
        const originalHtml = btnEl.innerHTML;
        btnEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-success inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> <span class="text-success font-bold">Copied to Clipboard!</span>`;
        btnEl.classList.add("btn-success");
        setTimeout(() => {
          btnEl.innerHTML = originalHtml;
          btnEl.classList.remove("btn-success");
        }, 2200);
      }
      return true;
    } catch (err) {
      console.warn("Failed to copy reconnect prompt to clipboard:", err);
      return false;
    }
  },

  openReconnectModal: function(options = {}) {
    if (typeof document === "undefined") return;
    const modal = document.getElementById("agent-reconnect-modal");
    const preview = document.getElementById("agent-reconnect-prompt-preview");
    if (preview) {
      preview.textContent = this.getReconnectPrompt(options);
    }
    if (modal && typeof modal.showModal === "function") {
      modal.showModal();
    }
  },

  closeReconnectModal: function() {
    if (typeof document === "undefined") return;
    const modal = document.getElementById("agent-reconnect-modal");
    if (modal && typeof modal.close === "function") {
      modal.close();
    }
  },

  startHeartbeat: function(intervalMs = 4000) {
    if (typeof window === "undefined") return;
    if (window.location && window.location.protocol === "file:") return;
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);

    this._heartbeatTimer = setInterval(async () => {
      if (this._connectionState === "disconnected") {
        await this.checkConnection();
      }
    }, intervalMs);
  },

  stopHeartbeat: function() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  },

  init: function() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    if (!this._dockInitialized) {
      this._dockInitialized = true;
      document.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key && e.key.toLowerCase() === "k") {
          if (!this.isAiCapable()) return;
          e.preventDefault();
          this.toggleDock();
        }
      });

      document.addEventListener("click", (e) => {
        const trigger = e.target && e.target.closest && e.target.closest("[data-agent-prompt], [data-agent-inspect]");
        if (trigger) {
          e.preventDefault();
          const target = trigger.getAttribute("data-agent-target") || (trigger.closest && trigger.closest(".card, [data-agent-target]"));
          const prompt = trigger.getAttribute("data-agent-prompt");
          this.openDock({ target, prompt });
        }
      });
    }

    const hasAgentTriggers = this.isAiCapable();

    if (hasAgentTriggers) {
      const container = document.getElementById("agent-bridge-status-container");
      if (container) {
        container.classList.remove("hidden");
        container.classList.add("flex");
      }
      if (window.location && window.location.protocol === "file:") {
        this._updateState("disconnected");
      } else {
        this.checkConnection();
        this.startHeartbeat();
      }
    }

    this._updateDockVisibility();
  },

  _updateDockVisibility: function() {
    if (typeof document === "undefined") return;
    const dockContainer = document.getElementById("agent-dock-container");
    const capable = this.isAiCapable();
    if (dockContainer) {
      dockContainer.classList.toggle("hidden", !capable);
    }
    if (!capable && this._isDockOpen) {
      this.closeDock();
    }
  },

  getSessionId: function() {
    if (!this._sessionId) {
      this._sessionId = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    }
    return this._sessionId;
  },

  serializeElementContext: function(target) {
    let el = null;
    if (typeof target === "string") {
      try { el = document.querySelector(target); } catch (_) {}
    } else if (target && (typeof target === "object" || (typeof Element !== "undefined" && target instanceof Element))) {
      el = target;
    }

    const activeTheme = (typeof document !== "undefined" && document.documentElement && document.documentElement.getAttribute("data-theme")) || "light";

    if (!el) {
      return {
        elementId: null,
        selector: null,
        domSnippet: null,
        datasetState: null,
        activeTheme
      };
    }

    const container = (typeof el.closest === "function" && el.closest(".card, [data-agent-target], section, article, table, canvas")) || el;
    const elementId = container.id || (container.getAttribute && container.getAttribute("data-agent-target")) || (container.tagName.toLowerCase() + (container.className ? "." + String(container.className).split(" ")[0] : ""));
    const selector = container.id ? `#${container.id}` : ((container.getAttribute && container.getAttribute("data-agent-target")) ? `[data-agent-target="${container.getAttribute("data-agent-target")}"]` : container.tagName.toLowerCase());

    let datasetState = null;
    const canvasEl = container.tagName.toLowerCase() === "canvas" ? container : (container.querySelector ? container.querySelector("canvas") : null);
    if (canvasEl && typeof Chart !== "undefined" && typeof Chart.getChart === "function") {
      try {
        const chartInstance = Chart.getChart(canvasEl);
        if (chartInstance) {
          datasetState = {
            type: chartInstance.config?.type || "chart",
            labels: chartInstance.data?.labels || [],
            datasets: (chartInstance.data?.datasets || []).map((ds) => ({
              label: ds.label,
              data: ds.data
            }))
          };
        }
      } catch (_) {}
    }

    if (!datasetState && container.querySelector) {
      const tableEl = container.tagName.toLowerCase() === "table" ? container : container.querySelector("table");
      if (tableEl) {
        try {
          const headers = Array.from(tableEl.querySelectorAll("th")).map((th) => th.textContent.trim());
          const rows = Array.from(tableEl.querySelectorAll("tbody tr")).slice(0, 5).map((tr) =>
            Array.from(tr.querySelectorAll("td")).map((td) => td.textContent.trim())
          );
          datasetState = {
            type: "table",
            headers,
            sampleRows: rows
          };
        } catch (_) {}
      }
    }

    if (container.dataset && Object.keys(container.dataset).length > 0) {
      datasetState = datasetState || {};
      datasetState.attributes = { ...container.dataset };
    }

    let domSnippet = (container.outerHTML || container.innerHTML || "").trim();
    if (domSnippet.length > 4000) {
      domSnippet = domSnippet.slice(0, 4000) + "... [truncated]";
    }

    return {
      elementId,
      selector,
      domSnippet,
      datasetState,
      activeTheme
    };
  },

  openDock: function(options = {}) {
    if (typeof document === "undefined") return;
    if (!this.isAiCapable()) return;
    this._isDockOpen = true;
    const panel = document.getElementById("agent-dock-panel");
    const launcher = document.getElementById("agent-dock-launcher");
    const input = document.getElementById("agent-dock-input");

    if (panel) {
      panel.classList.remove("hidden");
    }
    if (launcher) {
      launcher.classList.add("hidden");
    }

    if (options.target || options.element) {
      this.setTargetElement(options.target || options.element);
    }
    if (options.prompt && input) {
      input.value = options.prompt;
    }

    if (input) {
      setTimeout(() => input.focus(), 50);
    }
  },

  closeDock: function() {
    if (typeof document === "undefined") return;
    this._isDockOpen = false;
    const panel = document.getElementById("agent-dock-panel");
    const launcher = document.getElementById("agent-dock-launcher");

    if (panel) {
      panel.classList.add("hidden");
    }
    if (launcher) {
      launcher.classList.remove("hidden");
    }
  },

  toggleDock: function() {
    if (this._isDockOpen) {
      this.closeDock();
    } else {
      this.openDock();
    }
  },

  setTargetElement: function(target) {
    if (typeof document === "undefined") return;
    let el = null;
    if (typeof target === "string") {
      try { el = document.querySelector(target); } catch (_) {}
    } else if (target && (typeof target === "object" || (typeof Element !== "undefined" && target instanceof Element))) {
      el = target;
    }

    this.clearTargetElement(false);

    if (el) {
      this._targetElement = el;
      if (el.classList) {
        el.classList.add("ring-2", "ring-primary", "ring-offset-2");
      }

      const label = document.getElementById("agent-dock-context-label");
      const clearBtn = document.getElementById("agent-dock-clear-context-btn");
      const ctx = this.serializeElementContext(el);

      if (label) {
        label.textContent = `Target: ${ctx.selector || ctx.elementId || "Element"}`;
        label.title = `Context: ${ctx.elementId} (${ctx.datasetState ? ctx.datasetState.type || "telemetry" : "DOM"})`;
      }
      if (clearBtn) {
        clearBtn.classList.remove("hidden");
      }
    }
  },

  clearTargetElement: function(resetUI = true) {
    if (this._targetElement && this._targetElement.classList) {
      this._targetElement.classList.remove("ring-2", "ring-primary", "ring-offset-2");
    }
    this._targetElement = null;

    if (resetUI && typeof document !== "undefined") {
      const label = document.getElementById("agent-dock-context-label");
      const clearBtn = document.getElementById("agent-dock-clear-context-btn");
      if (label) {
        label.textContent = "Context: Whole Document";
        label.removeAttribute("title");
      }
      if (clearBtn) {
        clearBtn.classList.add("hidden");
      }
    }
  },

  appendDockMessage: function(role, content, options = {}) {
    if (typeof document === "undefined") return null;
    const container = document.getElementById("agent-dock-messages");
    if (!container) return null;

    const msgEl = document.createElement("div");
    const msgId = options.id || `dock-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    msgEl.id = msgId;

    if (role === "user") {
      msgEl.className = "flex justify-end";
      msgEl.innerHTML = `
        <div class="max-w-[85%] p-2.5 rounded-2xl rounded-tr-none bg-primary text-primary-content shadow-sm text-xs break-words">
          ${typeof escapeHtml === "function" ? escapeHtml(content) : content}
        </div>
      `;
    } else {
      const persona = options.persona || "analyst";
      msgEl.className = "flex justify-start w-full";
      msgEl.innerHTML = `
        <div class="w-full max-w-[95%] p-3 rounded-2xl rounded-tl-none bg-base-200/90 border border-base-300 text-base-content shadow-sm space-y-2 text-xs">
          <div class="flex items-center justify-between text-[10px] text-base-content/60 pb-1 border-b border-base-300/50">
            <span class="font-mono font-semibold text-primary uppercase">${persona}</span>
            <span class="font-mono">${new Date().toLocaleTimeString()}</span>
          </div>
          <div class="prose prose-xs max-w-none text-base-content leading-relaxed message-content">
            ${content}
          </div>
          ${options.action ? this._renderActionCard(options.action) : ""}
        </div>
      `;
    }

    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
    return msgEl;
  },

  _formatMarkdown: function(text) {
    if (!text) return "";
    if (typeof window !== "undefined") {
      if (window.showdownConverter && typeof window.showdownConverter.makeHtml === "function") {
        return window.showdownConverter.makeHtml(text);
      }
      if (window.showdown && typeof window.showdown.Converter === "function") {
        const conv = new window.showdown.Converter({
          tables: true,
          tasklists: true,
          strikethrough: true,
          emoji: true,
          ghCodeBlocks: true
        });
        window.showdownConverter = conv;
        return conv.makeHtml(text);
      }
    }
    // Defensive built-in markdown formatter fallback
    let out = typeof escapeHtml === "function" ? escapeHtml(text) : text;
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*(.*?)\*/g, '<em>$1</em>');
    out = out.replace(/`([^`]+)`/g, '<code class="bg-base-300 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>');
    out = out.replace(/^### (.*$)/gim, '<h4 class="font-bold text-xs mt-2 mb-1 text-primary">$1</h4>');
    out = out.replace(/^## (.*$)/gim, '<h3 class="font-bold text-sm mt-2.5 mb-1 text-primary">$1</h3>');
    out = out.replace(/^# (.*$)/gim, '<h2 class="font-bold text-base mt-3 mb-1 text-primary">$1</h2>');
    out = out.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="ml-3 list-disc">$1</li>');
    out = out.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="ml-3 list-decimal">$1</li>');
    out = out.replace(/\n\n/g, '<div class="my-1.5"></div>').replace(/\n/g, '<br>');
    return out;
  },

  _renderActionCard: function(action) {
    if (!action || !action.id) return "";
    const escapedDesc = typeof escapeHtml === "function" ? escapeHtml(action.description || action.type) : (action.description || action.type);
    return `
      <div id="action-card-${action.id}" class="mt-2 p-2.5 rounded-xl bg-base-100 border border-warning/40 shadow-sm space-y-2">
        <div class="flex items-center gap-1.5 text-warning font-semibold text-[11px]">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>Action Proposed: ${escapedDesc}</span>
        </div>
        ${action.preview ? `<pre class="p-1.5 bg-neutral text-neutral-content rounded text-[10px] font-mono overflow-x-auto">${typeof escapeHtml === "function" ? escapeHtml(action.preview) : action.preview}</pre>` : ""}
        <div class="flex items-center gap-2 pt-1">
          <button
            type="button"
            onclick="if(window.HTMLReportAgent) window.HTMLReportAgent.confirmAction('${action.id}', true);"
            class="btn btn-xs btn-success gap-1 text-success-content"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            Approve
          </button>
          <button
            type="button"
            onclick="if(window.HTMLReportAgent) window.HTMLReportAgent.confirmAction('${action.id}', false);"
            class="btn btn-xs btn-ghost text-base-content/70"
          >
            Decline
          </button>
        </div>
      </div>
    `;
  },

  submitDockPrompt: function() {
    if (typeof document === "undefined") return;
    const input = document.getElementById("agent-dock-input");
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    this.sendPrompt(text);
  },

  sendPrompt: async function(promptText, options = {}) {
    if (!promptText || !promptText.trim()) return null;
    const prompt = promptText.trim();
    this.appendDockMessage("user", prompt);

    const persona = options.persona || ((typeof document !== "undefined" && document.getElementById("agent-dock-persona")) ? document.getElementById("agent-dock-persona").value : "analyst");
    const loadingEl = this.appendDockMessage("assistant", `<span class="loading loading-dots loading-xs"></span> Reasoning...`, {
      persona
    });

    const context = options.context || this.serializeElementContext(this._targetElement);
    const targetSelector = options.targetSelector || (this._targetElement ? this.serializeElementContext(this._targetElement).selector : undefined);
    const sessionId = options.sessionId || this.getSessionId();

    const payload = {
      sessionId,
      prompt,
      targetSelector,
      context,
      history: this._history.slice(-10),
      persona
    };

    this._history.push({ role: "user", content: prompt, timestamp: new Date().toISOString() });

    if (typeof window !== "undefined" && window.location && window.location.protocol === "file:") {
      this._updateState("disconnected");
      const fallbackText = "Agent bridge offline (standalone file:// mode). Start dev server on localhost:3000 to enable real-time co-pilot.";
      if (loadingEl) {
        const contentEl = loadingEl.querySelector(".message-content");
        if (contentEl) contentEl.innerHTML = `<span class="text-warning">${fallbackText}</span>`;
      }
      return { ok: false, fallback: true, result: fallbackText };
    }

    try {
      const endpoint = (typeof window === "undefined" && typeof process !== "undefined")
        ? `http://127.0.0.1:${process.env.REPORT_PORT || 3000}/api/agent/prompt`
        : "/api/agent/prompt";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream, application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop();

          for (const block of lines) {
            if (!block.trim()) continue;

            let eventType = "message";
            const dataLines = [];
            for (const line of block.split("\n")) {
              const trimmed = line.trim();
              if (trimmed.startsWith("event:")) {
                eventType = trimmed.replace(/^event:\s*/, "");
              } else if (trimmed.startsWith("data:")) {
                dataLines.push(trimmed.replace(/^data:\s*/, ""));
              }
            }

            const rawData = (dataLines.length > 0 ? dataLines.join("\n") : block.replace(/^data:\s*/m, "")).trim();
            const isDatastar = eventType === "datastar-merge-fragments" || block.includes("event: datastar-merge-fragments") || rawData.startsWith("fragments ");

            if (isDatastar) {
              const fragmentHtml = rawData.replace(/^fragments\s+/, "");
              if (targetSelector && typeof document !== "undefined") {
                const targetEl = document.querySelector(targetSelector);
                if (targetEl && fragmentHtml.includes(`id="${targetEl.id}"`)) {
                  const temp = document.createElement("div");
                  temp.innerHTML = fragmentHtml;
                  const newEl = temp.firstElementChild;
                  if (newEl) {
                    targetEl.replaceWith(newEl);
                    newEl.classList.add("animate-pulse");
                    setTimeout(() => newEl.classList.remove("animate-pulse"), 1000);
                  }
                }
              }
            }

            try {
              const json = JSON.parse(rawData);
              if (json.text) fullText = json.text;
              if (loadingEl) {
                const contentEl = loadingEl.querySelector(".message-content");
                if (contentEl) contentEl.innerHTML = this._formatMarkdown(fullText || json.text || "Analysis complete.");
                if (json.action) {
                  loadingEl.insertAdjacentHTML("beforeend", this._renderActionCard(json.action));
                }
              }
            } catch (_) {
              if (rawData && !rawData.startsWith("fragments ") && !rawData.startsWith("{")) {
                fullText = rawData;
              }
            }
          }
        }

        if (loadingEl && fullText) {
          const contentEl = loadingEl.querySelector(".message-content");
          if (contentEl) contentEl.innerHTML = this._formatMarkdown(fullText);
        }
        this._updateState("connected");
        this._history.push({ role: "assistant", content: fullText, timestamp: new Date().toISOString() });
        return { ok: true, result: fullText };
      } else {
        const data = await res.json();
        this._updateState("connected");
        const resText = data.result || data.text || "Assessment complete.";
        if (loadingEl) {
          const contentEl = loadingEl.querySelector(".message-content");
          if (contentEl) contentEl.innerHTML = this._formatMarkdown(resText);
          if (data.action) {
            loadingEl.insertAdjacentHTML("beforeend", this._renderActionCard(data.action));
          }
        }
        this._history.push({ role: "assistant", content: resText, timestamp: new Date().toISOString() });
        return data;
      }
    } catch (err) {
      this._updateState("disconnected");
      if (loadingEl) {
        const contentEl = loadingEl.querySelector(".message-content");
        if (contentEl) contentEl.innerHTML = `<span class="text-error font-semibold">Error: ${err.message}. Dev server may be offline.</span>`;
      }
      return { ok: false, error: err.message };
    }
  },

  confirmAction: async function(actionId, approved, options = {}) {
    if (typeof document === "undefined") return { ok: false };
    const card = document.getElementById(`action-card-${actionId}`);
    if (card) {
      card.innerHTML = approved
        ? `<div class="badge badge-success badge-sm gap-1 text-success-content font-semibold">✓ Action Approved &amp; Executing...</div>`
        : `<div class="badge badge-ghost badge-sm gap-1 text-base-content/60">✕ Action Declined</div>`;
    }

    try {
      const endpoint = (typeof window === "undefined" && typeof process !== "undefined")
        ? `http://127.0.0.1:${process.env.REPORT_PORT || 3000}/api/agent/confirm-action`
        : "/api/agent/confirm-action";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.getSessionId(),
          actionId,
          approved,
          ...options
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (card && approved) {
          card.innerHTML = `<div class="badge badge-success badge-sm gap-1 text-success-content font-semibold">✓ Action Executed Successfully</div>`;
        }
        return data;
      }
    } catch (err) {
      if (card && approved) {
        card.innerHTML = `<div class="badge badge-warning badge-sm gap-1 text-warning-content font-semibold">⚠ Executed locally (offline bridge)</div>`;
      }
    }
    return { ok: true, actionId, approved };
  },

  ask: async function(options) {
    const payload = typeof options === "string" ? { prompt: options } : (options || {});
    const endpoint = payload.endpoint || "/__agent_action__";

    // In standalone file:// mode, immediately invoke local fallback without throwing fetch error
    if (typeof window !== "undefined" && window.location && window.location.protocol === "file:") {
      this._updateState("disconnected");
      if (payload.autoOpenModal !== false) {
        try { this.openReconnectModal(); } catch (_) {}
      }
      return {
        ok: false,
        fallback: true,
        error: "Standalone file:// mode - dev server offline",
        result: payload.fallbackText || "Agent bridge offline. Using local deterministic fallback.",
        agent: "Local Autonomous Fallback",
        timestamp: new Date().toISOString()
      };
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this._updateState("connected");
      return data;
    } catch (err) {
      this._updateState("disconnected");
      if (payload.autoOpenModal !== false) {
        try { this.openReconnectModal(); } catch (_) {}
      }
      return {
        ok: false,
        fallback: true,
        error: err.message,
        result: payload.fallbackText || "Agent bridge offline. Using local deterministic fallback.",
        agent: "Local Autonomous Fallback",
        timestamp: new Date().toISOString()
      };
    }
  }
};

/* ==========================================================================
 * Authoring layer: Settings gear registry, page edit queue, AI activation,
 * and deterministic publishing. Everything below is inert on published pages.
 * ========================================================================== */

const _authoringMemStore = {};

function _authoringStorage() {
  try {
    if (typeof localStorage !== "undefined" && localStorage) return localStorage;
  } catch (_) {}
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(_authoringMemStore, k) ? _authoringMemStore[k] : null),
    setItem: (k, v) => { _authoringMemStore[k] = String(v); },
    removeItem: (k) => { delete _authoringMemStore[k]; }
  };
}

/** Stable per-board key: html-report-source meta, else location.pathname. */
function getPageKey() {
  try {
    if (typeof document !== "undefined") {
      const meta = document.querySelector('meta[name="html-report-source"]');
      if (meta && meta.getAttribute("content")) return meta.getAttribute("content");
    }
    if (typeof window !== "undefined" && window.location && window.location.pathname) return window.location.pathname;
  } catch (_) {}
  return "page";
}

function isPublishedDocument() {
  if (typeof document === "undefined") return false;
  const meta = document.querySelector('meta[name="html-report-published"]');
  return Boolean(meta && meta.getAttribute("content") === "true");
}

/**
 * Settings gear section registry. Built-in sections (Appearance, Export) are
 * static markup; other features register sections that render by `order`.
 */
const HTMLReportSettings = {
  _sections: [],

  registerSection(section) {
    if (!section || !section.id || typeof section.render !== "function") return false;
    const next = { title: section.id, icon: null, order: 100, ...section };
    const idx = this._sections.findIndex((s) => s.id === next.id);
    if (idx >= 0) this._sections[idx] = next; else this._sections.push(next);
    this.renderAll();
    return true;
  },

  getSections() {
    return this._sections.slice().sort((a, b) => (a.order - b.order) || String(a.id).localeCompare(String(b.id)));
  },

  renderAll() {
    if (typeof document === "undefined") return;
    const host = document.getElementById("settings-extra-sections");
    if (!host) return;
    host.innerHTML = "";
    for (const s of this.getSections()) {
      const wrap = document.createElement("details");
      wrap.className = "collapse collapse-arrow bg-base-200/50 border border-base-300 rounded-box";
      wrap.id = `settings-section-${s.id}`;
      wrap.setAttribute("data-settings-section", s.id);
      const summary = document.createElement("summary");
      summary.className = "collapse-title text-3xs font-bold uppercase tracking-wider text-base-content/80 min-h-0 py-2.5 px-3 flex items-center justify-between cursor-pointer select-none";
      summary.innerHTML = `<span>${s.title}</span>`;
      const content = document.createElement("div");
      content.className = "collapse-content px-3 pb-3 pt-2";
      const body = document.createElement("div");
      body.className = "mt-1.5";
      content.appendChild(body);
      wrap.appendChild(summary);
      wrap.appendChild(content);
      host.appendChild(wrap);
      try { s.render(body); } catch (err) { console.warn("[html-report] settings section failed:", s.id, err); }
    }
  },

  initAllSettingsModal() {
    if (typeof document === "undefined") return;
    const modal = document.getElementById("all-settings-modal");
    const openBtn = document.getElementById("open-all-settings-btn");
    if (!modal) return;

    if (openBtn && !openBtn.__wired) {
      openBtn.__wired = true;
      openBtn.addEventListener("click", () => {
        if (HTMLReportSettings.close) HTMLReportSettings.close();
        if (typeof modal.showModal === "function") {
          modal.showModal();
        } else {
          modal.setAttribute("open", "true");
        }
        this.refreshModalState();
      });
    }

    // Tab switching inside modal
    const tabBtns = modal.querySelectorAll('.tabs [role="tab"]');
    tabBtns.forEach((tab) => {
      if (tab.__wired) return;
      tab.__wired = true;
      tab.addEventListener("click", () => {
        const targetId = tab.getAttribute("data-tab-target");
        tabBtns.forEach((t) => t.classList.remove("tab-active"));
        tab.classList.add("tab-active");
        modal.querySelectorAll(".settings-tab-panel").forEach((p) => {
          p.classList.toggle("hidden", p.id !== targetId);
        });
      });
    });

    // Populate 32-theme selector grid
    const themeGrid = document.getElementById("modal-theme-grid");
    if (themeGrid && !themeGrid.__populated && typeof DAISYUI_THEMES !== "undefined") {
      themeGrid.__populated = true;
      themeGrid.innerHTML = "";
      const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
      DAISYUI_THEMES.forEach((theme) => {
        const item = document.createElement("button");
        item.type = "button";
        item.setAttribute("data-theme", theme);
        item.setAttribute("data-modal-set-theme", theme);
        item.className = "outline-base-content text-start rounded-btn cursor-pointer font-sans w-full transition";
        item.innerHTML = `
          <div class="bg-base-100 rounded-btn text-base-content block w-full p-2.5 border ${theme === currentTheme ? "border-primary ring-2 ring-primary/30" : "border-base-300"} hover:border-primary transition">
            <div class="flex items-center justify-between gap-1.5">
              <div class="flex items-center gap-1.5 min-w-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="modal-theme-check h-3 w-3 shrink-0 ${theme === currentTheme ? "opacity-100 text-primary" : "opacity-0"}">
                  <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"></path>
                </svg>
                <span class="text-xs font-semibold capitalize truncate">${theme}</span>
              </div>
              <div class="flex shrink-0 gap-0.5">
                <span class="bg-primary rounded-badge w-1.5 h-3"></span>
                <span class="bg-secondary rounded-badge w-1.5 h-3"></span>
                <span class="bg-accent rounded-badge w-1.5 h-3"></span>
                <span class="bg-neutral rounded-badge w-1.5 h-3"></span>
              </div>
            </div>
          </div>
        `;
        item.addEventListener("click", () => {
          if (typeof setReportTheme === "function") setReportTheme(theme);
          this.refreshModalState();
        });
        themeGrid.appendChild(item);
      });
    }

    // Modal publish toggle
    const pubToggle = document.getElementById("modal-publish-toggle");
    if (pubToggle && !pubToggle.__wired) {
      pubToggle.__wired = true;
      pubToggle.addEventListener("change", () => {
        if (typeof HTMLReportPublisher !== "undefined") {
          HTMLReportPublisher.setPublishedFlag(pubToggle.checked);
        }
      });
    }

    // Modal download actions forwarding
    const modalDownHtml = document.getElementById("modal-download-html-btn");
    const htmlBtn = document.getElementById("download-html-btn");
    if (modalDownHtml && htmlBtn && !modalDownHtml.__wired) {
      modalDownHtml.__wired = true;
      modalDownHtml.addEventListener("click", () => htmlBtn.click());
    }

    const modalDownPdf = document.getElementById("modal-download-pdf-btn");
    const pdfBtn = document.getElementById("download-pdf-btn");
    if (modalDownPdf && pdfBtn && !modalDownPdf.__wired) {
      modalDownPdf.__wired = true;
      modalDownPdf.addEventListener("click", () => pdfBtn.click());
    }

    // Modal AI toggle
    const modalAiToggle = document.getElementById("modal-ai-toggle");
    if (modalAiToggle && !modalAiToggle.__wired) {
      modalAiToggle.__wired = true;
      modalAiToggle.addEventListener("change", () => {
        if (typeof HTMLReportAgent !== "undefined") {
          HTMLReportAgent.setAiActive(modalAiToggle.checked);
          this.refreshModalState();
        }
      });
    }

    // Modal Reconnect prompt copy
    const copyBtn = document.getElementById("modal-copy-reconnect-btn");
    if (copyBtn && !copyBtn.__wired) {
      copyBtn.__wired = true;
      copyBtn.addEventListener("click", (e) => {
        if (typeof HTMLReportAgent !== "undefined") {
          HTMLReportAgent.copyReconnectPrompt(e.currentTarget);
        }
      });
    }

    // Modal Page Editor launcher
    const openEditorBtn = document.getElementById("modal-open-editor-btn");
    if (openEditorBtn && !openEditorBtn.__wired) {
      openEditorBtn.__wired = true;
      openEditorBtn.addEventListener("click", () => {
        if (typeof modal.close === "function") modal.close();
        if (typeof HTMLReportEdit !== "undefined") HTMLReportEdit.openDock();
      });
    }

    this.refreshModalState();
  },

  refreshModalState() {
    if (typeof document === "undefined") return;
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const label = document.getElementById("modal-active-theme-label");
    if (label) label.textContent = currentTheme;

    const themeGrid = document.getElementById("modal-theme-grid");
    if (themeGrid) {
      themeGrid.querySelectorAll("[data-modal-set-theme]").forEach((btn) => {
        const isCurrent = btn.getAttribute("data-modal-set-theme") === currentTheme;
        const card = btn.firstElementChild;
        if (card) {
          card.classList.toggle("border-primary", isCurrent);
          card.classList.toggle("ring-2", isCurrent);
          card.classList.toggle("ring-primary/30", isCurrent);
          card.classList.toggle("border-base-300", !isCurrent);
        }
        const check = btn.querySelector(".modal-theme-check");
        if (check) {
          check.classList.toggle("opacity-100", isCurrent);
          check.classList.toggle("text-primary", isCurrent);
          check.classList.toggle("opacity-0", !isCurrent);
        }
      });
    }

    if (typeof HTMLReportPublisher !== "undefined") {
      const isPub = HTMLReportPublisher.isPublishedFlagOn();
      const pt = document.getElementById("modal-publish-toggle");
      if (pt && pt.checked !== isPub) pt.checked = isPub;
      const pb = document.getElementById("modal-publish-badge");
      if (pb) pb.classList.toggle("hidden", !isPub);
    }

    if (typeof HTMLReportAgent !== "undefined") {
      const isAi = HTMLReportAgent.isAiCapable();
      const at = document.getElementById("modal-ai-toggle");
      if (at && at.checked !== isAi) at.checked = isAi;
      const pre = document.getElementById("modal-reconnect-prompt");
      if (pre) pre.textContent = HTMLReportAgent.getReconnectPrompt();
    }
  },

  initGear() {
    if (typeof document === "undefined") return;
    const dd = document.getElementById("settings-dropdown");
    const btn = document.getElementById("settings-gear-btn");
    if (!dd || !btn || dd.__gearWired) return;
    dd.__gearWired = true;
    const setExpanded = (v) => btn.setAttribute("aria-expanded", v ? "true" : "false");
    dd.addEventListener("focusin", () => setExpanded(true));
    dd.addEventListener("focusout", (e) => { if (!e.relatedTarget || !dd.contains(e.relatedTarget)) setExpanded(false); });
    const close = () => {
      const a = document.activeElement;
      if (a && dd.contains(a) && typeof a.blur === "function") a.blur();
      setExpanded(false);
    };
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && dd.contains(document.activeElement)) close(); });
    document.addEventListener("mousedown", (e) => { if (!dd.contains(e.target)) close(); });
    this.close = close;
  }
};

/* ----------------------------- Edit queue ----------------------------- */

const EDIT_QUEUE_PREFIX = "html_report_edit_queue:";

function _sortTasks(tasks) {
  return tasks.slice().sort((a, b) =>
    (a.priority - b.priority) || (a.order - b.order) || String(a.id).localeCompare(String(b.id)));
}

const HTMLReportEdit = {
  _key: (pageKey) => EDIT_QUEUE_PREFIX + (pageKey || getPageKey()),
  _selectedTarget: null,
  _selectMode: false,
  _hoveredEl: null,
  _selectListenersAttached: false,

  getSelectedTarget() {
    return this._selectedTarget;
  },

  setSelectedTarget(target) {
    this._selectedTarget = target && target.id ? { id: String(target.id), tag: String(target.tag || "").toLowerCase() } : null;
    if (typeof document === "undefined" || !document || typeof document.getElementById !== "function") return;
    const box = document.getElementById("edit-selected-target");
    const idEl = document.getElementById("edit-target-id");
    const tagEl = document.getElementById("edit-target-tag");
    if (!box) return;
    if (this._selectedTarget) {
      box.classList.remove("hidden");
      if (idEl) idEl.textContent = `#${this._selectedTarget.id}`;
      if (tagEl) tagEl.textContent = `<${this._selectedTarget.tag || "element"}>`;
    } else {
      box.classList.add("hidden");
      if (idEl) idEl.textContent = "";
      if (tagEl) tagEl.textContent = "";
    }
  },

  getOrAssignId(el) {
    if (!el) return null;
    if (el.id && String(el.id).trim()) return String(el.id).trim();
    const tag = (el.tagName || "el").toLowerCase();
    const raw = (el.textContent || "")
      .trim()
      .slice(0, 32)
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    const base = raw ? `${tag}-${raw}` : `${tag}-${Math.random().toString(36).slice(2, 7)}`;
    let candidate = base;
    let counter = 1;
    if (typeof document !== "undefined" && document && typeof document.getElementById === "function") {
      while (document.getElementById(candidate)) {
        candidate = `${base}-${counter++}`;
      }
    }
    try { el.id = candidate; } catch (_) {}
    return candidate;
  },

  toggleSelectMode(enable) {
    if (typeof document === "undefined" || !document || !document.body) return;
    const next = enable !== undefined ? Boolean(enable) : !this._selectMode;
    this._selectMode = next;
    const btn = document.getElementById("edit-dock-select");
    if (btn) {
      btn.classList.toggle("btn-accent", next);
      btn.classList.toggle("btn-ghost", !next);
      btn.setAttribute("aria-pressed", next ? "true" : "false");
    }
    if (document.body.classList) {
      document.body.classList.toggle("report-select-mode-active", next);
    }

    if (next) {
      this._ensureSelectStyles();
      this._attachSelectListeners();
    } else {
      this._detachSelectListeners();
      this._clearHover();
    }
  },

  _ensureSelectStyles() {
    if (typeof document === "undefined" || !document || typeof document.getElementById !== "function") return;
    if (document.getElementById("report-select-styles")) return;
    const s = document.createElement("style");
    s.id = "report-select-styles";
    s.textContent = `
      .report-select-mode-active * { cursor: crosshair !important; }
      #edit-dock, #edit-dock *, #all-settings-modal, #all-settings-modal *, #settings-dropdown, #settings-dropdown *, nav.navbar, nav.navbar * { cursor: default !important; }
      .report-select-hover { filter: invert(1) hue-rotate(180deg) !important; transition: filter 0.08s ease !important; }
    `;
    if (document.head && typeof document.head.appendChild === "function") {
      document.head.appendChild(s);
    }
  },

  _attachSelectListeners() {
    if (this._selectListenersAttached || typeof document === "undefined" || !document) return;
    this._selectListenersAttached = true;
    const self = this;

    this._onPointerOver = (e) => {
      if (!self._selectMode) return;
      const target = e.target;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest("#edit-dock, #all-settings-modal, #settings-dropdown, [role='dialog'], nav.navbar")) {
        self._clearHover();
        return;
      }
      if (self._hoveredEl === target) return;
      self._clearHover();
      self._hoveredEl = target;
      if (target.classList) target.classList.add("report-select-hover");
    };

    this._onPointerOut = (e) => {
      if (!self._selectMode) return;
      if (self._hoveredEl && (e.target === self._hoveredEl || (typeof self._hoveredEl.contains === "function" && !self._hoveredEl.contains(e.relatedTarget)))) {
        self._clearHover();
      }
    };

    this._onSelectClick = (e) => {
      if (!self._selectMode) return;
      const target = e.target;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest("#edit-dock, #all-settings-modal, #settings-dropdown, [role='dialog'], nav.navbar")) return;

      if (typeof e.preventDefault === "function") e.preventDefault();
      if (typeof e.stopPropagation === "function") e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

      const elId = self.getOrAssignId(target);
      const tag = target.tagName ? target.tagName.toLowerCase() : "element";
      self.setSelectedTarget({ id: elId, tag });
      self.toggleSelectMode(false);
      if (typeof self.openDock === "function") self.openDock({ expand: true, tab: "compose", focus: true });
    };

    if (typeof document.addEventListener === "function") {
      document.addEventListener("pointerover", this._onPointerOver, true);
      document.addEventListener("pointerout", this._onPointerOut, true);
      document.addEventListener("click", this._onSelectClick, true);
    }
  },

  _detachSelectListeners() {
    if (!this._selectListenersAttached || typeof document === "undefined" || !document) return;
    this._selectListenersAttached = false;
    if (typeof document.removeEventListener === "function") {
      if (this._onPointerOver) document.removeEventListener("pointerover", this._onPointerOver, true);
      if (this._onPointerOut) document.removeEventListener("pointerout", this._onPointerOut, true);
      if (this._onSelectClick) document.removeEventListener("click", this._onSelectClick, true);
    }
  },

  _clearHover() {
    if (this._hoveredEl) {
      if (this._hoveredEl.classList) this._hoveredEl.classList.remove("report-select-hover");
      this._hoveredEl = null;
    }
  },

  getTasks(pageKey) {
    try {
      const raw = _authoringStorage().getItem(this._key(pageKey));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  },

  _generatedPrompt: null,

  saveTasks(tasks, pageKey) {
    try { _authoringStorage().setItem(this._key(pageKey), JSON.stringify(tasks)); } catch (_) {}
    this.resetGeneratedPrompt();
    return tasks;
  },

  isAutoPriority(key) {
    const pk = key || (typeof this.getPageKey === "function" ? this.getPageKey() : (typeof getPageKey === "function" ? getPageKey() : "default"));
    const store = _authoringStorage();
    return store.getItem(`html_report_auto_priority:${pk}`) === "true";
  },

  setAutoPriority(enabled, key) {
    const pk = key || (typeof this.getPageKey === "function" ? this.getPageKey() : (typeof getPageKey === "function" ? getPageKey() : "default"));
    const store = _authoringStorage();
    if (enabled) {
      store.setItem(`html_report_auto_priority:${pk}`, "true");
    } else {
      store.removeItem(`html_report_auto_priority:${pk}`);
    }
    this.resetGeneratedPrompt();
  },

  resetGeneratedPrompt() {
    this._generatedPrompt = null;
    if (typeof document !== "undefined") {
      const pre = document.getElementById("edit-prompt-preview");
      if (pre) {
        pre.textContent = "";
        pre.classList.add("hidden");
      }
      const status = document.getElementById("edit-send-status");
      if (status) status.textContent = "";
      this.refreshSendState();
    }
  },

  addTask(input, pageKey) {
    const tasks = this.getTasks(pageKey);
    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.order || 0), 0);
    const maxId = tasks.reduce((m, t) => Math.max(m, Number(String(t.id).replace(/\D/g, "")) || 0), 0);
    const pr = Number(input.priority);
    const task = {
      id: `t${maxId + 1}`,
      title: String(input.title || "").trim(),
      content: String(input.content || "").trim(),
      priority: pr === 1 || pr === 3 ? pr : 2,
      order: maxOrder + 1,
      done: false,
      target: input.target && input.target.id ? { id: String(input.target.id), tag: String(input.target.tag || "").toLowerCase() } : null,
      anchor: input.anchor && input.anchor.id ? { id: String(input.anchor.id), label: String(input.anchor.label || input.anchor.id) } : null
    };
    if (!task.title && !task.content) return null;
    tasks.push(task);
    this.saveTasks(tasks, pageKey);
    return task;
  },

  updateTask(id, patch, pageKey) {
    const tasks = this.getTasks(pageKey);
    const t = tasks.find((x) => x.id === id);
    if (!t) return null;
    if (patch.priority !== undefined) {
      const p = Number(patch.priority);
      t.priority = p === 1 || p === 3 ? p : 2;
    }
    if (patch.title !== undefined) t.title = String(patch.title);
    if (patch.content !== undefined) t.content = String(patch.content);
    if (patch.done !== undefined) t.done = Boolean(patch.done);
    if (patch.target !== undefined) {
      t.target = patch.target && patch.target.id ? { id: String(patch.target.id), tag: String(patch.target.tag || "").toLowerCase() } : null;
    }
    this.saveTasks(tasks, pageKey);
    return t;
  },

  removeTask(id, pageKey) {
    const tasks = this.getTasks(pageKey).filter((t) => t.id !== id);
    this.saveTasks(tasks, pageKey);
    return tasks;
  },

  /** Moves a task up (-1) or down (+1) among tasks of the same priority. */
  moveTask(id, delta, pageKey) {
    const tasks = this.getTasks(pageKey);
    const t = tasks.find((x) => x.id === id);
    if (!t) return tasks;
    const peers = _sortTasks(tasks.filter((x) => x.priority === t.priority));
    const i = peers.findIndex((x) => x.id === id);
    const j = i + (delta < 0 ? -1 : 1);
    if (j < 0 || j >= peers.length) return tasks;
    const tmp = peers[i].order;
    peers[i].order = peers[j].order;
    peers[j].order = tmp;
    this.saveTasks(tasks, pageKey);
    return tasks;
  },

  sortTasks: _sortTasks,

  /**
   * Pure, deterministic prompt builder. Order: priority asc, then manual order;
   * done tasks excluded. Identical input yields byte-identical output.
   */
  buildEditPrompt(tasks, page = {}, options = {}) {
    const autoPriority = Boolean(options.autoPriority ?? page.autoPriority);
    const open = _sortTasks((tasks || []).filter((t) => !t.done));
    const lines = [];
    lines.push(`Edit request for html-report page: "${page.title || "Untitled report"}"`);
    lines.push("Generated by: /html-report skill (https://github.com/DriesVerb/html-report)");
    lines.push("Agent instructions: Use available workspace tools (file editing, terminal commands) and refer to skills/html-report/references/agent-authoring-guide.md if needed.");
    lines.push(`Source: ${page.source || "(unknown source; edit the file served at this page)"}`);
    lines.push(`Report mode: ${page.mode || "report"}`);
    lines.push("");
    if (open.length === 0) {
      lines.push("No open tasks.");
    } else {
      lines.push(`Tasks (${open.length}, highest priority first):`);
      open.forEach((t, i) => {
        lines.push("");
        lines.push(`${i + 1}. [P${t.priority}] ${t.title || "(untitled)"}`);
        if (t.target && t.target.id) {
          lines.push(`   Target Element: #${t.target.id}${t.target.tag ? ` (<${t.target.tag}>)` : ""}`);
        }
        if (t.anchor) lines.push(`   Section: ${t.anchor.label} (#${t.anchor.id})`);
        if (t.content) t.content.split(/\r?\n/).forEach((l) => lines.push(`   ${l}`));
      });
    }
    lines.push("");
    lines.push("Constraints:");
    if (autoPriority) {
      lines.push("- Auto-priority: The AI agent must assess all tasks, identify dependencies, and create/determine its own optimal execution priority order.");
    }
    lines.push("- Follow the principles and conventions of this project (DaisyUI themes, Tailwind, light default theme).");
    lines.push("- Edit the source content fragment if applicable, or the served report file.");
    lines.push("- Rebuild with skills/html-report/scripts/build-report.mjs after editing when available.");
    lines.push("- Keep the report live on localhost:3000 so the browser hot-swaps the result.");
    lines.push("- Follow the task tracking and verification principles of this project.");
    return lines.join("\n");
  },

  getPageInfo() {
    let source = null;
    if (typeof document !== "undefined") {
      const m = document.querySelector('meta[name="html-report-source"]');
      source = m ? m.getAttribute("content") : null;
    }
    return {
      title: (typeof document !== "undefined" && document.title) || "Untitled report",
      source,
      mode: (typeof document !== "undefined" && document.documentElement.getAttribute("data-report-mode")) || "report"
    };
  },

  /** Chooses the primary action: send (AI + connected), turnkey (AI + offline), copy. */
  resolveSendState(aiCapable, connectionState) {
    if (!aiCapable) return "copy";
    return connectionState === "connected" ? "send" : "turnkey";
  },

  _currentSection: null,

  initDock() {
    if (typeof document === "undefined") return;
    const $ = (id) => document.getElementById(id);
    const dock = $("edit-dock");
    if (!dock || dock.__editWired) return;
    dock.__editWired = true;
    const self = this;
    const body = $("edit-dock-body");
    const toggle = $("edit-dock-toggle");
    let activeTab = "compose";

    const applyPadding = () => {
      document.body.style.paddingBottom = dock.classList.contains("hidden") ? "" : `${Math.ceil(dock.getBoundingClientRect().height)}px`;
    };
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(applyPadding).observe(dock);

    const setExpanded = (v) => {
      body.classList.toggle("hidden", !v);
      toggle.setAttribute("aria-expanded", v ? "true" : "false");
      applyPadding();
    };
    const setTab = (tab) => {
      activeTab = tab;
      $("edit-pane-compose").classList.toggle("hidden", tab !== "compose");
      $("edit-pane-queue").classList.toggle("hidden", tab !== "queue");
      $("edit-tab-compose").classList.toggle("tab-active", tab === "compose");
      $("edit-tab-queue").classList.toggle("tab-active", tab === "queue");
      if (tab === "queue") self.renderQueue();
    };
    this.openDock = (opts = {}) => {
      dock.classList.remove("hidden");
      setExpanded(opts.expand !== false);
      setTab(opts.tab || activeTab);
      applyPadding();
      self.renderQueue();
      if (opts.focus !== false && activeTab === "compose") { const t = $("edit-task-title"); if (t) t.focus(); }
    };
    this.closeDock = () => { dock.classList.add("hidden"); applyPadding(); };

    toggle.addEventListener("click", () => setExpanded(body.classList.contains("hidden")));
    $("edit-dock-close").addEventListener("click", () => this.closeDock());
    const selectBtn = $("edit-dock-select");
    if (selectBtn) selectBtn.addEventListener("click", () => self.toggleSelectMode());
    const clearTargetBtn = $("edit-clear-target");
    if (clearTargetBtn) clearTargetBtn.addEventListener("click", () => self.setSelectedTarget(null));
    $("edit-dock-add").addEventListener("click", () => { setExpanded(true); setTab("compose"); $("edit-task-title").focus(); });
    $("edit-tab-compose").addEventListener("click", () => setTab("compose"));
    $("edit-tab-queue").addEventListener("click", () => setTab("queue"));

    const addFromForm = () => {
      const anchor = self._currentSection;
      const task = self.addTask({
        title: $("edit-task-title").value,
        content: $("edit-task-content").value,
        priority: $("edit-task-priority").value,
        target: self._selectedTarget,
        anchor
      });
      if (!task) return null;
      $("edit-task-title").value = "";
      $("edit-task-content").value = "";
      self.setSelectedTarget(null);
      self.renderQueue();
      return task;
    };
    $("edit-add-btn").addEventListener("click", addFromForm);
    ["edit-task-title", "edit-task-content"].forEach((id) => {
      $(id).addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addFromForm(); } });
    });
    $("edit-task-content").addEventListener("input", (e) => {
      e.target.style.height = "auto";
      e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
    });

    $("edit-generate-btn").addEventListener("click", () => self.generatePrompt());
    $("edit-send-btn").addEventListener("click", () => self.handleSend());
    const autoToggle = $("edit-auto-priority-toggle");
    if (autoToggle) {
      autoToggle.checked = self.isAutoPriority();
      autoToggle.addEventListener("change", (e) => {
        self.setAutoPriority(e.target.checked);
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && self._selectMode) {
        e.preventDefault();
        self.toggleSelectMode(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key && e.key.toLowerCase() === "e") {
        e.preventDefault();
        if (dock.classList.contains("hidden")) self.openDock(); else self.closeDock();
      } else if (e.key === "Escape" && dock.contains(document.activeElement) && !body.classList.contains("hidden")) {
        setExpanded(false);
      }
    });

    this.initScrollFollowing();
    if (HTMLReportAgent && HTMLReportAgent.onStateChange) HTMLReportAgent.onStateChange(() => self.refreshSendState());
    this.renderQueue();
  },

  initScrollFollowing() {
    if (typeof document === "undefined" || typeof IntersectionObserver === "undefined") return;
    const targets = Array.from(document.querySelectorAll("main section[id], main h1[id], main h2[id], main h3[id]"));
    if (targets.length === 0) return;
    const visible = new Map();
    const labelOf = (el) => {
      const h = /^H[1-3]$/.test(el.tagName) ? el : el.querySelector("h1, h2, h3");
      return ((h && h.textContent) || el.getAttribute("aria-label") || el.id).trim().slice(0, 60);
    };
    const update = () => {
      let best = null;
      visible.forEach((top, el) => { if (!best || top < best.top) best = { el, top }; });
      if (!best) return;
      this._currentSection = { id: best.el.id, label: labelOf(best.el) };
      const chip = document.getElementById("edit-section-chip");
      if (chip) chip.textContent = this._currentSection.label;
      const anchor = document.getElementById("edit-task-anchor");
      if (anchor) anchor.textContent = `Anchor: ${this._currentSection.label}`;
      this.highlightVisibleTasks();
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) visible.set(en.target, Math.abs(en.boundingClientRect.top)); else visible.delete(en.target);
      });
      update();
    }, { rootMargin: "0px 0px -60% 0px", threshold: [0, 1] });
    targets.forEach((t) => io.observe(t));
    this._io = io;
  },

  highlightVisibleTasks() {
    if (typeof document === "undefined") return;
    const cur = this._currentSection && this._currentSection.id;
    document.querySelectorAll("#edit-queue-list [data-anchor-id]").forEach((li) => {
      li.classList.toggle("ring-1", Boolean(cur) && li.getAttribute("data-anchor-id") === cur);
      li.classList.toggle("ring-primary", Boolean(cur) && li.getAttribute("data-anchor-id") === cur);
    });
  },

  renderQueue() {
    if (typeof document === "undefined") return;
    const list = document.getElementById("edit-queue-list");
    const count = document.getElementById("edit-task-count");
    const tasks = this.getTasks();
    if (count) count.textContent = String(tasks.filter((t) => !t.done).length);
    this.refreshSendState();
    if (!list) return;
    list.innerHTML = "";
    if (tasks.length === 0) {
      const li = document.createElement("li");
      li.className = "text-base-content/60 p-2";
      li.textContent = "No tasks yet. Use Compose to add one.";
      list.appendChild(li);
      return;
    }
    const mk = (cls, text, label, fn) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = cls; b.textContent = text; b.setAttribute("aria-label", label);
      b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
      return b;
    };
    _sortTasks(tasks).forEach((t) => {
      const li = document.createElement("li");
      li.className = "flex items-center gap-2 p-1.5 sm:p-2 rounded-lg bg-base-200/90 border border-base-300 hover:border-primary/50 text-base-content transition-colors";
      li.setAttribute("data-task-id", t.id);
      if (t.anchor) li.setAttribute("data-anchor-id", t.anchor.id);
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.className = "checkbox checkbox-xs shrink-0"; cb.checked = t.done;
      cb.setAttribute("aria-label", "Mark done");
      cb.addEventListener("change", () => { this.updateTask(t.id, { done: cb.checked }); this.renderQueue(); });
      const chip = document.createElement("span");
      chip.className = `badge badge-xs font-mono shrink-0 ${t.priority === 1 ? "badge-error" : t.priority === 2 ? "badge-warning" : "badge-ghost"}`;
      chip.textContent = `P${t.priority}`;
      chip.title = `Priority P${t.priority} - click to cycle`;
      chip.style.cursor = "pointer";
      chip.addEventListener("click", (e) => { e.stopPropagation(); this.updateTask(t.id, { priority: (t.priority % 3) + 1 }); this.renderQueue(); });
      let targetChip = null;
      if (t.target && t.target.id) {
        targetChip = document.createElement("span");
        targetChip.className = "badge badge-accent badge-xs font-mono font-bold shrink-0";
        targetChip.textContent = `#${t.target.id}`;
        targetChip.title = `Target: #${t.target.id}${t.target.tag ? ` (<${t.target.tag}>)` : ""}`;
      }
      const title = document.createElement("span");
      title.className = `min-w-0 flex-1 truncate text-xs font-medium text-base-content ${t.done ? "line-through opacity-50" : ""}`;
      title.textContent = t.title || t.content;
      title.title = t.title ? (t.anchor ? `${t.title} (Section: ${t.anchor.label})` : t.title) : (t.anchor ? `Section: ${t.anchor.label}` : "");
      li.addEventListener("click", () => this.scrollToAnchor(t));
      const itemsToAppend = [cb, chip];
      if (targetChip) itemsToAppend.push(targetChip);
      itemsToAppend.push(title,
        mk("btn btn-ghost btn-xs px-1.5 shrink-0", "↑", "Move up", () => { this.moveTask(t.id, -1); this.renderQueue(); }),
        mk("btn btn-ghost btn-xs px-1.5 shrink-0", "↓", "Move down", () => { this.moveTask(t.id, 1); this.renderQueue(); }),
        mk("btn btn-ghost btn-xs px-1.5 shrink-0 text-error hover:bg-error/20", "🗑", "Delete task", () => { this.removeTask(t.id); this.renderQueue(); }));
      li.append(...itemsToAppend);
      list.appendChild(li);
    });
    this.highlightVisibleTasks();
  },

  scrollToAnchor(task) {
    if (!task || !task.anchor || typeof document === "undefined") return;
    const el = document.getElementById(task.anchor.id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    const prev = el.style.outline;
    el.style.outline = "2px solid currentColor";
    el.style.outlineOffset = "4px";
    setTimeout(() => { el.style.outline = prev; el.style.outlineOffset = ""; }, 1400);
  },

  generatePrompt(options = {}) {
    const autoPriority = options.autoPriority !== undefined ? Boolean(options.autoPriority) : this.isAutoPriority();
    const text = this.buildEditPrompt(this.getTasks(), this.getPageInfo(), { autoPriority, ...options });
    this._generatedPrompt = text;
    if (typeof document !== "undefined") {
      const pre = document.getElementById("edit-prompt-preview");
      if (pre) { pre.textContent = text; pre.classList.remove("hidden"); }
      this.refreshSendState();
    }
    return text;
  },

  refreshSendState() {
    if (typeof document === "undefined") return "copy";
    const state = this.resolveSendState(
      HTMLReportAgent.isAiCapable(),
      HTMLReportAgent.getState()
    );
    const btn = document.getElementById("edit-send-btn");
    const hasPrompt = Boolean(this._generatedPrompt && this._generatedPrompt.trim());
    if (btn) {
      btn.setAttribute("data-send-state", state);
      btn.textContent = state === "send" ? "Send to agent" : state === "turnkey" ? "Turnkey reconnect" : "Copy prompt";
      if (!hasPrompt) {
        btn.disabled = true;
        btn.setAttribute("aria-disabled", "true");
        btn.classList.add("btn-disabled", "opacity-50", "cursor-not-allowed");
        btn.title = "Generate a prompt first to copy or send (click 'Generate prompt')";
      } else {
        btn.disabled = false;
        btn.removeAttribute("aria-disabled");
        btn.classList.remove("btn-disabled", "opacity-50", "cursor-not-allowed");
        btn.title = state === "send" ? "Send prompt to agent" : state === "turnkey" ? "Open turnkey reconnect modal" : "Copy prompt to clipboard";
      }
    }
    return state;
  },

  async handleSend() {
    if (!this._generatedPrompt) {
      const status = typeof document !== "undefined" ? document.getElementById("edit-send-status") : null;
      if (status) status.textContent = "Please generate a prompt first.";
      this.refreshSendState();
      return "copy";
    }
    const text = this._generatedPrompt;
    const state = this.refreshSendState();
    const status = typeof document !== "undefined" ? document.getElementById("edit-send-status") : null;
    const say = (m) => { if (status) status.textContent = m; };
    if (state === "send") {
      say("Sending to agent...");
      try {
        const info = this.getPageInfo();
        const res = await fetch("/__agent_edit__", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text, file: info.source || (typeof location !== "undefined" ? location.pathname : "") })
        });
        const data = await res.json().catch(() => ({}));
        say(res.ok && data.ok ? "Agent finished; page will hot-swap." : `Agent error: ${data.error || res.status}`);
      } catch (err) {
        say(`Send failed: ${err.message}`);
      }
    } else if (state === "turnkey") {
      say("Agent offline: reconnect with the turnkey prompt.");
      HTMLReportAgent.openReconnectModal({ extra: text });
    } else {
      try {
        await navigator.clipboard.writeText(text);
        say("Prompt copied. Enable AI in Settings to send directly.");
      } catch (_) { say("Select the prompt above and copy it manually."); }
    }
    return state;
  }
};

/* ------------------------------ AI activation ------------------------------ */

const AI_FLAG_PREFIX = "html_report_ai:";

HTMLReportAgent.isAiCapable = function() {
  if (typeof document === "undefined" || !document || typeof document.querySelector !== "function") return false;
  const meta = document.querySelector('meta[name="html-report-ai"]');
  if (meta && meta.getAttribute("content") === "on") return true;
  try {
    const val = _authoringStorage().getItem(AI_FLAG_PREFIX + getPageKey());
    if (val === "on") return true;
    if (val === "off") return false;
  } catch (_) {}
  return Boolean(
    document.querySelector("[data-on-click*='__agent_action__']") ||
    document.querySelector("[data-on-click*='/api/agent']") ||
    document.querySelector("#agent-reaction-bubble") ||
    document.querySelector("[data-agent-action]")
  );
};

HTMLReportAgent.isAiBuildMarked = function() {
  if (typeof document === "undefined" || !document || typeof document.querySelector !== "function") return false;
  const meta = document.querySelector('meta[name="html-report-ai"]');
  return Boolean(meta && meta.getAttribute("content") === "on");
};

HTMLReportAgent.setAiActive = function(on) {
  try {
    const store = _authoringStorage();
    if (on) store.setItem(AI_FLAG_PREFIX + getPageKey(), "on"); else store.setItem(AI_FLAG_PREFIX + getPageKey(), "off");
  } catch (_) {}
  if (typeof document !== "undefined") {
    const container = document.getElementById("agent-bridge-status-container");
    const capable = this.isAiCapable();
    if (container) {
      container.classList.toggle("hidden", !capable);
      container.classList.toggle("flex", capable);
    }
    this._updateDockVisibility();
    if (capable) {
      if (typeof window !== "undefined" && window.location && window.location.protocol === "file:") {
        this._updateState("disconnected");
      } else {
        this.checkConnection();
        this.startHeartbeat();
      }
    } else {
      this.stopHeartbeat();
    }
  }
  return this.isAiCapable();
};

/* -------------------------------- Mermaid Enlarge -------------------------------- */

const HTMLReportMermaid = {
  _scale: 1.0,
  _panX: 0,
  _panY: 0,
  _isDragging: false,
  _startX: 0,
  _startY: 0,
  _isFullscreen: false,
  _controlsBound: false,

  /**
   * Initializes or updates enlarge buttons on all .mermaid diagram containers.
   */
  initEnlarge() {
    if (typeof document === "undefined") return;
    this._bindControls();
    const mermaidNodes = document.querySelectorAll(".mermaid");
    mermaidNodes.forEach((node) => {
      let wrapper = node.closest(".mermaid-wrapper");
      if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.className = "mermaid-wrapper relative group";
        node.parentNode.insertBefore(wrapper, node);
        wrapper.appendChild(node);
      }

      if (!wrapper.querySelector(".mermaid-enlarge-btn")) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-xs btn-ghost bg-base-100/90 backdrop-blur border border-base-300 hover:bg-base-200 shadow-xs gap-1 text-3xs font-medium mermaid-enlarge-btn";
        btn.title = "Enlarge diagram";
        btn.setAttribute("aria-label", "Enlarge diagram");
        btn.innerHTML = '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg><span>Enlarge</span>';
        btn.addEventListener("click", () => this.openModal(node));
        wrapper.appendChild(btn);
      }
    });
  },

  _bindControls() {
    if (this._controlsBound || typeof document === "undefined") return;
    this._controlsBound = true;

    const zoomInBtn = document.getElementById("mermaid-zoom-in-btn");
    const zoomOutBtn = document.getElementById("mermaid-zoom-out-btn");
    const zoomResetBtn = document.getElementById("mermaid-zoom-reset-btn");
    const zoomFitBtn = document.getElementById("mermaid-zoom-fit-btn");
    const fullscreenBtn = document.getElementById("mermaid-fullscreen-btn");
    const viewport = document.getElementById("mermaid-enlarge-viewport");
    const modal = document.getElementById("mermaid-enlarge-modal");

    if (zoomInBtn) zoomInBtn.addEventListener("click", () => this.zoomIn());
    if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => this.zoomOut());
    if (zoomResetBtn) zoomResetBtn.addEventListener("click", () => this.resetZoom());
    if (zoomFitBtn) zoomFitBtn.addEventListener("click", () => this.fitToViewport());
    if (fullscreenBtn) fullscreenBtn.addEventListener("click", () => this.toggleFullscreen());

    if (viewport) {
      viewport.addEventListener("wheel", (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        this.setScale(this._scale + delta);
      }, { passive: false });

      viewport.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        this._isDragging = true;
        this._startX = e.clientX - this._panX;
        this._startY = e.clientY - this._panY;
        viewport.classList.add("cursor-grabbing");
        viewport.classList.remove("cursor-grab");
      });

      window.addEventListener("mousemove", (e) => {
        if (!this._isDragging) return;
        this._panX = e.clientX - this._startX;
        this._panY = e.clientY - this._startY;
        this.updateTransform();
      });

      window.addEventListener("mouseup", () => {
        if (this._isDragging) {
          this._isDragging = false;
          if (viewport) {
            viewport.classList.remove("cursor-grabbing");
            viewport.classList.add("cursor-grab");
          }
        }
      });
    }

    if (modal) {
      window.addEventListener("keydown", (e) => {
        if (!modal.open && !modal.hasAttribute("open")) return;
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          this.zoomIn();
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          this.zoomOut();
        } else if (e.key === "0") {
          e.preventDefault();
          this.resetZoom();
        }
      });
    }
  },

  setScale(scale) {
    this._scale = Math.min(Math.max(scale, 0.25), 4.0);
    this.updateTransform();
  },

  zoomIn(step = 0.2) {
    this.setScale(this._scale + step);
  },

  zoomOut(step = 0.2) {
    this.setScale(this._scale - step);
  },

  resetZoom() {
    this._scale = 1.0;
    this._panX = 0;
    this._panY = 0;
    this.updateTransform();
  },

  fitToViewport() {
    const viewport = document.getElementById("mermaid-enlarge-viewport");
    const content = document.getElementById("mermaid-enlarge-content");
    const svg = content?.querySelector("svg");
    if (!viewport || !svg) {
      this.resetZoom();
      return;
    }
    const vpRect = viewport.getBoundingClientRect();
    let svgW = 800;
    let svgH = 500;
    const vb = svg.getAttribute("viewBox");
    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        svgW = parts[2];
        svgH = parts[3];
      }
    } else {
      svgW = svg.clientWidth || 800;
      svgH = svg.clientHeight || 500;
    }
    const scaleX = (vpRect.width - 40) / svgW;
    const scaleY = (vpRect.height - 40) / svgH;
    const fitScale = Math.min(scaleX, scaleY, 1.5);
    this._panX = 0;
    this._panY = 0;
    this.setScale(fitScale);
  },

  toggleFullscreen() {
    this._isFullscreen = !this._isFullscreen;
    if (typeof document === "undefined") return;
    const box = document.getElementById("mermaid-modal-box");
    if (!box) return;
    if (this._isFullscreen) {
      box.classList.remove("max-w-6xl", "w-11/12", "max-h-[90vh]");
      box.classList.add("max-w-none", "w-[98vw]", "h-[96vh]", "max-h-[96vh]");
    } else {
      box.classList.remove("max-w-none", "w-[98vw]", "h-[96vh]", "max-h-[96vh]");
      box.classList.add("max-w-6xl", "w-11/12", "max-h-[90vh]");
    }
  },

  updateTransform() {
    if (typeof document === "undefined") return;
    const content = document.getElementById("mermaid-enlarge-content");
    const zoomLevelEl = document.getElementById("mermaid-zoom-level");
    if (content) {
      content.style.transform = `translate(${this._panX}px, ${this._panY}px) scale(${this._scale})`;
    }
    if (zoomLevelEl) {
      zoomLevelEl.textContent = `${Math.round(this._scale * 100)}%`;
    }
  },

  /**
   * Opens the enlarged diagram modal displaying a readable clone of the SVG.
   */
  openModal(mermaidNode) {
    if (typeof document === "undefined" || !mermaidNode) return;
    this._bindControls();
    const modal = document.getElementById("mermaid-enlarge-modal");
    const container = document.getElementById("mermaid-enlarge-content");
    if (!modal || !container) return;

    this._scale = 1.0;
    this._panX = 0;
    this._panY = 0;

    const svg = mermaidNode.querySelector("svg");
    container.innerHTML = "";
    if (svg) {
      const clone = svg.cloneNode(true);
      clone.removeAttribute("height");
      clone.removeAttribute("width");
      clone.style.width = "100%";
      clone.style.height = "auto";
      clone.style.maxWidth = "none";

      // Detect SVG viewBox / aspect ratio
      let isWide = false;
      const vb = clone.getAttribute("viewBox");
      if (vb) {
        const parts = vb.split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          const aspect = parts[2] / parts[3];
          if (aspect > 1.8) {
            isWide = true;
          }
        }
      }

      if (isWide) {
        clone.style.minWidth = "min(160%, 1100px)";
      } else {
        clone.style.minWidth = "min(100%, 750px)";
      }
      container.appendChild(clone);
    } else {
      const pre = document.createElement("pre");
      pre.className = "text-xs font-mono p-4 overflow-auto";
      pre.textContent = mermaidNode.textContent;
      container.appendChild(pre);
    }

    this.updateTransform();

    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "true");
    }
  }
};

/* -------------------------------- Publisher -------------------------------- */

const HTMLReportPublisher = {
  AUTHORING_SELECTORS: [
    "#open-all-settings-btn",
    "#settings-publish-toggle-wrapper",
    "#settings-extra-sections",
    "#all-settings-modal",
    "#edit-dock",
    "#agent-dock-container",
    "#agent-reconnect-modal",
    "#agent-bridge-status-container",
    "#published-badge",
    "script[data-authoring]",
    "[data-agent-authoring-only]"
  ],

  /** Prunes authoring chrome from a cloned document tree and returns it. */
  stripAuthoringElements(docClone) {
    if (!docClone || typeof docClone.querySelectorAll !== "function") return docClone;
    this.AUTHORING_SELECTORS.forEach((sel) => docClone.querySelectorAll(sel).forEach((el) => el.remove()));
    const pubToggle = docClone.querySelector("#settings-publish-toggle");
    if (pubToggle) {
      const wrap = pubToggle.closest("#settings-publish-toggle-wrapper") || pubToggle.closest("div.p-2") || pubToggle;
      wrap.remove();
    }
    docClone.querySelectorAll(".divider").forEach((d) => {
      if (d.textContent && d.textContent.includes("Quick Controls")) d.remove();
    });
    docClone.querySelectorAll('meta[name="html-report-ai"]').forEach((el) => el.remove());
    docClone.querySelectorAll("[data-agent-authoring], [data-session-id]").forEach((el) => {
      el.removeAttribute("data-agent-authoring");
      el.removeAttribute("data-session-id");
    });
    const body = docClone.querySelector("body");
    if (body && body.style) {
      body.style.removeProperty("padding-bottom");
      if (!body.getAttribute("style")) body.removeAttribute("style");
    }
    return docClone;
  },

  /** Rewrites attributes in sorted order on every element for stable serialization. */
  normalizeAttributes(docClone) {
    if (!docClone || typeof docClone.querySelectorAll !== "function") return docClone;
    const all = [docClone, ...Array.from(docClone.querySelectorAll("*"))];
    all.forEach((el) => {
      const attrs = Array.from(el.attributes || []).map((a) => [a.name, a.value]);
      if (attrs.length < 2) return;
      attrs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      attrs.forEach(([n]) => el.removeAttribute(n));
      attrs.forEach(([n, v]) => el.setAttribute(n, v));
    });
    return docClone;
  },

  /** Full published prep: strip, mark, normalize. */
  prepare(docClone) {
    this.stripAuthoringElements(docClone);
    const head = docClone.querySelector("head");
    if (head && !head.querySelector('meta[name="html-report-published"]')) {
      const m = (head.ownerDocument || document).createElement("meta");
      m.setAttribute("name", "html-report-published");
      m.setAttribute("content", "true");
      head.appendChild(m);
    }
    return this.normalizeAttributes(docClone);
  },

  /** Normalizes serialized output: LF newlines, trimmed trailing whitespace, single trailing newline. */
  normalizeSerialized(html) {
    return String(html).replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n*$/, "\n");
  },

  isPublishedFlagOn() {
    try { return _authoringStorage().getItem("html_report_published:" + getPageKey()) === "true"; } catch (_) { return false; }
  },

  setPublishedFlag(on) {
    try {
      const s = _authoringStorage();
      if (on) s.setItem("html_report_published:" + getPageKey(), "true"); else s.removeItem("html_report_published:" + getPageKey());
    } catch (_) {}
    if (typeof document !== "undefined") {
      const badge = document.getElementById("published-badge");
      if (badge) badge.classList.toggle("hidden", !on);
      const t1 = document.getElementById("settings-publish-toggle");
      if (t1 && t1.checked !== on) t1.checked = on;
      const t2 = document.getElementById("modal-publish-toggle");
      if (t2 && t2.checked !== on) t2.checked = on;
      const mb = document.getElementById("modal-publish-badge");
      if (mb) mb.classList.toggle("hidden", !on);
    }
  },

  async downloadPublished(btn) {
    if (typeof document === "undefined") return null;
    if (btn) btn.disabled = true;
    try {
      const html = await buildInlinedHtmlSnapshot({ mode: "published" });
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(document.title || "html-report").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-published.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return html;
    } finally {
      if (btn) btn.disabled = false;
    }
  }
};

/* ------------------------------ Authoring init ------------------------------ */

function _mkEl(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function initAuthoring() {
  if (typeof document === "undefined" || isPublishedDocument()) return;
  HTMLReportSettings.initGear();

  HTMLReportSettings.registerSection({
    id: "edit", title: "Edit", icon: "pencil", order: 30,
    render(c) {
      const wrap = _mkEl(`<div class="flex items-center justify-between gap-2">
        <span class="text-xs text-base-content/70">Collect edit tasks and turn them into one agent prompt.</span>
        <button id="settings-open-editor" type="button" class="btn btn-primary btn-xs">Open editor <span id="settings-edit-count" class="badge badge-xs">0</span></button></div>`);
      c.appendChild(wrap);
      wrap.querySelector("#settings-open-editor").addEventListener("click", () => {
        HTMLReportEdit.openDock();
        if (HTMLReportSettings.close) HTMLReportSettings.close();
      });
      wrap.querySelector("#settings-edit-count").textContent = String(HTMLReportEdit.getTasks().filter((t) => !t.done).length);
    }
  });

  const refreshAi = () => {
    const toggle = document.getElementById("settings-ai-toggle");
    const status = document.getElementById("settings-ai-status");
    if (!toggle || !status) return;
    const capable = HTMLReportAgent.isAiCapable();
    const buildMarked = HTMLReportAgent.isAiBuildMarked();
    toggle.checked = capable;
    toggle.disabled = buildMarked;
    const state = HTMLReportAgent.getState();
    const card = document.getElementById("settings-ai-turnkey");
    const explainer = document.getElementById("settings-ai-explainer");
    status.textContent = !capable ? "AI is off for this board."
      : state === "connected" ? "Connected: live agent bridge is running."
      : state === "disconnected" ? "Disconnected: start the bridge with the turnkey below."
      : "Connecting...";
    if (explainer) explainer.classList.toggle("hidden", capable);
    if (card) {
      card.classList.toggle("hidden", !(capable && state !== "connected"));
      const pre = document.getElementById("settings-ai-prompt");
      if (pre) pre.textContent = HTMLReportAgent.getReconnectPrompt();
    }
    HTMLReportEdit.refreshSendState();
    if (HTMLReportAgent._updateDockVisibility) HTMLReportAgent._updateDockVisibility();
  };

  HTMLReportSettings.registerSection({
    id: "ai", title: "AI", icon: "sparkles", order: 40,
    render(c) {
      const wrap = _mkEl(`<div class="space-y-2.5 pt-1">
        <label class="flex items-center justify-between cursor-pointer py-1 gap-2"><span class="text-xs font-semibold">Activate AI for this board</span>
          <input id="settings-ai-toggle" type="checkbox" class="toggle toggle-primary toggle-sm" /></label>
        <p id="settings-ai-status" class="text-3xs font-mono text-base-content/70"></p>
        <p id="settings-ai-explainer" class="text-3xs text-base-content/60">Turn on to connect this page to your local agent (agy) for live edits and answers. Nothing leaves your machine.</p>
        <div id="settings-ai-turnkey" class="hidden space-y-1.5 pt-1">
          <pre id="settings-ai-prompt" class="p-2 bg-neutral text-neutral-content rounded font-mono text-3xs whitespace-pre-wrap max-h-32 overflow-y-auto select-all"></pre>
          <p class="text-3xs text-base-content/60">Requires Node.js v18+ to run the local bridge; the report works offline without it.</p>
          <div class="flex gap-2 pt-1">
            <button id="settings-ai-copy" type="button" class="btn btn-primary btn-xs">Copy turnkey prompt</button>
            <button id="settings-ai-retry" type="button" class="btn btn-outline btn-xs">Retry connection</button>
          </div></div></div>`);
      c.appendChild(wrap);
      wrap.querySelector("#settings-ai-toggle").addEventListener("change", (e) => {
        HTMLReportAgent.setAiActive(e.target.checked);
        refreshAi();
      });
      wrap.querySelector("#settings-ai-copy").addEventListener("click", (e) => HTMLReportAgent.copyReconnectPrompt(e.currentTarget));
      wrap.querySelector("#settings-ai-retry").addEventListener("click", async (e) => { await HTMLReportAgent.checkConnection(e.currentTarget); refreshAi(); });
      refreshAi();
    }
  });
  HTMLReportAgent.onStateChange(refreshAi);

  // Wire Publish toggle inside Download section
  const publishToggle = document.getElementById("settings-publish-toggle");
  if (publishToggle) {
    publishToggle.checked = HTMLReportPublisher.isPublishedFlagOn();
    publishToggle.addEventListener("change", () => {
      HTMLReportPublisher.setPublishedFlag(publishToggle.checked);
    });
  }

  // Initialize All Settings tabbed overview modal
  HTMLReportSettings.initAllSettingsModal();

  // Subtle Published badge in the navbar (hidden until toggled)
  const end = document.querySelector(".navbar .navbar-end");
  const gear = document.getElementById("settings-dropdown");
  if (end && gear && !document.getElementById("published-badge")) {
    const badge = _mkEl('<span id="published-badge" class="badge badge-success badge-outline badge-sm hidden font-mono text-3xs" title="Marked as published">Published</span>');
    end.insertBefore(badge, gear);
    HTMLReportPublisher.setPublishedFlag(HTMLReportPublisher.isPublishedFlagOn());
  }

  HTMLReportEdit.initDock();
}

if (typeof window !== "undefined") {
  window.HTMLReportAgent = HTMLReportAgent;
  window.HTMLReportSettings = HTMLReportSettings;
  window.HTMLReportEdit = HTMLReportEdit;
  window.HTMLReportPublisher = HTMLReportPublisher;
  window.initAuthoring = initAuthoring;
  window.HTMLReport = window.HTMLReport || {};
  window.HTMLReport.agent = HTMLReportAgent;
}

// Node.js CommonJS exports for unit testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    STANDARD_DAISYUI_THEMES,
    DAISYUI_THEMES,
    registerCustomTheme,
    scanAndRegisterExistingCustomThemes,
    srgbToLinear,
    linearToSrgb,
    hexToRgb,
    hslToRgb,
    parseColor,
    rgbToOklch,
    autoContrastContent,
    compileTheme,
    tailwindConfigSnippet,
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
    initModeBadge,
    initDownloadButton,
    initDayjs,
    initImpress,
    impressNext,
    impressPrev,
    impressGoto,
    initMockjs,
    initShowdown,
    initFullCalendar,
    rehydrateLucideIcons,
    initDatastarObserver,
    syncDatastarTheme,
    autoLinkMarkdownFiles,
    reinitReportContent,
    initPublicFeeds,
    cleanupPublicFeeds,
    resolveFeedUrl,
    getFeedRegistry,
    extractFeedFields,
    updateFeedCharts,
    mergeFeedSignals,
    syncPwaThemeColor,
    initPwa,
    HTMLReportAgent,
    HTMLReportSettings,
    HTMLReportEdit,
    HTMLReportMermaid,
    HTMLReportPublisher,
    initAuthoring,
    getPageKey,
    _getActiveFeedPollers: () => _activeFeedPollers
  };
}
