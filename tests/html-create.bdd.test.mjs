/**
 * @file html-create.bdd.test.mjs
 * BDD Specification Suite for Feature 4 & 4.1:
 * Interactive Creation Studio (/html-create) & Terminal Grill Service (/html-create:cli)
 */

import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { routeSkill } from "../skills/html-report/scripts/skill-router.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const playwrightPath = path.resolve(__dirname, "../skills/html-report/playwright/node_modules/playwright/index.mjs");
const { chromium } = await import(playwrightPath);

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(parsed, {
      method: options.method || "GET",
      headers: options.headers || {}
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function runCli(args = []) {
  return new Promise((resolve, reject) => {
    const script = path.resolve(__dirname, "../skills/html-report/scripts/html-grill.mjs");
    execFile(process.execPath, [script, ...args], (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout, stderr });
    });
  });
}

describe("Feature Spec: Feature 4 & 4.1 - Interactive html-create Studio & Terminal Grill", () => {
  let spawnedServer = null;

  before(async () => {
    try {
      const res = await fetchUrl("http://localhost:3000/create");
      if (res.statusCode === 200) return;
    } catch (_) {}

    const serveScript = path.resolve(__dirname, "../skills/html-report/scripts/serve-report.mjs");
    const targetFile = path.resolve(__dirname, "../implementation-progress.html");
    spawnedServer = spawn(process.execPath, [serveScript, targetFile, "--port", "3000", "--no-open"], {
      stdio: "pipe"
    });

    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetchUrl("http://localhost:3000/create");
        if (res.statusCode === 200) break;
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 100));
    }
  });

  after(() => {
    if (spawnedServer) {
      try {
        spawnedServer.kill("SIGKILL");
      } catch (_) {}
    }
  });

  describe("Requirement: Live Dev Server Creation Studio Endpoints", () => {
    it("Scenario: Visiting /create and /html-create serves the standalone creation studio", async () => {
      const resCreate = await fetchUrl("http://localhost:3000/create");
      assert.equal(resCreate.statusCode, 200);
      assert.match(resCreate.headers["content-type"], /text\/html/);
      assert.match(resCreate.body, /Setup Wizard/);

      const resHtmlCreate = await fetchUrl("http://localhost:3000/html-create");
      assert.equal(resHtmlCreate.statusCode, 200);
      assert.match(resHtmlCreate.headers["content-type"], /text\/html/);
      assert.match(resHtmlCreate.body, /Setup Wizard/);
    });

    it("Scenario: Querying /api/create/config returns canonical themes and target metadata", async () => {
      const res = await fetchUrl("http://localhost:3000/api/create/config");
      assert.equal(res.statusCode, 200);
      assert.match(res.headers["content-type"], /application\/json/);

      const data = JSON.parse(res.body);
      assert.equal(data.ok, true);
      assert.equal(data.themes.length, 32);
      assert.equal(data.themes[0], "light");
      assert.ok(data.targets.report);
      assert.ok(data.targets.print);
      assert.ok(data.targets.dashboard);
      assert.ok(data.targets.presentation);
    });

    it("Scenario: Submitting configuration to /api/create/synthesize computes prompt and CLI flags", async () => {
      const payload = JSON.stringify({
        target: "print",
        title: "Annual Regulatory Audit",
        theme: "corporate",
        features: {
          addons: ["charts", "gridjs"]
        }
      });

      const res = await fetchUrl("http://localhost:3000/api/create/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.ok, true);
      assert.equal(data.sibling.skillTag, "@html-print");
      assert.equal(data.config.operationalMode, "static");
      assert.ok(data.cli.buildFlags.includes("--mode print"));
      assert.match(data.prompt, /Routing to Specialized Facade: @html-print/);
      assert.match(data.prompt, /Purpose & Format: PRINTABLE DOCUMENT/);
    });
  });

  describe("Requirement: Terminal Interview CLI Service (html-grill.mjs)", () => {
    it("Scenario: Invoking html-grill.mjs with --non-interactive emits deterministic prompt", async () => {
      const { stdout } = await runCli([
        "--target", "dashboard",
        "--title", "Kubernetes Fleet Monitor",
        "--mode", "live",
        "--theme", "synthwave",
        "--non-interactive"
      ]);

      assert.match(stdout, /Routing to Specialized Facade: @html-dashboard/);
      assert.match(stdout, /Purpose & Format: REAL-TIME TELEMETRY DASHBOARD/);
      assert.match(stdout, /Operational Mode: LIVE_CONNECTED/);
      assert.match(stdout, /Startup Theme: "synthwave"/);
      assert.match(stdout, /node skills\/html-report\/scripts\/build-report\.mjs/);
      assert.match(stdout, /--mode dashboard/);
      assert.match(stdout, /--dashboard/);
      assert.match(stdout, /--live/);
    });

    it("Scenario: Invoking html-grill.mjs with --json outputs structured metadata", async () => {
      const { stdout } = await runCli([
        "--target", "presentation",
        "--title", "Q1 Product Keynote",
        "--theme", "luxury",
        "--non-interactive",
        "--json"
      ]);

      const data = JSON.parse(stdout);
      assert.equal(data.sibling.skillTag, "@html-presentation");
      assert.equal(data.config.target, "presentation");
      assert.ok(data.cli.buildFlags.includes("--mode presentation"));
      assert.ok(data.cli.buildFlags.includes("--presentation"));
      assert.match(data.prompt, /Q1 Product Keynote/);
    });
  });

  describe("Requirement: Browser Interactive Studio UI (Playwright End-to-End)", () => {
    let browser;

    before(async () => {
      browser = await chromium.launch({ headless: true });
    });

    after(async () => {
      if (browser) await browser.close();
    });

    it("Scenario: Interacting with target cards dynamically alters prompt and wireframe mockup", async () => {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on("pageerror", (err) => pageErrors.push(err.message));

      await page.goto("http://localhost:3000/create", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(300);
      assert.equal(pageErrors.length, 0, "No browser JS syntax or runtime errors");

      // Verify default is @html-report
      const initialPrompt = await page.inputValue("#prompt-output-box");
      assert.match(initialPrompt, /@html-report/);

      // Click on Dashboard Target Card
      const dashboardCard = await page.$('[data-target="dashboard"]');
      assert.ok(dashboardCard, "Dashboard target card must be present");
      await dashboardCard.click();
      await page.waitForTimeout(200);

      // Verify prompt updated to @html-dashboard
      const dashboardPrompt = await page.inputValue("#prompt-output-box");
      assert.match(dashboardPrompt, /@html-dashboard/);
      assert.match(dashboardPrompt, /REAL-TIME TELEMETRY DASHBOARD/);

      // Open mockup accordion to inspect preview widgets
      const mockupAccordion = await page.$("#mockup-accordion");
      if (mockupAccordion) {
        await mockupAccordion.evaluate((el) => { el.open = true; });
        await page.waitForTimeout(100);
      }

      // Verify Live Indicator in wireframe mockup became visible
      const isLiveVisible = await page.isVisible("#mockup-live-indicator");
      assert.equal(isLiveVisible, true, "Wireframe mockup must show LIVE indicator when live mode active");

      // Click on Printable Target Card
      const printCard = await page.$('[data-target="print"]');
      assert.ok(printCard, "Printable target card must be present");
      await printCard.click();
      await page.waitForTimeout(200);

      const printPrompt = await page.inputValue("#prompt-output-box");
      assert.match(printPrompt, /@html-print/);
      assert.match(printPrompt, /STATIC_STANDALONE/);

      // Verify Live Indicator is now hidden in Print mode
      const isLiveHiddenInPrint = await page.isVisible("#mockup-live-indicator");
      assert.equal(isLiveHiddenInPrint, false, "Wireframe mockup must hide LIVE indicator in Print mode");

      await page.close();
    });

    it("Scenario: Theme switching updates theme pill in wireframe mockup", async () => {
      const page = await browser.newPage();
      await page.goto("http://localhost:3000/create", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(200);

      // Select Synthwave theme from dropdown or changeDefaultTheme
      await page.evaluate(() => {
        window.changeDefaultTheme("synthwave");
      });
      await page.waitForTimeout(150);

      const themePillText = await page.textContent("#mockup-theme-pill");
      assert.equal(themePillText.trim(), "synthwave");

      const promptText = await page.inputValue("#prompt-output-box");
      assert.match(promptText, /Startup Theme: "synthwave"/);

      await page.close();
    });

    it("Scenario: Selecting Print deliverable eliminates offline-first and installable app options", async () => {
      const page = await browser.newPage();
      await page.goto("http://localhost:3000/create", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(200);

      // Verify app cards initially visible
      assert.equal(await page.isVisible("#app-card-live"), true);
      assert.equal(await page.isVisible("#app-card-offline"), true);

      // Select Print Target
      const printCard = await page.$('[data-target="print"]');
      await printCard.click();
      await page.waitForTimeout(150);

      // Verify app cards eliminated (hidden)
      assert.equal(await page.isVisible("#app-card-live"), false, "Live app must be hidden in print mode");
      assert.equal(await page.isVisible("#app-card-offline"), false, "Offline app must be hidden in print mode");

      // Verify prompt reflection
      const prompt = await page.inputValue("#prompt-output-box");
      assert.match(prompt, /Standard Browser Page/);

      // Switch back to Report
      const reportCard = await page.$('[data-target="report"]');
      await reportCard.click();
      await page.waitForTimeout(150);
      assert.equal(await page.isVisible("#app-card-live"), true, "Live app restored in report mode");
      assert.equal(await page.isVisible("#app-card-offline"), true, "Offline app restored in report mode");

      await page.close();
    });

    it("Scenario: Theme dropdown opens to the right without clipping and supports selection", async () => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto("http://localhost:3000/create", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(200);

      const btn = await page.$("#initial-theme-btn");
      const btnBox = await btn.boundingBox();
      await btn.click();
      await page.waitForTimeout(150);

      const dropdownContent = await page.$("#initial-theme-dropdown .dropdown-content");
      const ddBox = await dropdownContent.boundingBox();

      // Dropdown must open to the right (aligned with or right of button left edge) and not be clipped
      assert.ok(ddBox.x >= btnBox.x - 5, "Dropdown menu must expand towards the right");
      assert.ok(ddBox.x >= 0, "Dropdown menu must have non-negative x coordinate");

      // Click Dark theme in dropdown
      const darkOption = await page.$('#initial-theme-swatch-list [data-theme="dark"]');
      assert.ok(darkOption, "Dark theme option must exist in initial theme list");
      await darkOption.click();
      await page.waitForTimeout(150);

      const label = await page.textContent("#initial-theme-label");
      assert.equal(label.trim(), "dark");

      await page.close();
    });

    it("Scenario: Custom Theme Studio enables text inputs, puts 'user' in dropdown, and allows renaming", async () => {
      const page = await browser.newPage();
      await page.goto("http://localhost:3000/create", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(200);

      // Open custom theme accordion
      const accordion = await page.$("#custom-theme-accordion");
      await accordion.evaluate((el) => { el.open = true; });

      // Verify default name is 'user'
      const defaultName = await page.inputValue("#custom-theme-name-input");
      assert.equal(defaultName, "user");

      // Give text inputs for theme colors
      await page.fill("#text-primary", "#FF0055");
      await page.fill("#text-secondary", "#00FFCC");
      await page.fill("#text-accent", "#FFFF00");
      await page.fill("#text-neutral", "#112233");
      await page.fill("#text-base", "#FAFAFA");

      // Click put in dropdown & apply
      await page.click("#btn-save-custom-theme");
      await page.waitForTimeout(150);

      // Verify active theme is now 'user'
      const activeLabel = await page.textContent("#initial-theme-label");
      assert.equal(activeLabel.trim(), "user");

      // Verify 'user' is inside the dropdown list with Custom badge
      const userItem = await page.$('#initial-theme-swatch-list [data-theme="user"]');
      assert.ok(userItem, "Theme 'user' must appear in dropdown list");
      const badgeText = await userItem.textContent();
      assert.match(badgeText, /Custom/);

      // Rename custom theme to 'acme-corp' and save
      await page.fill("#custom-theme-name-input", "acme-corp");
      await page.click("#btn-save-custom-theme");
      await page.waitForTimeout(150);

      const renamedLabel = await page.textContent("#initial-theme-label");
      assert.equal(renamedLabel.trim(), "acme-corp");

      // Old 'user' theme is replaced (only 1 custom theme managed per creation)
      const oldUserItem = await page.$('#initial-theme-swatch-list [data-theme="user"]');
      assert.equal(oldUserItem, null, "Old custom theme name must be replaced by new name");

      await page.close();
    });

    it("Scenario: Visual components grid, CLI removal, and optional audience prompt scaffolding", async () => {
      const page = await browser.newPage();
      await page.goto("http://localhost:3000/create", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(200);

      // 1. Verify markdown document reader does NOT take full length (no sm:col-span-2)
      const showdownCheckbox = await page.$("#chk-showdown");
      const showdownClass = await showdownCheckbox.evaluate((el) => el.closest("label").className);
      assert.ok(!showdownClass.includes("sm:col-span-2"), "Markdown reader card must not have sm:col-span-2");

      // 2. Verify deterministic CLI command is removed
      const cliAccordion = await page.$("#cli-accordion");
      assert.equal(cliAccordion, null, "Deterministic CLI accordion must be removed");

      // 3. Verify card title is 'AI Prompt'
      const h3Text = await page.textContent("h3");
      assert.equal(h3Text.trim(), "AI Prompt");

      // 4. Fill optional prompt context: what the board needs to show & audience
      await page.fill("#input-board-goals", "Quarterly SaaS ARR Growth and Churn Cohort Metrics");
      await page.fill("#input-board-audience", "Executive Committee and Board Members");
      await page.waitForTimeout(150);

      const prompt = await page.inputValue("#prompt-output-box");
      assert.match(prompt, /Skill Command: \/html-report/);
      assert.match(prompt, /Quarterly SaaS ARR Growth and Churn Cohort Metrics/);
      assert.match(prompt, /Executive Committee and Board Members/);

      await page.close();
    });

    it("Scenario: Reference Documents, Images & Data-Sets with File Picker, Default Icons, and Note Spacing", async () => {
      const page = await browser.newPage();
      await page.goto("http://localhost:3000/create", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(200);

      // 1. Verify existence of option label, drop zone, and hidden file input
      const optionLabel = await page.textContent("label:has-text('Does it need to be built on the basis of other documents')");
      assert.ok(optionLabel, "Option label for reference documents/images/data-sets must exist");

      const fileInput = await page.$("#file-picker-input");
      assert.ok(fileInput, "File picker input must exist");

      const dropZone = await page.$("#file-drop-zone");
      assert.ok(dropZone, "Unified drop zone must exist");

      // Verify no preset example chips cluttering UI
      const presetChips = await page.$("#preset-files-chips");
      assert.equal(presetChips, null, "Preset example chips must not exist");

      // 2. Select two files via file picker: one known (CSV) and one unknown extension (XYZ)
      await page.setInputFiles("#file-picker-input", [
        { name: "metrics.csv", mimeType: "text/csv", buffer: Buffer.from("arr,churn\n100,5") },
        { name: "unsupported-data.xyz", mimeType: "application/octet-stream", buffer: Buffer.from("xyz-bytes") }
      ]);
      await page.waitForTimeout(150);

      // Verify count badge and list items
      const countBadge = await page.textContent("#collected-files-count");
      assert.equal(countBadge.trim(), "2 files");

      const listItems = await page.$$(".collected-file-item");
      assert.equal(listItems.length, 2);

      // Verify known file (metrics.csv) gets file-spreadsheet icon
      const csvIcon = await page.$(".collected-file-item:nth-child(1) [data-lucide='file-spreadsheet']");
      assert.ok(csvIcon, "Known CSV file must have file-spreadsheet icon");

      // Verify unknown file (unsupported-data.xyz) gets DEFAULT file icon
      const defaultIcon = await page.$(".collected-file-item:nth-child(2) [data-lucide='file']");
      assert.ok(defaultIcon, "Unknown extension must cleanly use the default 'file' icon");

      // Verify note button text does NOT have double plus sign ("+ + Note")
      const noteBtnText = await page.textContent(".collected-file-item:nth-child(1) .btn-note-toggle span");
      assert.equal(noteBtnText.trim(), "Note", "Button text must be 'Note' to prevent double plus '+ + Note'");

      // 3. Open Note editor for metrics.csv and verify compact sizing & spacing
      await page.click(".collected-file-item:nth-child(1) .btn-note-toggle");
      await page.waitForTimeout(150);

      const noteInput = await page.$(".collected-file-item:nth-child(1) input.note-input");
      assert.ok(noteInput, "Note input field must appear");

      const inputClass = await noteInput.evaluate((el) => el.className);
      assert.ok(inputClass.includes("input-xs"), "Note input must use input-xs for proper height alignment");

      // Enter context note and submit with Enter
      await noteInput.fill("Primary ARR cohort retention and regional expansion numbers");
      await noteInput.press("Enter");
      await page.waitForTimeout(150);

      // Verify note editor closes and clean note preview is rendered
      const notePreview = await page.textContent(".collected-file-item:nth-child(1) .file-note-preview");
      assert.match(notePreview, /Primary ARR cohort retention and regional expansion numbers/);

      // Verify prompt includes metrics.csv with context note
      let prompt = await page.inputValue("#prompt-output-box");
      assert.match(prompt, /• metrics\.csv \(CSV Dataset\) - Context Note: "Primary ARR cohort retention and regional expansion numbers"/);
      assert.match(prompt, /• unsupported-data\.xyz \(File\)/);
      assert.match(prompt, /metrics\.csv: Ground on context note \("Primary ARR cohort retention and regional expansion numbers"\)/);

      // 4. Verify simulated DOM wireframe mockup widget is visible
      const refWidget = await page.$("#mockup-references-widget");
      assert.ok(refWidget, "Mockup references widget must exist");
      const refWidgetClass = await refWidget.evaluate((el) => el.className);
      assert.ok(!refWidgetClass.includes("hidden"), "Mockup references widget must be visible");

      // 5. Remove the unknown file
      await page.click(".collected-file-item:nth-child(2) .btn-remove-file");
      await page.waitForTimeout(150);

      const countBadgeAfter = await page.textContent("#collected-files-count");
      assert.equal(countBadgeAfter.trim(), "1 file");

      prompt = await page.inputValue("#prompt-output-box");
      assert.doesNotMatch(prompt, /unsupported-data\.xyz/);
      assert.match(prompt, /metrics\.csv/);

      await page.close();
    });

    it("Scenario: Navbar Settings Reset to Default button resets all studio state to defaults", async () => {
      const page = await browser.newPage();
      await page.goto("http://localhost:3000/create", { waitUntil: "domcontentloaded" });

      // Modify target, goals, audience, checkboxes, theme
      await page.click('[data-target="dashboard"]');
      await page.fill("#input-board-goals", "Custom dashboard goals");
      await page.fill("#input-board-audience", "Engineering VPs");
      await page.check("#chk-charts");
      await page.check("#chk-mermaid");
      await page.evaluate(() => changeDefaultTheme("dark"));
      await page.waitForTimeout(100);

      let promptBefore = await page.inputValue("#prompt-output-box");
      assert.match(promptBefore, /Custom dashboard goals/);
      assert.match(promptBefore, /Engineering VPs/);
      assert.match(promptBefore, /Startup Theme: "dark"/);

      // Open navbar settings gear and click Reset to Default
      await page.click("#studio-settings-gear-btn");
      await page.waitForSelector("#studio-reset-default-btn", { state: "visible" });
      await page.click("#studio-reset-default-btn");
      await page.waitForTimeout(150);

      assert.equal(await page.inputValue("#input-board-goals"), "");
      assert.equal(await page.inputValue("#input-board-audience"), "");
      assert.equal(await page.isChecked("#chk-charts"), false);
      assert.equal(await page.isChecked("#chk-mermaid"), false);
      assert.equal(await page.getAttribute("html", "data-theme"), "light");

      const promptAfter = await page.inputValue("#prompt-output-box");
      assert.doesNotMatch(promptAfter, /Custom dashboard goals/);
      assert.doesNotMatch(promptAfter, /Engineering VPs/);
      assert.match(promptAfter, /Startup Theme: "light"/);
      assert.match(promptAfter, /Analytical Report/);

      await page.close();
    });
  });

  describe("Requirement: Modular Skill Router Intent Handoff", () => {
    it("Scenario: Slash command /html-create routes to html-create skill", () => {
      const match1 = routeSkill("/html-create");
      assert.equal(match1.skill, "html-create");

      const match2 = routeSkill("/html-create:cli");
      assert.equal(match2.skill, "html-create");
    });

    it("Scenario: Natural language creation wizard questions route to html-create skill", () => {
      const match = routeSkill("help me decide what kind of report to build for my team");
      assert.equal(match.skill, "html-create");
    });
  });
});
