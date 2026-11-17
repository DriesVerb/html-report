/**
 * @file lib/server/supervisor.mjs
 * Self-reloading CLI process supervisor for server.mjs so script edits or
 * /api/server/restart requests respawn the worker cleanly.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { getChildNodeExecArgs } from "@html-report/core/env";

export function runSupervisedServer(argv, entryScriptPath) {
  const scriptsDir = path.dirname(entryScriptPath);
  const watchedScripts = [
    entryScriptPath,
    path.join(scriptsDir, "scaffold-project.mjs"),
    path.join(scriptsDir, "domain-model.mjs"),
    path.join(scriptsDir, "authoring-plugin.mjs")
  ].filter((p) => fs.existsSync(p));

  const childArgs = [entryScriptPath, ...argv.slice(2)];
  let child = null;
  let shuttingDown = false;
  let restarting = false;
  let pendingRestart = false;
  let restartTimer = null;
  let hasStartedOnce = false;
  const scriptWatchers = [];

  const spawnWorker = (suppressAutoOpen = false) => {
    const workerArgs = suppressAutoOpen && !childArgs.includes("--no-open")
      ? [...childArgs, "--no-open"]
      : childArgs;
    child = spawn(process.execPath, getChildNodeExecArgs(workerArgs), {
      stdio: ["inherit", "inherit", "inherit", "ipc"],
      env: {
        ...process.env,
        HTML_REPORT_SUPERVISED: "1",
        ...(suppressAutoOpen ? { HTML_REPORT_NO_OPEN: "1" } : {})
      }
    });
    hasStartedOnce = true;

    child.on("message", (msg) => {
      if (msg && msg.type === "restart") {
        triggerRestart(msg.reason || "api-request");
      }
    });

    child.on("exit", (code, signal) => {
      const wasRestarting = restarting;
      child = null;
      if (shuttingDown) {
        process.exit(code ?? 0);
        return;
      }
      if (wasRestarting) {
        restarting = false;
        spawnWorker(true);
        if (pendingRestart) {
          pendingRestart = false;
          triggerRestart("queued-update");
        }
        return;
      }
      if (signal) {
        process.exit(0);
      } else {
        process.exit(code ?? 0);
      }
    });
  };

  const triggerRestart = (reason) => {
    if (shuttingDown) return;
    if (restarting) {
      pendingRestart = true;
      return;
    }
    if (!child) {
      spawnWorker(hasStartedOnce);
      return;
    }
    restarting = true;
    console.log(`\n[html-report] Server update detected (${reason}) — restarting automatically...`);
    const target = child;
    try { target.kill("SIGTERM"); } catch (_) {}
    setTimeout(() => {
      if (child === target) {
        try { target.kill("SIGKILL"); } catch (_) {}
      }
    }, 2000).unref();
  };

  for (const scriptPath of watchedScripts) {
    try {
      let lastMtime = fs.statSync(scriptPath).mtimeMs;
      const w = fs.watch(scriptPath, () => {
        try {
          const nextMtime = fs.statSync(scriptPath).mtimeMs;
          if (nextMtime === lastMtime) return;
          lastMtime = nextMtime;
        } catch (_) {
          return;
        }
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => {
          triggerRestart(path.basename(scriptPath));
        }, 250);
      });
      scriptWatchers.push(w);
    } catch (_) {}
  }

  const shutdownSupervisor = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearTimeout(restartTimer);
    for (const w of scriptWatchers) { try { w.close(); } catch (_) {} }
    if (child) {
      const target = child;
      try { target.kill("SIGTERM"); } catch (_) {}
      setTimeout(() => {
        try { target.kill("SIGKILL"); } catch (_) {}
        process.exit(0);
      }, 1500).unref();
    } else {
      process.exit(0);
    }
  };

  process.on("SIGINT", shutdownSupervisor);
  process.on("SIGTERM", shutdownSupervisor);

  spawnWorker(false);
}
