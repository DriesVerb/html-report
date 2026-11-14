#!/usr/bin/env node
/**
 * @file html-grill.mjs
 * Zero-dependency interactive terminal interview ("grill-me" service) for /html-create:cli.
 * Generates deterministic AI agent prompts and CLI build commands using domain-model.mjs.
 */

import readline from "node:readline";
import { exec } from "node:child_process";
import {
  DAISYUI_THEMES,
  TARGET_DEFINITIONS,
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
      // Linux: try wl-copy, then xclip, then xsel
      cmd = "wl-copy 2>/dev/null || xclip -selection clipboard 2>/dev/null || xsel --clipboard --input 2>/dev/null";
    }

    try {
      const proc = exec(cmd, (err) => {
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
 * Parse CLI flags for non-interactive or pre-seeded execution.
 * @param {string[]} args
 * @returns {object}
 */
export function parseArgs(args) {
  const flags = {
    target: null,
    mode: null,
    app: null,
    theme: null,
    title: null,
    addons: [],
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
    else if (a === "--app" && args[i + 1]) flags.app = args[++i];
    else if (a === "--theme" && args[i + 1]) flags.theme = args[++i];
    else if (a === "--title" && args[i + 1]) flags.title = args[++i];
    else if (a === "--addons" && args[i + 1]) flags.addons = args[++i].split(",").map((s) => s.trim());
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
    output.write(`
${ANSI.bold}${ANSI.cyan}HTML Report Terminal Grill Interview (/html-create:cli)${ANSI.reset}

Usage:
  node skills/html-report/scripts/html-grill.mjs [options]

Options:
  --target <type>        Delivery Archetype: report, print, dashboard, presentation
  --mode <type>          Serving Mode: static (Static File), live (Server-Connected)
  --app <type>           App packaging: browser, live-app, offline-app
  --theme <name>         Startup DaisyUI theme (e.g. light, dark, emerald)
  --title <title>        Output Deliverable title
  --addons <list>        Comma-separated addons (charts, mermaid, gridjs, etc.)
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
      operationalMode: flags.mode || "static",
      appPackaging: flags.app || "browser",
      defaultStartupTheme: flags.theme || "light",
      title: flags.title,
      features: {
        addons: flags.addons.length > 0 ? flags.addons : undefined,
        hasAiAgentBridge: flags.ai,
        hasEnterpriseMcpTools: flags.mcp
      }
    });

    const prompt = generateDeterministicPrompt(config);
    const cli = generateCliCommand(config);
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
  output.write(`${ANSI.bold}${ANSI.cyan}║   ✨ HTML Report Creation Studio & Terminal Grill (/html-create:cli)║${ANSI.reset}\n`);
  output.write(`${ANSI.bold}${ANSI.cyan}╚════════════════════════════════════════════════════════════════════╝${ANSI.reset}\n`);
  output.write(`${ANSI.gray}Answer the following questions to deterministically generate your report architecture & AI prompt.${ANSI.reset}\n\n`);

  try {
    // Step 1: Target Deliverable
    output.write(`${ANSI.bold}${ANSI.green}[Step 1 of 5] What type of deliverable are you building?${ANSI.reset}\n`);
    output.write(`  ${ANSI.bold}1)${ANSI.reset} Executive Analytical Report ${ANSI.dim}(Multi-tab scorecards, Chart.js, Grid.js tables)${ANSI.reset}\n`);
    output.write(`  ${ANSI.bold}2)${ANSI.reset} Printable Document / Audit PDF ${ANSI.dim}(A4/Letter @page layout, invoices, compliance)${ANSI.reset}\n`);
    output.write(`  ${ANSI.bold}3)${ANSI.reset} Real-Time Telemetry Dashboard ${ANSI.dim}(Datastar SSE live streaming, status indicators)${ANSI.reset}\n`);
    output.write(`  ${ANSI.bold}4)${ANSI.reset} Interactive 3D Slide Presentation ${ANSI.dim}(Impress.js 3D transitions, keynote deck)${ANSI.reset}\n`);

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
      output.write(`  ${ANSI.bold}2)${ANSI.reset} Live Connected ${ANSI.dim}(Server-backed SSE stream on localhost:3031)${ANSI.reset}\n`);
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
    output.write(`${ANSI.bold}${ANSI.green}[Step 4 of 5] Default Startup DaisyUI Theme${ANSI.reset}\n`);
    output.write(`  ${ANSI.bold}1)${ANSI.reset} light     ${ANSI.bold}2)${ANSI.reset} corporate  ${ANSI.bold}3)${ANSI.reset} dark\n`);
    output.write(`  ${ANSI.bold}4)${ANSI.reset} emerald   ${ANSI.bold}5)${ANSI.reset} synthwave  ${ANSI.bold}6)${ANSI.reset} luxury\n`);
    output.write(`  ${ANSI.bold}7)${ANSI.reset} Custom theme name (from DaisyUI's 32 themes)\n`);
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
    output.write(`→ Theme: ${ANSI.cyan}${defaultStartupTheme}${ANSI.reset}\n\n`);

    // Step 5: Deliverable Title & Optional Addons
    output.write(`${ANSI.bold}${ANSI.green}[Step 5 of 5] Deliverable Title & Features${ANSI.reset}\n`);
    const defaultTitle = TARGET_DEFINITIONS[target].defaultHero;
    const title = (await ask(rl, `${ANSI.bold}${ANSI.yellow}Enter title (default: "${defaultTitle}"): ${ANSI.reset}`)) || defaultTitle;

    const addons = [...TARGET_DEFINITIONS[target].defaultAddons];
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
    const copied = await copyToClipboard(prompt);
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
if (import.meta.url === `file://${process.argv[1]}`) {
  runInteractiveGrill().catch((err) => {
    console.error("Error running terminal interview:", err);
    process.exit(1);
  });
}
