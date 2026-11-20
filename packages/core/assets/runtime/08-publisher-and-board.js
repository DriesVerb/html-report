/* -------------------------------- Publisher -------------------------------- */

const HTMLReportPublisher = {
  AUTHORING_SELECTORS: [
    "#open-all-settings-btn",
    "#settings-publish-toggle-wrapper",
    "#settings-extra-sections",
    "#all-settings-modal",
    "#edit-dock",
    "#agent-dock-container",
    "#agent-reconnect-modal",
    "#agent-bridge-status-container",
    "#published-badge",
    "script[data-authoring]",
    "[data-agent-authoring-only]"
  ],

  /** Prunes authoring chrome from a cloned document tree and returns it. */
  stripAuthoringElements(docClone) {
    if (!docClone || typeof docClone.querySelectorAll !== "function") return docClone;
    this.AUTHORING_SELECTORS.forEach((sel) => docClone.querySelectorAll(sel).forEach((el) => el.remove()));
    const pubToggle = docClone.querySelector("#settings-publish-toggle");
    if (pubToggle) {
      const wrap = pubToggle.closest("#settings-publish-toggle-wrapper") || pubToggle.closest("div.p-2") || pubToggle;
      wrap.remove();
    }
    docClone.querySelectorAll(".divider").forEach((d) => {
      if (d.textContent && d.textContent.includes("Quick Controls")) d.remove();
    });
    docClone.querySelectorAll('meta[name="html-report-ai"]').forEach((el) => el.remove());
    docClone.querySelectorAll("#html-report-verify-styles").forEach((el) => el.remove());
    docClone.querySelectorAll("[data-agent-authoring], [data-session-id], [data-insufficient-space]").forEach((el) => {
      el.removeAttribute("data-agent-authoring");
      el.removeAttribute("data-session-id");
      el.removeAttribute("data-insufficient-space");
    });
    docClone.querySelectorAll("*").forEach((el) => {
      if (el.attributes) {
        Array.from(el.attributes).forEach((attr) => {
          if (attr.name.startsWith("data-verify-")) el.removeAttribute(attr.name);
        });
      }
      if (
        (typeof el.hasAttribute === "function" &&
          (el.hasAttribute("data-agent-prompt") ||
            el.hasAttribute("data-agent-inspect") ||
            el.hasAttribute(":data-agent-prompt") ||
            el.hasAttribute("x-bind:data-agent-prompt")))
      ) {
        if (el.classList && typeof el.classList.add === "function") {
          el.classList.add("hidden", "print:hidden");
        }
        el.setAttribute("aria-hidden", "true");
        el.setAttribute("data-agent-prompt-hidden", "true");
      }
      if (el.classList && el.classList.length > 0) {
        const toRemove = Array.from(el.classList).filter((cls) => cls.startsWith("verify-"));
        if (toRemove.length > 0) {
          toRemove.forEach((cls) => el.classList.remove(cls));
          if (el.classList.length === 0) el.removeAttribute("class");
        }
      }
    });
    const body = docClone.querySelector("body");
    if (body && body.style) {
      body.style.removeProperty("padding-bottom");
      if (!body.getAttribute("style")) body.removeAttribute("style");
    }
    return docClone;
  },

  /** Rewrites attributes in sorted order on every element for stable serialization. */
  normalizeAttributes(docClone) {
    if (!docClone || typeof docClone.querySelectorAll !== "function") return docClone;
    const all = [docClone, ...Array.from(docClone.querySelectorAll("*"))];
    all.forEach((el) => {
      const attrs = Array.from(el.attributes || []).map((a) => [a.name, a.value]);
      if (attrs.length < 2) return;
      attrs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      attrs.forEach(([n]) => el.removeAttribute(n));
      attrs.forEach(([n, v]) => el.setAttribute(n, v));
    });
    return docClone;
  },

  /** Full published prep: strip, mark, normalize. */
  prepare(docClone) {
    this.stripAuthoringElements(docClone);
    const head = docClone.querySelector("head");
    if (head && !head.querySelector('meta[name="html-report-published"]')) {
      const m = (head.ownerDocument || document).createElement("meta");
      m.setAttribute("name", "html-report-published");
      m.setAttribute("content", "true");
      head.appendChild(m);
    }
    return this.normalizeAttributes(docClone);
  },

  /** Normalizes serialized output: LF newlines, trimmed trailing whitespace, single trailing newline. */
  normalizeSerialized(html) {
    return String(html).replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n*$/, "\n");
  },

  isPublishedFlagOn() {
    try { return _authoringStorage().getItem("html_report_published:" + getPageKey()) === "true"; } catch (_) { return false; }
  },

  setPublishedFlag(on) {
    try {
      const s = _authoringStorage();
      if (on) s.setItem("html_report_published:" + getPageKey(), "true"); else s.removeItem("html_report_published:" + getPageKey());
    } catch (_) {}
    if (typeof document !== "undefined") {
      const badge = document.getElementById("published-badge");
      if (badge) badge.classList.toggle("hidden", !on);
      const t1 = document.getElementById("settings-publish-toggle");
      if (t1 && t1.checked !== on) t1.checked = on;
      const t2 = document.getElementById("modal-publish-toggle");
      if (t2 && t2.checked !== on) t2.checked = on;
      const mb = document.getElementById("modal-publish-badge");
      if (mb) mb.classList.toggle("hidden", !on);
    }
  },

  async tryServerPublishDownload() {
    if (typeof window === "undefined" || typeof fetch !== "function") return null;
    if (!window.location || (window.location.protocol !== "http:" && window.location.protocol !== "https:")) {
      return null;
    }
    try {
      let projectSlug = null;
      const manifestEl = typeof document !== "undefined" ? document.getElementById("agent-manifest") : null;
      if (manifestEl && manifestEl.textContent) {
        try {
          const parsed = JSON.parse(manifestEl.textContent);
          if (parsed && parsed.project) projectSlug = parsed.project;
        } catch (_) {}
      }
      if (!projectSlug && window.location.pathname) {
        const m = window.location.pathname.match(/^\/projects\/([^/]+)\//);
        if (m) projectSlug = decodeURIComponent(m[1]);
      }
      const theme = typeof document !== "undefined"
        ? (document.documentElement.getAttribute("data-theme") || "light")
        : "light";
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: projectSlug, theme })
      });
      if (!res.ok) return null;
      const contentType = (res.headers.get("Content-Type") || "").toLowerCase();
      const publishedKind = (res.headers.get("X-Published-Kind") || "").toLowerCase();
      if (!publishedKind && !contentType.includes("application/zip") && !res.headers.get("Content-Disposition")) {
        return null;
      }
      const disp = res.headers.get("Content-Disposition") || "";
      const fnMatch = disp.match(/filename="?([^";\n]+)"?/i);
      const baseTitle = ((typeof document !== "undefined" && document.title) || "html-report")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "html-report";
      const fallbackName = contentType.includes("application/zip")
        ? `${projectSlug || baseTitle}-published.zip`
        : `${projectSlug || baseTitle}-published.html`;
      const filename = fnMatch && fnMatch[1] ? fnMatch[1].trim() : fallbackName;
      const blob = await res.blob();
      _triggerBlobDownload(blob, filename);
      return { ok: true, filename, kind: publishedKind || (contentType.includes("application/zip") ? "zip" : "html") };
    } catch (_) {
      return null;
    }
  },

  async downloadPublished(btn) {
    if (typeof document === "undefined") return null;
    if (btn) btn.disabled = true;
    try {
      const serverRes = await this.tryServerPublishDownload();
      if (serverRes && serverRes.ok) {
        return serverRes;
      }
      const html = await buildInlinedHtmlSnapshot({ mode: "published" });
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const baseName = (document.title || "html-report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "html-report";
      _triggerBlobDownload(blob, `${baseName}-published.html`);
      return html;
    } finally {
      if (btn) btn.disabled = false;
    }
  }
};


