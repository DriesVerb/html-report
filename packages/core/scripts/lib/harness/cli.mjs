/**
 * CLI help text, argument parser, and command runner for harness.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  formatVersionString,
  checkDeprecatedCliArgs,
  checkCompatibility
} from "../../compatibility.mjs";
import {
  lintFragment,
  autoFixFragment
} from "./fragment-linter.mjs";
import {
  formatPrescriptiveDiagnostic,
  printRemediationBanner
} from "./diagnostics.mjs";

export function getHelpText() {
  return `
Pipeline State Machine Harness & Pre-Flight Orchestrator (Zero-Dep Pure Node)

USAGE:
  node harness.mjs <command> [options]

COMMANDS:
  run <fragment.html>       Execute full Pipeline: Validate -> Auto-Fix -> Assemble -> Verify
  lint <fragment.html>      Perform pre-flight semantic linting on Semantic Fragment
  fix <fragment.html>       Apply deterministic auto-fixes to Semantic Fragment and output result

OPTIONS:
  --output, -o <file>       Output Deliverable destination (default: ./report.html or ./report-<caller>.html)
  --title, -t <title>       Output Deliverable title (default: "HTML Report")
  --theme <name>            DaisyUI theme override (e.g. "light", "cupcake", "synthwave")
  --run-id <runId>          Run ID for multi-attempt correlation in vault
  --mode, -m <name>         Delivery Archetype / mode: print, report, presentation, dashboard, working-report, live-report
  --print, -p, --printable  Enable printable styles (@media print, Static File + Passive)
  --presentation            Enable interactive slide deck presentation mode
  --dashboard               Enable interactive telemetry dashboard mode
  --working-report          Enable OpenSpec Journey companion mode
  --live-report, -l         Enable Server-Connected Datastar SSE live streaming mode
  --pwa                     Enable Offline Packaging Modifier (PWA manifest, sw.js, and icons)
  --editable                Inject opt-in Authoring Plugin (Edit Mode & All Settings)
  --serve                   Force start/check dev server
  --no-serve                Disable dev server regardless of mode policy
  --port <number>           Target dev server port (default: 3000)
  --no-auto-fix             Disable mechanical auto-fix transforms during run/validate
  --no-verify               Skip Playwright responsive & console verification
  --fast                    Run sub-second static gate (lintFragment + Assembly) without Playwright
  --full-verify             Verify across all 5 responsive breakpoints (default: quick 2)
  --attempt <number>        Current retry attempt number (default: 1)
  --max-attempts <number>   Maximum allowed remediation attempts before failure (default: 3)
  --caller <id>             Caller identifier for profile-aware overrides and vault tracking
  --pdf [file.pdf]          Generate on-demand PDF export during verification
  --json                    Output machine-readable JSON diagnostics
  --check-compatibility    Scan project directory for deprecated flags and APIs
  --version, -v             Display semantic version
  --help, -h                Show this help screen
`.trim();
}

export function parseArgs(argv = process.argv.slice(2)) {
  const { normalized: rawArgs } = checkDeprecatedCliArgs(argv);
  argv = rawArgs;
  const args = {
    command: "",
    file: "",
    output: null,
    title: "HTML Report",
    theme: null,
    runId: null,
    printable: false,
    autoFix: true,
    verify: true,
    fast: false,
    quick: true,
    attempt: 1,
    maxAttempts: 3,
    mode: null,
    serve: null,
    port: 3000,
    caller: null,
    pdf: null,
    json: false,
    pwa: false,
    editable: false,
    checkCompatibility: false,
    version: false,
    help: false
  };

  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--version" || arg === "-v") {
      args.version = true;
    } else if (arg === "--check-compatibility" || arg === "--compat") {
      args.checkCompatibility = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--no-auto-fix") {
      args.autoFix = false;
    } else if (arg === "--no-verify") {
      args.verify = false;
    } else if (arg === "--fast") {
      args.fast = true;
      args.verify = false;
      args.serve = false;
    } else if (arg === "--full-verify") {
      args.quick = false;
    } else if (arg === "--print" || arg === "--printable" || arg === "-p") {
      args.printable = true;
      args.mode = "print";
    } else if (arg === "--presentation") {
      args.mode = "presentation";
    } else if (arg === "--dashboard") {
      args.mode = "dashboard";
    } else if (arg === "--working" || arg === "--working-report") {
      args.mode = "working-report";
    } else if (arg === "--live" || arg === "--live-report" || arg === "-l") {
      args.mode = "live-report";
    } else if (arg === "--pwa") {
      args.mode = "pwa";
      args.pwa = true;
    } else if (arg === "--editable") {
      args.editable = true;
    } else if (arg === "--serve") {
      args.serve = true;
    } else if (arg === "--no-serve") {
      args.serve = false;
    } else if (arg === "--port" && argv[i + 1]) {
      args.port = parseInt(argv[++i], 10) || 3000;
    } else if ((arg === "--output" || arg === "-o") && argv[i + 1]) {
      args.output = argv[++i];
    } else if ((arg === "--title" || arg === "-t") && argv[i + 1]) {
      args.title = argv[++i];
    } else if (arg === "--theme" && argv[i + 1]) {
      args.theme = argv[++i];
    } else if (arg === "--run-id" && argv[i + 1]) {
      args.runId = argv[++i];
    } else if (arg === "--attempt" && argv[i + 1]) {
      args.attempt = parseInt(argv[++i], 10) || 1;
    } else if (arg === "--max-attempts" && argv[i + 1]) {
      args.maxAttempts = parseInt(argv[++i], 10) || 3;
    } else if ((arg === "--mode" || arg === "-m") && argv[i + 1]) {
      args.mode = argv[++i];
    } else if (arg === "--caller" && argv[i + 1]) {
      args.caller = argv[++i];
    } else if (arg === "--pdf" && argv[i + 1] && !argv[i + 1].startsWith("-")) {
      args.pdf = argv[++i];
    } else if (arg === "--pdf") {
      args.pdf = true;
    } else if (arg.startsWith("-")) {
      // Ignored unrecognized flags
    } else {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    if (["run", "lint", "fix", "compat", "check-compatibility"].includes(positional[0])) {
      args.command = positional[0] === "check-compatibility" ? "compat" : positional[0];
      args.file = positional[1] || "";
    } else {
      args.command = "run";
      args.file = positional[0];
    }
  }

  return args;
}

export async function runHarnessCli(argv = process.argv.slice(2), { runLifecycle }) {
  const args = parseArgs(argv);

  if (args.version) {
    console.log(formatVersionString());
    process.exit(0);
  }

  if (args.checkCompatibility || args.command === "compat") {
    const targetDir = args.file ? path.resolve(process.cwd(), args.file) : process.cwd();
    console.log(`\n🔍 Auditing codebase compatibility for html-report in: ${targetDir}`);
    const report = checkCompatibility(targetDir);
    console.log(`   Scanned ${report.scannedFilesCount} files.`);
    if (report.findings.length === 0) {
      console.log(`\x1b[32m✔ 100% Compatible with html-report v${report.currentVersion} (SemVer ${report.semverSpec})\x1b[0m\n`);
      process.exit(0);
    } else {
      console.log(`\x1b[33m⚠️ Found ${report.findings.length} compatibility issue(s):\x1b[0m`);
      for (const f of report.findings) {
        console.log(`   - [${f.type}] ${f.file}:${f.line} -> '${f.match}' (Replace with: '${f.replacement}')`);
      }
      console.log(`\n📖 Refer to MIGRATION.md or run an AI Refactor Prompt.\n`);
      process.exit(0);
    }
  }

  if (args.help || (!args.command && !args.file)) {
    console.log(getHelpText());
    process.exit(0);
  }

  if (!args.file) {
    console.error("Error: Missing required fragment file path.");
    console.log(getHelpText());
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: Fragment file not found: ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, "utf-8");

  if (args.command === "lint") {
    const lintRes = lintFragment(raw);
    if (args.json) {
      if (!lintRes.valid) {
        console.log(JSON.stringify(formatPrescriptiveDiagnostic(lintRes, args.attempt, args.maxAttempts), null, 2));
        process.exit(1);
      }
      console.log(JSON.stringify({ status: "VALID", valid: true, issues: [] }, null, 2));
      process.exit(0);
    } else {
      if (lintRes.valid) {
        console.log("✓ Pre-flight validation passed: 0 issues found.");
        process.exit(0);
      } else {
        printRemediationBanner(formatPrescriptiveDiagnostic(lintRes, args.attempt, args.maxAttempts));
        process.exit(1);
      }
    }
  }

  if (args.command === "fix") {
    const fixRes = autoFixFragment(raw);
    if (args.output && args.output !== "./report.html") {
      const outPath = path.resolve(process.cwd(), args.output);
      fs.writeFileSync(outPath, fixRes.content, "utf-8");
      console.log(`✓ Auto-fixes applied (${fixRes.fixesApplied.length} transforms) -> Written to: ${outPath}`);
    } else {
      if (args.json) {
        console.log(JSON.stringify(fixRes, null, 2));
      } else {
        process.stdout.write(fixRes.content);
      }
    }
    process.exit(0);
  }

  if (args.command === "run") {
    const runResult = await runLifecycle({
      file: args.file,
      output: args.output,
      title: args.title,
      theme: args.theme,
      runId: args.runId,
      printable: args.printable,
      autoFix: args.autoFix,
      verify: args.verify,
      fast: args.fast,
      quick: args.quick,
      mode: args.mode,
      serve: args.serve,
      port: args.port,
      caller: args.caller,
      pdf: args.pdf,
      pwa: args.pwa,
      editable: args.editable,
      attempt: args.attempt,
      maxAttempts: args.maxAttempts,
      json: args.json
    });

    if (!runResult.success) {
      process.exit(1);
    }
    process.exit(0);
  }
}
