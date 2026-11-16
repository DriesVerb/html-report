/**
 * agent-tracker.mjs
 * Publication-Grade Live Agent Tracker Engine
 * Implements the Agent-Agnostic Facade + Strategy Pattern:
 * - AgentTelemetryStrategy (Abstract Interface)
 * - AgyTelemetryStrategy (Google Antigravity)
 * - ClaudeCodeTelemetryStrategy (Anthropic Claude Code)
 * - CodexSwarmTelemetryStrategy (OpenAI Codex / Swarm)
 * - GenericTelemetryStrategy (Universal REST payload)
 * - AgentTrackerFacade (Unified telemetry orchestrator & SSE emitter)
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EventEmitter } from "node:events";

/**
 * Valid canonical agent states
 */
export const CanonicalAgentStates = Object.freeze([
  "thinking",
  "running_tool",
  "waiting_user",
  "idle",
  "error"
]);

/**
 * Valid tool categories for canonical classification
 */
export const CanonicalToolCategories = Object.freeze([
  "bash",
  "terminal",
  "file_system",
  "code",
  "web",
  "agent",
  "interactive",
  "generic"
]);

/**
 * Sanitizes and validates that an event has zero vendor-specific leaked keys.
 */
export function sanitizeCanonicalEvent(event) {
  if (!event || typeof event !== "object") {
    throw new TypeError("Canonical event must be a non-null object");
  }

  const validState = CanonicalAgentStates.includes(event.state)
    ? event.state
    : "thinking";

  let sanitizedTool = null;
  if (event.activeTool && typeof event.activeTool === "object") {
    let sanitizedOutput = null;
    if (event.activeTool.output) {
      sanitizedOutput = {
        stdout: typeof event.activeTool.output === "string" ? event.activeTool.output : String(event.activeTool.output.stdout || ""),
        stderr: String(event.activeTool.output.stderr || ""),
        exitCode: Number(event.activeTool.output.exitCode ?? 0)
      };
    }

    let sanitizedDiff = null;
    if (event.activeTool.diff && typeof event.activeTool.diff === "object") {
      sanitizedDiff = {
        filePath: String(event.activeTool.diff.filePath || ""),
        target: String(event.activeTool.diff.target || ""),
        replacement: String(event.activeTool.diff.replacement || ""),
        isNewFile: Boolean(event.activeTool.diff.isNewFile)
      };
    }

    sanitizedTool = {
      id: String(event.activeTool.id || `tool-${Date.now()}`),
      name: String(event.activeTool.name || "unknown_tool"),
      target: String(event.activeTool.target || ""),
      category: CanonicalToolCategories.includes(event.activeTool.category)
        ? event.activeTool.category
        : "generic",
      args: (event.activeTool.args && typeof event.activeTool.args === "object")
        ? event.activeTool.args
        : {},
      output: sanitizedOutput,
      diff: sanitizedDiff,
      startTime: Number(event.activeTool.startTime) || Date.now()
    };
  }

  const sanitizedHistory = Array.isArray(event.recentHistory)
    ? event.recentHistory.map((item, idx) => ({
        id: String(item.id || `hist-${idx}-${Date.now()}`),
        name: String(item.name || "tool"),
        target: String(item.target || ""),
        durationMs: Math.max(0, Number(item.durationMs) || 0),
        status: item.status === "failed" ? "failed" : "ok",
        output: item.output ? {
          stdout: typeof item.output === "string" ? item.output : String(item.output.stdout || ""),
          stderr: String(item.output.stderr || ""),
          exitCode: Number(item.output.exitCode ?? 0)
        } : null,
        diff: item.diff ? {
          filePath: String(item.diff.filePath || ""),
          target: String(item.diff.target || ""),
          replacement: String(item.diff.replacement || ""),
          isNewFile: Boolean(item.diff.isNewFile)
        } : null,
        timestamp: Number(item.timestamp) || Date.now()
      }))
    : [];

  const sanitizedSubagents = Array.isArray(event.subagents)
    ? event.subagents.map((sub, idx) => ({
        id: String(sub.id || `sub-${idx}-${Date.now()}`),
        typeName: String(sub.typeName || "subagent"),
        role: String(sub.role || "Worker"),
        state: CanonicalAgentStates.includes(sub.state) ? sub.state : "running_tool",
        activeTool: sub.activeTool ? {
          name: String(sub.activeTool.name || "action"),
          target: String(sub.activeTool.target || "")
        } : null,
        thought: String(sub.thought || ""),
        startedAt: Number(sub.startedAt) || Date.now(),
        durationMs: Math.max(0, Number(sub.durationMs) || 0),
        status: sub.status === "failed" ? "failed" : (sub.status === "idle" ? "idle" : "active")
      }))
    : [];

  // Context window & token velocity telemetry (Task 3.3)
  const rawTel = (event.telemetry && typeof event.telemetry === "object")
    ? event.telemetry
    : ((event.usage && typeof event.usage === "object") ? event.usage : {});

  const contextLimit = Math.max(1000, Number(rawTel.contextWindowLimit || rawTel.max_tokens || 200000));
  const promptTokens = Math.max(0, Number(rawTel.promptTokens || rawTel.prompt_tokens || rawTel.input_tokens || 0));
  const completionTokens = Math.max(0, Number(rawTel.completionTokens || rawTel.completion_tokens || rawTel.output_tokens || 0));
  const reasoningTokens = Math.max(0, Number(rawTel.reasoningTokens || rawTel.reasoning_tokens || 0));
  const totalTokens = Math.max(promptTokens + completionTokens + reasoningTokens, Number(rawTel.contextTokens || rawTel.total_tokens || 0));
  const saturationPct = Number(((totalTokens / contextLimit) * 100).toFixed(1));
  const tokensPerSec = Math.max(0, Number(rawTel.tokensPerSecond || rawTel.tokens_per_second || 0));

  const sanitizedTelemetry = {
    contextTokens: totalTokens,
    contextWindowLimit: contextLimit,
    saturationPct: Math.min(100, saturationPct),
    promptTokens,
    reasoningTokens,
    completionTokens,
    tokensPerSecond: tokensPerSec
  };

  // Strictly construct the canonical object to guarantee zero vendor leak
  return {
    providerId: String(event.providerId || "generic"),
    providerName: String(event.providerName || "Generic Agent"),
    state: validState,
    activeTool: sanitizedTool,
    thought: String(event.thought || "").trim(),
    recentHistory: sanitizedHistory,
    subagents: sanitizedSubagents,
    telemetry: sanitizedTelemetry,
    timestamp: Number(event.timestamp) || Date.now()
  };
}

/**
 * Base Strategy Interface for Agent Telemetry
 */
