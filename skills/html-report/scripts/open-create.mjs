#!/usr/bin/env node
/**
 * Fast cross-platform Node.js launcher for html-create studio.
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { exec, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const port = Number(process.env.PORT || 3000);
const targetUrl = `http://localhost:${port}/create.html`;

function openBrowser(url) {
  const platform = process.platform;
  let cmd = "xdg-open";
  if (platform === "darwin") cmd = "open";
  else if (platform === "win32") cmd = "start";
  exec(`${cmd} "${url}"`, () => {});
}

function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, { timeout: 800 }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

async function main() {
  const isRunning = await checkServer();
  if (isRunning) {
    console.log(`✓ Dev server active on port ${port}. Opening ${targetUrl}...`);
    openBrowser(targetUrl);
    process.exit(0);
  }

  const createHtml = fs.existsSync(path.join(root, "create.html"))
    ? path.join(root, "create.html")
    : path.join(root, "skills/html-report/assets/create.html");

  const serveScript = path.join(root, "skills/html-report/scripts/serve-report.mjs");
  console.log(`Starting server on port ${port} and launching browser...`);

  const child = spawn(process.execPath, [serveScript, createHtml, "--port", String(port)], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, HTML_REPORT_NO_OPEN: "1" }
  });
  child.unref();

  setTimeout(() => {
    openBrowser(targetUrl);
    console.log(`🚀 html-create studio launched at ${targetUrl}`);
    process.exit(0);
  }, 250);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
