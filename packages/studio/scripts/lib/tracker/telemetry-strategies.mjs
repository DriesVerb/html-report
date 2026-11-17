/**
 * Provider-specific telemetry normalization strategies
 * (Google Antigravity, Anthropic Claude Code, OpenAI Codex/Swarm, Generic).
 */
import { CanonicalAgentStates, sanitizeCanonicalEvent } from "./canonical-schema.mjs";

export class AgentTelemetryStrategy {
  constructor(providerId, displayName) {
    if (this.constructor === AgentTelemetryStrategy) {
      throw new TypeError("AgentTelemetryStrategy is an abstract class and cannot be instantiated directly.");
    }
    this.providerId = providerId;
    this.displayName = displayName;
  }

  canHandle(_rawPayload) {
    return false;
  }

  normalize(_rawPayload) {
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

    if (raw.status === "ERROR" || raw.type === "ERROR") {
      state = "error";
    } else if (raw.status === "WAITING_USER") {
      state = "waiting_user";
    } else if (Array.isArray(raw.tool_calls) && raw.tool_calls.length > 0) {
      const tc = raw.tool_calls[0];
      const callData = tc.call || tc;
      const toolName = callData.name || "tool";
      const args = callData.args || {};

      state = toolName === "ask_question" ? "waiting_user" : "running_tool";

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
