#!/usr/bin/env node
/**
 * @file scaffold-project.mjs
 * Project Scaffolding Pipeline for html-report.
 * Creates the basis for a new project under projects/<slug>/ and streamlines
 * assembly and future rebuilds:
 *   - projects/<slug>/fragment.html        (Semantic <main id="report-main"> source)
 *   - projects/<slug>/index.html           (Compiled Deliverable with deterministic agent hooks)
 *   - projects/<slug>/report.manifest.json (Machine-readable project & pipeline manifest)
 *   - projects/<slug>/AGENTS.md            (Agent-facing working guide & rebuild commands)
 *
 * Zero external npm dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildReport, normalizeMode, CANONICAL_MODES } from "./build-report.mjs";
import { generatePwaAssets } from "./pwa-builder.mjs";

export function slugifyProject(raw = "") {
  return String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function generateStarterFragment({ title = "New Project Report", mode = "report", slug = "new-project", ai = false } = {}) {
  const safeTitle = String(title).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const isDashboard = mode === "dashboard" || mode === "live-report";
  const isPresentation = mode === "presentation";

  if (isPresentation) {
    return `<main id="report-main" class="container mx-auto px-4 py-8 space-y-8">
  <section id="slide-overview" class="card bg-base-100 border border-base-300 shadow-sm p-8">
    <h1 class="text-3xl font-extrabold tracking-tight">${safeTitle}</h1>
    <p class="text-base-content/70 mt-2">Scaffolded project <code>${slug}</code> in <strong>${mode}</strong> mode.</p>
  </section>

  <section id="slide-metrics" class="card bg-base-100 border border-base-300 shadow-sm p-8">
    <h2 class="text-2xl font-bold mb-4">Key Highlights</h2>
    <div class="stats stats-vertical lg:stats-horizontal shadow w-full border border-base-200">
      <div class="stat">
        <div class="stat-title">Primary Metric</div>
        <div class="stat-value text-primary">100%</div>
        <div class="stat-desc">Ready for domain data</div>
      </div>
      <div class="stat">
        <div class="stat-title">Pipeline Status</div>
        <div class="stat-value text-secondary">Scaffolded</div>
        <div class="stat-desc">Edit fragment.html to update</div>
      </div>
    </div>
  </section>
</main>
`;
  }

  return `<main id="report-main" class="container mx-auto px-4 sm:px-6 py-8 space-y-8">
  <!-- Hero Header -->
  <section id="overview" class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-base-300 pb-4">
      <div>
        <div class="badge badge-primary badge-outline badge-sm font-mono mb-2">${mode}</div>
        <h1 class="text-3xl font-extrabold tracking-tight">${safeTitle}</h1>
        <p class="text-sm text-base-content/70 mt-1">Project scaffold: <code>projects/${slug}/</code>${ai ? " · Two-Way Agent Bridge enabled" : ""}</p>
      </div>
    </div>

    <div class="stats stats-vertical lg:stats-horizontal shadow-sm w-full border border-base-300 bg-base-100">
      <div class="stat">
        <div class="stat-title">Primary KPI</div>
        <div class="stat-value text-primary">--</div>
        <div class="stat-desc">Replace with domain metric</div>
      </div>
      <div class="stat">
        <div class="stat-title">Secondary KPI</div>
        <div class="stat-value text-secondary">--</div>
        <div class="stat-desc">Replace with domain metric</div>
      </div>
      <div class="stat">
        <div class="stat-title">Status</div>
        <div class="stat-value text-accent">${isDashboard ? "Live" : "Ready"}</div>
        <div class="stat-desc">Deterministic scaffold</div>
      </div>
    </div>
  </section>

  <!-- Primary Analysis Section -->
  <section id="analysis" class="card bg-base-100 border border-base-300 shadow-sm">
    <div class="card-body">
      <h2 class="card-title text-xl font-bold">Core Analysis</h2>
      <p class="text-sm text-base-content/70">Populate this section in <code>projects/${slug}/fragment.html</code> with domain charts, Mermaid diagrams, or data tables.</p>
    </div>
  </section>
</main>
`;
}

export function generateProjectAgentsMd(manifest) {
  const aiPurposeLine = manifest.aiBridge && manifest.aiConfig?.purpose
    ? `\n- **AI Board Support Purpose**: ${manifest.aiConfig.purpose}`
    : "";
  const aiConfigLines = manifest.aiBridge && manifest.aiConfig
    ? `\n- **Turnkey AI Bridge Port**: \`${manifest.aiConfig.port}\`\n- **Turnkey AI Default Model**: \`${manifest.aiConfig.model}\`\n- **Turnkey AI Default Persona**: \`${manifest.aiConfig.persona}\`${aiPurposeLine}`
    : "";
  return `# Project Agent Guide: ${manifest.title}

- **Project Slug**: \`${manifest.project}\`
- **Archetype / Mode**: \`${manifest.mode}\`
- **Theme**: \`${manifest.theme}\`
- **Two-Way Agent Bridge**: \`${manifest.aiBridge ? "enabled (--ai)" : "disabled"}\`${aiConfigLines}

## Source of Truth & Pipeline

1. **Edit the Semantic Fragment**: [fragment.html](./fragment.html) (\`<main id="report-main">\`). Do **not** hand-edit \`index.html\` directly.
2. **Rebuild the Deliverable**:
   \`\`\`bash
   ${manifest.pipeline.rebuildCommand}
   \`\`\`
3. **Live Preview & Two-Way Bridge**:
   \`\`\`bash
   ${manifest.pipeline.serveCommand}
   \`\`\`
4. **Machine-Readable Manifest**: See [report.manifest.json](./report.manifest.json) (and the embedded \`#agent-manifest\` JSON in \`index.html\`) for deterministic section and widget selectors.

For full authoring conventions, see [agent-authoring-guide.md](../../skills/html-report/references/agent-authoring-guide.md).
`;
}

export function scaffoldProject({
  project,
  title = null,
  mode = "report",
  theme = "light",
  addons = [],
  ai = false,
  aiPort = 3000,
  aiModel = "Gemini 3.8 Flash (Low)",
  aiPersona = "analyst",
  aiPurpose = "",
  aiDock = true,
  pwa = false,
  content = null,
  force = false,
  workspaceRoot = process.cwd()
} = {}) {
  const slug = slugifyProject(project);
  if (!slug) {
    throw new Error("A valid --project <slug> is required (letters, numbers, hyphens).");
  }

  const resolvedMode = normalizeMode(mode) || "report";
  const resolvedTitle = title && String(title).trim()
    ? String(title).trim()
    : slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const projectDir = path.resolve(workspaceRoot, "projects", slug);
  fs.mkdirSync(projectDir, { recursive: true });

  const fragmentRel = `projects/${slug}/fragment.html`;
  const entryRel = `projects/${slug}/index.html`;
  const fragmentPath = path.join(projectDir, "fragment.html");
  const entryPath = path.join(projectDir, "index.html");
  const manifestPath = path.join(projectDir, "report.manifest.json");
  const agentsPath = path.join(projectDir, "AGENTS.md");

  let fragmentHtml;
  if (content) {
    fragmentHtml = content;
    fs.writeFileSync(fragmentPath, fragmentHtml, "utf-8");
  } else if (!fs.existsSync(fragmentPath) || force) {
    fragmentHtml = generateStarterFragment({ title: resolvedTitle, mode: resolvedMode, slug, ai });
    fs.writeFileSync(fragmentPath, fragmentHtml, "utf-8");
  } else {
    fragmentHtml = fs.readFileSync(fragmentPath, "utf-8");
  }

  const built = buildReport({
    title: resolvedTitle,
    content: fragmentHtml,
    project: slug,
    contentPath: fragmentRel,
    mode: resolvedMode,
    theme,
    addons,
    ai,
    aiPort,
    aiModel,
    aiPersona,
    aiPurpose,
    aiDock,
    pwa,
    source: entryRel
  });

  fs.writeFileSync(entryPath, built.html, "utf-8");
  fs.writeFileSync(manifestPath, JSON.stringify(built.agentManifest, null, 2) + "\n", "utf-8");
  fs.writeFileSync(agentsPath, generateProjectAgentsMd(built.agentManifest), "utf-8");

  if (built.isPwa && built.pwaConfig) {
    generatePwaAssets({
      outputDir: projectDir,
      reportFileName: "index.html",
      title: built.pwaConfig.title,
      shortName: built.pwaConfig.shortName,
      themeColor: built.pwaConfig.themeColor,
      backgroundColor: built.pwaConfig.backgroundColor,
      emoji: built.pwaConfig.emoji,
      writeFiles: true
    });
  }

  return {
    slug,
    projectDir,
    files: {
      fragment: fragmentPath,
      entry: entryPath,
      manifest: manifestPath,
      agents: agentsPath
    },
    manifest: built.agentManifest
  };
}

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    project: null,
    title: null,
    mode: "report",
    theme: "light",
    addons: [],
    ai: false,
    aiPort: 3000,
    aiModel: "Gemini 3.8 Flash (Low)",
    aiPersona: "analyst",
    aiPurpose: "",
    aiDock: true,
    pwa: false,
    content: null,
    force: false,
    json: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") opts.help = true;
    else if ((arg === "--project" || arg === "-p") && args[i + 1]) opts.project = args[++i];
    else if ((arg === "--title" || arg === "-t") && args[i + 1]) opts.title = args[++i];
    else if ((arg === "--mode" || arg === "-m") && args[i + 1]) opts.mode = args[++i];
    else if (arg === "--theme" && args[i + 1]) opts.theme = args[++i];
    else if (arg === "--addons" && args[i + 1]) {
      opts.addons.push(...args[++i].split(",").map((s) => s.trim()).filter(Boolean));
    }
    else if (arg === "--charts") opts.addons.push("charts");
    else if (arg === "--mermaid") opts.addons.push("mermaid");
    else if (arg === "--gridjs") opts.addons.push("gridjs");
    else if (arg === "--katex" || arg === "--math") opts.addons.push("katex");
    else if (arg === "--leaflet") opts.addons.push("leaflet");
    else if (arg === "--hljs" || arg === "--highlight") opts.addons.push("hljs");
    else if (arg === "--dayjs" || arg === "--day") opts.addons.push("dayjs");
    else if (arg === "--showdown") opts.addons.push("showdown");
    else if (arg === "--quill" || arg === "--editor") opts.addons.push("quill");
    else if (arg === "--fullcalendar") opts.addons.push("fullcalendar");
    else if (arg === "--ai" || arg === "--bridge") opts.ai = true;
    else if (arg === "--ai-port" && args[i + 1]) {
      const parsedPort = Number(args[++i]);
      if (Number.isFinite(parsedPort) && parsedPort > 0) opts.aiPort = parsedPort;
      opts.ai = true;
    }
    else if (arg === "--ai-model" && args[i + 1]) {
      opts.aiModel = args[++i];
      opts.ai = true;
    }
    else if (arg === "--ai-persona" && args[i + 1]) {
      opts.aiPersona = args[++i];
      opts.ai = true;
    } else if (arg === "--ai-purpose" && args[i + 1]) {
      opts.aiPurpose = args[++i];
      opts.ai = true;
    } else if (arg === "--ai-dock") {
      opts.aiDock = true;
      opts.ai = true;
    } else if (arg === "--no-ai-dock") {
      opts.aiDock = false;
      opts.ai = true;
    }
    else if (arg === "--pwa") opts.pwa = true;
    else if ((arg === "--content" || arg === "-c") && args[i + 1]) opts.content = args[++i];
    else if (arg === "--force" || arg === "-f") opts.force = true;
    else if (arg === "--json") opts.json = true;
    else if (!arg.startsWith("-") && !opts.project) opts.project = arg;
  }
  return opts;
}

const isDirectCli = process.argv[1] && (
  process.argv[1].endsWith("scaffold-project.mjs") ||
  import.meta.url === pathToFileURL(process.argv[1]).href
);

if (isDirectCli) {
  const opts = parseCliArgs(process.argv);
  if (opts.help || !opts.project) {
    console.log(`
html-report Project Scaffolding CLI (scaffold-project.mjs)

Usage:
  node skills/html-report/scripts/scaffold-project.mjs --project <slug> [options]

Options:
  -p, --project <slug>   Project directory slug under projects/<slug>/ (required)
  -t, --title <string>   Report / deliverable title
  -m, --mode <name>      Archetype mode: ${CANONICAL_MODES.join(", ")} (default: report)
      --theme <name>     DaisyUI theme (default: light)
      --addons <list>    Comma-separated addons (charts,mermaid,gridjs,...)
      --ai, --bridge     Pre-bake Two-Way AI Agent Bridge controls (--ai)
      --ai-port <port>   Turnkey AI bridge server port (default: 3000)
      --ai-model <name>  Turnkey AI default model (default: "Gemini 3.8 Flash (Low)")
      --ai-persona <id>  Turnkey AI default persona (default: analyst)
      --pwa              Include PWA manifest, service worker, and icon
  -c, --content <file>   Seed fragment.html from an existing HTML file
  -f, --force            Overwrite existing fragment.html
      --json             Output machine-readable JSON summary
  -h, --help             Show this help
`);
    process.exit(opts.help ? 0 : 1);
  }

  let seededContent = null;
  if (opts.content) {
    const resolvedContent = path.resolve(process.cwd(), opts.content);
    if (!fs.existsSync(resolvedContent)) {
      console.error(`Error: Content file not found: ${resolvedContent}`);
      process.exit(1);
    }
    seededContent = fs.readFileSync(resolvedContent, "utf-8");
  }

  const result = scaffoldProject({
    project: opts.project,
    title: opts.title,
    mode: opts.mode,
    theme: opts.theme,
    addons: [...new Set(opts.addons)],
    ai: opts.ai,
    aiPort: opts.aiPort,
    aiModel: opts.aiModel,
    aiPersona: opts.aiPersona,
    aiPurpose: opts.aiPurpose,
    aiDock: opts.aiDock,
    pwa: opts.pwa,
    content: seededContent,
    force: opts.force
  });

  if (opts.json) {
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  } else {
    console.log(`[html-report] Scaffolded project "projects/${result.slug}/":`);
    console.log(`  Fragment:  ${result.files.fragment}`);
    console.log(`  Entry:     ${result.files.entry}`);
    console.log(`  Manifest:  ${result.files.manifest}`);
    console.log(`  Agents:    ${result.files.agents}`);
    console.log(`  Rebuild:   ${result.manifest.pipeline.rebuildCommand}`);
  }
}
