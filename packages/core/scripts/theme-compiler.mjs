import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load base themes catalog
let DAISYUI_BASE_THEMES = {};
try {
  const baseThemesPath = path.resolve(__dirname, "../assets/daisyui-base-themes.json");
  if (fs.existsSync(baseThemesPath)) {
    DAISYUI_BASE_THEMES = JSON.parse(fs.readFileSync(baseThemesPath, "utf-8"));
  }
} catch (_) {}

// Fallback baseline themes if JSON file cannot be loaded
if (!DAISYUI_BASE_THEMES.light) {
  DAISYUI_BASE_THEMES.light = {
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
  };
}
if (!DAISYUI_BASE_THEMES.dark) {
  DAISYUI_BASE_THEMES.dark = {
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
  };
}

export { DAISYUI_BASE_THEMES };

/**
 * Converts sRGB channel (0-255) to linear sRGB (0-1).
 */
export function srgbToLinear(c) {
  const norm = c / 255;
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

/**
 * Converts linear sRGB (0-1) to standard 8-bit sRGB (0-255).
 */
export function linearToSrgb(c) {
  const clamped = Math.max(0, Math.min(1, c));
  const srgb = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(srgb * 255);
}

/**
 * Converts Hex string to [r, g, b, a].
 */
export function hexToRgb(hex) {
  let clean = hex.replace(/^#/, "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("") + "ff";
  } else if (clean.length === 4) {
    clean = clean.split("").map((c) => c + c).join("");
  } else if (clean.length === 6) {
    clean += "ff";
  }
  if (clean.length !== 8) {
    return [0, 0, 0, 1];
  }
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return [0, 0, 0, 1];
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    ((num & 255) / 255)
  ];
}

/**
 * Converts HSL components to [r, g, b].
 */
