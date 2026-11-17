/**
 * CLI argument parser, help printer, and runner for build-report.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import child_process from "node:child_process";
import { fileURLToPath } from "node:url";
import { generatePwaAssets } from "../../pwa-builder.mjs";
import { formatVersionString, checkDeprecatedCliArgs } from "../../compatibility.mjs";
import {
  ADDON_REGISTRY,
  ADDON_ALIASES,
  CANONICAL_MODES,
  normalizeMode
} from "./addon-registry.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CORE_DIR = path.resolve(__dirname, "../../..");
const REPO_ROOT = path.resolve(CORE_DIR, "../..");

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
    autoDetectAddons: true,
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
    aiLocal: false,
    aiPort: 3031,
    aiModel: "Gemini 3.8 Flash (Low)",
    aiPersona: "analyst",
    aiPurpose: "",
    aiDock: true,
    editable: false,
    mirrorDir: null,
    published: false,
    verify: false,
    json: false,
    version: false,
    help: false
  };

  let explicitOutput = false;
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
      explicitOutput = true;
    } else if (arg === "--project" && args[i + 1]) {
      const slug = args[++i]
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (slug) {
        options.project = slug;
        if (!explicitOutput) {
          options.output = options.published ? `projects/${slug}/published.html` : `projects/${slug}/index.html`;
        }
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
    } else if (arg === "--ai-local") {
      options.aiLocal = true;
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
    } else if (arg === "--editable") {
      options.editable = true;
    } else if (arg === "--no-editable") {
      options.editable = false;
    } else if (arg === "--mirror-dir" && args[i + 1]) {
      options.mirrorDir = args[++i];
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
    } else if (arg === "--only-addons" && args[i + 1]) {
      const items = args[++i].split(",").map((s) => s.trim()).filter(Boolean);
      options.autoDetectAddons = false;
      options.addons.push(...items.filter((item) => item.toLowerCase() !== "none"));
    } else if (arg === "--no-auto-addons") {
      options.autoDetectAddons = false;
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

export function showHelp() {
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
      --ai-local            Enable zero-API-key local context bridge mode
      --editable            Inject opt-in Authoring Plugin (Edit Mode, All Settings, AI Bridge)
      --mirror-dir <dir>    Explicitly mirror project outputs into <dir>
      --published           Emit a clean Published Document with verification artifacts pruned
      --verify              Run deterministic Playwright verification (verify-report.mjs --quick) after assembly
      --json                Output machine-readable JSON Assembly summary (Agent-Facing)
      --theme <name>        DaisyUI theme name (default: "light")
      --custom-theme <path> Path to custom theme definition (.json or .css)
      --favicon <emoji>     Favicon emoticon (default: "📊")
      --addons <list>       Comma-separated addons
      --only-addons <list>  Restrict addons to this list (or "none"), disabling auto-detection
      --no-auto-addons      Disable content signature auto-detection for addons
      --all-addons          Include all catalog addons in <head>
      --charts              Explicitly include Chart.js
      --mermaid             Explicitly include Mermaid
      --gridjs              Explicitly include Grid.js
      --math, --katex       Explicitly include KaTeX
      --leaflet             Explicitly include Leaflet
      --hljs, --highlight   Explicitly include Highlight.js
      --day, --dayjs        Explicitly include Day.js
      --reveal              Explicitly include Reveal.js
      --impress             Explicitly include Impress.js (legacy 3D decks)
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

export function runBuildCli(argv, { buildReport }) {
  const rawArgv = argv.slice(2);
  const hasFlag = (...names) => rawArgv.some((a) => names.includes(a));
  const options = parseArgs(argv);

  if (options.version) {
    console.log(formatVersionString());
    process.exit(0);
  }

  if (options.help) {
    showHelp();
    process.exit(0);
  }

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
        if (!hasFlag("--favicon") && saved.favicon) options.favicon = saved.favicon;
        if (!hasFlag("--addons", "--only-addons") && Array.isArray(saved.activeAddons) && saved.activeAddons.length > 0) {
          options.addons = Array.from(new Set([...options.addons, ...saved.activeAddons]));
        }
        if (saved.pwa && !hasFlag("--pwa")) options.pwa = true;
        if (saved.aiBridge) {
          if (!hasFlag("--ai")) options.ai = true;
          if (saved.aiConfig) {
            if (!hasFlag("--ai-port") && saved.aiConfig.port) options.aiPort = saved.aiConfig.port;
            if (!hasFlag("--ai-model") && saved.aiConfig.model) options.aiModel = saved.aiConfig.model;
            if (!hasFlag("--ai-persona") && saved.aiConfig.persona) options.aiPersona = saved.aiConfig.persona;
            if (!hasFlag("--ai-local") && saved.aiConfig.local) options.aiLocal = true;
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
    autoDetectAddons: options.autoDetectAddons,
    favicon: options.favicon,
    feeds: options.feeds,
    freezeFeeds: options.freezeFeeds,
    feedInterval: options.feedInterval,
    ai: options.ai,
    aiLocal: options.aiLocal,
    aiPort: options.aiPort,
    aiModel: options.aiModel,
    aiPersona: options.aiPersona,
    aiPurpose: options.aiPurpose,
    aiDock: options.aiDock,
    editable: options.editable,
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

  if (options.mirrorDir) {
    const mirrorBase = path.resolve(process.cwd(), options.mirrorDir);
    const repoProjectDir = options.project ? path.join(mirrorBase, options.project) : mirrorBase;
    const resolvedOutputDir = path.resolve(outputDir);
    if (resolvedOutputDir !== path.resolve(repoProjectDir)) {
      try {
        fs.mkdirSync(repoProjectDir, { recursive: true });
        const isDedicatedProjectDir =
          options.project &&
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
    const verifyScript = path.join(CORE_DIR, "playwright/verify-report.mjs");
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
