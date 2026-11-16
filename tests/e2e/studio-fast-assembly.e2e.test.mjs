import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const playwrightPath = path.join(REPO_ROOT, "packages/core/playwright/node_modules/playwright/index.mjs");
const { chromium } = await import(pathToFileURL(playwrightPath).href);

import { startServer } from "../../skills/html-report/scripts/serve-report.mjs";
import { buildReport } from "../../skills/html-report/scripts/build-report.mjs";

describe("Playwright E2E: Studio Fast Assembly & Lucide Icon Resilience", () => {
  let tmpRoot;
  let serverHandle;
  let baseUrl;

  before(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "studio-fast-e2e-"));
    fs.writeFileSync(
      path.join(tmpRoot, "create.html"),
      fs.readFileSync(path.join(REPO_ROOT, "packages/studio/assets/create.html"), "utf8"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(tmpRoot, "implementation-progress.html"),
      "<html><body><h1>Root Stub</h1></body></html>",
      "utf8"
    );

    const uploadsDir = path.join(tmpRoot, "projects", "_uploads");
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(
      path.join(uploadsDir, "q3-metrics.csv"),
      "region,revenue,growth_pct\nNorth America,420000,14.5\nEMEA,310000,18.2\nAPAC,265000,22.1\n",
      "utf8"
    );

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

  it("supports #input-project-slug, #widget-presets-selector, #btn-scaffold-now, preflight-gated #btn-send-to-agent, and renders Lucide SVGs even when jsDelivr fails", async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();

      await page.route("https://cdn.jsdelivr.net/npm/lucide@*/**", (route) => route.abort());

      let preflightMode = "offline";
      let capturedAgentPrompt = null;
      let capturedCsrfHeader = null;
      await page.route("**/api/agent/preflight*", async (route) => {
        if (preflightMode === "offline") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true, secureBridge: false, providerAvailable: false, authenticated: false, activeProviderName: "" })
          });
        } else if (preflightMode === "unauthenticated") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              secureBridge: false,
              streamConnected: true,
              streamListeners: 1,
              providerAvailable: true,
              authenticated: false,
              inferenceVerified: false,
              activeProvider: "gemini",
              activeProviderName: "Gemini CLI"
            })
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              bridgeReachable: true,
              secureBridge: true,
              providerAvailable: true,
              authenticated: true,
              activeProvider: "gemini-cli",
              activeProviderName: "Gemini CLI"
            })
          });
        }
      });
      await page.route("**/api/agent/prompt", async (route) => {
        capturedCsrfHeader = route.request().headers()["x-csrf-token"] || null;
        capturedAgentPrompt = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, sessionId: "test-sess-1", response: "Queued build." })
        });
      });

      await page.goto(`${baseUrl}/create`, { waitUntil: "load" });

      const layoutCheck = await page.evaluate(() => {
        const stepPurpose = document.getElementById("step-purpose");
        const cards = stepPurpose?.querySelector(".wizard-target-card");
        const wsSection = document.getElementById("workspace-setup-section");
        const descSection = document.getElementById("describe-build-section");
        const slugInput = document.getElementById("input-project-slug");
        const scaffoldBtn = document.getElementById("btn-scaffold-now");
        const cardsRect = cards?.getBoundingClientRect();
        const wsRect = wsSection?.getBoundingClientRect();
        const descRect = descSection?.getBoundingClientRect();
        const slugRect = slugInput?.getBoundingClientRect();
        const btnRect = scaffoldBtn?.getBoundingClientRect();
        return {
          hasWsSection: Boolean(wsSection),
          hasDescSection: Boolean(descSection),
          slugInWs: Boolean(wsSection && slugInput && wsSection.contains(slugInput)),
          btnInWs: Boolean(wsSection && scaffoldBtn && wsSection.contains(scaffoldBtn)),
          cardsBeforeWs: Boolean(cardsRect && wsRect && cardsRect.bottom <= wsRect.top + 4),
          wsBeforeDesc: Boolean(wsRect && descRect && wsRect.bottom <= descRect.top + 4),
          sideBySide: Boolean(slugRect && btnRect && slugRect.right <= btnRect.left + 4 && Math.abs(slugRect.bottom - btnRect.bottom) < 20)
        };
      });
      assert.equal(layoutCheck.hasWsSection, true, "#workspace-setup-section must exist");
      assert.equal(layoutCheck.slugInWs, true, "#input-project-slug must reside inside #workspace-setup-section");
      assert.equal(layoutCheck.btnInWs, true, "#btn-scaffold-now must reside inside #workspace-setup-section");
      assert.equal(layoutCheck.cardsBeforeWs, true, "Deliverable cards must precede #workspace-setup-section");
      assert.equal(layoutCheck.wsBeforeDesc, true, "#workspace-setup-section must precede #describe-build-section");
      assert.equal(layoutCheck.sideBySide, true, "#input-project-slug and #btn-scaffold-now must sit side-by-side on desktop");

      const initialBadge = await page.textContent("#workspace-state-badge");
      assert.ok(initialBadge.includes("Draft"), `Expected initial Draft state badge, got: ${initialBadge}`);
      const scaffoldBtnText = await page.textContent("#btn-scaffold-now");
      assert.ok(scaffoldBtnText.includes("Create Workspace"), `Expected Create Workspace label, got: ${scaffoldBtnText}`);

      await page.waitForFunction(() => document.querySelectorAll("svg.lucide").length > 10, null, { timeout: 10000 });
      const iconStats = await page.evaluate(() => ({
        svgCount: document.querySelectorAll("svg.lucide").length,
        unrenderedCount: document.querySelectorAll(":not(svg)[data-lucide]").length
      }));
      assert.ok(iconStats.svgCount > 10, `Expected Lucide SVGs via fallback CDN, found ${iconStats.svgCount}`);
      assert.equal(iconStats.unrenderedCount, 0, "Expected zero unrendered :not(svg)[data-lucide] placeholders");

      const visibleInitially = await page.isVisible("#btn-send-to-agent");
      assert.equal(visibleInitially, false, "#btn-send-to-agent must be hidden when no secure bridge is active");

      preflightMode = "unauthenticated";
      await page.evaluate(() => window.checkAgentBridgePreflight());
      await page.waitForTimeout(100);
      const visibleWhenUnauth = await page.isVisible("#btn-send-to-agent");
      assert.equal(visibleWhenUnauth, false, "#btn-send-to-agent must stay hidden when bridge is unauthenticated/insecure");

      preflightMode = "online";
      await page.evaluate(() => window.checkAgentBridgePreflight());
      await page.waitForFunction(() => {
        const btn = document.getElementById("btn-send-to-agent");
        return btn && !btn.classList.contains("hidden") && !btn.disabled;
      });

      await page.fill("#input-project-slug", "pw-fast-demo");
      await page.check(".widget-preset-chk[data-widget='timeline']");
      await page.uncheck(".widget-preset-chk[data-widget='kpi-row']");

      await page.click("#btn-scaffold-now");
      await page.waitForFunction(() => {
        const banner = document.getElementById("scaffold-result-banner");
        return banner && !banner.classList.contains("hidden");
      });
      const createdBadge = await page.textContent("#workspace-state-badge");
      assert.ok(createdBadge.includes("Workspace Created"), `Expected Workspace Created badge, got: ${createdBadge}`);
      const bannerText = await page.textContent("#scaffold-result-banner");
      assert.ok(bannerText.includes("pw-fast-demo"), `Banner should show slug pw-fast-demo, got: ${bannerText}`);
      assert.ok(fs.existsSync(path.join(tmpRoot, "projects", "pw-fast-demo", "fragment.html")));
      const pwFrag = fs.readFileSync(path.join(tmpRoot, "projects", "pw-fast-demo", "fragment.html"), "utf8");
      assert.ok(pwFrag.includes("timeline"), "Scaffolded fragment should include checked timeline preset");
      assert.ok(!pwFrag.includes('id="kpi-overview"'), "Unchecked kpi-row preset should be omitted");

      await page.fill("#input-board-goals", "In-place updated goals");
      await page.waitForFunction(() => {
        const badge = document.getElementById("workspace-state-badge");
        const updateBtn = document.getElementById("btn-update-workspace");
        return badge && badge.textContent.includes("Unsaved Changes") && updateBtn && !updateBtn.classList.contains("hidden");
      });
      await page.click("#btn-update-workspace");
      await page.waitForFunction(() => {
        const badge = document.getElementById("workspace-state-badge");
        return badge && badge.textContent.includes("Workspace Created");
      });
      assert.equal(fs.existsSync(path.join(tmpRoot, "projects", "pw-fast-demo-2")), false, "In-place Update Workspace must not create -2 folder");
      const updatedDemoManifest = JSON.parse(fs.readFileSync(path.join(tmpRoot, "projects", "pw-fast-demo", "report.manifest.json"), "utf8"));
      assert.equal(updatedDemoManifest.goals, "In-place updated goals");

      await page.click("#btn-send-to-agent");
      await page.waitForFunction(() => {
        const s = document.getElementById("agent-bridge-dispatch-status");
        return s && s.textContent && s.textContent.includes("Dispatched");
      });
      const dispatchedBadge = await page.textContent("#workspace-state-badge");
      assert.ok(dispatchedBadge.includes("Sent to Agent"), `Expected Sent to Agent badge, got: ${dispatchedBadge}`);
      assert.ok(capturedCsrfHeader && capturedCsrfHeader.length >= 32, "X-CSRF-Token header must be sent to /api/agent/prompt");
      assert.ok(capturedAgentPrompt && capturedAgentPrompt.prompt, "Prompt payload must be sent to /api/agent/prompt");
      assert.equal(capturedAgentPrompt.csrfToken, capturedCsrfHeader);
      assert.equal(capturedAgentPrompt.context.projectSlug, "pw-fast-demo");

      await page.route("**/api/create/scaffold", async (route) => {
        await route.fulfill({
          status: 404,
          contentType: "text/plain",
          body: "404 Not Found: /api/create/scaffold"
        });
      });
      await page.click("#btn-scaffold-now");
      await page.waitForFunction(() => {
        const errBanner = document.getElementById("scaffold-error-banner");
        return errBanner && !errBanner.classList.contains("hidden");
      });
      const errMsg = await page.textContent("#scaffold-error-message");
      assert.ok(!errMsg.includes("Unexpected non-whitespace character"), `Must not show raw JSON parse error: ${errMsg}`);
      assert.ok(errMsg.includes("404"), `Expected clear 404 guidance, got: ${errMsg}`);
      const errorBadge = await page.textContent("#workspace-state-badge");
      assert.ok(errorBadge.includes("Workspace Not Created"), `Expected Workspace Not Created badge, got: ${errorBadge}`);
      await page.unroute("**/api/create/scaffold");

      const iconFragPath = path.join(tmpRoot, "projects", "pw-fast-demo", "fragment.html");
      const iconReportPath = path.join(tmpRoot, "projects", "pw-fast-demo", "index.html");
      const updatedFrag = pwFrag.replace(
        "</main>",
        `\n  <section id="icon-check"><h2 id="icon-h">Icons</h2><p><i data-lucide="activity" class="w-4 h-4"></i></p></section>\n</main>`
      );
      fs.writeFileSync(iconFragPath, updatedFrag, "utf8");
      const builtIcons = buildReport({ content: updatedFrag, contentPath: iconFragPath, title: "Icon Report Test" });
      fs.writeFileSync(iconReportPath, builtIcons.html, "utf8");
      await page.goto(`${baseUrl}/projects/pw-fast-demo/index.html`, { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelectorAll("svg.lucide").length > 0, null, { timeout: 10000 });
      const reportIcons = await page.evaluate(() => document.querySelectorAll("svg.lucide").length);
      assert.ok(reportIcons > 0, "Built report must also render Lucide SVG icons via fallback mirror if jsDelivr fails");
    } finally {
      await browser.close();
    }
  });
});
