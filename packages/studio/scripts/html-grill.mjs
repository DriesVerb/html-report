#!/usr/bin/env node
/**
 * @file html-grill.mjs
 * Zero-dependency interactive terminal interview ("grill-me" service) for /html-studio:cli.
 * Generates deterministic AI agent prompts and CLI build commands using domain-model.mjs.
 */

import readline from "node:readline";
import { exec } from "node:child_process";
import { isDirectCliExecution } from "@html-report/core/env";
import {
  CORE_CDN_STACK,
  DAISYUI_THEMES,
  TARGET_DEFINITIONS,
  ADDON_CATALOG,
  WIDGET_PRESETS,
  normalizeAddonKey,
  normalizeDomainConfig,
  resolveSiblingSkill,
  generateCliCommand,
  generateDeterministicPrompt
} from "./domain-model.mjs";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bgCyan: "\x1b[46m",
  bgBlack: "\x1b[40m"
};

/**
 * Attempts to copy text to system clipboard across platforms.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export function copyToClipboard(text) {
  return new Promise((resolve) => {
    let cmd = "";
    if (process.platform === "darwin") {
      cmd = "pbcopy";
    } else if (process.platform === "win32") {
      cmd = "clip";
    } else {
      // Linux: try wl-copy, then xclip, then xsel (silence stdout/stderr so backgrounded clipboard daemons don't hold pipes open)
      cmd = "wl-copy >/dev/null 2>&1 || xclip -selection clipboard >/dev/null 2>&1 || xsel --clipboard --input >/dev/null 2>&1";
    }

    try {
      const proc = exec(cmd, { timeout: 1500 }, (err) => {
        resolve(!err);
      });
      if (proc.stdin) {
        proc.stdin.write(text);
        proc.stdin.end();
      } else {
        resolve(false);
      }
    } catch (_) {
      resolve(false);
    }
  });
}

/**
 * Prompts user with a question using standard readline interface.
 * @param {readline.Interface} rl
 * @param {string} query
 * @returns {Promise<string>}
 */
function ask(rl, query) {
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      resolve(ans.trim());
    });
  });
}

/**
 * Resolves interactive addon input against default target addons and ADDON_CATALOG.
 * Supports:
 * - Empty string -> keeps defaults
 * - "none" -> empty array
 * - Modifier list ("+quill,-gridjs,+hljs") -> adds/removes from defaults
 * - Explicit comma list of keys, aliases, or 1-based catalog indices ("1,2,8" or "charts,quill")
 * @param {string} rawInput
 * @param {string[]} defaultAddons
 * @returns {string[]}
 */
export function resolveInteractiveAddons(rawInput, defaultAddons = []) {
  const trimmed = String(rawInput || "").trim();
  if (!trimmed) {
    return [...defaultAddons];
  }
  if (trimmed.toLowerCase() === "none") {
    return [];
  }

  const catalogKeys = Object.keys(ADDON_CATALOG);
  const tokens = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  const hasModifiers = tokens.some((t) => t.startsWith("+") || t.startsWith("-"));

  const resolveToken = (token) => {
    if (/^\d+$/.test(token)) {
      const idx = Number(token) - 1;
      return idx >= 0 && idx < catalogKeys.length ? catalogKeys[idx] : "";
    }
    return normalizeAddonKey(token);
  };

  if (hasModifiers) {
    const result = new Set(defaultAddons.map(normalizeAddonKey).filter(Boolean));
    for (const token of tokens) {
      if (token.startsWith("-")) {
        const key = resolveToken(token.slice(1));
        if (key) result.delete(key);
      } else {
        const raw = token.startsWith("+") ? token.slice(1) : token;
        const key = resolveToken(raw);
        if (key) result.add(key);
      }
    }
    return [...result];
  }

  const resolved = [];
  for (const token of tokens) {
    const key = resolveToken(token);
    if (key && !resolved.includes(key)) {
      resolved.push(key);
    }
  }
  return resolved;
}

/**
 * Parse CLI flags for non-interactive or pre-seeded execution.
 * @param {string[]} args
 * @returns {object}
 */