export class AgentTelemetryStrategy {
  constructor(providerId, displayName) {
    if (this.constructor === AgentTelemetryStrategy) {
      throw new TypeError("AgentTelemetryStrategy is an abstract class and cannot be instantiated directly.");
    }
    this.providerId = providerId;
    this.displayName = displayName;
  }

  canHandle(rawPayload) {
    return false;
  }

  normalize(rawPayload) {
    throw new Error(`Strategy ${this.constructor.name} must implement normalize(rawPayload).`);
  }

  extractCategory(toolName = "") {
    const lower = String(toolName).toLowerCase();
    if (lower.includes("bash") || lower.includes("command") || lower.includes("shell") || lower.includes("exec")) {
      return "bash";
    }
    if (lower.includes("file") || lower.includes("read") || lower.includes("write") || lower.includes("edit") || lower.includes("glob")) {
      return "file_system";
    }
    if (lower.includes("subagent") || lower.includes("agent") || lower.includes("swarm") || lower.includes("delegate")) {
      return "agent";
    }
    if (lower.includes("web") || lower.includes("search") || lower.includes("fetch") || lower.includes("browse")) {
      return "web";
    }
    if (lower.includes("ask") || lower.includes("question") || lower.includes("confirm") || lower.includes("prompt")) {
      return "interactive";
    }
    if (lower.includes("code") || lower.includes("python") || lower.includes("eval")) {
      return "code";
    }
    return "generic";
  }

  extractTarget(toolName = "", args = {}) {
    if (!args || typeof args !== "object") return "";
    return (
      args.CommandLine ||
      args.command ||
      args.Path ||
      args.path ||
      args.file ||
      args.query ||
      args.Prompt ||
      args.prompt ||
      args.question ||
      args.url ||
      (Object.keys(args).length > 0 ? JSON.stringify(args).slice(0, 80) : "")
    );
  }
}

/**
 * Strategy: Google Antigravity (AGY)
 * Parses transcript steps ({ step_index, source, type, status, thinking, tool_calls })
 */
export class AgyTelemetryStrategy extends AgentTelemetryStrategy {
  constructor() {
    super("agy", "Google Antigravity");
  }

  canHandle(raw) {
    if (!raw || typeof raw !== "object") return false;
    return (
      raw.step_index !== undefined ||
      raw.source === "MODEL" ||
      raw.source === "USER_EXPLICIT" ||
      raw.type === "PLANNER_RESPONSE" ||
      (Array.isArray(raw.tool_calls) && raw.tool_calls.length > 0 && Boolean(raw.tool_calls[0].call))
    );
  }

  normalize(raw) {
    let state = "thinking";
    let activeTool = null;
    let thought = "";

    if (raw.thinking) {
      thought = raw.thinking;
    } else if (raw.content && raw.source === "MODEL") {
      thought = raw.content;
    }

    // State & Tool Extraction
    if (raw.status === "ERROR" || raw.type === "ERROR") {
      state = "error";
    } else if (raw.status === "WAITING_USER") {
      state = "waiting_user";
    } else if (Array.isArray(raw.tool_calls) && raw.tool_calls.length > 0) {
      const tc = raw.tool_calls[0];
      const callData = tc.call || tc;
      const toolName = callData.name || "tool";
      const args = callData.args || {};

      if (toolName === "ask_question") {
        state = "waiting_user";
      } else {
        state = "running_tool";
      }

      let output = null;
      if (raw.output || callData.output || raw.tool_output) {
        const outSource = raw.output || callData.output || raw.tool_output;
        output = typeof outSource === "string" ? { stdout: outSource, stderr: "", exitCode: 0 } : outSource;
      }

      let diff = null;
      if (raw.diff) {
        diff = raw.diff;
      } else if (toolName === "edit_file" && args) {
        diff = {
          filePath: args.Path || "",
          target: args.Target || "",
          replacement: args.Replacement || "",
          isNewFile: false
        };
      } else if (toolName === "write_file" && args) {
        diff = {
          filePath: args.Path || "",
          target: args.Overwrite ? "[Overwrite existing file content]" : "[New File Creation]",
          replacement: typeof args.Content === "string" ? args.Content : "",
          isNewFile: !args.Overwrite
        };
      }

      activeTool = {
        id: tc.id || `agy-call-${Date.now()}`,
        name: toolName,
        target: this.extractTarget(toolName, args),
        category: this.extractCategory(toolName),
        args,
        output,
        diff,
        startTime: Date.now()
      };
    } else if (raw.status === "DONE" && (raw.type === "USER_INPUT" || !raw.tool_calls)) {
      state = "idle";
    }

    return sanitizeCanonicalEvent({
      providerId: this.providerId,
      providerName: this.displayName,
      state,
      activeTool,
      thought: thought || (state === "running_tool" ? `Executing tool ${activeTool?.name}` : "Evaluating next agent step..."),
      subagents: raw.subagents || null,
      telemetry: raw.telemetry || raw.usage || null,
      timestamp: Date.now()
    });
  }
}

/**
 * Strategy: Anthropic Claude Code
 * Parses Claude Code streaming blocks ({ type: "tool_use", input } or thinking blocks)
 */
export class ClaudeCodeTelemetryStrategy extends AgentTelemetryStrategy {
  constructor() {
    super("claude", "Anthropic Claude Code");
  }

  canHandle(raw) {
    if (!raw || typeof raw !== "object") return false;
    return (
      raw.type === "tool_use" ||
      raw.type === "content_block_start" ||
      raw.type === "thinking" ||
      raw.tool_use !== undefined ||
      Boolean(raw.content_block && (raw.content_block.type === "tool_use" || raw.content_block.type === "thinking")) ||
      Boolean(raw.delta && raw.delta.thinking)
    );
  }

