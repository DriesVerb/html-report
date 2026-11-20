/**
 * DatastarBridge: Translates schematic session state changes into Datastar SSE events.
 */
import { EventEmitter } from "node:events";
import { escapeHtml, buildFragmentEvents } from "./sse-primitives.mjs";
import { SessionState } from "./session-state.mjs";

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

  static formatFragment(options = {}) {
    const { mergeData, legacyData } = buildFragmentEvents(options);
    const mergeLines = ["event: datastar-merge-fragments", ...mergeData.map((d) => `data: ${d}`)];
    const legacyLines = ["event: datastar-fragment", ...legacyData.map((d) => `data: ${d}`)];
    return mergeLines.join("\n") + "\n\n" + legacyLines.join("\n") + "\n\n";
  }

  static formatSignals(signals) {
    const payload = typeof signals === "string" ? signals : JSON.stringify(signals);
    return `event: datastar-merge-signals\ndata: signals ${payload}\n\n`;
  }

  renderTaskCard(task) {
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
  <div class="mockup-code bg-neutral text-neutral-content text-3xs mt-2 py-2 px-3 max-h-36 overflow-y-auto w-full max-w-full">
    ${stdoutLines.map((l) => `<pre data-prefix=">" class="whitespace-pre-wrap break-words"><code>${escapeHtml(l)}</code></pre>`).join("\n    ")}
  </div>` : ""}
</div>`.trim();
  }

  renderToolHtml(tool) {
    return this.renderToolCard(tool);
  }

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
