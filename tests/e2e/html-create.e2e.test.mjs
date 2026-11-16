import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../../skills/html-report/scripts/serve-report.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const playwrightPath = path.resolve(__dirname, "../../packages/core/playwright/node_modules/playwright/index.mjs");
const { chromium } = await import(playwrightPath);

describe("Browser Interactive Studio UI (Playwright E2E)", () => {
  let tmpRoot;
  let serverHandle;
  let baseUrl;
  let browser;

  before(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "html-create-e2e-"));
    fs.writeFileSync(path.join(tmpRoot, "stub.html"), "<html><body><h1>Stub</h1></body></html>", "utf8");
    serverHandle = await startServer(path.join(tmpRoot, "stub.html"), 0, false);
    baseUrl = `http://127.0.0.1:${serverHandle.serverPort}`;
    browser = await chromium.launch({ headless: true });
  });

  after(async () => {
    if (browser) await browser.close();
    if (serverHandle) await serverHandle.close();
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("Scenario: Interacting with target cards dynamically alters prompt and wireframe mockup", async () => {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto(`${baseUrl}/create`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    assert.equal(pageErrors.length, 0, "No browser JS syntax or runtime errors");

    const initialPrompt = await page.inputValue("#prompt-output-box");
    assert.match(initialPrompt, /@html-report/);

    const dashboardCard = await page.$('[data-target="dashboard"]');
    assert.ok(dashboardCard, "Dashboard target card must be present");
    await dashboardCard.click();
    await page.waitForTimeout(200);

    const dashboardPrompt = await page.inputValue("#prompt-output-box");
    assert.match(dashboardPrompt, /@html-dashboard/);
    assert.match(dashboardPrompt, /REAL-TIME TELEMETRY DASHBOARD/);

    const mockupAccordion = await page.$("#mockup-accordion");
    if (mockupAccordion) {
      await mockupAccordion.evaluate((el) => { el.open = true; });
      await page.waitForTimeout(100);
    }

    const isLiveVisible = await page.isVisible("#mockup-live-indicator");
    assert.equal(isLiveVisible, true, "Wireframe mockup must show LIVE indicator when live mode active");

    const printCard = await page.$('[data-target="print"]');
    assert.ok(printCard, "Printable target card must be present");
    await printCard.click();
    await page.waitForTimeout(200);

    const printPrompt = await page.inputValue("#prompt-output-box");
    assert.match(printPrompt, /@html-print/);
    assert.match(printPrompt, /STATIC_STANDALONE/);

    const isLiveHiddenInPrint = await page.isVisible("#mockup-live-indicator");
    assert.equal(isLiveHiddenInPrint, false, "Wireframe mockup must hide LIVE indicator in Print mode");

    await page.close();
  });

  it("Scenario: Theme switching updates theme pill in wireframe mockup", async () => {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/create`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(200);

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
    await page.goto(`${baseUrl}/create`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(200);

    assert.equal(await page.isVisible("#app-card-live"), true);
    assert.equal(await page.isVisible("#app-card-offline"), true);

    const printCard = await page.$('[data-target="print"]');
    await printCard.click();
    await page.waitForTimeout(150);

    assert.equal(await page.isVisible("#app-card-live"), false, "Live app must be hidden in print mode");
    assert.equal(await page.isVisible("#app-card-offline"), false, "Offline app must be hidden in print mode");

    const prompt = await page.inputValue("#prompt-output-box");
    assert.match(prompt, /Standard Browser Page/);

    const reportCard = await page.$('[data-target="report"]');
    await reportCard.click();
    await page.waitForTimeout(150);
    assert.equal(await page.isVisible("#app-card-live"), true, "Live app restored in report mode");
    assert.equal(await page.isVisible("#app-card-offline"), true, "Offline app restored in report mode");

    await page.close();
  });

  it("Scenario: Theme dropdown opens to the right without clipping and supports selection", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${baseUrl}/create`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(200);

    const btn = await page.$("#initial-theme-btn");
    const btnBox = await btn.boundingBox();
    await btn.click();
    await page.waitForTimeout(150);

    const dropdownContent = await page.$("#initial-theme-dropdown .dropdown-content");
    const ddBox = await dropdownContent.boundingBox();

    assert.ok(ddBox.x >= btnBox.x - 5, "Dropdown menu must expand towards the right");
    assert.ok(ddBox.x >= 0, "Dropdown menu must have non-negative x coordinate");

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
    await page.goto(`${baseUrl}/create`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(200);

    const accordion = await page.$("#custom-theme-accordion");
    await accordion.evaluate((el) => { el.open = true; });

    const defaultName = await page.inputValue("#custom-theme-name-input");
    assert.equal(defaultName, "user");

    await page.fill("#text-primary", "#FF0055");
    await page.fill("#text-secondary", "#00FFCC");
    await page.fill("#text-accent", "#FFFF00");
    await page.fill("#text-neutral", "#112233");
    await page.fill("#text-base", "#FAFAFA");

    await page.click("#btn-save-custom-theme");
    await page.waitForTimeout(150);

    const activeLabel = await page.textContent("#initial-theme-label");
    assert.equal(activeLabel.trim(), "user");

    const userItem = await page.$('#initial-theme-swatch-list [data-theme="user"]');
    assert.ok(userItem, "Theme 'user' must appear in dropdown list");
    const badgeText = await userItem.textContent();
    assert.match(badgeText, /Custom/);

    await page.fill("#custom-theme-name-input", "acme-corp");
    await page.click("#btn-save-custom-theme");
    await page.waitForTimeout(150);

    const renamedLabel = await page.textContent("#initial-theme-label");
    assert.equal(renamedLabel.trim(), "acme-corp");

    const oldUserItem = await page.$('#initial-theme-swatch-list [data-theme="user"]');
    assert.equal(oldUserItem, null, "Old custom theme name must be replaced by new name");

    await page.close();
  });

  it("Scenario: Visual components grid, CLI removal, and optional audience prompt scaffolding", async () => {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/create`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(200);

    const showdownCheckbox = await page.$("#chk-showdown");
    const showdownClass = await showdownCheckbox.evaluate((el) => el.closest("label").className);
    assert.ok(!showdownClass.includes("sm:col-span-2"), "Markdown reader card must not have sm:col-span-2");

    const cliAccordion = await page.$("#cli-accordion");
    assert.equal(cliAccordion, null, "Deterministic CLI accordion must be removed");

    const h3Text = await page.textContent("#step-output h3");
    assert.ok(h3Text.includes("AI Prompt"));

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
    await page.goto(`${baseUrl}/create`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(200);

    const optionLabel = await page.textContent("label:has-text('Does it need to be built on the basis of other documents')");
    assert.ok(optionLabel, "Option label for reference documents/images/data-sets must exist");

    const fileInput = await page.$("#file-picker-input");
    assert.ok(fileInput, "File picker input must exist");

    const dropZone = await page.$("#file-drop-zone");
    assert.ok(dropZone, "Unified drop zone must exist");

    const presetChips = await page.$("#preset-files-chips");
    assert.equal(presetChips, null, "Preset example chips must not exist");

    await page.setInputFiles("#file-picker-input", [
      { name: "metrics.csv", mimeType: "text/csv", buffer: Buffer.from("arr,churn\n100,5") },
      { name: "unsupported-data.xyz", mimeType: "application/octet-stream", buffer: Buffer.from("xyz-bytes") }
    ]);
    await page.waitForTimeout(150);

    const countBadge = await page.textContent("#collected-files-count");
    assert.equal(countBadge.trim(), "2 files");

    const listItems = await page.$$(".collected-file-item");
    assert.equal(listItems.length, 2);

    const csvIcon = await page.$(".collected-file-item:nth-child(1) [data-lucide='file-spreadsheet']");
    assert.ok(csvIcon, "Known CSV file must have file-spreadsheet icon");

    const defaultIcon = await page.$(".collected-file-item:nth-child(2) [data-lucide='file']");
    assert.ok(defaultIcon, "Unknown extension must cleanly use the default 'file' icon");

    const noteBtnText = await page.textContent(".collected-file-item:nth-child(1) .btn-note-toggle span");
    assert.equal(noteBtnText.trim(), "Note", "Button text must be 'Note' to prevent double plus '+ + Note'");

    await page.click(".collected-file-item:nth-child(1) .btn-note-toggle");
    await page.waitForTimeout(150);

    const noteInput = await page.$(".collected-file-item:nth-child(1) input.note-input");
    assert.ok(noteInput, "Note input field must appear");

    const inputClass = await noteInput.evaluate((el) => el.className);
    assert.ok(inputClass.includes("input-xs"), "Note input must use input-xs for proper height alignment");

    await noteInput.fill("Primary ARR cohort retention and regional expansion numbers");
    await noteInput.press("Enter");
    await page.waitForTimeout(150);

    const notePreview = await page.textContent(".collected-file-item:nth-child(1) .file-note-preview");
    assert.match(notePreview, /Primary ARR cohort retention and regional expansion numbers/);

    let prompt = await page.inputValue("#prompt-output-box");
    assert.match(prompt, /• metrics\.csv \(CSV Dataset\) - Context Note: "Primary ARR cohort retention and regional expansion numbers"/);
    assert.match(prompt, /• unsupported-data\.xyz \(File\)/);
    assert.match(prompt, /metrics\.csv(?:\s*\(Path:[^)]+\))?: Ground on context note \("Primary ARR cohort retention and regional expansion numbers"\)/);

    const refWidget = await page.$("#mockup-references-widget");
    assert.ok(refWidget, "Mockup references widget must exist");
    const refWidgetClass = await refWidget.evaluate((el) => el.className);
    assert.ok(!refWidgetClass.includes("hidden"), "Mockup references widget must be visible");

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
    await page.goto(`${baseUrl}/create`, { waitUntil: "domcontentloaded" });

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

  it("Scenario: Workspace-first section renders between target cards and Describe what you want to build with side-by-side controls", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${baseUrl}/create`, { waitUntil: "domcontentloaded" });

    const domOrder = await page.evaluate(() => {
      const ws = document.getElementById("workspace-setup-section");
      const desc = document.getElementById("describe-build-section");
      const lastCard = Array.from(document.querySelectorAll("#step-purpose .wizard-target-card")).pop();
      const slugInput = document.getElementById("input-project-slug");
      const scaffoldBtn = document.getElementById("btn-scaffold-now");
      const step6Summary = document.getElementById("step-output-workspace-summary");

      const cardAfterWs = lastCard && ws ? Boolean(lastCard.compareDocumentPosition(ws) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
      const wsBeforeDesc = ws && desc ? Boolean(ws.compareDocumentPosition(desc) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
      return {
        hasWs: Boolean(ws),
        hasDesc: Boolean(desc),
        hasStep6Summary: Boolean(step6Summary),
        slugInsideWs: Boolean(ws && slugInput && ws.contains(slugInput)),
        btnInsideWs: Boolean(ws && scaffoldBtn && ws.contains(scaffoldBtn)),
        cardAfterWs,
        wsBeforeDesc
      };
    });

    assert.equal(domOrder.hasWs, true);
    assert.equal(domOrder.hasDesc, true);
    assert.equal(domOrder.hasStep6Summary, true);
    assert.equal(domOrder.slugInsideWs, true);
    assert.equal(domOrder.btnInsideWs, true);
    assert.equal(domOrder.cardAfterWs, true, "#workspace-setup-section must appear after deliverable cards");
    assert.equal(domOrder.wsBeforeDesc, true, "#workspace-setup-section must appear before Describe what you want to build");

    await page.close();
  });
});