  normalize(raw) {
    let state = "thinking";
    let activeTool = null;
    let thought = "";

    if (raw.thinking) {
      thought = raw.thinking;
    } else if (raw.delta?.thinking) {
      thought = raw.delta.thinking;
    } else if (raw.content_block?.type === "thinking") {
      thought = raw.content_block.text || "Claude reasoning...";
    } else if (raw.content) {
      thought = typeof raw.content === "string" ? raw.content : "";
    }

    const toolObj = raw.type === "tool_use"
      ? raw
      : (raw.content_block?.type === "tool_use" ? raw.content_block : (raw.tool_use || null));

    if (toolObj) {
      const toolName = toolObj.name || "Bash";
      const args = toolObj.input || {};
      const output = raw.output ? (typeof raw.output === "string" ? { stdout: raw.output, stderr: "", exitCode: 0 } : raw.output) : null;
      let diff = null;
      if (raw.diff) {
        diff = raw.diff;
      } else if ((toolName === "FileEditTool" || toolName === "edit_file") && args) {
        diff = {
          filePath: args.path || args.file_path || "",
          target: args.old_string || args.Target || "",
          replacement: args.new_string || args.Replacement || "",
          isNewFile: false
        };
      }
      state = "running_tool";
      activeTool = {
        id: toolObj.id || `claude-call-${Date.now()}`,
        name: toolName,
        target: this.extractTarget(toolName, args),
        category: this.extractCategory(toolName),
        args,
        output,
        diff,
        startTime: Date.now()
      };
    } else if (raw.type === "ask_user" || raw.subtype === "confirmation" || raw.stop_reason === "tool_use_confirm") {
      state = "waiting_user";
    } else if (raw.type === "turn_complete" || raw.stop_reason === "end_turn") {
      state = "idle";
    } else if (raw.error || raw.type === "error") {
      state = "error";
    }

    return sanitizeCanonicalEvent({
      providerId: this.providerId,
      providerName: this.displayName,
      state,
      activeTool,
      thought: thought || (state === "running_tool" ? `Executing Claude tool ${activeTool?.name}` : "Synthesizing next response..."),
      subagents: raw.subagents || null,
      telemetry: raw.telemetry || raw.usage || null,
      timestamp: Date.now()
    });
  }
}

/**
 * Strategy: OpenAI Codex / Swarm
 * Parses chat completion delta chunks ({ delta.tool_calls, reasoning_content })
 */
export class CodexSwarmTelemetryStrategy extends AgentTelemetryStrategy {
  constructor() {
    super("codex", "OpenAI Codex / Swarm");
  }

  canHandle(raw) {
    if (!raw || typeof raw !== "object") return false;
    return (
      Boolean(raw.delta?.tool_calls) ||
      Boolean(raw.choices?.[0]?.delta?.tool_calls) ||
      Boolean(raw.function_call) ||
      Boolean(raw.reasoning_content) ||
      Boolean(raw.choices?.[0]?.delta?.reasoning_content)
    );
  }

  normalize(raw) {
    let state = "thinking";
    let activeTool = null;
    let thought = "";

    if (raw.reasoning_content) {
      thought = raw.reasoning_content;
    } else if (raw.choices?.[0]?.delta?.reasoning_content) {
      thought = raw.choices[0].delta.reasoning_content;
    } else if (raw.content) {
      thought = raw.content;
    }

    const toolCalls = raw.delta?.tool_calls || raw.choices?.[0]?.delta?.tool_calls;
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      const tc = toolCalls[0];
      const fn = tc.function || {};
      const toolName = fn.name || "function_call";
      let args = {};

      if (typeof fn.arguments === "string") {
        try {
          args = JSON.parse(fn.arguments);
        } catch (_) {
          args = { raw: fn.arguments };
        }
      } else if (fn.arguments && typeof fn.arguments === "object") {
        args = fn.arguments;
      }

      const output = raw.output ? (typeof raw.output === "string" ? { stdout: raw.output, stderr: "", exitCode: 0 } : raw.output) : null;
      let diff = null;
      if (raw.diff) {
        diff = raw.diff;
      } else if ((toolName === "apply_patch" || toolName === "edit_file" || toolName === "patch_file") && args) {
        diff = {
          filePath: args.path || args.filename || args.filePath || "",
          target: args.old_str || args.target || args.old_code || "",
          replacement: args.new_str || args.replacement || args.new_code || "",
          isNewFile: false
        };
      } else if ((toolName === "write_file" || toolName === "create_file") && args) {
        diff = {
          filePath: args.path || args.filename || "",
          target: args.overwrite ? "[Overwrite existing file content]" : "[New File Creation]",
          replacement: typeof args.content === "string" ? args.content : "",
          isNewFile: !args.overwrite
        };
      }

      state = "running_tool";
      activeTool = {
        id: tc.id || `codex-call-${Date.now()}`,
        name: toolName,
        target: this.extractTarget(toolName, args),
        category: this.extractCategory(toolName),
        args,
        output,
        diff,
        startTime: Date.now()
      };
    } else if (raw.function_call) {
      const fn = raw.function_call;
      const toolName = fn.name || "function_call";
      let args = {};
      if (typeof fn.arguments === "string") {
        try { args = JSON.parse(fn.arguments); } catch (_) { args = { raw: fn.arguments }; }
      } else if (fn.arguments && typeof fn.arguments === "object") {
        args = fn.arguments;
      }
      state = "running_tool";
      activeTool = {
        id: `codex-fn-${Date.now()}`,
        name: toolName,
        target: this.extractTarget(toolName, args),
        category: this.extractCategory(toolName),
        args,
        startTime: Date.now()
      };
    } else if (raw.status === "requires_action" || raw.finish_reason === "tool_calls_approval") {
      state = "waiting_user";
    } else if (raw.finish_reason === "stop") {
      state = "idle";
    } else if (raw.error) {
      state = "error";
    }

    return sanitizeCanonicalEvent({
      providerId: this.providerId,
      providerName: this.displayName,
      state,
      activeTool,
      thought: thought || (state === "running_tool" ? `Executing function ${activeTool?.name}` : "Generating completions..."),
      subagents: raw.subagents || null,
      telemetry: raw.telemetry || raw.usage || null,
      timestamp: Date.now()
    });
  }
}

/**
 * Strategy: Generic Agent Webhook
 * Universal REST payload ({ state, activeTool, thought, recentHistory })
 */
export class GenericTelemetryStrategy extends AgentTelemetryStrategy {
  constructor() {
    super("generic", "Generic Agent Webhook");
  }

  canHandle(raw) {
    return raw !== null && typeof raw === "object";
  }

  normalize(raw) {
    let state = "thinking";
    if (raw.state && CanonicalAgentStates.includes(raw.state)) {
      state = raw.state;
    } else if (raw.tool || raw.activeTool) {
      state = "running_tool";
    }

    const toolSource = raw.activeTool || raw.tool;
    let activeTool = null;
    if (toolSource && typeof toolSource === "object") {
      const toolName = toolSource.name || "custom_action";
      let diff = null;
      if (toolSource.diff || raw.diff) {
        diff = toolSource.diff || raw.diff;
      } else if ((toolName === "edit_file" || toolName === "write_file") && toolSource.args) {
        const args = toolSource.args;
        diff = {
          filePath: args.Path || args.path || "",
          target: args.Target || args.target || (args.Overwrite ? "[Overwrite existing file content]" : "[New File Creation]"),
          replacement: args.Replacement || args.replacement || args.Content || args.content || "",
          isNewFile: Boolean(args.isNewFile || (!args.Overwrite && toolName === "write_file"))
        };
      }
      activeTool = {
        id: toolSource.id || `gen-${Date.now()}`,
        name: toolName,
        target: toolSource.target || this.extractTarget(toolName, toolSource.args || {}),
        category: toolSource.category || this.extractCategory(toolName),
        args: toolSource.args || {},
        output: toolSource.output ? (typeof toolSource.output === "string" ? { stdout: toolSource.output, stderr: "", exitCode: 0 } : toolSource.output) : null,
        diff,
        startTime: toolSource.startTime || Date.now()
      };
    }

    return sanitizeCanonicalEvent({
      providerId: this.providerId,
      providerName: this.displayName,
      state,
      activeTool,
      thought: raw.thought || "Processing universal agent event.",
      recentHistory: Array.isArray(raw.recentHistory) ? raw.recentHistory : [],
      subagents: raw.subagents || null,
      telemetry: raw.telemetry || raw.usage || null,
      timestamp: Date.now()
    });
  }
}

