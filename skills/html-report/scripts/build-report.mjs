#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import child_process from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compileTheme, compileThemeFile } from "./theme-compiler.mjs";
import {
  buildPwaHeadTags,
  generatePwaAssets,
  DEFAULT_PWA_CONFIG,
  deriveShortName
} from "./pwa-builder.mjs";
import {
  getPackageVersion,
  formatVersionString,
  checkDeprecatedCliArgs,
  checkDeprecatedApiOptions
} from "./compatibility.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ADDON_REGISTRY = {
  charts: {
    name: "Chart.js",
    signatures: [/<canvas\b/i, /chart\.js/i, /data-chart/i],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js" integrity="sha384-Sse/HDqcypGpyTDpvZOJNnG0TT3feGQUkF9H+mnRvic+LjR+K1NhTt8f51KIQ3v3" crossorigin="anonymous"></script>`
  },
  mermaid: {
    name: "Mermaid",
    signatures: [/class=["'][^"']*\bmermaid\b/i, /<pre\s+class=["']mermaid["']/i],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/mermaid@11.4.0/dist/mermaid.min.js" integrity="sha384-Wm9qzEgq4j1jEnuFK2FxKTlwuhbV2QqtGhcchvjDoKxeJ7WWAW7fysBq+1s6myfX" crossorigin="anonymous"></script>`
  },
  gridjs: {
    name: "Grid.js",
    signatures: [/data-gridjs/i, /gridjs-table/i, /class=["'][^"']*\bgridjs\b/i],
    head: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gridjs@6.0.6/dist/theme/mermaid.min.css" crossorigin="anonymous" />
  <script defer src="https://cdn.jsdelivr.net/npm/gridjs@6.0.6/dist/gridjs.umd.js" crossorigin="anonymous"></script>`
  },
  katex: {
    name: "KaTeX",
    signatures: [/\bkatex\b/i, /\\\(.*?\\\)/, /\\\[.*?\\\]/],
    head: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous" />
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>`
  },
  leaflet: {
    name: "Leaflet",
    signatures: [/\bleaflet\b/i, /id=["'](?:datacenterMap|map)["']/i, /leaflet-pane/i],
    head: `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="anonymous" />
  <script defer src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin="anonymous"></script>`
  },
  hljs: {
    name: "Highlight.js",
    signatures: [/\bhljs\b/i, /class=["'][^"']*\blanguage-[a-z0-9_-]+/i],
    head: `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/github-dark.min.css" crossorigin="anonymous" />
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/highlight.min.js" crossorigin="anonymous"></script>
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/languages/kotlin.min.js" crossorigin="anonymous"></script>`
  },
  marked: {
    name: "Marked",
    signatures: [/id=["']markdown-(?:source|output)["']/i, /\bmarked\b/i],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/marked@14.1.3/marked.min.js" crossorigin="anonymous"></script>`
  },
  dayjs: {
    name: "Day.js",
    signatures: [/\bdayjs\b/i, /data-dayjs/i, /dayjs\s*\(/],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/dayjs@1.11.13/dayjs.min.js" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/dayjs@1.11.13/plugin/relativeTime.js" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/dayjs@1.11.13/plugin/customParseFormat.js" crossorigin="anonymous"></script>`
  },
  impress: {
    name: "Impress.js",
    signatures: [/id=["']impress["']/i, /class=["'][^"']*\bstep\b[^"']*data-x/i, /\bimpress\s*\(\s*\)/],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/impress.js@1.1.0/js/impress.js" crossorigin="anonymous"></script>`
  },
  mockjs: {
    name: "Mock.js",
    signatures: [/\bMock\.(?:mock|Random)\b/i, /data-mock/i, /id=["']mock-/i],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/mockjs@1.1.0/dist/mock.min.js" crossorigin="anonymous"></script>`
  },
  showdown: {
    name: "Showdown",
    signatures: [/\bshowdown\b/i, /new\s+showdown\.Converter/i, /data-showdown/i, /data-markdown-showdown/i, /id=["']showdown-/i],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/showdown@2.1.0/dist/showdown.min.js" crossorigin="anonymous"></script>`
  },
  fullcalendar: {
    name: "FullCalendar",
    signatures: [/id=["']calendar["']/i, /data-fullcalendar/i, /FullCalendar\.Calendar/i, /class=["'][^"']*\bfc\b/i],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js" crossorigin="anonymous"></script>`
  },
  datastar: {
    name: "Datastar",
    signatures: [
      /data-signals\b/i,
      /data-bind\b/i,
      /data-on-/i,
      /data-indicator\b/i,
      /data-computed\b/i,
      /data-text\b/i,
      /data-show\b/i,
      /data-ref\b/i,
      /data-fetch-indicator\b/i,
      /data-public-feed\b/i,
      /data-feed\b/i,
      /data-feed-chart\b/i,
      /\bdatastar\b/i
    ],
    head: `<script type="module" src="https://cdn.jsdelivr.net/npm/@starfederation/datastar@1.0.0-beta.9/dist/datastar.js"></script>`
  }
};

export const CANONICAL_MODES = [
  "print",
  "report",
  "presentation",
  "dashboard",
  "working-report",
  "live-report"
];

export const MODE_ALIASES = {
  print: "print",
  printable: "print",
  "-p": "print",
  pdf: "print",
  report: "report",
  standard: "report",
  static: "report",
  default: "report",
  interactive: "report",
  presentation: "presentation",
  deck: "presentation",
  slides: "presentation",
  impress: "presentation",
  dashboard: "dashboard",
  dash: "dashboard",
  working: "working-report",
  journey: "working-report",
  "working-report": "working-report",
  live: "live-report",
  stream: "live-report",
  realtime: "live-report",
  "-l": "live-report",
  "live-report": "live-report"
};

export function normalizeMode(rawMode) {
  if (!rawMode || typeof rawMode !== "string") return null;
  const cleaned = rawMode.toLowerCase().trim();
  return MODE_ALIASES[cleaned] || null;
}

const ADDON_ALIASES = {
  chart: "charts",
  chartjs: "charts",
  math: "katex",
  highlight: "hljs",
  map: "leaflet",
  maps: "leaflet",
  day: "dayjs",
  dayjs: "dayjs",
  impress: "impress",
  datastar: "datastar",
  live: "datastar",
  impressjs: "impress",
  mock: "mockjs",
  mockjs: "mockjs",
  showdown: "showdown",
  "markdown-showdown": "showdown",
  fullcalendar: "fullcalendar",
  fullcalender: "fullcalendar",
  calendar: "fullcalendar"
};

const PRINT_MEDIA_CSS = `
  <style id="printable-media-styles">
    @media print {
      body {
        background-color: #ffffff !important;
        color: #111827 !important;
      }
      header,
      .navbar,
      .print\\:hidden,
      .print-interactive-control,
      .gridjs-head,
      .gridjs-pages {
        display: none !important;
      }
      #print-cover-page {
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        min-height: 92vh !important;
        break-after: page !important;
        page-break-after: always !important;
      }
      .print-only-summary {
        display: block !important;
      }
      .break-inside-avoid {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      /* Impress.js print fallback: render slides statically without 3D transforms */
      #impress,
      .impress-wrapper {
        position: static !important;
        overflow: visible !important;
        height: auto !important;
        transform: none !important;
      }
      .step {
        position: relative !important;
        opacity: 1 !important;
        transform: none !important;
        display: block !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
        margin-bottom: 2rem !important;
      }
    }
  </style>`;

/**
 * Scans content fragment for known feature signatures and merges with explicit addon requests.
 */
export function detectAddons(content = "", explicitAddons = []) {
  const active = new Set();

  // Normalize explicit addons
  for (const raw of explicitAddons) {
    const key = raw.toLowerCase().trim();
    const normalized = ADDON_ALIASES[key] || key;
    if (ADDON_REGISTRY[normalized]) {
      active.add(normalized);
    }
  }

  // Scan content signatures
  for (const [key, addon] of Object.entries(ADDON_REGISTRY)) {
    if (active.has(key)) continue;
    for (const pattern of addon.signatures) {
      if (pattern.test(content)) {
        active.add(key);
        break;
      }
    }
  }

  return Array.from(active);
}

/**
 * Normalizes content fragment, removing accidental outer <main> wrappers or frontmatter.
 */
export function extractMainContent(rawContent = "") {
  let content = rawContent.trim();

  // Strip leading YAML frontmatter if present
  if (content.startsWith("---")) {
    const endMatch = content.slice(3).indexOf("\n---");
    if (endMatch !== -1) {
      content = content.slice(endMatch + 7).trim();
    }
  }

  // If wrapped in <main>...</main>, unwrap inner content
  const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    return mainMatch[1].trim();
  }

  return content;
}

/**
 * Generates an SVG emoji favicon tag.
 */
export function generateFaviconTag(emoticon = "📊") {
  const cleanEmoji = emoticon.trim() || "📊";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${cleanEmoji}</text></svg>`;
  return `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}" />`;
}

/**
 * Parses CLI arguments.
 */
export function parseArgs(argv) {
  const { normalized: rawArgs } = checkDeprecatedCliArgs(argv.slice(2));
  const args = rawArgs;
  const options = {
    title: "HTML Report",
    content: null,
    output: "./report.html",
    mode: null,
    printable: false,
    presentation: false,
    live: false,
    theme: null,
    customTheme: null,
    addons: [],
    favicon: "📊",
    feeds: {},
    freezeFeeds: false,
    feedInterval: null,
    pwa: false,
    pwaName: null,
    pwaShortName: null,
    pwaThemeColor: null,
    pwaBgColor: null,
    pwaIcon: null,
    noPwaAssets: false,
    version: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--version" || arg === "-v") {
      options.version = true;
    } else if ((arg === "--title" || arg === "-t") && args[i + 1]) {
      options.title = args[++i];
    } else if ((arg === "--content" || arg === "-c") && args[i + 1]) {
      options.content = args[++i];
    } else if ((arg === "--output" || arg === "-o") && args[i + 1]) {
      options.output = args[++i];
    } else if ((arg === "--mode" || arg === "-m") && args[i + 1]) {
      const rawMode = args[++i];
      const normalized = normalizeMode(rawMode);
      if (!normalized) {
        throw new Error(`Invalid report mode "${rawMode}". Allowed modes: ${CANONICAL_MODES.join(", ")}`);
      }
      options.mode = normalized;
      if (normalized === "print") options.printable = true;
      if (normalized === "presentation") {
        options.presentation = true;
        if (!options.addons.includes("impress")) options.addons.push("impress");
      }
      if (normalized === "live-report") {
        options.live = true;
        if (!options.addons.includes("datastar")) options.addons.push("datastar");
      }
    } else if (arg === "--print" || arg === "--printable" || arg === "-p") {
      options.mode = "print";
      options.printable = true;
    } else if (arg === "--presentation") {
      options.mode = "presentation";
      options.presentation = true;
      if (!options.addons.includes("impress")) {
        options.addons.push("impress");
      }
    } else if (arg === "--dashboard") {
      options.mode = "dashboard";
    } else if (arg === "--working" || arg === "--working-report") {
      options.mode = "working-report";
    } else if (arg === "--live" || arg === "-l" || arg === "--live-report") {
      options.mode = "live-report";
      options.live = true;
      if (!options.addons.includes("datastar")) {
        options.addons.push("datastar");
      }
    } else if (arg === "--pwa") {
      options.pwa = true;
    } else if (arg === "--pwa-name" && args[i + 1]) {
      options.pwaName = args[++i];
      options.pwa = true;
    } else if (arg === "--pwa-short-name" && args[i + 1]) {
      options.pwaShortName = args[++i];
      options.pwa = true;
    } else if (arg === "--pwa-theme-color" && args[i + 1]) {
      options.pwaThemeColor = args[++i];
      options.pwa = true;
    } else if (arg === "--pwa-bg-color" && args[i + 1]) {
      options.pwaBgColor = args[++i];
      options.pwa = true;
    } else if (arg === "--pwa-icon" && args[i + 1]) {
      options.pwaIcon = args[++i];
      options.pwa = true;
    } else if (arg === "--no-pwa-assets") {
      options.noPwaAssets = true;
    } else if (arg === "--theme" && args[i + 1]) {
      options.theme = args[++i];
    } else if ((arg === "--custom-theme" || arg === "-ct") && args[i + 1]) {
      options.customTheme = args[++i];
    } else if (arg === "--addons" && args[i + 1]) {
      const items = args[++i].split(",").map((s) => s.trim()).filter(Boolean);
      options.addons.push(...items);
    } else if (arg === "--favicon" && args[i + 1]) {
      options.favicon = args[++i];
    } else if (arg === "--feed" && args[i + 1]) {
      const val = args[++i];
      const eqIdx = val.indexOf("=");
      if (eqIdx !== -1) {
        const name = val.slice(0, eqIdx).trim();
        const url = val.slice(eqIdx + 1).trim();
        if (!options.feeds) options.feeds = {};
        options.feeds[name] = url;
      }
    } else if (arg === "--freeze-feeds") {
      options.freezeFeeds = true;
    } else if (arg === "--feed-interval" && args[i + 1]) {
      options.feedInterval = parseInt(args[++i], 10);
    } else if (arg === "--all-addons") {
      options.addons.push(...Object.keys(ADDON_REGISTRY));
    } else if (arg.startsWith("--") && ADDON_ALIASES[arg.slice(2)]) {
      options.addons.push(ADDON_ALIASES[arg.slice(2)]);
    } else if (arg.startsWith("--") && ADDON_REGISTRY[arg.slice(2)]) {
      options.addons.push(arg.slice(2));
    } else if (!arg.startsWith("--") && !options.content) {
      options.content = arg;
    }
  }

  return options;
}

/**
 * Synchronously fetches a feed URL for build-time freezing.
 */
export function fetchFeedSnapshotSync(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const stdout = child_process.execSync(
      `curl -sSL -m 5 "${url.replace(/"/g, '\\"')}"`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );
    return JSON.parse(stdout);
  } catch (_) {
    return null;
  }
}

/**
 * Deterministically builds the final HTML report from the template shell,
 * runtime script, and content fragment.
 */
export function buildReport({
  title = "HTML Report",
  content = "",
  mode = null,
  printable = false,
  presentation = false,
  live = false,
  pwa = false,
  pwaName = null,
  pwaShortName = null,
  pwaThemeColor = null,
  pwaBgColor = null,
  pwaIcon = null,
  addons = [],
  favicon = "📊",
  theme = null,
  customTheme = null,
  customThemeCss = null,
  feeds = {},
  freezeFeeds = false,
  feedInterval = null,
  mockFeeds = null,
  fetchSnapshot = null,
  templateShellPath = path.resolve(__dirname, "../assets/template-shell.html"),
  runtimeScriptPath = path.resolve(__dirname, "../assets/report-runtime.js")
} = {}) {
  if (!fs.existsSync(templateShellPath)) {
    throw new Error(`Template shell not found at: ${templateShellPath}`);
  }
  if (!fs.existsSync(runtimeScriptPath)) {
    throw new Error(`Runtime script not found at: ${runtimeScriptPath}`);
  }

  let cleanBody = extractMainContent(content);

  // Inject CLI feeds into #feed-registry if provided
  if (feeds && Object.keys(feeds).length > 0) {
    const regRegex = /<script\s+id=["']feed-registry["']\s+type=["']application\/json["']>([\s\S]*?)<\/script>/i;
    const match = cleanBody.match(regRegex);
    if (match) {
      let existing = {};
      try { existing = JSON.parse(match[1]); } catch (_) {}
      Object.assign(existing, feeds);
      cleanBody = cleanBody.replace(regRegex, `<script id="feed-registry" type="application/json">\n${JSON.stringify(existing, null, 2)}\n</script>`);
    } else {
      cleanBody = `<script id="feed-registry" type="application/json">\n${JSON.stringify(feeds, null, 2)}\n</script>\n` + cleanBody;
    }
  }

  const hasPublicFeed = /data-public-feed\b/i.test(cleanBody) || /data-feed\b/i.test(cleanBody);

  // Apply feed interval if provided
  if (feedInterval && hasPublicFeed) {
    cleanBody = cleanBody.replace(
      /(<[^>]*\bdata-public-feed\b[^>]*?)(\/?>)/gi,
      (match, prefix, suffix) => {
        if (/data-feed-interval\b/i.test(prefix)) return match;
        return `${prefix} data-feed-interval="${feedInterval}"${suffix}`;
      }
    );
  }

  // Freeze feeds if requested
  if (freezeFeeds && hasPublicFeed) {
    const combinedRegistry = Object.assign({}, feeds || {});
    const regMatch = cleanBody.match(/<script\s+id=["']feed-registry["']\s+type=["']application\/json["']>([\s\S]*?)<\/script>/i);
    if (regMatch) {
      try { Object.assign(combinedRegistry, JSON.parse(regMatch[1])); } catch (_) {}
    }

    cleanBody = cleanBody.replace(
      /(<[^>]*\bdata-public-feed=["']([^"']+)["'][^>]*?)(\/?>)/gi,
      (match, prefix, feedRef, suffix) => {
        let targetUrl = feedRef;
        if (feedRef.startsWith("@")) {
          targetUrl = combinedRegistry[feedRef.slice(1)] || feedRef;
        }

        let snapshot = null;
        if (mockFeeds && mockFeeds[feedRef]) {
          snapshot = mockFeeds[feedRef];
        } else if (mockFeeds && mockFeeds[targetUrl]) {
          snapshot = mockFeeds[targetUrl];
        } else if (typeof fetchSnapshot === "function") {
          snapshot = fetchSnapshot(targetUrl, feedRef);
        } else if (targetUrl && (targetUrl.startsWith("http://") || targetUrl.startsWith("https://"))) {
          snapshot = fetchFeedSnapshotSync(targetUrl);
        }

        if (snapshot !== null) {
          const serialized = JSON.stringify(snapshot).replace(/"/g, "&quot;");
          if (/data-feed-fallback\b/i.test(prefix)) {
            prefix = prefix.replace(/data-feed-fallback=["'][^"']*["']/i, `data-feed-fallback="${serialized}"`);
            return `${prefix}${suffix}`;
          }
          return `${prefix} data-feed-fallback="${serialized}"${suffix}`;
        }
        return match;
      }
    );
  }

  // Resolve canonical report mode
  let resolvedMode = normalizeMode(mode);
  if (mode && !resolvedMode) {
    throw new Error(`Invalid report mode "${mode}". Allowed modes: ${CANONICAL_MODES.join(", ")}`);
  }

  if (!resolvedMode) {
    if (live || hasPublicFeed) resolvedMode = "live-report";
    else if (printable) resolvedMode = "print";
    else if (presentation) resolvedMode = "presentation";
    else resolvedMode = "report";
  }

  const isPrintable = Boolean(printable || resolvedMode === "print");
  const isPresentation = Boolean(presentation || resolvedMode === "presentation");
  const isLive = Boolean(live || hasPublicFeed || resolvedMode === "live-report");
  const isPwa = Boolean(pwa);

  const shellTemplate = fs.readFileSync(templateShellPath, "utf-8");
  const runtimeScript = fs.readFileSync(runtimeScriptPath, "utf-8");

  const activeAddonKeys = detectAddons(cleanBody, addons);

  // Auto-inject required addons for specific modes
  if (isPresentation && !activeAddonKeys.includes("impress")) {
    activeAddonKeys.push("impress");
  }
  if (isLive && !activeAddonKeys.includes("datastar")) {
    activeAddonKeys.push("datastar");
  }

  // Compile custom themes if provided
  let compiledCustomCss = "";
  let resolvedTheme = theme;

  if (customTheme) {
    if (typeof customTheme === "string") {
      const isFile = fs.existsSync(customTheme);
      if (isFile) {
        const compiled = compileThemeFile(customTheme);
        compiledCustomCss = compiled.css;
        if (!resolvedTheme) resolvedTheme = compiled.themeName;
      } else {
        const compiled = compileTheme(customTheme);
        compiledCustomCss = compiled.css;
        if (!resolvedTheme) resolvedTheme = compiled.themeName;
      }
    } else if (typeof customTheme === "object") {
      const compiled = compileTheme(customTheme);
      compiledCustomCss = compiled.css;
      if (!resolvedTheme) resolvedTheme = compiled.themeName;
    }
  }

  if (customThemeCss) {
    compiledCustomCss = (compiledCustomCss ? compiledCustomCss + "\n\n" : "") + customThemeCss;
  }

  // Construct head extras
  const headExtraParts = [];
  for (const key of activeAddonKeys) {
    if (ADDON_REGISTRY[key]?.head) {
      headExtraParts.push(`  <!-- Addon: ${ADDON_REGISTRY[key].name} -->\n  ${ADDON_REGISTRY[key].head}`);
    }
  }
  if (isPrintable) {
    headExtraParts.push(PRINT_MEDIA_CSS);
  }
  if (isPwa) {
    const effectiveThemeColor = pwaThemeColor || DEFAULT_PWA_CONFIG.themeColor;
    headExtraParts.push(buildPwaHeadTags({
      manifestHref: "manifest.webmanifest",
      themeColor: effectiveThemeColor,
      iconHref: "icon.svg",
      title: pwaName || title
    }));
  }
  const headExtras = headExtraParts.join("\n\n");

  // Construct favicon tag
  const faviconTag = generateFaviconTag(favicon);

  // Construct runtime script tag
  const inlinedRuntime = `<script>\n${runtimeScript}\n  </script>`;

  // Slot replacements
  let html = shellTemplate;

  // Set theme attribute on <html> if provided
  if (resolvedTheme) {
    html = html.replace(/data-theme="[^"]*"/i, `data-theme="${resolvedTheme}"`);
  }

  // Set report mode attribute on <html>
  html = html.replace(
    /<html([^>]*)>/i,
    (match, attrs) => {
      let updated = attrs;
      if (!updated.includes("data-report-mode")) {
        updated = ` data-report-mode="${resolvedMode}"` + updated;
      } else {
        updated = updated.replace(/data-report-mode="[^"]*"/, `data-report-mode="${resolvedMode}"`);
      }
      return `<html${updated}>`;
    }
  );

  // Set presentation attribute on <html> ONLY when explicitly requested
  if (isPresentation) {
    html = html.replace(
      /<html([^>]*)>/i,
      (match, attrs) => {
        let updated = attrs;
        if (!updated.includes("data-presentation")) {
          updated = ` data-presentation="true"` + updated;
        }
        return `<html${updated}>`;
      }
    );
  }

  // If printable, update download PDF button styling
  if (isPrintable) {
    html = html.replace(
      /<span class="badge badge-warning badge-xs font-mono">Not PDF-Ready<\/span>/,
      '<span class="badge badge-success badge-xs font-mono">PDF-Ready</span>'
    );
  }

  html = html.replace(/<!-- {{TITLE}} -->/g, () => title);
  html = html.replace(/<!-- {{FAVICON}} -->/g, () => faviconTag);
  // Defense against Datastar attribute prefix collision (data-showdown vs data-show)
  let processedBody = cleanBody;
  if (activeAddonKeys.includes("datastar")) {
    processedBody = processedBody.replace(/\bdata-showdown\b/g, "data-markdown-showdown");
  }

  html = html.replace(/<!-- {{HEAD_EXTRAS}} -->/g, () => headExtras);
  html = html.replace(/<!-- {{CONTENT}} -->/g, () => processedBody);
  html = html.replace(/<!-- {{RUNTIME_SCRIPT}} -->/g, () => inlinedRuntime);
  html = html.replace(/<!-- {{CUSTOM_THEMES}} -->/g, () => compiledCustomCss ? `\n${compiledCustomCss}\n  ` : "");

  const version = getPackageVersion();
  html = html.replace(/<!-- {{VERSION}} -->/g, () => version);

  return {
    html,
    activeAddons: activeAddonKeys,
    mode: resolvedMode,
    theme: resolvedTheme || "light",
    hasCustomTheme: Boolean(compiledCustomCss),
    isPwa,
    pwaConfig: isPwa ? {
      title: pwaName || title,
      shortName: pwaShortName || deriveShortName(pwaName || title),
      themeColor: pwaThemeColor || DEFAULT_PWA_CONFIG.themeColor,
      backgroundColor: pwaBgColor || DEFAULT_PWA_CONFIG.backgroundColor,
      emoji: pwaIcon || favicon
    } : null
  };
}

function showHelp() {
  console.log(`
html-report deterministic build CLI (build-report.mjs)

Usage:
  node build-report.mjs --content <fragment.html> [options]

Options:
  -c, --content <file>      Path to semantic <main> HTML fragment file (required)
  -t, --title <string>      Report title (default: "HTML Report")
  -o, --output <file>       Destination HTML file (default: "./report.html")
  -m, --mode <name>         Report mode: print, report, presentation, dashboard, working-report, live-report, pwa (default: "report")
  -p, --print, --printable  Enable printable/PDF mode (@media print rules, static mode)
      --presentation        Enable interactive presentation mode for Impress.js
      --dashboard           Enable interactive dashboard mode
      --working-report      Enable working journey companion mode
  -l, --live, --live-report Enable real-time Datastar live dashboard mode
      --pwa                 Enable Progressive Web App mode (manifest, sw.js, and icons)
      --pwa-name <name>     Custom PWA app name
      --pwa-short-name <nm> Custom PWA short name for homescreen
      --pwa-theme-color <c> Custom PWA window/status-bar theme color (default: #2563eb)
      --pwa-bg-color <c>    Custom PWA splash screen background color (default: #ffffff)
      --pwa-icon <emoji>    Custom PWA icon emoji glyph (default: favicon or 📊)
      --no-pwa-assets       Skip writing companion PWA files to disk
      --theme <name>        DaisyUI theme name (default: "light")
      --custom-theme <path> Path to custom theme definition (.json or .css)
      --favicon <emoji>     Favicon emoticon (default: "📊")
      --addons <list>       Comma-separated addons
      --all-addons          Include all catalog addons in <head>
      --charts              Explicitly include Chart.js
      --mermaid             Explicitly include Mermaid
      --gridjs              Explicitly include Grid.js
      --math, --katex       Explicitly include KaTeX
      --leaflet             Explicitly include Leaflet
      --hljs, --highlight   Explicitly include Highlight.js
      --day, --dayjs        Explicitly include Day.js
      --impress             Explicitly include Impress.js
      --mock, --mockjs      Explicitly include Mock.js
      --showdown            Explicitly include Showdown
      --fullcalendar        Explicitly include FullCalendar
      --feed <name>=<url>   Inject feed nickname mapping into #feed-registry
      --freeze-feeds        Fetch and bake snapshot payloads into data-feed-fallback
      --feed-interval <ms>  Override polling interval for public feeds
  -v, --version             Display semantic version
  -h, --help                Show this help message
`);
}

// CLI entry point
const isDirectCli = process.argv[1] && (
  process.argv[1].endsWith("build-report.mjs") ||
  import.meta.url === pathToFileURL(process.argv[1]).href
);

if (isDirectCli) {
  const options = parseArgs(process.argv);

  if (options.version) {
    console.log(formatVersionString());
    process.exit(0);
  }

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.content) {
    console.error("Error: --content <file> is required.");
    showHelp();
    process.exit(1);
  }

  const contentPath = path.resolve(process.cwd(), options.content);
  if (!fs.existsSync(contentPath)) {
    console.error(`Error: Content file not found at: ${contentPath}`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(contentPath, "utf-8");
  const startTime = performance.now();

  const customThemePath = options.customTheme
    ? (fs.existsSync(path.resolve(process.cwd(), options.customTheme))
      ? path.resolve(process.cwd(), options.customTheme)
      : options.customTheme)
    : null;

  const { html, activeAddons, mode, isPwa, pwaConfig } = buildReport({
    title: options.title,
    content: rawContent,
    mode: options.mode,
    printable: options.printable,
    presentation: options.presentation,
    live: options.live,
    pwa: options.pwa,
    pwaName: options.pwaName,
    pwaShortName: options.pwaShortName,
    pwaThemeColor: options.pwaThemeColor,
    pwaBgColor: options.pwaBgColor,
    pwaIcon: options.pwaIcon,
    theme: options.theme,
    customTheme: customThemePath,
    addons: options.addons,
    favicon: options.favicon,
    feeds: options.feeds,
    freezeFeeds: options.freezeFeeds,
    feedInterval: options.feedInterval
  });

  const outputPath = path.resolve(process.cwd(), options.output);
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, html, "utf-8");

  if (isPwa && !options.noPwaAssets) {
    generatePwaAssets({
      outputDir,
      reportFileName: path.basename(outputPath),
      title: pwaConfig.title,
      shortName: pwaConfig.shortName,
      themeColor: pwaConfig.themeColor,
      backgroundColor: pwaConfig.backgroundColor,
      emoji: pwaConfig.emoji,
      writeFiles: true
    });
  }

  const elapsedMs = Math.round((performance.now() - startTime) * 100) / 100;
  console.log(`[html-report] Report assembled in ${elapsedMs}ms:`);
  console.log(`  Output:        ${outputPath}`);
  console.log(`  Mode:          ${mode}`);
  if (isPwa) {
    console.log(`  PWA Assets:    manifest.webmanifest, sw.js, icon.svg in ${outputDir}`);
  }
  console.log(`  Active Addons: ${activeAddons.length > 0 ? activeAddons.join(", ") : "Core 4 only"}`);
}
