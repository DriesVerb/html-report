import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { HTMLReportAgent } from "../skills/html-report/assets/report-runtime.js";
import { buildReport } from "../skills/html-report/scripts/build-report.mjs";

test("Turnkey AI Agent Reconnection & Auto-Recovery", async (t) => {
  await t.test("HTMLReportAgent.getReconnectPrompt constructs valid turnkey prompt", () => {
    const prompt = HTMLReportAgent.getReconnectPrompt({
      filename: "quarterly-report.html",
      port: 3000,
      title: "Q4 Performance Telemetry"
    });

    assert.ok(prompt.includes('Q4 Performance Telemetry'), "Must include report title");
    assert.ok(prompt.includes("quarterly-report.html"), "Must include filename");
    assert.ok(prompt.includes("node skills/html-report/scripts/serve-report.mjs quarterly-report.html --port 3000"), "Must include exact launch command");
    assert.ok(prompt.includes("background"), "Must mention running in background");
    assert.ok(prompt.includes("Two-Way AI Agent Bridge"), "Must identify two-way bridge capability");
    assert.ok(prompt.includes("Node.js (v18+)"), "Must specify Node.js prerequisite");
    assert.ok(prompt.includes("offline mode without Node"), "Must explain offline fallback if Node is not available");
  });

  await t.test("HTMLReportAgent handles connection state transitions and listeners", async () => {
    const states = [];
    const unsub = HTMLReportAgent.onStateChange((state) => {
      states.push(state);
    });

    assert.equal(typeof unsub, "function", "onStateChange must return unsubscribe function");

    // Probe active dev server on port 3000
    const isOnline = await HTMLReportAgent.checkConnection();
    assert.equal(isOnline, true, "Local dev server on port 3000 must be online");
    assert.equal(HTMLReportAgent.getState(), "connected");
    assert.ok(states.includes("connected"));

    unsub();
  });

  await t.test("HTMLReportAgent.copyReconnectPrompt handles clipboard and button feedback", async () => {
    // Mock button element
    const mockBtn = {
      innerHTML: "Original Text",
      classList: {
        add(cls) { this[cls] = true; },
        remove(cls) { delete this[cls]; }
      }
    };

    // Should not throw in headless / node environment
    const res = await HTMLReportAgent.copyReconnectPrompt(mockBtn, { filename: "test.html" });
    assert.ok(res === true || res === false);
  });

  await t.test("buildReport template shell includes status badge and turnkey modal", () => {
    const res = buildReport({
      title: "Reconnection Shell Inspection",
      content: "<section><h1>Telemetry Dashboard</h1></section>"
    });

    assert.ok(res.html.includes('id="agent-bridge-status-container"'), "Shell must include agent bridge status container in navbar");
    assert.ok(res.html.includes('id="agent-bridge-status-btn"'), "Shell must include status button trigger");
    assert.ok(res.html.includes('id="agent-reconnect-modal"'), "Shell must include turnkey reconnection modal dialog");
    assert.ok(res.html.includes("Node.js Requirement:"), "Shell must include clear Node.js prerequisite notice");
    assert.ok(res.html.includes('id="agent-reconnect-prompt-preview"'), "Shell must include prompt preview container");
    assert.ok(res.html.includes('id="copy-reconnect-prompt-btn"'), "Shell must include copy prompt action button");
    assert.ok(res.html.includes('id="retry-connection-btn"'), "Shell must include check connection retry button");
  });

  await t.test("buildReport with hovering AI assistant (aiDock: true) includes turnkey offline bridge in dock", () => {
    const res = buildReport({
      title: "Hovering AI Assistant Report",
      content: "<section><h1 id=\"overview\">Overview</h1></section>",
      ai: true,
      aiDock: true
    });

    assert.ok(res.html.includes('id="agent-dock-container"'), "Must include floating AI assistant dock");
    assert.ok(res.html.includes('id="agent-dock-offline-banner"'), "Dock must include turnkey offline banner");
    assert.ok(res.html.includes('id="agent-dock-reconnect-btn"'), "Dock must include Restore Bridge button");
    assert.ok(res.html.includes('id="agent-dock-copy-turnkey-btn"'), "Dock must include Copy Turnkey Prompt button");
    assert.ok(res.html.includes('id="agent-dock-retry-btn"'), "Dock must include Retry button");
    assert.ok(res.html.includes('id="agent-reconnect-modal"'), "Must include turnkey reconnection modal");
  });

  await t.test("HTMLReportAgent toggles dock offline banner on disconnected/connected state and renders offline turnkey actions", () => {
    const createClassList = (initial = []) => {
      const set = new Set(initial);
      return {
        add: (...cls) => cls.forEach((c) => set.add(c)),
        remove: (...cls) => cls.forEach((c) => set.delete(c)),
        toggle: (cls, force) => {
          if (force === undefined) {
            if (set.has(cls)) { set.delete(cls); return false; }
            set.add(cls); return true;
          }
          if (force) set.add(cls); else set.delete(cls);
          return Boolean(force);
        },
        contains: (cls) => set.has(cls)
      };
    };

    const banner = { classList: createClassList(["hidden"]) };
    const launcher = { title: "" };
    const dockStatus = { textContent: "" };
    const elements = {
      "agent-dock-offline-banner": banner,
      "agent-dock-launcher": launcher,
      "agent-dock-status": dockStatus,
      "agent-dock-dot": { className: "" },
      "agent-dock-ping": { className: "" }
    };

    const prevDocument = globalThis.document;
    globalThis.document = { getElementById: (id) => elements[id] || null };
    try {
      HTMLReportAgent._updateState("disconnected");
      assert.equal(banner.classList.contains("hidden"), false, "Offline banner must be visible when disconnected");
      assert.ok(dockStatus.textContent.includes("Turnkey"), "Dock status must indicate turnkey bridge readiness");

      HTMLReportAgent._updateState("connected");
      assert.equal(banner.classList.contains("hidden"), true, "Offline banner must be hidden when connected");
    } finally {
      globalThis.document = prevDocument;
    }

    const html = HTMLReportAgent._renderOfflineTurnkeyHtml("Offline <script>alert(1)</script>", "Summarize KPIs");
    assert.equal(HTMLReportAgent._lastOfflinePrompt, "Summarize KPIs");
    assert.ok(!html.includes("<script>"), "Must escape HTML in offline message");
    assert.ok(html.includes("Restore Bridge"), "Offline reply must include Restore Bridge button");
    assert.ok(html.includes("Copy Turnkey Prompt"), "Offline reply must include Copy Turnkey Prompt button");
  });
});
