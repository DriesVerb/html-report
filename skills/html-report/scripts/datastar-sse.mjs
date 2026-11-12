/**
 * datastar-sse.mjs - Real-Time Datastar.js SSE Telemetry Engine
 * Two-Axis Scope: Server-Connected + Interactive / Reactive (scoped to serve-report.mjs).
 * Standardized TaskTelemetrySchema, SessionState, DatastarBridge,
 * and Vendor-Neutral LLM Adapters for Google Antigravity (AGY) and OpenAI Codex.
 */

import { EventEmitter } from "node:events";

/**
 * Escapes special HTML characters to prevent XSS.
 */
export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sends a generic SSE event to an HTTP response stream.
 */
export function sendSSE(res, event, dataLines) {
  if (!res || res.writableEnded) return;
  const lines = [`event: ${event}`];
  const list = Array.isArray(dataLines) ? dataLines : [dataLines];
  for (const item of list) {
    if (typeof item === "string") {
      for (const sub of item.split("\n")) {
        lines.push(`data: ${sub}`);
      }
    } else {
      lines.push(`data: ${JSON.stringify(item)}`);
    }
  }
  res.write(lines.join("\n") + "\n\n");
}

/**
 * Formats and streams a datastar-fragment SSE event.
 */
export function sendFragment(res, { selector, mergeMode = "outer", html = "" } = {}) {
  const data = [];
  if (selector) data.push(`selector ${selector}`);
  if (mergeMode) data.push(`merge ${mergeMode}`);
  const fragmentLines = String(html).trim().split("\n");
  for (const line of fragmentLines) {
    data.push(`fragment ${line}`);
  }
  sendSSE(res, "datastar-fragment", data);
}

/**
 * Formats and streams a datastar-merge-signals SSE event.
 */
export function sendSignals(res, signals) {
  const payload = typeof signals === "string" ? signals : JSON.stringify(signals);
  sendSSE(res, "datastar-merge-signals", [`signals ${payload}`]);
}

/**
 * Formats and streams a datastar-remove-fragments SSE event.
 */
export function removeFragment(res, selector) {
  sendSSE(res, "datastar-remove-fragments", [`selector ${selector}`]);
}

/**
 * Formats and streams a datastar-execute-script SSE event.
 */
export function executeScript(res, script) {
  sendSSE(res, "datastar-execute-script", [`script ${script}`]);
}

/**
 * Task and Session Telemetry Schematic Definitions & Validations
 */
export const TaskTelemetrySchema = {
  taskStatuses: ["pending", "running", "completed", "failed", "skipped"],
  sessionStatuses: ["idle", "running", "paused", "completed", "failed"],
  toolStatuses: ["running", "success", "error"],

  isValidTaskStatus(status) {
    return this.taskStatuses.includes(status);
  },

  isValidSessionStatus(status) {
    return this.sessionStatuses.includes(status);
  },

  isValidToolStatus(status) {
    return this.toolStatuses.includes(status);
  },

  validateTask(task) {
    if (!task || typeof task !== "object") throw new Error("Task must be an object");
    if (!task.id) throw new Error("Task must have an id");
    if (!task.title) throw new Error("Task must have a title");
    if (task.status && !this.isValidTaskStatus(task.status)) {
      throw new Error(`Invalid task status: ${task.status}`);
    }
    return true;
  },

  validateSession(session) {
    if (!session || typeof session !== "object") throw new Error("Session must be an object");
    if (!session.sessionId) throw new Error("Session must have a sessionId");
    if (session.status && !this.isValidSessionStatus(session.status)) {
      throw new Error(`Invalid session status: ${session.status}`);
    }
    return true;
  }
};

/**
 * Single Tool Invocation Record
 */
