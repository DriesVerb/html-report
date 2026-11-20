/**
 * @file lib/domain/studio-config.mjs
 * Canonical domain target definitions, DaisyUI themes, addon catalog,
 * widget presets, domain config normalization, and CLI/prompt synthesis.
 */

export const DAISYUI_THEMES = [
  "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
  "synthwave", "retro", "cyberpunk", "valentine", "halloween", "garden",
  "forest", "aqua", "lofi", "pastel", "fantasy", "wireframe",
  "black", "luxury", "dracula", "cmyk", "autumn", "business",
  "acid", "lemonade", "night", "coffee", "winter", "dim",
  "nord", "sunset"
];

export const TARGET_DEFINITIONS = {
  report: {
    key: "report",
    aliases: ["executive-report", "analytical", "standard"],
    humanName: "Executive Analytical Report",
    defaultHero: "Quarterly Strategic Performance Report",
    skillName: "html-report",
    skillTag: "@html-report",
    cliMode: "report",
    defaultAddons: ["charts", "mermaid", "gridjs", "showdown"],
    description: "Multi-tab KPI scorecards, interactive Chart.js charts, and Grid.js data tables."
  },
  print: {
    key: "print",
    aliases: ["printable-doc", "pdf", "compliance", "invoice"],
    humanName: "Printable Document / Compliance PDF",
    defaultHero: "Formal Executive Audit & Compliance Document",
    skillName: "html-print",
    skillTag: "@html-print",
    cliMode: "print",
    defaultAddons: ["charts", "gridjs"],
    description: "Pixel-perfect paginated A4/Letter documents, invoices, and @page print layouts."
  },
  dashboard: {
    key: "dashboard",
    aliases: ["live-dashboard", "telemetry", "cockpit", "monitoring"],
    humanName: "Real-Time Telemetry Dashboard",
    defaultHero: "Live Telemetry & System Monitoring Cockpit",
    skillName: "html-dashboard",
    skillTag: "@html-dashboard",
    cliMode: "dashboard",
    defaultAddons: ["charts", "gridjs"],
    description: "Reactive hypermedia streaming, Datastar SSE updates, and telemetry monitors."
  },
  presentation: {
    key: "presentation",
    aliases: ["slide-presentation", "deck", "slides", "keynote"],
    humanName: "Interactive Slide Deck Presentation (Reveal.js)",
    defaultHero: "Strategic Roadmap & Product Keynote Deck",
    skillName: "html-presentation",
    skillTag: "@html-presentation",
    cliMode: "presentation",
    defaultAddons: ["mermaid"],
    description: "Interactive slide transitions via Reveal.js and keyboard navigation."
  }
};

export const CORE_CDN_STACK = {
  tailwindcss: { name: "Tailwind CSS Play CDN", url: "https://cdn.tailwindcss.com" },
  daisyui: { name: "DaisyUI", version: "4.12.14", themes: 32, defaultTheme: "light" },
  lucide: { name: "Lucide Icons", version: "0.460.0" },
  alpinejs: { name: "Alpine.js", version: "3.14.3" }
};

export const ADDON_CATALOG = {
  charts: { flag: "--charts", label: "Interactive Charts (Chart.js v4.4)" },
  mermaid: { flag: "--mermaid", label: "Process Flows & Diagrams (Mermaid v11.4)" },
  gridjs: { flag: "--gridjs", label: "Sortable Data Tables (Grid.js v6.0)" },
  leaflet: { flag: "--leaflet", label: "Geographic Maps (Leaflet v1.9)" },
  katex: { flag: "--katex", label: "Scientific Math & Formulas (KaTeX v0.16)" },
  fullcalendar: { flag: "--fullcalendar", label: "Schedules & Calendars (FullCalendar v6.1)" },
  showdown: { flag: "--showdown", label: "Markdown Viewer & Modals (Showdown v2.1)" },
  quill: { flag: "--quill", label: "WYSIWYG Rich Text Editor (Quill v2.0)" },
  highlightjs: { flag: "--hljs", label: "Code Syntax Highlighting (Highlight.js v11.10)" },
  dayjs: { flag: "--dayjs", label: "Date Calculation (Day.js v1.11)" },
  marked: { flag: "--marked", label: "Markdown Prose Parsing (Marked v14.1)" },
  reveal: { flag: "--reveal", label: "Slide Deck Engine (Reveal.js v5.1)" },
  mockjs: { flag: "--mockjs", label: "Synthetic Data Generation (Mock.js v1.1)" },
  datastar: { flag: "--datastar", label: "Real-Time Hypermedia SSE (Datastar v1.0-beta.9)" },
  impress: { flag: "--impress", label: "Legacy 3D Spatial Deck (Impress.js v1.1)" }
};

