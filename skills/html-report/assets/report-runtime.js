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
  window.initDownloadButton = initDownloadButton;

  window.addEventListener("DOMContentLoaded", async () => {
    try { scanAndRegisterExistingCustomThemes(); } catch (_) {}
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
    initDownloadButton
  };
}