export class ToolInvocationRecord {
  constructor({
    toolCallId = `tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    toolName = "unknown_tool",
    inputSummary = "",
    outputSummary = "",
    status = "running",
    durationMs = 0,
    startedAt = Date.now(),
    completedAt = null
  } = {}) {
    this.toolCallId = toolCallId;
    this.toolName = toolName;
    this.inputSummary = typeof inputSummary === "object" ? JSON.stringify(inputSummary, null, 2) : String(inputSummary || "");
    this.outputSummary = typeof outputSummary === "object" ? JSON.stringify(outputSummary, null, 2) : String(outputSummary || "");
    this.status = status;
    this.durationMs = durationMs;
    this.startedAt = startedAt;
    this.completedAt = completedAt;
  }

  complete(output = "", status = "success") {
    this.completedAt = Date.now();
    this.status = status;
    this.outputSummary = typeof output === "object" ? JSON.stringify(output, null, 2) : String(output || "");
    this.durationMs = Math.max(0, this.completedAt - this.startedAt);
    return this;
  }
}

/**
 * Stateful Session State containing phases, tasks, and auto-computed metrics.
 */
export class SessionState extends EventEmitter {
  constructor({
    sessionId = `session-${Date.now()}`,
    agentType = "agy",
    status = "idle",
    phases = [],
    activePhaseId = null,
    activeTaskId = null
  } = {}) {
    super();
    this.sessionId = sessionId;
    this.agentType = agentType;
    this.status = status;
    this.activePhaseId = activePhaseId;
    this.activeTaskId = activeTaskId;
    this.startedAt = Date.now();
    this.updatedAt = Date.now();
    this.phases = [];
    this.tools = new Map(); // toolCallId -> ToolInvocationRecord

    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      runningTasks: 0,
      progressPct: 0,
      stepIndex: 0,
      elapsedMs: 0
    };

    if (Array.isArray(phases)) {
      for (const p of phases) {
        this.addPhase(p);
      }
    }
    this.recalculateMetrics();
  }

  addPhase({ id, order, title, status = "pending", tasks = [] }) {
    const phaseOrder = order ?? (this.phases.length + 1);
    const phaseId = id || `phase-${phaseOrder}`;
    const phase = {
      id: phaseId,
      order: phaseOrder,
      title: title || `Phase ${phaseOrder}`,
      status,
      tasks: [],
      progressPct: 0
    };

    if (Array.isArray(tasks)) {
      for (const t of tasks) {
        phase.tasks.push(this._normalizeTask(t, phase.id));
      }
    }

    this.phases.push(phase);
    this.recalculateMetrics();
    return phase;
  }

  _normalizeTask(task, phaseId) {
    return {
      id: task.id || `${phaseId}.task-${Math.random().toString(36).slice(2, 6)}`,
      title: task.title || "Untitled Task",
      description: task.description || "",
      status: task.status || "pending",
      assignedTo: task.assignedTo || (this.agentType === "agy" ? "AGY Agent" : "Codex Agent"),
      progressPct: task.progressPct || 0,
      toolCalls: task.toolCalls || [],
      artifacts: task.artifacts || [],
      startedAt: task.startedAt || null,
      completedAt: task.completedAt || null,
      durationMs: task.durationMs || null,
      error: task.error || null,
      phaseId
    };
  }

  getPhase(phaseId) {
    return this.phases.find((p) => p.id === phaseId || String(p.order) === String(phaseId)) || null;
  }

  getTask(taskId) {
    for (const phase of this.phases) {
      const found = phase.tasks.find((t) => t.id === taskId);
      if (found) return { task: found, phase };
    }
    return null;
  }

  updateTask(taskId, updates = {}) {
    const hit = this.getTask(taskId);
    if (!hit) return null;
    const { task, phase } = hit;

    Object.assign(task, updates);

    if (updates.status === "running" && !task.startedAt) {
      task.startedAt = Date.now();
      this.activeTaskId = task.id;
      this.activePhaseId = phase.id;
      if (phase.status === "pending") phase.status = "running";
    }

    if ((updates.status === "completed" || updates.status === "failed") && !task.completedAt) {
      task.completedAt = Date.now();
      if (task.startedAt) {
        task.durationMs = task.completedAt - task.startedAt;
      }
    }

    this.updatedAt = Date.now();
    this.recalculateMetrics();
    this.emit("task.updated", { task, phase, metrics: this.metrics });
    return { task, phase };
  }

  startTask(taskId, { assignedTo } = {}) {
    const updates = { status: "running" };
    if (assignedTo) updates.assignedTo = assignedTo;
    const hit = this.updateTask(taskId, updates);
    return hit ? hit.task : null;
  }

  completeTask(taskId, { artifacts = [], progressPct = 100 } = {}) {
    const updates = { status: "completed", progressPct };
    if (artifacts && artifacts.length > 0) {
      const current = this.getTask(taskId);
      if (current) {
        updates.artifacts = [...(current.task.artifacts || []), ...artifacts];
      }
    }
    const hit = this.updateTask(taskId, updates);
    return hit ? hit.task : null;
  }

  failTask(taskId, { error = "Execution failed" } = {}) {
    const hit = this.updateTask(taskId, { status: "failed", error });
    return hit ? hit.task : null;
  }

  attachToolCall(taskId, toolData) {
    return this.recordToolInvocation({ ...toolData, taskId: taskId || this.activeTaskId });
  }

  completeToolCall(toolCallId, { outputSummary = "", durationMs = null, status = "success" } = {}) {
    return this.recordToolResult(toolCallId, { outputSummary, durationMs, status });
  }

  recordToolInvocation(toolData) {
    const tool = toolData instanceof ToolInvocationRecord ? toolData : new ToolInvocationRecord(toolData);
    this.tools.set(tool.toolCallId, tool);

    if (this.activeTaskId) {
      const hit = this.getTask(this.activeTaskId);
      if (hit && hit.task) {
        hit.task.toolCalls = hit.task.toolCalls || [];
        hit.task.toolCalls.push(tool);
      }
    }

    this.updatedAt = Date.now();
    this.emit("tool.invoked", tool);
    return tool;
  }

  recordToolResult(toolCallId, { outputSummary = "", status = "success" } = {}) {
    const tool = this.tools.get(toolCallId);
    if (!tool) {
      const fallback = new ToolInvocationRecord({
        toolCallId,
        outputSummary,
        status,
        completedAt: Date.now()
      });
      this.tools.set(toolCallId, fallback);
      this.emit("tool.output", fallback);
      return fallback;
    }

    tool.complete(outputSummary, status);
    this.updatedAt = Date.now();
    this.emit("tool.output", tool);
    return tool;
  }

  recalculateMetrics() {
    let total = 0;
    let completed = 0;
    let failed = 0;
    let running = 0;

    for (const phase of this.phases) {
      const phaseTotal = phase.tasks.length;
      let phaseCompleted = 0;

      for (const task of phase.tasks) {
        total++;
        if (task.status === "completed") {
          completed++;
          phaseCompleted++;
        } else if (task.status === "failed") {
          failed++;
        } else if (task.status === "running") {
          running++;
        }
      }

      phase.progressPct = phaseTotal > 0 ? Math.round((phaseCompleted / phaseTotal) * 100) : 0;
      if (phaseTotal > 0 && phaseCompleted === phaseTotal) {
        phase.status = "completed";
      } else if (phaseCompleted > 0 || phase.tasks.some((t) => t.status === "running")) {
        phase.status = "running";
      }
    }

    this.metrics.totalTasks = total;
    this.metrics.completedTasks = completed;
    this.metrics.failedTasks = failed;
    this.metrics.runningTasks = running;
    this.metrics.progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    this.metrics.elapsedMs = Math.max(0, Date.now() - this.startedAt);

    if (total > 0 && completed === total) {
      this.status = "completed";
    } else if (running > 0 || completed > 0) {
      this.status = "running";
    }

    this.emit("metrics.updated", this.metrics);
    return this.metrics;
  }

  toJSON() {
    return {
      sessionId: this.sessionId,
      agentType: this.agentType,
      status: this.status,
      activePhaseId: this.activePhaseId,
      activeTaskId: this.activeTaskId,
      phases: this.phases,
      metrics: this.metrics,
      startedAt: this.startedAt,
      updatedAt: this.updatedAt
    };
  }
}

export const TaskTelemetrySession = SessionState;

/**
 * DatastarBridge
 * Translates schematic state changes into standard Datastar SSE events:
 * - datastar-fragment (targeting #task-${id}, #tool-call-feed, #tool-${id}, #stepper-phase-${order})
 * - datastar-merge-signals (for progressPct, completedTasks, active theme, etc.)
 */
export class DatastarBridge extends EventEmitter {
  constructor(optsOrSession = {}) {
    super();
    let sessionState = null;
    if (optsOrSession) {
      if (optsOrSession instanceof SessionState || optsOrSession instanceof EventEmitter) {
        sessionState = optsOrSession;
      } else if (optsOrSession.sessionState) {
        sessionState = optsOrSession.sessionState;
      } else if (optsOrSession.session) {
        sessionState = optsOrSession.session;
      }
    }
    this.sessionState = sessionState;
    this.session = sessionState;
    this.clients = new Set();
    if (this.sessionState && typeof this.sessionState.on === "function") {
      this.attachToSession(this.sessionState);
    }
  }

  addClient(res) {
    this.clients.add(res);
    if (res.on) {
      res.on("close", () => {
        this.clients.delete(res);
      });
    }
  }

  broadcast(sseString) {
    for (const client of this.clients) {
      if (!client.writableEnded && typeof client.write === "function") {
        client.write(sseString);
      }
    }
    this.emit("sse", sseString);
  }

  attachToSession(sessionState) {
    this.sessionState = sessionState;
    this.session = sessionState;
    if (typeof sessionState.on === "function") {
      sessionState.on("task.updated", ({ task, phase }) => {
        this.dispatchTaskUpdate(task, phase);
        if (phase) {
          this.dispatchPhaseUpdate(phase, phase.order);
        }
      });

      sessionState.on("tool.invoked", (tool) => {
        this.dispatchToolInvoked(tool);
      });

      sessionState.on("tool.output", (tool) => {
        this.dispatchToolOutput(tool);
      });

      sessionState.on("metrics.updated", (metrics) => {
        this.dispatchMetrics(metrics);
      });
    }
  }

  /**
   * Encodes a Datastar fragment SSE message.
   */
  static formatFragment({ selector, mergeMode = "outer", html }) {
    const lines = ["event: datastar-fragment"];
    if (selector) lines.push(`data: selector ${selector}`);
    if (mergeMode) lines.push(`data: merge ${mergeMode}`);
    const fragmentLines = String(html).trim().split("\n");
    for (const line of fragmentLines) {
      lines.push(`data: fragment ${line}`);
    }
    return lines.join("\n") + "\n\n";
  }

  /**
   * Encodes a Datastar reactive signal merge SSE message.
   */
  static formatSignals(signals) {
    const payload = typeof signals === "string" ? signals : JSON.stringify(signals);
    return `event: datastar-merge-signals\ndata: signals ${payload}\n\n`;
  }

  /**
   * Renders a task card component matching Phase 2 DaisyUI design.
   */
  renderTaskCard(task, phase = null) {
    const status = task.status || "pending";
    const duration = task.durationMs ? `${(task.durationMs / 1000).toFixed(1)}s` : "";

    let statusBadge = "";
    let cardBorder = "border-base-300";

    if (status === "running") {
      cardBorder = "border-primary shadow-sm";
      statusBadge = `
        <span class="badge badge-primary badge-sm gap-1">
          <span class="loading loading-spinner loading-xs"></span> running
        </span>
      `;
    } else if (status === "completed") {
      cardBorder = "border-success/50 bg-success/5";
      statusBadge = `
        <span class="badge badge-success badge-sm gap-1 text-success-content">
          <i data-lucide="check" class="w-3 h-3"></i> completed
        </span>
        ${duration ? `<span class="badge badge-ghost badge-xs font-mono">${duration}</span>` : ""}
      `;
    } else if (status === "failed") {
      cardBorder = "border-error/50 bg-error/5";
      statusBadge = `
        <span class="badge badge-error badge-sm gap-1 text-error-content">
          <i data-lucide="alert-circle" class="w-3 h-3"></i> failed
        </span>
      `;
    } else {
      statusBadge = `<span class="badge badge-ghost badge-sm text-base-content/60">pending</span>`;
    }

    const assignedBadge = task.assignedTo
      ? `<span class="badge badge-outline badge-xs text-3xs font-mono">${escapeHtml(task.assignedTo)}</span>`
      : "";

    return `
<div id="task-${task.id}" class="card card-compact bg-base-100 border ${cardBorder} transition-all duration-200">
  <div class="card-body p-3">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2 min-w-0">
        <input type="checkbox" class="checkbox checkbox-xs checkbox-primary" ${status === "completed" ? "checked" : ""} disabled />
        <span class="font-medium text-xs truncate ${status === "completed" ? "line-through opacity-70" : ""}">${escapeHtml(task.title)}</span>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        ${assignedBadge}
        ${statusBadge}
      </div>
    </div>
    ${task.description ? `<p class="text-3xs text-base-content/70 mt-1">${escapeHtml(task.description)}</p>` : ""}
    ${task.error ? `<div class="alert alert-error py-1 px-2 text-3xs mt-1"><span>${escapeHtml(task.error)}</span></div>` : ""}
  </div>
</div>`.trim();
  }

  renderTaskHtml(task) {
    return this.renderTaskCard(task);
  }

  /**
   * Renders a tool invocation card with collapsible DaisyUI mockup-code terminal.
   */
  renderToolCard(tool) {
    const isRunning = tool.status === "running";
    const isError = tool.status === "error";

    let iconName = "wrench";
    let category = "generic";
    if (tool.toolName.includes("command") || tool.toolName.includes("shell") || tool.toolName === "run_command") {
      iconName = "terminal";
      category = "shell";
    } else if (tool.toolName.includes("file") || tool.toolName.includes("edit") || tool.toolName.includes("read")) {
      iconName = "file-code";
      category = "file";
    } else if (tool.toolName.includes("subagent") || tool.toolName.includes("agent")) {
      iconName = "users";
      category = "subagent";
    } else if (tool.toolName.includes("search") || tool.toolName.includes("web")) {
      iconName = "globe";
      category = "search";
    }

    const statusBadge = isRunning
      ? `<span class="badge badge-warning badge-xs gap-1"><span class="loading loading-spinner loading-xs"></span> running</span>`
      : isError
      ? `<span class="badge badge-error badge-xs">error</span>`
      : `<span class="badge badge-success badge-xs">${tool.durationMs || 0}ms</span>`;

    const stdoutLines = (tool.outputSummary || "").split("\n").slice(0, 15);
    const hasOutput = stdoutLines.length > 0 && stdoutLines[0].length > 0;

    return `
<div id="tool-${tool.toolCallId}" data-tool-category="${category}" class="rounded-box border border-base-300 bg-base-100 p-2.5 text-xs shadow-xs transition mb-2">
  <div class="flex items-center justify-between gap-2">
    <div class="flex items-center gap-1.5 truncate">
      <i data-lucide="${iconName}" class="w-3.5 h-3.5 text-primary shrink-0"></i>
      <span class="font-mono font-semibold text-3xs text-primary">${escapeHtml(tool.toolName)}</span>
      ${tool.inputSummary ? `<span class="text-3xs text-base-content/70 truncate font-mono bg-base-200 px-1 rounded">${escapeHtml(tool.inputSummary.slice(0, 60))}</span>` : ""}
    </div>
    <div class="shrink-0">
      ${statusBadge}
    </div>
  </div>
  ${hasOutput ? `
  <div class="mockup-code bg-neutral text-neutral-content text-3xs mt-2 py-2 px-3 max-h-36 overflow-y-auto">
    ${stdoutLines.map((l) => `<pre data-prefix=">"><code>${escapeHtml(l)}</code></pre>`).join("\n    ")}
  </div>` : ""}
</div>`.trim();
  }

  renderToolHtml(tool) {
    return this.renderToolCard(tool);
  }

  /**
   * Renders DaisyUI stepper item for a phase.
   */
  renderStepperFragment(phase, order) {
    const isPrimary = phase.status === "completed" || phase.status === "running";
    return `<li id="stepper-phase-${order}" class="step ${isPrimary ? "step-primary" : ""} text-xs font-semibold" data-phase-id="${phase.id}">${escapeHtml(phase.title)}</li>`;
  }

  dispatchTaskUpdate(task, phase = null) {
    const html = this.renderTaskCard(task, phase);
    const sse = DatastarBridge.formatFragment({
      selector: `#task-${task.id}`,
      mergeMode: "outer",
      html
    });
    this.broadcast(sse);
    this.emit("sse", sse);
    return sse;
  }

  dispatchToolInvoked(tool) {
    const html = this.renderToolCard(tool);
    const sse = DatastarBridge.formatFragment({
      selector: "#tool-call-feed",
      mergeMode: "prepend",
      html
    });
    this.broadcast(sse);
    this.emit("sse", sse);
    return sse;
  }

  dispatchToolOutput(tool) {
    const html = this.renderToolCard(tool);
    const sse = DatastarBridge.formatFragment({
      selector: `#tool-${tool.toolCallId}`,
      mergeMode: "outer",
      html
    });
    this.broadcast(sse);
    this.emit("sse", sse);
    return sse;
  }

  dispatchPhaseUpdate(phase, order = 1) {
    const html = this.renderStepperFragment(phase, order);
    const sse = DatastarBridge.formatFragment({
      selector: `#stepper-phase-${order}`,
      mergeMode: "outer",
      html
    });
    this.broadcast(sse);
    this.emit("sse", sse);
    return sse;
  }

  dispatchMetrics(metrics) {
    const sse = DatastarBridge.formatSignals({
      session: {
        progressPct: metrics.progressPct,
        completed: metrics.completedTasks,
        total: metrics.totalTasks,
        running: metrics.runningTasks,
        failed: metrics.failedTasks,
        elapsedMs: metrics.elapsedMs
      }
    });
    this.broadcast(sse);
    this.emit("sse", sse);
    return sse;
  }

  broadcastThought(thoughtText) {
    const html = `
<div class="chat chat-start mb-2">
  <div class="chat-header text-3xs font-mono opacity-70 mb-0.5">Agent CoT</div>
  <div class="chat-bubble chat-bubble-primary text-xs leading-relaxed font-mono opacity-90">${escapeHtml(thoughtText)}</div>
</div>`.trim();
    const sse = DatastarBridge.formatFragment({
      selector: "#agent-thought-stream",
      mergeMode: "append",
      html
    });
    this.broadcast(sse);
    this.emit("sse", sse);
    return sse;
  }
}

