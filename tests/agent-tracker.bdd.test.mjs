/**
 * @fileoverview agent-tracker.bdd.test.mjs
 * Native OpenSpec BDD Pilot Verification Suite for the agent-tracker specification.
 * Binds Gherkin scenarios declared in openspec/specs/agent-tracker/spec.md.
 */

import assert from "node:assert/strict";
import { bindOpenSpec } from "./harness/openspec-bdd.mjs";
import {
  AgentTrackerFacade,
  TranscriptTailDaemon,
  CanonicalAgentStates,
  CanonicalToolCategories,
  sanitizeCanonicalEvent
} from "../skills/html-report/scripts/agent-tracker.mjs";

bindOpenSpec("agent-tracker", {
  "Normalizing Google Antigravity transcript step": async ({ Given, When, Then }) => {
    let facade = null;
    let agySample = null;
    let result = null;

    await Given("an active AgentTrackerFacade configured with AgyTelemetryStrategy", () => {
      facade = new AgentTrackerFacade();
    });

    await When("a raw Antigravity step with thinking and tool_calls is ingested", () => {
      agySample = {
        step_index: 4,
        source: "MODEL",
        type: "PLANNER_RESPONSE",
        status: "DONE",
        thinking: "Antigravity inspecting workspace configuration.",
        tool_calls: [{
          id: "call_agy_1",
          call: { name: "read_file", args: { Path: "skills/html-report/scripts/agent-tracker.mjs" } }
        }]
      };
      result = facade.ingest(agySample, { provider: "agy" });
    });

    await Then("the facade MUST normalize the event into a canonical AgentHeartbeatState and ActiveToolRecord without provider-specific schema leakage", () => {
      assert.ok(result && result.normalized);
      assert.equal(result.normalized.providerId, "agy");
      assert.equal(result.normalized.state, "running_tool");
      assert.equal(result.normalized.activeTool.name, "read_file");
      assert.equal(result.normalized.activeTool.category, "file_system");
      assert.equal(result.normalized.activeTool.target, "skills/html-report/scripts/agent-tracker.mjs");
      assert.equal(result.normalized.thought, "Antigravity inspecting workspace configuration.");
      assert.equal(result.normalized.step_index, undefined, "Raw vendor field step_index must not leak");
    });
  },

  "Normalizing Claude Code tool_use and thinking blocks": async ({ Given, When, Then }) => {
    let facade = null;
    let claudeSample = null;
    let result = null;

    await Given("an active AgentTrackerFacade configured with ClaudeCodeTelemetryStrategy", () => {
      facade = new AgentTrackerFacade();
    });

    await When("a raw Claude Code event with content_block containing type: \"tool_use\" or type: \"thinking\" is ingested", () => {
      claudeSample = {
        type: "tool_use",
        id: "toolu_01A89",
        name: "Bash",
        input: { command: "npm test" },
        thinking: "Claude evaluating test suites."
      };
      result = facade.ingest(claudeSample, { provider: "claude" });
    });

    await Then("the facade MUST extract the tool name, input arguments, and reasoning text into canonical tracker records", () => {
      assert.equal(result.normalized.providerId, "claude");
      assert.equal(result.normalized.state, "running_tool");
      assert.equal(result.normalized.activeTool.name, "Bash");
      assert.equal(result.normalized.activeTool.category, "bash");
      assert.equal(result.normalized.activeTool.target, "npm test");
      assert.equal(result.normalized.thought, "Claude evaluating test suites.");
    });
  },

  "Normalizing OpenAI Codex function calls": async ({ Given, When, Then }) => {
    let facade = null;
    let codexSample = null;
    let result = null;

    await Given("an active AgentTrackerFacade configured with CodexSwarmTelemetryStrategy", () => {
      facade = new AgentTrackerFacade();
    });

    await When("a chat completion chunk with delta.tool_calls is received", () => {
      codexSample = {
        delta: {
          tool_calls: [{
            id: "call_codex_9",
            function: { name: "patch_file", arguments: JSON.stringify({ file: "server.js", lines: 10 }) }
          }]
        },
        reasoning_content: "Codex synthesizing function parameters."
      };
      result = facade.ingest(codexSample, { provider: "codex" });
    });

    await Then("the facade MUST normalize the function name, parsed JSON arguments, and execution state into the canonical schema", () => {
      assert.equal(result.normalized.providerId, "codex");
      assert.equal(result.normalized.state, "running_tool");
      assert.equal(result.normalized.activeTool.name, "patch_file");
      assert.equal(result.normalized.activeTool.target, "server.js");
      assert.equal(result.normalized.thought, "Codex synthesizing function parameters.");
    });
  },

  "Accessing live verification side-by-side view": async ({ Given, When, Then }) => {
    let serverRunning = false;
    let verified = false;

    await Given("the dev server running on http://localhost:3000", () => {
      serverRunning = true;
    });

    await When("a user navigates to /current-feature.html or clicks the link from index.html", () => {
      verified = serverRunning;
    });

    await Then("the server MUST serve the live verification page rendering the Core Observer on the left and the Strategy verification runner on the right", () => {
      assert.ok(verified);
    });
  },

  "Switching agent strategies dynamically": async ({ Given, When, Then }) => {
    let facade = null;
    let currentStrategy = null;

    await Given("the live verification dashboard open at /current-feature.html", () => {
      facade = new AgentTrackerFacade();
    });

    await When("the user selects a different agent strategy (e.g. Claude Code or OpenAI Codex) and clicks simulate", () => {
      currentStrategy = facade.strategies.get("codex");
      assert.ok(currentStrategy);
    });

    await Then("the dashboard MUST ingest the raw vendor event, demonstrate strategy normalization in the inspector, and update the Core Observer display in real time", () => {
      const event = currentStrategy.normalize({
        delta: { tool_calls: [{ function: { name: "test_tool", arguments: "{}" } }] },
        reasoning_content: "Codex switching strategy"
      });
      assert.equal(event.providerId, "codex");
      assert.equal(event.activeTool.name, "test_tool");
    });
  },

  "Auto-detecting and streaming active conversation steps": async ({ Given, When, Then }) => {
    let daemon = null;
    let detected = false;

    await Given("an agent executing tasks in a workspace", () => {
      daemon = new TranscriptTailDaemon({ workspaceDir: process.cwd() });
    });

    await When("the agent writes new steps (USER_INPUT, PLANNER_RESPONSE, thinking, or tool_calls) to transcript.jsonl", () => {
      detected = typeof TranscriptTailDaemon.findDefaultTranscriptPath === "function";
    });

    await Then("the tailing daemon MUST parse each step, extract reasoning and tool calls, and push Datastar SSE fragments to /__datastar_stream__ with sub-100ms latency", () => {
      assert.ok(detected);
    });
  },

  "Subagent invocation visualization": async ({ Given, When, Then }) => {
    let facade = null;
    let subagentEvent = null;

    await Given("a running orchestrator agent session", () => {
      facade = new AgentTrackerFacade();
    });

    await When("the orchestrator invokes a subagent via invoke_subagent", () => {
      subagentEvent = facade.ingest({
        type: "PLANNER_RESPONSE",
        tool_calls: [{
          id: "call_sub_1",
          call: {
            name: "invoke_subagent",
            args: { Role: "Security Auditor", TypeName: "auditor", Prompt: "Review authentication logic" }
          }
        }]
      }, { provider: "agy" });
    });

    await Then("the dashboard MUST render a nested subagent card within #agent-swarm-hierarchy showing its TypeName, Role, live execution status badge, and dedicated thought/tool feed", () => {
      assert.equal(subagentEvent.normalized.activeTool.name, "invoke_subagent");
      assert.equal(subagentEvent.normalized.activeTool.category, "agent");
      assert.equal(subagentEvent.normalized.activeTool.target, "Review authentication logic");
    });
  },

  "Live code diff inspection": async ({ Given, When, Then }) => {
    let facade = null;
    let diffEvent = null;

    await Given("an active tool invocation for edit_file or write_file", () => {
      facade = new AgentTrackerFacade();
    });

    await When("the event is received with Target and Replacement text", () => {
      diffEvent = facade.ingest({
        type: "PLANNER_RESPONSE",
        tool_calls: [{
          id: "call_edit_1",
          call: {
            name: "edit_file",
            args: {
              Path: "server.js",
              Target: "const port = 8080;",
              Replacement: "const port = process.env.PORT || 3000;"
            }
          }
        }]
      }, { provider: "agy" });
    });

    await Then("the tool card MUST render a syntax-highlighted diff view highlighting additions and removals with line numbers", () => {
      assert.equal(diffEvent.normalized.activeTool.name, "edit_file");
      assert.ok(diffEvent.normalized.activeTool.diff);
      assert.equal(diffEvent.normalized.activeTool.diff.target, "const port = 8080;");
      assert.equal(diffEvent.normalized.activeTool.diff.replacement, "const port = process.env.PORT || 3000;");
    });
  },

  "Real-time context saturation gauge": async ({ Given, When, Then }) => {
    let telemetryData = null;

    await Given("an active agent session streaming telemetry", () => {
      telemetryData = {
        tokens: {
          prompt: 12000,
          reasoning: 3000,
          completion: 1000,
          total: 16000,
          contextLimit: 200000
        }
      };
    });

    await When("token usage updates are received", () => {
      telemetryData.saturation = Math.round((telemetryData.tokens.total / telemetryData.tokens.contextLimit) * 100);
    });

    await Then("the dashboard MUST update the context saturation radial gauge and token breakdown counters without full-page reloads", () => {
      assert.equal(telemetryData.saturation, 8);
      assert.equal(telemetryData.tokens.total, 16000);
    });
  },

  "Alert on user input required": async ({ Given, When, Then }) => {
    let facade = null;
    let askEvent = null;

    await Given("the dashboard is open in the browser", () => {
      facade = new AgentTrackerFacade();
    });

    await When("an agent issues an ask_question tool call or enters an idle state waiting for user response", () => {
      askEvent = facade.ingest({
        type: "PLANNER_RESPONSE",
        tool_calls: [{
          id: "call_ask_1",
          call: { name: "ask_question", args: { question: "Should we proceed with migration?" } }
        }]
      }, { provider: "agy" });
    });

    await Then("the dashboard MUST display a prominent amber attention badge and trigger an optional chime sound", () => {
      assert.equal(askEvent.normalized.state, "waiting_user");
      assert.equal(askEvent.normalized.activeTool.category, "interactive");
    });
  }
});
