/**
 * @html-report/studio Authoring Plugin (authoring-plugin.js)
 * Opt-in Edit Mode (#edit-dock), Element Selection, OKLCH Style Editor,
 * All Settings Modal, and Two-Way AI Agent Bridge (HTMLReportAgent).
 */

(function () {
const _coreEnv = (typeof require === "function" && typeof window === "undefined")
  ? require("@html-report/core/assets/report-runtime.js")
  : (typeof window !== "undefined" ? window : globalThis);

const {
  STANDARD_DAISYUI_THEMES,
  DAISYUI_THEMES,
  escapeHtml,
  compileTheme,
  tailwindConfigSnippet,
  registerCustomTheme,
  setReportTheme,
  createThemeSwatchButton,
  _triggerBlobDownload,
  _authoringStorage,
  getPageKey,
  isPublishedDocument,
  HTMLReportSettings,
  HTMLReportPublisher
} = _coreEnv;

/**
 * Universal Two-Way Agent Bridge Client
 * Provides programmatic co-pilot inference and action execution from reports.
 */
const HTMLReportAgent = {
  _connectionState: "checking",
  _listeners: new Set(),
  _heartbeatTimer: null,
  _sessionId: null,
  _targetElement: null,
  _isDockOpen: false,
  _dockInitialized: false,
  _history: [],
  _contextProviders: [],
  _transportAdapter: null,
  _lastPreflight: null,
  _csrfToken: null,
  _csrfExpiresAt: 0,

  _getCsrfToken: async function() {
    if (typeof window === "undefined") return null;
    if (this._csrfToken && Date.now() < this._csrfExpiresAt - 30000) {
      return this._csrfToken;
    }
    try {
      const res = await fetch("/api/agent/csrf-token", { method: "GET", cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.csrfToken) {
          this._csrfToken = data.csrfToken;
          this._csrfExpiresAt = data.expiresAt || (Date.now() + 300000);
          return this._csrfToken;
        }
      }
    } catch (_) {}
    return null;
  },

  registerContextProvider: function(fn) {
    if (typeof fn === "function") {
      this._contextProviders.push(fn);
      return () => {
        this._contextProviders = this._contextProviders.filter((p) => p !== fn);
      };
    }
    return () => {};
  },

  setTransportAdapter: function(fn) {
    this._transportAdapter = typeof fn === "function" ? fn : null;
    return this;
  },

  collectCustomContext: function(baseContext = {}) {
    const merged = {};
    for (const provider of this._contextProviders) {
      try {
        const extra = provider(baseContext);
        if (extra && typeof extra === "object" && !Array.isArray(extra)) {
          Object.assign(merged, extra);
        }
      } catch (_) {}
    }
    return merged;
  },

  checkPreflight: async function() {
    if (typeof window !== "undefined" && window.location && window.location.protocol === "file:") {
      return { ok: false, offline: true, ai: { available: false, activeProvider: null } };
    }
    try {
      const cfg = this.getAiConfig();
      const endpoint = (typeof window === "undefined" && typeof process !== "undefined")
        ? `http://127.0.0.1:${process.env.REPORT_PORT || cfg.port || 3031}/api/agent/preflight`
        : "/api/agent/preflight";
      const res = await fetch(endpoint, { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        this._lastPreflight = data;
        if (typeof document !== "undefined") {
          const dockStatus = document.getElementById("agent-dock-status");
          if (dockStatus && data.ai) {
            dockStatus.textContent = data.ai.available
              ? `Bridge: Online • AI: ${data.ai.activeProvider}`
              : "Bridge: Online • AI Provider: Unavailable";
          }
        }
        return data;
      }
    } catch (_) {}
    return { ok: false, ai: { available: false, activeProvider: null } };
  },

  getState: function() {
    return this._connectionState;
  },

  onStateChange: function(fn) {
    if (typeof fn === "function") {
      this._listeners.add(fn);
      return () => this._listeners.delete(fn);
    }
    return () => {};
  },

  _updateState: function(newState, data) {
    this._connectionState = newState;
    if (typeof document !== "undefined") {
      const container = document.getElementById("agent-bridge-status-container");
      const btn = document.getElementById("agent-bridge-status-btn");
      const indicator = document.getElementById("agent-bridge-status-indicator");
      const text = document.getElementById("agent-bridge-status-text");

      const dockDot = document.getElementById("agent-dock-dot");
      const dockPing = document.getElementById("agent-dock-ping");
      const dockStatus = document.getElementById("agent-dock-status");

      if (container) {
        container.classList.remove("hidden");
        container.classList.add("flex");
      }

      if (btn && indicator && text) {
        if (newState === "connected") {
          btn.className = "badge badge-success badge-xs sm:badge-sm font-mono gap-1 transition shadow-sm cursor-pointer border border-success/40 text-success-content";
          indicator.className = "inline-block w-1.5 h-1.5 rounded-full bg-success-content animate-pulse";
          text.textContent = "LIVE AGENT";
          btn.title = `Two-Way Agent Bridge Connected (${data?.bridge || 'agy CLI'})`;
          const modal = document.getElementById("agent-reconnect-modal");
          if (modal && typeof modal.close === "function" && modal.open) {
            modal.close();
          }
          if (typeof this.hydratePersonas === "function") {
            this.hydratePersonas();
          }
        } else if (newState === "disconnected") {
          btn.className = "badge badge-warning badge-xs sm:badge-sm font-mono gap-1 transition shadow-sm cursor-pointer border border-warning/40 text-warning-content animate-pulse";
          indicator.className = "inline-block w-1.5 h-1.5 rounded-full bg-warning-content";
          text.textContent = "AGENT OFFLINE";
          btn.title = "Agent Bridge Disconnected. Click to restore connection.";
        } else {
          btn.className = "badge badge-ghost badge-xs sm:badge-sm font-mono gap-1 transition shadow-sm cursor-pointer border border-base-300";
          indicator.className = "inline-block w-1.5 h-1.5 rounded-full bg-base-content/40 animate-pulse";
          text.textContent = "CHECKING...";
        }
      }

      if (dockDot && dockPing) {
        if (newState === "connected") {
          dockDot.className = "relative inline-flex rounded-full h-2.5 w-2.5 bg-success-content";
          dockPing.className = "animate-ping absolute inline-flex h-full w-full rounded-full bg-success-content opacity-75";
          if (dockStatus) dockStatus.textContent = "Online • Live AI Assistant";
        } else if (newState === "disconnected") {
          dockDot.className = "relative inline-flex rounded-full h-2.5 w-2.5 bg-warning-content";
          dockPing.className = "hidden";
          if (dockStatus) dockStatus.textContent = "Offline • Turnkey Bridge Ready";
        } else {
          dockDot.className = "relative inline-flex rounded-full h-2.5 w-2.5 bg-base-content/40";
          dockPing.className = "hidden";
          if (dockStatus) dockStatus.textContent = "Probing Agent...";
        }
      }

      const dockOfflineBanner = document.getElementById("agent-dock-offline-banner");
      if (dockOfflineBanner) {
        dockOfflineBanner.classList.toggle("hidden", newState !== "disconnected");
      }

      const dockLauncher = document.getElementById("agent-dock-launcher");
      if (dockLauncher) {
        dockLauncher.title = newState === "disconnected"
          ? "AI Assistant (Offline — click to open or restore bridge)"
          : "Open AI Assistant (Cmd+K or Ctrl+K)";
      }
    }

    for (const listener of this._listeners) {
      try { listener(newState, data); } catch (_) {}
    }
  },

  getAiConfig: function() {
    const defaults = { port: 3031, fallbackPort: 3032, model: "Gemini 3.8 Flash (Low)", persona: "analyst", purpose: null };
    if (typeof document === "undefined") return defaults;
    const readMeta = (name) => {
      const el = document.querySelector(`meta[name="${name}"]`);
      return el && el.getAttribute("content") ? el.getAttribute("content").trim() : null;
    };
    let manifestCfg = null;
    try {
      const mEl = document.getElementById("agent-manifest");
      if (mEl && mEl.textContent) {
        const parsed = JSON.parse(mEl.textContent);
        if (parsed && parsed.aiConfig) manifestCfg = parsed.aiConfig;
      }
    } catch (_) {}
    const portRaw = readMeta("html-report-ai-port") || (manifestCfg && manifestCfg.port);
    const port = Number.isFinite(Number(portRaw)) && Number(portRaw) > 0 ? Number(portRaw) : defaults.port;
    const model = readMeta("html-report-ai-model") || (manifestCfg && manifestCfg.model) || defaults.model;
    const persona = readMeta("html-report-ai-persona") || (manifestCfg && manifestCfg.persona) || defaults.persona;
    const purpose = readMeta("html-report-ai-purpose") || (manifestCfg && manifestCfg.purpose) || defaults.purpose;
    return { port, model, persona, purpose };
  },

  checkConnection: async function(btnEl) {
    if (btnEl) {
      btnEl.disabled = true;
      const originalText = btnEl.innerHTML;
      btnEl.innerHTML = `<span class="loading loading-spinner loading-xs mr-1"></span> Probing...`;
      setTimeout(() => {
        btnEl.disabled = false;
        btnEl.innerHTML = originalText;
      }, 1000);
    }

    // In standalone file:// mode, fetch scheme is unsupported by browsers; flag disconnected without probing
    if (typeof window !== "undefined" && window.location && window.location.protocol === "file:") {
      this._updateState("disconnected");
      return false;
    }

    try {
      const cfg = this.getAiConfig();
      const endpoints = (typeof window === "undefined" && typeof process !== "undefined")
        ? (process.env.REPORT_PORT
            ? [`http://127.0.0.1:${process.env.REPORT_PORT}/__agent_status__`]
            : Array.from(new Set([cfg.port || 3031, cfg.fallbackPort || 3032, 3000])).map((p) => `http://127.0.0.1:${p}/__agent_status__`))
        : ["/__agent_status__"];

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, { method: "GET" });
          if (res.ok) {
            const data = await res.json();
            if (data && data.ok) {
              this._updateState("connected", data);
              return true;
            }
          }
        } catch (_) {}
      }
    } catch (_) {}

    this._updateState("disconnected");
    return false;
  },

  isAvailable: async function() {
    return await this.checkConnection();
  },

  registerPersona: async function(persona) {
    if (!persona || !persona.id) return { ok: false, error: "Invalid persona object" };
    try {
      const res = await fetch("/api/agent/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(persona)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {}
    return { ok: true, registered: persona.id, localOnly: true, persona };
  },

  getPersonas: async function() {
    try {
      const cfg = this.getAiConfig();
      const endpoint = (typeof window === "undefined" && typeof process !== "undefined")
        ? `http://127.0.0.1:${process.env.REPORT_PORT || cfg.port || 3031}/api/agent/personas`
        : "/api/agent/personas";
      const res = await fetch(endpoint, { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.personas) && data.personas.length > 0) {
          return data.personas;
        }
      }
    } catch (_) {}
    return [
      { id: "analyst", name: "Telemetry Analyst", badgeColor: "badge-primary", icon: "trending-up" },
      { id: "debugger", name: "Systems Debugger", badgeColor: "badge-error", icon: "bug" },
      { id: "strategist", name: "Competitive Strategist", badgeColor: "badge-secondary", icon: "target" },
      { id: "executive", name: "Executive Advisor", badgeColor: "badge-neutral", icon: "briefcase" },
      { id: "sarcastic", name: "Sarcastic Critic", badgeColor: "badge-warning", icon: "flame" },
      { id: "oak", name: "Professor Oak", badgeColor: "badge-accent", icon: "book-open" },
      { id: "hype", name: "Esports Shoutcaster", badgeColor: "badge-info", icon: "zap" }
    ];
  },

  hydratePersonas: async function(options = {}) {
    if (typeof document === "undefined") return [];
    const personaSel = document.getElementById("agent-dock-persona");
    if (!personaSel) return [];
    if (this._hydratingPersonasPromise && !options.force) {
      return this._hydratingPersonasPromise;
    }

    this._hydratingPersonasPromise = (async () => {
      try {
        const cfg = this.getAiConfig();
        const endpoint = (typeof window === "undefined" && typeof process !== "undefined")
          ? `http://127.0.0.1:${process.env.REPORT_PORT || cfg.port || 3031}/api/agent/personas`
          : "/api/agent/personas";
        const res = await fetch(endpoint, { method: "GET" });
        if (!res.ok) return [];
        const data = await res.json();
        const personas = Array.isArray(data?.personas) ? data.personas : [];
        if (personas.length === 0) return [];

        const userChosen = personaSel.dataset.userSelected === "1" ? personaSel.value : null;
        const desiredPersona = userChosen || cfg.persona || personaSel.value || "analyst";

        personaSel.innerHTML = "";
        const seen = new Set();
        for (const p of personas) {
          if (!p || !p.id || seen.has(p.id)) continue;
          seen.add(p.id);
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = p.name || p.id;
          personaSel.appendChild(opt);
        }

        if (desiredPersona && !seen.has(desiredPersona)) {
          const fallbackOpt = document.createElement("option");
          fallbackOpt.value = desiredPersona;
          fallbackOpt.textContent = desiredPersona.charAt(0).toUpperCase() + desiredPersona.slice(1);
          personaSel.insertBefore(fallbackOpt, personaSel.firstChild);
        }

        if (desiredPersona) {
          personaSel.value = desiredPersona;
        }
        personaSel.dataset.personasHydrated = "1";
        return personas;
      } catch (_) {
        return [];
      } finally {
        this._hydratingPersonasPromise = null;
      }
    })();

    return this._hydratingPersonasPromise;
  },

  getReconnectPrompt: function(options = {}) {
    let filename = options.filename;
    if (!filename && typeof document !== "undefined") {
      const srcMeta = document.querySelector('meta[name="html-report-source"]');
      if (srcMeta && srcMeta.getAttribute("content")) filename = srcMeta.getAttribute("content").replace(/^\.\//, "");
    }
    if (!filename && typeof window !== "undefined") {
      filename = window.location.pathname.split("/").filter(Boolean).pop();
    }
    if (!filename || filename === "" || filename === "/") {
      filename = "report.html";
    }
    const cfg = this.getAiConfig();
    const port = options.port || cfg.port || 3031;
    const title = options.title || (typeof document !== "undefined" && document.title) || "Interactive HTML Report";

    return `I am viewing an interactive publication report: "${title}" (${filename}).
This report features an active Two-Way AI Agent Bridge and Datastar live hypermedia, but the local development server is currently offline or disconnected.

Please restore the two-way agent bridge by starting the report dev server in the background:
\`\`\`bash
node skills/html-report/scripts/serve-report.mjs ${filename} --port ${port} --no-open
\`\`\`

Prerequisites & Instructions:
- Requires Node.js (v18+) in your workspace to run the dev server (uses standard node libraries; zero npm dependencies or npm install required).
- If Node.js is not installed on this machine, please inform the user that this report is already 100% readable and interactive in static offline mode without Node.
- Once started, keep this process running in the background. The report in my browser will automatically detect the connection, update its live badges, and unlock interactive co-pilot queries.${options.extra ? "\n\nAfter the bridge is up, also apply this edit request:\n" + options.extra : ""}`;
  },

  copyReconnectPrompt: async function(btnEl, options = {}) {
    const promptText = this.getReconnectPrompt(options);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(promptText);
      }
      if (btnEl) {
        const originalHtml = btnEl.innerHTML;
        btnEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-success inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> <span class="text-success font-bold">Copied to Clipboard!</span>`;
        btnEl.classList.add("btn-success");
        setTimeout(() => {
          btnEl.innerHTML = originalHtml;
          btnEl.classList.remove("btn-success");
        }, 2200);
      }
      return true;
    } catch (err) {
      console.warn("Failed to copy reconnect prompt to clipboard:", err);
      return false;
    }
  },

  openReconnectModal: function(options = {}) {
    if (typeof document === "undefined") return;
    const modal = document.getElementById("agent-reconnect-modal");
    const preview = document.getElementById("agent-reconnect-prompt-preview");
    if (preview) {
      preview.textContent = this.getReconnectPrompt(options);
    }
    if (modal && typeof modal.showModal === "function") {
      modal.showModal();
    }
  },

  closeReconnectModal: function() {
    if (typeof document === "undefined") return;
    const modal = document.getElementById("agent-reconnect-modal");
    if (modal && typeof modal.close === "function") {
      modal.close();
    }
  },

  startHeartbeat: function(intervalMs = 4000) {
    if (typeof window === "undefined") return;
    if (window.location && window.location.protocol === "file:") return;
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);

    this._heartbeatTimer = setInterval(async () => {
      if (this._connectionState === "disconnected") {
        await this.checkConnection();
      }
    }, intervalMs);
  },

  stopHeartbeat: function() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  },

  init: function() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    if (!this._dockInitialized) {
      this._dockInitialized = true;
      document.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key && e.key.toLowerCase() === "k") {
          if (!this.isAiCapable()) return;
          e.preventDefault();
          this.toggleDock();
        }
      });

      document.addEventListener("click", (e) => {
        const trigger = e.target && e.target.closest && e.target.closest("[data-agent-prompt], [data-agent-inspect]");
        if (trigger) {
          e.preventDefault();
          const target = trigger.getAttribute("data-agent-target") || (trigger.closest && trigger.closest(".card, [data-agent-target]"));
          const prompt = trigger.getAttribute("data-agent-prompt");
          this.openDock({ target, prompt });
        }
      });
    }

    const hasAgentTriggers = this.isAiCapable();

    if (hasAgentTriggers) {
      const container = document.getElementById("agent-bridge-status-container");
      if (container) {
        container.classList.remove("hidden");
        container.classList.add("flex");
      }
      if (window.location && window.location.protocol === "file:") {
        this._updateState("disconnected");
      } else {
        this.checkConnection();
        this.startHeartbeat();
      }
    }

    this._updateDockVisibility();

    if (isPublishedDocument()) {
      document.querySelectorAll("*").forEach((el) => {
        if (
          typeof el.hasAttribute === "function" &&
          (el.hasAttribute("data-agent-prompt") ||
            el.hasAttribute("data-agent-inspect") ||
            el.hasAttribute(":data-agent-prompt") ||
            el.hasAttribute("x-bind:data-agent-prompt"))
        ) {
          el.classList.add("hidden", "print:hidden");
          el.setAttribute("aria-hidden", "true");
          el.setAttribute("data-agent-prompt-hidden", "true");
        }
      });
    }
  },

  _updateDockVisibility: function() {
    if (typeof document === "undefined") return;
    const dockContainer = document.getElementById("agent-dock-container");
    const capable = this.isAiCapable();
    const dockMeta = document.querySelector('meta[name="html-report-ai-dock"]')?.getAttribute("content");
    const showDock = capable && dockMeta !== "off";
    if (dockContainer) {
      dockContainer.classList.toggle("hidden", !showDock);
    }
    const cfg = this.getAiConfig();
    const personaSel = document.getElementById("agent-dock-persona");
    if (capable && personaSel && !personaSel.dataset.changeBound) {
      personaSel.dataset.changeBound = "1";
      personaSel.addEventListener("change", () => {
        personaSel.dataset.userSelected = "1";
      });
    }
    if (capable && personaSel && !personaSel.dataset.aiConfigInit) {
      personaSel.dataset.aiConfigInit = "1";
      const cfgPersona = cfg.persona;
      if (cfgPersona) {
        if (!Array.from(personaSel.options).some((o) => o.value === cfgPersona)) {
          const opt = document.createElement("option");
          opt.value = cfgPersona;
          opt.textContent = cfgPersona.charAt(0).toUpperCase() + cfgPersona.slice(1);
          personaSel.insertBefore(opt, personaSel.firstChild);
        }
        personaSel.value = cfgPersona;
      }
    }
    const welcomeCopy = document.getElementById("agent-dock-welcome-copy");
    if (welcomeCopy && !welcomeCopy.dataset.aiPurposeInit) {
      welcomeCopy.dataset.aiPurposeInit = "1";
      if (cfg.purpose) {
        welcomeCopy.innerHTML = `${typeof escapeHtml === "function" ? escapeHtml(cfg.purpose) : cfg.purpose} Press <kbd class="kbd kbd-xs font-mono">⌘K</kbd> to toggle.`;
      } else if (cfg.persona && cfg.persona.toLowerCase() === "support") {
        welcomeCopy.innerHTML = `Ask questions about the documentation, setup steps, or troubleshooting guidance on this page. Press <kbd class="kbd kbd-xs font-mono">⌘K</kbd> to toggle.`;
      }
    }
    if (!capable && this._isDockOpen) {
      this.closeDock();
    }
  },

  getSessionId: function() {
    if (!this._sessionId) {
      this._sessionId = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    }
    return this._sessionId;
  },

  serializeElementContext: function(target) {
    let el = null;
    if (typeof target === "string") {
      try { el = document.querySelector(target); } catch (_) {}
    } else if (target && (typeof target === "object" || (typeof Element !== "undefined" && target instanceof Element))) {
      el = target;
    }

    const activeTheme = (typeof document !== "undefined" && document.documentElement && document.documentElement.getAttribute("data-theme")) || "light";

    if (!el) {
      const base = {
        elementId: null,
        selector: null,
        domSnippet: null,
        datasetState: null,
        activeTheme
      };
      if (this._contextProviders && this._contextProviders.length > 0) {
        base.customContext = this.collectCustomContext(base);
      }
      return base;
    }

    const container = (typeof el.closest === "function" && el.closest(".card, [data-agent-target], section, article, table, canvas")) || el;
    const elementId = container.id || (container.getAttribute && container.getAttribute("data-agent-target")) || (container.tagName.toLowerCase() + (container.className ? "." + String(container.className).split(" ")[0] : ""));
    const selector = container.id ? `#${container.id}` : ((container.getAttribute && container.getAttribute("data-agent-target")) ? `[data-agent-target="${container.getAttribute("data-agent-target")}"]` : container.tagName.toLowerCase());

    let datasetState = null;
    const canvasEl = container.tagName.toLowerCase() === "canvas" ? container : (container.querySelector ? container.querySelector("canvas") : null);
    if (canvasEl && typeof Chart !== "undefined" && typeof Chart.getChart === "function") {
      try {
        const chartInstance = Chart.getChart(canvasEl);
        if (chartInstance) {
          datasetState = {
            type: chartInstance.config?.type || "chart",
            labels: chartInstance.data?.labels || [],
            datasets: (chartInstance.data?.datasets || []).map((ds) => ({
              label: ds.label,
              data: ds.data
            }))
          };
        }
      } catch (_) {}
    }

    if (!datasetState && container.querySelector) {
      const tableEl = container.tagName.toLowerCase() === "table" ? container : container.querySelector("table");
      if (tableEl) {
        try {
          const headers = Array.from(tableEl.querySelectorAll("th")).map((th) => th.textContent.trim());
          const rows = Array.from(tableEl.querySelectorAll("tbody tr")).slice(0, 5).map((tr) =>
            Array.from(tr.querySelectorAll("td")).map((td) => td.textContent.trim())
          );
          datasetState = {
            type: "table",
            headers,
            sampleRows: rows
          };
        } catch (_) {}
      }
    }

    if (container.dataset && Object.keys(container.dataset).length > 0) {
      datasetState = datasetState || {};
      datasetState.attributes = { ...container.dataset };
    }

    let domSnippet = (container.outerHTML || container.innerHTML || "").trim();
    if (domSnippet.length > 4000) {
      domSnippet = domSnippet.slice(0, 4000) + "... [truncated]";
    }

    const resultCtx = {
      elementId,
      selector,
      domSnippet,
      datasetState,
      activeTheme
    };
    if (this._contextProviders && this._contextProviders.length > 0) {
      resultCtx.customContext = this.collectCustomContext(resultCtx);
    }
    return resultCtx;
  },

  openDock: function(options = {}) {
    if (typeof document === "undefined") return;
    if (!this.isAiCapable()) return;
    this._isDockOpen = true;
    const panel = document.getElementById("agent-dock-panel");
    const launcher = document.getElementById("agent-dock-launcher");
    const input = document.getElementById("agent-dock-input");

    if (panel) {
      panel.classList.remove("hidden");
    }
    if (launcher) {
      launcher.classList.add("hidden");
    }

    if (options.target || options.element) {
      this.setTargetElement(options.target || options.element);
    }
    if (options.prompt && input) {
      input.value = options.prompt;
    }
    if (this._connectionState === "connected" && typeof this.hydratePersonas === "function") {
      const personaSel = document.getElementById("agent-dock-persona");
      if (personaSel && personaSel.dataset.personasHydrated !== "1") {
        this.hydratePersonas();
      }
    }

    if (input) {
      setTimeout(() => input.focus(), 50);
    }
  },

  closeDock: function() {
    if (typeof document === "undefined") return;
    this._isDockOpen = false;
    const panel = document.getElementById("agent-dock-panel");
    const launcher = document.getElementById("agent-dock-launcher");

    if (panel) {
      panel.classList.add("hidden");
    }
    if (launcher) {
      launcher.classList.remove("hidden");
    }
  },

  toggleDock: function() {
    if (this._isDockOpen) {
      this.closeDock();
    } else {
      this.openDock();
    }
  },

  setTargetElement: function(target) {
    if (typeof document === "undefined") return;
    let el = null;
    if (typeof target === "string") {
      try { el = document.querySelector(target); } catch (_) {}
    } else if (target && (typeof target === "object" || (typeof Element !== "undefined" && target instanceof Element))) {
      el = target;
    }

    this.clearTargetElement(false);

    if (el) {
      this._targetElement = el;
      if (el.classList) {
        el.classList.add("ring-2", "ring-primary", "ring-offset-2");
      }

      const label = document.getElementById("agent-dock-context-label");
      const clearBtn = document.getElementById("agent-dock-clear-context-btn");
      const ctx = this.serializeElementContext(el);

      if (label) {
        label.textContent = `Target: ${ctx.selector || ctx.elementId || "Element"}`;
        label.title = `Context: ${ctx.elementId} (${ctx.datasetState ? ctx.datasetState.type || "telemetry" : "DOM"})`;
      }
      if (clearBtn) {
        clearBtn.classList.remove("hidden");
      }
    }
  },

  clearTargetElement: function(resetUI = true) {
    if (this._targetElement && this._targetElement.classList) {
      this._targetElement.classList.remove("ring-2", "ring-primary", "ring-offset-2");
    }
    this._targetElement = null;

    if (resetUI && typeof document !== "undefined") {
      const label = document.getElementById("agent-dock-context-label");
      const clearBtn = document.getElementById("agent-dock-clear-context-btn");
      if (label) {
        label.textContent = "Context: Whole Document";
        label.removeAttribute("title");
      }
      if (clearBtn) {
        clearBtn.classList.add("hidden");
      }
    }
  },

  appendDockMessage: function(role, content, options = {}) {
    if (typeof document === "undefined") return null;
    const container = document.getElementById("agent-dock-messages");
    if (!container) return null;

    const msgEl = document.createElement("div");
    const msgId = options.id || `dock-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    msgEl.id = msgId;

    if (role === "user") {
      msgEl.className = "flex justify-end";
      msgEl.innerHTML = `
        <div class="max-w-[85%] p-2.5 rounded-2xl rounded-tr-none bg-primary text-primary-content shadow-sm text-xs break-words">
          ${typeof escapeHtml === "function" ? escapeHtml(content) : content}
        </div>
      `;
    } else {
      const persona = options.persona || "analyst";
      msgEl.className = "flex justify-start w-full";
      msgEl.innerHTML = `
        <div class="w-full max-w-[95%] p-3 rounded-2xl rounded-tl-none bg-base-200/90 border border-base-300 text-base-content shadow-sm space-y-2 text-xs">
          <div class="flex items-center justify-between text-[10px] text-base-content/60 pb-1 border-b border-base-300/50">
            <span class="font-mono font-semibold text-primary uppercase">${persona}</span>
            <span class="font-mono">${new Date().toLocaleTimeString()}</span>
          </div>
          <div class="prose prose-xs max-w-none text-base-content leading-relaxed message-content">
            ${content}
          </div>
          ${options.action ? this._renderActionCard(options.action) : ""}
        </div>
      `;
    }

    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
    return msgEl;
  },

  _formatMarkdown: function(text) {
    if (!text) return "";
    if (typeof window !== "undefined") {
      if (window.showdownConverter && typeof window.showdownConverter.makeHtml === "function") {
        return window.showdownConverter.makeHtml(text);
      }
      if (window.showdown && typeof window.showdown.Converter === "function") {
        const conv = new window.showdown.Converter({
          tables: true,
          tasklists: true,
          strikethrough: true,
          emoji: true,
          ghCodeBlocks: true
        });
        window.showdownConverter = conv;
        return conv.makeHtml(text);
      }
    }
    // Defensive built-in markdown formatter fallback
    let out = typeof escapeHtml === "function" ? escapeHtml(text) : text;
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*(.*?)\*/g, '<em>$1</em>');
    out = out.replace(/`([^`]+)`/g, '<code class="bg-base-300 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>');
    out = out.replace(/^### (.*$)/gim, '<h4 class="font-bold text-xs mt-2 mb-1 text-primary">$1</h4>');
    out = out.replace(/^## (.*$)/gim, '<h3 class="font-bold text-sm mt-2.5 mb-1 text-primary">$1</h3>');
    out = out.replace(/^# (.*$)/gim, '<h2 class="font-bold text-base mt-3 mb-1 text-primary">$1</h2>');
    out = out.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="ml-3 list-disc">$1</li>');
    out = out.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="ml-3 list-decimal">$1</li>');
    out = out.replace(/\n\n/g, '<div class="my-1.5"></div>').replace(/\n/g, '<br>');
    return out;
  },

  _renderActionCard: function(action) {
    if (!action || !action.id) return "";
    const escapedDesc = typeof escapeHtml === "function" ? escapeHtml(action.description || action.type) : (action.description || action.type);
    return `
      <div id="action-card-${action.id}" class="mt-2 p-2.5 rounded-xl bg-base-100 border border-warning/40 shadow-sm space-y-2">
        <div class="flex items-center gap-1.5 text-warning font-semibold text-[11px]">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>Action Proposed: ${escapedDesc}</span>
        </div>
        ${action.preview ? `<pre class="p-1.5 bg-neutral text-neutral-content rounded text-[10px] font-mono overflow-x-auto">${typeof escapeHtml === "function" ? escapeHtml(action.preview) : action.preview}</pre>` : ""}
        <div class="flex items-center gap-2 pt-1">
          <button
            type="button"
            onclick="if(window.HTMLReportAgent) window.HTMLReportAgent.confirmAction('${action.id}', true);"
            class="btn btn-xs btn-success gap-1 text-success-content"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            Approve
          </button>
          <button
            type="button"
            onclick="if(window.HTMLReportAgent) window.HTMLReportAgent.confirmAction('${action.id}', false);"
            class="btn btn-xs btn-ghost text-base-content/70"
          >
            Decline
          </button>
        </div>
      </div>
    `;
  },

  _renderOfflineTurnkeyHtml: function(messageText, promptText = "") {
    this._lastOfflinePrompt = promptText || "";
    const safeMsg = typeof escapeHtml === "function" ? escapeHtml(messageText) : String(messageText || "");
    return `
      <div class="space-y-2">
        <p class="text-warning font-semibold">${safeMsg}</p>
        <div class="flex flex-wrap items-center gap-1.5">
          <button type="button" onclick="if(window.HTMLReportAgent) window.HTMLReportAgent.openReconnectModal({ extra: window.HTMLReportAgent._lastOfflinePrompt || '' });" class="btn btn-warning btn-xs font-mono text-[10px] h-6 min-h-0">Restore Bridge</button>
          <button type="button" onclick="if(window.HTMLReportAgent) window.HTMLReportAgent.copyReconnectPrompt(this, { extra: window.HTMLReportAgent._lastOfflinePrompt || '' });" class="btn btn-outline btn-xs font-mono text-[10px] h-6 min-h-0">Copy Turnkey Prompt</button>
        </div>
      </div>
    `;
  },

  submitDockPrompt: function() {
    if (typeof document === "undefined") return;
    const input = document.getElementById("agent-dock-input");
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    this.sendPrompt(text);
  },

  sendPrompt: async function(promptText, options = {}) {
    if (!promptText || !promptText.trim()) return null;
    const prompt = promptText.trim();
    this.appendDockMessage("user", prompt);

    const cfg = this.getAiConfig();
    const persona = options.persona || ((typeof document !== "undefined" && document.getElementById("agent-dock-persona")) ? document.getElementById("agent-dock-persona").value : cfg.persona);
    const loadingEl = this.appendDockMessage("assistant", `<span class="loading loading-dots loading-xs"></span> Reasoning...`, {
      persona
    });

    const baseContext = options.context || this.serializeElementContext(this._targetElement);
    const customContext = this.collectCustomContext(baseContext);
    const context = Object.keys(customContext).length > 0
      ? { ...baseContext, customContext: { ...(baseContext.customContext || {}), ...customContext } }
      : baseContext;
    const targetSelector = options.targetSelector || (this._targetElement ? this.serializeElementContext(this._targetElement).selector : undefined);
    const sessionId = options.sessionId || this.getSessionId();

    const payload = {
      sessionId,
      prompt,
      targetSelector,
      context,
      history: this._history.slice(-10),
      persona,
      model: options.model || cfg.model,
      ...(options.heuristic ? { heuristic: true } : {})
    };

    this._history.push({ role: "user", content: prompt, timestamp: new Date().toISOString() });

    if (typeof this._transportAdapter === "function") {
      try {
        const customRes = await this._transportAdapter(payload, options);
        const textOut = (customRes && (customRes.result || customRes.text)) || "Assessment complete.";
        if (loadingEl) {
          const contentEl = loadingEl.querySelector(".message-content");
          if (contentEl) contentEl.innerHTML = this._formatMarkdown(textOut);
        }
        this._history.push({ role: "assistant", content: textOut, timestamp: new Date().toISOString() });
        return customRes || { ok: true, result: textOut };
      } catch (adapterErr) {
        if (loadingEl) {
          const contentEl = loadingEl.querySelector(".message-content");
          if (contentEl) contentEl.innerHTML = `<span class="text-error font-semibold">Error: ${adapterErr.message}</span>`;
        }
        return { ok: false, error: adapterErr.message };
      }
    }

    if (typeof window !== "undefined" && window.location && window.location.protocol === "file:") {
      this._updateState("disconnected");
      const fallbackText = `Agent bridge offline (standalone file:// mode). Start dev server on localhost:${cfg.port || 3031} to enable real-time co-pilot.`;
      if (loadingEl) {
        const contentEl = loadingEl.querySelector(".message-content");
        if (contentEl) contentEl.innerHTML = this._renderOfflineTurnkeyHtml(fallbackText, prompt);
      }
      return { ok: false, fallback: true, result: fallbackText };
    }

    try {
      const endpoint = (typeof window === "undefined" && typeof process !== "undefined")
        ? `http://127.0.0.1:${process.env.REPORT_PORT || cfg.port || 3031}/api/agent/prompt`
        : "/api/agent/prompt";
      const csrfToken = await this._getCsrfToken();
      const headers = {
        "Content-Type": "application/json",
        "Accept": "text/event-stream, application/json"
      };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errBody = null;
        try { errBody = await res.json(); } catch (_) {}
        if (res.status === 503 || (errBody && errBody.code === "inference_unavailable")) {
          this._updateState("connected");
          if (typeof document !== "undefined") {
            const dockStatus = document.getElementById("agent-dock-status");
            if (dockStatus) dockStatus.textContent = "Bridge: Online • AI Provider: Unavailable";
          }
          const msg = (errBody && (errBody.error || errBody.reason)) || "AI inference provider is unavailable on this machine.";
          if (loadingEl) {
            const contentEl = loadingEl.querySelector(".message-content");
            if (contentEl) contentEl.innerHTML = `<span class="text-warning font-semibold">${typeof escapeHtml === "function" ? escapeHtml(msg) : msg}</span>`;
          }
          return errBody || { ok: false, status: "error", code: "inference_unavailable", error: msg };
        }
        throw new Error((errBody && errBody.error) || `HTTP ${res.status}`);
      }

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop();

          for (const block of lines) {
            if (!block.trim()) continue;

            let eventType = "message";
            const dataLines = [];
            for (const line of block.split("\n")) {
              const trimmed = line.trim();
              if (trimmed.startsWith("event:")) {
                eventType = trimmed.replace(/^event:\s*/, "");
              } else if (trimmed.startsWith("data:")) {
                dataLines.push(trimmed.replace(/^data:\s*/, ""));
              }
            }

            const rawData = (dataLines.length > 0 ? dataLines.join("\n") : block.replace(/^data:\s*/m, "")).trim();
            const isDatastar =
              eventType === "datastar-merge-fragments" ||
              eventType === "datastar-fragment" ||
              block.includes("event: datastar-merge-fragments") ||
              block.includes("event: datastar-fragment") ||
              rawData.startsWith("fragments ") ||
              rawData.startsWith("fragment ");

            if (isDatastar) {
              const fragmentHtml = rawData.replace(/^fragments?\s+/, "");
              if (targetSelector && typeof document !== "undefined") {
                const targetEl = document.querySelector(targetSelector);
                if (targetEl && fragmentHtml.includes(`id="${targetEl.id}"`)) {
                  const temp = document.createElement("div");
                  temp.innerHTML = fragmentHtml;
                  const newEl = temp.firstElementChild;
                  if (newEl) {
                    targetEl.replaceWith(newEl);
                    newEl.classList.add("animate-pulse");
                    setTimeout(() => newEl.classList.remove("animate-pulse"), 1000);
                  }
                }
              }
            }

            try {
              const json = JSON.parse(rawData);
              if (json.text) fullText = json.text;
              if (loadingEl) {
                const contentEl = loadingEl.querySelector(".message-content");
                if (contentEl) contentEl.innerHTML = this._formatMarkdown(fullText || json.text || "Analysis complete.");
                if (json.action) {
                  loadingEl.insertAdjacentHTML("beforeend", this._renderActionCard(json.action));
                }
              }
            } catch (_) {
              if (rawData && !isDatastar && !rawData.startsWith("fragments ") && !rawData.startsWith("fragment ") && !rawData.startsWith("{")) {
                fullText = rawData;
              }
            }
          }
        }

        if (loadingEl && fullText) {
          const contentEl = loadingEl.querySelector(".message-content");
          if (contentEl) contentEl.innerHTML = this._formatMarkdown(fullText);
        }
        this._updateState("connected");
        this._history.push({ role: "assistant", content: fullText, timestamp: new Date().toISOString() });
        return { ok: true, result: fullText };
      } else {
        const data = await res.json();
        this._updateState("connected");
        const resText = data.result || data.text || "Assessment complete.";
        if (loadingEl) {
          const contentEl = loadingEl.querySelector(".message-content");
          if (contentEl) contentEl.innerHTML = this._formatMarkdown(resText);
          if (data.action) {
            loadingEl.insertAdjacentHTML("beforeend", this._renderActionCard(data.action));
          }
        }
        this._history.push({ role: "assistant", content: resText, timestamp: new Date().toISOString() });
        return data;
      }
    } catch (err) {
      this._updateState("disconnected");
      if (loadingEl) {
        const contentEl = loadingEl.querySelector(".message-content");
        if (contentEl) contentEl.innerHTML = this._renderOfflineTurnkeyHtml(`AI bridge offline (${err.message}). Use the turnkey prompt to reconnect.`, prompt);
      }
      return { ok: false, error: err.message };
    }
  },

  confirmAction: async function(actionId, approved, options = {}) {
    if (typeof document === "undefined") return { ok: false };
    const card = document.getElementById(`action-card-${actionId}`);
    if (card) {
      card.innerHTML = approved
        ? `<div class="badge badge-success badge-sm gap-1 text-success-content font-semibold">✓ Action Approved &amp; Executing...</div>`
        : `<div class="badge badge-ghost badge-sm gap-1 text-base-content/60">✕ Action Declined</div>`;
    }

    try {
      const cfg = this.getAiConfig();
      const endpoint = (typeof window === "undefined" && typeof process !== "undefined")
        ? `http://127.0.0.1:${process.env.REPORT_PORT || cfg.port || 3031}/api/agent/confirm-action`
        : "/api/agent/confirm-action";
      const csrfToken = await this._getCsrfToken();
      const headers = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sessionId: this.getSessionId(),
          actionId,
          approved,
          ...options
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (card && approved) {
          card.innerHTML = `<div class="badge badge-success badge-sm gap-1 text-success-content font-semibold">✓ Action Executed Successfully</div>`;
        }
        return data;
      }
    } catch (err) {
      if (card && approved) {
        card.innerHTML = `<div class="badge badge-warning badge-sm gap-1 text-warning-content font-semibold">⚠ Executed locally (offline bridge)</div>`;
      }
    }
    return { ok: true, actionId, approved };
  },

  ask: async function(options) {
    const cfg = this.getAiConfig();
    const rawPayload = typeof options === "string" ? { prompt: options } : (options || {});
    const payload = {
      ...rawPayload,
      model: rawPayload.model || cfg.model,
      persona: rawPayload.persona || cfg.persona
    };
    const endpoint = payload.endpoint || "/__agent_action__";

    // In standalone file:// mode, immediately invoke local fallback without throwing fetch error
    if (typeof window !== "undefined" && window.location && window.location.protocol === "file:") {
      this._updateState("disconnected");
      if (payload.autoOpenModal !== false) {
        try { this.openReconnectModal(); } catch (_) {}
      }
      return {
        ok: false,
        fallback: true,
        error: "Standalone file:// mode - dev server offline",
        result: payload.fallbackText || "Agent bridge offline. Using local deterministic fallback.",
        agent: "Local Autonomous Fallback",
        timestamp: new Date().toISOString()
      };
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this._updateState("connected");
      return data;
    } catch (err) {
      this._updateState("disconnected");
      if (payload.autoOpenModal !== false) {
        try { this.openReconnectModal(); } catch (_) {}
      }
      return {
        ok: false,
        fallback: true,
        error: err.message,
        result: payload.fallbackText || "Agent bridge offline. Using local deterministic fallback.",
        agent: "Local Autonomous Fallback",
        timestamp: new Date().toISOString()
      };
    }
  }
};

// Extend HTMLReportSettings with All Settings Modal controls
if (HTMLReportSettings) {
  Object.assign(HTMLReportSettings, {
  initAllSettingsModal() {
    if (typeof document === "undefined") return;
    const modal = document.getElementById("all-settings-modal");
    const openBtn = document.getElementById("open-all-settings-btn");
    if (!modal) return;

    if (openBtn && !openBtn.__wired) {
      openBtn.__wired = true;
      openBtn.addEventListener("click", () => {
        if (HTMLReportSettings.close) HTMLReportSettings.close();
        if (typeof modal.showModal === "function") {
          modal.showModal();
        } else {
          modal.setAttribute("open", "true");
        }
        this.refreshModalState();
      });
    }

    // Tab switching inside modal
    const tabBtns = modal.querySelectorAll('.tabs [role="tab"]');
    tabBtns.forEach((tab) => {
      if (tab.__wired) return;
      tab.__wired = true;
      tab.addEventListener("click", () => {
        const targetId = tab.getAttribute("data-tab-target");
        tabBtns.forEach((t) => t.classList.remove("tab-active"));
        tab.classList.add("tab-active");
        modal.querySelectorAll(".settings-tab-panel").forEach((p) => {
          p.classList.toggle("hidden", p.id !== targetId);
        });
      });
    });

    // Populate 32-theme selector grid
    const themeGrid = document.getElementById("modal-theme-grid");
    if (themeGrid && !themeGrid.__populated && typeof DAISYUI_THEMES !== "undefined") {
      themeGrid.__populated = true;
      themeGrid.innerHTML = "";
      const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
      DAISYUI_THEMES.forEach((theme) => {
        const item = document.createElement("button");
        item.type = "button";
        item.setAttribute("data-theme", theme);
        item.setAttribute("data-modal-set-theme", theme);
        item.className = "outline-base-content text-start rounded-btn cursor-pointer font-sans w-full transition";
        item.innerHTML = `
          <div class="bg-base-100 rounded-btn text-base-content block w-full p-2.5 border ${theme === currentTheme ? "border-primary ring-2 ring-primary/30" : "border-base-300"} hover:border-primary transition">
            <div class="flex items-center justify-between gap-1.5">
              <div class="flex items-center gap-1.5 min-w-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="modal-theme-check h-3 w-3 shrink-0 ${theme === currentTheme ? "opacity-100 text-primary" : "opacity-0"}">
                  <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"></path>
                </svg>
                <span class="text-xs font-semibold capitalize truncate">${theme}</span>
              </div>
              <div class="flex shrink-0 gap-0.5">
                <span class="bg-primary rounded-badge w-1.5 h-3"></span>
                <span class="bg-secondary rounded-badge w-1.5 h-3"></span>
                <span class="bg-accent rounded-badge w-1.5 h-3"></span>
                <span class="bg-neutral rounded-badge w-1.5 h-3"></span>
              </div>
            </div>
          </div>
        `;
        item.addEventListener("click", () => {
          if (typeof setReportTheme === "function") setReportTheme(theme);
          this.refreshModalState();
        });
        themeGrid.appendChild(item);
      });
    }

    // Modal publish toggle
    const pubToggle = document.getElementById("modal-publish-toggle");
    if (pubToggle && !pubToggle.__wired) {
      pubToggle.__wired = true;
      pubToggle.addEventListener("change", () => {
        if (typeof HTMLReportPublisher !== "undefined") {
          HTMLReportPublisher.setPublishedFlag(pubToggle.checked);
        }
      });
    }

    // Modal download actions forwarding
    const modalDownHtml = document.getElementById("modal-download-html-btn");
    const htmlBtn = document.getElementById("download-html-btn");
    if (modalDownHtml && htmlBtn && !modalDownHtml.__wired) {
      modalDownHtml.__wired = true;
      modalDownHtml.addEventListener("click", () => htmlBtn.click());
    }

    const modalDownPdf = document.getElementById("modal-download-pdf-btn");
    const pdfBtn = document.getElementById("download-pdf-btn");
    if (modalDownPdf && pdfBtn && !modalDownPdf.__wired) {
      modalDownPdf.__wired = true;
      modalDownPdf.addEventListener("click", () => pdfBtn.click());
    }

    // Modal AI toggle
    const modalAiToggle = document.getElementById("modal-ai-toggle");
    if (modalAiToggle && !modalAiToggle.__wired) {
      modalAiToggle.__wired = true;
      modalAiToggle.addEventListener("change", () => {
        if (typeof HTMLReportAgent !== "undefined") {
          HTMLReportAgent.setAiActive(modalAiToggle.checked);
          this.refreshModalState();
        }
      });
    }

    // Modal Reconnect prompt copy
    const copyBtn = document.getElementById("modal-copy-reconnect-btn");
    if (copyBtn && !copyBtn.__wired) {
      copyBtn.__wired = true;
      copyBtn.addEventListener("click", (e) => {
        if (typeof HTMLReportAgent !== "undefined") {
          HTMLReportAgent.copyReconnectPrompt(e.currentTarget);
        }
      });
    }

    // Modal Page Editor launcher
    const openEditorBtn = document.getElementById("modal-open-editor-btn");
    if (openEditorBtn && !openEditorBtn.__wired) {
      openEditorBtn.__wired = true;
      openEditorBtn.addEventListener("click", () => {
        if (typeof modal.close === "function") modal.close();
        if (typeof HTMLReportEdit !== "undefined") HTMLReportEdit.openDock();
      });
    }

    this.refreshModalState();
  },

  refreshModalState() {
    if (typeof document === "undefined") return;
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const label = document.getElementById("modal-active-theme-label");
    if (label) label.textContent = currentTheme;

    const themeGrid = document.getElementById("modal-theme-grid");
    if (themeGrid) {
      themeGrid.querySelectorAll("[data-modal-set-theme]").forEach((btn) => {
        const isCurrent = btn.getAttribute("data-modal-set-theme") === currentTheme;
        const card = btn.firstElementChild;
        if (card) {
          card.classList.toggle("border-primary", isCurrent);
          card.classList.toggle("ring-2", isCurrent);
          card.classList.toggle("ring-primary/30", isCurrent);
          card.classList.toggle("border-base-300", !isCurrent);
        }
        const check = btn.querySelector(".modal-theme-check");
        if (check) {
          check.classList.toggle("opacity-100", isCurrent);
          check.classList.toggle("text-primary", isCurrent);
          check.classList.toggle("opacity-0", !isCurrent);
        }
      });
    }

    if (typeof HTMLReportPublisher !== "undefined") {
      const isPub = HTMLReportPublisher.isPublishedFlagOn();
      const pt = document.getElementById("modal-publish-toggle");
      if (pt && pt.checked !== isPub) pt.checked = isPub;
      const pb = document.getElementById("modal-publish-badge");
      if (pb) pb.classList.toggle("hidden", !isPub);
    }

    if (typeof HTMLReportAgent !== "undefined") {
      const isAi = HTMLReportAgent.isAiCapable();
      const at = document.getElementById("modal-ai-toggle");
      if (at && at.checked !== isAi) at.checked = isAi;
      const pre = document.getElementById("modal-reconnect-prompt");
      if (pre) pre.textContent = HTMLReportAgent.getReconnectPrompt();
    }
  },
  });
}

/* ----------------------------- Edit queue ----------------------------- */

const EDIT_QUEUE_PREFIX = "html_report_edit_queue:";

function _sortTasks(tasks) {
  return tasks.slice().sort((a, b) =>
    (a.priority - b.priority) || (a.order - b.order) || String(a.id).localeCompare(String(b.id)));
}

const HTMLReportEdit = {
  _key: (pageKey) => EDIT_QUEUE_PREFIX + (pageKey || getPageKey()),
  _selectedTarget: null,
  _selectMode: false,
  _hoveredEl: null,
  _selectListenersAttached: false,
  _editingTaskId: null,
  _setDockTab: null,
  _setDockExpanded: null,

  getSelectedTarget() {
    return this._selectedTarget;
  },

  setSelectedTarget(target) {
    this._selectedTarget = target && target.id ? { id: String(target.id), tag: String(target.tag || "").toLowerCase() } : null;
    if (typeof document === "undefined" || !document || typeof document.getElementById !== "function") return;
    const box = document.getElementById("edit-selected-target");
    const idEl = document.getElementById("edit-target-id");
    const tagEl = document.getElementById("edit-target-tag");
    if (!box) return;
    if (this._selectedTarget) {
      box.classList.remove("hidden");
      if (idEl) idEl.textContent = `#${this._selectedTarget.id}`;
      if (tagEl) tagEl.textContent = `<${this._selectedTarget.tag || "element"}>`;
    } else {
      box.classList.add("hidden");
      if (idEl) idEl.textContent = "";
      if (tagEl) tagEl.textContent = "";
    }
  },

  getOrAssignId(el) {
    if (!el) return null;
    if (el.id && String(el.id).trim()) return String(el.id).trim();
    const tag = (el.tagName || "el").toLowerCase();
    const raw = (el.textContent || "")
      .trim()
      .slice(0, 32)
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    const base = raw ? `${tag}-${raw}` : `${tag}-${Math.random().toString(36).slice(2, 7)}`;
    let candidate = base;
    let counter = 1;
    if (typeof document !== "undefined" && document && typeof document.getElementById === "function") {
      while (document.getElementById(candidate)) {
        candidate = `${base}-${counter++}`;
      }
    }
    try { el.id = candidate; } catch (_) {}
    return candidate;
  },

  toggleSelectMode(enable) {
    if (typeof document === "undefined" || !document || !document.body) return;
    const next = enable !== undefined ? Boolean(enable) : !this._selectMode;
    this._selectMode = next;
    const btn = document.getElementById("edit-dock-select");
    if (btn) {
      btn.classList.toggle("btn-accent", next);
      btn.classList.toggle("btn-ghost", !next);
      btn.setAttribute("aria-pressed", next ? "true" : "false");
    }
    if (document.body.classList) {
      document.body.classList.toggle("report-select-mode-active", next);
    }

    if (next) {
      this._ensureSelectStyles();
      this._attachSelectListeners();
    } else {
      this._detachSelectListeners();
      this._clearHover();
    }
  },

  _ensureSelectStyles() {
    if (typeof document === "undefined" || !document || typeof document.getElementById !== "function") return;
    if (document.getElementById("report-select-styles")) return;
    const s = document.createElement("style");
    s.id = "report-select-styles";
    s.textContent = `
      .report-select-mode-active * { cursor: crosshair !important; }
      #edit-dock, #edit-dock *, #all-settings-modal, #all-settings-modal *, #settings-dropdown, #settings-dropdown *, nav.navbar, nav.navbar * { cursor: default !important; }
      .report-select-hover { filter: invert(1) hue-rotate(180deg) !important; transition: filter 0.08s ease !important; }
    `;
    if (document.head && typeof document.head.appendChild === "function") {
      document.head.appendChild(s);
    }
  },

  _attachSelectListeners() {
    if (this._selectListenersAttached || typeof document === "undefined" || !document) return;
    this._selectListenersAttached = true;
    const self = this;

    this._onPointerOver = (e) => {
      if (!self._selectMode) return;
      const target = e.target;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest("#edit-dock, #all-settings-modal, #settings-dropdown, [role='dialog'], nav.navbar")) {
        self._clearHover();
        return;
      }
      if (self._hoveredEl === target) return;
      self._clearHover();
      self._hoveredEl = target;
      if (target.classList) target.classList.add("report-select-hover");
    };

    this._onPointerOut = (e) => {
      if (!self._selectMode) return;
      if (self._hoveredEl && (e.target === self._hoveredEl || (typeof self._hoveredEl.contains === "function" && !self._hoveredEl.contains(e.relatedTarget)))) {
        self._clearHover();
      }
    };

    this._onSelectClick = (e) => {
      if (!self._selectMode) return;
      const target = e.target;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest("#edit-dock, #all-settings-modal, #settings-dropdown, [role='dialog'], nav.navbar")) return;

      if (typeof e.preventDefault === "function") e.preventDefault();
      if (typeof e.stopPropagation === "function") e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

      const elId = self.getOrAssignId(target);
      const tag = target.tagName ? target.tagName.toLowerCase() : "element";
      self.setSelectedTarget({ id: elId, tag });
      self.toggleSelectMode(false);
      if (typeof self.openDock === "function") self.openDock({ expand: true, tab: "compose", focus: true });
    };

    if (typeof document.addEventListener === "function") {
      document.addEventListener("pointerover", this._onPointerOver, true);
      document.addEventListener("pointerout", this._onPointerOut, true);
      document.addEventListener("click", this._onSelectClick, true);
    }
  },

  _detachSelectListeners() {
    if (!this._selectListenersAttached || typeof document === "undefined" || !document) return;
    this._selectListenersAttached = false;
    if (typeof document.removeEventListener === "function") {
      if (this._onPointerOver) document.removeEventListener("pointerover", this._onPointerOver, true);
      if (this._onPointerOut) document.removeEventListener("pointerout", this._onPointerOut, true);
      if (this._onSelectClick) document.removeEventListener("click", this._onSelectClick, true);
    }
  },

  _clearHover() {
    if (this._hoveredEl) {
      if (this._hoveredEl.classList) this._hoveredEl.classList.remove("report-select-hover");
      this._hoveredEl = null;
    }
  },

  getTasks(pageKey) {
    try {
      const raw = _authoringStorage().getItem(this._key(pageKey));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  },

  _generatedPrompt: null,

  saveTasks(tasks, pageKey) {
    try { _authoringStorage().setItem(this._key(pageKey), JSON.stringify(tasks)); } catch (_) {}
    this.resetGeneratedPrompt();
    return tasks;
  },

  isAutoPriority(key) {
    const pk = key || (typeof this.getPageKey === "function" ? this.getPageKey() : (typeof getPageKey === "function" ? getPageKey() : "default"));
    const store = _authoringStorage();
    return store.getItem(`html_report_auto_priority:${pk}`) === "true";
  },

  setAutoPriority(enabled, key) {
    const pk = key || (typeof this.getPageKey === "function" ? this.getPageKey() : (typeof getPageKey === "function" ? getPageKey() : "default"));
    const store = _authoringStorage();
    if (enabled) {
      store.setItem(`html_report_auto_priority:${pk}`, "true");
    } else {
      store.removeItem(`html_report_auto_priority:${pk}`);
    }
    this.resetGeneratedPrompt();
  },

  resetGeneratedPrompt() {
    this._generatedPrompt = null;
    if (typeof document !== "undefined") {
      const pre = document.getElementById("edit-prompt-preview");
      if (pre) {
        pre.textContent = "";
        pre.classList.add("hidden");
      }
      const status = document.getElementById("edit-send-status");
      if (status) status.textContent = "";
      this.refreshSendState();
    }
  },

  addTask(input, pageKey) {
    const tasks = this.getTasks(pageKey);
    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.order || 0), 0);
    const maxId = tasks.reduce((m, t) => Math.max(m, Number(String(t.id).replace(/\D/g, "")) || 0), 0);
    const pr = Number(input.priority);
    const task = {
      id: `t${maxId + 1}`,
      title: String(input.title || "").trim(),
      content: String(input.content || "").trim(),
      priority: pr === 1 || pr === 3 ? pr : 2,
      order: maxOrder + 1,
      done: false,
      target: input.target && input.target.id ? { id: String(input.target.id), tag: String(input.target.tag || "").toLowerCase() } : null,
      anchor: input.anchor && input.anchor.id ? { id: String(input.anchor.id), label: String(input.anchor.label || input.anchor.id) } : null
    };
    if (!task.title && !task.content) return null;
    tasks.push(task);
    this.saveTasks(tasks, pageKey);
    return task;
  },

  updateTask(id, patch, pageKey) {
    const tasks = this.getTasks(pageKey);
    const t = tasks.find((x) => x.id === id);
    if (!t) return null;
    if (patch.priority !== undefined) {
      const p = Number(patch.priority);
      t.priority = p === 1 || p === 3 ? p : 2;
    }
    if (patch.title !== undefined) t.title = String(patch.title);
    if (patch.content !== undefined) t.content = String(patch.content);
    if (patch.done !== undefined) t.done = Boolean(patch.done);
    if (patch.target !== undefined) {
      t.target = patch.target && patch.target.id ? { id: String(patch.target.id), tag: String(patch.target.tag || "").toLowerCase() } : null;
    }
    this.saveTasks(tasks, pageKey);
    return t;
  },

  removeTask(id, pageKey) {
    const tasks = this.getTasks(pageKey).filter((t) => t.id !== id);
    this.saveTasks(tasks, pageKey);
    if (this._editingTaskId === id && typeof this.cancelEdit === "function") {
      this.cancelEdit();
    }
    return tasks;
  },

  editTaskInCompose(id, pageKey) {
    const t = this.getTasks(pageKey).find((x) => x.id === id);
    if (!t) return null;
    this._editingTaskId = t.id;
    if (typeof document !== "undefined") {
      const dock = document.getElementById("edit-dock");
      if (dock && dock.classList) dock.classList.remove("hidden");
      if (typeof this._setDockExpanded === "function") this._setDockExpanded(true);
      if (typeof this._setDockTab === "function") this._setDockTab("compose");
      else if (typeof this.openDock === "function") this.openDock({ expand: true, tab: "compose", focus: false });

      const titleEl = document.getElementById("edit-task-title");
      const contentEl = document.getElementById("edit-task-content");
      const priorityEl = document.getElementById("edit-task-priority");
      const anchorEl = document.getElementById("edit-task-anchor");
      const addBtn = document.getElementById("edit-add-btn");
      const cancelBtn = document.getElementById("edit-cancel-edit-btn");

      if (titleEl) titleEl.value = t.title || "";
      if (contentEl) {
        contentEl.value = t.content || "";
        if (contentEl.style) {
          contentEl.style.height = "auto";
          if (contentEl.scrollHeight) {
            contentEl.style.height = `${Math.min(contentEl.scrollHeight, 96)}px`;
          }
        }
      }
      if (priorityEl) {
        const pr = Number(t.priority);
        priorityEl.value = String(pr === 1 || pr === 3 ? pr : 2);
      }
      this.setSelectedTarget(t.target || null);
      if (anchorEl) {
        const label = t.anchor ? (t.anchor.label || t.anchor.id) : (this._currentSection ? this._currentSection.label : "none");
        anchorEl.textContent = `Anchor: ${label}`;
      }
      if (addBtn) addBtn.textContent = "Save";
      if (cancelBtn && cancelBtn.classList) cancelBtn.classList.remove("hidden");
      if (titleEl && typeof titleEl.focus === "function") titleEl.focus();
    }
    return t;
  },

  cancelEdit() {
    this._editingTaskId = null;
    if (typeof document !== "undefined") {
      const titleEl = document.getElementById("edit-task-title");
      const contentEl = document.getElementById("edit-task-content");
      const priorityEl = document.getElementById("edit-task-priority");
      const anchorEl = document.getElementById("edit-task-anchor");
      const addBtn = document.getElementById("edit-add-btn");
      const cancelBtn = document.getElementById("edit-cancel-edit-btn");

      if (titleEl) titleEl.value = "";
      if (contentEl) {
        contentEl.value = "";
        if (contentEl.style) contentEl.style.height = "";
      }
      if (priorityEl) priorityEl.value = "2";
      this.setSelectedTarget(null);
      if (anchorEl) {
        anchorEl.textContent = this._currentSection ? `Anchor: ${this._currentSection.label}` : "Anchor: none";
      }
      if (addBtn) addBtn.textContent = "Add";
      if (cancelBtn && cancelBtn.classList) cancelBtn.classList.add("hidden");
    }
  },

  /** Moves a task up (-1) or down (+1) among tasks of the same priority. */
  moveTask(id, delta, pageKey) {
    const tasks = this.getTasks(pageKey);
    const t = tasks.find((x) => x.id === id);
    if (!t) return tasks;
    const peers = _sortTasks(tasks.filter((x) => x.priority === t.priority));
    const i = peers.findIndex((x) => x.id === id);
    const j = i + (delta < 0 ? -1 : 1);
    if (j < 0 || j >= peers.length) return tasks;
    const tmp = peers[i].order;
    peers[i].order = peers[j].order;
    peers[j].order = tmp;
    this.saveTasks(tasks, pageKey);
    return tasks;
  },

  sortTasks: _sortTasks,

  /**
   * Pure, deterministic prompt builder. Order: priority asc, then manual order;
   * done tasks excluded. Identical input yields byte-identical output.
   */
  buildEditPrompt(tasks, page = {}, options = {}) {
    const autoPriority = Boolean(options.autoPriority ?? page.autoPriority);
    const open = _sortTasks((tasks || []).filter((t) => !t.done));
    const fragmentPath = page.fragment ? String(page.fragment).trim() : "";
    const hasFragment = Boolean(fragmentPath);
    const lines = [];
    lines.push(`Edit request for html-report page: "${page.title || "Untitled report"}"`);
    lines.push("Generated by: /html-report skill (https://github.com/DriesVerb/html-report)");
    if (hasFragment) {
      lines.push(`Semantic Fragment: ${fragmentPath}`);
      if (page.source) lines.push(`Output Deliverable: ${page.source}`);
      if (page.manifestPath) lines.push(`Manifest: ${page.manifestPath}`);
      lines.push(`Report mode: ${page.mode || "report"}${page.theme ? ` | Theme: ${page.theme}` : ""}`);
      if (Array.isArray(page.activeAddons) && page.activeAddons.length > 0) {
        lines.push(`Active addons: ${page.activeAddons.join(", ")}`);
      }
      lines.push(`Agent instructions: Edit only ${fragmentPath} in the workspace; the local dev server auto-rebuilds ${page.source || "the Output Deliverable"} on save.`);
    } else {
      lines.push("Agent instructions: Use available workspace tools (file editing, terminal commands) and refer to skills/html-report/references/agent-authoring-guide.md if needed.");
      lines.push(`Source: ${page.source || "(unknown source; edit the file served at this page)"}`);
      lines.push(`Report mode: ${page.mode || "report"}`);
    }
    lines.push("");
    if (open.length === 0) {
      lines.push("No open tasks.");
    } else {
      lines.push(`Tasks (${open.length}, highest priority first):`);
      open.forEach((t, i) => {
        lines.push("");
        lines.push(`${i + 1}. [P${t.priority}] ${t.title || "(untitled)"}`);
        if (t.target && t.target.id) {
          lines.push(`   Target Element: #${t.target.id}${t.target.tag ? ` (<${t.target.tag}>)` : ""}`);
        }
        if (t.anchor) lines.push(`   Section: ${t.anchor.label} (#${t.anchor.id})`);
        if (t.content) t.content.split(/\r?\n/).forEach((l) => lines.push(`   ${l}`));
      });
    }
    lines.push("");
    lines.push("Constraints:");
    if (autoPriority) {
      lines.push("- Auto-priority: The AI agent must assess all tasks, identify dependencies, and create/determine its own optimal execution priority order.");
    }
    lines.push("- Follow the principles and conventions of this project (DaisyUI themes, Tailwind, light default theme).");
    const cfgPort = (typeof HTMLReportAgent !== "undefined" && HTMLReportAgent.getConfig) ? (HTMLReportAgent.getConfig().port || 3031) : 3031;
    if (hasFragment) {
      lines.push(`- Edit only ${fragmentPath}; do NOT hand-edit ${page.source || "index.html"} directly.`);
      lines.push(`- Keep the report live on localhost:${cfgPort}; saving ${fragmentPath} triggers automatic rebuild and hot-swap (no manual build-report.mjs run needed).`);
    } else {
      lines.push("- Edit the source content fragment if applicable, or the served report file.");
      lines.push("- Rebuild with skills/html-report/scripts/build-report.mjs after editing when available.");
      lines.push(`- Keep the report live on localhost:${cfgPort} so the browser hot-swaps the result.`);
    }
    lines.push("- Follow the task tracking and verification principles of this project.");
    return lines.join("\n");
  },

  getPageInfo() {
    let metaSource = null;
    if (typeof document !== "undefined") {
      const m = document.querySelector('meta[name="html-report-source"]');
      metaSource = m ? m.getAttribute("content") : null;
    }
    const manifest = (typeof HTMLReportAgent !== "undefined" && typeof HTMLReportAgent.getManifest === "function")
      ? HTMLReportAgent.getManifest()
      : null;
    const files = (manifest && manifest.files && typeof manifest.files === "object") ? manifest.files : {};
    const project = (manifest && manifest.project) ? String(manifest.project) : null;
    const activeAddons = (manifest && Array.isArray(manifest.activeAddons)) ? manifest.activeAddons.slice() : [];
    const htmlEl = typeof document !== "undefined" ? document.documentElement : null;
    return {
      title: (typeof document !== "undefined" && document.title) || (manifest && manifest.title) || "Untitled report",
      source: files.entry || metaSource || null,
      fragment: files.fragment || null,
      project,
      manifestPath: project ? `projects/${project}/report.manifest.json` : null,
      mode: (htmlEl && htmlEl.getAttribute("data-report-mode")) || (manifest && manifest.mode) || "report",
      theme: (manifest && manifest.theme) || (htmlEl && htmlEl.getAttribute("data-theme")) || null,
      activeAddons,
      aiModel: (manifest && manifest.aiConfig && manifest.aiConfig.model) || null
    };
  },

  /** Chooses the primary action: send (AI + connected), turnkey (AI + offline), copy. */
  resolveSendState(aiCapable, connectionState) {
    if (!aiCapable) return "copy";
    return connectionState === "connected" ? "send" : "turnkey";
  },

  _currentSection: null,

  initDock() {
    if (typeof document === "undefined") return;
    const $ = (id) => document.getElementById(id);
    const dock = $("edit-dock");
    if (!dock || dock.__editWired) return;
    dock.__editWired = true;
    const self = this;
    const body = $("edit-dock-body");
    const toggle = $("edit-dock-toggle");
    let activeTab = "compose";
    let lastPrimaryTab = "compose";

    const applyPadding = () => {
      document.body.style.paddingBottom = dock.classList.contains("hidden") ? "" : `${Math.ceil(dock.getBoundingClientRect().height)}px`;
    };
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(applyPadding).observe(dock);

    const setExpanded = (v) => {
      body.classList.toggle("hidden", !v);
      toggle.setAttribute("aria-expanded", v ? "true" : "false");
      if (!v) self.closeStyleThemeDropdown();
      applyPadding();
    };
    const setTab = (tab) => {
      activeTab = tab;
      if (tab === "compose" || tab === "queue") lastPrimaryTab = tab;
      if (tab !== "styling") self.closeStyleThemeDropdown();
      const composePane = $("edit-pane-compose");
      const queuePane = $("edit-pane-queue");
      const stylingPane = $("edit-pane-styling");
      if (composePane) composePane.classList.toggle("hidden", tab !== "compose");
      if (queuePane) queuePane.classList.toggle("hidden", tab !== "queue");
      if (stylingPane) stylingPane.classList.toggle("hidden", tab !== "styling");
      const composeTab = $("edit-tab-compose");
      const queueTab = $("edit-tab-queue");
      const stylingTab = $("edit-tab-styling");
      if (composeTab) composeTab.classList.toggle("tab-active", tab === "compose");
      if (queueTab) queueTab.classList.toggle("tab-active", tab === "queue");
      if (stylingTab && stylingTab.classList) {
        stylingTab.classList.toggle("btn-active", tab === "styling");
        stylingTab.classList.toggle("btn-outline", tab !== "styling");
        stylingTab.setAttribute("aria-selected", tab === "styling" ? "true" : "false");
      }
      if (tab === "queue") self.renderQueue();
      if (tab === "styling") self.refreshStylePane();
    };
    this._setDockExpanded = setExpanded;
    this._setDockTab = setTab;
    this.openDock = (opts = {}) => {
      dock.classList.remove("hidden");
      setExpanded(opts.expand !== false);
      setTab(opts.tab || activeTab);
      applyPadding();
      self.renderQueue();
      if (opts.focus !== false && activeTab === "compose") { const t = $("edit-task-title"); if (t) t.focus(); }
    };
    this.closeDock = () => { this.closeStyleThemeDropdown(); dock.classList.add("hidden"); applyPadding(); };

    toggle.addEventListener("click", () => setExpanded(body.classList.contains("hidden")));
    $("edit-dock-close").addEventListener("click", () => this.closeDock());
    const selectBtn = $("edit-dock-select");
    if (selectBtn) selectBtn.addEventListener("click", () => self.toggleSelectMode());
    const clearTargetBtn = $("edit-clear-target");
    if (clearTargetBtn) clearTargetBtn.addEventListener("click", () => self.setSelectedTarget(null));
    const cancelEditBtn = $("edit-cancel-edit-btn");
    if (cancelEditBtn) cancelEditBtn.addEventListener("click", () => self.cancelEdit());
    $("edit-dock-add").addEventListener("click", () => {
      self.cancelEdit();
      setExpanded(true);
      setTab("compose");
      $("edit-task-title").focus();
    });
    $("edit-tab-compose").addEventListener("click", () => setTab("compose"));
    $("edit-tab-queue").addEventListener("click", () => setTab("queue"));
    const stylingTabBtn = $("edit-tab-styling");
    if (stylingTabBtn) {
      stylingTabBtn.addEventListener("click", () => {
        setExpanded(true);
        setTab(activeTab === "styling" ? lastPrimaryTab : "styling");
      });
    }
    const resetDockBtn = $("edit-dock-reset-btn");
    if (resetDockBtn) {
      resetDockBtn.addEventListener("click", () => { self.resetAll(); });
    }

    const addFromForm = () => {
      const rawTitle = $("edit-task-title").value;
      const rawContent = $("edit-task-content").value;
      const rawPriority = $("edit-task-priority").value;
      if (self._editingTaskId) {
        const trimmedTitle = String(rawTitle || "").trim();
        const trimmedContent = String(rawContent || "").trim();
        if (!trimmedTitle && !trimmedContent) return null;
        const updated = self.updateTask(self._editingTaskId, {
          title: trimmedTitle,
          content: trimmedContent,
          priority: rawPriority,
          target: self._selectedTarget
        });
        self.cancelEdit();
        setTab("queue");
        return updated;
      }
      const anchor = self._currentSection;
      const task = self.addTask({
        title: rawTitle,
        content: rawContent,
        priority: rawPriority,
        target: self._selectedTarget,
        anchor
      });
      if (!task) return null;
      $("edit-task-title").value = "";
      $("edit-task-content").value = "";
      if ($("edit-task-content").style) $("edit-task-content").style.height = "";
      self.setSelectedTarget(null);
      self.renderQueue();
      return task;
    };
    $("edit-add-btn").addEventListener("click", addFromForm);
    ["edit-task-title", "edit-task-content"].forEach((id) => {
      $(id).addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addFromForm(); } });
    });
    $("edit-task-content").addEventListener("input", (e) => {
      e.target.style.height = "auto";
      e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
    });

    $("edit-generate-btn").addEventListener("click", () => self.generatePrompt());
    $("edit-send-btn").addEventListener("click", () => self.handleSend());
    const autoToggle = $("edit-auto-priority-toggle");
    if (autoToggle) {
      autoToggle.checked = self.isAutoPriority();
      autoToggle.addEventListener("change", (e) => {
        self.setAutoPriority(e.target.checked);
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && self._selectMode) {
        e.preventDefault();
        self.toggleSelectMode(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key && e.key.toLowerCase() === "e") {
        e.preventDefault();
        if (dock.classList.contains("hidden")) self.openDock(); else self.closeDock();
      } else if (e.key === "Escape" && dock.contains(document.activeElement) && !body.classList.contains("hidden")) {
        setExpanded(false);
      }
    });

    this.initScrollFollowing();
    this.initStyleEditor();
    if (HTMLReportAgent && HTMLReportAgent.onStateChange) HTMLReportAgent.onStateChange(() => self.refreshSendState());
    this.renderQueue();
  },

  initScrollFollowing() {
    if (typeof document === "undefined" || typeof IntersectionObserver === "undefined") return;
    const targets = Array.from(document.querySelectorAll("main section[id], main h1[id], main h2[id], main h3[id]"));
    if (targets.length === 0) return;
    const visible = new Map();
    const labelOf = (el) => {
      const h = /^H[1-3]$/.test(el.tagName) ? el : el.querySelector("h1, h2, h3");
      return ((h && h.textContent) || el.getAttribute("aria-label") || el.id).trim().slice(0, 60);
    };
    const update = () => {
      let best = null;
      visible.forEach((top, el) => { if (!best || top < best.top) best = { el, top }; });
      if (!best) return;
      this._currentSection = { id: best.el.id, label: labelOf(best.el) };
      const chip = document.getElementById("edit-section-chip");
      if (chip) chip.textContent = this._currentSection.label;
      const anchor = document.getElementById("edit-task-anchor");
      if (anchor) anchor.textContent = `Anchor: ${this._currentSection.label}`;
      this.highlightVisibleTasks();
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) visible.set(en.target, Math.abs(en.boundingClientRect.top)); else visible.delete(en.target);
      });
      update();
    }, { rootMargin: "0px 0px -60% 0px", threshold: [0, 1] });
    targets.forEach((t) => io.observe(t));
    this._io = io;
  },

  highlightVisibleTasks() {
    if (typeof document === "undefined") return;
    const cur = this._currentSection && this._currentSection.id;
    document.querySelectorAll("#edit-queue-list [data-anchor-id]").forEach((li) => {
      li.classList.toggle("ring-1", Boolean(cur) && li.getAttribute("data-anchor-id") === cur);
      li.classList.toggle("ring-primary", Boolean(cur) && li.getAttribute("data-anchor-id") === cur);
    });
  },

  renderQueue() {
    if (typeof document === "undefined") return;
    const list = document.getElementById("edit-queue-list");
    const count = document.getElementById("edit-task-count");
    const tasks = this.getTasks();
    if (count) count.textContent = String(tasks.filter((t) => !t.done).length);
    this.refreshSendState();
    if (!list) return;
    list.innerHTML = "";
    if (tasks.length === 0) {
      const li = document.createElement("li");
      li.className = "text-base-content/60 p-2";
      li.textContent = "No tasks yet. Use Compose to add one.";
      list.appendChild(li);
      return;
    }
    const mk = (cls, text, label, fn) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = cls; b.textContent = text; b.setAttribute("aria-label", label);
      b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
      return b;
    };
    _sortTasks(tasks).forEach((t) => {
      const li = document.createElement("li");
      li.className = "flex items-center gap-2 p-1.5 sm:p-2 rounded-lg bg-base-200/90 border border-base-300 hover:border-primary/50 text-base-content transition-colors cursor-pointer";
      li.setAttribute("data-task-id", t.id);
      if (t.anchor) li.setAttribute("data-anchor-id", t.anchor.id);
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.className = "checkbox checkbox-xs shrink-0"; cb.checked = t.done;
      cb.setAttribute("aria-label", "Mark done");
      cb.addEventListener("click", (e) => e.stopPropagation());
      cb.addEventListener("change", () => { this.updateTask(t.id, { done: cb.checked }); this.renderQueue(); });
      const chip = document.createElement("span");
      chip.className = `badge badge-xs font-mono shrink-0 ${t.priority === 1 ? "badge-error" : t.priority === 2 ? "badge-warning" : "badge-ghost"}`;
      chip.textContent = `P${t.priority}`;
      chip.title = `Priority P${t.priority} - click to cycle`;
      chip.style.cursor = "pointer";
      chip.addEventListener("click", (e) => { e.stopPropagation(); this.updateTask(t.id, { priority: (t.priority % 3) + 1 }); this.renderQueue(); });
      let targetChip = null;
      if (t.target && t.target.id) {
        targetChip = document.createElement("span");
        targetChip.className = "badge badge-accent badge-xs font-mono font-bold shrink-0";
        targetChip.textContent = `#${t.target.id}`;
        targetChip.title = `Target: #${t.target.id}${t.target.tag ? ` (<${t.target.tag}>)` : ""}`;
      }
      let anchorChip = null;
      if (t.anchor && t.anchor.id) {
        anchorChip = document.createElement("button");
        anchorChip.type = "button";
        anchorChip.className = "badge badge-outline badge-xs font-mono shrink-0 hover:badge-primary cursor-pointer";
        anchorChip.setAttribute("data-anchor-jump", t.anchor.id);
        anchorChip.textContent = `§ ${t.anchor.label || t.anchor.id}`;
        anchorChip.title = `Jump to section: ${t.anchor.label || t.anchor.id}`;
        anchorChip.setAttribute("aria-label", `Jump to section ${t.anchor.label || t.anchor.id}`);
        anchorChip.addEventListener("click", (e) => { e.stopPropagation(); this.scrollToAnchor(t); });
      }
      const title = document.createElement("span");
      title.className = `min-w-0 flex-1 truncate text-xs font-medium text-base-content ${t.done ? "line-through opacity-50" : ""}`;
      title.textContent = t.title || t.content;
      title.title = `${t.title || t.content || "Task"} — click to edit in Compose`;
      li.addEventListener("click", () => this.editTaskInCompose(t.id));
      const itemsToAppend = [cb, chip];
      if (targetChip) itemsToAppend.push(targetChip);
      if (anchorChip) itemsToAppend.push(anchorChip);
      itemsToAppend.push(title,
        mk("btn btn-ghost btn-xs px-1.5 shrink-0", "✎", "Edit task", () => { this.editTaskInCompose(t.id); }),
        mk("btn btn-ghost btn-xs px-1.5 shrink-0", "↑", "Move up", () => { this.moveTask(t.id, -1); this.renderQueue(); }),
        mk("btn btn-ghost btn-xs px-1.5 shrink-0", "↓", "Move down", () => { this.moveTask(t.id, 1); this.renderQueue(); }),
        mk("btn btn-ghost btn-xs px-1.5 shrink-0 text-error hover:bg-error/20", "🗑", "Delete task", () => { this.removeTask(t.id); this.renderQueue(); }));
      li.append(...itemsToAppend);
      list.appendChild(li);
    });
    this.highlightVisibleTasks();
  },

  scrollToAnchor(task) {
    if (!task || !task.anchor || typeof document === "undefined") return;
    const el = document.getElementById(task.anchor.id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    const prev = el.style.outline;
    el.style.outline = "2px solid currentColor";
    el.style.outlineOffset = "4px";
    setTimeout(() => { el.style.outline = prev; el.style.outlineOffset = ""; }, 1400);
  },

  generatePrompt(options = {}) {
    const autoPriority = options.autoPriority !== undefined ? Boolean(options.autoPriority) : this.isAutoPriority();
    const text = this.buildEditPrompt(this.getTasks(), this.getPageInfo(), { autoPriority, ...options });
    this._generatedPrompt = text;
    if (typeof document !== "undefined") {
      const pre = document.getElementById("edit-prompt-preview");
      if (pre) { pre.textContent = text; pre.classList.remove("hidden"); }
      this.refreshSendState();
    }
    return text;
  },

  refreshSendState() {
    if (typeof document === "undefined") return "copy";
    const state = this.resolveSendState(
      HTMLReportAgent.isAiCapable(),
      HTMLReportAgent.getState()
    );
    const btn = document.getElementById("edit-send-btn");
    const hasPrompt = Boolean(this._generatedPrompt && this._generatedPrompt.trim());
    if (btn) {
      btn.setAttribute("data-send-state", state);
      btn.textContent = state === "send" ? "Send to agent" : state === "turnkey" ? "Turnkey reconnect" : "Copy prompt";
      if (!hasPrompt) {
        btn.disabled = true;
        btn.setAttribute("aria-disabled", "true");
        btn.classList.add("btn-disabled", "opacity-50", "cursor-not-allowed");
        btn.title = "Generate a prompt first to copy or send (click 'Generate prompt')";
      } else {
        btn.disabled = false;
        btn.removeAttribute("aria-disabled");
        btn.classList.remove("btn-disabled", "opacity-50", "cursor-not-allowed");
        btn.title = state === "send" ? "Send prompt to agent" : state === "turnkey" ? "Open turnkey reconnect modal" : "Copy prompt to clipboard";
      }
    }
    return state;
  },

  async handleSend() {
    if (!this._generatedPrompt) {
      const status = typeof document !== "undefined" ? document.getElementById("edit-send-status") : null;
      if (status) status.textContent = "Please generate a prompt first.";
      this.refreshSendState();
      return "copy";
    }
    const text = this._generatedPrompt;
    const state = this.refreshSendState();
    const status = typeof document !== "undefined" ? document.getElementById("edit-send-status") : null;
    const say = (m) => { if (status) status.textContent = m; };
    if (state === "send") {
      say("Sending to agent...");
      try {
        const info = this.getPageInfo();
        const openTasks = _sortTasks(this.getTasks().filter((t) => !t.done));
        const targetIds = Array.from(new Set(openTasks.map((t) => t.target && t.target.id).filter(Boolean)));
        const anchorIds = Array.from(new Set(openTasks.map((t) => t.anchor && t.anchor.id).filter(Boolean)));
        const locPath = typeof location !== "undefined" ? location.pathname : "";
        const resolvedFile = (locPath && locPath.startsWith("/projects/"))
          ? locPath
          : (info.source || locPath || "");
        const csrfToken = await HTMLReportAgent._getCsrfToken();
        const headers = { "Content-Type": "application/json" };
        if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
        const res = await fetch("/__agent_edit__", {
          method: "POST",
          headers,
          body: JSON.stringify({
            prompt: text,
            file: resolvedFile,
            fragment: info.fragment || undefined,
            model: info.aiModel || undefined,
            targetIds,
            anchorIds
          })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          say(data.mode === "fast-patch" ? "Fast-patched fragment; page will hot-swap." : "Agent finished; page will hot-swap.");
        } else {
          say(`Agent error: ${data.error || res.status}`);
        }
      } catch (err) {
        say(`Send failed: ${err.message}`);
      }
    } else if (state === "turnkey") {
      say("Agent offline: reconnect with the turnkey prompt.");
      HTMLReportAgent.openReconnectModal({ extra: text });
    } else {
      try {
        await navigator.clipboard.writeText(text);
        say("Prompt copied. Enable AI in Settings to send directly.");
      } catch (_) { say("Select the prompt above and copy it manually."); }
    }
    return state;
  },

  _documentDefaultTheme: null,
  _lastCustomTheme: null,
  _styleEditorDefaults: {
    name: "custom",
    extends: "light",
    primary: "#570df8",
    secondary: "#f000b8",
    accent: "#37cdbe",
    neutral: "#3d4451",
    "base-100": "#ffffff",
    "--rounded-box": "1rem",
    "--rounded-btn": "0.5rem"
  },

  getDocumentDefaultTheme() {
    if (this._documentDefaultTheme) return this._documentDefaultTheme;
    const manifest = (typeof HTMLReportAgent !== "undefined" && typeof HTMLReportAgent.getManifest === "function")
      ? HTMLReportAgent.getManifest()
      : null;
    const fromManifest = manifest && manifest.theme ? String(manifest.theme) : null;
    const fromDom = (typeof document !== "undefined" && document.documentElement)
      ? (document.documentElement.getAttribute("data-theme") || "light")
      : "light";
    this._documentDefaultTheme = fromManifest || fromDom || "light";
    return this._documentDefaultTheme;
  },

  _sanitizeThemeName(raw) {
    const cleaned = String(raw || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    return cleaned || "custom";
  },

  _getCustomThemePayload(themeName) {
    if (!themeName || STANDARD_DAISYUI_THEMES.has(themeName)) return null;
    if (this._lastCustomTheme && this._lastCustomTheme.name === themeName) {
      return this._lastCustomTheme.definition || this._lastCustomTheme.css;
    }
    try {
      if (typeof localStorage !== "undefined") {
        const saved = JSON.parse(localStorage.getItem("html_report_custom_themes") || "{}");
        if (saved && saved[themeName]) {
          const entry = saved[themeName];
          return typeof entry === "string" ? entry : (entry.definition || entry.css || null);
        }
      }
    } catch (_) {}
    if (typeof document !== "undefined") {
      const styleEl = document.getElementById("daisyui-custom-themes");
      if (styleEl && styleEl.textContent) {
        const escaped = themeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const m = styleEl.textContent.match(new RegExp(`\\[data-theme=["']?${escaped}["']?\\]\\s*\\{[^}]*\\}`));
        if (m) return m[0];
      }
    }
    return null;
  },

  closeStyleThemeDropdown() {
    if (typeof document === "undefined") return;
    const menu = document.getElementById("edit-style-theme-menu");
    const btn = document.getElementById("edit-style-theme-btn");
    if (menu && menu.classList) menu.classList.add("hidden");
    if (btn && typeof btn.setAttribute === "function") btn.setAttribute("aria-expanded", "false");
  },

  toggleStyleThemeDropdown(forceState) {
    if (typeof document === "undefined") return;
    const menu = document.getElementById("edit-style-theme-menu");
    const btn = document.getElementById("edit-style-theme-btn");
    if (!menu || !btn) return;
    const isHidden = menu.classList ? menu.classList.contains("hidden") : true;
    const shouldOpen = typeof forceState === "boolean" ? forceState : isHidden;
    if (!shouldOpen) {
      this.closeStyleThemeDropdown();
      return;
    }
    this.refreshStyleThemeSelect();
    const dock = document.getElementById("edit-dock");
    if (dock && typeof dock.getBoundingClientRect === "function" && typeof btn.getBoundingClientRect === "function") {
      const dockRect = dock.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const bottomOffset = Math.max(8, Math.round(dockRect.bottom - btnRect.top + 6));
      const leftOffset = Math.max(8, Math.min(Math.round(btnRect.left - dockRect.left), Math.max(8, Math.round(dockRect.width - 264))));
      menu.style.bottom = `${bottomOffset}px`;
      menu.style.left = `${leftOffset}px`;
    }
    if (menu.classList) menu.classList.remove("hidden");
    if (typeof btn.setAttribute === "function") btn.setAttribute("aria-expanded", "true");
  },

  refreshStyleThemeSelect() {
    if (typeof document === "undefined") return;
    const active = document.documentElement ? (document.documentElement.getAttribute("data-theme") || "light") : "light";
    const select = document.getElementById("edit-style-theme-select");
    if (select) {
      select.innerHTML = "";
      DAISYUI_THEMES.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = STANDARD_DAISYUI_THEMES.has(t) ? t : `${t} (custom)`;
        if (t === active) opt.selected = true;
        select.appendChild(opt);
      });
      if (DAISYUI_THEMES.includes(active)) select.value = active;
    }
    const labelEl = document.getElementById("edit-style-theme-label");
    if (labelEl) labelEl.textContent = active;
    const swatchesEl = document.getElementById("edit-style-theme-swatches");
    if (swatchesEl && typeof swatchesEl.setAttribute === "function") swatchesEl.setAttribute("data-theme", active);
    const swatchList = document.getElementById("edit-style-theme-swatch-list");
    if (swatchList) {
      swatchList.innerHTML = "";
      DAISYUI_THEMES.forEach((theme) => {
        swatchList.appendChild(createThemeSwatchButton(theme, active, {
          attrName: "data-edit-set-theme",
          onSelect: (t) => {
            setReportTheme(t);
            HTMLReportEdit.closeStyleThemeDropdown();
          }
        }));
      });
    }
  },

  refreshStylePane() {
    if (typeof document === "undefined") return;
    this.refreshStyleThemeSelect();
    const badge = document.getElementById("edit-style-default-badge");
    if (badge) badge.textContent = `Default: ${this.getDocumentDefaultTheme()}`;
  },

  readStyleEditorConfig() {
    const defaults = this._styleEditorDefaults;
    const val = (id, fb) => {
      const el = typeof document !== "undefined" ? document.getElementById(id) : null;
      return el && el.value !== undefined && String(el.value).trim() !== "" ? String(el.value).trim() : fb;
    };
    const name = this._sanitizeThemeName(val("edit-style-name", defaults.name));
    const ext = val("edit-style-extends", defaults.extends);
    const themeDef = {
      primary: val("edit-style-primary-hex", defaults.primary),
      secondary: val("edit-style-secondary-hex", defaults.secondary),
      accent: val("edit-style-accent-hex", defaults.accent),
      neutral: val("edit-style-neutral-hex", defaults.neutral),
      "base-100": val("edit-style-base-100-hex", defaults["base-100"]),
      "--rounded-box": val("edit-style-rounded-box", defaults["--rounded-box"]),
      "--rounded-btn": val("edit-style-rounded-btn", defaults["--rounded-btn"])
    };
    if (ext && ext !== "none") themeDef.extends = ext;
    return { name, definition: { [name]: themeDef } };
  },

  _resetStyleEditorInputs() {
    if (typeof document === "undefined") return;
    const d = this._styleEditorDefaults;
    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v;
    };
    setVal("edit-style-name", d.name);
    setVal("edit-style-extends", d.extends);
    for (const token of ["primary", "secondary", "accent", "neutral", "base-100"]) {
      setVal(`edit-style-${token}-picker`, d[token]);
      setVal(`edit-style-${token}-hex`, d[token]);
    }
    setVal("edit-style-rounded-box", d["--rounded-box"]);
    setVal("edit-style-rounded-btn", d["--rounded-btn"]);
    const twPre = document.getElementById("edit-style-tailwind-preview");
    if (twPre) twPre.textContent = "";
    const status = document.getElementById("edit-style-status");
    if (status) status.textContent = "";
    const offlineActions = document.getElementById("edit-style-offline-actions");
    if (offlineActions && offlineActions.classList) offlineActions.classList.add("hidden");
  },

  async applyStyleEditorLive({ saveToStorage = false } = {}) {
    const { name, definition } = this.readStyleEditorConfig();
    const compiled = compileTheme(definition, { defaultThemeName: name });
    this._lastCustomTheme = { name: compiled.themeName, definition, css: compiled.css, variables: compiled.variables };

    if (typeof document !== "undefined") {
      const twPre = document.getElementById("edit-style-tailwind-preview");
      if (twPre) twPre.textContent = tailwindConfigSnippet(compiled.themeName, compiled.variables);
    }

    registerCustomTheme(compiled.themeName, compiled.css);
    await setReportTheme(compiled.themeName);
    this.refreshStyleThemeSelect();

    if (saveToStorage) {
      try {
        if (typeof localStorage !== "undefined") {
          const existing = JSON.parse(localStorage.getItem("html_report_custom_themes") || "{}");
          const next = (existing && typeof existing === "object") ? existing : {};
          next[compiled.themeName] = { definition, css: compiled.css };
          localStorage.setItem("html_report_custom_themes", JSON.stringify(next));
        }
      } catch (_) {}
    }
    return compiled;
  },

  async copyEditorCss() {
    const compiled = this._lastCustomTheme && this._lastCustomTheme.css
      ? this._lastCustomTheme
      : compileTheme(this.readStyleEditorConfig().definition);
    const status = typeof document !== "undefined" ? document.getElementById("edit-style-status") : null;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(compiled.css);
        if (status) status.textContent = `Copied [data-theme="${compiled.themeName}"] CSS to clipboard.`;
        return compiled.css;
      }
    } catch (_) {}
    if (status) status.textContent = "Clipboard unavailable; inspect Tailwind Config & CSS preview.";
    return compiled.css;
  },

  async persistDocumentStyle({ theme, customTheme = null } = {}) {
    const targetTheme = theme || (typeof document !== "undefined" && document.documentElement
      ? (document.documentElement.getAttribute("data-theme") || "light")
      : "light");
    const status = typeof document !== "undefined" ? document.getElementById("edit-style-status") : null;
    const offlineActions = typeof document !== "undefined" ? document.getElementById("edit-style-offline-actions") : null;
    const badge = typeof document !== "undefined" ? document.getElementById("edit-style-default-badge") : null;
    const say = (msg, isOffline = false) => {
      if (status) status.textContent = msg;
      if (offlineActions && offlineActions.classList) offlineActions.classList.toggle("hidden", !isOffline);
    };

    const isFileProto = typeof location !== "undefined" && location.protocol === "file:";
    if (isFileProto || typeof fetch !== "function") {
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("html_report_active_theme", targetTheme);
          if (customTheme && !STANDARD_DAISYUI_THEMES.has(targetTheme)) {
            const compiled = compileTheme(customTheme, { defaultThemeName: targetTheme });
            const existing = JSON.parse(localStorage.getItem("html_report_custom_themes") || "{}");
            const next = (existing && typeof existing === "object") ? existing : {};
            next[targetTheme] = { definition: customTheme, css: compiled.css };
            localStorage.setItem("html_report_custom_themes", JSON.stringify(next));
          }
        }
      } catch (_) {}
      say(`Applied '${targetTheme}' locally (offline/static). Use Copy CSS or Download HTML to persist.`, true);
      return { ok: true, persisted: "local", theme: targetTheme };
    }

    try {
      const info = this.getPageInfo();
      const locPath = typeof location !== "undefined" ? location.pathname : "";
      const resolvedFile = (locPath && locPath.startsWith("/projects/"))
        ? locPath
        : (info.source || locPath || "");
      const csrfToken = await HTMLReportAgent._getCsrfToken();
      const headers = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const res = await fetch("/__agent_style__", {
        method: "POST",
        headers,
        body: JSON.stringify({
          file: resolvedFile,
          theme: targetTheme,
          customTheme: customTheme ?? null
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        const persistedTheme = data.theme || targetTheme;
        this._documentDefaultTheme = persistedTheme;
        if (badge) badge.textContent = `Default: ${persistedTheme}`;
        if (typeof document !== "undefined") {
          const mEl = document.getElementById("agent-manifest");
          if (mEl && mEl.textContent) {
            try {
              const m = JSON.parse(mEl.textContent);
              m.theme = persistedTheme;
              mEl.textContent = JSON.stringify(m, null, 2);
            } catch (_) {}
          }
        }
        say(`Saved '${persistedTheme}' as document default.`, false);
        return { ok: true, persisted: "server", theme: persistedTheme };
      }
      say(`Applied '${targetTheme}' locally (server unavailable: ${data.error || res.status}). Copy CSS or Download HTML to persist.`, true);
      return { ok: true, persisted: "local", theme: targetTheme };
    } catch (_) {
      say(`Applied '${targetTheme}' locally (offline). Copy CSS or Download HTML to persist.`, true);
      return { ok: true, persisted: "local", theme: targetTheme };
    }
  },

  async setCurrentThemeAsDefault() {
    const select = typeof document !== "undefined" ? document.getElementById("edit-style-theme-select") : null;
    const selected = (select && select.value) || (typeof document !== "undefined" && document.documentElement
      ? (document.documentElement.getAttribute("data-theme") || "light")
      : "light");
    const customTheme = this._getCustomThemePayload(selected);
    await setReportTheme(selected);
    return this.persistDocumentStyle({ theme: selected, customTheme });
  },

  initStyleEditor() {
    if (typeof document === "undefined") return;
    const $ = (id) => document.getElementById(id);
    if (this._styleEditorWired) return;
    const pane = $("edit-pane-styling");
    if (!pane) return;
    this._styleEditorWired = true;
    const self = this;

    this.refreshStylePane();

    const themeBtn = $("edit-style-theme-btn");
    if (themeBtn) {
      themeBtn.addEventListener("click", (e) => {
        if (e && typeof e.stopPropagation === "function") e.stopPropagation();
        self.toggleStyleThemeDropdown();
      });
    }

    if (typeof document.addEventListener === "function") {
      document.addEventListener("click", (e) => {
        const menu = $("edit-style-theme-menu");
        const dd = $("edit-style-theme-dropdown");
        if (!menu || (menu.classList && menu.classList.contains("hidden"))) return;
        const t = e && e.target;
        if ((menu.contains && menu.contains(t)) || (dd && dd.contains && dd.contains(t))) return;
        self.closeStyleThemeDropdown();
      });
      document.addEventListener("keydown", (e) => {
        if (e && e.key === "Escape") self.closeStyleThemeDropdown();
      });
    }

    const themeSelect = $("edit-style-theme-select");
    if (themeSelect) {
      themeSelect.addEventListener("change", (e) => {
        setReportTheme(e.target.value);
      });
    }

    const setDefaultBtn = $("edit-style-set-default-btn");
    if (setDefaultBtn) {
      setDefaultBtn.addEventListener("click", () => {
        self.setCurrentThemeAsDefault();
      });
    }

    const tokens = ["primary", "secondary", "accent", "neutral", "base-100"];
    tokens.forEach((token) => {
      const picker = $(`edit-style-${token}-picker`);
      const hex = $(`edit-style-${token}-hex`);
      if (picker && hex) {
        picker.addEventListener("input", () => {
          hex.value = picker.value;
          self.applyStyleEditorLive();
        });
        hex.addEventListener("input", () => {
          if (/^#[0-9a-fA-F]{6}$/.test(hex.value.trim())) {
            picker.value = hex.value.trim();
          }
          self.applyStyleEditorLive();
        });
      }
    });

    ["edit-style-name", "edit-style-extends", "edit-style-rounded-box", "edit-style-rounded-btn"].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener("change", () => self.applyStyleEditorLive());
    });

    const saveBtn = $("edit-style-save-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const compiled = await self.applyStyleEditorLive({ saveToStorage: true });
        const status = $("edit-style-status");
        if (status) status.textContent = `Saved custom theme '${compiled.themeName}' locally.`;
      });
    }

    const copyBtn = $("edit-style-copy-css-btn");
    if (copyBtn) copyBtn.addEventListener("click", () => self.copyEditorCss());
    const offlineCopyBtn = $("edit-style-offline-copy-btn");
    if (offlineCopyBtn) offlineCopyBtn.addEventListener("click", () => self.copyEditorCss());
    const offlineDownloadBtn = $("edit-style-offline-download-btn");
    if (offlineDownloadBtn) {
      offlineDownloadBtn.addEventListener("click", () => {
        if (typeof HTMLReportPublisher !== "undefined" && typeof HTMLReportPublisher.downloadPublished === "function") {
          HTMLReportPublisher.downloadPublished(offlineDownloadBtn);
        }
      });
    }
  },

  async resetAll(options = {}) {
    const skipConfirm = Boolean(options && options.skipConfirm);
    if (!skipConfirm && typeof window !== "undefined" && typeof window.confirm === "function") {
      const confirmed = window.confirm("Reset all Edit Mode tasks, Compose draft, and custom styling overrides back to baseline (light)?");
      if (!confirmed) return false;
    }

    const pageKey = options.pageKey;
    this.saveTasks([], pageKey);
    this.setAutoPriority(false, pageKey);
    if (typeof document !== "undefined") {
      const autoToggle = document.getElementById("edit-auto-priority-toggle");
      if (autoToggle) autoToggle.checked = false;
    }
    this.cancelEdit();
    this.toggleSelectMode(false);
    this.closeStyleThemeDropdown();

    this._lastCustomTheme = null;
    this._documentDefaultTheme = "light";

    if (typeof document !== "undefined") {
      const styleEl = document.getElementById("daisyui-custom-themes");
      if (styleEl) styleEl.textContent = "";
    }
    for (let i = DAISYUI_THEMES.length - 1; i >= 0; i--) {
      if (!STANDARD_DAISYUI_THEMES.has(DAISYUI_THEMES[i])) {
        DAISYUI_THEMES.splice(i, 1);
      }
    }
    if (typeof document !== "undefined" && document.getElementById("theme-swatch-list")) {
      initThemeDropdown();
    }

    this._resetStyleEditorInputs();
    await setReportTheme("light");

    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("html_report_custom_themes");
        localStorage.removeItem("html_report_active_theme");
      }
    } catch (_) {}

    if (typeof document !== "undefined") {
      const badge = document.getElementById("edit-style-default-badge");
      if (badge) badge.textContent = "Default: light";
      this.refreshStyleThemeSelect();
    }

    if (typeof fetch === "function" && typeof location !== "undefined" && location.protocol !== "file:") {
      await this.persistDocumentStyle({ theme: "light", customTheme: null });
    }

    if (typeof this._setDockTab === "function") this._setDockTab("compose");
    this.renderQueue();
    return true;
  }
};

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
})();
