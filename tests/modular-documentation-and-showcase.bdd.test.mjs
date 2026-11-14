/**
 * @fileoverview modular-documentation-and-showcase.bdd.test.mjs
 * BDD Acceptance Test Suite for Modular Documentation & Minimal DaisyUI Showcase Redesign.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bindOpenSpec } from "./harness/openspec-bdd.mjs";
import { serveReport } from "../skills/html-report/scripts/serve-report.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const playwrightPath = path.resolve(__dirname, "../skills/html-report/playwright/node_modules/playwright/index.mjs");
const { chromium } = await import(playwrightPath);

bindOpenSpec("modular-documentation-and-showcase", {
  "Inspecting modular docs directory": async ({ Given, When, Then }) => {
    const requiredDocs = [
      "getting-started.md",
      "architecture-fsm.md",
      "cdn-stack.md",
      "custom-themes.md",
      "live-telemetry.md",
      "testing-and-verification.md",
      "api-and-cli-reference.md"
    ];

    let foundDocs = [];

    await Given("the docs directory exists at workspace root", () => {
      assert.ok(fs.existsSync("docs"), "docs/ directory must exist");
    });

    await When("inspecting all declared guide files", () => {
      foundDocs = requiredDocs.filter(doc => fs.existsSync(path.join("docs", doc)));
    });

    await Then("all 7 topic guides SHALL exist and be non-empty", () => {
      assert.deepEqual(foundDocs, requiredDocs, "All 7 documentation files must exist");
      for (const doc of requiredDocs) {
        const stats = fs.statSync(path.join("docs", doc));
        assert.ok(stats.size > 200, `docs/${doc} must contain substantive documentation`);
      }
    });
  },

  "Inspecting root README layout and documentation links": async ({ Given, When, Then }) => {
    let readmeContent = "";

    await Given("the root README.md exists", () => {
      assert.ok(fs.existsSync("README.md"), "README.md must exist at root");
      readmeContent = fs.readFileSync("README.md", "utf-8");
    });

    await When("reading the file structure and lines", () => {
      const lineCount = readmeContent.split(/\r?\n/).length;
      assert.ok(lineCount <= 200, `README.md must remain concise (was ${lineCount} lines)`);
    });

    await Then("it SHALL contain quick install prompts and links to all docs", () => {
      assert.match(readmeContent, /Install the html-report skill/);
      assert.match(readmeContent, /docs\/getting-started\.md/);
      assert.match(readmeContent, /docs\/cdn-stack\.md/);
      assert.match(readmeContent, /docs\/architecture-fsm\.md/);
      assert.match(readmeContent, /docs\/custom-themes\.md/);
      assert.match(readmeContent, /docs\/live-telemetry\.md/);
      assert.match(readmeContent, /docs\/testing-and-verification\.md/);
      assert.match(readmeContent, /docs\/api-and-cli-reference\.md/);
    });
  },

  "Loading GitHub Pages index.html showcase": async ({ Given, When, Then }) => {
    let browser = null;
    let page = null;
    let consoleErrors = [];
    let pageErrors = [];

    await Given("the compiled index.html at root", async () => {
      assert.ok(fs.existsSync("index.html"), "index.html must exist at root");
      browser = await chromium.launch({ headless: true });
      page = await browser.newPage();
      page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
      page.on("pageerror", err => pageErrors.push(err.message));
    });

    await When("opening index.html in a headless browser", async () => {
      const absPath = path.resolve("index.html");
      await page.goto("file://" + absPath, { waitUntil: "load" });
      await page.waitForTimeout(500);
    });

    await Then("the showcase renders with zero console errors and hero headlines", async () => {
      try {
        assert.deepEqual(pageErrors, [], `No page errors: ${pageErrors.join("; ")}`);
        assert.deepEqual(consoleErrors, [], `No console errors: ${consoleErrors.join("; ")}`);
        const heroTitle = await page.textContent("#hero-headline");
        assert.ok(heroTitle.includes("Publication-Grade HTML5 Reports"));
      } finally {
        if (browser) await browser.close();
      }
    });
  },

  "Switching capability explorer tabs": async ({ Given, When, Then }) => {
    let browser = null;
    let page = null;

    await Given("the landing page is loaded in a browser", async () => {
      browser = await chromium.launch({ headless: true });
      page = await browser.newPage();
      const absPath = path.resolve("index.html");
      await page.goto("file://" + absPath, { waitUntil: "load" });
      await page.waitForTimeout(300);
    });

    await When("clicking different capability tabs", async () => {
      const diagramsTab = await page.$("#tab-btn-diagrams");
      assert.ok(diagramsTab, "Diagrams tab button must exist");
      await diagramsTab.click();
      await page.waitForTimeout(200);
    });

    await Then("the corresponding capability panel becomes visible without scrolling", async () => {
      try {
        const diagramsVisible = await page.isVisible("#tab-panel-diagrams");
        assert.equal(diagramsVisible, true, "Diagrams panel must be visible");

        const tablesTab = await page.$("#tab-btn-tables");
        await tablesTab.click();
        await page.waitForTimeout(200);

        const tablesVisible = await page.isVisible("#tab-panel-tables");
        assert.equal(tablesVisible, true, "Tables panel must be visible");
      } finally {
        if (browser) await browser.close();
      }
    });
  },

  "Previewing documentation via Showdown viewer": async ({ Given, When, Then }) => {
    let browser = null;
    let page = null;
    let srv = null;

    await Given("the landing page documentation hub", async () => {
      srv = await serveReport({ filePath: "implementation-progress.html", port: 0, autoOpen: false });
      browser = await chromium.launch({ headless: true });
      page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${srv.serverPort}/`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(300);
    });

    await When("clicking an artifact preview button", async () => {
      const btn = await page.$('button:has-text("proposal.md")');
      if (btn) {
        await btn.click();
        await page.waitForTimeout(300);
      }
    });

    await Then("the Showdown modal renders the markdown content", async () => {
      try {
        const modal = await page.$("#markdown-viewer-modal");
        assert.ok(modal, "Modal dialog must exist in DOM");
        const isOpen = await page.isVisible("#markdown-viewer-modal");
        assert.equal(isOpen, true, "Modal must be open and visible");
      } finally {
        if (browser) await browser.close();
        if (srv) await srv.close();
      }
    });
  }
});
