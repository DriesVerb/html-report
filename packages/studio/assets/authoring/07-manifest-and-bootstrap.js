/* ------------------------------ Deterministic Agent Inspection API ------------------------------ */

HTMLReportAgent.getManifest = function() {
  if (typeof document === "undefined" || !document || typeof document.getElementById !== "function") return null;
  const el = document.getElementById("agent-manifest");
  if (!el || !el.textContent) return null;
  try {
    return JSON.parse(el.textContent);
  } catch (_) {
    return null;
  }
};

HTMLReportAgent.getSections = function() {
  const manifest = this.getManifest();
  if (manifest && Array.isArray(manifest.sections)) {
    return manifest.sections.map((sec) => {
      const el = (typeof document !== "undefined" && document.querySelector)
        ? (document.querySelector(`[data-agent-id="${sec.agentId}"]`) || (sec.id ? document.getElementById(sec.id) : null))
        : null;
      return Object.assign({}, sec, { present: Boolean(el), el });
    });
  }
  if (typeof document === "undefined" || !document.querySelectorAll) return [];
  return Array.from(document.querySelectorAll("[data-agent-section]")).map((el, idx) => ({
    agentId: el.getAttribute("data-agent-id") || `section-${idx + 1}`,
    slug: el.getAttribute("data-agent-section"),
    label: (el.querySelector("h1,h2,h3,h4,h5,h6")?.textContent || "").trim(),
    id: el.id || null,
    selector: el.id ? `#${el.id}` : `[data-agent-id="${el.getAttribute("data-agent-id")}"]`,
    present: true,
    el
  }));
};

HTMLReportAgent.getWidgets = function(type) {
  const manifest = this.getManifest();
  let list = [];
  if (manifest && Array.isArray(manifest.widgets)) {
    list = manifest.widgets.map((w) => {
      const el = (typeof document !== "undefined" && document.querySelector)
        ? (document.querySelector(`[data-agent-id="${w.agentId}"]`) || (w.id ? document.getElementById(w.id) : null))
        : null;
      return Object.assign({}, w, { present: Boolean(el), el });
    });
  } else if (typeof document !== "undefined" && document.querySelectorAll) {
    list = Array.from(document.querySelectorAll("[data-agent-widget]")).map((el, idx) => ({
      agentId: el.getAttribute("data-agent-id") || `widget-${idx + 1}`,
      type: el.getAttribute("data-agent-widget"),
      id: el.id || null,
      selector: el.id ? `#${el.id}` : `[data-agent-id="${el.getAttribute("data-agent-id")}"]`,
      present: true,
      el
    }));
  }
  return type ? list.filter((w) => w.type === type) : list;
};

HTMLReportAgent.scrollToAgent = function(agentId) {
  if (typeof document === "undefined" || !agentId) return false;
  const el = document.querySelector(`[data-agent-id="${agentId}"]`) || document.getElementById(agentId);
  if (!el || typeof el.scrollIntoView !== "function") return false;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
};

HTMLReportAgent.getEditPrompt = function(agentId, instruction = "") {
  const manifest = this.getManifest();
  const target = manifest?.sections?.find((s) => s.agentId === agentId || s.slug === agentId || s.id === agentId)
    || manifest?.widgets?.find((w) => w.agentId === agentId || w.id === agentId);
  const selector = target ? target.selector : `[data-agent-id="${agentId}"]`;
  const fragment = manifest?.files?.fragment || "fragment.html";
  const rebuild = manifest?.pipeline?.rebuildCommand || "node skills/html-report/scripts/build-report.mjs";
  return [
    `Target Element: ${selector} (agentId: ${agentId})`,
    `Source Fragment: ${fragment}`,
    `Rebuild Command: ${rebuild}`,
    instruction ? `Instruction: ${instruction}` : ""
  ].filter(Boolean).join("\n");
};

/* ------------------------------ AI activation ------------------------------ */

const AI_FLAG_PREFIX = "html_report_ai:";