export function parseArgs(args) {
  const flags = {
    target: null,
    mode: null,
    behavioral: null,
    app: null,
    theme: null,
    customColor: null,
    title: null,
    slug: null,
    addons: [],
    hasExplicitAddons: false,
    widgets: [],
    port: null,
    ai: false,
    mcp: false,
    nonInteractive: false,
    json: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-h" || a === "--help") flags.help = true;
    else if (a === "--non-interactive" || a === "--ci") flags.nonInteractive = true;
    else if (a === "--json") flags.json = true;
    else if (a === "--target" && args[i + 1]) flags.target = args[++i];
    else if (a === "--mode" && args[i + 1]) flags.mode = args[++i];
    else if (a === "--behavioral" && args[i + 1]) flags.behavioral = args[++i];
    else if (a === "--app" && args[i + 1]) flags.app = args[++i];
    else if (a === "--theme" && args[i + 1]) flags.theme = args[++i];
    else if ((a === "--custom-color" || a === "--brand-color") && args[i + 1]) flags.customColor = args[++i];
    else if (a === "--title" && args[i + 1]) flags.title = args[++i];
    else if ((a === "--slug" || a === "--project") && args[i + 1]) flags.slug = args[++i];
    else if (a === "--addons" && args[i + 1]) {
      flags.hasExplicitAddons = true;
      const raw = args[++i];
      if (raw.trim().toLowerCase() === "none") {
        flags.addons = [];
      } else {
        flags.addons = raw.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
    else if (a === "--no-addons") {
      flags.hasExplicitAddons = true;
      flags.addons = [];
    }
    else if (a === "--widgets" && args[i + 1]) {
      flags.widgets = args[++i].split(",").map((s) => s.trim()).filter(Boolean);
    }
    else if (a === "--port" && args[i + 1]) {
      const parsedPort = Number(args[++i]);
      if (Number.isFinite(parsedPort) && parsedPort > 0) flags.port = parsedPort;
    }
    else if (a === "--ai" || a === "--agent-bridge") flags.ai = true;
    else if (a === "--mcp" || a === "--mcp-gateway") flags.mcp = true;
  }

  return flags;
}

/**
 * Runs the interactive terminal interview.
 * @param {object} options
 * @returns {Promise<object>}
 */
export async function runInteractiveGrill(options = {}) {
  const input = options.input || process.stdin;
  const output = options.output || process.stdout;
  const args = options.args || process.argv.slice(2);
  const flags = parseArgs(args);

  if (flags.help) {
    const addonKeys = Object.keys(ADDON_CATALOG).join(", ");
    const widgetKeys = Object.keys(WIDGET_PRESETS).join(", ");
    output.write(`
${ANSI.bold}${ANSI.cyan}HTML Report Terminal Grill Interview (/html-studio:cli)${ANSI.reset}
Core CDN Stack: Tailwind CSS Play CDN + DaisyUI v${CORE_CDN_STACK.daisyui.version} (${CORE_CDN_STACK.daisyui.themes} themes) + Lucide v${CORE_CDN_STACK.lucide.version} + Alpine.js v${CORE_CDN_STACK.alpinejs.version}

Usage:
  node skills/html-report/scripts/html-grill.mjs [options]

Options:
  --target <type>        Delivery Archetype: report, print, dashboard, presentation
  --mode <type>          Serving Mode: static (Static File), live (Server-Connected)
  --behavioral <type>    Behavioral Mode: interactive, passive
  --app <type>           App packaging: browser, live-app, offline-app
  --theme <name>         Startup DaisyUI theme (default: light; 32 built-in themes)
  --custom-color <hex>   Optional custom brand primary hex (e.g. #3b82f6)
  --title <title>        Output Deliverable title
  --slug <slug>          Optional project folder slug (projects/<slug>/)
  --addons <list>        Comma-separated CDN addons or "none" (${addonKeys})
  --no-addons            Disable all optional CDN addons
  --widgets <list>       Comma-separated starter presets (${widgetKeys})
  --port <port>          Live server port for Datastar SSE mode (default: 3031)
  --ai                   Enable Two-Way AI Agent Bridge dock
  --mcp                  Enable enterprise MCP gateway proxy
  --non-interactive      Skip interactive prompts and synthesize immediately (Agent-Facing)
  --json                 Output structured JSON
  -h, --help             Show this help guide
\n`);
    return null;
  }

  if (flags.nonInteractive) {
    const config = normalizeDomainConfig({
      target: flags.target || "report",
      operationalMode: flags.mode || undefined,
      behavioralMode: flags.behavioral || undefined,
      appPackaging: flags.app || "browser",
      defaultStartupTheme: flags.theme || "light",
      customBrandColorHex: flags.customColor || undefined,
      projectSlug: flags.slug || undefined,
      title: flags.title,
      widgets: flags.widgets,
      features: {
        addons: flags.hasExplicitAddons ? flags.addons : undefined,
        hasAiAgentBridge: flags.ai,
        hasEnterpriseMcpTools: flags.mcp
      }
    });

    const promptInput = flags.port ? { ...config, port: flags.port } : config;
    const prompt = generateDeterministicPrompt(promptInput);
    const cli = generateCliCommand(config, flags.port ? { port: flags.port } : {});
    const sibling = resolveSiblingSkill(config);

    if (flags.json) {
      output.write(JSON.stringify({ config, sibling, cli, prompt }, null, 2) + "\n");
    } else {
      output.write(prompt + "\n");
    }
    return { config, sibling, cli, prompt };
  }

  const rl = readline.createInterface({ input, output });

  output.write(`\n${ANSI.bold}${ANSI.cyan}╔════════════════════════════════════════════════════════════════════╗${ANSI.reset}\n`);
  output.write(`${ANSI.bold}${ANSI.cyan}║   ✨ HTML Report Creation Studio & Terminal Grill (/html-studio:cli)║${ANSI.reset}\n`);
  output.write(`${ANSI.bold}${ANSI.cyan}╚════════════════════════════════════════════════════════════════════╝${ANSI.reset}\n`);
  output.write(`${ANSI.gray}Core CDN Stack: Tailwind CSS + DaisyUI v${CORE_CDN_STACK.daisyui.version} (${CORE_CDN_STACK.daisyui.themes} themes) + Lucide v${CORE_CDN_STACK.lucide.version} + Alpine.js v${CORE_CDN_STACK.alpinejs.version}${ANSI.reset}\n`);
  output.write(`${ANSI.gray}Answer the following questions to deterministically generate your report architecture & AI prompt.${ANSI.reset}\n\n`);

  try {
    // Step 1: Target Deliverable
    output.write(`${ANSI.bold}${ANSI.green}[Step 1 of 5] What type of deliverable are you building?${ANSI.reset}\n`);
    output.write(`  ${ANSI.bold}1)${ANSI.reset} Executive Analytical Report ${ANSI.dim}(Multi-tab scorecards, Chart.js v4.4, Grid.js v6.0, Showdown)${ANSI.reset}\n`);
    output.write(`  ${ANSI.bold}2)${ANSI.reset} Printable Document / Audit PDF ${ANSI.dim}(A4/Letter @page layout, invoices, compliance)${ANSI.reset}\n`);
    output.write(`  ${ANSI.bold}3)${ANSI.reset} Real-Time Telemetry Dashboard ${ANSI.dim}(Datastar v1.0-beta.9 SSE streaming, status indicators)${ANSI.reset}\n`);
    output.write(`  ${ANSI.bold}4)${ANSI.reset} Interactive Slide Deck Presentation ${ANSI.dim}(Reveal.js v5.1 transitions, speaker notes, fullscreen)${ANSI.reset}\n`);

    const targetChoice = await ask(rl, `${ANSI.bold}${ANSI.yellow}Select [1-4] (default: 1): ${ANSI.reset}`);
    let target = "report";
    if (targetChoice === "2") target = "print";
    else if (targetChoice === "3") target = "dashboard";
    else if (targetChoice === "4") target = "presentation";
    output.write(`→ Selected: ${ANSI.cyan}${TARGET_DEFINITIONS[target].humanName}${ANSI.reset}\n\n`);

    // Step 2: Operational Data Mode
    let operationalMode = "static";
    if (target === "print") {
      output.write(`${ANSI.gray}[Step 2] Operational Data Mode: Automatically set to STATIC for Printable PDF.${ANSI.reset}\n\n`);
    } else {
      output.write(`${ANSI.bold}${ANSI.green}[Step 2 of 5] Operational Data Mode${ANSI.reset}\n`);
      output.write(`  ${ANSI.bold}1)${ANSI.reset} Static Standalone ${ANSI.dim}(Zero server needed, 100% portable single HTML file)${ANSI.reset}\n`);
      output.write(`  ${ANSI.bold}2)${ANSI.reset} Live Connected ${ANSI.dim}(Server-backed Datastar SSE stream on localhost:3031)${ANSI.reset}\n`);
      const defaultModeChoice = target === "dashboard" ? "2" : "1";
      const modeChoice = await ask(rl, `${ANSI.bold}${ANSI.yellow}Select [1-2] (default: ${defaultModeChoice}): ${ANSI.reset}`) || defaultModeChoice;
      if (modeChoice === "2") operationalMode = "live";
      output.write(`→ Operational Mode: ${ANSI.cyan}${operationalMode.toUpperCase()}${ANSI.reset}\n\n`);
    }

    // Step 3: App Download Packaging
    let appPackaging = "browser";
    if (target !== "print") {
      output.write(`${ANSI.bold}${ANSI.green}[Step 3 of 5] Application Download Packaging${ANSI.reset}\n`);
      output.write(`  ${ANSI.bold}1)${ANSI.reset} Standard Web Browser Page ${ANSI.dim}(Standard responsive tab)${ANSI.reset}\n`);
      if (operationalMode === "live") {
        output.write(`  ${ANSI.bold}2)${ANSI.reset} Downloadable App - Standalone Window ${ANSI.dim}(PWA window pinned to dock/home screen)${ANSI.reset}\n`);
      }
      output.write(`  ${ANSI.bold}3)${ANSI.reset} Downloadable Offline-First App ${ANSI.dim}(PWA with full offline Service Worker cache)${ANSI.reset}\n`);
      const appChoice = await ask(rl, `${ANSI.bold}${ANSI.yellow}Select [1-3] (default: 1): ${ANSI.reset}`) || "1";
      if (appChoice === "2" && operationalMode === "live") appPackaging = "live-app";
      else if (appChoice === "3") appPackaging = "offline-app";
      output.write(`→ Packaging: ${ANSI.cyan}${appPackaging}${ANSI.reset}\n\n`);
    }

    // Step 4: Theme Selection
    output.write(`${ANSI.bold}${ANSI.green}[Step 4 of 5] Default Startup DaisyUI Theme (v${CORE_CDN_STACK.daisyui.version} — ${CORE_CDN_STACK.daisyui.themes} themes)${ANSI.reset}\n`);
    output.write(`  ${ANSI.bold}1)${ANSI.reset} light     ${ANSI.bold}2)${ANSI.reset} corporate  ${ANSI.bold}3)${ANSI.reset} dark\n`);
    output.write(`  ${ANSI.bold}4)${ANSI.reset} emerald   ${ANSI.bold}5)${ANSI.reset} synthwave  ${ANSI.bold}6)${ANSI.reset} luxury\n`);
    output.write(`  ${ANSI.bold}7)${ANSI.reset} Custom theme name (from DaisyUI's ${CORE_CDN_STACK.daisyui.themes} themes)\n`);
    const themeChoice = await ask(rl, `${ANSI.bold}${ANSI.yellow}Select [1-7] (default: 1): ${ANSI.reset}`) || "1";
    let defaultStartupTheme = "light";
    if (themeChoice === "2") defaultStartupTheme = "corporate";
    else if (themeChoice === "3") defaultStartupTheme = "dark";
    else if (themeChoice === "4") defaultStartupTheme = "emerald";
    else if (themeChoice === "5") defaultStartupTheme = "synthwave";
    else if (themeChoice === "6") defaultStartupTheme = "luxury";
    else if (themeChoice === "7") {
      const customTheme = await ask(rl, `${ANSI.yellow}Enter DaisyUI theme name: ${ANSI.reset}`);
      if (DAISYUI_THEMES.includes(customTheme.toLowerCase())) {
        defaultStartupTheme = customTheme.toLowerCase();
      }
    }
    const brandHexInput = await ask(rl, `${ANSI.bold}${ANSI.yellow}Optional custom brand primary hex (e.g. #3b82f6, Enter to skip): ${ANSI.reset}`);
    output.write(`→ Theme: ${ANSI.cyan}${defaultStartupTheme}${ANSI.reset}${brandHexInput ? ` (Brand Primary: ${ANSI.cyan}${brandHexInput}${ANSI.reset})` : ""}\n\n`);

    // Step 5: Deliverable Title, CDN Addons & Features
    output.write(`${ANSI.bold}${ANSI.green}[Step 5 of 5] Deliverable Title, CDN Addons & Features${ANSI.reset}\n`);
    const defaultTitle = TARGET_DEFINITIONS[target].defaultHero;
    const title = (await ask(rl, `${ANSI.bold}${ANSI.yellow}Enter title (default: "${defaultTitle}"): ${ANSI.reset}`)) || defaultTitle;

    const defaultAddons = [...TARGET_DEFINITIONS[target].defaultAddons];
    const catalogEntries = Object.entries(ADDON_CATALOG);
    output.write(`${ANSI.bold}Available CDN Addons${ANSI.reset} ${ANSI.dim}(defaults for ${target}: ${defaultAddons.join(", ") || "none"})${ANSI.reset}:\n`);
    catalogEntries.forEach(([key, meta], index) => {
      const num = String(index + 1).padStart(2, " ");
      const marker = defaultAddons.includes(key) ? `${ANSI.green}*${ANSI.reset}` : " ";
      output.write(`  ${marker} ${ANSI.bold}${num})${ANSI.reset} ${key.padEnd(13, " ")} ${ANSI.dim}${meta.label}${ANSI.reset}\n`);
    });
    const addonsInput = await ask(
      rl,
      `${ANSI.bold}${ANSI.yellow}Customize CDN addons (Enter to keep defaults, "none", "+quill,-gridjs", or list/numbers): ${ANSI.reset}`
    );
    const addons = resolveInteractiveAddons(addonsInput, defaultAddons);
    output.write(`→ Addons: ${ANSI.cyan}${addons.length > 0 ? addons.join(", ") : "none"}${ANSI.reset}\n`);

    let hasAiAgentBridge = false;
    let hasEnterpriseMcpTools = false;

    if (operationalMode === "live") {
      const aiAns = await ask(rl, `${ANSI.bold}${ANSI.yellow}Enable in-browser AI Co-Pilot Dock (Cmd+K)? [y/N]: ${ANSI.reset}`);
      if (aiAns.toLowerCase().startsWith("y")) hasAiAgentBridge = true;

      const mcpAns = await ask(rl, `${ANSI.bold}${ANSI.yellow}Enable Enterprise MCP Gateway Proxy (Postgres/GitLab widgets)? [y/N]: ${ANSI.reset}`);
      if (mcpAns.toLowerCase().startsWith("y")) hasEnterpriseMcpTools = true;
    }

    rl.close();

    // Compile and synthesize
    const config = normalizeDomainConfig({
      target,
      title,
      operationalMode,
      appPackaging,
      defaultStartupTheme,
      customBrandColorHex: brandHexInput || undefined,
      features: {
        addons,
        hasAiAgentBridge,
        hasEnterpriseMcpTools
      }
    });

    const sibling = resolveSiblingSkill(config);
    const cli = generateCliCommand(config);
    const prompt = generateDeterministicPrompt(config);

    // Presentation Output
    output.write(`\n${ANSI.bold}${ANSI.green}══════════════════════════════════════════════════════════════════════${ANSI.reset}\n`);
    output.write(`${ANSI.bold}${ANSI.cyan}🎯 Deterministic AI Agent Prompt (Synthesized)${ANSI.reset}\n`);
    output.write(`${ANSI.bold}${ANSI.green}══════════════════════════════════════════════════════════════════════${ANSI.reset}\n\n`);
    output.write(`${prompt}\n\n`);

    output.write(`${ANSI.bold}${ANSI.green}══════════════════════════════════════════════════════════════════════${ANSI.reset}\n`);
    output.write(`${ANSI.bold}${ANSI.yellow}⚡ Recommended Downstream Execution${ANSI.reset}\n`);
    output.write(`  Target Skill Facade: ${ANSI.bold}${ANSI.cyan}${sibling.skillTag}${ANSI.reset}\n`);
    output.write(`  Build Command:\n    ${ANSI.bold}${cli.buildCommand.replace(/\n/g, "\n    ")}${ANSI.reset}\n`);
    if (cli.serveCommand) {
      output.write(`  Live Dev Server Command:\n    ${ANSI.bold}${cli.serveCommand}${ANSI.reset}\n`);
    }
    output.write(`${ANSI.bold}${ANSI.green}══════════════════════════════════════════════════════════════════════${ANSI.reset}\n\n`);

    // Clipboard copy attempt
    const copied = options.skipClipboard ? false : await copyToClipboard(prompt);
    if (copied) {
      output.write(`${ANSI.green}✔ Deterministic prompt successfully copied to system clipboard!${ANSI.reset}\n`);
      output.write(`${ANSI.gray}Paste directly to your AI agent (Claude, Antigravity, or terminal co-pilot).${ANSI.reset}\n\n`);
    } else {
      output.write(`${ANSI.gray}💡 Tip: Copy the prompt block above directly into your AI assistant.${ANSI.reset}\n\n`);
    }

    return { config, sibling, cli, prompt };
  } catch (err) {
    rl.close();
    throw err;
  }
}

// Auto-run if executed directly as a script
if (isDirectCliExecution(process.argv[1], import.meta.url)) {
  runInteractiveGrill().catch((err) => {
    console.error("Error running terminal interview:", err);
    process.exit(1);
  });
}
