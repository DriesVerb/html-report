#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { runHarness } from "./harness/runner.mjs";

export function parseArgs(argv) {
  const args = argv.slice(2);
  let htmlPath = null;
  const options = {
    pdf: null,
    mode: null,
    caller: null,
    quick: false,
    timeout: null,
    suites: null,
    only: null,
    grep: null,
    allCdns: false,
    cdns: null,
    themes: null,
    viewports: null,
    bail: false,
    strict: false,
    headed: false,
    json: null,
    screenshots: null,
    colorContrast: false,
    checkCharts: false,
    checkMermaid: false,
    checkMaps: false,
    checkLeaflet: false,
    checkTables: false,
    checkGridjs: false,
    checkMath: false,
    checkKatex: false,
    checkCode: false,
    checkHighlight: false,
    checkMarkdown: false,
    checkMarked: false,
    checkIcons: false,
    checkLucide: false,
    checkReactive: false,
    checkAlpine: false,
    checkCalendar: false,
    checkFullcalendar: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--pdf" && args[i + 1] && !args[i + 1].startsWith("--")) {
      options.pdf = args[++i];
    } else if (arg === "--mode" && args[i + 1] && !args[i + 1].startsWith("--")) {
      options.mode = args[++i];
    } else if (arg === "--caller" && args[i + 1] && !args[i + 1].startsWith("--")) {
      options.caller = args[++i];
    } else if (arg === "--quick" || arg === "-q") {
      options.quick = true;
    } else if (arg === "--timeout" && args[i + 1] && !args[i + 1].startsWith("--")) {
      options.timeout = Number(args[++i]);
    } else if (arg === "--suites" && args[i + 1] && !args[i + 1].startsWith("--")) {
      options.suites = args[++i];
    } else if (arg === "--only" && args[i + 1] && !args[i + 1].startsWith("--")) {
      options.only = args[++i];
    } else if (arg === "--grep" && args[i + 1] && !args[i + 1].startsWith("--")) {
      options.grep = args[++i];
    } else if (arg === "--all-cdns") {
      options.allCdns = true;
    } else if (arg === "--cdns" && args[i + 1] && !args[i + 1].startsWith("--")) {
      options.cdns = args[++i];
    } else if (arg === "--themes" && args[i + 1] && !args[i + 1].startsWith("--")) {
      options.themes = args[++i];
    } else if (arg === "--viewports" && args[i + 1] && !args[i + 1].startsWith("--")) {
      options.viewports = args[++i];
    } else if (arg === "--bail") {
      options.bail = true;
    } else if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--headed") {
      options.headed = true;
    } else if (arg === "--color-contrast") {
      options.colorContrast = true;
    } else if (arg === "--json" && args[i + 1] && !args[i + 1].startsWith("--")) {
      options.json = args[++i];
    } else if (arg === "--review-packet") {
      if (args[i + 1] && !args[i + 1].startsWith("--")) {
        options.reviewPacket = args[++i];
      } else {
        options.reviewPacket = true;
      }
    } else if (arg === "--screenshots") {
      if (args[i + 1] && !args[i + 1].startsWith("--")) {
        options.screenshots = args[++i];
      } else {
        options.screenshots = "./screenshots";
      }
    } else if (arg === "--check-charts" || arg === "--cdn-charts") {
      options.checkCharts = true;
    } else if (arg === "--check-mermaid" || arg === "--cdn-mermaid") {
      options.checkMermaid = true;
    } else if (arg === "--check-maps" || arg === "--check-leaflet" || arg === "--cdn-leaflet") {
      options.checkMaps = true;
      options.checkLeaflet = true;
    } else if (arg === "--check-tables" || arg === "--check-gridjs" || arg === "--cdn-gridjs") {
      options.checkTables = true;
      options.checkGridjs = true;
    } else if (arg === "--check-math" || arg === "--check-katex" || arg === "--cdn-katex") {
      options.checkMath = true;
      options.checkKatex = true;
    } else if (arg === "--check-code" || arg === "--check-highlight" || arg === "--cdn-highlight") {
      options.checkCode = true;
      options.checkHighlight = true;
    } else if (arg === "--check-markdown" || arg === "--check-marked" || arg === "--cdn-marked") {
      options.checkMarkdown = true;
      options.checkMarked = true;
    } else if (arg === "--check-icons" || arg === "--check-lucide" || arg === "--cdn-lucide") {
      options.checkIcons = true;
      options.checkLucide = true;
    } else if (arg === "--check-reactive" || arg === "--check-alpine" || arg === "--cdn-alpine") {
      options.checkReactive = true;
      options.checkAlpine = true;
    } else if (arg === "--check-calendar" || arg === "--check-fullcalendar" || arg === "--cdn-fullcalendar") {
      options.checkCalendar = true;
      options.checkFullcalendar = true;
    } else if (!arg.startsWith("--") && !htmlPath) {
      htmlPath = arg;
    }
  }

  return { htmlPath, ...options };
}

export async function main() {
  const parsed = parseArgs(process.argv);
  if (!parsed.htmlPath) {
    console.error(
      "Usage: node verify-report.mjs <path-to-report.html> [--mode <interactive|static>] [--pdf <output.pdf>] [--caller <caller-id>] [--quick]"
    );
    process.exit(1);
  }

  try {
    const result = await runHarness(parsed.htmlPath, parsed);
    process.exit(result.success ? 0 : 1);
  } catch (err) {
    console.error("Fatal error running Playwright verifier:", err);
    process.exit(1);
  }
}

const isDirectExecution =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectExecution) {
  main();
}
