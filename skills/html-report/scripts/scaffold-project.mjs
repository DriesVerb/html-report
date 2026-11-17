#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { isDirectCliExecution, getChildNodeExecArgs } from "../../../packages/core/scripts/env.mjs";

export * from "../../../packages/studio/scripts/scaffold-project.mjs";

if (isDirectCliExecution(process.argv[1], import.meta.url)) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const target = path.resolve(__dirname, "../../../packages/studio/scripts/scaffold-project.mjs");
  const res = spawnSync(process.execPath, getChildNodeExecArgs([target, ...process.argv.slice(2)]), { stdio: "inherit" });
  process.exit(res.status ?? 1);
}
