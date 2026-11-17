/**
 * Vendor-neutral LLM telemetry adapters for Google Antigravity (AGY) and OpenAI Codex.
 */
import { EventEmitter } from "node:events";
import { SessionState } from "./session-state.mjs";
import { DatastarBridge } from "./datastar-bridge.mjs";

export class AgyTelemetryAdapter extends EventEmitter {
  constructor(optsOrBridge = {}) {
    super();
    let bridge = null;
    let sessionState = null;
    if (optsOrBridge instanceof DatastarBridge) {
      bridge = optsOrBridge;
      sessionState = bridge.sessionState || bridge.session;
    } else if (optsOrBridge) {
      bridge = optsOrBridge.bridge || null;
      sessionState = optsOrBridge.sessionState || optsOrBridge.session || bridge?.sessionState || bridge?.session || null;
    }
    this.bridge = bridge;
    this.sessionState = sessionState || new SessionState({ agentType: "agy" });
    this.session = this.sessionState;
  }

  processStep(step = {}) {
    if (!step || typeof step !== "object") return;

    if (step.thinking) {
      this.emit("thought.delta", {
        stepIndex: step.step_index ?? 0,
        text: String(step.thinking)
      });
      if (this.bridge && typeof this.bridge.broadcastThought === "function") {
        this.bridge.broadcastThought(step.thinking);
      }
    }

    if (Array.isArray(step.tool_calls)) {
      for (const call of step.tool_calls) {
        const toolName = call.name || call.function?.name || "unknown_tool";
        const args = call.args || call.arguments || call.function?.arguments || {};
        const toolCallId = call.id || `agy-tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        let inputSummary = "";
        if (typeof args === "string") {
          inputSummary = args;
        } else if (args.Path) {
          inputSummary = args.Path;
        } else if (args.path) {
          inputSummary = args.path;
        } else if (args.CommandLine) {
          inputSummary = args.CommandLine;
        } else if (args.Prompt) {
          inputSummary = args.Prompt;
        } else {
          inputSummary = JSON.stringify(args);
        }

        const record = this.sessionState.recordToolInvocation({
          toolCallId,
          toolName,
          inputSummary,
          status: "running"
        });

        this.emit("tool.invoked", { toolCallId, toolName, inputSummary, record });
        if (this.bridge) {
          this.bridge.dispatchToolInvoked(record);
        }
      }
    }

    if (step.type === "TOOL_RESPONSE" || step.source === "TOOL_OUTPUT" || (step.tool_call_id && step.content)) {
      const toolCallId = step.tool_call_id || (this.sessionState.tools.size > 0 ? Array.from(this.sessionState.tools.keys()).pop() : null);
      if (toolCallId) {
        const record = this.sessionState.recordToolResult(toolCallId, {
          outputSummary: typeof step.content === "string" ? step.content : JSON.stringify(step.content),
          status: step.status === "ERROR" ? "error" : "success"
        });
        this.emit("tool.output", { toolCallId, record });
        if (this.bridge) {
          this.bridge.dispatchToolOutput(record);
        }
      }
    }

    if (typeof step.content === "string" && step.content.includes("- [")) {
      this._syncTasksFromMarkdown(step.content);
    }
  }

  handleStep(step) {
    return this.processStep(step);
  }

  _syncTasksFromMarkdown(content) {
    const lines = content.split("\n");
    for (const line of lines) {
      const match = line.match(/^[\s*-]*\[([ xX])\]\s*([0-9.]+)?\s*(.+)$/);
      if (match) {
        const isDone = match[1].toLowerCase() === "x";
        const taskNum = match[2]?.trim();
        const title = match[3]?.trim();

        for (const phase of this.sessionState.phases) {
          for (const task of phase.tasks) {
            const matchesId = taskNum && (task.id === taskNum || task.id.endsWith(taskNum));
            const matchesTitle = title && task.title.toLowerCase().includes(title.toLowerCase().slice(0, 20));
            if (matchesId || matchesTitle) {
              this.sessionState.updateTask(task.id, {
                status: isDone ? "completed" : "running"
              });
            }
          }
        }
      }
    }
  }
}

export class CodexTelemetryAdapter extends EventEmitter {
  constructor(optsOrBridge = {}) {
    super();
    let bridge = null;
    let sessionState = null;
    if (optsOrBridge instanceof DatastarBridge) {
      bridge = optsOrBridge;
      sessionState = bridge.sessionState || bridge.session;
    } else if (optsOrBridge) {
      bridge = optsOrBridge.bridge || null;
      sessionState = optsOrBridge.sessionState || optsOrBridge.session || bridge?.sessionState || bridge?.session || null;
    }
    this.bridge = bridge;
    this.sessionState = sessionState || new SessionState({ agentType: "codex" });
    this.session = this.sessionState;
    this.activeToolCallBuffers = new Map();
  }

  processChunk(chunk = {}) {
    if (!chunk || typeof chunk !== "object") return;
    const choice = chunk.choices?.[0] || {};
    const delta = choice.delta || {};

    const reasoning = delta.reasoning_content || delta.reasoning || (delta.content && delta.role === "assistant" && delta.content.startsWith("Thinking:") ? delta.content : null);
    if (reasoning) {
      this.emit("thought.delta", { text: reasoning });
      if (this.bridge && typeof this.bridge.broadcastThought === "function") {
        this.bridge.broadcastThought(reasoning);
      }
    }

    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        let buffer;
        if (tc.id) {
          buffer = {
            id: tc.id,
            name: tc.function?.name || "unnamed_tool",
            argsBuffer: ""
          };
          this.activeToolCallBuffers.set(idx, buffer);
        } else {
          buffer = this.activeToolCallBuffers.get(idx);
          if (!buffer) {
            buffer = {
              id: `codex-tool-${Date.now()}-${idx}`,
              name: tc.function?.name || "unnamed_tool",
              argsBuffer: ""
            };
            this.activeToolCallBuffers.set(idx, buffer);
          }
        }

        if (tc.function?.name) buffer.name = tc.function.name;
        if (tc.function?.arguments) buffer.argsBuffer += tc.function.arguments;

        if (choice.finish_reason === "tool_calls" || tc.id) {
          const record = this.sessionState.recordToolInvocation({
            toolCallId: buffer.id,
            toolName: buffer.name,
            inputSummary: buffer.argsBuffer,
            status: "running"
          });

          this.emit("tool.invoked", {
            toolCallId: buffer.id,
            toolName: buffer.name,
            inputSummary: buffer.argsBuffer,
            record
          });

          if (this.bridge) {
            this.bridge.dispatchToolInvoked(record);
          }
        }
      }
    }
  }

  handleChunk(chunk) {
    return this.processChunk(chunk);
  }

  processToolResult({ tool_call_id, content = "", durationMs = 0, is_error = false } = {}) {
    if (!tool_call_id) return null;
    const record = this.sessionState.recordToolResult(tool_call_id, {
      outputSummary: typeof content === "string" ? content : JSON.stringify(content),
      status: is_error ? "error" : "success"
    });
    if (durationMs) record.durationMs = durationMs;

    this.emit("tool.output", { tool_call_id, record });
    if (this.bridge) {
      this.bridge.dispatchToolOutput(record);
    }
    return record;
  }

  handleToolResult(toolCallId, content = "", durationMs = 0, isSuccess = true) {
    return this.processToolResult({
      tool_call_id: toolCallId,
      content,
      durationMs,
      is_error: !isSuccess
    });
  }
}