/**
 * Turnkey Live Board State & SSE Helper
 * Provides persistence (/api/board/state) and reactive SSE (/events) with file:// guards.
 */
const HTMLReportBoard = {
  _activeStream: null,

  isFileProtocol: function() {
    return typeof window !== "undefined" && Boolean(window.location && window.location.protocol === "file:");
  },

  _localStorageKey: function(key) {
    return `html_report_board_state:${key || getPageKey()}`;
  },

  saveLocalState: function(stateObj, key) {
    if (!stateObj || typeof stateObj !== "object" || Array.isArray(stateObj)) return false;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this._localStorageKey(key), JSON.stringify(stateObj));
        return true;
      }
    } catch (_) {}
    return false;
  },

  loadLocalState: function(key) {
    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(this._localStorageKey(key));
        if (raw) return JSON.parse(raw);
      }
    } catch (_) {}
    return {};
  },

  syncOfflineStatus: function() {
    if (typeof document === "undefined") return;
    const statusEl = document.getElementById("live-board-status");
    if (!statusEl) return;
    if (this.isFileProtocol() || (isPublishedDocument() && !this._activeStream)) {
      statusEl.textContent = "Offline (Local Save)";
      statusEl.className = "badge badge-info badge-outline badge-xs font-mono shrink-0 whitespace-nowrap";
    }
  },

  _resolveEndpoint: function(path) {
    if (typeof window === "undefined" && typeof process !== "undefined") {
      const cfg = typeof HTMLReportAgent !== "undefined" ? HTMLReportAgent.getAiConfig() : { port: 3031 };
      const port = process.env.REPORT_PORT || cfg.port || 3031;
      return `http://127.0.0.1:${port}${path}`;
    }
    return path;
  },

  saveState: async function(stateObj, options = {}) {
    if (!stateObj || typeof stateObj !== "object" || Array.isArray(stateObj)) {
      return { ok: false, error: "State payload must be a JSON object" };
    }
    if (this.isFileProtocol()) {
      const localSaved = this.saveLocalState(stateObj, options.key);
      this.syncOfflineStatus();
      return { ok: false, offline: true, localSaved, reason: "Standalone file:// mode - saved locally in browser storage" };
    }
    try {
      const endpoint = options.endpoint || this._resolveEndpoint("/api/board/state");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stateObj)
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  loadState: async function(options = {}) {
    if (this.isFileProtocol()) {
      this.syncOfflineStatus();
      return { ok: false, offline: true, state: this.loadLocalState(options.key) };
    }
    try {
      const endpoint = options.endpoint || this._resolveEndpoint("/api/board/state");
      const res = await fetch(endpoint, { method: "GET" });
      const data = await res.json();
      return data;
    } catch (err) {
      return { ok: false, error: err.message, state: {} };
    }
  },

  connectStream: function(path = "/events", handlers = {}) {
    if (this.isFileProtocol()) {
      this.syncOfflineStatus();
      return { ok: false, offline: true, reason: "Standalone file:// mode - SSE disabled", close() {} };
    }
    if (typeof EventSource === "undefined") {
      return { ok: false, unsupported: true, reason: "EventSource unavailable in this environment", close() {} };
    }
    try {
      if (this._activeStream && typeof this._activeStream.close === "function") {
        this._activeStream.close();
      }
      const source = new EventSource(path);
      this._activeStream = source;
      if (typeof handlers.onOpen === "function") {
        source.addEventListener("open", (e) => handlers.onOpen(e));
      }
      if (typeof handlers.onMessage === "function") {
        source.addEventListener("message", (e) => handlers.onMessage(e));
      }
      if (typeof handlers.onState === "function") {
        source.addEventListener("board-state", (e) => {
          try { handlers.onState(JSON.parse(e.data), e); } catch (_) {}
        });
      }
      if (typeof handlers.onError === "function") {
        source.addEventListener("error", (e) => handlers.onError(e));
      }
      return {
        ok: true,
        source,
        close: () => {
          try { source.close(); } catch (_) {}
          if (this._activeStream === source) this._activeStream = null;
        }
      };
    } catch (err) {
      return { ok: false, error: err.message, close() {} };
    }
  }
};


