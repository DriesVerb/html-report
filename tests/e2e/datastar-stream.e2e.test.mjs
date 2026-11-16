import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildReportPath = path.resolve(__dirname, "../../skills/html-report/scripts/build-report.mjs");
const playwrightPath = path.resolve(__dirname, "../../packages/core/playwright/node_modules/playwright/index.mjs");

const { buildReport } = await import(buildReportPath);
const { chromium } = await import(playwrightPath);

describe("Post-Morph Lucide Icon Rehydration (Headless Playwright E2E)", () => {
  it("should auto-rehydrate Lucide icons post-morph via MutationObserver", async () => {
    const testContent = `
      <div id="live-container" class="p-6">
        <h2 id="live-header">Live Telemetry Observer</h2>
        <div id="tool-call-feed" class="space-y-2">
          <div id="initial-tool" class="p-2 border border-base-300">
            <i data-lucide="cpu" id="initial-icon"></i>
          </div>
        </div>
      </div>
    `;

    const { html } = buildReport({
      title: "Icon Rehydration Test",
      content: testContent,
      live: true
    });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "datastar-e2e-"));
    const tempFile = path.join(tmpDir, "rehydration-test.html");
    fs.writeFileSync(tempFile, html, "utf-8");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      await page.goto("file://" + tempFile, { waitUntil: "load" });
      await page.waitForTimeout(500);

      // Verify initial icon is hydrated to SVG
      const initialSvgCount = await page.locator("#tool-call-feed svg").count();
      assert.ok(initialSvgCount >= 1, "Initial Lucide icon must be hydrated to SVG");

      // Simulate Datastar morphing a new tool card into #tool-call-feed
      await page.evaluate(() => {
        const feed = document.getElementById("tool-call-feed");
        const morphedCard = document.createElement("div");
        morphedCard.id = "morphed-card-1";
        morphedCard.innerHTML = `
          <div class="flex items-center gap-2">
            <i data-lucide="check-circle" id="morphed-icon-check" class="text-success w-4 h-4"></i>
            <span>Morphed Task Completed</span>
          </div>
        `;
        feed.appendChild(morphedCard);
      });

      // Wait 100ms for debounce & MutationObserver in report-runtime.js
      await page.waitForTimeout(150);

      // Verify newly morphed icon has been replaced/hydrated into an SVG
      const hasSvgIcon = await page.evaluate(() => {
        const card = document.getElementById("morphed-card-1");
        return Boolean(card && card.querySelector("svg"));
      });

      assert.equal(hasSvgIcon, true, "Morphed element's data-lucide icon must be rehydrated to an SVG element");
    } finally {
      await browser.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
