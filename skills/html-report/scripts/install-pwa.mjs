#!/usr/bin/env node
/**
 * install-pwa.mjs - 1-Click PWA Packaging & Offline Installer
 *
 * Scaffolds W3C manifest, offline service worker pre-caching, scalable SVG icon,
 * launches the local dev server on dedicated port 3030 (with auto-hunting fallback),
 * and opens the standalone PWA installation flow.
 *
 * Usage:
 *   node install-pwa.mjs [target-html-file] [--port <number>] [--no-open]
 */

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { exec, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  generatePwaAssets,
  generateStudioPwaAssets,
  injectPwaIntoHtml,
  DEFAULT_PWA_CONFIG
} from "./pwa-builder.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

export function parseInstallArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    target: null,
    port: parseInt(env.HTML_REPORT_PORT || env.PORT || "3030", 10),
    noOpen: Boolean(env.HTML_REPORT_NO_OPEN || false),
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if ((arg === "--port" || arg === "-p") && argv[i + 1]) {
      options.port = parseInt(argv[++i], 10) || 3030;
    } else if (arg === "--no-open") {
      options.noOpen = true;
    } else if (!arg.startsWith("--") && !options.target) {
      options.target = arg;
    }
  }

  return options;
}

export function openBrowser(url) {
  if (process.env.HTML_REPORT_NO_OPEN) return;
  const platform = process.platform;
  let cmd = "xdg-open";
  if (platform === "darwin") cmd = "open";
  else if (platform === "win32") cmd = "start";
  exec(`${cmd} "${url}"`, () => {});
}

export function probePort(port, host = "localhost") {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

export async function findAvailablePort(startPort = 3030, maxAttempts = 20) {
  for (let p = startPort; p < startPort + maxAttempts; p++) {
    const available = await probePort(p);
    if (available) return p;
  }
  return startPort;
}

export async function checkServerRunning(port, testPath = "/") {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}${testPath}`, { timeout: 700 }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

export async function installPwa(options = {}) {
  const targetArg = options.target;
  let targetFile;
  let isStudio = false;

  if (!targetArg) {
    // Default to create.html (Creation Studio)
    isStudio = true;
    if (fs.existsSync(path.resolve(REPO_ROOT, "create.html"))) {
      targetFile = path.resolve(REPO_ROOT, "create.html");
    } else {
      targetFile = path.resolve(__dirname, "../assets/create.html");
    }
  } else {
    targetFile = path.resolve(process.cwd(), targetArg);
    if (!fs.existsSync(targetFile)) {
      throw new Error(`Target report file not found at: ${targetFile}`);
    }
    if (path.basename(targetFile) === "create.html") {
      isStudio = true;
    }
  }

  const outputDir = path.dirname(targetFile);
  const targetFileName = path.basename(targetFile);

  console.log(`[html-install] 📦 Packaging PWA for: ${targetFileName}`);

  // 1. Generate PWA Assets (manifest, sw.js, icon.svg)
  let pwaAssets;
  if (isStudio) {
    pwaAssets = generateStudioPwaAssets({
      outputDir,
      writeFiles: true
    });
  } else {
    const htmlContent = fs.readFileSync(targetFile, "utf-8");
    const titleMatch = htmlContent.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "HTML Report";
    pwaAssets = generatePwaAssets({
      outputDir,
      reportFileName: targetFileName,
      title,
      includeCoreCdn: true,
      writeFiles: true
    });
  }

  console.log(`[html-install] ✓ Generated manifest: ${path.relative(REPO_ROOT, pwaAssets.manifestPath)}`);
  console.log(`[html-install] ✓ Generated service worker: ${path.relative(REPO_ROOT, pwaAssets.swPath)}`);
  console.log(`[html-install] ✓ Generated application icon: ${path.relative(REPO_ROOT, pwaAssets.iconPath)}`);

  // 2. Ensure PWA tags & SW registration script are injected into target HTML
  const originalHtml = fs.readFileSync(targetFile, "utf-8");
  const enrichedHtml = injectPwaIntoHtml(originalHtml, {
    manifestHref: "manifest.webmanifest",
    iconHref: "icon.svg",
    swHref: "./sw.js",
    title: isStudio ? "HTML Report Creation Studio" : undefined
  });

  if (enrichedHtml !== originalHtml) {
    fs.writeFileSync(targetFile, enrichedHtml, "utf-8");
    console.log(`[html-install] ✓ Injected PWA tags into ${targetFileName}`);
  }

  // 3. Port Allocation & Dev Server Launch
  const desiredPort = options.port || 3030;
  const isAlreadyActive = await checkServerRunning(desiredPort, `/${targetFileName}`);

  let activePort = desiredPort;
  if (!isAlreadyActive) {
    activePort = await findAvailablePort(desiredPort);
    if (activePort !== desiredPort) {
      console.log(`[html-install] Notice: Port ${desiredPort} in use, auto-selected port ${activePort}`);
    }

    const serveScript = path.resolve(__dirname, "serve-report.mjs");
    const serverProcess = spawn(process.execPath, [
      serveScript,
      targetFile,
      "--port",
      String(activePort),
      "--no-open"
    ], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, HTML_REPORT_NO_OPEN: "1" }
    });
    serverProcess.unref();

    // Wait brief interval for server socket to bind
    await new Promise((r) => setTimeout(r, 350));
  } else {
    console.log(`[html-install] ✓ Dev server already active on port ${activePort}`);
  }

  const appUrl = `http://localhost:${activePort}/${targetFileName}`;
  console.log(`\n======================================================`);
  console.log(` 🚀 PWA Ready for Installation!`);
  console.log(` URL:    ${appUrl}`);
  console.log(` Target: ${targetFileName}`);
  console.log(`\n To complete installation:`);
  console.log(`  1. Look for the [⬇ Install App] button in the navbar`);
  console.log(`  2. Or click the install icon (⊕) in the browser address bar`);
  console.log(`======================================================\n`);

  if (!options.noOpen) {
    openBrowser(appUrl);
  }

  return {
    targetFile,
    outputDir,
    activePort,
    appUrl,
    pwaAssets
  };
}

// Direct CLI invocation
const isDirectCli = process.argv[1] && (
  process.argv[1].endsWith("install-pwa.mjs") ||
  import.meta.url === fileURLToPath(import.meta.url)
);

if (isDirectCli) {
  const options = parseInstallArgs(process.argv.slice(2));
  if (options.help) {
    console.log(`
Usage: node install-pwa.mjs [file.html] [options]

Options:
  --port, -p <number>  Port to serve on (default: 3030, with auto-hunting fallback)
  --no-open            Do not open browser automatically
  -h, --help           Show this help message
`);
    process.exit(0);
  }

  installPwa(options)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`[html-install] Error: ${err.message}`);
      process.exit(1);
    });
}
