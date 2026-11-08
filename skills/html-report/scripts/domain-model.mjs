/**
 * @file domain-model.mjs
 * Canonical domain decision model and deterministic prompt generator for html-create.
 * Shared between browser interactive studio (create.html) and CLI interview (html-grill.mjs).
 * Zero external npm dependencies.
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

export const ADDON_CATALOG = {
  charts: { flag: "--charts", label: "Interactive Charts (Chart.js v4.4)" },
  mermaid: { flag: "--mermaid", label: "Process Flows & Diagrams (Mermaid v11.4)" },
  gridjs: { flag: "--gridjs", label: "Sortable Data Tables (Grid.js v6.2)" },
  leaflet: { flag: "--leaflet", label: "Geographic Maps (Leaflet v1.9)" },
  katex: { flag: "--katex", label: "Scientific Math & Formulas (KaTeX v0.16)" },
  fullcalendar: { flag: "--fullcalendar", label: "Schedules & Calendars (FullCalendar v6.1)" },
  showdown: { flag: "--showdown", label: "Markdown Viewer & Modals (Showdown v2.1)" },
  quill: { flag: "--quill", label: "WYSIWYG Rich Text Editor (Quill v2.0)" },
  highlightjs: { flag: "--hljs", label: "Code Syntax Highlighting (Highlight.js v11.9)" },
  dayjs: { flag: "--dayjs", label: "Date Calculation (Day.js v1.11)" }
};

/**
 * Normalizes user/CLI input target into canonical key.
 * @param {string} rawTarget
 * @returns {string} Canonical target key ('report' | 'print' | 'dashboard' | 'presentation')
 */
export function normalizeTarget(rawTarget) {
  if (!rawTarget || typeof rawTarget !== "string") return "report";
  const clean = rawTarget.trim().toLowerCase();
  for (const [key, def] of Object.entries(TARGET_DEFINITIONS)) {
    if (key === clean || def.aliases.includes(clean)) return key;
  }
  return "report";
}

/**
 * Normalizes and validates a complete ReportDomainConfig object against architectural constraints.
 * @param {object} input
 * @returns {object} Normalized canonical configuration
 */
export function normalizeDomainConfig(input = {}) {
  const target = normalizeTarget(input.target);
  const targetDef = TARGET_DEFINITIONS[target];

  let title = (input.title && typeof input.title === "string") ? input.title.trim() : targetDef.defaultHero;
  let operationalMode = input.operationalMode === "live" ? "live" : "static";

  // Constraint: Print mode is strictly static paper/PDF document
  if (target === "print") {
    operationalMode = "static";
  } else if (target === "dashboard" && operationalMode !== "live") {
    // Dashboards default to live mode unless explicitly forced
    if (input.operationalMode === undefined) {
      operationalMode = "live";
    }
  }

  // App Packaging: 'browser' | 'live-app' | 'offline-app' (or 'none')
  let appPackaging = "browser";
  const rawApp = input.appPackaging || input.app;
  if (rawApp === "live-app" || rawApp === "window" || rawApp === "pwa-live") {
    appPackaging = "live-app";
    // Live app requires live operational mode
    if (target !== "print") {
      operationalMode = "live";
    } else {
      appPackaging = "browser";
    }
  } else if (rawApp === "offline-app" || rawApp === "offline" || rawApp === "pwa-offline") {
    appPackaging = target === "print" ? "browser" : "offline-app";
  }

  // Print mode is strictly static paper document: eliminate app packaging
  if (target === "print") {
    appPackaging = "browser";
    operationalMode = "static";
  }

  // Theme validation: must be one of DaisyUI 32 themes, default 'light'
  let defaultStartupTheme = "light";
  if (input.defaultStartupTheme && DAISYUI_THEMES.includes(input.defaultStartupTheme.toLowerCase())) {
    defaultStartupTheme = input.defaultStartupTheme.toLowerCase();
  } else if (input.theme && DAISYUI_THEMES.includes(input.theme.toLowerCase())) {
    defaultStartupTheme = input.theme.toLowerCase();
  }

  // Custom Brand Color Hex
  let customBrandColorHex = null;
  const hex = input.customBrandColorHex || input.customColor;
  if (typeof hex === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex.trim())) {
    customBrandColorHex = hex.trim().toLowerCase();
  }

  // Features & Addons
  const rawFeatures = input.features || {};
  let addons = Array.isArray(rawFeatures.addons) ? rawFeatures.addons.map((a) => a.toLowerCase()) : [...targetDef.defaultAddons];
  addons = addons.filter((a) => Object.prototype.hasOwnProperty.call(ADDON_CATALOG, a));

  // Gated Live Features: AI Agent Bridge & Enterprise MCP Tools
  let hasAiAgentBridge = Boolean(rawFeatures.hasAiAgentBridge ?? input.hasAiAgentBridge ?? false);
  let hasEnterpriseMcpTools = Boolean(rawFeatures.hasEnterpriseMcpTools ?? input.hasEnterpriseMcpTools ?? false);

  if (operationalMode !== "live") {
    hasAiAgentBridge = false;
    hasEnterpriseMcpTools = false;
  }

  // Optional Reference Documents, Data-Sets & Images
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
    target,
    targetDef,
    operationalMode,
    appPackaging,
    defaultStartupTheme,
    customBrandColorHex,
    referenceFiles,
    features: {
      addons,
      hasAiAgentBridge,
      hasEnterpriseMcpTools
    }
  };
}