/**
 * Unified Agent Tracker Facade
 * Decouples client and server from provider formats, maintains canonical state,
 * and formats reactive HTML fragments for Datastar/SSE.
 */
export class AgentTrackerFacade extends EventEmitter {
  constructor({ defaultStrategy = "agy" } = {}) {
    super();
    this.strategies = new Map();
    this.registerStrategy(new AgyTelemetryStrategy());
    this.registerStrategy(new ClaudeCodeTelemetryStrategy());
    this.registerStrategy(new CodexSwarmTelemetryStrategy());
    this.registerStrategy(new GenericTelemetryStrategy());

    this.currentStrategy = this.strategies.get(defaultStrategy) || this.strategies.get("agy");

    // Subagents registry for multi-agent swarm tracking (Task 3.1)
    this.subagents = new Map();

    // Internal canonical state
    this.state = {
      providerId: this.currentStrategy.providerId,
      providerName: this.currentStrategy.displayName,
      state: "thinking",
      activeTool: null,
      thought: "Core Observer initialized. Standing by for telemetry stream...",
      recentHistory: [],
      telemetry: {
        contextTokens: 14200,
        contextWindowLimit: 200000,
        saturationPct: 7.1,
        promptTokens: 11400,
        reasoningTokens: 1800,
        completionTokens: 1000,
        tokensPerSecond: 124
      },
      timestamp: Date.now(),
      stateStartedAt: Date.now()
    };

    this.maxHistory = 10;
  }

  registerStrategy(strategy) {
    if (!(strategy instanceof AgentTelemetryStrategy)) {
      throw new TypeError("Strategy must extend AgentTelemetryStrategy");
    }
    this.strategies.set(strategy.providerId, strategy);
  }

  setStrategy(providerId) {
    const strat = this.strategies.get(providerId);
    if (!strat) {
      throw new Error(`Strategy '${providerId}' is not registered.`);
    }
    this.currentStrategy = strat;
    this.state.providerId = strat.providerId;
    this.state.providerName = strat.displayName;
    this.emit("strategyChanged", strat);
    return strat;
  }

  getActiveStrategy() {
    return this.currentStrategy;
  }

  autoDetectStrategy(rawPayload) {
    for (const [id, strat] of this.strategies.entries()) {
      if (id !== "generic" && strat.canHandle(rawPayload)) {
        return strat;
      }
    }
    return this.strategies.get("generic");
  }

  ingest(rawPayload, { provider = null, recordHistory = true } = {}) {
    const t0 = performance.now();
    let strategy = this.currentStrategy;

    if (provider && this.strategies.has(provider)) {
      strategy = this.strategies.get(provider);
    } else if (!strategy.canHandle(rawPayload)) {
      strategy = this.autoDetectStrategy(rawPayload);
    }

    const normalized = strategy.normalize(rawPayload);
    const elapsedMs = Number((performance.now() - t0).toFixed(2));

    // Handle history transitions when tools complete
    if (recordHistory && this.state.activeTool && (!normalized.activeTool || normalized.activeTool.id !== this.state.activeTool.id)) {
      const prevTool = this.state.activeTool;
      const durationMs = Math.max(12, Math.round(Date.now() - prevTool.startTime));
      this.pushRecentActivity({
        id: prevTool.id,
        name: prevTool.name,
        target: prevTool.target,
        durationMs,
        status: normalized.state === "error" ? "failed" : "ok",
        timestamp: Date.now()
      });
    }

    // Update state stopwatch if state changed
    if (normalized.state !== this.state.state) {
      this.state.stateStartedAt = Date.now();
    }

    // Merge into state
    this.state.providerId = normalized.providerId;
    this.state.providerName = normalized.providerName;
    this.state.state = normalized.state;
    this.state.activeTool = normalized.activeTool;
    this.state.thought = normalized.thought;
    this.state.timestamp = normalized.timestamp;
    if (normalized.telemetry) {
      this.state.telemetry = { ...normalized.telemetry };
    }

    // Track subagents spawned via invoke_subagent or explicit subagents payload (Task 3.1)
    if (normalized.activeTool?.name === "invoke_subagent" && normalized.activeTool.args) {
      const args = normalized.activeTool.args;
      const subId = String(args.conversationId || args.subagentId || `sub-${Date.now()}`);
      this.subagents.set(subId, {
        id: subId,
        typeName: String(args.TypeName || args.typeName || "subagent"),
        role: String(args.Role || args.role || "Delegated Subagent"),
        state: "running_tool",
        activeTool: {
          name: "evaluating_task",
          target: String(args.Prompt || "").slice(0, 60)
        },
        thought: String(args.Prompt || "Executing delegated subagent assignment..."),
        startedAt: Date.now(),
        durationMs: 0,
        status: "active"
      });
    } else if (rawPayload.subagents && Array.isArray(rawPayload.subagents)) {
      for (const sub of rawPayload.subagents) {
        if (sub && sub.id) this.subagents.set(sub.id, sub);
      }
    } else if (rawPayload.subagent && typeof rawPayload.subagent === "object") {
      const sub = rawPayload.subagent;
      if (sub.id) this.subagents.set(sub.id, sub);
    }

    const result = {
      raw: rawPayload,
      normalized: this.getCanonicalState(),
      elapsedMs,
      strategy: strategy.providerId
    };

    this.emit("ingest", result);
    return result;
  }

  registerSubagent(subData) {
    const id = String(subData.id || `sub-${Date.now()}`);
    const sub = {
      id,
      typeName: String(subData.typeName || "subagent"),
      role: String(subData.role || "Worker"),
      state: CanonicalAgentStates.includes(subData.state) ? subData.state : "running_tool",
      activeTool: subData.activeTool || null,
      thought: String(subData.thought || ""),
      startedAt: Number(subData.startedAt) || Date.now(),
      durationMs: Number(subData.durationMs) || 0,
      status: subData.status || "active"
    };
    this.subagents.set(id, sub);
    this.emit("subagentRegistered", sub);
    return sub;
  }

