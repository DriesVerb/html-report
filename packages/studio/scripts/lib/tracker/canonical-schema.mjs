/**
 * Canonical agent states, tool categories, and event sanitization
 * for @html-report/studio Agent Tracker.
 */

export const CanonicalAgentStates = Object.freeze([
  "thinking",
  "running_tool",
  "waiting_user",
  "idle",
  "error"
]);

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