/**
 * AgyTelemetryAdapter
 * Ingests Google Antigravity (AGY) conversation transcript.jsonl entries,
 * planner steps, and tool calls into the canonical schema.
 */
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

    // 1. Process agent reasoning / Chain-of-Thought
    if (step.thinking) {
      this.emit("thought.delta", {
        stepIndex: step.step_index ?? 0,
        text: String(step.thinking)
      });
      if (this.bridge && typeof this.bridge.broadcastThought === "function") {
        this.bridge.broadcastThought(step.thinking);
      }
    }

    // 2. Process tool calls
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

    // 3. Process tool output response
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

    // 4. Check for task tracking markdown checkboxes in content
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

/**
 * CodexTelemetryAdapter
 * Ingests OpenAI Codex streaming response chunks and tool call deltas into the canonical schema.
 */
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
    this.activeToolCallBuffers = new Map(); // index -> { id, name, argsBuffer }
  }

  processChunk(chunk = {}) {
    if (!chunk || typeof chunk !== "object") return;
    const choice = chunk.choices?.[0] || {};
    const delta = choice.delta || {};

    // 1. Ingest reasoning content
    const reasoning = delta.reasoning_content || delta.reasoning || (delta.content && delta.role === "assistant" && delta.content.startsWith("Thinking:") ? delta.content : null);
    if (reasoning) {
      this.emit("thought.delta", { text: reasoning });
      if (this.bridge && typeof this.bridge.broadcastThought === "function") {
        this.bridge.broadcastThought(reasoning);
      }
    }

    // 2. Ingest tool call delta chunks
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

        if (tc.function?.name) {
          buffer.name = tc.function.name;
        }

        if (tc.function?.arguments) {
          buffer.argsBuffer += tc.function.arguments;
        }

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
    if (durationMs) {
      record.durationMs = durationMs;
    }

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

/**
 * TelemetryReactorSchema
 * Standardized schematic definitions for multimodal and time-series reactive data events.
 */
export const TelemetryReactorSchema = {
  modalities: ["time-series", "environmental-api", "visual-image"],
  sentiments: ["bullish", "bearish", "neutral", "alert", "favorable", "warning", "critical", "identified"],

  isValidModality(m) {
    return this.modalities.includes(m);
  },

  isValidSentiment(s) {
    return this.sentiments.includes(String(s).toLowerCase());
  },

  validateEvent(event) {
    if (!event || typeof event !== "object") throw new Error("Event must be an object");
    if (!event.modality || !this.isValidModality(event.modality)) {
      throw new Error(`Invalid or missing event modality: ${event?.modality}. Must be one of: ${this.modalities.join(", ")}`);
    }
    if (!event.id) {
      event.id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    }
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }

    if (event.modality === "time-series") {
      if (typeof event.value !== "number" && typeof event.price !== "number") {
        throw new Error("time-series event requires numeric 'value' or 'price'");
      }
    } else if (event.modality === "environmental-api") {
      if (!event.endpoint && !event.payload && typeof event.temperature !== "number" && !event.conditions) {
        throw new Error("environmental-api event requires 'endpoint', 'payload', 'temperature', or 'conditions'");
      }
    } else if (event.modality === "visual-image") {
      if (!event.imageUrl && !event.imageBase64 && !event.svg && !event.entityId) {
        throw new Error("visual-image event requires 'imageUrl', 'imageBase64', 'svg', or 'entityId'");
      }
    }
    return true;
  }
};