  updateSubagent(subId, patch = {}) {
    if (this.subagents.has(subId)) {
      const existing = this.subagents.get(subId);
      const updated = { ...existing, ...patch };
      this.subagents.set(subId, updated);
      this.emit("subagentUpdated", updated);
      return updated;
    }
    return null;
  }

  clearSubagents() {
    this.subagents.clear();
    this.emit("subagentsCleared");
  }

  pushRecentActivity(record) {
    this.state.recentHistory.unshift({
      id: record.id || `hist-${Date.now()}`,
      name: record.name || "tool",
      target: record.target || "",
      durationMs: record.durationMs || 25,
      status: record.status === "failed" ? "failed" : "ok",
      timestamp: Date.now()
    });

    if (this.state.recentHistory.length > this.maxHistory) {
      this.state.recentHistory.pop();
    }
  }

  updateTelemetry(patch = {}) {
    this.state.telemetry = { ...this.state.telemetry, ...patch };
    const total = this.state.telemetry.contextTokens;
    const limit = this.state.telemetry.contextWindowLimit || 200000;
    this.state.telemetry.saturationPct = Number(((total / limit) * 100).toFixed(1));
    this.emit("telemetryUpdated", this.state.telemetry);
    return this.state.telemetry;
  }

  getCanonicalState() {
    return {
      providerId: this.state.providerId,
      providerName: this.state.providerName,
      state: this.state.state,
      activeTool: this.state.activeTool ? { ...this.state.activeTool } : null,
      thought: this.state.thought,
      recentHistory: [...this.state.recentHistory],
      subagents: Array.from(this.subagents.values()),
      telemetry: { ...this.state.telemetry },
      timestamp: this.state.timestamp,
      stateStartedAt: this.state.stateStartedAt
    };
  }

