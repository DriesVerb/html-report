/**
 * FSM state definitions, mode server policies, and dev-server launcher
 * for @html-report/core harness.
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getChildNodeExecArgs } from "../../env.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../../../..");

export const MODE_SERVER_POLICIES = Object.freeze({
  print: { requiresServer: false, defaultAction: "export_or_static" },
  report: { requiresServer: false, defaultAction: "open_static" },
  presentation: { requiresServer: false, defaultAction: "open_static" },
  dashboard: { requiresServer: true, defaultAction: "serve" },
  "working-report": { requiresServer: true, defaultAction: "serve" },
  "live-report": { requiresServer: true, defaultAction: "serve" },
  pwa: { requiresServer: true, defaultAction: "serve" }
});

export const STATES = Object.freeze({
  IDLE: "IDLE",
  RESOLVING_CALLER: "RESOLVING_CALLER",
  VALIDATING: "VALIDATING",
  AUTO_FIXING: "AUTO_FIXING",
  ASSEMBLING: "ASSEMBLING",
  VERIFYING: "VERIFYING",
  RECORDING_RUN: "RECORDING_RUN",
  REMEDIATING: "REMEDIATING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED"
});

export async function isPortActive(port, host = "localhost") {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/`, { timeout: 800 }, () => {
      resolve(true);
      req.destroy();
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

export async function ensureDevServerRunning({
  filePath,
  port = 3031,
  serveScript = null
}) {
  const active = await isPortActive(port);
  if (active) {
    return {
      running: true,
      alreadyRunning: true,
      port,
      url: `http://localhost:${port}/`
    };
  }

  const candidateServeScripts = [
    serveScript,
    path.resolve(process.cwd(), "skills/html-report/scripts/serve-report.mjs"),
    path.resolve(REPO_ROOT, "skills/html-report/scripts/serve-report.mjs"),
    path.resolve(process.cwd(), "node_modules/.bin/html-report-serve")
  ].filter(Boolean);
  const resolvedServeScript = candidateServeScripts.find((p) => fs.existsSync(p));
  if (!resolvedServeScript) {
    throw new Error("Live dev server script (html-report-serve) was not found in this workspace.");
  }
  const child = spawn(process.execPath, getChildNodeExecArgs([resolvedServeScript, filePath, "--port", String(port)]), {
    detached: true,
    stdio: "ignore"
  });
  child.unref();

  return {
    running: true,
    alreadyRunning: false,
    port,
    url: `http://localhost:${port}/`,
    pid: child.pid
  };
}