HTMLReportAgent.isAiCapable = function() {
  if (typeof document === "undefined" || !document || typeof document.querySelector !== "function") return false;
  const meta = document.querySelector('meta[name="html-report-ai"]');
  if (meta && meta.getAttribute("content") === "on") return true;
  try {
    const val = _authoringStorage().getItem(AI_FLAG_PREFIX + getPageKey());
    if (val === "on") return true;
    if (val === "off") return false;
  } catch (_) {}
  return Boolean(
    document.querySelector("[data-on-click*='__agent_action__']") ||
    document.querySelector("[data-on-click*='/api/agent']") ||
    document.querySelector("#agent-reaction-bubble") ||
    document.querySelector("[data-agent-action]")
  );
};

HTMLReportAgent.isAiBuildMarked = function() {
  if (typeof document === "undefined" || !document || typeof document.querySelector !== "function") return false;
  const meta = document.querySelector('meta[name="html-report-ai"]');
  return Boolean(meta && meta.getAttribute("content") === "on");
};

HTMLReportAgent.setAiActive = function(on) {
  try {
    const store = _authoringStorage();
    if (on) store.setItem(AI_FLAG_PREFIX + getPageKey(), "on"); else store.setItem(AI_FLAG_PREFIX + getPageKey(), "off");
  } catch (_) {}
  if (typeof document !== "undefined") {
    const container = document.getElementById("agent-bridge-status-container");
    const capable = this.isAiCapable();
    if (container) {
      container.classList.toggle("hidden", !capable);
      container.classList.toggle("flex", capable);
    }
    this._updateDockVisibility();
    if (capable) {
      if (typeof window !== "undefined" && window.location && window.location.protocol === "file:") {
        this._updateState("disconnected");
      } else {
        this.checkConnection();
        this.startHeartbeat();
      }
    } else {
      this.stopHeartbeat();
    }
  }
  return this.isAiCapable();
};

/* ------------------------------ Authoring init ------------------------------ */

