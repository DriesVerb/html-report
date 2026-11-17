#!/usr/bin/env node
/**
 * preflight.mjs
 * Fast, deterministic pre-authoring environment & AI provider preflight utility
 * for html-report. Also provides shared symlink-safe CLI detection, browser
 * fallback discovery, and re-exports AgentInferenceRouter from lib/preflight/.
 */

import net from "node:net";
import {
  DEFAULT_PRIMARY_PORT,
  DEFAULT_SECONDARY_PORT,
  isDirectCliExecution,
  resolveSkillPaths,
  detectSystemChrome,
  detectBrowserReadiness,
  findExecutableOnPath
} from "@html-report/core/env";
import {
  SUPPORTED_CLI_PROVIDERS,
  sanitizeCliError,
  AgentInferenceRouter
} from "./lib/preflight/inference-router.mjs";

export {
  DEFAULT_PRIMARY_PORT,
  DEFAULT_SECONDARY_PORT,
  isDirectCliExecution,
  resolveSkillPaths,
  detectSystemChrome,
  detectBrowserReadiness,
  findExecutableOnPath,
  SUPPORTED_CLI_PROVIDERS,
  sanitizeCliError,
  AgentInferenceRouter
};

export function checkPortAvailable(port, host = undefined) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", () => resolve(false));
    const listenArgs = host ? [port, host] : [port];
    srv.listen(...listenArgs, () => {
      srv.close(() => resolve(true));
    });
  });
}

export async function probePorts(primaryPort = DEFAULT_PRIMARY_PORT, secondaryPort = DEFAULT_SECONDARY_PORT) {
  const candidates = [primaryPort, secondaryPort];
  for (let p = 3033; p <= 3039; p++) {
    if (!candidates.includes(p)) candidates.push(p);
  }

  const availability = {};
  let recommendedPort = null;

  for (const p of candidates) {
    const free = await checkPortAvailable(p);
    availability[p] = free;
    if (free && recommendedPort === null) {
      recommendedPort = p;
    }
  }

  return {
    primaryPort,
    primaryAvailable: Boolean(availability[primaryPort]),
    secondaryPort,
    fallbackPort: secondaryPort,
    secondaryAvailable: Boolean(availability[secondaryPort]),
    recommendedPort: recommendedPort || primaryPort,
    availability
  };
}

export async function runPreflight(options = {}) {
  const primaryPort = Number(options.port) || DEFAULT_PRIMARY_PORT;
  const secondaryPort = Number(options.fallbackPort) || DEFAULT_SECONDARY_PORT;
  const workspaceRoot = options.workspaceRoot || process.cwd();

  const skillPaths = resolveSkillPaths(workspaceRoot);
  const ports = await probePorts(primaryPort, secondaryPort);
  const browser = await detectBrowserReadiness();
  const ai = options.verifyAi
    ? await AgentInferenceRouter.verifyInference(options)
    : AgentInferenceRouter.detectProviders(options);

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    skillRoot: skillPaths.skillRoot,
    isMonorepoLocal: skillPaths.isMonorepoLocal,
    skillPaths,
    paths: skillPaths,
    ports: {
      [primaryPort]: ports.primaryAvailable,
      [secondaryPort]: ports.secondaryAvailable,
      primaryPort: ports.primaryPort,
      primaryAvailable: ports.primaryAvailable,
      secondaryPort: ports.secondaryPort,
      secondaryAvailable: ports.secondaryAvailable,
      recommendedPort: ports.recommendedPort,
      availability: ports.availability
    },
    browser,
    ai: {
      installed: ai.installed,
      authenticated: ai.authenticated,
      inferenceVerified: Boolean(ai.inferenceVerified),
      providerAvailable: ai.providerAvailable,
      activeProvider: ai.activeProvider,
      activeProviderName: ai.activeProviderName,
      checkedProviders: ai.checkedProviders,
      availableProviders: ai.availableProviders,
      ...(ai.latencyMs !== undefined ? { latencyMs: ai.latencyMs } : {}),
      ...(ai.verificationError ? { verificationError: ai.verificationError } : {})
    }
  };
}

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    port: DEFAULT_PRIMARY_PORT,
    fallbackPort: DEFAULT_SECONDARY_PORT,
    verifyAi: false,
    json: false,
    help: false
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json") opts.json = true;
    else if (arg === "--verify-ai" || arg === "--probe-ai") opts.verifyAi = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if ((arg === "--port" || arg === "-p") && args[i + 1]) {
      opts.port = Number(args[++i]) || DEFAULT_PRIMARY_PORT;
    } else if (arg === "--fallback-port" && args[i + 1]) {
      opts.fallbackPort = Number(args[++i]) || DEFAULT_SECONDARY_PORT;
    }
  }
  return opts;
}

if (isDirectCliExecution(process.argv[1], import.meta.url)) {
  const opts = parseCliArgs(process.argv);
  if (opts.help) {
    console.log(`
html-report Pre-Authoring Environment Preflight CLI (preflight.mjs)

Usage:
  node skills/html-report/scripts/preflight.mjs [--port 3031] [--fallback-port 3032] [--json]
`);
    process.exit(0);
  }

  runPreflight(opts)
    .then((report) => {
      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(`[html-report] Environment Preflight:`);
        console.log(`  Skill Root:       ${report.skillRoot} (${report.isMonorepoLocal ? "repo-local" : "external install"})`);
        console.log(`  Primary Port:     ${report.ports.primaryPort} (${report.ports.primaryAvailable ? "FREE" : "OCCUPIED"})`);
        console.log(`  Secondary Port:   ${report.ports.secondaryPort} (${report.ports.secondaryAvailable ? "FREE" : "OCCUPIED"})`);
        console.log(`  Recommended Port: ${report.ports.recommendedPort}`);
        console.log(`  Browser Engine:   ${report.browser.ready ? `READY (${report.browser.strategy}: ${report.browser.recommendedExecutable})` : "UNAVAILABLE"}`);
        console.log(`  AI Inference:     ${report.ai.providerAvailable ? `READY (${report.ai.activeProviderName})` : `UNAVAILABLE (checked: ${report.ai.checkedProviders.join(", ")})`}`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("[html-report] Preflight error:", err.message);
      process.exit(1);
    });
}
