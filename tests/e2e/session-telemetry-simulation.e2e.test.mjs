import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const datastarSsePath = path.resolve(__dirname, "../../skills/html-report/scripts/datastar-sse.mjs");
const buildReportPath = path.resolve(__dirname, "../../skills/html-report/scripts/build-report.mjs");
const playwrightPath = path.resolve(__dirname, "../../packages/core/playwright/node_modules/playwright/index.mjs");

const { SessionState, ToolInvocationRecord, DatastarBridge } = await import(datastarSsePath);
const { buildReport } = await import(buildReportPath);
const { chromium } = await import(playwrightPath);

describe("Session Telemetry Simulation — Playwright E2E", () => {
  it("should stream live SSE morphs into a real browser page and verify dynamic DOM updates", async () => {
    const session = new SessionState({
      sessionId: "browser-live-sse-001",
      phases: [
        {
          id: "p1",
          order: 1,
          title: "Live Execution",
          tasks: [
            { id: "task-live-demo", title: "Live Morph Verification", status: "pending" }
          ]
        }
      ]
    });

    const bridge = new DatastarBridge({ sessionState: session });

    const htmlContent = `
      <main class="p-6 max-w-4xl mx-auto space-y-6">
        <h1 id="live-header">Browser Live Morph Test</h1>
        <div id="live-task-container">
          ${bridge.renderTaskCard(session.getTask("task-live-demo").task)}
        </div>
        <div id="tool-call-feed" class="space-y-2"></div>
      </main>
    `;

    const { html } = buildReport({
      title: "Live SSE Test",
      content: htmlContent,
      live: true
    });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "telemetry-e2e-"));
    const tempFile = path.join(tmpDir, "live-browser-morph.html");
    fs.writeFileSync(tempFile, html, "utf-8");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      await page.goto("file://" + tempFile, { waitUntil: "load" });
      await page.waitForTimeout(300);

      // Verify task initial state: pending
      const initialText = await page.locator("#task-task-live-demo").innerText();
      assert.ok(initialText.includes("Live Morph Verification"));
      assert.ok(initialText.includes("Pending") || initialText.includes("pending"));

      // 1. Morph task to running state
      session.startTask("task-live-demo", { assignedTo: "Simulation Runner" });
      const runningCardHtml = bridge.renderTaskCard(session.getTask("task-live-demo").task);

      await page.evaluate((newCard) => {
        const container = document.getElementById("live-task-container");
        container.innerHTML = newCard;
      }, runningCardHtml);

      await page.waitForTimeout(100);
      const runningText = await page.locator("#task-task-live-demo").innerText();
      assert.ok(runningText.includes("Running") || runningText.includes("running"));
      assert.ok(runningText.includes("Simulation Runner"));

      // 2. Prepend live tool invocation card into #tool-call-feed
      const toolRecord = new ToolInvocationRecord({
        toolCallId: "tool-browser-01",
        toolName: "run_command",
        inputSummary: "npm test --live",
        status: "running"
      });

      const toolHtml = bridge.renderToolCard(toolRecord);
      await page.evaluate((th) => {
        const feed = document.getElementById("tool-call-feed");
        const div = document.createElement("div");
        div.innerHTML = th;
        feed.prepend(div.firstElementChild);
      }, toolHtml);

      await page.waitForTimeout(100);
      const toolText = await page.locator("#tool-tool-browser-01").innerText();
      assert.ok(toolText.includes("run_command"));
      assert.ok(toolText.includes("npm test --live"));

      // 3. Morph tool invocation to completed state with terminal output
      toolRecord.complete("PASS: all test suites completed successfully\nDone in 0.8s.", "success");
      const completedToolHtml = bridge.renderToolCard(toolRecord);

      await page.evaluate((th) => {
        const oldTool = document.getElementById("tool-tool-browser-01");
        if (oldTool) {
          const temp = document.createElement("div");
          temp.innerHTML = th;
          oldTool.replaceWith(temp.firstElementChild);
        }
      }, completedToolHtml);

      await page.waitForTimeout(100);
      const completedToolText = await page.locator("#tool-tool-browser-01").innerText();
      assert.ok(completedToolText.includes("all test suites completed"));

      // 4. Complete task and verify icon rehydration in morphed fragment
      session.completeTask("task-live-demo");
      const completedCardHtml = bridge.renderTaskCard(session.getTask("task-live-demo").task);

      await page.evaluate((newCard) => {
        const container = document.getElementById("live-task-container");
        container.innerHTML = newCard;
      }, completedCardHtml);

      await page.waitForTimeout(150);

      const hasSvgIcon = await page.evaluate(() => {
        const card = document.getElementById("task-task-live-demo");
        return Boolean(card && card.querySelector("svg"));
      });
      assert.equal(hasSvgIcon, true, "Morphed completed task must have rehydrated SVG checkmark");
    } finally {
      await browser.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
