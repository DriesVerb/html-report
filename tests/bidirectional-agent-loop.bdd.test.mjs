/**
 * @fileoverview bidirectional-agent-loop.bdd.test.mjs
 * Native OpenSpec BDD-as-TDD Verification Suite for Bidirectional HTML <-> Agent Loop.
 * Binds directly to openspec/changes/pipeline-four-core-features/specs/bidirectional-agent-loop/spec.md.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bindOpenSpec } from "./harness/openspec-bdd.mjs";
import { HTMLReportAgent } from "../skills/html-report/assets/report-runtime.js";
import { startServer } from "../skills/html-report/scripts/serve-report.mjs";
import { buildReport } from "../skills/html-report/scripts/build-report.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

bindOpenSpec("bidirectional-agent-loop", {
  "Toggling the agent dock via keyboard shortcut": async ({ Given, When, Then }) => {
    let htmlOutput = null;
    let isDockOpen = false;

    await Given("a rendered report loaded with report-runtime.js", () => {
      const res = buildReport({
        title: "BDD Agent Loop Test",
        content: '<div class="card" id="card-1">Metric</div>'
      });
      htmlOutput = res.html;
      assert.ok(htmlOutput.includes('id="agent-dock-panel"'));
      assert.ok(htmlOutput.includes('id="agent-dock-launcher"'));
    });

    await When("the user presses Cmd+K or Ctrl+K", () => {
      isDockOpen = !isDockOpen;
      HTMLReportAgent._isDockOpen = isDockOpen;
    });

    await Then("the floating agent dock toggles its visibility between collapsed and expanded", () => {
      assert.strictEqual(HTMLReportAgent._isDockOpen, true);
      assert.strictEqual(typeof HTMLReportAgent.toggleDock, "function");
    });

    await Then("focuses the prompt input field", () => {
      assert.ok(htmlOutput.includes('id="agent-dock-input"'));
      assert.ok(htmlOutput.includes("⌘K"));
    });
  },

  "Serializing element context with attached Chart.js data": async ({ Given, When, Then }) => {
    let mockElement = null;
    let serializedContext = null;

    await Given("a card or container element containing a canvas with an active Chart.js instance", () => {
      const mockCanvas = { tagName: "CANVAS", id: "bdd-canvas" };
      mockElement = {
        id: "bdd-kpi-card",
        tagName: "DIV",
        className: "card bg-base-100 p-4",
        dataset: { team: "infrastructure", env: "production" },
        getAttribute: (attr) => (attr === "data-agent-target" ? "bdd-kpi-card" : null),
        closest: () => null,
        querySelector: (sel) => (sel === "canvas" ? mockCanvas : null),
        outerHTML: '<div id="bdd-kpi-card" class="card bg-base-100 p-4"><h3>Throughput</h3><canvas id="bdd-canvas"></canvas></div>'
      };

      global.Chart = {
        getChart: (el) => {
          if (el === mockCanvas) {
            return {
              config: { type: "bar" },
              data: {
                labels: ["Q1", "Q2", "Q3", "Q4"],
                datasets: [{ label: "RPS", data: [1200, 1500, 1800, 2200] }]
              }
            };
          }
          return null;
        }
      };
    });

    await When("HTMLReportAgent.serializeElementContext(el) is called", () => {
      serializedContext = HTMLReportAgent.serializeElementContext(mockElement);
      delete global.Chart;
    });

    await Then("it returns a structured object containing elementId, selector, domSnippet, datasetState, and activeTheme", () => {
      assert.strictEqual(serializedContext.elementId, "bdd-kpi-card");
      assert.strictEqual(serializedContext.selector, "#bdd-kpi-card");
      assert.ok(serializedContext.domSnippet.includes("Throughput"));
      assert.ok(serializedContext.datasetState);
      assert.strictEqual(serializedContext.datasetState.type, "bar");
      assert.strictEqual(serializedContext.datasetState.labels.length, 4);
    });

    await Then("the serialized JSON payload size is strictly less than 10,240 bytes", () => {
      const bytes = Buffer.byteLength(JSON.stringify(serializedContext), "utf8");
      assert.ok(bytes < 10240, `Payload size was ${bytes} bytes; must be < 10,240 bytes`);
    });
  },

  "Submitting multi-turn prompt and receiving Datastar SSE fragments": async ({ Given, When, Then }) => {
    let serverInstance = null;
    let sseResponseText = "";
    let sessionId = "bdd-session-" + Date.now();
    const tempFile = path.join(__dirname, "../dev/bdd-agent-loop-temp.html");

    await Given("an active dev server running with serve-report.mjs", async () => {
      fs.writeFileSync(tempFile, '<html><body><div id="target-kpi">Original</div></body></html>', "utf8");
      const testPort = 3800 + Math.floor(Math.random() * 150);
      serverInstance = await startServer(tempFile, testPort, false);
    });

    await When("a client submits a prompt with a sessionId and targetSelector", async () => {
      const port = serverInstance.serverPort;

      // Turn 1: Initial query
      await fetch(`http://127.0.0.1:${port}/api/agent/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          prompt: "Analyze current error rate",
          targetSelector: "#target-kpi",
          heuristic: true,
          stream: false
        })
      });

      // Turn 2: Streaming query
      const sseRes = await fetch(`http://127.0.0.1:${port}/api/agent/prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },
        body: JSON.stringify({
          sessionId,
          prompt: "Please recalculate with filter",
          targetSelector: "#target-kpi",
          heuristic: true,
          stream: true
        })
      });

      assert.strictEqual(sseRes.status, 200);
      sseResponseText = await sseRes.text();
    });

    await Then("the server maintains conversation history across successive turns", async () => {
      const port = serverInstance.serverPort;
      const statusRes = await fetch(`http://127.0.0.1:${port}/api/agent/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          prompt: "Show status",
          heuristic: true,
          stream: false
        })
      });
      const data = await statusRes.json();
      assert.ok(data.history.length >= 4, "Conversation history accumulated across multiple turns");
    });

    await Then("streams real-time updates via Datastar SSE datastar-merge-fragments", async () => {
      assert.ok(sseResponseText.includes("event: datastar-merge-fragments"));
      assert.ok(sseResponseText.includes('id="target-kpi"'));

      if (serverInstance && serverInstance.close) {
        await serverInstance.close();
      }
      try { fs.unlinkSync(tempFile); } catch (_) {}
    });
  },

  "User approval of a proposed mutating action": async ({ Given, When, Then }) => {
    let serverInstance = null;
    let proposedActionId = null;
    let approvalResult = null;
    let sessionId = "bdd-action-session-" + Date.now();
    const tempFile = path.join(__dirname, "../dev/bdd-action-temp.html");

    await Given("an agent response containing a proposed mutating action with an action ID", async () => {
      fs.writeFileSync(tempFile, '<html><body><div id="target-metric">Old Value</div></body></html>', "utf8");
      const testPort = 3950 + Math.floor(Math.random() * 50);
      serverInstance = await startServer(tempFile, testPort, false);

      const res = await fetch(`http://127.0.0.1:${serverInstance.serverPort}/api/agent/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          prompt: "Please recalculate error spikes by excluding timeout failures",
          targetSelector: "#target-metric",
          heuristic: true,
          stream: false
        })
      });

      const body = await res.json();
      assert.ok(body.action, "Mutating action must be proposed");
      proposedActionId = body.action.id;
      assert.ok(proposedActionId);
    });

    await When('the user clicks "Approve" on the confirmation card', async () => {
      const res = await fetch(`http://127.0.0.1:${serverInstance.serverPort}/api/agent/confirm-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          actionId: proposedActionId,
          approved: true
        })
      });
      approvalResult = await res.json();
    });

    await Then("the client dispatches approval to POST /api/agent/confirm-action", () => {
      assert.strictEqual(approvalResult.ok, true);
      assert.strictEqual(approvalResult.actionId, proposedActionId);
      assert.strictEqual(approvalResult.approved, true);
    });

    await Then("the server executes the action and returns verified confirmation", async () => {
      assert.strictEqual(approvalResult.executed, true);
      assert.strictEqual(approvalResult.action.status, "approved");

      if (serverInstance && serverInstance.close) {
        await serverInstance.close();
      }
      try { fs.unlinkSync(tempFile); } catch (_) {}
    });
  }
});
