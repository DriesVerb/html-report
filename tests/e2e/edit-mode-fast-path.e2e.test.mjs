import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const playwrightPath = path.join(REPO_ROOT, "packages/core/playwright/node_modules/playwright/index.mjs");
const { chromium } = await import(pathToFileURL(playwrightPath).href);

import { scaffoldProject } from "../../skills/html-report/scripts/scaffold-project.mjs";
import { startServer } from "../../skills/html-report/scripts/serve-report.mjs";

describe("Edit Mode Fast Path — Playwright E2E", () => {
  let tmpRoot;
  let serverHandle;
  let baseUrl;

  const sampleFragment = [
    '<main id="report-main" class="container mx-auto px-4 py-8 space-y-6">',
    '  <section id="overview" class="card bg-base-100 p-6">',
    '    <h1 id="hero-title" class="text-2xl font-bold">Q4 Revenue</h1>',
    '    <p id="hero-sub" class="text-sm">Old subtitle</p>',
    '  </section>',
    '  <section id="details" class="card bg-base-100 p-6">',
    '    <h2 id="details-heading" class="text-xl font-semibold">Details</h2>',
    '    <p id="details-copy">Unchanged body text.</p>',
    '  </section>',
    '</main>'
  ].join("\n");

  before(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "edit-mode-e2e-"));
    fs.writeFileSync(
      path.join(tmpRoot, "implementation-progress.html"),
      '<!DOCTYPE html><html><head><title>Root Stub</title></head><body><main id="report-main"><h1>Root</h1></main></body></html>',
      "utf-8"
    );

    scaffoldProject({
      project: "edit-demo",
      title: "Edit Demo Report",
      mode: "report",
      theme: "light",
      ai: true,
      aiModel: "gemini-2.5-flash",
      content: sampleFragment,
      rootDir: tmpRoot,
      workspaceRoot: tmpRoot
    });

    serverHandle = await startServer(
      path.join(tmpRoot, "implementation-progress.html"),
      0,
      false
    );
    baseUrl = `http://127.0.0.1:${serverHandle.serverPort}`;
  });

  after(async () => {
    if (serverHandle) await serverHandle.close();
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("reads #agent-manifest in getPageInfo() and preserves hot-swap when #agent-manifest sections change", async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/projects/edit-demo/index.html`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(window.HTMLReportEdit && window.__REPORT_READY__));

      const info = await page.evaluate(() => window.HTMLReportEdit.getPageInfo());
      assert.equal(info.fragment, "projects/edit-demo/fragment.html");
      assert.equal(info.source, "projects/edit-demo/index.html");
      assert.equal(info.manifestPath, "projects/edit-demo/report.manifest.json");
      assert.equal(info.aiModel, "gemini-2.5-flash");

      const generated = await page.evaluate(() => {
        window.HTMLReportEdit.saveTasks([]);
        window.HTMLReportEdit.addTask({
          title: "Refine KPI",
          content: "Tighten copy",
          priority: 1,
          target: { id: "hero-sub", tag: "p" }
        });
        return window.HTMLReportEdit.generatePrompt();
      });
      assert.match(generated, /Semantic Fragment: projects\/edit-demo\/fragment\.html/);
      assert.match(generated, /Target Element: #hero-sub \(<p>\)/);

      await page.evaluate(() => { window.__HOT_SWAP_SENTINEL__ = "kept"; });

      const fragPath = path.join(tmpRoot, "projects/edit-demo/fragment.html");
      const curFrag = fs.readFileSync(fragPath, "utf-8");
      const nextFrag = curFrag.replace(
        "</main>",
        '  <section id="added-live"><h2 id="added-live-heading">Added Live Section</h2><p>Hot swapped!</p><script>window.__INLINE_HOT_RAN__ = "yes";</script></section>\n</main>'
      );
      fs.writeFileSync(fragPath, nextFrag, "utf-8");

      await page.waitForFunction(
        () => Boolean(document.getElementById("added-live-heading")),
        null,
        { timeout: 10000 }
      );

      const afterState = await page.evaluate(() => ({
        sentinel: window.__HOT_SWAP_SENTINEL__ || null,
        inlineRan: window.__INLINE_HOT_RAN__ || null,
        headingText: document.getElementById("added-live-heading")?.textContent,
        manifestSections: window.HTMLReportAgent.getManifest()?.sections?.map((s) => s.id) || []
      }));

      assert.equal(afterState.sentinel, "kept", "Must hot-swap <main> via Idiomorph without full page reload");
      assert.equal(afterState.inlineRan, "yes", "Changed <main> inline script must execute during hot-swap");
      assert.equal(afterState.headingText, "Added Live Section");
      assert.ok(afterState.manifestSections.includes("added-live"), "#agent-manifest must stay synced after hot-swap");
    } finally {
      await browser.close();
    }
  });
});
