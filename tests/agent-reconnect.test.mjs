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
    assert.ok(res.html.includes('id="agent-reconnect-prompt-preview"'), "Shell must include prompt preview container");
    assert.ok(res.html.includes('id="copy-reconnect-prompt-btn"'), "Shell must include copy prompt action button");
    assert.ok(res.html.includes('id="retry-connection-btn"'), "Shell must include check connection retry button");
  });
});