// Global browser window bindings
if (typeof window !== "undefined") {
  window.STANDARD_DAISYUI_THEMES = STANDARD_DAISYUI_THEMES;
  window.DAISYUI_THEMES = DAISYUI_THEMES;
  window.registerCustomTheme = registerCustomTheme;
  window.scanAndRegisterExistingCustomThemes = scanAndRegisterExistingCustomThemes;
  window.srgbToLinear = srgbToLinear;
  window.linearToSrgb = linearToSrgb;
  window.hexToRgb = hexToRgb;
  window.hslToRgb = hslToRgb;
  window.parseColor = parseColor;
  window.rgbToOklch = rgbToOklch;
  window.autoContrastContent = autoContrastContent;
  window.compileTheme = compileTheme;
  window.tailwindConfigSnippet = tailwindConfigSnippet;
  window.cssColorToHexAndRgba = cssColorToHexAndRgba;
  window.resolveDaisyUIThemePalette = resolveDaisyUIThemePalette;
  window.sanitizeMermaidSource = sanitizeMermaidSource;
  window.renderMermaidWithTheme = renderMermaidWithTheme;
  window.initThemeDropdown = initThemeDropdown;
  window.setReportTheme = setReportTheme;
  window.initTOC = initTOC;
  window.checkInsufficientHorizontalSpace = checkInsufficientHorizontalSpace;
  window.buildInlinedHtmlSnapshot = buildInlinedHtmlSnapshot;
  window.exportReportPdf = exportReportPdf;
  window.initModeBadge = initModeBadge;
  window.initDownloadButton = initDownloadButton;
  window.initDayjs = initDayjs;
  window.initImpress = initImpress;
  window.impressNext = impressNext;
  window.impressPrev = impressPrev;
  window.impressGoto = impressGoto;
  window.initPresentationShell = initPresentationShell;
  window.resizePresentationWidgets = resizePresentationWidgets;
  window.initMockjs = initMockjs;
  window.initShowdown = initShowdown;
  window.openMarkdownViewer = window.openMarkdownViewer || openMarkdownViewer;
  window.closeMarkdownViewer = window.closeMarkdownViewer || closeMarkdownViewer;
  window.initFullCalendar = initFullCalendar;
  window.initDeclarativeCharts = initDeclarativeCharts;
  window.initDeclarativeGridjs = initDeclarativeGridjs;
  window.initDeclarativeLeaflet = initDeclarativeLeaflet;
  window.rehydrateLucideIcons = rehydrateLucideIcons;
  window.ensureLucideIcons = ensureLucideIcons;
  window.initDatastarObserver = initDatastarObserver;
  window.syncDatastarTheme = syncDatastarTheme;
  window.autoLinkMarkdownFiles = autoLinkMarkdownFiles;
  window.reinitReportContent = reinitReportContent;
  window.initPublicFeeds = initPublicFeeds;
  window.cleanupPublicFeeds = cleanupPublicFeeds;
  window.resolveFeedUrl = resolveFeedUrl;
  window.getFeedRegistry = getFeedRegistry;
  window.extractFeedFields = extractFeedFields;
  window.updateFeedCharts = updateFeedCharts;
  window.syncPwaThemeColor = syncPwaThemeColor;
  window.initPwa = initPwa;

  window.addEventListener("DOMContentLoaded", async () => {
    try { scanAndRegisterExistingCustomThemes(); } catch (_) {}
    try { ensureLucideIcons(); } catch (_) {}
    try { initTOC(); } catch (_) {}
    try { initModeBadge(); } catch (_) {}
    try { initThemeDropdown(); } catch (_) {}
    try { initDownloadButton(); } catch (_) {}
    try { initPwa(); } catch (_) {}
    try { if (window.hljs && typeof window.hljs.highlightAll === "function") window.hljs.highlightAll(); } catch (_) {}
    try { initDayjs(); } catch (_) {}
    try { initShowdown(); } catch (_) {}
    try { initMockjs(); } catch (_) {}
    try { initFullCalendar(); } catch (_) {}
    try { initDeclarativeCharts(); } catch (_) {}
    try { initDeclarativeGridjs(); } catch (_) {}
    try { initDeclarativeLeaflet(); } catch (_) {}
    try { initImpress(); } catch (_) {}
    try { initPresentationShell(); } catch (_) {}
    try { initDatastarObserver(); } catch (_) {}
    try { autoLinkMarkdownFiles(); } catch (_) {}
    try { initPublicFeeds(); } catch (_) {}

    const palette = resolveDaisyUIThemePalette();
    try { syncFullCalendarTheme(palette); } catch (_) {}
    try { await renderMermaidWithTheme(palette); } catch (_) {}
    try { if (typeof HTMLReportMermaid !== "undefined") HTMLReportMermaid.initEnlarge(); } catch (_) {}
    try { checkInsufficientHorizontalSpace(); } catch (_) {}
    try { if (typeof HTMLReportSettings !== "undefined") HTMLReportSettings.initGear(); } catch (_) {}
    try { if (typeof HTMLReportAgent !== "undefined") HTMLReportAgent.init(); } catch (_) {}
    try { if (typeof HTMLReportBoard !== "undefined") HTMLReportBoard.syncOfflineStatus(); } catch (_) {}
    try { if (typeof initAuthoring === "function") initAuthoring(); } catch (err) { console.warn("[html-report] authoring init failed:", err); }
    window.addEventListener("resize", () => checkInsufficientHorizontalSpace());
    window.addEventListener("load", () => { try { ensureLucideIcons(); } catch (_) {} });
    window.addEventListener("beforeunload", () => {
      try { cleanupPublicFeeds(); } catch (_) {}
      try { if (typeof HTMLReportAgent !== "undefined") HTMLReportAgent.stopHeartbeat(); } catch (_) {}
    });
    window.__REPORT_READY__ = true;
  });
}