/**
 * AnomalyTriggerEngine
 * Sliding window statistical filter & debounce engine suppressing sub-threshold noise
 * and scheduling inference cycles on volatility anomalies or new multimodal targets.
 */
export class AnomalyTriggerEngine {
  constructor({
    windowSize = 20,
    thresholdStdDev = 2.0,
    thresholdDeltaPct = 3.0,
    minCooldownMs = 3000
  } = {}) {
    this.windowSize = windowSize;
    this.thresholdStdDev = thresholdStdDev;
    this.thresholdDeltaPct = thresholdDeltaPct;
    this.minCooldownMs = minCooldownMs;
    this.history = new Map();
    this.lastTriggerTime = new Map();
    this.suppressedCount = 0;
    this.triggeredCount = 0;
  }

  evaluate(event) {
    TelemetryReactorSchema.validateEvent(event);
    const key = event.key || event.metric || event.entityId || event.modality;
    const now = event.timestamp || Date.now();

    const lastTime = this.lastTriggerTime.get(key) || 0;
    const elapsed = now - lastTime;
    const inCooldown = elapsed < this.minCooldownMs;

    if (event.modality === "visual-image") {
      const lastEntity = this.history.get(key);
      const isNew = lastEntity !== (event.entityId || event.imageUrl || event.svg);
      if (isNew || event.forceTrigger) {
        if (!inCooldown || event.forceTrigger) {
          this.history.set(key, event.entityId || event.imageUrl || event.svg);
          this.lastTriggerTime.set(key, now);
          this.triggeredCount++;
          return { triggered: true, reason: "new-visual-target", event };
        }
      }
      this.suppressedCount++;
      return { triggered: false, reason: "cooldown-or-duplicate-visual", event };
    }

    if (event.modality === "environmental-api") {
      if (event.alert || event.severe || (event.precipitationPct && event.precipitationPct > 80)) {
        if (!inCooldown || event.forceTrigger) {
          this.lastTriggerTime.set(key, now);
          this.triggeredCount++;
          return { triggered: true, reason: "severe-weather-alert", event };
        }
      }
      const val = typeof event.temperature === "number" ? event.temperature : event.value;
      if (typeof val === "number") {
        return this._evaluateNumericWindow(key, val, now, inCooldown, event);
      }
      this.suppressedCount++;
      return { triggered: false, reason: "steady-environmental-state", event };
    }

    const numericVal = typeof event.value === "number" ? event.value : event.price;
    if (typeof numericVal === "number") {
      return this._evaluateNumericWindow(key, numericVal, now, inCooldown, event);
    }

    this.suppressedCount++;
    return { triggered: false, reason: "unrecognized-metric", event };
  }

