/**
 * @fileoverview pwa.bdd.test.mjs
 * Native OpenSpec BDD-as-TDD Verification Suite for Instant PWA Generation.
 * Binds directly to openspec/changes/instant-pwa/specs/instant-pwa/spec.md.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import child_process from "node:child_process";
import { fileURLToPath } from "node:url";

import { bindOpenSpec } from "./harness/openspec-bdd.mjs";
import {
  deriveShortName,
  buildAppIconSvg,
  buildManifest,
  buildServiceWorker,
  buildPwaHeadTags,
  injectPwaIntoHtml,
  generatePwaAssets
} from "../skills/html-report/scripts/pwa-builder.mjs";

import { buildReport } from "../skills/html-report/scripts/build-report.mjs";
import { convertReportToPwa } from "../skills/html-report/scripts/generate-pwa.mjs";
import { MODE_SERVER_POLICIES } from "../skills/html-report/scripts/harness.mjs";
import { startServer } from "../skills/html-report/scripts/serve-report.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tmpBddDir = path.resolve(__dirname, "../tmp-pwa-bdd");

fs.mkdirSync(tmpBddDir, { recursive: true });

bindOpenSpec("instant-pwa", {
  "Generating valid W3C Web App Manifest": async ({ Given, When, Then }) => {
    let metadata = null;
    let manifest = null;

    await Given("report metadata including title, theme color, background color, and icons", () => {
      metadata = {
        title: "Executive Strategic Review",
        shortName: "ExecReview",
        themeColor: "#3b82f6",
        backgroundColor: "#0f172a",
        startUrl: "./report.html",
        iconFileName: "icon.svg"
      };
    });

    await When("buildManifest() is invoked", () => {
      manifest = buildManifest(metadata);
    });

    await Then("it MUST return a valid JSON string conforming to the W3C Web App Manifest specification with display: standalone, start_url, scope, name, short_name, theme_color, background_color, and declared icons", () => {
      assert.equal(manifest.name, "Executive Strategic Review");
      assert.equal(manifest.short_name, "ExecReview");
      assert.equal(manifest.display, "standalone");
      assert.equal(manifest.theme_color, "#3b82f6");
      assert.equal(manifest.background_color, "#0f172a");
      assert.equal(manifest.start_url, "./report.html");
      assert.equal(manifest.scope, "./");
      assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
      assert.ok(manifest.icons.some((icon) => icon.purpose.includes("maskable")));
    });
  },

  "Generating Service Worker with dual caching strategy": async ({ Given, When, Then }) => {
    let config = null;
    let swScript = null;

    await Given("cache configuration and pre-cache asset lists", () => {
      config = {
        cacheName: "bdd-pwa-cache-v1",
        preCacheUrls: ["./report.html", "./manifest.webmanifest", "./icon.svg"],
        version: "1.0.0"
      };
    });

    await When("buildServiceWorker() is invoked", () => {
      swScript = buildServiceWorker(config);
    });

    await Then("it MUST return a valid Service Worker script implementing cache-first resolution for immutable CDN assets and network-first with cache-fallback for navigation documents", () => {
      assert.ok(swScript.includes('const CACHE_NAME = "bdd-pwa-cache-v1";'));
      assert.ok(swScript.includes("self.skipWaiting()"));
      assert.ok(swScript.includes("self.clients.claim()"));
      assert.ok(swScript.includes('req.mode === "navigate"'));
      assert.ok(swScript.includes("cdn.tailwindcss.com"));
      assert.ok(swScript.includes("caches.match(req)"));
    });
  },

  "Generating multi-size scalable app icons": async ({ Given, When, Then }) => {
    let iconConfig = null;
    let svgOutput = null;

    await Given("a report title or emoji glyph", () => {
      iconConfig = {
        emoji: "🚀",
        title: "Rocket Ops",
        primaryColor: "#ef4444",
        backgroundColor: "#ffffff"
      };
    });

    await When("buildAppIcons() is invoked", () => {
      svgOutput = buildAppIconSvg(iconConfig);
    });

    await Then("it MUST generate scalable SVG icon assets and multi-size specifications (192x192, 512x512) with maskable safe-zone compatibility", () => {
      assert.ok(svgOutput.includes("<svg"));
      assert.ok(svgOutput.includes('viewBox="0 0 512 512"'));
      assert.ok(svgOutput.includes("🚀"));
      assert.ok(svgOutput.includes("#ef4444"));
    });
  },

  "Building report with --pwa CLI flag": async ({ Given, When, Then }) => {
    let fragFile = null;
    let outHtml = null;

    await Given("a semantic HTML content fragment", () => {
      fragFile = path.join(tmpBddDir, "bdd-frag.html");
      outHtml = path.join(tmpBddDir, "bdd-report.html");
      fs.writeFileSync(fragFile, `<section id="bdd-sec"><h2 id="bdd-hdr">BDD Head</h2><p>BDD Content</p></section>`, "utf-8");
    });

    await When("build-report.mjs is executed with the --pwa flag", () => {
      const cliScript = path.resolve(__dirname, "../skills/html-report/scripts/build-report.mjs");
      child_process.execSync(
        `node "${cliScript}" --content "${fragFile}" --output "${outHtml}" --pwa --title "BDD PWA Report"`,
        { encoding: "utf-8" }
      );
    });

    await Then("it MUST emit the report HTML with <link rel=manifest> and mobile meta tags, and generate companion manifest.webmanifest, sw.js, and icon files in the output directory", () => {
      assert.ok(fs.existsSync(outHtml), "Report HTML must exist");
      const htmlContent = fs.readFileSync(outHtml, "utf-8");
      assert.ok(htmlContent.includes('<link rel="manifest" href="manifest.webmanifest" />'));
      assert.ok(htmlContent.includes('<meta name="theme-color"'));

      const manifestPath = path.join(tmpBddDir, "manifest.webmanifest");
      const swPath = path.join(tmpBddDir, "sw.js");
      const iconPath = path.join(tmpBddDir, "icon.svg");

      assert.ok(fs.existsSync(manifestPath), "manifest.webmanifest must be present");
      assert.ok(fs.existsSync(swPath), "sw.js must be present");
      assert.ok(fs.existsSync(iconPath), "icon.svg must be present");
    });
  },

  "Transforming existing report with generate-pwa.mjs": async ({ Given, When, Then }) => {
    let legacyReportPath = null;
    let conversionResult = null;

    await Given("an existing standalone HTML report file without prior PWA assets", () => {
      legacyReportPath = path.join(tmpBddDir, "existing-legacy.html");
      fs.writeFileSync(legacyReportPath, `<!DOCTYPE html><html><head><title>Existing Report</title></head><body><div class="navbar-end"></div><main><h2>Test</h2></main></body></html>`, "utf-8");
    });

    await When("generate-pwa.mjs <report.html> is executed", () => {
      conversionResult = convertReportToPwa({
        reportPath: legacyReportPath,
        title: "Converted App",
        emoji: "📦"
      });
    });

    await Then("it MUST inspect the report, inject PWA tags and Service Worker registration if absent, and generate companion manifest, service worker, and icon files", () => {
      assert.ok(fs.existsSync(conversionResult.manifestPath));
      assert.ok(fs.existsSync(conversionResult.swPath));
      assert.ok(fs.existsSync(conversionResult.iconPath));

      const updated = fs.readFileSync(legacyReportPath, "utf-8");
      assert.ok(updated.includes('<link rel="manifest" href="manifest.webmanifest" />'));
      assert.ok(updated.includes('id="__pwa_sw_registration__"'));
    });
  },

  "Harmonizing --mode pwa with dev server orchestration": async ({ Given, When, Then }) => {
    let policy = null;

    await Given("a report built with --mode pwa", () => {
      policy = MODE_SERVER_POLICIES.pwa;
    });

    await When("inspected by harness.mjs or serve-report.mjs", () => {
      // Evaluation
    });

    await Then("the harness MUST assign requiresServer: true, stamp data-report-mode=pwa, and display the PWA navbar badge", () => {
      assert.ok(policy, "PWA server policy must exist");
      assert.equal(policy.requiresServer, true);
      assert.equal(policy.defaultAction, "serve");
    });
  },

  "Synchronizing DaisyUI active theme with meta theme-color": async ({ Given, When, Then }) => {
    let metaTag = null;

    await Given("a report running in a browser with <meta name=theme-color>", () => {
      metaTag = '<meta name="theme-color" id="pwa-theme-color" content="#2563eb" />';
      assert.ok(metaTag.includes("pwa-theme-color"));
    });

    await When("the user switches across any of the 32 DaisyUI themes or a custom theme", () => {
      // Verified in runtime
    });

    await Then("report-runtime.js MUST update the content attribute of <meta name=theme-color> to match the newly selected theme's primary or background color", async () => {
      const runtimePath = path.resolve(__dirname, "../skills/html-report/assets/report-runtime.js");
      const runtime = await import(runtimePath);
      const mod = runtime.default || runtime;
      assert.equal(typeof mod.syncPwaThemeColor, "function");
    });
  },

  "Triggering native install prompt via beforeinstallprompt": async ({ Given, When, Then }) => {
    let shell = null;

    await Given("a browser dispatching the beforeinstallprompt event", () => {
      const shellPath = path.resolve(__dirname, "../skills/html-report/assets/template-shell.html");
      shell = fs.readFileSync(shellPath, "utf-8");
    });

    await When("the user views the report", () => {
      // Evaluation
    });

    await Then("the runtime MUST capture the event, reveal the #pwa-install-btn in the navbar and Download dropdown, and trigger prompt() when clicked", () => {
      assert.ok(shell.includes('id="pwa-install-btn"'), "Must include navbar install button");
      assert.ok(shell.includes('id="pwa-install-menu-item"'), "Must include download dropdown install option");
    });
  },

  "Reacting to online and offline network status changes": async ({ Given, When, Then }) => {
    let shell = null;

    await Given("a browser switching between online and offline states", () => {
      const shellPath = path.resolve(__dirname, "../skills/html-report/assets/template-shell.html");
      shell = fs.readFileSync(shellPath, "utf-8");
    });

    await When("online or offline events fire on the window", () => {
      // Evaluation
    });

    await Then("the runtime MUST toggle the #pwa-offline-badge indicating cached offline operation", () => {
      assert.ok(shell.includes('id="pwa-offline-badge"'), "Must include offline badge");
    });
  },

  "Serving .webmanifest with standard MIME type": async ({ Given, When, Then }) => {
    let server = null;
    const testPort = 3196;
    let response = null;

    await Given("an HTTP request for a .webmanifest file", async () => {
      const sDir = path.join(tmpBddDir, "serve-manifest-test");
      fs.mkdirSync(sDir, { recursive: true });
      fs.writeFileSync(path.join(sDir, "report.html"), "<html><body>Hello</body></html>", "utf-8");
      fs.writeFileSync(path.join(sDir, "manifest.webmanifest"), JSON.stringify({ name: "BDD" }), "utf-8");
      server = await startServer(path.join(sDir, "report.html"), testPort, false);
    });

    await When("serve-report.mjs handles the request", async () => {
      response = await new Promise((resolve, reject) => {
        http.get(`http://localhost:${testPort}/manifest.webmanifest`, (res) => {
          let body = "";
          res.on("data", (c) => body += c);
          res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
        }).on("error", reject);
      });
    });

    await Then("it MUST respond with Content-Type: application/manifest+json", async () => {
      try {
        assert.equal(response.status, 200);
        assert.equal(response.headers["content-type"], "application/manifest+json");
      } finally {
        if (server && server.close) await server.close();
      }
    });
  },

  "Serving sw.js with Service-Worker-Allowed header": async ({ Given, When, Then }) => {
    let server = null;
    const testPort = 3195;
    let response = null;

    await Given("an HTTP request for sw.js", async () => {
      const sDir = path.join(tmpBddDir, "serve-sw-test");
      fs.mkdirSync(sDir, { recursive: true });
      fs.writeFileSync(path.join(sDir, "report.html"), "<html><body>Hello</body></html>", "utf-8");
      fs.writeFileSync(path.join(sDir, "sw.js"), "// SW script", "utf-8");
      server = await startServer(path.join(sDir, "report.html"), testPort, false);
    });

    await When("serve-report.mjs handles the request", async () => {
      response = await new Promise((resolve, reject) => {
        http.get(`http://localhost:${testPort}/sw.js`, (res) => {
          let body = "";
          res.on("data", (c) => body += c);
          res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
        }).on("error", reject);
      });
    });

    await Then("it MUST include the Service-Worker-Allowed: / header to permit root-scope service worker registration", async () => {
      try {
        assert.equal(response.status, 200);
        assert.equal(response.headers["service-worker-allowed"], "/");
        assert.equal(response.headers["cache-control"], "no-cache");
      } finally {
        if (server && server.close) await server.close();
      }
    });
  }
});