function _mkEl(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function initAuthoring() {
  if (typeof document === "undefined" || isPublishedDocument()) return;
  HTMLReportSettings.initGear();

  HTMLReportSettings.registerSection({
    id: "edit", title: "Edit", icon: "pencil", order: 30,
    render(c) {
      const wrap = _mkEl(`<div class="flex items-center justify-between gap-2">
        <span class="text-xs text-base-content/70">Collect edit tasks and turn them into one agent prompt.</span>
        <button id="settings-open-editor" type="button" class="btn btn-primary btn-xs">Open editor <span id="settings-edit-count" class="badge badge-xs">0</span></button></div>`);
      c.appendChild(wrap);
      wrap.querySelector("#settings-open-editor").addEventListener("click", () => {
        HTMLReportEdit.openDock();
        if (HTMLReportSettings.close) HTMLReportSettings.close();
      });
      wrap.querySelector("#settings-edit-count").textContent = String(HTMLReportEdit.getTasks().filter((t) => !t.done).length);
    }
  });

  const refreshAi = () => {
    const toggle = document.getElementById("settings-ai-toggle");
    const status = document.getElementById("settings-ai-status");
    if (!toggle || !status) return;
    const capable = HTMLReportAgent.isAiCapable();
    const buildMarked = HTMLReportAgent.isAiBuildMarked();
    toggle.checked = capable;
    toggle.disabled = buildMarked;
    const state = HTMLReportAgent.getState();
    const card = document.getElementById("settings-ai-turnkey");
    const explainer = document.getElementById("settings-ai-explainer");
    status.textContent = !capable ? "AI is off for this board."
      : state === "connected" ? "Connected: live agent bridge is running."
      : state === "disconnected" ? "Disconnected: start the bridge with the turnkey below."
      : "Connecting...";
    if (explainer) explainer.classList.toggle("hidden", capable);
    if (card) {
      card.classList.toggle("hidden", !(capable && state !== "connected"));
      const pre = document.getElementById("settings-ai-prompt");
      if (pre) pre.textContent = HTMLReportAgent.getReconnectPrompt();
    }
    HTMLReportEdit.refreshSendState();
    if (HTMLReportAgent._updateDockVisibility) HTMLReportAgent._updateDockVisibility();
  };

  HTMLReportSettings.registerSection({
    id: "ai", title: "AI", icon: "sparkles", order: 40,
    render(c) {
      const wrap = _mkEl(`<div class="space-y-2.5 pt-1">
        <label class="flex items-center justify-between cursor-pointer py-1 gap-2"><span class="text-xs font-semibold">Activate AI for this board</span>
          <input id="settings-ai-toggle" type="checkbox" class="toggle toggle-primary toggle-sm" /></label>
        <p id="settings-ai-status" class="text-3xs font-mono text-base-content/70"></p>
        <p id="settings-ai-explainer" class="text-3xs text-base-content/60">Turn on to connect this page to your local agent (agy) for live edits and answers. Nothing leaves your machine.</p>
        <div id="settings-ai-turnkey" class="hidden space-y-1.5 pt-1">
          <pre id="settings-ai-prompt" class="p-2 bg-neutral text-neutral-content rounded font-mono text-3xs whitespace-pre-wrap max-h-32 overflow-y-auto select-all"></pre>
          <p class="text-3xs text-base-content/60">Requires Node.js v18+ to run the local bridge; the report works offline without it.</p>
          <div class="flex gap-2 pt-1">
            <button id="settings-ai-copy" type="button" class="btn btn-primary btn-xs">Copy turnkey prompt</button>
            <button id="settings-ai-retry" type="button" class="btn btn-outline btn-xs">Retry connection</button>
          </div></div></div>`);
      c.appendChild(wrap);
      wrap.querySelector("#settings-ai-toggle").addEventListener("change", (e) => {
        HTMLReportAgent.setAiActive(e.target.checked);
        refreshAi();
      });
      wrap.querySelector("#settings-ai-copy").addEventListener("click", (e) => HTMLReportAgent.copyReconnectPrompt(e.currentTarget));
      wrap.querySelector("#settings-ai-retry").addEventListener("click", async (e) => { await HTMLReportAgent.checkConnection(e.currentTarget); refreshAi(); });
      refreshAi();
    }
  });
  HTMLReportAgent.onStateChange(refreshAi);

  // Wire Publish toggle inside Download section
  const publishToggle = document.getElementById("settings-publish-toggle");
  if (publishToggle) {
    publishToggle.checked = HTMLReportPublisher.isPublishedFlagOn();
    publishToggle.addEventListener("change", () => {
      HTMLReportPublisher.setPublishedFlag(publishToggle.checked);
    });
  }

  // Initialize All Settings tabbed overview modal
  HTMLReportSettings.initAllSettingsModal();

  // Subtle Published badge in the navbar (hidden until toggled)
  const end = document.querySelector(".navbar .navbar-end");
  const gear = document.getElementById("settings-dropdown");
  if (end && gear && !document.getElementById("published-badge")) {
    const badge = _mkEl('<span id="published-badge" class="badge badge-success badge-outline badge-sm hidden font-mono text-3xs" title="Marked as published">Published</span>');
    end.insertBefore(badge, gear);
    HTMLReportPublisher.setPublishedFlag(HTMLReportPublisher.isPublishedFlagOn());
  }

  HTMLReportEdit.initDock();
}

if (typeof window !== "undefined") {
  window.HTMLReportAgent = HTMLReportAgent;
  window.HTMLReportEdit = HTMLReportEdit;
  window.initAuthoring = initAuthoring;
  window.HTMLReport = window.HTMLReport || {};
  window.HTMLReport.agent = HTMLReportAgent;

  if (document.readyState !== "loading") {
    try { HTMLReportAgent.init(); } catch (_) {}
    try { initAuthoring(); } catch (err) { console.warn("[html-report] authoring init failed:", err); }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    HTMLReportAgent,
    HTMLReportEdit,
    HTMLReportSettings,
    HTMLReportPublisher,
    initAuthoring
  };
}