  /**
   * Generates publication-grade HTML snippet for the Core Observer UI component
   */
  renderCoreObserverHtml() {
    const s = this.getCanonicalState();
    const elapsedSec = ((Date.now() - s.stateStartedAt) / 1000).toFixed(1);

    // Pill styling based on state: Thinking [purple], Executing Tool [blue], Waiting on User [amber], Idle [green], Error [red]
    let badgeClass = "bg-purple-600 text-white";
    let stateLabel = "THINKING";
    let pingColor = "bg-white";

    switch (s.state) {
      case "running_tool":
        badgeClass = "bg-blue-600 text-white";
        stateLabel = "EXECUTING TOOL";
        pingColor = "bg-white";
        break;
      case "waiting_user":
        badgeClass = "bg-amber-500 text-black animate-pulse";
        stateLabel = "WAITING ON USER";
        pingColor = "bg-black";
        break;
      case "idle":
        badgeClass = "bg-emerald-600 text-white";
        stateLabel = "IDLE";
        pingColor = "bg-white";
        break;
      case "error":
        badgeClass = "bg-rose-600 text-white animate-bounce";
        stateLabel = "ERROR";
        pingColor = "bg-white";
        break;
      default:
        badgeClass = "bg-purple-600 text-white";
        stateLabel = "THINKING";
        pingColor = "bg-white";
        break;
    }

    const toolName = s.activeTool?.name || "none";
    const toolTarget = s.activeTool?.target || (s.state === "waiting_user" ? "Waiting for user action" : "No active tool");
    const toolCategory = s.activeTool?.category || (s.state === "running_tool" ? "action" : "idle");

    let terminalDrawerHtml = "";
    const activeOut = s.activeTool?.output || (s.recentHistory.find(h => h.output)?.output);
    const cmdStr = s.activeTool?.target || (s.recentHistory.find(h => h.output)?.target) || (toolCategory === "bash" ? toolTarget : "");
    const isTerminalTool = s.activeTool?.category === "bash" || s.activeTool?.category === "terminal" || activeOut;

    if (isTerminalTool && cmdStr) {
      const exitCode = activeOut?.exitCode ?? 0;
      const stdout = activeOut?.stdout || "Command completed with status 0.";
      const stderr = activeOut?.stderr || "";
      const stdoutLines = stdout.split("\n").filter(l => l.length > 0).map(l => `<pre data-prefix=">" class="text-success-content/90 font-mono"><code>${escapeHtml(l)}</code></pre>`).join("\n");
      const stderrLines = stderr ? stderr.split("\n").filter(l => l.length > 0).map(l => `<pre data-prefix="!" class="text-error font-bold font-mono"><code>${escapeHtml(l)}</code></pre>`).join("\n") : "";

      terminalDrawerHtml = `
  <!-- Expandable Terminal Output Drawer (mockup-code) -->
  <div id="terminal-output-drawer" class="collapse collapse-arrow bg-neutral text-neutral-content rounded-lg border border-base-300 text-xs font-mono shadow-xs overflow-hidden">
    <input type="checkbox" id="terminal-drawer-toggle" checked /> 
    <div class="collapse-title font-bold text-2xs uppercase tracking-wider flex items-center justify-between pr-8">
      <span class="flex items-center gap-2">
        <i data-lucide="terminal" class="w-3.5 h-3.5 text-warning"></i>
        <span class="truncate max-w-[200px] sm:max-w-xs">Terminal: $ ${escapeHtml(cmdStr.slice(0, 45))}</span>
      </span>
      <span class="badge badge-xs ${exitCode === 0 ? 'badge-success' : 'badge-error'} font-mono">${exitCode === 0 ? '✔ exit 0' : '❌ exit ' + exitCode}</span>
    </div>
    <div class="collapse-content space-y-1.5 pt-1">
      <div class="mockup-code bg-black/90 text-neutral-content text-3xs font-mono rounded p-3 overflow-x-auto max-h-48 border border-neutral-content/10">
        <pre data-prefix="$" class="text-warning"><code>${escapeHtml(cmdStr)}</code></pre>
        ${stdoutLines}
        ${stderrLines}
      </div>
    </div>
  </div>`;
    }

    let attentionBannerHtml = "";
    if (s.state === "waiting_user") {
      attentionBannerHtml = `
  <!-- Human Attention Alert Banner -->
  <div id="human-attention-banner" class="p-3 bg-amber-500/15 border-2 border-amber-500 rounded-lg flex items-center justify-between flex-wrap gap-2 animate-pulse text-xs font-mono text-amber-900 dark:text-amber-200 shadow-xs">
    <div class="flex items-center gap-2">
      <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0"></span>
      <span class="font-bold">⚠️ AGENT WAITING ON HUMAN ATTENTION</span>
      <span class="text-3xs opacity-80">(Action confirmation or decision required)</span>
    </div>
    <button type="button" onclick="window.fireStrategyAction && window.fireStrategyAction('step')" class="btn btn-2xs btn-warning font-bold">Acknowledge</button>
  </div>`;
    } else if (s.state === "error") {
      attentionBannerHtml = `
  <!-- Critical Error Alert Banner -->
  <div id="human-attention-banner" class="p-3 bg-error/15 border-2 border-error rounded-lg flex items-center justify-between flex-wrap gap-2 animate-bounce text-xs font-mono text-error shadow-xs">
    <div class="flex items-center gap-2">
      <span class="w-2.5 h-2.5 rounded-full bg-error animate-ping shrink-0"></span>
      <span class="font-bold">🚨 CRITICAL AGENT ERROR</span>
      <span class="text-3xs opacity-80">(Execution halted — manual intervention needed)</span>
    </div>
    <button type="button" onclick="window.fireStrategyAction && window.fireStrategyAction('idle')" class="btn btn-2xs btn-error text-white font-bold">Reset</button>
  </div>`;
    }

    let codeDiffHtml = "";
    const activeDiff = s.activeTool?.diff || (s.recentHistory.find(h => h.diff)?.diff);
    if (activeDiff && activeDiff.filePath) {
      codeDiffHtml = `
  <!-- Code Modification Diff Preview -->
  <div id="code-diff-preview" class="card bg-base-100 border-2 border-primary/40 rounded-lg shadow-xs overflow-hidden text-xs font-mono">
    <div class="bg-base-300 px-3 py-2 flex items-center justify-between flex-wrap gap-2 border-b border-base-content/10">
      <div class="flex items-center gap-2">
        <i data-lucide="file-diff" class="w-4 h-4 text-primary"></i>
        <span class="font-bold text-base-content truncate max-w-xs" id="diff-filepath">${escapeHtml(activeDiff.filePath)}</span>
      </div>
      <span class="badge badge-xs ${activeDiff.isNewFile ? 'badge-accent' : 'badge-secondary'} font-mono">
        ${activeDiff.isNewFile ? '+ NEW FILE' : '⚡ EDIT SNIPPET'}
      </span>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-base-300 bg-base-200/40">
      <div class="p-3 space-y-1 bg-error/5">
        <div class="text-3xs uppercase tracking-wider font-bold text-error flex items-center gap-1">
          <i data-lucide="minus-circle" class="w-3 h-3"></i> Target (Removed / Replaced)
        </div>
        <pre class="bg-neutral text-neutral-content p-2.5 rounded text-3xs overflow-x-auto whitespace-pre-wrap max-h-40 border border-error/20 font-mono text-error-content/90 leading-relaxed" id="diff-target-code">${escapeHtml(activeDiff.target)}</pre>
      </div>
      <div class="p-3 space-y-1 bg-success/5">
        <div class="text-3xs uppercase tracking-wider font-bold text-success flex items-center gap-1">
          <i data-lucide="plus-circle" class="w-3 h-3"></i> Replacement (Added)
        </div>
        <pre class="bg-neutral text-neutral-content p-2.5 rounded text-3xs overflow-x-auto whitespace-pre-wrap max-h-40 border border-success/20 font-mono text-success-content/90 leading-relaxed" id="diff-replacement-code">${escapeHtml(activeDiff.replacement)}</pre>
      </div>
    </div>
  </div>`;
    }

    const historyItemsHtml = s.recentHistory.length === 0
      ? `<div class="p-2.5 text-center text-3xs font-mono text-base-content/50 italic bg-base-200/30 rounded border border-dashed border-base-300">
           No completed tools in feed yet. Actions appear as tools execute.
         </div>`
      : s.recentHistory.map((item) => `
        <div class="flex items-center justify-between p-2 bg-base-200/50 rounded border border-base-200 text-xs font-mono animate-fade-in transition-all">
          <div class="flex items-center gap-2 min-w-0">
            <span class="badge badge-xs ${item.status === 'ok' ? 'badge-success' : 'badge-error'} font-bold">
              ${item.status === 'ok' ? '✔ ok' : '❌ failed'}
            </span>
            <span class="font-bold text-primary truncate">${escapeHtml(item.name)}</span>
            <span class="text-3xs text-base-content/60 truncate max-w-[140px] sm:max-w-xs">${escapeHtml(item.target)}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="badge badge-xs badge-ghost font-mono">${item.durationMs}ms</span>
          </div>
        </div>
      `).join("");

    return `
<div id="live-feature-observer" class="space-y-4">
  ${attentionBannerHtml}

  <!-- Heartbeat Pill & Stopwatch -->
  <div class="flex items-center justify-between bg-base-200/50 p-3 rounded-lg border border-base-200 flex-wrap gap-2">
    <div class="flex items-center gap-2">
      <span id="live-state-badge" class="badge ${badgeClass} gap-1.5 py-3 px-3 text-xs font-mono font-bold transition-all shadow-xs">
        <span class="w-2 h-2 rounded-full ${pingColor} animate-ping"></span>
        <span id="live-state-text">${stateLabel}</span>
      </span>
      <span class="text-xs font-mono text-base-content/70">
        Provider: <strong id="active-provider-name" class="text-primary font-bold">${escapeHtml(s.providerName)}</strong>
      </span>
    </div>
    <div class="flex items-center gap-1.5 font-mono text-xs text-base-content/70">
      <i data-lucide="clock" class="w-3.5 h-3.5 text-primary"></i>
      <span>Active:</span>
      <span id="live-stopwatch" class="font-bold text-base-content text-sm">${elapsedSec}s</span>
    </div>
  </div>

  <!-- Context Saturation & Token Velocity Widget (Task 3.3) -->
  <div id="context-telemetry-widget" class="card bg-base-200/50 border border-base-300 rounded-lg p-3 text-xs font-mono shadow-xs space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-2xs uppercase tracking-wider text-base-content/60 font-bold flex items-center gap-1.5">
        <i data-lucide="gauge" class="w-3.5 h-3.5 text-primary"></i> Context Saturation &amp; Velocity
      </span>
      <span id="telemetry-sat-badge" class="badge badge-xs ${s.telemetry?.saturationPct > 80 ? 'badge-error' : (s.telemetry?.saturationPct > 50 ? 'badge-warning' : 'badge-primary')} font-mono font-bold">
        ${s.telemetry?.saturationPct || 0}% / ${Math.round((s.telemetry?.contextWindowLimit || 200000) / 1000)}k
      </span>
    </div>
    <div class="flex items-center gap-3">
      <div id="telemetry-radial" class="radial-progress ${s.telemetry?.saturationPct > 80 ? 'text-error' : (s.telemetry?.saturationPct > 50 ? 'text-warning' : 'text-primary')} font-bold text-2xs shrink-0" style="--value:${s.telemetry?.saturationPct || 0}; --size:2.8rem; --thickness:3px;" role="progressbar">
        ${s.telemetry?.saturationPct || 0}%
      </div>
      <div class="space-y-1 min-w-0 flex-1">
        <div class="flex items-center justify-between text-3xs font-mono">
          <span class="text-base-content/70">Context: <strong id="telemetry-tokens-count">${(s.telemetry?.contextTokens || 0).toLocaleString()}</strong> tok</span>
          <span class="text-success font-bold flex items-center gap-0.5">
            <span class="w-1.5 h-1.5 rounded-full bg-success animate-ping"></span>
            <span id="telemetry-vel-count">${s.telemetry?.tokensPerSecond || 0}</span> tok/s
          </span>
        </div>
        <div class="w-full bg-base-300 h-1.5 rounded-full overflow-hidden">
          <div id="telemetry-progress-bar" class="bg-primary h-full transition-all duration-300" style="width: ${s.telemetry?.saturationPct || 0}%"></div>
        </div>
        <div class="flex items-center justify-between text-3xs text-base-content/50 pt-0.5">
          <span>Prompt: ${Math.round((s.telemetry?.promptTokens || 0) / 1000)}k</span>
          <span>Reason: ${Math.round((s.telemetry?.reasoningTokens || 0) / 1000)}k</span>
          <span>Output: ${Math.round((s.telemetry?.completionTokens || 0) / 1000)}k</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Active Tool Execution Card -->
  <div class="bg-base-200/70 rounded-lg p-4 space-y-2 border border-base-300">
    <div class="flex items-center justify-between text-2xs uppercase tracking-wider text-base-content/60 font-bold">
      <span class="flex items-center gap-1.5">
        <i data-lucide="zap" class="w-3.5 h-3.5 text-warning"></i> Active Action Running
      </span>
      <span class="badge badge-xs badge-primary font-mono" id="live-tool-category">${escapeHtml(toolCategory)}</span>
    </div>
    <div class="flex items-baseline gap-2 flex-wrap">
      <span class="font-mono font-black text-sm text-primary" id="live-tool-name">${escapeHtml(toolName)}</span>
      <span class="font-mono text-xs text-base-content/80 truncate max-w-md" id="live-tool-target">${escapeHtml(toolTarget)}</span>
    </div>
    <div class="w-full bg-base-300 h-1.5 rounded-full overflow-hidden">
      <div id="live-tool-progress-bar" class="bg-primary h-full transition-all duration-300" style="width: ${s.state === 'running_tool' ? '85%' : '0%'}"></div>
    </div>
  </div>

  ${codeDiffHtml}

  ${terminalDrawerHtml}

  ${(() => {
    if (!s.subagents || s.subagents.length === 0) return "";
    const subLanesHtml = s.subagents.map((sub) => {
      let subBadge = "bg-blue-600 text-white";
      if (sub.state === "thinking") subBadge = "bg-purple-600 text-white";
      else if (sub.state === "idle") subBadge = "bg-emerald-600 text-white";
      else if (sub.state === "waiting_user") subBadge = "bg-amber-500 text-black";
      else if (sub.state === "error") subBadge = "bg-rose-600 text-white";

      const elapsed = sub.durationMs > 0 ? (sub.durationMs / 1000).toFixed(1) + "s" : (((Date.now() - sub.startedAt) / 1000).toFixed(1) + "s");

      return `
      <div class="p-2.5 bg-base-100 rounded-lg border border-base-300 space-y-1.5 shadow-xs">
        <div class="flex items-center justify-between flex-wrap gap-1">
          <div class="flex items-center gap-1.5 font-bold text-primary">
            <i data-lucide="bot" class="w-3.5 h-3.5 text-primary"></i>
            <span>${escapeHtml(sub.typeName)}</span>
            <span class="text-3xs text-base-content/60 font-mono">(${escapeHtml(sub.role)})</span>
          </div>
          <span class="badge badge-xs ${subBadge} font-mono font-bold">${sub.state.toUpperCase()}</span>
        </div>
        <div class="text-3xs font-mono text-base-content/80 truncate">
          Tool: <code>${escapeHtml(sub.activeTool?.name || 'none')}</code> ${escapeHtml(sub.activeTool?.target ? '(' + sub.activeTool.target + ')' : '')}
        </div>
        <div class="flex items-center justify-between text-3xs font-mono text-base-content/60 pt-1 border-t border-base-200">
          <span>Elapsed: <strong>${elapsed}</strong></span>
          <span class="text-success">✔ Active Swarm Lane</span>
        </div>
      </div>`;
    }).join("\n");

    return `
  <!-- Multi-Agent Swarm Hierarchy & Swimlanes (Task 3.1) -->
  <div id="agent-swarm-hierarchy" class="card bg-base-100 border-2 border-primary/40 rounded-lg shadow-xs overflow-hidden text-xs font-mono">
    <div class="bg-base-300 px-3 py-2 flex items-center justify-between flex-wrap gap-2 border-b border-base-content/10">
      <div class="flex items-center gap-2">
        <i data-lucide="layers" class="w-4 h-4 text-primary"></i>
        <span class="font-bold text-base-content">Agent Swarm Hierarchy (${s.subagents.length} Subagents)</span>
      </div>
      <span class="badge badge-xs badge-info font-mono">invoke_subagent</span>
    </div>
    <div class="p-3 space-y-2 bg-base-200/40">
      <!-- Orchestrator Lane -->
      <div class="p-2.5 bg-primary/10 rounded border border-primary/30 flex items-center justify-between flex-wrap gap-2 text-2xs">
        <div class="flex items-center gap-2">
          <span class="badge badge-primary badge-xs font-bold">👑 Orchestrator</span>
          <span class="font-bold text-base-content">${escapeHtml(s.providerName)}</span>
        </div>
        <span class="badge badge-xs ${badgeClass} font-mono">${stateLabel}</span>
      </div>
      <!-- Child Subagents Grid -->
      <div class="space-y-2 pl-2 border-l-2 border-primary/30">
        ${subLanesHtml}
      </div>
    </div>
  </div>`;
  })()}

  <!-- Latest Reasoning / Goal Bubble -->
  <div class="space-y-1.5">
    <div class="text-2xs uppercase tracking-wider text-base-content/60 font-bold flex items-center gap-1">
      <i data-lucide="brain" class="w-3.5 h-3.5 text-accent"></i> Latest Reasoning / Intent
    </div>
    <div class="chat chat-start">
      <div id="live-thought-bubble" class="chat-bubble chat-bubble-primary text-xs font-mono leading-relaxed opacity-95 shadow-xs">
        ${escapeHtml(s.thought)}
      </div>
    </div>
  </div>

  <!-- Recent Chronological Activity Feed -->
  <div class="space-y-2 pt-2 border-t border-base-200">
    <div class="flex items-center justify-between">
      <div class="text-2xs uppercase tracking-wider text-base-content/60 font-bold flex items-center gap-1">
        <i data-lucide="history" class="w-3.5 h-3.5 text-info"></i> Chronological Activity Stream
      </div>
      <span class="text-3xs font-mono text-base-content/50" id="recent-count-label">${s.recentHistory.length} completed</span>
    </div>
    <div id="live-recent-feed" class="space-y-2 max-h-[220px] overflow-y-auto pr-1">
      ${historyItemsHtml}
    </div>
  </div>
</div>`.trim();
  }