  _evaluateNumericWindow(key, val, now, inCooldown, event) {
    let window = this.history.get(key);
    if (!window) {
      window = [];
      this.history.set(key, window);
    }
    window.push(val);
    if (window.length > this.windowSize) {
      window.shift();
    }

    if (window.length < 3) {
      this.suppressedCount++;
      return { triggered: false, reason: "insufficient-history", event };
    }

    const mean = window.reduce((acc, v) => acc + v, 0) / window.length;
    const variance = window.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / window.length;
    const stdDev = Math.sqrt(variance);

    const prev = window[window.length - 2];
    const deltaPct = prev !== 0 ? Math.abs((val - prev) / prev) * 100 : 0;
    const zScore = stdDev > 0 ? Math.abs(val - mean) / stdDev : 0;

    const isAnomaly = zScore >= this.thresholdStdDev || deltaPct >= this.thresholdDeltaPct || event.forceTrigger;

    if (isAnomaly) {
      if (!inCooldown || event.forceTrigger) {
        this.lastTriggerTime.set(key, now);
        this.triggeredCount++;
        return {
          triggered: true,
          reason: zScore >= this.thresholdStdDev ? "std-dev-breach" : "delta-pct-spike",
          stats: { zScore, deltaPct, mean, stdDev },
          event
        };
      }
    }

    this.suppressedCount++;
    return {
      triggered: false,
      reason: inCooldown ? "cooldown-suppressed" : "sub-threshold-jitter",
      stats: { zScore, deltaPct, mean, stdDev },
      event
    };
  }
}