/**
 * Resolves the sibling skill that downstream agents should invoke.
 * @param {object} config
 * @returns {object} { skillName, skillTag, humanName, description }
 */
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

/**
 * Synthesizes CLI flags and command string for build-report.mjs & serve-report.mjs.
 * @param {object} config
 * @param {object} options
 * @returns {{ buildFlags: string[], buildCommand: string, serveCommand?: string }}
 */
export function generateCliCommand(config, options = {}) {
  const norm = normalizeDomainConfig(config);
  const contentFile = options.contentFile || "fragment.html";
  const outputFile = options.outputFile || (norm.target === "print" ? "print.html" : "report.html");

  const buildFlags = [];

  // Target mode flags
  if (norm.target === "print") {
    buildFlags.push("--mode print", "--print");
  } else if (norm.target === "dashboard") {
    buildFlags.push("--mode dashboard", "--dashboard");
  } else if (norm.target === "presentation") {
    buildFlags.push("--mode presentation", "--presentation");
  }

  // Live streaming flag
  if (norm.operationalMode === "live") {
    buildFlags.push("--live");
  }

  // App / PWA flags
  if (norm.appPackaging === "live-app") {
    buildFlags.push("--pwa", `--pwa-name "${norm.title}"`);
  } else if (norm.appPackaging === "offline-app") {
    buildFlags.push("--pwa", `--pwa-name "${norm.title}"`);
  }

  // Addons flags
  for (const addon of norm.features.addons) {
    const meta = ADDON_CATALOG[addon];
    if (meta && !buildFlags.includes(meta.flag)) {
      buildFlags.push(meta.flag);
    }
  }

  // Theme flags
  if (norm.defaultStartupTheme && norm.defaultStartupTheme !== "light") {
    buildFlags.push(`--theme ${norm.defaultStartupTheme}`);
  }
  if (norm.customBrandColorHex) {
    buildFlags.push(`--custom-theme "primary=${norm.customBrandColorHex}"`);
  }

  const buildCommand = `node skills/html-report/scripts/build-report.mjs \\
  --title "${norm.title}" \\
  --content ${contentFile} \\
  --output ${outputFile}${buildFlags.length > 0 ? " \\\n  " + buildFlags.join(" \\\n  ") : ""}`;

  let serveCommand = null;
  if (norm.operationalMode === "live") {
    const port = options.port || 3000;
    serveCommand = `node skills/html-report/scripts/serve-report.mjs ${outputFile} --port ${port}`;
  }

  return {
    buildFlags,
    buildCommand,
    serveCommand
  };
}

/**
 * Synthesizes a deterministic AI prompt tailored for autonomous coding agents.
 * @param {object} config
 * @returns {string} Prompt text
 */
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
    `Invoked via /html-create -> Routing to Specialized Facade: ${def.skillTag}`,
    "",
    "Deliverable Architecture:",
    `- Purpose & Format: ${def.humanName.toUpperCase()}`,
    `- Operational Mode: ${norm.operationalMode === "static" ? "STATIC_STANDALONE (Zero server required, single self-contained HTML file)" : "LIVE_CONNECTED (Server-backed SSE stream on localhost:3000)"}`,
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