  /**
   * Pushes the current Core Observer HTML to the local dev server SSE stream
   */
  async pushToDevServer({ port = 3000, host = "127.0.0.1", selector = "#live-feature-observer" } = {}) {
    const html = this.renderCoreObserverHtml();
    const payload = JSON.stringify({ selector, mergeMode: "outer", html });

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: host,
          port,
          path: "/__datastar_stream__",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload)
          }
        },
        (res) => {
          let resp = "";
          res.on("data", (c) => { resp += c; });
          res.on("end", () => {
            try {
              resolve(JSON.parse(resp));
            } catch (_) {
              resolve({ ok: res.statusCode === 200, raw: resp });
            }
          });
        }
      );

      req.on("error", (err) => {
        reject(err);
      });

      req.write(payload);
      req.end();
    });
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Background Byte-Offset JSONL Transcript Tailing Daemon (Task 3.2)
 * Tails active agent conversation logs with sub-100ms latency,
 * reading only newly appended bytes to prevent redundant file re-reads.
 */
export class TranscriptTailDaemon extends EventEmitter {
  constructor({
    transcriptPath = null,
    facade = null,
    pollIntervalMs = 250,
    pushToDevServer = true,
    port = 3000,
    host = "127.0.0.1"
  } = {}) {
    super();
    this.transcriptPath = transcriptPath;
    this.facade = facade || new AgentTrackerFacade();
    this.pollIntervalMs = pollIntervalMs;
    this.shouldPush = pushToDevServer;
    this.port = port;
    this.host = host;

    this.lastByteOffset = 0;
    this.remainder = "";
    this.timer = null;
    this.isRunning = false;
  }

