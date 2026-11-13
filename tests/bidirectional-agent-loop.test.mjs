import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { HTMLReportAgent } from "../skills/html-report/assets/report-runtime.js";
import { startServer, SessionStateStore } from "../skills/html-report/scripts/serve-report.mjs";
import { buildReport } from "../skills/html-report/scripts/build-report.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("1. DOM & Chart Context Serialization (HTMLReportAgent.serializeElementContext)", () => {
  // Test null / undefined fallback
  const nullContext = HTMLReportAgent.serializeElementContext(null);
  assert.strictEqual(nullContext.elementId, null);
  assert.strictEqual(nullContext.selector, null);
  assert.strictEqual(nullContext.datasetState, null);
  assert.strictEqual(typeof nullContext.activeTheme, "string");

  // Mock DOM Element with Chart.js canvas
  const mockCanvas = {
    tagName: "CANVAS",
    id: "latency-chart-canvas"
  };

  const mockContainer = {
    id: "incident-metrics-card",
    tagName: "DIV",
    className: "card bg-base-100 p-4",
    dataset: { cohort: "production", region: "eu-west-1" },
    getAttribute: (attr) => (attr === "data-agent-target" ? "incident-metrics-card" : null),
    closest: () => null,
    querySelector: (sel) => (sel === "canvas" ? mockCanvas : null),
    outerHTML: '<div id="incident-metrics-card" class="card bg-base-100 p-4"><h2>Incident Metrics</h2><canvas id="latency-chart-canvas"></canvas></div>'
  };

  // Mock global Chart.js registry
  global.Chart = {
    getChart: (el) => {
      if (el === mockCanvas) {
        return {
          config: { type: "line" },
          data: {
            labels: ["00:00", "01:00", "02:00", "03:00"],
            datasets: [
              { label: "P99 Latency (ms)", data: [120, 140, 480, 130] },
              { label: "Error Rate (%)", data: [0.1, 0.2, 5.4, 0.15] }
            ]
          }
        };
      }
      return null;
    }
  };

  const serialized = HTMLReportAgent.serializeElementContext(mockContainer);

  assert.strictEqual(serialized.elementId, "incident-metrics-card");
  assert.strictEqual(serialized.selector, "#incident-metrics-card");
  assert.ok(serialized.domSnippet.includes("Incident Metrics"));
  assert.ok(serialized.datasetState, "Dataset state should be captured");
  assert.strictEqual(serialized.datasetState.type, "line");
  assert.strictEqual(serialized.datasetState.labels.length, 4);
  assert.strictEqual(serialized.datasetState.datasets.length, 2);
  assert.strictEqual(serialized.datasetState.datasets[0].label, "P99 Latency (ms)");

  // Verify payload limit < 10KB
  const payloadString = JSON.stringify(serialized);
  const payloadBytes = Buffer.byteLength(payloadString, "utf8");
  assert.ok(payloadBytes < 10240, `Context payload must be < 10KB (was ${payloadBytes} bytes)`);

  delete global.Chart;
});

test("2. Multi-Turn SessionStateStore & Inactivity Pruning", () => {
  const store = new SessionStateStore(50); // 50ms TTL for testing
  const sessionId = "test-session-42";

  // Create & add messages
  const session = store.getOrCreate(sessionId);
  assert.strictEqual(session.id, sessionId);
  assert.strictEqual(session.history.length, 0);

  store.addMessage(sessionId, "user", "What is the primary latency driver?");
  store.addMessage(sessionId, "assistant", "Database connection pool exhaustion at 02:15.");

  const active = store.get(sessionId);
  assert.ok(active, "Session should be active");
  assert.strictEqual(active.history.length, 2);
  assert.strictEqual(active.history[0].role, "user");
  assert.strictEqual(active.history[1].role, "assistant");

  // Pending action lifecycle
  const action = {
    id: "act_pool_size",
    type: "adjust_db_pool",
    description: "Increase pool max_connections from 50 to 120"
  };
  store.storePendingAction(sessionId, action);
  assert.strictEqual(store.getPendingAction(sessionId, "act_pool_size")?.id, "act_pool_size");

  const resolved = store.resolveAction(sessionId, "act_pool_size", true);
  assert.strictEqual(resolved.status, "approved");
  assert.ok(resolved.resolvedAt > 0);

  // Test pruning after idle TTL
  return new Promise((resolve) => {
    setTimeout(() => {
      store.prune();
      assert.strictEqual(store.get(sessionId), null, "Session should be pruned after idle TTL");
      resolve();
    }, 70);
  });
});