export const ADDON_ALIASES = {
  chart: "charts",
  chartjs: "charts",
  math: "katex",
  hljs: "highlightjs",
  highlight: "highlightjs",
  "highlight.js": "highlightjs",
  map: "leaflet",
  maps: "leaflet",
  day: "dayjs",
  wysiwyg: "quill",
  editor: "quill",
  calendar: "fullcalendar",
  fullcalender: "fullcalendar",
  "markdown-showdown": "showdown",
  revealjs: "reveal",
  "reveal.js": "reveal",
  impressjs: "impress",
  mock: "mockjs",
  live: "datastar"
};

export function normalizeAddonKey(rawAddon) {
  if (!rawAddon || typeof rawAddon !== "string") return "";
  const clean = rawAddon.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ADDON_CATALOG, clean)) return clean;
  return ADDON_ALIASES[clean] || "";
}

export const WIDGET_PRESETS = {
  "kpi-row": {
    key: "kpi-row",
    label: "KPI Scorecard Row",
    description: "Responsive DaisyUI v4 stats row with primary, secondary, and accent KPI cards.",
    addons: []
  },
  "chart-pair": {
    key: "chart-pair",
    label: "Chart.js Dual Analytics",
    description: "Side-by-side responsive Chart.js bar and trend canvases pre-wired for dataset metrics.",
    addons: ["charts"]
  },
  "grid-table": {
    key: "grid-table",
    label: "Sortable Grid.js Table",
    description: "Searchable, sortable, paginated Grid.js data table pre-bound to attached CSV/JSON records.",
    addons: ["gridjs"]
  },
  "mermaid-flow": {
    key: "mermaid-flow",
    label: "Mermaid Process Flow",
    description: "Theme-adaptive Mermaid flowchart / system architecture diagram block.",
    addons: ["mermaid"]
  },
  "timeline": {
    key: "timeline",
    label: "Milestone Timeline",
    description: "DaisyUI vertical milestone timeline component for roadmaps and audit events.",
    addons: []
  }
};

export function normalizeTarget(rawTarget) {
  if (!rawTarget || typeof rawTarget !== "string") return "report";
  const clean = rawTarget.trim().toLowerCase();
  for (const [key, def] of Object.entries(TARGET_DEFINITIONS)) {
    if (key === clean || def.aliases.includes(clean)) return key;
  }
  return "report";
}

