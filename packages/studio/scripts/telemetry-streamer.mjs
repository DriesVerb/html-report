#!/usr/bin/env node
/**
 * telemetry-streamer.mjs
 * Streams real-time LLM telemetry (Chain-of-Thought, Tool Invocations, Task Progress)
 * to http://localhost:3000/__datastar_stream__ using DatastarBridge and AgyTelemetryAdapter.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {
  DatastarBridge,
  SessionState,
  AgyTelemetryAdapter,
  ToolInvocationRecord
} from "./datastar-sse.mjs";

export function pushSSEToDevServer(payload, { port = 3000, host = "127.0.0.1" } = {}) {
  return new Promise((resolve, reject) => {
    const data = typeof payload === "string" ? payload : JSON.stringify(payload);
    const req = http.request(
      {
        hostname: host,
        port,
        path: "/__datastar_stream__",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data)
        }
      },
      (res) => {
        let respBody = "";
        res.on("data", (c) => { respBody += c; });
        res.on("end", () => {
          try {
            resolve(JSON.parse(respBody));
          } catch (_) {
            resolve({ ok: res.statusCode === 200, raw: respBody });
          }
        });
      }
    );

    req.on("error", (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Creates a telemetry streamer pipeline wired to http://localhost:3000/__datastar_stream__
 */
export class LiveTelemetryStreamer {
  constructor({ port = 3000, host = "127.0.0.1", session = null } = {}) {
    this.port = port;
    this.host = host;
    this.session = session || new SessionState({ agentType: "agy", status: "running" });
    this.bridge = new DatastarBridge(this.session);
    this.adapter = new AgyTelemetryAdapter({ bridge: this.bridge, sessionState: this.session });

    // Whenever bridge produces an SSE chunk, post it to the dev server
    this.bridge.on("sse", (sseChunk) => {
      this.sendRawSSE(sseChunk).catch(() => {});
    });
  }

  async sendRawSSE(sseString) {
    return pushSSEToDevServer(sseString, { port: this.port, host: this.host });
  }

  async sendFragment({ selector, mergeMode = "outer", html }) {
    const sse = DatastarBridge.formatFragment({ selector, mergeMode, html });
    return this.sendRawSSE(sse);
  }

  async sendSignals(signals) {
    const sse = DatastarBridge.formatSignals(signals);
    return this.sendRawSSE(sse);
  }

  async streamThought(thoughtText) {
    const html = `
<div class="chat chat-start mb-2 animate-fade-in">
  <div class="chat-header text-3xs font-mono opacity-70 mb-0.5 flex items-center gap-1.5">
    <span class="badge badge-primary badge-xs">Agent CoT</span>
    <span>${new Date().toLocaleTimeString()}</span>
  </div>
  <div class="chat-bubble chat-bubble-primary text-xs leading-relaxed font-mono opacity-90 shadow-sm">
    ${thoughtText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
  </div>
</div>`.trim();
    return this.sendFragment({
      selector: "#agent-thought-stream",
      mergeMode: "prepend",
      html
    });
  }

  async emitToolCall({ name, args, toolId = null }) {
    const id = toolId || `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const record = this.session.recordToolInvocation({
      toolCallId: id,
      toolName: name,
      inputSummary: typeof args === "object" ? JSON.stringify(args) : String(args),
      status: "running"
    });
    const html = this.bridge.renderToolCard(record);
    await this.sendFragment({
      selector: "#tool-call-feed",
      mergeMode: "prepend",
      html
    });
    return record;
  }

  async completeToolCall(toolCallId, { output = "", durationMs = 120, status = "success" } = {}) {
    const record = this.session.recordToolResult(toolCallId, {
      outputSummary: typeof output === "object" ? JSON.stringify(output, null, 2) : String(output),
      status
    });
    if (durationMs) record.durationMs = durationMs;
    const html = this.bridge.renderToolCard(record);
    await this.sendFragment({
      selector: `#tool-${toolCallId}`,
      mergeMode: "outer",
      html
    });
    return record;
  }

  async updateTaskStatus(taskId, status, { durationMs = null, error = null } = {}) {
    const updates = { status };
    if (durationMs) updates.durationMs = durationMs;
    if (error) updates.error = error;
    const hit = this.session.updateTask(taskId, updates);
    if (!hit) return null;

    const taskHtml = this.bridge.renderTaskCard(hit.task, hit.phase);
    await this.sendFragment({
      selector: `#task-${taskId}`,
      mergeMode: "outer",
      html: taskHtml
    });

    // Update phase stepper if order exists
    if (hit.phase) {
      const stepperHtml = this.bridge.renderStepperFragment(hit.phase, hit.phase.order);
      await this.sendFragment({
        selector: `#stepper-phase-${hit.phase.order}`,
        mergeMode: "outer",
        html: stepperHtml
      });
    }

    // Merge metrics
    await this.sendSignals({
      session: {
        progressPct: this.session.metrics.progressPct,
        completed: this.session.metrics.completedTasks,
        total: this.session.metrics.totalTasks,
        running: this.session.metrics.runningTasks,
        failed: this.session.metrics.failedTasks,
        elapsedMs: this.session.metrics.elapsedMs
      }
    });

    return hit;
  }
}