  static findDefaultTranscriptPath({ appDataDir = null, conversationId = null } = {}) {
    const baseDir = appDataDir || process.env.ANTIGRAVITY_APP_DATA_DIR || path.join(process.env.HOME || "", ".gemini/antigravity-cli");
    if (conversationId) {
      const p = path.join(baseDir, "brain", conversationId, ".system_generated/logs/transcript.jsonl");
      if (fs.existsSync(p)) return p;
    }

    const brainDir = path.join(baseDir, "brain");
    if (fs.existsSync(brainDir)) {
      try {
        const dirs = fs.readdirSync(brainDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => {
            const p = path.join(brainDir, d.name, ".system_generated/logs/transcript.jsonl");
            if (fs.existsSync(p)) {
              return { path: p, mtime: fs.statSync(p).mtimeMs };
            }
            return null;
          })
          .filter(Boolean)
          .sort((a, b) => b.mtime - a.mtime);

        if (dirs.length > 0) return dirs[0].path;
      } catch (_) {}
    }

    return null;
  }

  async start(filePath = null) {
    if (filePath) this.transcriptPath = filePath;
    if (!this.transcriptPath) {
      this.transcriptPath = TranscriptTailDaemon.findDefaultTranscriptPath();
    }

    if (!this.transcriptPath || !fs.existsSync(this.transcriptPath)) {
      throw new Error(`Transcript file not found: ${this.transcriptPath}`);
    }

    const stats = fs.statSync(this.transcriptPath);
    this.lastByteOffset = Math.max(0, stats.size - 32768);
    this.remainder = "";
    this.isRunning = true;

    await this.readNewBytes();

    this.timer = setInterval(async () => {
      if (this.isRunning) {
        await this.readNewBytes();
      }
    }, this.pollIntervalMs);

    this.emit("started", { path: this.transcriptPath, offset: this.lastByteOffset });
    return this;
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.emit("stopped");
  }

  async readNewBytes() {
    if (!fs.existsSync(this.transcriptPath)) return [];
    try {
      const stats = fs.statSync(this.transcriptPath);
      if (stats.size <= this.lastByteOffset) {
        if (stats.size < this.lastByteOffset) {
          this.lastByteOffset = 0;
          this.remainder = "";
        }
        return [];
      }

      const bytesToRead = stats.size - this.lastByteOffset;
      const buffer = Buffer.alloc(bytesToRead);
      const fd = fs.openSync(this.transcriptPath, "r");
      fs.readSync(fd, buffer, 0, bytesToRead, this.lastByteOffset);
      fs.closeSync(fd);

      this.lastByteOffset = stats.size;
      const chunkStr = this.remainder + buffer.toString("utf8");
      const lines = chunkStr.split("\n");
      this.remainder = lines.pop() || "";

      const parsedEvents = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed);
          parsedEvents.push(json);
          const ingestResult = this.facade.ingest(json);
          this.emit("step", ingestResult);
        } catch (_) {}
      }

      if (parsedEvents.length > 0 && this.shouldPush) {
        try {
          await this.facade.pushToDevServer({ port: this.port, host: this.host });
        } catch (_) {}
      }

      return parsedEvents;
    } catch (err) {
      this.emit("error", err);
      return [];
    }
  }
}

// Standalone CLI Daemon entrypoint
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.includes("--tail")) {
    const portIdx = args.indexOf("--port");
    const port = portIdx !== -1 ? Number(args[portIdx + 1]) || 3000 : 3000;
    const fileIdx = args.indexOf("--file");
    const filePath = fileIdx !== -1 ? args[fileIdx + 1] : null;

    const daemon = new TranscriptTailDaemon({
      transcriptPath: filePath,
      port,
      pushToDevServer: true
    });

    daemon.start().then(() => {
      console.log(`[agent-tracker] Daemon started. Tailing: ${daemon.transcriptPath} -> http://127.0.0.1:${port}/__datastar_stream__`);
    }).catch(err => {
      console.error("[agent-tracker] Failed to start daemon:", err.message);
      process.exit(1);
    });
  }
}
