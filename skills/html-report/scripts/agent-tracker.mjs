#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { isDirectCliExecution } from "../../../packages/core/scripts/env.mjs";

export * from "../../../packages/studio/scripts/agent-tracker.mjs";

if (isDirectCliExecution(process.argv[1], import.meta.url)) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const target = path.resolve(__dirname, "../../../packages/studio/scripts/agent-tracker.mjs");
  const res = spawnSync(process.execPath, [target, ...process.argv.slice(2)], { stdio: "inherit" });
  process.exit(res.status ?? 1);
}