/**
 * Runs a realistic live simulation of an LLM agent working through tasks.
 */
export async function runSimulation({ port = 3000, delayMs = 600, burst = false } = {}) {
  console.log(`[telemetry-streamer] Starting LLM live simulation on port ${port}...`);
  const streamer = new LiveTelemetryStreamer({ port });

  const sleep = (ms) => new Promise((r) => setTimeout(r, burst ? Math.min(ms, 100) : ms));

  // Initialize sample phases if empty
  streamer.session.phases = [];
  streamer.session.addPhase({
    id: "phase-1",
    order: 1,
    title: "1. Dev Server & Showdown Artifact Viewer",
    tasks: [
      { id: "1.1", title: "MIME & OpenSpec Artifact Resolution in serve-report.mjs", status: "completed", durationMs: 450 },
      { id: "1.2", title: "Showdown In-Browser Artifact Viewer Modal", status: "completed", durationMs: 620 },
      { id: "1.3", title: "Verify Markdown Links without 404s or Downloads", status: "running" }
    ]
  });

  streamer.session.addPhase({
    id: "phase-2",
    order: 2,
    title: "2. Datastar Live Telemetry Engine & Live Tracking Dashboard",
    tasks: [
      { id: "2.1", title: "Assemble Thought Stream, Tool Feed & Task Cards", status: "running" },
      { id: "2.2", title: "Wire Reactive Signals and SSE Fragment Morphing", status: "pending" },
      { id: "2.3", title: "Responsive Horizontal Journey Stepper Standard", status: "pending" }
    ]
  });

  streamer.session.addPhase({
    id: "phase-3",
    order: 3,
    title: "3. Telemetry Streamer CLI & Verification",
    tasks: [
      { id: "3.1", title: "Create CLI Streamer and Simulation Controller", status: "pending" },
      { id: "3.2", title: "Verify with Playwright and Live SSE Streaming", status: "pending" }
    ]
  });

  console.log(`[telemetry-streamer] Simulating Agent Thought...`);
  await streamer.streamThought("Analyzing OpenSpec delta specs. Verifying that clicking on proposal.md and design.md triggers the in-browser Showdown modal smoothly.");
  await sleep(delayMs);

  console.log(`[telemetry-streamer] Simulating Tool: read_file...`);
  const t1 = await streamer.emitToolCall({
    name: "read_file",
    args: { Path: "/home/eta/projects/html-report/openspec/changes/datastar-llm-tracking-dashboard/proposal.md" }
  });
  await sleep(delayMs);
  await streamer.completeToolCall(t1.toolCallId, {
    output: `# Proposal: Datastar Live LLM Tracking Dashboard & Showdown Markdown Artifact Viewer\nLoaded 82 lines cleanly.`,
    durationMs: 42
  });

  await sleep(delayMs / 2);
  await streamer.updateTaskStatus("1.3", "completed", { durationMs: 780 });

  console.log(`[telemetry-streamer] Simulating Thought: Task 2.1...`);
  await streamer.streamThought("Task 1.3 verified. Now activating Task 2.1: Assembling Datastar hypermedia components with DaisyUI theme tokens.");
  await sleep(delayMs);

  await streamer.updateTaskStatus("2.1", "running");
  const t2 = await streamer.emitToolCall({
    name: "run_command",
    args: { CommandLine: "node skills/html-report/scripts/build-report.mjs --live --addons showdown" }
  });
  await sleep(delayMs);
  await streamer.completeToolCall(t2.toolCallId, {
    output: `[html-report] Auto-detected addons: Datastar, Showdown, Lucide, DaisyUI.\nOutput written to openspec/changes/datastar-llm-tracking-dashboard/index.html\nSize: 74.2 KB\nDeterministic assembly completed in 68ms.`,
    durationMs: 68
  });

  await streamer.updateTaskStatus("2.1", "completed", { durationMs: 1120 });
  await streamer.updateTaskStatus("2.2", "running");

  console.log(`[telemetry-streamer] Simulation step completed successfully.`);
}

// CLI entry point
const isMain = process.argv[1] && process.argv[1].endsWith("telemetry-streamer.mjs");
if (isMain) {
  const args = process.argv.slice(2);
  let port = 3000;
  let burst = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && args[i + 1]) port = parseInt(args[++i], 10);
    if (args[i] === "--burst") burst = true;
  }
  runSimulation({ port, burst }).catch((err) => {
    console.error(`[telemetry-streamer] Error:`, err.message);
  });
}
