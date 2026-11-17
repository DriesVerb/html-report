/**
 * @html-report/studio Authoring Plugin (authoring-plugin.js)
 * Opt-in Edit Mode (#edit-dock), Element Selection, OKLCH Style Editor,
 * All Settings Modal, and Two-Way AI Agent Bridge (HTMLReportAgent).
 */

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
};