test("3. Dev Server Streaming POST /api/agent/prompt & Datastar SSE", async () => {
  const tempDir = path.join(__dirname, "../dev");
  const tempHtml = path.join(tempDir, "agent-loop-test.html");
  fs.writeFileSync(tempHtml, '<!DOCTYPE html><html><body><div id="test-card">Metrics</div></body></html>', "utf-8");

  const initialPort = 3600 + Math.floor(Math.random() * 200);
  const serverInstance = await startServer(tempHtml, initialPort, false);
  const activePort = serverInstance.serverPort;
  const sessionId = "session-bidirectional-" + Date.now();

  try {
    await new Promise((r) => setTimeout(r, 120));

    // 3a. POST /api/agent/prompt JSON multi-turn conversation
    const promptPayload = {
      sessionId,
      prompt: "What is current error rate?",
      targetSelector: "#test-card",
      context: { elementId: "test-card", activeTheme: "light" },
      format: "json",
      heuristic: true,
      stream: false
    };

    const resJson = await fetch(`http://127.0.0.1:${activePort}/api/agent/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(promptPayload)
    });

    assert.strictEqual(resJson.status, 200);
    const bodyJson = await resJson.json();
    assert.strictEqual(bodyJson.ok, true);
    assert.strictEqual(bodyJson.sessionId, sessionId);
    assert.ok(bodyJson.result.length > 0);
    assert.strictEqual(bodyJson.history.length, 2, "Session history should contain user + assistant messages");

    // 3b. Multi-turn continuation prompt with recalculation action proposal
    const prompt2Payload = {
      sessionId,
      prompt: "Please recalculate error spikes by excluding timeout failures",
      targetSelector: "#test-card",
      format: "json",
      heuristic: true,
      stream: false
    };

    const res2 = await fetch(`http://127.0.0.1:${activePort}/api/agent/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prompt2Payload)
    });

    const body2 = await res2.json();
    assert.strictEqual(body2.ok, true);
    assert.strictEqual(body2.history.length, 4, "Session should accumulate 4 messages across 2 turns");
    assert.ok(body2.action, "Recalculation prompt should propose a structured action");
    assert.strictEqual(body2.action.type, "recalculate_metric");

    // 3c. Streaming Datastar SSE verification
    const ssePayload = {
      sessionId,
      prompt: "Filter telemetry and re-evaluate",
      targetSelector: "#test-card",
      heuristic: true,
      stream: true
    };

    const sseRes = await fetch(`http://127.0.0.1:${activePort}/api/agent/prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
      },
      body: JSON.stringify(ssePayload)
    });

    assert.strictEqual(sseRes.status, 200);
    assert.ok(sseRes.headers.get("content-type").includes("text/event-stream"));

    const sseText = await sseRes.text();
    assert.ok(sseText.includes("event: datastar-merge-fragments"), "Stream should emit datastar-merge-fragments event");
    assert.ok(sseText.includes('id="test-card"'), "Stream should target targetSelector");
    assert.ok(sseText.includes("event: message"), "Stream should emit final dock message payload");

    // 3d. Mutating Action Approval via POST /api/agent/confirm-action
    const actionId = body2.action.id;
    const approveRes = await fetch(`http://127.0.0.1:${activePort}/api/agent/confirm-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        actionId,
        approved: true
      })
    });

    assert.strictEqual(approveRes.status, 200);
    const approveBody = await approveRes.json();
    assert.strictEqual(approveBody.ok, true);
    assert.strictEqual(approveBody.actionId, actionId);
    assert.strictEqual(approveBody.approved, true);
    assert.strictEqual(approveBody.executed, true);

  } finally {
    if (serverInstance && serverInstance.close) {
      await serverInstance.close();
    }
    try { fs.unlinkSync(tempHtml); } catch (_) {}
  }
});

test("4. Template Shell Embedding of HTMLReportAgentDock & Keyboard Shortcut Affordance", () => {
  const buildResult = buildReport({
    title: "Agent Dock Test",
    content: '<div class="card" id="test-card">Card Content</div>'
  });
  const html = buildResult.html;

  // Verify dock elements
  assert.ok(html.includes('id="agent-dock-launcher"'), "Shell must embed agent dock launcher button");
  assert.ok(html.includes('id="agent-dock-panel"'), "Shell must embed agent dock panel");
  assert.ok(html.includes('id="agent-dock-messages"'), "Shell must embed agent dock messages container");
  assert.ok(html.includes('id="agent-dock-input"'), "Shell must embed agent dock input field");
  assert.ok(html.includes('id="agent-dock-context-bar"'), "Shell must embed agent dock element context bar");
  assert.ok(html.includes("⌘K"), "Shell must display Cmd+K keyboard shortcut badge");

  // Verify client runtime dock methods
  assert.strictEqual(typeof HTMLReportAgent.openDock, "function");
  assert.strictEqual(typeof HTMLReportAgent.closeDock, "function");
  assert.strictEqual(typeof HTMLReportAgent.toggleDock, "function");
  assert.strictEqual(typeof HTMLReportAgent.setTargetElement, "function");
  assert.strictEqual(typeof HTMLReportAgent.clearTargetElement, "function");
  assert.strictEqual(typeof HTMLReportAgent.serializeElementContext, "function");
  assert.strictEqual(typeof HTMLReportAgent.sendPrompt, "function");
  assert.strictEqual(typeof HTMLReportAgent.confirmAction, "function");
});