export function normalizeDomainConfig(input = {}) {
  const target = normalizeTarget(input.target);
  const targetDef = TARGET_DEFINITIONS[target];

  let title = (input.title && typeof input.title === "string") ? input.title.trim() : targetDef.defaultHero;
  let operationalMode = input.operationalMode === "live" ? "live" : "static";

  if (target === "print") {
    operationalMode = "static";
  } else if (target === "dashboard" && operationalMode !== "live") {
    if (input.operationalMode === undefined) {
      operationalMode = "live";
    }
  }

  let appPackaging = "browser";
  const rawApp = input.appPackaging || input.app;
  if (rawApp === "live-app" || rawApp === "window" || rawApp === "pwa-live") {
    appPackaging = "live-app";
    if (target !== "print") {
      operationalMode = "live";
    } else {
      appPackaging = "browser";
    }
  } else if (rawApp === "offline-app" || rawApp === "offline" || rawApp === "pwa-offline") {
    appPackaging = target === "print" ? "browser" : "offline-app";
  }

  if (target === "print") {
    appPackaging = "browser";
    operationalMode = "static";
  }

  const normalizeThemeName = (val) => {
    if (!val || typeof val !== "string") return "";
    const low = val.trim().toLowerCase();
    return low === "lemon" ? "lemonade" : low;
  };
  let defaultStartupTheme = "light";
  const candidateStartup = normalizeThemeName(input.defaultStartupTheme);
  const candidateTheme = normalizeThemeName(input.theme);
  if (candidateStartup && DAISYUI_THEMES.includes(candidateStartup)) {
    defaultStartupTheme = candidateStartup;
  } else if (candidateTheme && DAISYUI_THEMES.includes(candidateTheme)) {
    defaultStartupTheme = candidateTheme;
  }

  const rawSlug = typeof input.projectSlug === "string"
    ? input.projectSlug
    : (typeof input.slug === "string" ? input.slug : "");
  const projectSlug = rawSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || null;

  let customBrandColorHex = null;
  const hex = input.customBrandColorHex || input.customColor;
  if (typeof hex === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex.trim())) {
    customBrandColorHex = hex.trim().toLowerCase();
  }

  const rawFeatures = input.features || {};
  let addons = Array.isArray(rawFeatures.addons)
    ? [...new Set(rawFeatures.addons.map(normalizeAddonKey).filter(Boolean))]
    : [...targetDef.defaultAddons];

  const rawWidgets = Array.isArray(input.widgets)
    ? input.widgets
    : (Array.isArray(rawFeatures.widgets) ? rawFeatures.widgets : []);
  const widgets = [...new Set(
    rawWidgets
      .map((w) => String(w || "").trim().toLowerCase())
      .filter((w) => Object.prototype.hasOwnProperty.call(WIDGET_PRESETS, w))
  )];
  for (const wKey of widgets) {
    for (const reqAddon of WIDGET_PRESETS[wKey].addons || []) {
      if (!addons.includes(reqAddon)) addons.push(reqAddon);
    }
  }

  let hasAiAgentBridge = Boolean(rawFeatures.hasAiAgentBridge ?? input.hasAiAgentBridge ?? false);
  let hasEnterpriseMcpTools = Boolean(rawFeatures.hasEnterpriseMcpTools ?? input.hasEnterpriseMcpTools ?? false);

  if (operationalMode !== "live") {
    hasAiAgentBridge = false;
    hasEnterpriseMcpTools = false;
  }

  const rawRefs = input.referenceFiles || [];
  const referenceFiles = Array.isArray(rawRefs)
    ? rawRefs.map((r) => {
        if (typeof r === "string") return { name: r, note: "" };
        return {
          name: typeof r?.name === "string" ? r.name : "reference-file",
          note: typeof r?.note === "string" ? r.note : "",
          category: typeof r?.category === "string" ? r.category : undefined
        };
      })
    : [];

  return {
    title,
    projectSlug,
    target,
    targetDef,
    operationalMode,
    servingMode: operationalMode === "live" ? "live" : "static",
    behavioralMode: target === "print" || input.behavioralMode === "passive" ? "passive" : "interactive",
    appPackaging,
    defaultStartupTheme,
    customBrandColorHex,
    referenceFiles,
    widgets,
    features: {
      addons,
      hasAiAgentBridge,
      hasEnterpriseMcpTools
    }
  };
}

export function resolveSiblingSkill(config) {
  const norm = normalizeDomainConfig(config);
  const def = norm.targetDef;
  return {
    skillName: def.skillName,
    skillTag: def.skillTag,
    humanName: def.humanName,
    description: def.description
  };
}

export function generateCliCommand(config, options = {}) {
  const norm = normalizeDomainConfig(config);
  const projectSlug = options.project ||
    norm.projectSlug ||
    String(norm.title || "report")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) ||
    "report";
  const contentFile = options.contentFile || (options.outputFile ? "fragment.html" : `projects/${projectSlug}/fragment.html`);
  const outputFile = options.outputFile || `projects/${projectSlug}/index.html`;

  const buildFlags = [];

  if (norm.target === "print") {
    buildFlags.push("--mode print", "--print");
  } else if (norm.target === "dashboard") {
    buildFlags.push("--mode dashboard", "--dashboard");
  } else if (norm.target === "presentation") {
    buildFlags.push("--mode presentation", "--presentation");
  }

  if (norm.operationalMode === "live") {
    buildFlags.push("--live");
  }
  if (norm.features.hasAiAgentBridge) {
    buildFlags.push("--ai");
  }

  if (norm.appPackaging === "live-app" || norm.appPackaging === "offline-app") {
    buildFlags.push("--pwa", `--pwa-name "${norm.title}"`);
  }

  for (const addon of norm.features.addons) {
    const meta = ADDON_CATALOG[addon];
    if (meta && !buildFlags.includes(meta.flag)) {
      buildFlags.push(meta.flag);
    }
  }

  if (norm.defaultStartupTheme && norm.defaultStartupTheme !== "light") {
    buildFlags.push(`--theme ${norm.defaultStartupTheme}`);
  }
  if (norm.customBrandColorHex) {
    buildFlags.push(`--custom-theme "primary=${norm.customBrandColorHex}"`);
  }

  const targetFlag = options.outputFile ? `--output ${outputFile}` : `--project ${projectSlug}`;
  const buildCommand = `node skills/html-report/scripts/build-report.mjs \\
  --title "${norm.title}" \\
  --content ${contentFile} \\
  ${targetFlag}${buildFlags.length > 0 ? " \\\n  " + buildFlags.join(" \\\n  ") : ""}`;

  let serveCommand = null;
  if (norm.operationalMode === "live") {
    const port = options.port || 3031;
    serveCommand = `node skills/html-report/scripts/serve-report.mjs ${outputFile} --port ${port} --no-open`;
  }

  return {
    buildFlags,
    buildCommand,
    serveCommand
  };
}

