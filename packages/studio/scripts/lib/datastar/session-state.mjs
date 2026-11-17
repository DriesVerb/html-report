/**
 * Canonical task & session telemetry schema and stateful SessionState model.
 */
import { EventEmitter } from "node:events";

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
    this.tools = new Map();

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
