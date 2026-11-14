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
const explicitPort = process.env.PORT ? Number(process.env.PORT) : null;
const candidatePorts = explicitPort ? [explicitPort] : [3031, 3032];

function openBrowser(url) {
  const platform = process.platform;
  let cmd = "xdg-open";
  if (platform === "darwin") cmd = "open";
  else if (platform === "win32") cmd = "start";
  exec(`${cmd} "${url}"`, () => {});
}

function checkHtmlReportServer(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/create/config`, { timeout: 800 }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

async function main() {
  for (const p of candidatePorts) {
    if (await checkHtmlReportServer(p)) {
      const targetUrl = `http://localhost:${p}/create.html`;
      console.log(`✓ Dev server active on port ${p}. Opening ${targetUrl}...`);
      openBrowser(targetUrl);
      process.exit(0);
    }
  }

  const primaryPort = candidatePorts[0];
  const createHtml = fs.existsSync(path.join(root, "create.html"))
    ? path.join(root, "create.html")
    : path.join(root, "skills/html-report/assets/create.html");

  const serveScript = path.join(root, "skills/html-report/scripts/serve-report.mjs");
  console.log(`Starting server on port ${primaryPort} (fallback 3032) and launching browser...`);

  const child = spawn(process.execPath, [serveScript, createHtml, "--port", String(primaryPort)], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, HTML_REPORT_NO_OPEN: "1" }
  });
  child.unref();

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 150));
    for (const p of candidatePorts) {
      if (await checkHtmlReportServer(p)) {
        const targetUrl = `http://localhost:${p}/create.html`;
        openBrowser(targetUrl);
        console.log(`🚀 html-create studio launched at ${targetUrl}`);
        process.exit(0);
      }
    }
  }

  const fallbackUrl = `http://localhost:${primaryPort}/create.html`;
  openBrowser(fallbackUrl);
  console.log(`🚀 html-create studio launched at ${fallbackUrl}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
