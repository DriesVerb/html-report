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
    try { checkInsufficientHorizontalSpace(); } catch (_) {}
    try { if (typeof HTMLReportAgent !== "undefined") HTMLReportAgent.init(); } catch (_) {}
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
Once started, keep this process running. The report in my browser will automatically detect the connection, update its live badges, and unlock interactive co-pilot queries.`;
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
    const hasAgentTriggers = Boolean(
      document.querySelector("[data-on-click*='__agent_action__']") ||
      document.querySelector("[data-on-click*='/api/agent']") ||
      document.querySelector("#agent-reaction-bubble") ||
      document.getElementById("agent-bridge-status-container") ||
      document.querySelector("[data-agent-action]")
    );

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

if (typeof window !== "undefined") {
  window.HTMLReportAgent = HTMLReportAgent;
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
    _getActiveFeedPollers: () => _activeFeedPollers
  };
}
