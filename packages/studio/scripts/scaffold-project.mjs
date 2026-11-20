#!/usr/bin/env node
/**
 * @file scaffold-project.mjs
 * Project Scaffolding Pipeline for html-report.
 * Orchestrates projects/<slug>/ creation via focused helpers in lib/scaffold/.
 *
 * Zero external npm dependencies.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReport, normalizeMode, CANONICAL_MODES } from "@html-report/core/build";
import { generatePwaAssets } from "@html-report/core/pwa";
import { WIDGET_PRESETS } from "./domain-model.mjs";
import { isDirectCliExecution } from "./preflight.mjs";
import { getAuthoringPlugin } from "./authoring-plugin.mjs";
import {
  slugifyProject,
  collectDiskWorkspaceRefs,
  resolveUniqueSlug,
  stageReferenceFiles,
  introspectDataFile,
  introspectReferenceDatasets
} from "./lib/scaffold/data-introspector.mjs";
import {
  generateStarterFragment,
  generateProjectAgentsMd,
  generateProjectPackageJson
} from "./lib/scaffold/widget-templates.mjs";

const __scaffoldDirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__scaffoldDirname, "../../..");

export {
  slugifyProject,
  resolveUniqueSlug,
  stageReferenceFiles,
  introspectDataFile,
  introspectReferenceDatasets,
  generateStarterFragment,
  generateProjectAgentsMd,
  generateProjectPackageJson
};

function hashStarterFragment(html = "") {
  return crypto.createHash("sha256").update(String(html), "utf-8").digest("hex");
}

export function scaffoldProject({
  project,
  topic = null,
  title = null,
  mode = "report",
  theme = "light",
  customTheme = null,
  favicon = "📊",
  addons = [],
  widgets = [],
  referenceFiles = [],
  servingMode = null,
  behavioralMode = null,
  goals = "",
  audience = "",
  ai = false,
  aiLocal = false,
  aiPort = 3031,
  aiModel = "Gemini 3.8 Flash (Low)",
  aiPersona = "analyst",
  aiPurpose = "",
  aiDock = true,
  pwa = false,
  content = null,
  force = false,
  updateExisting = false,
  regenerateFragment = false,
  avoidCollision = false,
  rootDir = null,
  workspaceRoot = rootDir || process.cwd()
} = {}) {
  const baseSlug = slugifyProject(project || topic || title);
  if (!baseSlug) {
    throw new Error("A valid --project <slug> is required (letters, numbers, hyphens).");
  }

  const slug = resolveUniqueSlug(baseSlug, workspaceRoot, {
    avoidCollision: Boolean(avoidCollision && !force && !updateExisting)
  });
  const resolvedMode = normalizeMode(mode) || "report";
  const resolvedTitle = (title || topic) && String(title || topic).trim()
    ? String(title || topic).trim()
    : slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const projectDir = path.resolve(workspaceRoot, "projects", slug);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, "refs"), { recursive: true });

  const stagedRefs = stageReferenceFiles(referenceFiles, projectDir, workspaceRoot, slug);
  if (updateExisting) {
    const existingDiskRefs = collectDiskWorkspaceRefs(projectDir, slug, stagedRefs);
    if (existingDiskRefs.length > 0) {
      stagedRefs.push(...existingDiskRefs);
    }
  }
  const datasets = introspectReferenceDatasets(stagedRefs);

  const normalizedWidgets = Array.isArray(widgets)
    ? [...new Set(widgets.map((w) => String(w || "").trim().toLowerCase()).filter((w) => Object.prototype.hasOwnProperty.call(WIDGET_PRESETS, w)))]
    : [];

  const resolvedAddons = [...new Set(Array.isArray(addons) ? addons.map((a) => String(a).trim().toLowerCase()).filter(Boolean) : [])];
  for (const wKey of normalizedWidgets) {
    for (const reqAddon of WIDGET_PRESETS[wKey].addons || []) {
      if (!resolvedAddons.includes(reqAddon)) resolvedAddons.push(reqAddon);
    }
  }
  if (datasets.length > 0) {
    if (!resolvedAddons.includes("gridjs")) resolvedAddons.push("gridjs");
    if (datasets[0].numericColumns.length > 0 && !resolvedAddons.includes("charts")) {
      resolvedAddons.push("charts");
    }
  }

  const fragmentRel = `projects/${slug}/fragment.html`;
  const entryRel = `projects/${slug}/index.html`;
  const fragmentPath = path.join(projectDir, "fragment.html");
  const entryPath = path.join(projectDir, "index.html");
  const manifestPath = path.join(projectDir, "report.manifest.json");
  const agentsPath = path.join(projectDir, "AGENTS.md");
  const packageJsonPath = path.join(projectDir, "package.json");

  let existingManifest = null;
  if (fs.existsSync(manifestPath)) {
    try {
      existingManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch (_) {
      existingManifest = null;
    }
  }

  let fragmentHtml;
  let starterFragmentHash = null;
  if (content) {
    fragmentHtml = content;
    fs.writeFileSync(fragmentPath, fragmentHtml, "utf-8");
  } else if (!fs.existsSync(fragmentPath) || force) {
    fragmentHtml = generateStarterFragment({
      title: resolvedTitle,
      mode: resolvedMode,
      slug,
      ai,
      widgets: normalizedWidgets,
      datasets,
      stagedRefs,
      goals,
      audience
    });
    starterFragmentHash = hashStarterFragment(fragmentHtml);
    fs.writeFileSync(fragmentPath, fragmentHtml, "utf-8");
  } else {
    const currentFrag = fs.readFileSync(fragmentPath, "utf-8");
    const isUntouchedStarter = Boolean(
      existingManifest &&
      existingManifest.starterFragmentHash &&
      hashStarterFragment(currentFrag) === existingManifest.starterFragmentHash
    );
    if (updateExisting && (regenerateFragment || isUntouchedStarter)) {
      fragmentHtml = generateStarterFragment({
        title: resolvedTitle,
        mode: resolvedMode,
        slug,
        ai,
        widgets: normalizedWidgets,
        datasets,
        stagedRefs,
        goals,
        audience
      });
      starterFragmentHash = hashStarterFragment(fragmentHtml);
      fs.writeFileSync(fragmentPath, fragmentHtml, "utf-8");
    } else {
      fragmentHtml = currentFrag;
      if (existingManifest && existingManifest.starterFragmentHash) {
        starterFragmentHash = existingManifest.starterFragmentHash;
      }
    }
  }

  const resolvedTheme = theme === "lemon" ? "lemonade" : theme;
  const built = buildReport({
    title: resolvedTitle,
    content: fragmentHtml,
    project: slug,
    contentPath: fragmentRel,
    mode: resolvedMode,
    theme: resolvedTheme,
    customTheme,
    favicon,
    addons: resolvedAddons,
    ai,
    aiLocal,
    aiPort,
    aiModel,
    aiPersona,
    aiPurpose,
    aiDock,
    editable: true,
    authoringPlugin: getAuthoringPlugin({ aiDock, aiPersona, aiPurpose }),
    pwa,
    source: entryRel,
    workspaceRoot
  });

  const enrichedManifest = {
    ...built.agentManifest,
    servingMode: servingMode || (resolvedMode === "dashboard" || resolvedMode === "live-report" ? "live" : "static"),
    behavioralMode: behavioralMode || (resolvedMode === "print" ? "passive" : "interactive"),
    ...(starterFragmentHash ? { starterFragmentHash } : {}),
    ...(normalizedWidgets.length > 0 ? { presetWidgets: normalizedWidgets } : {}),
    ...(stagedRefs.length > 0 ? {
      referenceFiles: stagedRefs.map(({ diskPath, ...rest }) => rest)
    } : {}),
    ...(customTheme ? { customTheme } : {}),
    ...(audience ? { audience } : {}),
    ...(goals ? { goals } : {})
  };

  fs.writeFileSync(entryPath, built.html, "utf-8");
  fs.writeFileSync(manifestPath, JSON.stringify(enrichedManifest, null, 2) + "\n", "utf-8");
  fs.writeFileSync(agentsPath, generateProjectAgentsMd(enrichedManifest), "utf-8");
  fs.writeFileSync(packageJsonPath, generateProjectPackageJson(enrichedManifest), "utf-8");

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

  const resolvedWorkspace = path.resolve(workspaceRoot);
  if (
    !rootDir &&
    !resolvedWorkspace.startsWith(os.tmpdir()) &&
    resolvedWorkspace !== REPO_ROOT &&
    fs.existsSync(path.resolve(__scaffoldDirname, "../assets/create.html"))
  ) {
    const repoProjectDir = path.join(REPO_ROOT, "projects", slug);
    try {
      fs.mkdirSync(repoProjectDir, { recursive: true });
      fs.cpSync(projectDir, repoProjectDir, { recursive: true, force: true });
    } catch (_) {}
  }

  const warnings = stagedRefs
    .filter((r) => !r.stagedPath && r.warning)
    .map((r) => r.warning);

  return {
    slug,
    projectDir,
    fragmentPath,
    outputPath: entryPath,
    mode: resolvedMode,
    theme: resolvedTheme,
    addons: resolvedAddons,
    widgets: normalizedWidgets,
    packageJsonPath,
    agentsMdPath: agentsPath,
    ...(warnings.length > 0 ? { warnings } : {}),
    stagedRefs: stagedRefs.map(({ diskPath, ...rest }) => rest),
    datasets: datasets.map(({ rows, ...summary }) => ({
      ...summary,
      rowCount: summary.rowCount ?? rows.length,
      sampleRowCount: rows.length
    })),
    files: {
      fragment: fragmentPath,
      entry: entryPath,
      manifest: manifestPath,
      agents: agentsPath,
      packageJson: packageJsonPath
    },
    manifest: enrichedManifest
  };
}

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    project: null,
    title: null,
    mode: "report",
    theme: "light",
    customTheme: null,
    favicon: "📊",
    addons: [],
    widgets: [],
    referenceFiles: [],
    ai: false,
    aiLocal: false,
    aiPort: 3031,
    aiModel: "Gemini 3.8 Flash (Low)",
    aiPersona: "analyst",
    aiPurpose: "",
    aiDock: true,
    pwa: false,
    content: null,
    rootDir: null,
    force: false,
    unique: false,
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
    else if ((arg === "--custom-theme" || arg === "-ct") && args[i + 1]) opts.customTheme = args[++i];
    else if (arg === "--favicon" && args[i + 1]) opts.favicon = args[++i];
    else if (arg === "--addons" && args[i + 1]) {
      opts.addons.push(...args[++i].split(",").map((s) => s.trim()).filter(Boolean));
    }
    else if (arg === "--widgets" && args[i + 1]) {
      opts.widgets.push(...args[++i].split(",").map((s) => s.trim()).filter(Boolean));
    }
    else if (arg === "--ref" && args[i + 1]) {
      opts.referenceFiles.push(args[++i]);
    }
    else if ((arg === "--root-dir" || arg === "--workspace") && args[i + 1]) {
      opts.rootDir = args[++i];
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
    else if (arg === "--ai-local") {
      opts.aiLocal = true;
      opts.ai = true;
    }
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
    else if (arg === "--unique") opts.unique = true;
    else if (arg === "--json") opts.json = true;
    else if (!arg.startsWith("-") && !opts.project) opts.project = arg;
  }
  return opts;
}

const isDirectCli = isDirectCliExecution(process.argv[1], import.meta.url);

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
      --custom-theme <v> Custom OKLCH theme preset or JSON spec
      --favicon <emoji>  Emoji favicon for the HTML shell (default: 📊)
      --addons <list>    Comma-separated addons (charts,mermaid,gridjs,...)
      --widgets <list>   Comma-separated presets (${Object.keys(WIDGET_PRESETS).join(",")})
      --ref <path>       Reference file inside workspaceRoot to stage into refs/ (repeatable)
      --ai, --bridge     Pre-bake Two-Way AI Agent Bridge controls (--ai)
      --ai-local         Enable zero-API-key local context bridge mode (--ai-local)
      --ai-port <port>   Turnkey AI bridge server port (default: 3031)
      --ai-model <name>  Turnkey AI default model (default: "Gemini 3.8 Flash (Low)")
      --ai-persona <id>  Turnkey AI default persona (default: analyst)
      --pwa              Include PWA manifest, service worker, and icon
  -c, --content <file>   Seed fragment.html from an existing HTML file
  -f, --force            Overwrite existing fragment.html
      --unique           Auto-increment slug (-2, -3) if project folder already exists
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
    customTheme: opts.customTheme,
    favicon: opts.favicon,
    addons: [...new Set(opts.addons)],
    widgets: [...new Set(opts.widgets)],
    referenceFiles: opts.referenceFiles,
    ai: opts.ai,
    aiLocal: opts.aiLocal,
    aiPort: opts.aiPort,
    aiModel: opts.aiModel,
    aiPersona: opts.aiPersona,
    aiPurpose: opts.aiPurpose,
    aiDock: opts.aiDock,
    pwa: opts.pwa,
    content: seededContent,
    rootDir: opts.rootDir,
    force: opts.force,
    avoidCollision: opts.unique
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
    if (Array.isArray(result.warnings) && result.warnings.length > 0) {
      for (const w of result.warnings) console.warn(`  Warning:   ${w}`);
    }
  }
}