if (typeof window !== "undefined") {
  window.escapeHtml = escapeHtml;
  window.createThemeSwatchButton = createThemeSwatchButton;
  window._triggerBlobDownload = _triggerBlobDownload;
  window._authoringStorage = _authoringStorage;
  window.getPageKey = getPageKey;
  window.isPublishedDocument = isPublishedDocument;
  window.HTMLReportBoard = HTMLReportBoard;
  window.HTMLReportSettings = HTMLReportSettings;
  window.HTMLReportMermaid = HTMLReportMermaid;
  window.HTMLReportPublisher = HTMLReportPublisher;
  window.HTMLReport = window.HTMLReport || {};
  window.HTMLReport.board = HTMLReportBoard;
}

// Node.js CommonJS exports for unit testing and opt-in authoring plugins
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    STANDARD_DAISYUI_THEMES,
    DAISYUI_THEMES,
    escapeHtml,
    registerCustomTheme,
    scanAndRegisterExistingCustomThemes,
    srgbToLinear,
    linearToSrgb,
    hexToRgb,
    hslToRgb,
    parseColor,
    rgbToOklch,
    autoContrastContent,
    compileTheme,
    tailwindConfigSnippet,
    cssColorToHexAndRgba,
    resolveDaisyUIThemePalette,
    sanitizeMermaidSource,
    renderMermaidWithTheme,
    createThemeSwatchButton,
    initThemeDropdown,
    setReportTheme,
    initTOC,
    checkInsufficientHorizontalSpace,
    buildInlinedHtmlSnapshot,
    exportReportPdf,
    _triggerBlobDownload,
    _authoringStorage,
    initModeBadge,
    initDownloadButton,
    initDayjs,
    initImpress,
    impressNext,
    impressPrev,
    impressGoto,
    initPresentationShell,
    resizePresentationWidgets,
    sanitizeSpeakerNotesHtml,
    initMockjs,
    initShowdown,
    openMarkdownViewer,
    closeMarkdownViewer,
    initFullCalendar,
    initDeclarativeCharts,
    initDeclarativeGridjs,
    initDeclarativeLeaflet,
    rehydrateLucideIcons,
    initDatastarObserver,
    syncDatastarTheme,
    autoLinkMarkdownFiles,
    reinitReportContent,
    initPublicFeeds,
    cleanupPublicFeeds,
    resolveFeedUrl,
    getFeedRegistry,
    extractFeedFields,
    updateFeedCharts,
    mergeFeedSignals,
    syncPwaThemeColor,
    initPwa,
    HTMLReportBoard,
    HTMLReportSettings,
    HTMLReportMermaid,
    HTMLReportPublisher,
    getPageKey,
    isPublishedDocument,
    _getActiveFeedPollers: () => _activeFeedPollers
  };
}