export function hslToRgb(h, s, l) {
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

/**
 * Parses any color format (hex, rgb, rgba, hsl, hsla, raw oklch) into normalized sRGB or OKLCH.
 */
export function parseColor(input) {
  if (!input || typeof input !== "string") {
    return { r: 59, g: 130, b: 246, a: 1, oklch: null };
  }
  const str = input.trim();

  // Already OKLCH channel representation or oklch() function
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

  // Hex
  if (str.startsWith("#")) {
    const [r, g, b, a] = hexToRgb(str);
    return { r, g, b, a, oklch: null };
  }

  // rgb / rgba
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

  // hsl / hsla
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

/**
 * Pure JS sRGB to OKLCH conversion using standard Ottosson matrix formulas.
 * Returns { L, C, H, formatted } where formatted matches DaisyUI 4 ("L% C H").
 */
export function rgbToOklch(r, g, b) {
  // Fast path for grayscale
  if (r === g && g === b) {
    const L = r === 0 ? 0 : r === 255 ? 1 : 0.2104542553 * Math.cbrt(srgbToLinear(r)) + 0.7936177850 * Math.cbrt(srgbToLinear(r)) - 0.0040720468 * Math.cbrt(srgbToLinear(r));
    return {
      L,
      C: 0,
      H: 0,
      formatted: `${(L * 100).toFixed(2)}% 0.000 0.00`
    };
  }

  // Step 1: sRGB to linear sRGB
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  // Step 2: Linear sRGB to LMS (Ottosson D65 matrix M1)
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  // Step 3: Non-linear cube root transfer
  const l_ = Math.cbrt(Math.max(0, l));
  const m_ = Math.cbrt(Math.max(0, m));
  const s_ = Math.cbrt(Math.max(0, s));

  // Step 4: LMS to OKLab (matrix M2)
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  // Step 5: OKLab to OKLCH
  let C = Math.sqrt(a * a + b_ * b_);
  let H = Math.atan2(b_, a) * (180 / Math.PI);
  if (H < 0) H += 360;
  if (C < 0.0001) {
    C = 0;
    H = 0;
  }

  const formattedL = (L * 100).toFixed(2) + "%";
  const formattedC = C.toFixed(3);
  const formattedH = H.toFixed(2);

  return {
    L,
    C,
    H,
    formatted: `${formattedL} ${formattedC} ${formattedH}`
  };
}

/**
 * Calculates relative luminance in sRGB space (WCAG 2.1).
 */
export function getRelativeLuminance(r, g, b) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/**
 * Generates an automatic high-contrast content color for a given background color.
 * If L > 0.65 or relative luminance > 0.4 -> near-black (15% 0.02 <H>)
 * Otherwise -> near-white (98% 0.01 <H>)
 */
export function autoContrastContent(colorInput) {
  const parsed = parseColor(colorInput);
  let L = 0.5;
  let H = 0;
  let luminance = 0.5;

  if (parsed.oklch) {
    L = parsed.oklch.L;
    H = parsed.oklch.H;
    luminance = L; // approximation
  } else {
    const oklch = rgbToOklch(parsed.r, parsed.g, parsed.b);
    L = oklch.L;
    H = oklch.H;
    luminance = getRelativeLuminance(parsed.r, parsed.g, parsed.b);
  }

  const hVal = Number.isFinite(H) ? H.toFixed(2) : "0";
  if (L > 0.65 || luminance > 0.4) {
    return `15% 0.02 ${hVal}`;
  }
  return `98% 0.01 ${hVal}`;
}

// DaisyUI semantic color name to CSS variable mapping
export const COLOR_KEYS_MAP = {
  primary: "--p",
  "primary-content": "--pc",
  primaryContent: "--pc",
  secondary: "--s",
  "secondary-content": "--sc",
  secondaryContent: "--sc",
  accent: "--a",
  "accent-content": "--ac",
  accentContent: "--ac",
  neutral: "--n",
  "neutral-content": "--nc",
  neutralContent: "--nc",
  "base-100": "--b1",
  base100: "--b1",
  "base-200": "--b2",
  base200: "--b2",
  "base-300": "--b3",
  base300: "--b3",
  "base-content": "--bc",
  baseContent: "--bc",
  info: "--in",
  "info-content": "--inc",
  infoContent: "--inc",
  success: "--su",
  "success-content": "--suc",
  successContent: "--suc",
  warning: "--wa",
  "warning-content": "--wac",
  warningContent: "--wac",
  error: "--er",
  "error-content": "--erc",
  errorContent: "--erc"
};

// Auto-contrast pairing rules: [ParentVar, ContentVar]
export const AUTO_CONTRAST_PAIRS = [
  ["--p", "--pc"],
  ["--s", "--sc"],
  ["--a", "--ac"],
  ["--n", "--nc"],
  ["--b1", "--bc"],
  ["--in", "--inc"],
  ["--su", "--suc"],
  ["--wa", "--wac"],
  ["--er", "--erc"]
];

export const GEOMETRY_VARS = [
  "--rounded-box",
  "--rounded-btn",
  "--rounded-badge",
  "--animation-btn",
  "--animation-input",
  "--btn-focus-scale",
  "--border-btn",
  "--tab-border",
  "--tab-radius"
];

/**
 * Normalizes any color input to DaisyUI OKLCH channel string "L% C H".
 */
export function toOklchString(colorInput) {
  if (!colorInput) return "100% 0 0";
  const str = String(colorInput).trim();
  const parsed = parseColor(str);
  if (parsed.oklch) {
    return parsed.oklch.formatted;
  }
  const conv = rgbToOklch(parsed.r, parsed.g, parsed.b);
  return conv.formatted;
}

/**
 * Compiles a raw CSS or JSON theme definition into complete DaisyUI 4 [data-theme="..."] CSS.
 */
export function compileTheme(themeDefinition, { defaultThemeName = "custom" } = {}) {
  // Case 1: Raw CSS string input
  if (typeof themeDefinition === "string") {
    const trimmed = themeDefinition.trim();
    if (trimmed.includes("[data-theme=") || trimmed.includes(":root")) {
      const match = trimmed.match(/\[data-theme=["']?([a-zA-Z0-9_\-]+)["']?\]/);
      const themeName = match ? match[1] : defaultThemeName;
      return {
        themeName,
        css: trimmed,
        variables: {},
        isRawCss: true
      };
    }
    // Attempt parsing as JSON string
    try {
      return compileTheme(JSON.parse(trimmed), { defaultThemeName });
    } catch (_) {
      throw new Error(`Unable to compile theme: input is neither valid JSON nor valid DaisyUI CSS.`);
    }
  }

  // Case 2: Object / JSON definition
  let themeObj = themeDefinition;
  let themeName = defaultThemeName;

  // Handle { "themes": [ { "theme-name": { ... } } ] } or { "themes": { "theme-name": { ... } } }
  if (themeObj.themes) {
    if (Array.isArray(themeObj.themes) && themeObj.themes.length > 0) {
      themeObj = themeObj.themes[0];
    } else if (typeof themeObj.themes === "object") {
      const firstKey = Object.keys(themeObj.themes)[0];
      if (firstKey) {
        themeName = firstKey;
        themeObj = themeObj.themes[firstKey];
      }
    }
  }

  // Handle { "my-theme": { extends: "dark", ... } }
  const topKeys = Object.keys(themeObj);
  if (topKeys.length === 1 && typeof themeObj[topKeys[0]] === "object" && !themeObj[topKeys[0]].r) {
    themeName = topKeys[0];
    themeObj = themeObj[topKeys[0]];
  } else if (themeObj.name) {
    themeName = themeObj.name;
  }

  // Resolve inheritance (extends)
  const baseThemeName = themeObj.extends || themeObj["extends"];
  let baseVars = {};
  if (baseThemeName && DAISYUI_BASE_THEMES[baseThemeName]) {
    baseVars = { ...DAISYUI_BASE_THEMES[baseThemeName] };
  } else if (DAISYUI_BASE_THEMES.light) {
    baseVars = { ...DAISYUI_BASE_THEMES.light };
  }

  const resultVars = { ...baseVars };

  // Process user defined properties
  for (const [key, rawValue] of Object.entries(themeObj)) {
    if (key === "extends" || key === "name") continue;

    // Check color mappings
    if (COLOR_KEYS_MAP[key]) {
      const cssVar = COLOR_KEYS_MAP[key];
      resultVars[cssVar] = toOklchString(rawValue);
      continue;
    }

    // Direct variable keys (e.g., "--p", "--rounded-box", "color-scheme")
    if (key.startsWith("--")) {
      // Check if it's a semantic color variable
      const isColorVar = Object.values(COLOR_KEYS_MAP).includes(key);
      if (isColorVar) {
        resultVars[key] = toOklchString(rawValue);
      } else {
        resultVars[key] = String(rawValue).trim();
      }
      continue;
    }

    if (key === "color-scheme" || key === "colorScheme") {
      resultVars["color-scheme"] = String(rawValue).trim();
      continue;
    }

    // Geometry aliases
    const geoKey = `--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
    if (GEOMETRY_VARS.includes(geoKey)) {
      resultVars[geoKey] = String(rawValue).trim();
      continue;
    }

    // Other generic properties
    resultVars[key] = String(rawValue).trim();
  }

  // Auto-generate missing content colors
  for (const [parentVar, contentVar] of AUTO_CONTRAST_PAIRS) {
    // Only auto-generate if parent was explicitly provided or content is missing
    const userDefinedParent = themeObj[parentVar] || Object.entries(COLOR_KEYS_MAP).some(([k, v]) => v === parentVar && themeObj[k]);
    const userDefinedContent = themeObj[contentVar] || Object.entries(COLOR_KEYS_MAP).some(([k, v]) => v === contentVar && themeObj[k]);

    if (userDefinedParent && !userDefinedContent && resultVars[parentVar]) {
      resultVars[contentVar] = autoContrastContent(resultVars[parentVar]);
    }
  }

  // Derive color-scheme if still not set
  if (!resultVars["color-scheme"]) {
    if (resultVars["--b1"]) {
      const b1Parsed = parseColor(resultVars["--b1"]);
      const L = b1Parsed.oklch ? b1Parsed.oklch.L : (rgbToOklch(b1Parsed.r, b1Parsed.g, b1Parsed.b).L);
      resultVars["color-scheme"] = L < 0.5 ? "dark" : "light";
    } else {
      resultVars["color-scheme"] = "light";
    }
  }

  // Build CSS rule block
  const lines = [`[data-theme="${themeName}"] {`];
  if (resultVars["color-scheme"]) {
    lines.push(`  color-scheme: ${resultVars["color-scheme"]};`);
  }
  for (const [k, v] of Object.entries(resultVars)) {
    if (k === "color-scheme") continue;
    lines.push(`  ${k}: ${v};`);
  }
  lines.push(`}`);
  const css = lines.join("\n");

  return {
    themeName,
    css,
    variables: resultVars,
    isRawCss: false
  };
}

/**
 * Compiles a theme file (JSON or CSS) from disk.
 */
export function compileThemeFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Theme file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath, ext);

  if (ext === ".css") {
    return compileTheme(content, { defaultThemeName: baseName });
  }

  try {
    const json = JSON.parse(content);
    return compileTheme(json, { defaultThemeName: baseName });
  } catch (err) {
    // Fallback: check if content is raw CSS
    if (content.includes("[data-theme=") || content.includes("{")) {
      return compileTheme(content, { defaultThemeName: baseName });
    }
    throw new Error(`Failed to parse theme file ${filePath}: ${err.message}`);
  }
}

/**
 * Generates Tailwind CSS configuration snippet for the compiled theme.
 */
export function tailwindConfigSnippet(themeName, variables) {
  const cleanVars = {};
  for (const [k, v] of Object.entries(variables)) {
    cleanVars[k] = v;
  }
  return `daisyui: {\n  themes: [\n    {\n      "${themeName}": ${JSON.stringify(cleanVars, null, 8).replace(/^ {8}/gm, "      ")}\n    }\n  ]\n}`;
}