/**
 * AgentReactorBridge
 * Multimodal Reactive Agent Bridge connecting live telemetry events
 * (time-series, weather APIs, visual images) to agent evaluation loops and Datastar SSE morphing.
 */
export class AgentReactorBridge extends EventEmitter {
  constructor({
    bridge = null,
    agentType = "agy",
    anomalyEngine = null,
    sentimentSelector = "#sentiment-badge",
    thoughtSelector = "#agent-thought-stream"
  } = {}) {
    super();
    this.bridge = bridge;
    this.agentType = agentType;
    this.anomalyEngine = anomalyEngine || new AnomalyTriggerEngine();
    this.sentimentSelector = sentimentSelector;
    this.thoughtSelector = thoughtSelector;
    this.evaluationCount = 0;
  }

  evaluateTelemetry(event) {
    TelemetryReactorSchema.validateEvent(event);
    const result = this.anomalyEngine.evaluate(event);
    this.emit("telemetry.evaluated", result);

    if (result.triggered) {
      this.emit("anomaly.triggered", result);
    } else {
      this.emit("telemetry.suppressed", result);
    }
    return result;
  }

  async *streamReaction(event, { customContext = "" } = {}) {
    TelemetryReactorSchema.validateEvent(event);
    this.evaluationCount++;
    this.emit("reaction.start", { event, count: this.evaluationCount });

    const chunks = this._generateReactionChunks(event, customContext);
    let fullText = "";

    for (const chunk of chunks) {
      fullText += chunk;
      this.emit("reaction.delta", { delta: chunk, fullText });
      yield chunk;
    }

    const sentiment = this._determineSentiment(event);
    this.emit("reaction.complete", { fullText, sentiment, event });

    if (this.bridge) {
      this.dispatchReactionToBridge(fullText, sentiment, event);
    }
  }

