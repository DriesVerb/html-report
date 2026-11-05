import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import child_process from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  deriveShortName,
  buildAppIconSvg,
  buildManifest,
  buildServiceWorker,
  buildPwaHeadTags,
  injectPwaIntoHtml,
  generatePwaAssets,
  DEFAULT_PWA_CONFIG
} from "../skills/html-report/scripts/pwa-builder.mjs";

import {
  parseArgs as parseBuildArgs,
  buildReport
} from "../skills/html-report/scripts/build-report.mjs";

import {
  parseCliArgs as parsePwaArgs,
  extractHtmlMetadata,
  convertReportToPwa
} from "../skills/html-report/scripts/generate-pwa.mjs";

import { startServer } from "../skills/html-report/scripts/serve-report.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tmpDir = path.resolve(__dirname, "../tmp-pwa-tests");

before(() => {
  fs.mkdirSync(tmpDir, { recursive: true });
});

after(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_) {}
});

describe("PWA Builder Core (pwa-builder.mjs)", () => {
  it("deriveShortName handles various title lengths and formats", () => {
    assert.equal(deriveShortName("Short"), "Short");
    assert.equal(deriveShortName("Executive Analytics Dashboard"), "Executive");
    assert.equal(deriveShortName("Supercalifragilisticexpialidocious"), "Supercalifragili");
    assert.equal(deriveShortName(""), "Report");
    assert.equal(deriveShortName(null), "Report");
  });

  it("buildAppIconSvg generates valid scalable SVG with gradient and emoji", () => {
    const svg = buildAppIconSvg({
      emoji: "🚀",
      title: "Field App",
      primaryColor: "#10b981",
      backgroundColor: "#111827"
    });

    assert.ok(svg.includes("<svg"), "Must produce an SVG tag");
    assert.ok(svg.includes('viewBox="0 0 512 512"'), "Must have standard 512x512 viewBox");
    assert.ok(svg.includes("#10b981"), "Must include primary color stop");
    assert.ok(svg.includes("#111827"), "Must include background fill");
    assert.ok(svg.includes("🚀"), "Must include emoji glyph");
  });

  it("buildManifest creates a compliant W3C Web App Manifest", () => {
    const manifest = buildManifest({
      title: "Quarterly Financial Overview",
      shortName: "FinReport",
      themeColor: "#2563eb",
      backgroundColor: "#ffffff",
      startUrl: "./report.html",
      iconFileName: "icon.svg"
    });

    assert.equal(manifest.name, "Quarterly Financial Overview");
    assert.equal(manifest.short_name, "FinReport");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.theme_color, "#2563eb");
    assert.equal(manifest.background_color, "#ffffff");
    assert.equal(manifest.start_url, "./report.html");
    assert.ok(Array.isArray(manifest.icons), "Manifest icons must be an array");
    assert.ok(manifest.icons.some((i) => i.src === "icon.svg" && i.purpose.includes("maskable")));
    assert.ok(Array.isArray(manifest.shortcuts), "Manifest shortcuts must be an array");
    assert.ok(manifest.shortcuts.some((s) => s.name === "Table of Contents"));
  });

  it("buildServiceWorker outputs caching rules with CDN cache-first and document network-first", () => {
    const sw = buildServiceWorker({
      cacheName: "test-cache-v1",
      preCacheUrls: ["./report.html", "./manifest.webmanifest"],
      version: "1.2.3"
    });

    assert.ok(sw.includes('const CACHE_NAME = "test-cache-v1";'), "Must include cache name");
    assert.ok(sw.includes("self.skipWaiting()"), "Must call skipWaiting");
    assert.ok(sw.includes("self.clients.claim()"), "Must call clients.claim");
    assert.ok(sw.includes("cdn.tailwindcss.com"), "Must list immutable CDN hosts");
    assert.ok(sw.includes('req.mode === "navigate"'), "Must handle navigation requests separately");
    assert.ok(sw.includes("/__live_reload__"), "Must bypass live-reload stream");
    assert.ok(sw.includes("/__datastar_stream__"), "Must bypass Datastar SSE stream");
  });

  it("buildPwaHeadTags outputs manifest link, mobile tags, and theme-color", () => {
    const tags = buildPwaHeadTags({
      manifestHref: "manifest.webmanifest",
      themeColor: "#8b5cf6",
      iconHref: "icon.svg",
      title: "Health Metrics"
    });

    assert.ok(tags.includes('<link rel="manifest" href="manifest.webmanifest" />'));
    assert.ok(tags.includes('<meta name="theme-color" id="pwa-theme-color" content="#8b5cf6" />'));
    assert.ok(tags.includes('<meta name="apple-mobile-web-app-capable" content="yes" />'));
    assert.ok(tags.includes('<link rel="apple-touch-icon" href="icon.svg" />'));
  });

  it("injectPwaIntoHtml injects tags, install affordances, and SW registration", () => {
    const sampleHtml = `<!DOCTYPE html>
<html>
<head><title>My Report</title></head>
<body>
  <div class="navbar"><div class="navbar-end"></div></div>
  <ul id="download-dropdown-menu"><li><button id="download-html-btn">HTML</button></li></ul>
</body>
</html>`;

    const injected = injectPwaIntoHtml(sampleHtml, {
      manifestHref: "manifest.webmanifest",
      themeColor: "#2563eb",
      title: "My Report"
    });

    assert.ok(injected.includes('<link rel="manifest" href="manifest.webmanifest" />'));
    assert.ok(injected.includes('id="pwa-install-btn"'), "Must inject navbar install button");
    assert.ok(injected.includes('id="pwa-offline-badge"'), "Must inject offline badge");
    assert.ok(injected.includes('id="pwa-install-menu-item"'), "Must inject download menu install button");
    assert.ok(injected.includes('id="__pwa_sw_registration__"'), "Must inject SW registration script");
    assert.ok(injected.includes("beforeinstallprompt"), "Must wire beforeinstallprompt");
  });

  it("generatePwaAssets writes manifest, service worker, and icon to disk", () => {
    const assetsDir = path.join(tmpDir, "assets-run");
    const result = generatePwaAssets({
      outputDir: assetsDir,
      reportFileName: "index.html",
      title: "Asset Test App",
      shortName: "AssetApp",
      themeColor: "#ec4899",
      emoji: "🧪",
      writeFiles: true
    });

    assert.ok(fs.existsSync(result.manifestPath), "manifest.webmanifest must exist on disk");
    assert.ok(fs.existsSync(result.swPath), "sw.js must exist on disk");
    assert.ok(fs.existsSync(result.iconPath), "icon.svg must exist on disk");

    const manifestContent = JSON.parse(fs.readFileSync(result.manifestPath, "utf-8"));
    assert.equal(manifestContent.name, "Asset Test App");
    assert.equal(manifestContent.theme_color, "#ec4899");

    const iconContent = fs.readFileSync(result.iconPath, "utf-8");
    assert.ok(iconContent.includes("🧪"));
  });
});

