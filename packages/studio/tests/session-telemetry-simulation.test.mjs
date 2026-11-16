import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const datastarSsePath = path.resolve(__dirname, "../../../skills/html-report/scripts/datastar-sse.mjs");
const mockStreamersPath = path.resolve(__dirname, "../../../tests/harness/mock-streamers.mjs");

const {
  SessionState,
  ToolInvocationRecord,
  DatastarBridge,
  AgyTelemetryAdapter,
  CodexTelemetryAdapter,
  TaskTelemetrySchema
} = await import(datastarSsePath);

const { MockAgyStreamer, MockCodexStreamer } = await import(mockStreamersPath);

describe("Phase 4+ Extensive End-to-End Session Simulation & Telemetry Verification", () => {
  it("should simulate a multi-phase agent session with fake tasks, tool calls, and error recovery", () => {
    // 1. Initialize session with 5 implementation phases matching tasks.md
    const session = new SessionState({
      sessionId: "session-e2e-live-001",
      agentType: "agy",
      phases: [
        {
          id: "phase-1",
          order: 1,
          title: "Build CLI & Shell Integration",
          tasks: [
            { id: "1.1", title: "Register Datastar in ADDON_REGISTRY", status: "pending" },
            { id: "1.2", title: "Add auto-detection signatures", status: "pending" },
            { id: "1.3", title: "Implement --live CLI flag", status: "pending" },
            { id: "1.4", title: "Update CSP connect-src", status: "pending" }
          ]
        },
        {
          id: "phase-2",
          order: 2,
          title: "Runtime Rehydration & Signals",
          tasks: [
            { id: "2.1", title: "Add DOM MutationObserver for Lucide", status: "pending" },
            { id: "2.2", title: "Add DaisyUI theme sync with $theme", status: "pending" }
          ]
        },
        {
          id: "phase-3",
          order: 3,
          title: "Task & Tool Telemetry Engine",
          tasks: [
            { id: "3.1", title: "Formalize TaskTelemetrySchema", status: "pending" },
            { id: "3.2", title: "Implement DatastarBridge", status: "pending" },
            { id: "3.3", title: "Implement AgyTelemetryAdapter", status: "pending" },
            { id: "3.4", title: "Implement CodexTelemetryAdapter", status: "pending" }
          ]
        },
        {
          id: "phase-4",
          order: 4,
          title: "Synthetic Simulation & Test Harness",
          tasks: [
            { id: "4.1", title: "Create MockAgyStreamer", status: "pending" },
            { id: "4.2", title: "Create MockCodexStreamer", status: "pending" },
            { id: "4.3", title: "Burst load stress test", status: "pending" },
            { id: "4.4", title: "Post-morph icon rehydration test", status: "pending" }
          ]
        },
        {
          id: "phase-5",
          order: 5,
          title: "Live Server & Showcase",
          tasks: [
            { id: "5.1", title: "Add /__datastar_stream__ endpoint", status: "pending" },
            { id: "5.2", title: "Create architectural reference guide", status: "pending" },
            { id: "5.3", title: "Update SKILL.md", status: "pending" },
            { id: "5.4", title: "Add interactive demo to example.html", status: "pending" },
            { id: "5.5", title: "Advance journey stepper to Shipped", status: "pending" }
          ]
        }
      ]
    });

    const bridge = new DatastarBridge({ sessionState: session });
    const adapter = new AgyTelemetryAdapter({ sessionState: session, bridge });

    const emittedSseEvents = [];
    bridge.on("sse", (sse) => emittedSseEvents.push(sse));

    // Initial assertions
    assert.equal(session.metrics.totalTasks, 19);
    assert.equal(session.metrics.completedTasks, 0);
    assert.equal(session.metrics.progressPct, 0);

    // Step 1: Start Phase 1, Task 1.1
    session.startTask("1.1", { assignedTo: "AGY Build Agent" });
    assert.equal(session.activeTaskId, "1.1");
    assert.equal(session.activePhaseId, "phase-1");
    assert.equal(session.metrics.runningTasks, 1);
    assert.equal(session.getPhase("phase-1").status, "running");

    // Ingest simulated AGY tool execution: read_file
    adapter.processStep({
      step_index: 1,
      source: "MODEL",
      thinking: "Inspecting ADDON_REGISTRY in build-report.mjs...",
      tool_calls: [
        {
          id: "call_read_build",
          name: "read_file",
          args: { Path: "skills/html-report/scripts/build-report.mjs" }
        }
      ]
    });

    assert.ok(session.tools.has("call_read_build"));
    const readTool = session.tools.get("call_read_build");
    assert.equal(readTool.status, "running");

    // Complete tool call
    adapter.processStep({
      step_index: 2,
      source: "SYSTEM",
      type: "TOOL_RESPONSE",
      tool_call_id: "call_read_build",
      content: "export const ADDON_REGISTRY = { ... };",
      status: "DONE"
    });

    assert.equal(readTool.status, "success");
    assert.ok(readTool.outputSummary.includes("ADDON_REGISTRY"));

    // Complete Task 1.1
    session.completeTask("1.1");
    assert.equal(session.metrics.completedTasks, 1);
    assert.equal(session.metrics.progressPct, 5); // 1 / 19 = ~5%

    // Step 2: Complete all remaining tasks in Phase 1
    session.completeTask("1.2");
    session.completeTask("1.3");
    session.completeTask("1.4");

    const phase1 = session.getPhase("phase-1");
    assert.equal(phase1.status, "completed");
    assert.equal(phase1.progressPct, 100);
    assert.equal(session.metrics.completedTasks, 4);

    // Step 3: Simulate failure and recovery in Phase 2
    session.startTask("2.1", { assignedTo: "AGY Coder" });
    adapter.processStep({
      step_index: 3,
      source: "MODEL",
      thinking: "Setting up MutationObserver in report-runtime.js...",
      tool_calls: [
        {
          id: "call_test_syntax",
          name: "run_command",
          args: { CommandLine: "node --check packages/core/assets/report-runtime.js" }
        }
      ]
    });

    // Simulate transient failure
    adapter.processStep({
      step_index: 4,
      source: "SYSTEM",
      type: "TOOL_RESPONSE",
      tool_call_id: "call_test_syntax",
      content: "SyntaxError: Unexpected token",
      status: "ERROR"
    });

    const failedTool = session.tools.get("call_test_syntax");
    assert.equal(failedTool.status, "error");
    session.failTask("2.1", { error: "Syntax error detected in observer callback" });
    assert.equal(session.metrics.failedTasks, 1);

    // Recover: remediate and complete task 2.1
    adapter.processStep({
      step_index: 5,
      source: "MODEL",
      thinking: "Fixed syntax error. Re-running tests...",
      tool_calls: [
        {
          id: "call_test_syntax_retry",
          name: "run_command",
          args: { CommandLine: "node --check packages/core/assets/report-runtime.js" }
        }
      ]
    });
    adapter.processStep({
      step_index: 6,
      source: "SYSTEM",
      type: "TOOL_RESPONSE",
      tool_call_id: "call_test_syntax_retry",
      content: "Clean syntax check",
      status: "DONE"
    });

    session.completeTask("2.1");
    assert.equal(session.metrics.failedTasks, 0);
    assert.equal(session.getTask("2.1").task.status, "completed");

    // Step 4: Advance remaining phases to completion
    session.completeTask("2.2");
    session.completeTask("3.1");
    session.completeTask("3.2");
    session.completeTask("3.3");
    session.completeTask("3.4");
    session.completeTask("4.1");
    session.completeTask("4.2");
    session.completeTask("4.3");
    session.completeTask("4.4");
    session.completeTask("5.1");
    session.completeTask("5.2");
    session.completeTask("5.3");
    session.completeTask("5.4");
    session.completeTask("5.5");

    assert.equal(session.metrics.completedTasks, 19);
    assert.equal(session.metrics.progressPct, 100);
    assert.equal(session.status, "completed");
    for (const p of session.phases) {
      assert.equal(p.status, "completed");
      assert.equal(p.progressPct, 100);
    }

    assert.ok(emittedSseEvents.length > 20, "Should have emitted rich stream of SSE events throughout session");
  });
});
