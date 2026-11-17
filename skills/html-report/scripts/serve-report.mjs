#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { isDirectCliExecution, getChildNodeExecArgs } from "../../../packages/core/scripts/env.mjs";

export * from "../../../packages/studio/scripts/server.mjs";

if (isDirectCliExecution(process.argv[1], import.meta.url)) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const target = path.resolve(__dirname, "../../../packages/studio/scripts/server.mjs");
  const child = spawn(process.execPath, getChildNodeExecArgs([target, ...process.argv.slice(2)]), { stdio: "inherit" });
  const forward = (sig) => { try { child.kill(sig); } catch (_) {} };
  process.on("SIGINT", () => forward("SIGINT"));
  process.on("SIGTERM", () => forward("SIGTERM"));
  child.on("exit", (code) => process.exit(code ?? 0));
}