describe("build-report.mjs PWA Integration", () => {
  it("parseArgs recognizes --pwa and PWA customization flags", () => {
    const opts = parseBuildArgs([
      "node",
      "build-report.mjs",
      "--content",
      "frag.html",
      "--pwa",
      "--pwa-name",
      "Executive Dashboard",
      "--pwa-short-name",
      "ExecDash",
      "--pwa-theme-color",
      "#059669",
      "--pwa-bg-color",
      "#0f172a",
      "--pwa-icon",
      "📈"
    ]);

    assert.equal(opts.pwa, true);
    assert.equal(opts.pwaName, "Executive Dashboard");
    assert.equal(opts.pwaShortName, "ExecDash");
    assert.equal(opts.pwaThemeColor, "#059669");
    assert.equal(opts.pwaBgColor, "#0f172a");
    assert.equal(opts.pwaIcon, "📈");
  });

  it("buildReport injects PWA head tags and returns pwaConfig when pwa=true", () => {
    const fragment = `<section id="sec"><h2 id="summary">Summary</h2><p>Data</p></section>`;
    const result = buildReport({
      title: "Telemetry PWA",
      content: fragment,
      pwa: true,
      pwaThemeColor: "#f59e0b"
    });

    assert.equal(result.isPwa, true);
    assert.ok(result.html.includes('<link rel="manifest" href="manifest.webmanifest" />'));
    assert.ok(result.html.includes('content="#f59e0b"'));
    assert.ok(result.pwaConfig !== null);
    assert.equal(result.pwaConfig.themeColor, "#f59e0b");
  });

  it("CLI generates report and companion PWA assets when --pwa is passed", () => {
    const fragPath = path.join(tmpDir, "pwa-cli-frag.html");
    const outHtml = path.join(tmpDir, "pwa-cli-report.html");
    fs.writeFileSync(fragPath, `<section id="pwa-sec"><h2 id="pwa-hdr">PWA Section</h2></section>`, "utf-8");

    const cliScript = path.resolve(__dirname, "../skills/html-report/scripts/build-report.mjs");
    const cmd = `node "${cliScript}" --content "${fragPath}" --output "${outHtml}" --pwa --title "CLI PWA Report" --pwa-icon "⚡"`;
    child_process.execSync(cmd, { encoding: "utf-8" });

    assert.ok(fs.existsSync(outHtml), "report HTML must be written");
    const manifestPath = path.join(tmpDir, "manifest.webmanifest");
    const swPath = path.join(tmpDir, "sw.js");
    const iconPath = path.join(tmpDir, "icon.svg");

    assert.ok(fs.existsSync(manifestPath), "companion manifest.webmanifest must be written");
    assert.ok(fs.existsSync(swPath), "companion sw.js must be written");
    assert.ok(fs.existsSync(iconPath), "companion icon.svg must be written");

    const manifestObj = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    assert.equal(manifestObj.name, "CLI PWA Report");
    const iconContent = fs.readFileSync(iconPath, "utf-8");
    assert.ok(iconContent.includes("⚡"));
  });
});

