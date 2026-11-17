/**
 * html-report client runtime (report-runtime.js)
 * Pre-bundled runtime for 32 DaisyUI themes, canvas 2D OKLCH palette resolution,
 * Mermaid list syntax defense, dynamic TOC generation, Published Document snapshot exporter,
 * Edit Mode (#edit-dock & Target Element selection), and horizontal space detection.
 */

const STANDARD_DAISYUI_THEMES = new Set([
  "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
  "synthwave", "retro", "cyberpunk", "valentine", "halloween", "garden",
  "forest", "aqua", "lofi", "pastel", "fantasy", "wireframe", "black",
  "luxury", "dracula", "cmyk", "autumn", "business", "acid", "lemonade",
  "night", "coffee", "winter", "dim", "nord", "sunset"
]);

const DAISYUI_THEMES = Array.from(STANDARD_DAISYUI_THEMES);

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  if (typeof HTMLReportEdit !== "undefined" && typeof HTMLReportEdit.refreshStyleThemeSelect === "function") {
    HTMLReportEdit.refreshStyleThemeSelect();
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

