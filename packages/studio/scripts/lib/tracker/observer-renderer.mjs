/**
 * Publication-grade HTML snippet renderer for the Core Observer UI component.
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

function resolveStateStyling(state) {
  switch (state) {
    case "running_tool":
      return { badgeClass: "bg-blue-600 text-white", stateLabel: "EXECUTING TOOL", pingColor: "bg-white" };
    case "waiting_user":
      return { badgeClass: "bg-amber-500 text-black animate-pulse", stateLabel: "WAITING ON USER", pingColor: "bg-black" };
    case "idle":
      return { badgeClass: "bg-emerald-600 text-white", stateLabel: "IDLE", pingColor: "bg-white" };
    case "error":
      return { badgeClass: "bg-rose-600 text-white animate-bounce", stateLabel: "ERROR", pingColor: "bg-white" };
    default:
      return { badgeClass: "bg-purple-600 text-white", stateLabel: "THINKING", pingColor: "bg-white" };
  }
}

function renderTerminalDrawer(s, toolCategory, toolTarget) {
  const activeOut = s.activeTool?.output || (s.recentHistory.find((h) => h.output)?.output);
  const cmdStr = s.activeTool?.target || (s.recentHistory.find((h) => h.output)?.target) || (toolCategory === "bash" ? toolTarget : "");
  const isTerminalTool = s.activeTool?.category === "bash" || s.activeTool?.category === "terminal" || activeOut;
  if (!isTerminalTool || !cmdStr) return "";

  const exitCode = activeOut?.exitCode ?? 0;
  const stdout = activeOut?.stdout || "Command completed with status 0.";
  const stderr = activeOut?.stderr || "";
  const stdoutLines = stdout.split("\n").filter((l) => l.length > 0).map((l) => `<pre data-prefix=">" class="text-success-content/90 font-mono"><code>${escapeHtml(l)}</code></pre>`).join("\n");
  const stderrLines = stderr ? stderr.split("\n").filter((l) => l.length > 0).map((l) => `<pre data-prefix="!" class="text-error font-bold font-mono"><code>${escapeHtml(l)}</code></pre>`).join("\n") : "";

  return `
  <!-- Expandable Terminal Output Drawer (mockup-code) -->
  <div id="terminal-output-drawer" class="collapse collapse-arrow bg-neutral text-neutral-content rounded-lg border border-base-300 text-xs font-mono shadow-xs overflow-hidden">
    <input type="checkbox" id="terminal-drawer-toggle" checked /> 
    <div class="collapse-title font-bold text-2xs uppercase tracking-wider flex items-center justify-between pr-8">
      <span class="flex items-center gap-2">
        <i data-lucide="terminal" class="w-3.5 h-3.5 text-warning"></i>
        <span class="truncate max-w-[200px] sm:max-w-xs">Terminal: $ ${escapeHtml(cmdStr.slice(0, 45))}</span>
      </span>
      <span class="badge badge-xs ${exitCode === 0 ? "badge-success" : "badge-error"} font-mono">${exitCode === 0 ? "✔ exit 0" : "❌ exit " + exitCode}</span>
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

function renderAttentionBanner(state) {
  if (state === "waiting_user") {
    return `
  <!-- Human Attention Alert Banner -->
  <div id="human-attention-banner" class="p-3 bg-amber-500/15 border-2 border-amber-500 rounded-lg flex items-center justify-between flex-wrap gap-2 animate-pulse text-xs font-mono text-amber-900 dark:text-amber-200 shadow-xs">
    <div class="flex items-center gap-2">
      <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0"></span>
      <span class="font-bold">⚠️ AGENT WAITING ON HUMAN ATTENTION</span>
      <span class="text-3xs opacity-80">(Action confirmation or decision required)</span>
    </div>
    <button type="button" onclick="window.fireStrategyAction && window.fireStrategyAction('step')" class="btn btn-2xs btn-warning font-bold">Acknowledge</button>
  </div>`;
  }
  if (state === "error") {
    return `
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
  return "";
}

function renderCodeDiff(s) {
  const activeDiff = s.activeTool?.diff || (s.recentHistory.find((h) => h.diff)?.diff);
  if (!activeDiff || !activeDiff.filePath) return "";
  return `
  <!-- Code Modification Diff Preview -->
  <div id="code-diff-preview" class="card bg-base-100 border-2 border-primary/40 rounded-lg shadow-xs overflow-hidden text-xs font-mono">
    <div class="bg-base-300 px-3 py-2 flex items-center justify-between flex-wrap gap-2 border-b border-base-content/10">
      <div class="flex items-center gap-2">
        <i data-lucide="file-diff" class="w-4 h-4 text-primary"></i>
        <span class="font-bold text-base-content truncate max-w-xs" id="diff-filepath">${escapeHtml(activeDiff.filePath)}</span>
      </div>
      <span class="badge badge-xs ${activeDiff.isNewFile ? "badge-accent" : "badge-secondary"} font-mono">
        ${activeDiff.isNewFile ? "+ NEW FILE" : "⚡ EDIT SNIPPET"}
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

function renderSwarmHierarchy(s, badgeClass, stateLabel) {
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
          Tool: <code>${escapeHtml(sub.activeTool?.name || "none")}</code> ${escapeHtml(sub.activeTool?.target ? "(" + sub.activeTool.target + ")" : "")}
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
}

export function renderCoreObserverHtml(s) {
  const elapsedSec = ((Date.now() - s.stateStartedAt) / 1000).toFixed(1);
  const { badgeClass, stateLabel, pingColor } = resolveStateStyling(s.state);

  const toolName = s.activeTool?.name || "none";
  const toolTarget = s.activeTool?.target || (s.state === "waiting_user" ? "Waiting for user action" : "No active tool");
  const toolCategory = s.activeTool?.category || (s.state === "running_tool" ? "action" : "idle");

  const terminalDrawerHtml = renderTerminalDrawer(s, toolCategory, toolTarget);
  const attentionBannerHtml = renderAttentionBanner(s.state);
  const codeDiffHtml = renderCodeDiff(s);
  const swarmHtml = renderSwarmHierarchy(s, badgeClass, stateLabel);

  const historyItemsHtml = s.recentHistory.length === 0
    ? `<div class="p-2.5 text-center text-3xs font-mono text-base-content/50 italic bg-base-200/30 rounded border border-dashed border-base-300">
         No completed tools in feed yet. Actions appear as tools execute.
       </div>`
    : s.recentHistory.map((item) => `
      <div class="flex items-center justify-between p-2 bg-base-200/50 rounded border border-base-200 text-xs font-mono animate-fade-in transition-all">
        <div class="flex items-center gap-2 min-w-0">
          <span class="badge badge-xs ${item.status === "ok" ? "badge-success" : "badge-error"} font-bold">
            ${item.status === "ok" ? "✔ ok" : "❌ failed"}
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
      <span id="telemetry-sat-badge" class="badge badge-xs ${s.telemetry?.saturationPct > 80 ? "badge-error" : (s.telemetry?.saturationPct > 50 ? "badge-warning" : "badge-primary")} font-mono font-bold">
        ${s.telemetry?.saturationPct || 0}% / ${Math.round((s.telemetry?.contextWindowLimit || 200000) / 1000)}k
      </span>
    </div>
    <div class="flex items-center gap-3">
      <div id="telemetry-radial" class="radial-progress ${s.telemetry?.saturationPct > 80 ? "text-error" : (s.telemetry?.saturationPct > 50 ? "text-warning" : "text-primary")} font-bold text-2xs shrink-0" style="--value:${s.telemetry?.saturationPct || 0}; --size:2.8rem; --thickness:3px;" role="progressbar">
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
      <div id="live-tool-progress-bar" class="bg-primary h-full transition-all duration-300" style="width: ${s.state === "running_tool" ? "85%" : "0%"}"></div>
    </div>
  </div>

  ${codeDiffHtml}
  ${terminalDrawerHtml}
  ${swarmHtml}

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
