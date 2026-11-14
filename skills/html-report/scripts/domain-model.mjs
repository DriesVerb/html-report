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

  // Offline Packaging Modifier (--pwa): 'browser' | 'live-app' | 'offline-app'
  // Wraps any Interactive Delivery Archetype (report, dashboard, presentation) without replacing it.
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

  // Optional explicit project folder slug (independent of AI display title)
  const rawSlug = typeof input.projectSlug === "string"
    ? input.projectSlug
    : (typeof input.slug === "string" ? input.slug : "");
  const projectSlug = rawSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || null;

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

  // Canonical Starter Widget Presets
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

  const targetFlag = options.outputFile ? `--output ${outputFile}` : `--project ${projectSlug}`;
  const buildCommand = `node skills/html-report/scripts/build-report.mjs \\
  --title "${norm.title}" \\
  --content ${contentFile} \\
  ${targetFlag}${buildFlags.length > 0 ? " \\\n  " + buildFlags.join(" \\\n  ") : ""}`;

  let serveCommand = null;
  if (norm.operationalMode === "live") {
    const port = options.port || 3031;
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

/**
 * The 7 formal Core Subsystems / Bounded Contexts of the html-report platform.
 */
export const BOUNDED_CONTEXTS = {
  assembly: {
    key: "assembly",
    name: "1. Assembly: The Fusion Engine",
    description: "Everything we need to put the pieces together fast and reliably (Semantic Fragment + Template Shell + Assets).",
    primaryArtifacts: ["template-shell.html", "harness.mjs"]
  },
  pipeline: {
    key: "pipeline",
    name: "2. Pipeline: The State Machine Orchestrator",
    description: "The state machine around assembly ensuring speed and correctness (FSM, pre-flight normalizer, addon detection).",
    primaryArtifacts: ["build-report.mjs", "harness.mjs", "serve-report.mjs"]
  },
  deliveryArchetypes: {
    key: "deliveryArchetypes",
    name: "3. Delivery Archetypes: Goal-Driven Destinations",
    description: "The results our skills work toward, knowing what they need to become with mapped journeys and custom support.",
    primaryArtifacts: ["skills/html-report", "skills/html-dashboard", "skills/html-presentation", "skills/html-print", "skills/html-pwa"]
  },
  createMode: {
    key: "createMode",
    name: "4. Create Mode: Guided Intent Resolution",
    description: "Guiding users in Studio or CLI to their desires via the quickest combination of assembly, pipeline, and archetype.",
    primaryArtifacts: ["create.html", "html-grill.mjs", "open-create.sh"]
  },
  editMode: {
    key: "editMode",
    name: "5. Edit Mode: In-Flight Draft Adjustments",
    description: "Where users and agents make adjustments to a product that is not yet published (selection canvas, task queue, agent bridge).",
    primaryArtifacts: ["report-runtime.js", "agent-bridge.js"]
  },
  publishedDocument: {
    key: "publishedDocument",
    name: "6. Published Document: Final End-Product",
    description: "The finished document seen by the user that no longer needs edit-mode, pruning authoring chrome cleanly.",
    primaryArtifacts: ["build-report.mjs (--published)", "template-shell.html"]
  },
  openSpecJourney: {
    key: "openSpecJourney",
    name: "7. OpenSpec Journey: Living Dev Loop",
    description: "The 5-phase lifecycle connecting brainstorming, planning, implementation, verification, and live mirroring on :3031.",
    primaryArtifacts: ["GEMINI.md", "AGENTS.md", "openspec/changes/*/index.html", "implementation-progress.html"]
  },

  // Aliases for compatibility
  coreAssembly: {
    key: "coreAssembly",
    name: "1. Assembly: The Fusion Engine",
    description: "Everything we need to put the pieces together fast and reliably.",
    primaryArtifacts: ["template-shell.html", "harness.mjs"]
  },
  themeAdaptation: {
    key: "themeAdaptation",
    name: "Theme Adaptation & OKLCH Engine",
    description: "Perceptually uniform color math, 32 DaisyUI themes (defaulting to light).",
    primaryArtifacts: ["theme-compiler.mjs"]
  },
  agentBridge: {
    key: "agentBridge",
    name: "Two-Way AI Agent Bridge & Telemetry",
    description: "Bidirectional hypermedia bridge and SSE streams.",
    primaryArtifacts: ["agent-bridge.js"]
  },
  inBrowserAuthoring: {
    key: "inBrowserAuthoring",
    name: "In-Browser Authoring & Co-Design",
    description: "Collapsible edit dock (#edit-dock) and canvas inspector.",
    primaryArtifacts: ["report-runtime.js"]
  },
  studioDiscovery: {
    key: "studioDiscovery",
    name: "Studio & Discovery Hub",
    description: "Creation studio wizard and workspace scanner.",
    primaryArtifacts: ["create.html"]
  }
};

/**
 * Canonical Ubiquitous Glossary mapping approved terms against deprecated synonyms.
 */
export const UBIQUITOUS_GLOSSARY = [
  {
    canonical: "Assembly",
    deprecated: ["raw stitching", "file concat", "glue step"],
    boundedContext: "assembly",
    rule: "The fast, reliable engine that joins the Semantic Fragment, Template Shell, and assets into an assembled document."
  },
  {
    canonical: "Pipeline",
    deprecated: ["build runner", "compiler script", "bundler loop"],
    boundedContext: "pipeline",
    rule: "The state machine orchestrating pre-flight checks, addon detection, caching, and post-processing around assembly."
  },
  {
    canonical: "Delivery Archetypes",
    deprecated: ["report kinds", "template modes", "output flavors"],
    boundedContext: "deliveryArchetypes",
    rule: "Goal-driven destinations (@html-report, @html-dashboard, etc.) that know what they need to become."
  },
  {
    canonical: "Create Mode",
    deprecated: ["wizard form", "setup screen", "init step"],
    boundedContext: "createMode",
    rule: "Guided Studio/CLI intent resolution finding the quickest combination of assembly, pipeline, and archetype."
  },
  {
    canonical: "Edit Mode",
    deprecated: ["admin bar", "inspector tool", "bottom toolbar"],
    boundedContext: "editMode",
    rule: "In-flight product workspace (#edit-dock) for making adjustments to an unpublished document."
  },
  {
    canonical: "Published Document",
    deprecated: ["clean HTML", "production build", "stripped export"],
    boundedContext: "publishedDocument",
    rule: "The finalized end-product that no longer needs edit-mode, with authoring chrome cleanly pruned."
  },
  {
    canonical: "Output Deliverable",
    deprecated: ["compiled HTML", "artifact file", "final page"],
    boundedContext: "assembly",
    rule: "The resulting standalone, single-file HTML5 document generated by the deterministic build harness."
  },
  {
    canonical: "OpenSpec Journey",
    deprecated: ["dev process", "git branch flow", "sprint tracker"],
    boundedContext: "openSpecJourney",
    rule: "The 5-stage evolution cycle (Brainstorming to Archived) mirrored live on localhost:3031."
  },
  {
    canonical: "Semantic Fragment",
    deprecated: ["snippet", "HTML body", "partial", "template content"],
    boundedContext: "assembly",
    rule: "Pure <main id=\"report-main\"> HTML content emitted by LLMs without doctype or shell boilerplate."
  },
  {
    canonical: "Template Shell",
    deprecated: ["layout", "wrapper", "scaffold", "base HTML"],
    boundedContext: "assembly",
    rule: "The pre-bundled DaisyUI 4/Tailwind/Alpine container document (template-shell.html)."
  },
  {
    canonical: "Two-Way Agent Bridge",
    deprecated: ["co-pilot socket", "agent webhook", "chat connector"],
    boundedContext: "editMode",
    rule: "Runtime bidirectional channel (window.HTMLReportAgent) connecting browser UI to active agent CLI session."
  },
  {
    canonical: "Target Element",
    deprecated: ["picked card", "clicked node", "DOM hook"],
    boundedContext: "editMode",
    rule: "DOM node selected via canvas click, receiving an immutable slug via getOrAssignId()."
  },
  {
    canonical: "Artifact Quad",
    deprecated: ["planning docs", "spec files", "markdown set"],
    boundedContext: "openSpecJourney",
    rule: "The 4 mandatory planning documents: proposal.md, design.md, tasks.md, specs/."
  }
];

/**
 * Feature Beneficiary taxonomy.
 */
export const FEATURE_BENEFICIARIES = {
  user: {
    key: "user",
    name: "User-Facing (Human-Centric)",
    description: "Visual Studio GUI (create.html), theme pickers, Quill rich editor, responsive layouts, printable PDFs, aesthetic UX."
  },
  agent: {
    key: "agent",
    name: "Agent-Facing (Agent-Centric)",
    description: "Headless CLI commands, token-saving semantic fragments, mechanical auto-repairs, JSON schemas, Turnkey reconnect prompts."
  },
  hybrid: {
    key: "hybrid",
    name: "Hybrid (Human + Agent Loop)",
    description: "Two-Way Agent Bridge, Edit Mode Dock (human targets element, agent receives synthesized prompt)."
  }
};

/**
 * Two Orthogonal Runtime Axes: Serving Mode vs. Behavioral Mode.
 */
export const SERVING_MODES = {
  staticFile: {
    key: "staticFile",
    name: "Static File (Zero Backend)",
    description: "file:///, static CDN, or GitHub Pages. Zero dedicated server required. Client-side fetch to external CORS APIs supported."
  },
  serverConnected: {
    key: "serverConnected",
    name: "Server-Connected (Live Backend)",
    description: "Backed by serve-report.mjs on localhost:3031. Real-time Datastar SSE hypermedia morphs, file-watch hot-reload, agent bridge."
  }
};

export const BEHAVIORAL_MODES = {
  passive: {
    key: "passive",
    name: "Passive / Printable Document",
    description: "Fixed structure for reading, paper export, and @page A4/Letter PDF rendering."
  },
  interactive: {
    key: "interactive",
    name: "Interactive / Reactive Application",
    description: "Dynamic user or data interaction: client-side Alpine filters, Chart.js animations, public API fetches, or live SSE streams."
  }
};

/**
 * 5-Step Feature Alignment Rubric checks.
 */
export const FEATURE_ALIGNMENT_RUBRIC = [
  { step: 1, name: "Context Attribution", description: "Declares User-Facing, Agent-Facing, or Hybrid, and attributes to a primary subsystem." },
  { step: 2, name: "Ubiquitous Vocabulary", description: "Uses canonical domain terms and avoids deprecated synonyms." },
  { step: 3, name: "Archetype Impact", description: "Specifies target Delivery Archetype and Serving/Behavioral mode." },
  { step: 4, name: "Bridge & Authoring Invariants", description: "Defines agent bridge, edit mode, and published mode expectations." },
  { step: 5, name: "Journey & Live Mirror", description: "Links the 4-file Artifact Quad and updates localhost:3031." }
];

/**
 * Evaluates a proposed feature against the Ubiquitous Language and 5-Step Alignment Rubric.
 * @param {object} proposal
 * @returns {{ aligned: boolean, score: number, checks: object[], violations: string[] }}
 */
export function evaluateFeatureAlignment(proposal = {}) {
  const violations = [];
  const checks = [];

  // Check 1: Beneficiary & Context Attribution
  const hasValidContext = Boolean(
    proposal.boundedContext &&
    (BOUNDED_CONTEXTS[proposal.boundedContext] || Object.values(BOUNDED_CONTEXTS).some(bc => bc.name === proposal.boundedContext || bc.key === proposal.boundedContext))
  );
  if (!hasValidContext) {
    violations.push("Feature proposal must declare a valid primary Bounded Context / Core Subsystem.");
  }
  checks.push({ step: 1, name: "Context Attribution", passed: hasValidContext });

  // Check 2: Ubiquitous Vocabulary (Scan for deprecated synonyms)
  const fullText = `${proposal.title || ""} ${proposal.description || ""} ${proposal.content || ""}`.toLowerCase();
  const foundDeprecated = [];
  for (const entry of UBIQUITOUS_GLOSSARY) {
    for (const syn of entry.deprecated) {
      if (fullText.includes(syn.toLowerCase())) {
        foundDeprecated.push(`"${syn}" (use "${entry.canonical}" instead)`);
      }
    }
  }
  const vocabularyPassed = foundDeprecated.length === 0;
  if (!vocabularyPassed) {
    violations.push(`Proposal contains deprecated domain synonyms: ${foundDeprecated.join(", ")}`);
  }
  checks.push({ step: 2, name: "Ubiquitous Vocabulary", passed: vocabularyPassed, details: foundDeprecated });

  // Check 3: Archetype Impact
  const archetypes = proposal.archetypes || proposal.deliveryArchetypes || [];
  const hasArchetypes = Array.isArray(archetypes) && archetypes.length > 0;
  checks.push({ step: 3, name: "Archetype Impact", passed: hasArchetypes });
  if (!hasArchetypes) {
    violations.push("Proposal must declare at least one target Delivery Archetype (e.g. @html-report, @html-dashboard).");
  }

  // Check 4: Bridge & Authoring Invariants
  const hasBridgeSpec = proposal.agentBridgeImpact !== undefined || proposal.hasAuthoringImpact !== undefined || proposal.invariants !== undefined;
  checks.push({ step: 4, name: "Bridge & Authoring Invariants", passed: hasBridgeSpec });
  if (!hasBridgeSpec) {
    violations.push("Proposal must specify invariants regarding Agent Bridge or Authoring/Published mode.");
  }

  // Check 5: Journey & Live Mirror
  const hasArtifacts = Boolean(proposal.artifacts || proposal.artifactQuad || proposal.changeDir);
  checks.push({ step: 5, name: "Journey & Live Mirror", passed: hasArtifacts });
  if (!hasArtifacts) {
    violations.push("Proposal must reference OpenSpec Artifact Quad and live mirror on localhost:3031.");
  }

  const passedCount = checks.filter(c => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);

  return {
    aligned: violations.length === 0,
    score,
    checks,
    violations
  };
}

/**
 * Synthesizes a standardized OpenSpec feature proposal prompt enforcing the Ubiquitous Language.
 * @param {object} input
 * @returns {string} Formatted markdown prompt
 */
export function generateFeatureAlignmentPrompt(input = {}) {
  const title = input.title || "Proposed Feature";
  const bcKey = input.boundedContext || "assembly";
  const bc = BOUNDED_CONTEXTS[bcKey] || { name: bcKey };
  const beneficiaryKey = input.beneficiary || "user";
  const beneficiary = FEATURE_BENEFICIARIES[beneficiaryKey] || { name: beneficiaryKey };
  const servingMode = input.servingMode || "staticFile";
  const behavioralMode = input.behavioralMode || "interactive";
  const archetypes = input.archetypes && input.archetypes.length > 0 ? input.archetypes.join(", ") : "@html-report";
  const invariants = input.invariants || "Standard invariants applied.";

  return [
    `### OpenSpec Feature Proposal: ${title}`,
    "",
    "**Target Beneficiary:**",
    beneficiary.name,
    "",
    "**Primary Core Subsystem:**",
    bc.name,
    "",
    "**Runtime Classification (Two-Axis):**",
    `- Serving Mode: ${SERVING_MODES[servingMode]?.name || servingMode}`,
    `- Behavioral Mode: ${BEHAVIORAL_MODES[behavioralMode]?.name || behavioralMode}`,
    "",
    "**Applicable Delivery Archetypes:**",
    archetypes,
    "",
    "**Invariants & Domain Boundaries:**",
    invariants,
    "",
    "**Verification & Quality Gate:**",
    "- [ ] Conforms to the 5-Step Feature Alignment Rubric",
    "- [ ] Maintains zero token waste using Semantic Fragments (<main id=\"report-main\">)",
    "- [ ] Compiles via Deterministic Assembly (<100ms)",
    "- [ ] Distinguishes between In-Flight Draft (Edit Mode) vs Finalized Export (Published Document)",
    "- [ ] Mirrors live journey state to http://localhost:3031 via implementation-progress.html"
  ].join("\n");
}

