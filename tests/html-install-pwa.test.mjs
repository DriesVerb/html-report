/**
 * @file html-install-pwa.test.mjs
 * Test suite for /html-install - PWA Packaging & Offline Creation Studio
 */

import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  generateStudioPwaAssets,
  CORE_CDN_PRECACHE_URLS,
  injectPwaIntoHtml
} from "../skills/html-report/scripts/pwa-builder.mjs";
import { parseInstallArgs } from "../skills/html-report/scripts/install-pwa.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const createHtmlPath = path.resolve(REPO_ROOT, "create.html");
const assetCreateHtmlPath = path.resolve(REPO_ROOT, "skills/html-report/assets/create.html");

describe("Feature Spec: /html-install — PWA Packaging & Studio Offline Installation", () => {
  describe("1. Studio PWA Asset Generation & Manifest Configuration", () => {
    it("generates valid W3C Web App Manifest with studio metadata", () => {
      const assets = generateStudioPwaAssets({ writeFiles: false });

      assert.ok(assets.manifestObj, "manifestObj should be defined");
      assert.equal(assets.manifestObj.name, "HTML Report Creation Studio");
      assert.equal(assets.manifestObj.short_name, "HTML Studio");
      assert.equal(assets.manifestObj.start_url, "./create.html");
      assert.equal(assets.manifestObj.display, "standalone");
      assert.ok(assets.manifestObj.categories.includes("productivity"));
      assert.ok(assets.manifestObj.categories.includes("developer"));
      assert.ok(assets.manifestObj.categories.includes("utilities"));
    });

    it("generates maskable vector SVG application icon", () => {
      const assets = generateStudioPwaAssets({ writeFiles: false });

      assert.ok(assets.iconSvg, "iconSvg should be generated");
      assert.ok(assets.iconSvg.includes("<svg"), "iconSvg should contain svg root");
      assert.ok(assets.iconSvg.includes("viewBox=\"0 0 512 512\""), "iconSvg should be 512x512");
      assert.ok(assets.iconSvg.includes("✨"), "iconSvg should contain sparkle glyph");
    });

    it("ensures repository root manifest.webmanifest and companion assets are studio-branded (not PokéLive)", () => {
      const rootManifestPath = path.resolve(REPO_ROOT, "manifest.webmanifest");
      const rootSwPath = path.resolve(REPO_ROOT, "sw.js");
      const rootIconPath = path.resolve(REPO_ROOT, "icon.svg");

      assert.ok(fs.existsSync(rootManifestPath), "Root manifest.webmanifest must exist");
      assert.ok(fs.existsSync(rootSwPath), "Root sw.js must exist");
      assert.ok(fs.existsSync(rootIconPath), "Root icon.svg must exist");

      const manifestContent = JSON.parse(fs.readFileSync(rootManifestPath, "utf-8"));
      assert.equal(manifestContent.name, "HTML Report Creation Studio");
      assert.equal(manifestContent.short_name, "HTML Studio");
      assert.equal(manifestContent.start_url, "./create.html");
      assert.ok(!manifestContent.name.includes("PokéLive"), "Root manifest must never be PokéLive");

      const swContent = fs.readFileSync(rootSwPath, "utf-8");
      assert.ok(swContent.includes("./create.html"), "Root sw.js must pre-cache create.html");
      assert.ok(!swContent.includes("./pokemon-live-report.html"), "Root sw.js must not pre-cache pokemon report");

      const iconContent = fs.readFileSync(rootIconPath, "utf-8");
      assert.ok(iconContent.includes("✨"), "Root icon.svg must contain sparkle emoji");
    });
  });

  describe("2. Offline Service Worker Pre-Caching Strategy", () => {
    it("includes critical CDN dependencies in pre-cache asset list", () => {
      const assets = generateStudioPwaAssets({ writeFiles: false });

      assert.ok(assets.swCode, "swCode should be defined");
      assert.ok(assets.swCode.includes("cdn.tailwindcss.com"), "SW should pre-cache Tailwind CDN");
      assert.ok(assets.swCode.includes("daisyui@4.12.14"), "SW should pre-cache DaisyUI CSS");
      assert.ok(assets.swCode.includes("lucide@0.460.0"), "SW should pre-cache Lucide icons");
      assert.ok(assets.swCode.includes("showdown@2.1.0"), "SW should pre-cache Showdown markdown parser");

      for (const cdnUrl of CORE_CDN_PRECACHE_URLS) {
        assert.ok(assets.swCode.includes(cdnUrl), `SW should include ${cdnUrl}`);
      }
    });

    it("pre-caches create.html and manifest files", () => {
      const assets = generateStudioPwaAssets({ writeFiles: false });

      assert.ok(assets.swCode.includes("./create.html"), "SW should pre-cache create.html");
      assert.ok(assets.swCode.includes("./manifest.webmanifest"), "SW should pre-cache manifest");
      assert.ok(assets.swCode.includes("./icon.svg"), "SW should pre-cache icon");
    });
  });

  describe("3. In-Studio Installation UI & Theme Color Sync", () => {
    it("create.html and asset create.html contain responsive #pwa-install-btn and status badge", () => {
      const rootHtml = fs.readFileSync(createHtmlPath, "utf-8");
      const assetHtml = fs.readFileSync(assetCreateHtmlPath, "utf-8");

      for (const [name, content] of [["root create.html", rootHtml], ["asset create.html", assetHtml]]) {
        assert.ok(content.includes('id="pwa-install-btn"'), `${name} missing #pwa-install-btn`);
        assert.ok(content.includes('id="pwa-install-status-badge"'), `${name} missing #pwa-install-status-badge`);
        assert.ok(content.includes('id="pwa-offline-badge"'), `${name} missing #pwa-offline-badge`);
        assert.ok(content.includes('id="pwa-install-dropdown-btn"'), `${name} missing #pwa-install-dropdown-btn`);
      }
    });

    it("wires beforeinstallprompt event, triggerPwaInstall(), and theme color observer", () => {
      const rootHtml = fs.readFileSync(createHtmlPath, "utf-8");

      assert.ok(rootHtml.includes("beforeinstallprompt"), "create.html missing beforeinstallprompt listener");
      assert.ok(rootHtml.includes("triggerPwaInstall"), "create.html missing triggerPwaInstall function");
      assert.ok(rootHtml.includes("appinstalled"), "create.html missing appinstalled listener");
      assert.ok(rootHtml.includes('id="pwa-theme-color"'), "create.html missing pwa-theme-color meta tag");
      assert.ok(rootHtml.includes("syncThemeColorMeta"), "create.html missing syncThemeColorMeta");
    });
  });

  describe("4. Installer Script & CLI Options", () => {
    it("parses zero-argument invocation with default port 3030", () => {
      const opts = parseInstallArgs([], {});
      assert.equal(opts.target, null, "Default target should be null (resolves to create.html)");
      assert.equal(opts.port, 3030, "Default port should be 3030");
      assert.equal(opts.noOpen, false, "noOpen should default to false");
    });

    it("parses explicit file target, custom port, and flags", () => {
      const opts = parseInstallArgs(["my-custom-report.html", "--port", "3045", "--no-open"]);
      assert.equal(opts.target, "my-custom-report.html");
      assert.equal(opts.port, 3045);
      assert.equal(opts.noOpen, true);
    });
  });

  describe("5. HTML Injector Utilities", () => {
    it("injects PWA head tags, navbar buttons, and registration script into clean HTML", () => {
      const sampleHtml = `<!DOCTYPE html>
<html>
<head><title>Test Report</title></head>
<body>
  <div class="navbar-end"></div>
  <ul id="download-dropdown-menu"></ul>
</body>
</html>`;

      const injected = injectPwaIntoHtml(sampleHtml, {
        title: "Test Report",
        manifestHref: "manifest.webmanifest"
      });

      assert.ok(injected.includes('rel="manifest"'), "Injected HTML missing manifest link");
      assert.ok(injected.includes('id="pwa-theme-color"'), "Injected HTML missing theme-color meta");
      assert.ok(injected.includes('id="pwa-install-btn"'), "Injected HTML missing navbar install button");
      assert.ok(injected.includes('id="pwa-install-dropdown-btn"'), "Injected HTML missing dropdown install button");
      assert.ok(injected.includes("__pwa_sw_registration__"), "Injected HTML missing SW registration snippet");
    });
  });
});
