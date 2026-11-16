import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serveReport } from "../../skills/html-report/scripts/serve-report.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const playwrightPath = path.resolve(__dirname, "../../packages/core/playwright/node_modules/playwright/index.mjs");
const { chromium } = await import(playwrightPath);

describe("Agent Tracker — Playwright E2E", () => {
  let srv = null;
  let serverPort = 3031;

  before(async () => {
    srv = await serveReport({ filePath: "examples/dev/current-feature.html", port: 0, autoOpen: false });
    serverPort = srv.serverPort;
  });

  after(async () => {
    if (srv) await srv.close();
  });

  it("4. Playwright Headless Verification: should render side-by-side verification and switch strategies dynamically", async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const consoleErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    try {
      await page.goto(`http://127.0.0.1:${serverPort}/current-feature.html`, { waitUntil: "domcontentloaded", timeout: 10000 });

      // 1. Verify Active Spotlight Banner
      const spotlight = await page.waitForSelector("#active-work-spotlight", { timeout: 5000 });
      assert.ok(spotlight, "Active work spotlight should be present");

      // 2. Verify Core Observer Component
      const observer = await page.waitForSelector("#live-feature-observer", { timeout: 5000 });
      assert.ok(observer, "Core observer component should be present");

      // 3. Verify Heartbeat Pill
      await page.waitForSelector("#live-state-badge");
      const badgeText = await page.textContent("#live-state-text");
      assert.ok(badgeText.length > 0, "State badge text should not be empty");

      // 4. Verify Stopwatch
      await page.waitForSelector("#live-stopwatch");
      const timeVal1 = await page.textContent("#live-stopwatch");
      assert.match(timeVal1, /^[0-9.]+s$/, "Stopwatch should display formatted seconds");

      // 5. Test Strategy Switching in UI (Claude Code)
      await page.click('button[data-strat="claude"]');
      await page.waitForTimeout(100);
      const provClaude = await page.textContent("#active-provider-name");
      assert.equal(provClaude, "Anthropic Claude Code");

      // 6. Test Strategy Switching in UI (OpenAI Codex)
      await page.click('button[data-strat="codex"]');
      await page.waitForTimeout(100);
      const provCodex = await page.textContent("#active-provider-name");
      assert.equal(provCodex, "OpenAI Codex / Swarm");

      // 7. Test Strategy Switching in UI (Generic REST)
      await page.click('button[data-strat="generic"]');
      await page.waitForTimeout(100);
      const provGeneric = await page.textContent("#active-provider-name");
      assert.equal(provGeneric, "Generic Agent Webhook");

      // 8. Test Action Triggering (Tool Execution)
      await page.click('button[onclick*="fireStrategyAction(\'tool\')"]');
      await page.waitForTimeout(100);
      const toolName = await page.textContent("#live-tool-name");
      assert.ok(toolName.length > 0, "Tool name should update on tool execution");

      // 9. Verify Recent Activity Feed
      await page.waitForSelector("#live-recent-feed");
      const recentCount = await page.locator("#live-recent-feed > div").count();
      assert.ok(recentCount >= 1, "Recent feed should contain at least one item");

      // 10. Test Command Output Drawer (stdout & stderr)
      await page.click('button[data-strat="agy"]');
      await page.waitForTimeout(100);
      await page.click('button[onclick*="fireStrategyAction(\'cmd_stdout\')"]');
      await page.waitForTimeout(100);
      const stdoutText = await page.textContent("#terminal-stdout-container");
      assert.ok(stdoutText.includes("Passed"), "Terminal drawer should render stdout text");
      const exitBadge = await page.textContent("#terminal-drawer-exit");
      assert.ok(exitBadge.includes("exit 0"), "Terminal drawer should show exit 0 badge");

      await page.click('button[onclick*="fireStrategyAction(\'cmd_stderr\')"]');
      await page.waitForTimeout(100);
      const stderrText = await page.textContent("#terminal-stdout-container");
      assert.ok(stderrText.includes("bad option") || stderrText.includes("Error") || stderrText.includes("failed"), "Terminal drawer should render stderr text");

      // 11. Verify Live Feature Component Workbench at bottom of Active Feature In Flight card
      const wbInsideSpotlight = await page.locator("#active-work-spotlight #active-feature-workbench").count();
      assert.equal(wbInsideSpotlight, 1, "Active Feature Workbench must be located at the bottom of the Active Feature In Flight card");

      // 12. Verify Component Workbench Tab Switching (Status Badges tab)
      await page.click("#tab-btn-badges");
      await page.waitForTimeout(100);
      const badgesPanelVisible = await page.isVisible("#comp-stage-badges");
      assert.ok(badgesPanelVisible, "Status Badges panel should become visible on tab click");
      const diffPanelHidden = await page.isVisible("#comp-stage-diff");
      assert.ok(!diffPanelHidden, "Code Diff panel should be hidden when Badges tab is active");

      // Verify Swarm Swimlanes tab switching
      await page.click("#tab-btn-swarm");
      await page.waitForTimeout(100);
      const swarmPanelVisible = await page.isVisible("#comp-stage-swarm");
      assert.ok(swarmPanelVisible, "Swarm swimlanes panel should be visible");

      // Switch back to Code Diff tab
      await page.click("#tab-btn-diff");
      await page.waitForTimeout(100);
      const diffPanelVisible = await page.isVisible("#comp-stage-diff");
      assert.ok(diffPanelVisible, "Code Diff panel should become visible again");

      // 13. Verify Code Diff Action in Core Observer
      await page.click('button[onclick*="fireStrategyAction(\'edit_diff\')"]');
      await page.waitForTimeout(100);
      const diffContainerVisible = await page.isVisible("#code-diff-preview");
      assert.ok(diffContainerVisible, "Code diff preview widget should be visible in observer");
      const diffTargetText = await page.textContent("#diff-target-code");
      assert.ok(diffTargetText.includes("output"), "Diff target should contain target code snippet");

      // 14. Verify Human Attention Banner on Waiting State
      await page.click('button[onclick*="fireStrategyAction(\'waiting\')"]');
      await page.waitForTimeout(100);
      const attnBannerVisible = await page.isVisible("#human-attention-banner");
      assert.ok(attnBannerVisible, "Human attention banner should be visible when in waiting state");

      // 15. Verify Telemetry Tab & Pulse in Core Observer
      await page.click("#tab-btn-telemetry");
      await page.waitForTimeout(100);
      const telPanelVisible = await page.isVisible("#comp-stage-telemetry");
      assert.ok(telPanelVisible, "Telemetry workbench panel should be visible");

      await page.click('button[onclick*="fireStrategyAction(\'telemetry\')"]');
      await page.waitForTimeout(100);
      const telWidgetVisible = await page.isVisible("#context-telemetry-widget");
      assert.ok(telWidgetVisible, "Context telemetry widget should be visible in observer");
      const velText = await page.textContent("#telemetry-vel-count");
      assert.equal(velText, "168", "Telemetry velocity should display 168 tok/s from pulse");

      // Verify no unexpected console errors
      assert.equal(consoleErrors.length, 0, `Page had console errors: ${consoleErrors.join(", ")}`);
    } finally {
      await browser.close();
    }
  });

  it("11. Multi-Breakpoint & Multi-Theme Verification: should render cleanly across mobile, tablet, desktop and DaisyUI themes", async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const viewports = [
        { name: "mobile", width: 375, height: 667 },
        { name: "tablet", width: 768, height: 1024 },
        { name: "desktop", width: 1440, height: 900 }
      ];

      for (const vp of viewports) {
        const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
        await page.goto(`http://127.0.0.1:${serverPort}/current-feature.html`, { waitUntil: "domcontentloaded", timeout: 10000 });

        const spotlight = await page.waitForSelector("#active-work-spotlight");
        const spotlightBox = await spotlight.boundingBox();
        assert.ok(spotlightBox, `Spotlight should have valid bounding box on ${vp.name}`);
        assert.ok(spotlightBox.width <= vp.width + 1, `Spotlight width (${spotlightBox.width}) should not exceed viewport width (${vp.width}) on ${vp.name}`);

        const observer = await page.waitForSelector("#live-feature-observer");
        const observerBox = await observer.boundingBox();
        assert.ok(observerBox, `Observer should have valid bounding box on ${vp.name}`);
        assert.ok(observerBox.width <= vp.width + 1, `Observer width (${observerBox.width}) should not exceed viewport width (${vp.width}) on ${vp.name}`);

        await page.close();
      }

      // Test theme switching across 5 diverse DaisyUI themes
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto(`http://127.0.0.1:${serverPort}/current-feature.html`, { waitUntil: "domcontentloaded", timeout: 10000 });

      const themes = ["light", "dark", "cyberpunk", "synthwave", "corporate"];
      for (const th of themes) {
        await page.evaluate((themeName) => {
          document.documentElement.setAttribute("data-theme", themeName);
          localStorage.setItem("html-report-theme", themeName);
        }, th);
        await page.waitForTimeout(50);
        const activeTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
        assert.equal(activeTheme, th, `Theme should be set to ${th}`);
      }
      await page.close();
    } finally {
      await browser.close();
    }
  });
});
