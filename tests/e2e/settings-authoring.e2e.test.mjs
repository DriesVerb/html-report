import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { scaffoldProject } from "../../skills/html-report/scripts/scaffold-project.mjs";
import { startServer } from "../../skills/html-report/scripts/serve-report.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("E2E: Settings Authoring Queue, OKLCH Live Style & Reset", () => {
  let tmpRoot;
  let serverHandle;
  let baseUrl;

  before(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "edit-style-e2e-"));
    const frag = [
      '<main id="report-main" class="container mx-auto px-4 py-8 space-y-6">',
      '  <section id="sec-alpha" class="card bg-base-100 p-6">',
      '    <h2 id="alpha-title" class="text-xl font-bold">Alpha Section</h2>',
      '    <p id="alpha-copy">Initial alpha copy.</p>',
      '  </section>',
      '  <section id="sec-beta" class="card bg-base-100 p-6">',
      '    <h2 id="beta-title" class="text-xl font-bold">Beta Section</h2>',
      '    <p id="beta-copy">Initial beta copy.</p>',
      '  </section>',
      '</main>'
    ].join("\n");

    scaffoldProject({
      project: "style-demo",
      title: "Style Demo Report",
      mode: "report",
      theme: "light",
      ai: false,
      content: frag,
      rootDir: tmpRoot,
      workspaceRoot: tmpRoot
    });

    fs.writeFileSync(
      path.join(tmpRoot, "implementation-progress.html"),
      '<!DOCTYPE html><html><head><title>Root</title></head><body><main id="report-main"><h1>Root</h1></main></body></html>',
      "utf-8"
    );

    serverHandle = await startServer(path.join(tmpRoot, "implementation-progress.html"), 0, false);
    baseUrl = `http://127.0.0.1:${serverHandle.server.address().port}`;
  });

  after(async () => {
    if (serverHandle?.server) {
      await new Promise((r) => serverHandle.server.close(r));
    }
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("supports full browser Queue-to-Compose re-edit, Styling OKLCH live edit + Set as Default, and Reset", async () => {
    const playwrightPath = path.resolve(__dirname, "../../packages/core/playwright/node_modules/playwright/index.mjs");
    const { chromium } = await import(pathToFileURL(playwrightPath).href);
    const browser = await chromium.launch();
    try {
      const ctx1 = await browser.newContext();
      const page = await ctx1.newPage();
      await page.goto(`${baseUrl}/projects/style-demo/index.html`, { waitUntil: "domcontentloaded" });

      await page.evaluate(() => {
        window.HTMLReportEdit._currentSection = { id: "sec-alpha", label: "Alpha Section" };
        window.HTMLReportEdit.openDock({ expand: true, tab: "compose" });
      });
      await page.fill("#edit-task-title", "Initial Task");
      await page.fill("#edit-task-content", "Initial body");
      await page.selectOption("#edit-task-priority", "1");
      await page.click("#edit-add-btn");

      await page.click("#edit-tab-queue");
      await page.waitForSelector("#edit-queue-list li[data-task-id]");
      const anchorBadgeText = await page.textContent("#edit-queue-list [data-anchor-jump='sec-alpha']");
      assert.match(anchorBadgeText, /§ Alpha Section/);

      await page.click("#edit-queue-list li[data-task-id]");
      assert.equal(await page.inputValue("#edit-task-title"), "Initial Task");
      assert.equal(await page.inputValue("#edit-task-content"), "Initial body");
      assert.equal(await page.textContent("#edit-add-btn"), "Save");
      assert.equal(await page.isVisible("#edit-cancel-edit-btn"), true);

      await page.fill("#edit-task-title", "Revised Task");
      await page.click("#edit-add-btn");
      await page.waitForSelector("#edit-pane-queue:not(.hidden)");
      const rowCount = await page.locator("#edit-queue-list li[data-task-id]").count();
      assert.equal(rowCount, 1);
      assert.match(await page.textContent("#edit-queue-list li[data-task-id]"), /Revised Task/);

      await page.click("#edit-queue-list [data-anchor-jump='sec-alpha']");
      assert.equal(await page.isVisible("#edit-pane-queue"), true);
      const outlineStyle = await page.evaluate(() => document.getElementById("sec-alpha").style.outline);
      assert.match(outlineStyle, /2px/);
      assert.match(outlineStyle, /solid/);

      await page.click('#edit-queue-list button[aria-label="Edit task"]');
      assert.equal(await page.textContent("#edit-add-btn"), "Save");
      await page.click("#edit-cancel-edit-btn");
      assert.equal(await page.textContent("#edit-add-btn"), "Add");
      assert.equal(await page.isVisible("#edit-cancel-edit-btn"), false);

      await page.click("#edit-tab-styling");
      await page.waitForSelector("#edit-pane-styling:not(.hidden)");
      const layout = await page.evaluate(() => {
        const q = document.getElementById("edit-tab-queue").getBoundingClientRect();
        const s = document.getElementById("edit-tab-styling").getBoundingClientRect();
        const r = document.getElementById("edit-dock-reset-btn").getBoundingClientRect();
        return { queueRight: q.right, stylingLeft: s.left, stylingRight: s.right, resetLeft: r.left };
      });
      assert.ok(layout.stylingLeft > layout.queueRight, "Styling button must be to the right of Compose/Queue tabs");
      assert.ok(layout.resetLeft >= layout.stylingRight, "Reset button must sit next to Styling on the right");

      await page.click("#edit-style-theme-btn");
      await page.waitForSelector('#edit-style-theme-swatch-list [data-theme="cupcake"]');
      const swatchCheck = await page.evaluate(() => {
        const item = document.querySelector('#edit-style-theme-swatch-list [data-theme="cupcake"]');
        return {
          hasPreview: Boolean(item && item.querySelector('[data-swatch-preview="cupcake"]')),
          count: document.querySelectorAll("#edit-style-theme-swatch-list .theme-swatch-item").length
        };
      });
      assert.equal(swatchCheck.hasPreview, true);
      assert.ok(swatchCheck.count >= 32);
      await page.click('#edit-style-theme-swatch-list [data-theme="cupcake"]');
      assert.equal(await page.getAttribute("html", "data-theme"), "cupcake");

      await page.fill("#edit-style-name", "brand-e2e");
      await page.fill("#edit-style-primary-hex", "#e11d48");
      await page.dispatchEvent("#edit-style-primary-hex", "input");
      await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "brand-e2e");
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        page.click("#edit-style-set-default-btn")
      ]);
      assert.equal(await page.getAttribute("html", "data-theme"), "brand-e2e");

      const ctx2 = await browser.newContext();
      const page2 = await ctx2.newPage();
      await page2.goto(`${baseUrl}/projects/style-demo/index.html`, { waitUntil: "domcontentloaded" });
      assert.equal(await page2.getAttribute("html", "data-theme"), "brand-e2e");
      await ctx2.close();

      await page.evaluate(() => window.HTMLReportEdit.openDock({ expand: true, tab: "styling" }));
      page.once("dialog", (d) => d.accept());
      await page.click("#edit-dock-reset-btn");
      await page.waitForFunction(() =>
        document.documentElement.getAttribute("data-theme") === "light" &&
        document.getElementById("edit-task-count")?.textContent === "0"
      );
      const manifestAfterReset = JSON.parse(fs.readFileSync(path.join(tmpRoot, "projects/style-demo/report.manifest.json"), "utf-8"));
      assert.equal(manifestAfterReset.theme, "light");
      assert.equal(manifestAfterReset.customTheme, null);

      await ctx1.close();
    } finally {
      await browser.close();
    }
  });
});
