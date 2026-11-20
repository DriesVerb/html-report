/**
 * Addon CDN Registry, Mode Normalization, and Print CSS for @html-report/core.
 */

export const ADDON_REGISTRY = {
  charts: {
    name: "Chart.js",
    signatures: [/<canvas\b/i, /\bnew\s+Chart\s*\(/i, /\bChart\.register\b/i, /\bdata-chart(?:-source)?\b/i],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js" integrity="sha384-Sse/HDqcypGpyTDpvZOJNnG0TT3feGQUkF9H+mnRvic+LjR+K1NhTt8f51KIQ3v3" crossorigin="anonymous"></script>`
  },
  mermaid: {
    name: "Mermaid",
    signatures: [
      /class=["'][^"']*\bmermaid\b/i,
      /<pre\s+class=["']mermaid["']/i,
      /\bdata-mermaid-src\b/i,
      /<!--\s*(?:\{\{MERMAID:|@mermaid\s+)/i
    ],
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
    signatures: [
      /class=["'][^"']*\bkatex\b/i,
      /\bdata-katex\b/i,
      /id=["']katex-/i,
      /\bkatex\.render/i,
      /\brenderMathInElement\b/i,
      /\\\(.*?\\\)/,
      /\\\[.*?\\\]/
    ],
    head: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous" />
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>`
  },
  leaflet: {
    name: "Leaflet",
    signatures: [
      /class=["'][^"']*\bleaflet-/i,
      /\bdata-leaflet(?:-source)?\b/i,
      /\bL\.(?:map|tileLayer|marker|circleMarker)\s*\(/,
      /id=["'](?:datacenterMap|map)["']/i,
      /leaflet-pane/i
    ],
    head: `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="anonymous" />
  <script defer src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin="anonymous"></script>`
  },
  hljs: {
    name: "Highlight.js",
    signatures: [
      /class=["'][^"']*\bhljs\b/i,
      /\bdata-hljs\b/i,
      /\bhljs\.highlight/i,
      /class=["'][^"']*\blanguage-[a-z0-9_-]+/i
    ],
    head: `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/github-dark.min.css" crossorigin="anonymous" />
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/highlight.min.js" crossorigin="anonymous"></script>
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/languages/kotlin.min.js" crossorigin="anonymous"></script>`
  },
  marked: {
    name: "Marked",
    signatures: [
      /id=["']markdown-(?:source|output)["']/i,
      /\bdata-marked\b/i,
      /\bmarked\.(?:parse|setOptions|use)\b/i,
      /\bwindow\.marked\b/i
    ],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/marked@14.1.3/marked.min.js" crossorigin="anonymous"></script>`
  },
  dayjs: {
    name: "Day.js",
    signatures: [/data-dayjs/i, /\bdayjs\s*\(/, /\bdayjs\.extend\s*\(/],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/dayjs@1.11.13/dayjs.min.js" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/dayjs@1.11.13/plugin/relativeTime.js" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/dayjs@1.11.13/plugin/customParseFormat.js" crossorigin="anonymous"></script>`
  },
  impress: {
    name: "Impress.js",
    signatures: [/id=["']impress["']/i, /class=["'][^"']*\bstep\b[^"']*data-x/i, /\bimpress\s*\(\s*\)/],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/impress.js@1.1.0/js/impress.js" crossorigin="anonymous"></script>`
  },
  reveal: {
    name: "Reveal.js",
    signatures: [
      /class=["'][^"']*\breveal\b/i,
      /id=["']presentation-deck["']/i,
      /\bReveal\.initialize\s*\(/i
    ],
    head: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css" integrity="sha384-YgvgKeZJykuztG+iQPoZHNZENTFZvOcOJ/uRzmJTje6GHYN9zAw+y5rx/L8MQKA/" crossorigin="anonymous" />
  <script defer src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js" integrity="sha384-M/JtqCVlLcK9lwVnBnMXP0V577CBULkjodKsR/PITOe4MSKNbbwqCemEyluOw0+5" crossorigin="anonymous"></script>`
  },
  mockjs: {
    name: "Mock.js",
    signatures: [/\bMock\.(?:mock|Random)\b/i, /data-mock/i, /id=["']mock-/i],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/mockjs@1.1.0/dist/mock.min.js" crossorigin="anonymous"></script>`
  },
  showdown: {
    name: "Showdown",
    signatures: [/\bnew\s+(?:window\.)?showdown\.Converter/i, /\bwindow\.showdown\b/i, /data-showdown/i, /data-markdown-showdown/i, /id=["']showdown-/i],
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
      /data-feed-chart\b/i
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

export const ADDON_ALIASES = {
  chart: "charts",
  chartjs: "charts",
  math: "katex",
  highlight: "hljs",
  highlightjs: "hljs",
  map: "leaflet",
  maps: "leaflet",
  day: "dayjs",
  dayjs: "dayjs",
  impress: "impress",
  datastar: "datastar",
  live: "datastar",
  impressjs: "impress",
  reveal: "reveal",
  revealjs: "reveal",
  "reveal.js": "reveal",
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

export const PRINT_MEDIA_CSS = `
  <style id="printable-media-styles">
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 16mm 14mm;
    }
    #print-cover-page,
    .print-only-summary {
      display: none;
    }
    @media print {
      body {
        background-color: #ffffff !important;
        color: #111827 !important;
      }
      main,
      #report-main {
        max-width: 100% !important;
        width: 100% !important;
        padding: 0 !important;
        margin: 0 auto !important;
      }
      header,
      .navbar,
      footer,
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
        min-height: 245mm !important;
        break-after: page !important;
        page-break-after: always !important;
      }
      .print-only-summary {
        display: block !important;
      }
      .break-inside-avoid,
      .print\\:break-inside-avoid {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .break-after-page,
      .print\\:break-after-page {
        break-after: page !important;
        page-break-after: always !important;
      }
      thead {
        display: table-header-group !important;
      }
      tfoot {
        display: table-row-group !important;
      }
      tr,
      td,
      th {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .overflow-x-auto {
        overflow: visible !important;
      }
      canvas {
        max-width: 100% !important;
        height: auto !important;
      }
      .card {
        box-shadow: none !important;
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

export function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function normalizeMode(rawMode) {
  if (!rawMode || typeof rawMode !== "string") return null;
  const cleaned = rawMode.toLowerCase().trim();
  return MODE_ALIASES[cleaned] || null;
}

/**
 * Scans content fragment for known feature signatures and merges with explicit addon requests.
 */
export function detectAddons(content = "", explicitAddons = [], { autoDetect = true } = {}) {
  const active = new Set();

  for (const raw of explicitAddons) {
    const key = String(raw || "").toLowerCase().trim();
    if (!key || key === "none") continue;
    const normalized = ADDON_ALIASES[key] || key;
    if (ADDON_REGISTRY[normalized]) {
      active.add(normalized);
    }
  }

  if (autoDetect !== false) {
    for (const [key, addon] of Object.entries(ADDON_REGISTRY)) {
      if (active.has(key)) continue;
      for (const pattern of addon.signatures) {
        if (pattern.test(content)) {
          active.add(key);
          break;
        }
      }
    }
  }

  return Array.from(active);
}

/**
 * Generates an SVG emoji favicon tag.
 */
export function generateFaviconTag(emoticon = "📊") {
  const cleanEmoji = emoticon.trim() || "📊";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${cleanEmoji}</text></svg>`;
  return `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}" />`;
}
