#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
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
import {
  isDirectCliExecution,
  resolveSkillPaths
} from "./preflight.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

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
  quill: {
    name: "Quill",
    signatures: [
      /\bql-editor\b/i,
      /id=["'](?:quill-)?editor["']/i,
      /data-quill\b/i,
      /\bnew\s+Quill\s*\(/i
    ],
    head: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css" crossorigin="anonymous" />
  <script defer src="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js" crossorigin="anonymous"></script>`
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

function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Removes every region wrapped in `html-report:authoring:start/end` markers
 * (settings gear, edit dock). Deterministic and idempotent.
 */
export function stripVerificationArtifacts(html = "") {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<style\s+id=["']html-report-verify-styles["'][^>]*>[\s\S]*?<\/style>\s*/gi, "")
    .replace(/\s+data-insufficient-space(?:=["'][^"']*["'])?/gi, "")
    .replace(/\s+data-verify-[\w-]+(?:=["'][^"']*["'])?/gi, "")
    .replace(/\sclass=(["'])([^"']*)\1/gi, (full, quote, classValue) => {
      const kept = classValue
        .split(/\s+/)
        .filter((token) => token && !token.startsWith("verify-"));
      return kept.length > 0 ? ` class=${quote}${kept.join(" ")}${quote}` : "";
    });
}

export function stripAiDockMarkup(html = "") {
  if (!html || typeof html !== "string") return "";
  return html.replace(/[ \t]*<!-- html-report:authoring:start (?:agent-dock|agent-reconnect-modal) -->[\s\S]*?<!-- html-report:authoring:end (?:agent-dock|agent-reconnect-modal) -->\n?/g, "");
}

export function stripAuthoringMarkup(html = "") {
  const withoutAuthoring = html
    .replace(/[ \t]*<!-- html-report:authoring:start ([\w-]+) -->[\s\S]*?<!-- html-report:authoring:end \1 -->\n?/g, "");
  return stripVerificationArtifacts(withoutAuthoring);
}

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
  quill: "quill",
  wysiwyg: "quill",
  editor: "quill",
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
 * Extracts <main> element attributes, classes, id, and inner content from a fragment.
 * Preserves reactive attributes (x-data, x-init, x-*, @*, :*, data-*, aria-*, role, style, etc.).
 */
export function extractMainElement(rawContent = "") {
  let content = String(rawContent || "").trim();

  // Strip leading YAML frontmatter if present
  if (content.startsWith("---")) {
    const endMatch = content.slice(3).indexOf("\n---");
    if (endMatch !== -1) {
      content = content.slice(endMatch + 7).trim();
    }
  }

  // Quote-aware match for outer <main ...>...</main>
  const mainMatch = content.match(/^<main\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/main>\s*$/i)
    || content.match(/<main\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/main>/i);

  if (!mainMatch) {
    return {
      hasMainWrapper: false,
      id: "report-main",
      classes: [],
      extraAttrs: [],
      attributes: {},
      innerHtml: content
    };
  }

  const rawAttrs = mainMatch[1] || "";
  const innerHtml = mainMatch[2].trim();
  let id = "report-main";
  const classes = [];
  const extraAttrs = [];
  const attributes = {};

  const attrRegex = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=>]+)))?/g;
  let match;
  while ((match = attrRegex.exec(rawAttrs)) !== null) {
    const fullToken = match[0].trim();
    const attrName = match[1];
    const attrNameLower = attrName.toLowerCase();
    const attrValue = match[2] !== undefined
      ? match[2]
      : (match[3] !== undefined ? match[3] : (match[4] !== undefined ? match[4] : ""));

    if (attrNameLower === "id") {
      if (attrValue.trim()) {
        id = attrValue.trim();
        attributes.id = id;
      }
    } else if (attrNameLower === "class") {
      const tokens = attrValue.split(/\s+/).map((t) => t.trim()).filter(Boolean);
      classes.push(...tokens);
      attributes.class = tokens.join(" ");
    } else {
      extraAttrs.push(fullToken);
      attributes[attrName] = match[2] !== undefined || match[3] !== undefined || match[4] !== undefined ? attrValue : true;
    }
  }

  return {
    hasMainWrapper: true,
    id,
    classes: Array.from(new Set(classes)),
    extraAttrs,
    attributes,
    innerHtml
  };
}

/**
 * Normalizes content fragment, removing accidental outer <main> wrappers or frontmatter.
 */
export function extractMainContent(rawContent = "") {
  return extractMainElement(rawContent).innerHtml;
}

function removeBalancedElement(html, startIdx, tagName) {
  let depth = 0;
  const tokenRe = new RegExp(`<(/?)${tagName}\\b[^>]*>`, "gi");
  tokenRe.lastIndex = startIdx;
  let match;
  while ((match = tokenRe.exec(html)) !== null) {
    if (match[1] === "/") {
      depth--;
      if (depth <= 0) {
        return html.slice(0, startIdx) + html.slice(tokenRe.lastIndex);
      }
    } else {
      depth++;
    }
  }
  return html;
}

/**
 * Strips duplicate navbars or sticky print:hidden control bars from fragments
 * so template-shell.html remains the single source of truth for navigation.
 */
export function stripDuplicateNavbars(html = "") {
  if (!html || typeof html !== "string") return { html: html || "", strippedCount: 0 };
  let result = html;
  let strippedCount = 0;

  const patterns = [
    { tag: "nav", regex: /<nav\b[^>]*class=["'][^"']*\bnavbar\b[^"']*["'][^>]*>/i },
    { tag: "header", regex: /<header\b[^>]*class=["'](?=[^"']*\bsticky\b)(?=[^"']*\btop-(?:0|12|14|16|20)\b)[^"']*["'][^>]*>/i },
    { tag: "div", regex: /<div\b[^>]*class=["'](?=[^"']*\bprint:hidden\b)(?=[^"']*\bsticky\b)(?=[^"']*\btop-(?:0|12|14|16|20)\b)[^"']*["'][^>]*>/i }
  ];

  for (const { tag, regex } of patterns) {
    let match;
    while ((match = regex.exec(result)) !== null) {
      const next = removeBalancedElement(result, match.index, tag);
      if (next === result) break;
      result = next;
      strippedCount++;
    }
  }

  return { html: result.trim(), strippedCount };
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
    project: null,
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
    ai: false,
    aiPort: 3031,
    aiModel: "Gemini 3.8 Flash (Low)",
    aiPersona: "analyst",
    aiPurpose: "",
    aiDock: true,
    published: false,
    verify: false,
    json: false,
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
    } else if (arg === "--project" && args[i + 1]) {
      const slug = args[++i]
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (slug) {
        options.project = slug;
        options.output = options.published ? `projects/${slug}/published.html` : `projects/${slug}/index.html`;
      }
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
    } else if (arg === "--ai") {
      options.ai = true;
    } else if (arg === "--ai-port" && args[i + 1]) {
      const parsedPort = Number(args[++i]);
      if (Number.isFinite(parsedPort) && parsedPort > 0) options.aiPort = parsedPort;
      options.ai = true;
    } else if (arg === "--ai-model" && args[i + 1]) {
      options.aiModel = args[++i];
      options.ai = true;
    } else if (arg === "--ai-persona" && args[i + 1]) {
      options.aiPersona = args[++i];
      options.ai = true;
    } else if (arg === "--ai-purpose" && args[i + 1]) {
      options.aiPurpose = args[++i];
      options.ai = true;
    } else if (arg === "--ai-dock") {
      options.aiDock = true;
      options.ai = true;
    } else if (arg === "--no-ai-dock") {
      options.aiDock = false;
      options.ai = true;
    } else if (arg === "--published") {
      options.published = true;
    } else if (arg === "--verify") {
      options.verify = true;
    } else if (arg === "--json") {
      options.json = true;
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
 * Deterministic Agent Hook Stamper:
 * Scans a Semantic Fragment (<main id="report-main">) in document order and
 * stamps deterministic data-agent-* attributes on sections and widgets
 * without clobbering existing IDs or attributes.
 * @param {string} fragmentHtml
 * @returns {{ html: string, sections: Array<object>, widgets: Array<object> }}
 */
export function stampAgentHooks(fragmentHtml = "") {
  if (!fragmentHtml || typeof fragmentHtml !== "string") {
    return { html: "", sections: [], widgets: [] };
  }

  const sections = [];
  const widgets = [];
  const seenSlugs = new Map();
  let sectionIndex = 0;

  const slugify = (text, fallback) => {
    const clean = String(text || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z0-9#]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    return clean || fallback;
  };

  const extractAttr = (attrs, name) => {
    const m = attrs.match(new RegExp(`(?:^|\\s)${name}=["']([^"']*)["']`, "i"));
    return m ? m[1] : null;
  };

  // 1. Stamp <section> elements deterministically in document order
  let stamped = fragmentHtml.replace(/<section\b([^>]*)>/gi, (fullMatch, attrs, offset) => {
    sectionIndex += 1;
    const afterOffset = offset + fullMatch.length;
    const rest = fragmentHtml.slice(afterOffset);
    const nextBoundary = rest.search(/<\/section>|<section\b/i);
    const innerSnippet = nextBoundary >= 0 ? rest.slice(0, nextBoundary) : rest.slice(0, 600);
    const headingMatch = innerSnippet.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
    const label = headingMatch
      ? headingMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : `Section ${sectionIndex}`;

    const existingId = extractAttr(attrs, "id");
    let slug = extractAttr(attrs, "data-agent-section");
    if (!slug) {
      const baseSlug = slugify(label, `section-${sectionIndex}`);
      const count = (seenSlugs.get(baseSlug) || 0) + 1;
      seenSlugs.set(baseSlug, count);
      slug = count > 1 ? `${baseSlug}-${count}` : baseSlug;
    }

    let agentId = extractAttr(attrs, "data-agent-id");
    if (!agentId) {
      agentId = `section-${sectionIndex}`;
    }

    let updatedAttrs = attrs;
    if (!/\bdata-agent-section=/i.test(updatedAttrs)) {
      updatedAttrs += ` data-agent-section="${slug}"`;
    }
    if (!/\bdata-agent-id=/i.test(updatedAttrs)) {
      updatedAttrs += ` data-agent-id="${agentId}"`;
    }

    sections.push({
      agentId,
      slug,
      label,
      id: existingId,
      selector: existingId ? `#${existingId}` : `[data-agent-id="${agentId}"]`
    });

    return `<section${updatedAttrs}>`;
  });

  // 2. Stamp widget elements deterministically in document order
  const widgetCounters = { kpi: 0, chart: 0, mermaid: 0, table: 0 };
  const stampWidgetTag = (tagPattern, type) => {
    stamped = stamped.replace(tagPattern, (fullMatch, tagName, attrs) => {
      widgetCounters[type] += 1;
      const idx = widgetCounters[type];
      const existingId = extractAttr(attrs, "id");
      const existingAgentId = extractAttr(attrs, "data-agent-id");
      const agentId = existingAgentId || `${type}-${idx}`;

      let updatedAttrs = attrs;
      if (!/\bdata-agent-widget=/i.test(updatedAttrs)) {
        updatedAttrs += ` data-agent-widget="${type}"`;
      }
      if (!/\bdata-agent-id=/i.test(updatedAttrs)) {
        updatedAttrs += ` data-agent-id="${agentId}"`;
      }

      widgets.push({
        agentId,
        type,
        id: existingId,
        selector: existingId ? `#${existingId}` : `[data-agent-id="${agentId}"]`
      });

      return `<${tagName}${updatedAttrs}>`;
    });
  };

  stampWidgetTag(/<(div)\b([^>]*\bclass=["'](?:[^"']*\s)?stat(?:\s[^"']*)?["'][^>]*)>/gi, "kpi");
  stampWidgetTag(/<(canvas)\b([^>]*)>/gi, "chart");
  stampWidgetTag(/<(div)\b([^>]*\bclass=["'](?:[^"']*\s)?mermaid(?:\s[^"']*)?["'][^>]*)>/gi, "mermaid");
  stampWidgetTag(/<(table)\b([^>]*)>/gi, "table");

  return { html: stamped, sections, widgets };
}

/**
 * Builds the deterministic machine-readable Agent Manifest for both
 * embedded HTML (<script id="agent-manifest">) and workspace report.manifest.json.
 */
export function buildAgentManifest({
  project = null,
  title = "HTML Report",
  mode = "report",
  theme = "light",
  ai = false,
  aiPort = 3031,
  aiModel = "Gemini 3.8 Flash (Low)",
  aiPersona = "analyst",
  aiPurpose = "",
  aiDock = true,
  published = false,
  pwa = false,
  activeAddons = [],
  source = null,
  contentPath = null,
  sections = [],
  widgets = [],
  workspaceRoot = process.cwd()
} = {}) {
  const entryPath = project ? `projects/${project}/index.html` : (source || "report.html");
  const fragmentPath = project ? `projects/${project}/fragment.html` : (contentPath || "fragment.html");
  const publishedPath = project ? `projects/${project}/published.html` : null;

  const resolvedAiPort = Number.isFinite(Number(aiPort)) && Number(aiPort) > 0 ? Number(aiPort) : 3031;
  const resolvedAiModel = aiModel && String(aiModel).trim() ? String(aiModel).trim() : "Gemini 3.8 Flash (Low)";
  const resolvedAiPersona = aiPersona && String(aiPersona).trim() ? String(aiPersona).trim() : "analyst";
  const resolvedAiPurpose = aiPurpose && String(aiPurpose).trim() ? String(aiPurpose).trim() : "";

  const skillPaths = resolveSkillPaths(workspaceRoot);

  const rebuildArgs = [
    `node ${skillPaths.buildScript}`,
    project ? `--project ${project}` : `--output ${entryPath}`,
    `--content ${fragmentPath}`,
    `--title "${String(title).replace(/"/g, '\\"')}"`,
    `--mode ${mode}`,
    `--theme ${theme}`
  ];
  if (activeAddons.length > 0) rebuildArgs.push(`--addons ${activeAddons.join(",")}`);
  if (ai) {
    rebuildArgs.push("--ai");
    if (resolvedAiPort !== 3031) rebuildArgs.push(`--ai-port ${resolvedAiPort}`);
    if (resolvedAiModel !== "Gemini 3.8 Flash (Low)") rebuildArgs.push(`--ai-model "${resolvedAiModel.replace(/"/g, '\\"')}"`);
    if (resolvedAiPersona !== "analyst") rebuildArgs.push(`--ai-persona ${resolvedAiPersona}`);
    if (resolvedAiPurpose) rebuildArgs.push(`--ai-purpose "${resolvedAiPurpose.replace(/"/g, '\\"')}"`);
    if (!aiDock) rebuildArgs.push("--no-ai-dock");
  }
  if (pwa) rebuildArgs.push("--pwa");

  return {
    schemaVersion: "1.0.0",
    project: project || null,
    title,
    mode,
    theme,
    aiBridge: Boolean(ai),
    aiConfig: ai ? {
      port: resolvedAiPort,
      model: resolvedAiModel,
      persona: resolvedAiPersona,
      floatingAssistant: Boolean(aiDock),
      ...(resolvedAiPurpose ? { purpose: resolvedAiPurpose } : {})
    } : null,
    published: Boolean(published),
    pwa: Boolean(pwa),
    activeAddons,
    files: {
      entry: entryPath,
      fragment: fragmentPath,
      ...(publishedPath ? { published: publishedPath } : {}),
      ...(project ? {
        manifest: `projects/${project}/report.manifest.json`,
        agents: `projects/${project}/AGENTS.md`,
        packageJson: `projects/${project}/package.json`
      } : {})
    },
    pipeline: {
      rebuildCommand: rebuildArgs.join(" "),
      serveCommand: `node ${skillPaths.serveScript} ${entryPath} --port ${resolvedAiPort}`,
      verifyCommand: `node ${skillPaths.verifyScript} ${entryPath}`,
      preflightCommand: `node ${skillPaths.preflightScript} --json`,
      authoringGuide: skillPaths.authoringGuide
    },
    sections,
    widgets
  };
}

const DEFAULT_MAIN_CLASSES = [
  "max-w-7xl",
  "mx-auto",
  "px-4",
  "sm:px-6",
  "lg:px-8",
  "py-8",
  "space-y-10",
  "flex-1",
  "w-full"
];

/**
 * Assembly Engine: Deterministically joins a Semantic Fragment (<main id="report-main">),
 * Template Shell (template-shell.html), and Runtime Script into an Output Deliverable (<100ms).
 * Pipeline orchestration (pre-flight linting, auto-fixing, verification) lives in harness.mjs.
 */
export function buildReport({
  title = "HTML Report",
  content = "",
  project = null,
  contentPath = null,
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
  ai = false,
  aiPort = 3031,
  aiModel = "Gemini 3.8 Flash (Low)",
  aiPersona = "analyst",
  aiPurpose = "",
  aiDock = true,
  published = false,
  source = null,
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
  workspaceRoot = process.cwd(),
  templateShellPath = path.resolve(__dirname, "../assets/template-shell.html"),
  runtimeScriptPath = path.resolve(__dirname, "../assets/report-runtime.js")
} = {}) {
  if (!fs.existsSync(templateShellPath)) {
    throw new Error(`Template shell not found at: ${templateShellPath}`);
  }
  if (!fs.existsSync(runtimeScriptPath)) {
    throw new Error(`Runtime script not found at: ${runtimeScriptPath}`);
  }

  const mainElement = extractMainElement(content);
  let cleanBody = mainElement.innerHtml;
  const { html: dedupedBody, strippedCount } = stripDuplicateNavbars(cleanBody);
  cleanBody = dedupedBody;
  if (strippedCount > 0 && process.env.NODE_ENV !== "test") {
    console.warn(`[html-report] Stripped ${strippedCount} duplicate navbar/control bar(s) from fragment.`);
  }

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
  if (source) {
    headExtraParts.push(`  <meta name="html-report-source" content="${escapeAttr(source)}" />`);
  }
  const resolvedAiPort = Number.isFinite(Number(aiPort)) && Number(aiPort) > 0 ? Number(aiPort) : 3031;
  const resolvedAiModel = aiModel && String(aiModel).trim() ? String(aiModel).trim() : "Gemini 3.8 Flash (Low)";
  const resolvedAiPersona = aiPersona && String(aiPersona).trim() ? String(aiPersona).trim() : "analyst";
  const resolvedAiPurpose = aiPurpose && String(aiPurpose).trim() ? String(aiPurpose).trim() : "";

  if (ai && !published) {
    headExtraParts.push('  <meta name="html-report-ai" content="on" />');
    headExtraParts.push(`  <meta name="html-report-ai-port" content="${escapeAttr(String(resolvedAiPort))}" />`);
    headExtraParts.push(`  <meta name="html-report-ai-model" content="${escapeAttr(resolvedAiModel)}" />`);
    headExtraParts.push(`  <meta name="html-report-ai-persona" content="${escapeAttr(resolvedAiPersona)}" />`);
    if (resolvedAiPurpose) {
      headExtraParts.push(`  <meta name="html-report-ai-purpose" content="${escapeAttr(resolvedAiPurpose)}" />`);
    }
    headExtraParts.push(`  <meta name="html-report-ai-dock" content="${aiDock ? "on" : "off"}" />`);
  }
  if (published) {
    headExtraParts.push('  <meta name="html-report-published" content="true" />');
  }
  // Deterministic Agent-Facing DOM Stamping
  const stampedResult = stampAgentHooks(cleanBody);
  cleanBody = stampedResult.html;

  const agentManifest = buildAgentManifest({
    project,
    title,
    mode: resolvedMode,
    theme: resolvedTheme || "light",
    ai,
    aiPort: resolvedAiPort,
    aiModel: resolvedAiModel,
    aiPersona: resolvedAiPersona,
    aiPurpose: resolvedAiPurpose,
    aiDock,
    published,
    pwa: isPwa,
    activeAddons: activeAddonKeys,
    source,
    contentPath,
    sections: stampedResult.sections,
    widgets: stampedResult.widgets,
    workspaceRoot
  });
  const safeAgentManifestJson = JSON.stringify(agentManifest, null, 2).replace(/<\//g, "<\\/");
  headExtraParts.push(`  <!-- Deterministic Agent Manifest -->\n  <script type="application/json" id="agent-manifest">\n${safeAgentManifestJson}\n  </script>`);

  const headExtras = headExtraParts.join("\n\n");

  // Construct favicon tag
  const faviconTag = generateFaviconTag(favicon);

  // Construct runtime script tag
  const inlinedRuntime = `<script>\n${runtimeScript}\n  </script>`;

  // Slot replacements
  let html = shellTemplate;

  // Set theme attribute on <html> and active theme labels if provided
  if (resolvedTheme) {
    html = html.replace(/data-theme="[^"]*"/i, `data-theme="${resolvedTheme}"`);
    html = html.replace(/(<span[^>]*id="active-theme-label"[^>]*>)[^<]*(<\/span>)/i, `$1${resolvedTheme}$2`);
    html = html.replace(/(<span[^>]*id="modal-active-theme-label"[^>]*>)[^<]*(<\/span>)/i, `$1${resolvedTheme}$2`);
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

  // Preserve <main> id, merged classes, and reactive/custom attributes from fragment
  const mainId = mainElement.id || "report-main";
  const mergedMainClasses = Array.from(new Set([...DEFAULT_MAIN_CLASSES, ...mainElement.classes])).join(" ");
  const mainExtraAttrs = mainElement.extraAttrs.length > 0 ? " " + mainElement.extraAttrs.join(" ") : "";
  const renderedMainOpenTag = `<main id="${escapeAttr(mainId)}" class="${escapeAttr(mergedMainClasses)}"${mainExtraAttrs}>`;
  html = html.replace(/<main\b[^>]*>(?=\s*<!-- \{\{CONTENT\}\} -->)/i, () => renderedMainOpenTag);

  html = html.replace(/<!-- {{HEAD_EXTRAS}} -->/g, () => headExtras);
  html = html.replace(/<!-- {{CONTENT}} -->/g, () => processedBody);
  html = html.replace(/<!-- {{RUNTIME_SCRIPT}} -->/g, () => inlinedRuntime);
  html = html.replace(/<!-- {{CUSTOM_THEMES}} -->/g, () => compiledCustomCss ? `\n${compiledCustomCss}\n  ` : "");

  const version = getPackageVersion();
  html = html.replace(/<!-- {{VERSION}} -->/g, () => version);

  if (ai && !published) {
    const safePersona = escapeAttr(resolvedAiPersona);
    const escapedPersonaRegex = safePersona.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const personaLabel = resolvedAiPersona.charAt(0).toUpperCase() + resolvedAiPersona.slice(1);
    html = html.replace(
      /(<select id="agent-dock-persona"[^>]*>)([\s\S]*?)(<\/select>)/i,
      (full, openTag, innerOpts, closeTag) => {
        let updatedOpts = innerOpts.replace(/\s+selected\b/gi, "");
        const optRegex = new RegExp(`(<option\\s+value=["']${escapedPersonaRegex}["'])(>)`, "i");
        if (optRegex.test(updatedOpts)) {
          updatedOpts = updatedOpts.replace(optRegex, `$1 selected$2`);
        } else {
          updatedOpts = `\n            <option value="${safePersona}" selected>${escapeAttr(personaLabel)}</option>` + updatedOpts;
        }
        return `${openTag}${updatedOpts}${closeTag}`;
      }
    );

    if (resolvedAiPurpose) {
      const safePurpose = escapeAttr(resolvedAiPurpose);
      html = html.replace(
        /(<p id="agent-dock-welcome-copy"[^>]*>)[\s\S]*?(<\/p>)/i,
        (full, openTag, closeTag) => `${openTag}${safePurpose} Press <kbd class="kbd kbd-xs font-mono">⌘K</kbd> to toggle.${closeTag}`
      );
    } else if (resolvedAiPersona.toLowerCase() === "support") {
      html = html.replace(
        /(<p id="agent-dock-welcome-copy"[^>]*>)[\s\S]*?(<\/p>)/i,
        (full, openTag, closeTag) => `${openTag}Ask questions about the documentation, setup steps, or troubleshooting guidance on this page. Press <kbd class="kbd kbd-xs font-mono">⌘K</kbd> to toggle.${closeTag}`
      );
    }
  }

  if (!aiDock) {
    html = stripAiDockMarkup(html);
  }

  if (published) {
    html = stripAuthoringMarkup(html);
  }

  return {
    html,
    activeAddons: activeAddonKeys,
    mode: resolvedMode,
    theme: resolvedTheme || "light",
    hasCustomTheme: Boolean(compiledCustomCss),
    isPwa,
    agentManifest,
    mainElement,
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
html-report deterministic Assembly CLI (build-report.mjs)

Usage:
  node build-report.mjs --content <fragment.html> [options]

Options:
  -c, --content <file>      Path to Semantic Fragment (<main id="report-main">) file (required)
  -t, --title <string>      Output Deliverable title (default: "HTML Report")
  -o, --output <file>       Destination Output Deliverable HTML file (default: "./report.html")
      --project <slug>      Scaffold output into projects/<slug>/index.html (or published.html with --published)
  -m, --mode <name>         Delivery Archetype / mode: print, report, presentation, dashboard, working-report, live-report (default: "report")
  -p, --print, --printable  Enable printable/PDF mode (@media print rules, Static File + Passive)
      --presentation        Enable interactive slide deck presentation mode
      --dashboard           Enable interactive telemetry dashboard mode
      --working-report      Enable OpenSpec Journey companion mode
  -l, --live, --live-report Enable Server-Connected Datastar SSE live mode
      --pwa                 Enable Offline Packaging Modifier (PWA manifest, sw.js, and icons)
      --pwa-name <name>     Custom PWA app name
      --pwa-short-name <nm> Custom PWA short name for homescreen
      --pwa-theme-color <c> Custom PWA window/status-bar theme color (default: #2563eb)
      --pwa-bg-color <c>    Custom PWA splash screen background color (default: #ffffff)
      --pwa-icon <emoji>    Custom PWA icon emoji glyph (default: favicon or 📊)
      --no-pwa-assets       Skip writing companion PWA files to disk
      --ai                  Enable Two-Way AI Agent Bridge controls in Settings
      --published           Emit a Published Document with Edit Mode authoring chrome pruned
      --verify              Run deterministic Playwright verification (verify-report.mjs --quick) after assembly
      --json                Output machine-readable JSON Assembly summary (Agent-Facing)
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
      --quill, --wysiwyg, --editor Explicitly include Quill WYSIWYG editor
      --fullcalendar        Explicitly include FullCalendar
      --feed <name>=<url>   Inject feed nickname mapping into #feed-registry
      --freeze-feeds        Fetch and bake snapshot payloads into data-feed-fallback
      --feed-interval <ms>  Override polling interval for public feeds
  -v, --version             Display semantic version
  -h, --help                Show this help message
`);
}

// CLI entry point
const isDirectCli = isDirectCliExecution(process.argv[1], import.meta.url);

if (isDirectCli) {
  const rawArgv = process.argv.slice(2);
  const hasFlag = (...names) => rawArgv.some((a) => names.includes(a));
  const options = parseArgs(process.argv);

  if (options.version) {
    console.log(formatVersionString());
    process.exit(0);
  }

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Infer project slug from --content or --output if --project was not explicitly provided
  if (!options.project) {
    for (const candidate of [options.output, options.content]) {
      if (!candidate) continue;
      const normalizedCand = String(candidate).replace(/\\/g, "/");
      const m = normalizedCand.match(/(?:^|\/)projects\/([a-z0-9-]+)\//i);
      if (m) {
        options.project = m[1].toLowerCase();
        break;
      }
    }
  }

  // Support `build-report.mjs --project <slug>` without requiring --content
  if (options.project) {
    const cwdProjectDir = path.resolve(process.cwd(), "projects", options.project);
    const repoProjectDir = path.resolve(REPO_ROOT, "projects", options.project);
    const projectBaseDir = fs.existsSync(cwdProjectDir)
      ? cwdProjectDir
      : (fs.existsSync(repoProjectDir) ? repoProjectDir : cwdProjectDir);

    if (!options.content) {
      const defaultFrag = path.join(projectBaseDir, "fragment.html");
      if (fs.existsSync(defaultFrag)) {
        options.content = defaultFrag;
      }
    }

    const manifestFile = path.join(projectBaseDir, "report.manifest.json");
    if (fs.existsSync(manifestFile)) {
      try {
        const saved = JSON.parse(fs.readFileSync(manifestFile, "utf-8"));
        if (!hasFlag("--title", "-t") && saved.title) options.title = saved.title;
        if (!hasFlag("--mode", "-m", "--print", "--printable", "-p", "--presentation", "--dashboard", "--working", "--working-report", "--live", "-l", "--live-report") && saved.mode) {
          options.mode = saved.mode;
          if (saved.mode === "print") options.printable = true;
          if (saved.mode === "presentation") options.presentation = true;
          if (saved.mode === "live-report") options.live = true;
        }
        if (!hasFlag("--theme") && saved.theme) options.theme = saved.theme;
        if (!hasFlag("--addons") && Array.isArray(saved.activeAddons) && saved.activeAddons.length > 0) {
          options.addons = Array.from(new Set([...options.addons, ...saved.activeAddons]));
        }
        if (saved.pwa && !hasFlag("--pwa")) options.pwa = true;
        if (saved.aiBridge) {
          if (!hasFlag("--ai")) options.ai = true;
          if (saved.aiConfig) {
            if (!hasFlag("--ai-port") && saved.aiConfig.port) options.aiPort = saved.aiConfig.port;
            if (!hasFlag("--ai-model") && saved.aiConfig.model) options.aiModel = saved.aiConfig.model;
            if (!hasFlag("--ai-persona") && saved.aiConfig.persona) options.aiPersona = saved.aiConfig.persona;
            if (!hasFlag("--ai-purpose") && saved.aiConfig.purpose) options.aiPurpose = saved.aiConfig.purpose;
            if (!hasFlag("--ai-dock", "--no-ai-dock") && typeof saved.aiConfig.floatingAssistant === "boolean") {
              options.aiDock = saved.aiConfig.floatingAssistant;
            }
          }
        }
      } catch (_) {}
    }

    if (options.published && !hasFlag("--output", "-o")) {
      options.output = `projects/${options.project}/published.html`;
    }
  }

  if (!options.content) {
    console.error("Error: --content <file> is required (or pass --project <slug> for an existing project with fragment.html).");
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

  const { html, activeAddons, mode, isPwa, pwaConfig, agentManifest } = buildReport({
    title: options.title,
    content: rawContent,
    project: options.project || null,
    contentPath: options.content,
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
    feedInterval: options.feedInterval,
    ai: options.ai,
    aiPort: options.aiPort,
    aiModel: options.aiModel,
    aiPersona: options.aiPersona,
    aiPurpose: options.aiPurpose,
    aiDock: options.aiDock,
    published: options.published,
    source: options.output
  });

  const outputPath = path.resolve(process.cwd(), options.output);
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, html, "utf-8");

  if (options.project && !options.published) {
    const manifestPath = path.join(outputDir, "report.manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(agentManifest, null, 2) + "\n", "utf-8");
  }

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

  // Mirror project outputs to REPO_ROOT/projects/<slug>/ when invoked from an external working directory
  if (
    options.project &&
    path.resolve(process.cwd()) !== REPO_ROOT &&
    !outputDir.startsWith(os.tmpdir()) &&
    fs.existsSync(path.join(REPO_ROOT, "create.html"))
  ) {
    const repoProjectDir = path.join(REPO_ROOT, "projects", options.project);
    const resolvedOutputDir = path.resolve(outputDir);
    if (resolvedOutputDir !== path.resolve(repoProjectDir)) {
      try {
        fs.mkdirSync(repoProjectDir, { recursive: true });
        const isDedicatedProjectDir =
          path.basename(resolvedOutputDir) === options.project &&
          path.basename(path.dirname(resolvedOutputDir)) === "projects";
        if (isDedicatedProjectDir) {
          fs.cpSync(resolvedOutputDir, repoProjectDir, { recursive: true, force: true });
        } else {
          fs.copyFileSync(outputPath, path.join(repoProjectDir, path.basename(outputPath)));
        }
      } catch (_) {}
    }
  }

  let verifySummary = null;
  if (options.verify) {
    const verifyScript = path.resolve(__dirname, "../playwright/verify-report.mjs");
    const verifyJsonPath = path.join(outputDir, ".verify-report.json");
    const res = child_process.spawnSync(
      process.execPath,
      [verifyScript, outputPath, "--quick", "--json", verifyJsonPath],
      { encoding: "utf-8", stdio: options.json ? "pipe" : "inherit" }
    );
    if (fs.existsSync(verifyJsonPath)) {
      try {
        verifySummary = JSON.parse(fs.readFileSync(verifyJsonPath, "utf-8"));
      } catch (_) {}
      try { fs.unlinkSync(verifyJsonPath); } catch (_) {}
    }
    if (res.status !== 0) {
      if (options.json) {
        console.log(JSON.stringify({
          ok: false,
          output: outputPath,
          mode,
          activeAddons,
          published: Boolean(options.published),
          verification: verifySummary || { summary: { compliant: false }, errors: ["Verification failed"] }
        }, null, 2));
      }
      process.exit(res.status || 1);
    }
  }

  const elapsedMs = Math.round((performance.now() - startTime) * 100) / 100;
  if (options.json) {
    console.log(JSON.stringify({
      ok: true,
      output: outputPath,
      mode,
      activeAddons,
      isPwa,
      published: Boolean(options.published),
      ...(verifySummary ? { verification: verifySummary } : {}),
      elapsedMs
    }, null, 2));
  } else {
    console.log(`[html-report] Report assembled in ${elapsedMs}ms:`);
    console.log(`  Output:        ${outputPath}`);
    console.log(`  Mode:          ${mode}`);
    if (isPwa) {
      console.log(`  PWA Assets:    manifest.webmanifest, sw.js, icon.svg in ${outputDir}`);
    }
    console.log(`  Active Addons: ${activeAddons.length > 0 ? activeAddons.join(", ") : "Core 4 only"}`);
  }
}