describe("generate-pwa.mjs Standalone Converter CLI", () => {
  it("parseCliArgs parses all converter options", () => {
    const opts = parsePwaArgs([
      "node",
      "generate-pwa.mjs",
      "existing.html",
      "--title",
      "Custom Title",
      "--short-name",
      "Short",
      "--theme-color",
      "#ef4444",
      "--bg-color",
      "#fef2f2",
      "--emoji",
      "🎯",
      "--dry-run"
    ]);

    assert.equal(opts.inputFile, "existing.html");
    assert.equal(opts.title, "Custom Title");
    assert.equal(opts.shortName, "Short");
    assert.equal(opts.themeColor, "#ef4444");
    assert.equal(opts.backgroundColor, "#fef2f2");
    assert.equal(opts.emoji, "🎯");
    assert.equal(opts.dryRun, true);
  });

  it("extractHtmlMetadata extracts title and favicon emoji from existing HTML", () => {
    const htmlWithEmoji = `<!DOCTYPE html><html><head><title>Existing Report Title</title><link rel="icon" href="data:image/svg+xml,%3Csvg%3E%3Ctext font-size=%2290%22%3E📊%3C/text%3E%3C/svg%3E" /></head><body></body></html>`;
    const meta = extractHtmlMetadata(htmlWithEmoji);
    assert.equal(meta.title, "Existing Report Title");
    assert.equal(meta.emoji, "📊");
  });

  it("convertReportToPwa converts existing HTML file into complete PWA", () => {
    const reportDir = path.join(tmpDir, "converter-run");
    fs.mkdirSync(reportDir, { recursive: true });
    const existingHtmlPath = path.join(reportDir, "legacy-report.html");
    fs.writeFileSync(existingHtmlPath, `<!DOCTYPE html>
<html>
<head><title>Legacy Operational Audit</title></head>
<body>
  <div class="navbar"><div class="navbar-end"></div></div>
  <main><h2 id="audit">Audit Log</h2></main>
</body>
</html>`, "utf-8");

    const result = convertReportToPwa({
      reportPath: existingHtmlPath,
      title: "Operational Audit App",
      emoji: "🛡️"
    });

    assert.equal(result.title, "Operational Audit App");
    assert.ok(fs.existsSync(result.manifestPath), "manifest must exist");
    assert.ok(fs.existsSync(result.swPath), "sw.js must exist");
    assert.ok(fs.existsSync(result.iconPath), "icon.svg must exist");

    const updatedHtml = fs.readFileSync(existingHtmlPath, "utf-8");
    assert.ok(updatedHtml.includes('<link rel="manifest" href="manifest.webmanifest" />'));
    assert.ok(updatedHtml.includes('id="pwa-install-btn"'));
    assert.ok(updatedHtml.includes('id="__pwa_sw_registration__"'));
  });
});

describe("serve-report.mjs PWA Server Integration", () => {
  let serverInstance = null;
  const serverPort = 3197;

  before(async () => {
    const serverDir = path.join(tmpDir, "server-pwa");
    fs.mkdirSync(serverDir, { recursive: true });
    const reportFile = path.join(serverDir, "test-pwa.html");
    const manifestFile = path.join(serverDir, "manifest.webmanifest");
    const swFile = path.join(serverDir, "sw.js");

    fs.writeFileSync(reportFile, `<!DOCTYPE html><html><head><title>Server PWA</title></head><body><h1>PWA</h1></body></html>`, "utf-8");
    fs.writeFileSync(manifestFile, JSON.stringify({ name: "Server PWA" }), "utf-8");
    fs.writeFileSync(swFile, `// Service Worker`, "utf-8");

    serverInstance = await startServer(reportFile, serverPort, false);
  });

  after(async () => {
    if (serverInstance && typeof serverInstance.close === "function") {
      await serverInstance.close();
    }
  });

  function getUrl(urlPath) {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:${serverPort}${urlPath}`, (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
      }).on("error", reject);
    });
  }

  it("serves .webmanifest with application/manifest+json MIME type", async () => {
    const res = await getUrl("/manifest.webmanifest");
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["content-type"], "application/manifest+json");
    assert.ok(res.body.includes("Server PWA"));
  });

  it("serves sw.js with Service-Worker-Allowed header set to /", async () => {
    const res = await getUrl("/sw.js");
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["service-worker-allowed"], "/");
    assert.equal(res.headers["cache-control"], "no-cache");
    assert.ok(res.body.includes("Service Worker"));
  });
});

describe("report-runtime.js PWA Client Bindings", () => {
  it("exports syncPwaThemeColor and initPwa functions", async () => {
    const runtimePath = path.resolve(__dirname, "../skills/html-report/assets/report-runtime.js");
    const runtime = await import(runtimePath);
    const mod = runtime.default || runtime;

    assert.equal(typeof mod.syncPwaThemeColor, "function");
    assert.equal(typeof mod.initPwa, "function");
  });
});