export function generateDeterministicPrompt(config) {
  const norm = normalizeDomainConfig(config);
  const def = norm.targetDef;
  const cli = generateCliCommand(norm);

  const addonDescriptions = norm.features.addons
    .map((k) => ADDON_CATALOG[k]?.label || k)
    .map((label) => `  • ${label}`);

  const liveFeatures = [];
  if (norm.features.hasAiAgentBridge) {
    liveFeatures.push("  • Interactive AI Assistant (In-browser Cmd+K dock with live Datastar fragment morphing)");
  }
  if (norm.features.hasEnterpriseMcpTools) {
    liveFeatures.push("  • Enterprise Tools Gateway (Proxy widgets to Postgres / GitLab MCP servers)");
  }

  const appDescription = norm.appPackaging === "browser"
    ? "Standard Browser Page"
    : norm.appPackaging === "live-app"
      ? "Downloadable App (Standalone Window, Live Connected)"
      : "Downloadable Offline-First App (100% Offline Service Worker Cache)";

  const lines = [
    `Invoked via /html-studio -> Routing to Specialized Facade: ${def.skillTag}`,
    "",
    "Deliverable Architecture:",
    `- Purpose & Format: ${def.humanName.toUpperCase()}`,
    `- Operational Mode: ${norm.operationalMode === "static" ? "STATIC_STANDALONE (Zero server required, single self-contained HTML file)" : `LIVE_CONNECTED (Server-backed SSE stream on localhost:${config.port || 3031})`}`,
    `- App Packaging: ${appDescription}`,
    `- Startup Theme: "${norm.defaultStartupTheme}" (Default on first load; readers can switch between 32 themes via navbar)`
  ];

  if (norm.customBrandColorHex) {
    lines.push(`- Custom Brand Color: Primary "${norm.customBrandColorHex}" with auto-harmonized contrast math`);
  }

  lines.push("- Content & Visual Capabilities:");
  if (addonDescriptions.length > 0) {
    lines.push(...addonDescriptions);
  } else {
    lines.push("  • Minimal Semantic HTML (Zero heavy addons)");
  }

  if (norm.widgets && norm.widgets.length > 0) {
    lines.push("- Starter Widget Presets:");
    norm.widgets.forEach((w) => {
      const preset = WIDGET_PRESETS[w];
      lines.push(`  • ${preset ? `${preset.label} (${w})` : w}`);
    });
  }

  if (liveFeatures.length > 0) {
    lines.push("- Intelligence & Live Connectivity:");
    lines.push(...liveFeatures);
  }

  if (norm.referenceFiles && norm.referenceFiles.length > 0) {
    lines.push("- Reference Documents, Images & Data-Sets:");
    norm.referenceFiles.forEach((f) => {
      const notePart = f.note && f.note.trim() ? ` (Context Note: "${f.note.trim()}")` : "";
      lines.push(`  • ${f.name}${notePart}`);
    });
  }

  lines.push("");
  lines.push("Deterministic Build Command (Optional Node CLI):");
  lines.push("```bash");
  lines.push(cli.buildCommand);
  lines.push("```");

  if (cli.serveCommand) {
    lines.push("");
    lines.push("Live Streaming Dev Server Command:");
    lines.push("```bash");
    lines.push(cli.serveCommand);
    lines.push("```");
  }

  return lines.join("\n");
}