  _determineSentiment(event) {
    if (event.sentiment) return event.sentiment;
    if (event.modality === "time-series") {
      const delta = event.deltaPct || event.changePct || 0;
      if (delta >= 2.0) return "bullish";
      if (delta <= -2.0) return "bearish";
      return "neutral";
    }
    if (event.modality === "environmental-api") {
      if (event.severe || event.alert) return "warning";
      if (event.precipitationPct && event.precipitationPct > 70) return "warning";
      return "favorable";
    }
    if (event.modality === "visual-image") {
      return "identified";
    }
    return "neutral";
  }

  _generateReactionChunks(event, customContext = "") {
    let narrative = "";
    if (event.modality === "time-series") {
      const delta = event.deltaPct || event.changePct || 0;
      const price = event.price || event.value;
      if (delta <= -2.0) {
        narrative = `Sudden liquidity contraction detected on ${event.metric || "metric"}. Value dropped to $${price} (${delta.toFixed(1)}%). Elevated sell volume observed; monitoring immediate support shelf.`;
      } else if (delta >= 2.0) {
        narrative = `Bullish momentum surge on ${event.metric || "metric"}! Price broke out to $${price} (+${delta.toFixed(1)}%). Moving average expansion confirms upward volume flow.`;
      } else {
        narrative = `Consolidation detected on ${event.metric || "metric"}. Price trades steadily at $${price} with low volatility.`;
      }
    } else if (event.modality === "environmental-api") {
      if (event.severe || event.alert) {
        narrative = `SEVERE WEATHER WARNING: Extreme atmospheric transition detected (${event.conditions || "Severe Alert"}). Barometric drop and elevated precipitation risk require immediate precautionary steps.`;
      } else {
        narrative = `Weather telemetry normal: Current reading ${event.temperature || event.value}°C with ${event.conditions || "mild conditions"}. Environmental baselines steady.`;
      }
    } else if (event.modality === "visual-image") {
      const entity = event.entityName || event.entityId || "Target Entity";
      narrative = `Visual identification confirmed: ${entity}. Elemental analysis and strategic tactical counters mapped successfully.`;
    }

    if (customContext) {
      narrative += ` Context: ${customContext}`;
    }

    const words = narrative.split(" ");
    return words.map((w, idx) => (idx === 0 ? w : " " + w));
  }

