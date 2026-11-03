import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const datastarSsePath = path.resolve(__dirname, "../skills/html-report/scripts/datastar-sse.mjs");
const mockStreamersPath = path.resolve(__dirname, "../tests/harness/mock-streamers.mjs");
const buildReportPath = path.resolve(__dirname, "../skills/html-report/scripts/build-report.mjs");
const playwrightPath = path.resolve(__dirname, "../skills/html-report/playwright/node_modules/playwright/index.mjs");

const {
  TaskTelemetrySchema,
  SessionState,
  ToolInvocationRecord,
  DatastarBridge,
  AgyTelemetryAdapter,
  CodexTelemetryAdapter
} = await import(datastarSsePath);

const { MockAgyStreamer, MockCodexStreamer } = await import(mockStreamersPath);
const { buildReport } = await import(buildReportPath);
const { chromium } = await import(playwrightPath);

describe("Phase 4: Datastar.js Stream Telemetry, Schema & Test Harness", () => {
  describe("TaskTelemetrySchema & SessionState Metric Calculations", () => {
    it("should compute accurate progress and counts when tasks change state", () => {
      const session = new SessionState({
        sessionId: "test-session-001",
        phases: [
          {
            id: "phase-1",
            order: 1,
            title: "Phase 1: Setup",
            tasks: [
              { id: "1.1", title: "Setup repo", status: "pending" },
              { id: "1.2", title: "Install deps", status: "pending" }
            ]
          },
          {
            id: "phase-2",
            order: 2,
            title: "Phase 2: Execution",
            tasks: [
              { id: "2.1", title: "Write code", status: "pending" },
              { id: "2.2", title: "Run tests", status: "pending" }
            ]
          }
        ]
      });

      // Initially all pending
      assert.equal(session.metrics.totalTasks, 4);
      assert.equal(session.metrics.completedTasks, 0);
      assert.equal(session.metrics.runningTasks, 0);
      assert.equal(session.metrics.progressPct, 0);

      // Transition 2 tasks to completed and 1 to running
      session.updateTask("1.1", { status: "completed" });
      session.updateTask("1.2", { status: "completed" });
      session.updateTask("2.1", { status: "running" });

      const metrics = session.metrics;
      assert.equal(metrics.totalTasks, 4, "Total tasks must remain 4");
      assert.equal(metrics.completedTasks, 2, "Completed tasks must be 2");
      assert.equal(metrics.runningTasks, 1, "Running tasks must be 1");
      assert.equal(metrics.progressPct, 50, "Progress percentage must be 50%");

      // Verify phase 1 is marked completed and 100%
      const phase1 = session.getPhase("phase-1");
      assert.equal(phase1.status, "completed");
      assert.equal(phase1.progressPct, 100);

      // Complete remaining task
      session.updateTask("2.1", { status: "completed" });
      session.updateTask("2.2", { status: "completed" });

      assert.equal(session.metrics.completedTasks, 4);
      assert.equal(session.metrics.progressPct, 100);
      assert.equal(session.getPhase("phase-2").status, "completed");
    });

    it("should validate schemas according to TaskTelemetrySchema rules", () => {
      assert.equal(TaskTelemetrySchema.isValidTaskStatus("running"), true);
      assert.equal(TaskTelemetrySchema.isValidTaskStatus("invalid_status"), false);
      assert.equal(TaskTelemetrySchema.isValidSessionStatus("completed"), true);

      assert.throws(() => {
        TaskTelemetrySchema.validateTask({ id: "t1" }); // missing title
      });

      assert.doesNotThrow(() => {
        TaskTelemetrySchema.validateTask({ id: "t1", title: "Valid Task", status: "pending" });
      });
    });
  });

  describe("DatastarBridge SSE Serialization & Component Rendering", () => {
    it("should format datastar-fragment SSE messages with correct selector and mergeMode", () => {
      const fragmentSse = DatastarBridge.formatFragment({
        selector: "#task-1.1",
        mergeMode: "outer",
        html: '<div id="task-1.1">Updated Task</div>'
      });

      assert.ok(fragmentSse.includes("event: datastar-fragment"));
      assert.ok(fragmentSse.includes("data: selector #task-1.1"));
      assert.ok(fragmentSse.includes("data: merge outer"));
      assert.ok(fragmentSse.includes('data: fragment <div id="task-1.1">Updated Task</div>'));
    });

    it("should format datastar-merge-signals SSE message", () => {
      const signalsSse = DatastarBridge.formatSignals({ session: { progressPct: 75, completed: 3 } });
      assert.ok(signalsSse.includes("event: datastar-merge-signals"));
      assert.ok(signalsSse.includes('data: signals {"session":{"progressPct":75,"completed":3}}'));
    });

    it("should render active task cards with spinner and badge", () => {
      const bridge = new DatastarBridge();
      const task = {
        id: "task-live-1",
        title: "Streaming Parser Implementation",
        status: "running",
        assignedTo: "AGY Planner"
      };

      const html = bridge.renderTaskCard(task);
      assert.ok(html.includes('id="task-task-live-1"'));
      assert.ok(html.includes("loading-spinner"));
      assert.ok(html.includes("badge-primary"));
      assert.ok(html.includes("AGY Planner"));
    });

    it("should render completed task cards with checkmark icon and line-through title", () => {
      const bridge = new DatastarBridge();
      const task = {
        id: "task-live-2",
        title: "Test Harness Setup",
        status: "completed",
        durationMs: 1500
      };

      const html = bridge.renderTaskCard(task);
      assert.ok(html.includes('id="task-task-live-2"'));
      assert.ok(html.includes("badge-success"));
      assert.ok(html.includes('data-lucide="check"'));
      assert.ok(html.includes("line-through"));
      assert.ok(html.includes("1.5s"));
    });

    it("should render tool invocation cards with terminal drawer mockup-code", () => {
      const bridge = new DatastarBridge();
      const tool = new ToolInvocationRecord({
        toolCallId: "call_abc123",
        toolName: "run_command",
        inputSummary: "npm test --live",
        outputSummary: "PASS: all 42 tests passed\nTime: 1.2s",
        status: "success",
        durationMs: 1200
      });

      const html = bridge.renderToolCard(tool);
      assert.ok(html.includes('id="tool-call_abc123"'));
      assert.ok(html.includes('data-lucide="terminal"'));
      assert.ok(html.includes("mockup-code"));
      assert.ok(html.includes("PASS: all 42 tests passed"));
      assert.ok(html.includes("1200ms"));
    });
  });

  describe("Vendor-Neutral Adapters: AGY & Codex", () => {
    it("should process AGY steps and dispatch thought and tool events without throwing", () => {
      const session = new SessionState({ agentType: "agy" });
      const bridge = new DatastarBridge({ sessionState: session });
      const adapter = new AgyTelemetryAdapter({ sessionState: session, bridge });

      const thoughts = [];
      const toolInvocations = [];

      adapter.on("thought.delta", (t) => thoughts.push(t));
      adapter.on("tool.invoked", (t) => toolInvocations.push(t));

      const step = {
        step_index: 3,
        thinking: "Evaluating system performance metrics under load.",
        tool_calls: [
          {
            id: "agy_call_1",
            name: "read_file",
            args: { Path: "src/telemetry.js" }
          }
        ]
      };

      adapter.processStep(step);

      assert.equal(thoughts.length, 1);
      assert.equal(thoughts[0].text, "Evaluating system performance metrics under load.");
      assert.equal(toolInvocations.length, 1);
      assert.equal(toolInvocations[0].toolName, "read_file");
      assert.equal(toolInvocations[0].inputSummary, "src/telemetry.js");
      assert.ok(session.tools.has("agy_call_1"));
    });

    it("should process OpenAI Codex streaming chunks and tool calls", () => {
      const session = new SessionState({ agentType: "codex" });
      const bridge = new DatastarBridge({ sessionState: session });
      const adapter = new CodexTelemetryAdapter({ sessionState: session, bridge });

      const thoughts = [];
      const toolInvocations = [];

      adapter.on("thought.delta", (t) => thoughts.push(t));
      adapter.on("tool.invoked", (t) => toolInvocations.push(t));

      // 1. Send reasoning chunk
      adapter.processChunk({
        choices: [
          {
            delta: { reasoning_content: "Codex reasoning step: calculating token bounds." }
          }
        ]
      });

      // 2. Send tool call chunk
      adapter.processChunk({
        choices: [
          {
            finish_reason: "tool_calls",
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "codex_call_42",
                  function: {
                    name: "run_command",
                    arguments: '{"CommandLine": "node test.js"}'
                  }
                }
              ]
            }
          }
        ]
      });

      assert.equal(thoughts.length, 1);
      assert.ok(thoughts[0].text.includes("calculating token bounds"));
      assert.equal(toolInvocations.length, 1);
      assert.equal(toolInvocations[0].toolName, "run_command");
      assert.ok(session.tools.has("codex_call_42"));
    });
  });

  describe("Synthetic Burst Load Stress Test (100 events in < 2s)", () => {
    it("should replay 100 simulated AGY events in < 2000ms with zero memory corruption", () => {
      const session = new SessionState({ agentType: "agy" });
      const bridge = new DatastarBridge({ sessionState: session });
      const adapter = new AgyTelemetryAdapter({ sessionState: session, bridge });
      const streamer = new MockAgyStreamer(adapter);

      const startTime = Date.now();
      const count = streamer.replayBurst(100);
      const elapsed = Date.now() - startTime;

      assert.ok(count >= 50, "Must have processed at least 50 step pairs");
      assert.ok(elapsed < 2000, `Burst execution must finish under 2000ms (took ${elapsed}ms)`);
      assert.ok(session.tools.size >= 50, "All tool calls must be registered in session state");
    });

    it("should replay 100 simulated Codex chunks in < 2000ms without dropped frames", () => {
      const session = new SessionState({ agentType: "codex" });
      const bridge = new DatastarBridge({ sessionState: session });
      const adapter = new CodexTelemetryAdapter({ sessionState: session, bridge });
      const streamer = new MockCodexStreamer(adapter);

      const startTime = Date.now();
      const count = streamer.replayBurst(100);
      const elapsed = Date.now() - startTime;

      assert.ok(count >= 50, "Must have processed at least 50 chunk pairs");
      assert.ok(elapsed < 2000, `Burst execution must finish under 2000ms (took ${elapsed}ms)`);
      assert.ok(session.tools.size >= 50, "All tool calls must be recorded in session");
    });
  });

  describe("Post-Morph Lucide Icon Rehydration (Headless Playwright)", () => {
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

      const tempFile = path.resolve(__dirname, "../tmp-rehydration-test.html");
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
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    });
  });

  describe("Phase 5: Dev Server & /__datastar_stream__ SSE Endpoint", () => {
    it("should accept SSE subscribers and broadcast morphed fragments via POST", async () => {
      const serveReportPath = path.resolve(__dirname, "../skills/html-report/scripts/serve-report.mjs");
      const { startServer } = await import(serveReportPath);

      const tempReport = path.resolve(__dirname, "../tmp-dev-server-test.html");
      fs.writeFileSync(tempReport, "<!DOCTYPE html><html><body><h1>Server Test</h1></body></html>", "utf-8");

      const testPort = 34567 + Math.floor(Math.random() * 5000);
      const serverHandle = await startServer(tempReport, testPort, false);

      const http = await import("node:http");

      // 1. Subscribe to GET /__datastar_stream__
      const receivedChunks = [];
      const sseReq = http.request({
        hostname: "localhost",
        port: serverHandle.serverPort,
        path: "/__datastar_stream__",
        method: "GET"
      }, (res) => {
        assert.equal(res.statusCode, 200);
        assert.ok(res.headers["content-type"].includes("text/event-stream"));
        res.on("data", (chunk) => {
          receivedChunks.push(chunk.toString("utf-8"));
        });
      });
      sseReq.end();

      // Allow connection to establish
      await new Promise((r) => setTimeout(r, 100));

      // 2. Publish update via POST /__datastar_stream__
      const postPayload = JSON.stringify({
        selector: "#task-42",
        mergeMode: "outer",
        html: '<div id="task-42" class="text-success">Task 42 Completed</div>'
      });

      const postRes = await new Promise((resolve, reject) => {
        const postReq = http.request({
          hostname: "localhost",
          port: serverHandle.serverPort,
          path: "/__datastar_stream__",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postPayload)
          }
        }, (res) => {
          let body = "";
          res.on("data", (d) => { body += d; });
          res.on("end", () => resolve({ statusCode: res.statusCode, body }));
        });
        postReq.on("error", reject);
        postReq.write(postPayload);
        postReq.end();
      });

      assert.equal(postRes.statusCode, 200);
      const postJson = JSON.parse(postRes.body);
      assert.equal(postJson.ok, true);
      assert.ok(postJson.listeners >= 1);

      // Allow event propagation
      await new Promise((r) => setTimeout(r, 100));

      const combinedOutput = receivedChunks.join("");
      assert.ok(combinedOutput.includes("event: connected"));
      assert.ok(combinedOutput.includes("event: datastar-fragment"));
      assert.ok(combinedOutput.includes("selector #task-42"));
      assert.ok(combinedOutput.includes("Task 42 Completed"));

      // Clean up
      sseReq.destroy();
      await serverHandle.close();
      if (fs.existsSync(tempReport)) {
        fs.unlinkSync(tempReport);
      }
    });
  });
});