  dispatchReactionToBridge(fullText, sentiment, event = {}) {
    if (!this.bridge) return;

    const timeStr = new Date().toTimeString().split(" ")[0];
    const sentimentHtml = this.renderSentimentBadge(sentiment);
    const bubbleHtml = `
<div class="chat chat-start transition-all duration-300">
  <div class="chat-header text-3xs font-mono opacity-70 mb-0.5">${escapeHtml(event.entityName || event.metric || "Co-Pilot")} · ${timeStr}</div>
  <div class="chat-bubble chat-bubble-primary text-xs leading-relaxed font-sans shadow-sm">${escapeHtml(fullText)}</div>
</div>`.trim();

    const bubbleSse = DatastarBridge.formatFragment({
      selector: this.thoughtSelector,
      mergeMode: "append",
      html: bubbleHtml
    });
    this.bridge.broadcast(bubbleSse);

    const sentimentSse = DatastarBridge.formatFragment({
      selector: this.sentimentSelector,
      mergeMode: "outer",
      html: sentimentHtml
    });
    this.bridge.broadcast(sentimentSse);

    const signalsSse = DatastarBridge.formatSignals({
      copilot: {
        sentiment,
        lastUpdate: timeStr,
        modality: event.modality || "general",
        evaluationCount: this.evaluationCount
      }
    });
    this.bridge.broadcast(signalsSse);
  }

  renderSentimentBadge(sentiment) {
    const s = String(sentiment).toLowerCase();
    if (s === "bullish") {
      return `<span id="sentiment-badge" class="badge badge-success badge-sm font-semibold gap-1"><i data-lucide="trending-up" class="w-3 h-3"></i> Bullish (Momentum)</span>`;
    }
    if (s === "bearish") {
      return `<span id="sentiment-badge" class="badge badge-error badge-sm font-semibold gap-1"><i data-lucide="alert-triangle" class="w-3 h-3"></i> Bearish (Dip)</span>`;
    }
    if (s === "warning" || s === "alert") {
      return `<span id="sentiment-badge" class="badge badge-error badge-sm font-semibold gap-1"><i data-lucide="alert-circle" class="w-3 h-3"></i> Severe Warning</span>`;
    }
    if (s === "favorable") {
      return `<span id="sentiment-badge" class="badge badge-info badge-sm font-semibold gap-1"><i data-lucide="sun" class="w-3 h-3"></i> Favorable</span>`;
    }
    if (s === "identified") {
      return `<span id="sentiment-badge" class="badge badge-accent badge-sm font-semibold gap-1"><i data-lucide="sparkles" class="w-3 h-3"></i> Entity Identified</span>`;
    }
    return `<span id="sentiment-badge" class="badge badge-ghost badge-sm text-base-content/70">Neutral</span>`;
  }
}
