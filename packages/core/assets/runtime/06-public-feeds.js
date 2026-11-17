// =============================================================================
// Declarative Public Feeds & Signal Bus
// =============================================================================

let _activeFeedPollers = [];

/**
 * Parses and returns the Nickname Registry from <script id="feed-registry">.
 */
function getFeedRegistry(root) {
  const doc = (root && typeof root.querySelector === "function")
    ? root
    : (root && root.ownerDocument ? root.ownerDocument : (typeof document !== "undefined" ? document : null));
  if (!doc) return {};
  const script = doc.querySelector("script#feed-registry[type='application/json'], script#feed-registry");
  if (!script || !script.textContent) return {};
  try {
    return JSON.parse(script.textContent);
  } catch (err) {
    console.warn("[html-report] Failed to parse #feed-registry JSON:", err);
    return {};
  }
}

/**
 * Resolves a raw feed reference (either @nickname or direct URL).
 */
function resolveFeedUrl(rawFeed, registry = {}) {
  if (!rawFeed || typeof rawFeed !== "string") {
    return { url: null, error: "Empty feed declaration", nickname: null };
  }
  const trimmed = rawFeed.trim();
  if (trimmed.startsWith("@")) {
    const nickname = trimmed.slice(1);
    const resolved = registry[nickname];
    if (!resolved) {
      const msg = `Unknown feed nickname: @${nickname}`;
      console.warn(`[html-report] ${msg}`);
      return { url: null, error: msg, nickname };
    }
    return { url: resolved, nickname, error: null };
  }
  return { url: trimmed, nickname: null, error: null };
}

/**
 * Extracts specified top-level or dot-notated nested fields from JSON payload.
 */
function extractFeedFields(payload, fieldsAttr, prefix = "") {
  const result = {};
  if (payload === null || payload === undefined) {
    return result;
  }
  if (typeof payload !== "object") {
    const key = prefix ? `${prefix}val` : "val";
    result[key] = payload;
    return result;
  }

  if (fieldsAttr && typeof fieldsAttr === "string" && fieldsAttr.trim()) {
    const fields = fieldsAttr.split(",").map((s) => s.trim()).filter(Boolean);
    for (const field of fields) {
      const parts = field.split(".");
      let current = payload;
      let found = true;
      for (const p of parts) {
        if (current !== null && typeof current === "object" && p in current) {
          current = current[p];
        } else {
          found = false;
          break;
        }
      }
      if (found) {
        const keyName = prefix + field.replace(/\./g, "_");
        result[keyName] = current;
      }
    }
  } else {
    // Default: extract all top-level keys
    for (const [k, v] of Object.entries(payload)) {
      const keyName = prefix + k.replace(/\./g, "_");
      result[keyName] = v;
    }
  }
  return result;
}

/**
 * Dispatches Datastar signal updates to the document and runtime window.
 */
function mergeFeedSignals(signalsObj) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!signalsObj || Object.keys(signalsObj).length === 0) return;

  try {
    const evt = new CustomEvent("datastar-merge-signals", {
      bubbles: true,
      detail: signalsObj
    });
    document.dispatchEvent(evt);
  } catch (_) {}

  if (window.datastar) {
    if (typeof window.datastar.mergeSignals === "function") {
      try { window.datastar.mergeSignals(signalsObj); } catch (_) {}
    } else if (window.datastar.signals && typeof window.datastar.signals === "object") {
      try { Object.assign(window.datastar.signals, signalsObj); } catch (_) {}
    }
  }

  try {
    const signalHolders = document.querySelectorAll("[data-signals]");
    signalHolders.forEach((el) => {
      if (el._dsSignals && typeof el._dsSignals === "object") {
        Object.assign(el._dsSignals, signalsObj);
      }
    });
  } catch (_) {}
}

/**
 * Updates Chart.js canvases tagged with [data-feed-chart].
 */
function updateFeedCharts(signals, timestamp = Date.now()) {
  if (typeof document === "undefined" || !signals || typeof signals !== "object") return;
  const chartCanvases = document.querySelectorAll("canvas[data-feed-chart]");
  chartCanvases.forEach((canvas) => {
    const signalKey = canvas.getAttribute("data-feed-chart");
    if (!signalKey || signals[signalKey] === undefined) return;
    const rawVal = signals[signalKey];
    const numVal = Number(rawVal);
    if (isNaN(numVal)) return;

    const bufferMax = parseInt(canvas.getAttribute("data-feed-buffer") || "20", 10) || 20;

    // Resolve chart instance
    let chart = null;
    if (typeof window !== "undefined") {
      if (window.Chart && typeof window.Chart.getChart === "function") {
        chart = window.Chart.getChart(canvas);
      }
      if (!chart && canvas._chart) chart = canvas._chart;
      if (!chart && canvas.chart) chart = canvas.chart;
      if (!chart && window.reportCharts && Array.isArray(window.reportCharts)) {
        chart = window.reportCharts.find((c) => c && (c.canvas === canvas || c === canvas._chart));
      }
    }

    if (chart && chart.data && chart.data.datasets && chart.data.datasets[0]) {
      const d = new Date(timestamp);
      const timeLabel = d.toTimeString().split(" ")[0]; // HH:MM:SS
      if (!chart.data.labels) chart.data.labels = [];
      chart.data.labels.push(timeLabel);
      if (!chart.data.datasets[0].data) chart.data.datasets[0].data = [];
      chart.data.datasets[0].data.push(numVal);

      while (chart.data.labels.length > bufferMax) {
        chart.data.labels.shift();
      }
      while (chart.data.datasets[0].data.length > bufferMax) {
        chart.data.datasets[0].data.shift();
      }

      if (typeof chart.update === "function") {
        chart.update("none");
      }
    }
  });
}

/**
 * Stops all active polling intervals and aborts in-flight network requests.
 */
function cleanupPublicFeeds() {
  if (_activeFeedPollers && _activeFeedPollers.length > 0) {
    for (const poller of _activeFeedPollers) {
      if (poller.timerId) {
        clearInterval(poller.timerId);
      }
      if (poller.abortController) {
        try { poller.abortController.abort(); } catch (_) {}
      }
    }
    _activeFeedPollers = [];
  }
}

/**
 * Discovers and initializes all declarative public feed bindings.
 */
function initPublicFeeds(rootElement) {
  if (typeof document === "undefined") return [];
  const root = rootElement || document;

  cleanupPublicFeeds();

  const feedElements = Array.from(root.querySelectorAll("[data-public-feed]"));
  if (feedElements.length === 0) return [];

  const registry = getFeedRegistry(root);
  const isOfflineOrPdf = (typeof window !== "undefined" && (window.__PLAYWRIGHT_PDF_MODE__ || (typeof navigator !== "undefined" && navigator.onLine === false)));

  // 1. Process fallback data if present
  for (const el of feedElements) {
    const fallbackStr = el.getAttribute("data-feed-fallback");
    if (fallbackStr) {
      try {
        const fallbackData = JSON.parse(fallbackStr);
        const fields = el.getAttribute("data-feed-fields");
        const prefix = el.getAttribute("data-feed-prefix") || "";
        const signals = extractFeedFields(fallbackData, fields, prefix);
        mergeFeedSignals(signals);
        updateFeedCharts(signals, Date.now());
      } catch (e) {
        console.warn("[html-report] Invalid data-feed-fallback JSON:", e);
      }
    }
  }

  if (isOfflineOrPdf) {
    return feedElements;
  }

  // 2. Group by resolved URL & interval for request deduplication
  const groups = new Map();

  for (const el of feedElements) {
    const rawFeed = el.getAttribute("data-public-feed");
    const { url, nickname, error } = resolveFeedUrl(rawFeed, registry);

    if (error) {
      mergeFeedSignals({ feed_error: error });
      continue;
    }

    const intervalAttr = el.getAttribute("data-feed-interval");
    const parsedInterval = intervalAttr ? parseInt(intervalAttr, 10) : 60000;
    const minGuard = (typeof window !== "undefined" && window.__FEED_MIN_INTERVAL__ !== undefined) ? window.__FEED_MIN_INTERVAL__ : 10000;
    const interval = Math.max(minGuard, isNaN(parsedInterval) ? 60000 : parsedInterval);

    const groupKey = `${url}::${interval}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        url,
        interval,
        subscribers: []
      });
    }

    groups.get(groupKey).subscribers.push({
      el,
      nickname,
      url,
      fields: el.getAttribute("data-feed-fields"),
      prefix: el.getAttribute("data-feed-prefix") || ""
    });
  }

  // 3. Initiate single fetch and periodic poller for each unique group
  for (const [groupKey, group] of groups.entries()) {
    const abortController = typeof AbortController !== "undefined" ? new AbortController() : null;
    const pollerRecord = {
      groupKey,
      url: group.url,
      interval: group.interval,
      abortController,
      timerId: null,
      subscribers: group.subscribers
    };

    const executeFetch = async () => {
      if (pollerRecord.abortController && pollerRecord.abortController.signal.aborted) return;
      try {
        const fetchOptions = pollerRecord.abortController ? { signal: pollerRecord.abortController.signal } : {};
        const response = await fetch(group.url, fetchOptions);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const timestamp = Date.now();
        const combinedSignals = {};

        for (const sub of group.subscribers) {
          const signals = extractFeedFields(data, sub.fields, sub.prefix);
          Object.assign(combinedSignals, signals);
        }

        mergeFeedSignals(combinedSignals);
        updateFeedCharts(combinedSignals, timestamp);

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("feed:tick", {
            detail: {
              feedId: group.subscribers[0].nickname ? `@${group.subscribers[0].nickname}` : group.url,
              url: group.url,
              data,
              signals: combinedSignals,
              timestamp
            }
          }));
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        console.warn(`[html-report] Feed fetch failed for ${group.url}:`, err);
        mergeFeedSignals({ feed_error: err.message || "Fetch failed" });
      }
    };

    // Immediate initial fetch
    executeFetch();

    // Schedule interval
    pollerRecord.timerId = setInterval(executeFetch, group.interval);
    _activeFeedPollers.push(pollerRecord);
  }

  return feedElements;
}


/**
 * Re-runs content-level hydration after <main> was hot-swapped in place by the
 * live-reload dev server (no full page reload, so theme + scroll are preserved).
 * Only touches content hooks; navbar/theme/download wiring stays as-is.
 */
async function reinitReportContent() {
  if (typeof document === "undefined") return;
  try { cleanupPublicFeeds(); } catch (_) {}
  try { ensureLucideIcons(); } catch (_) {}
  try { initTOC(); } catch (_) {}
  try { if (window.hljs && typeof window.hljs.highlightAll === "function") window.hljs.highlightAll(); } catch (_) {}
  try { initDayjs(); } catch (_) {}
  try { autoLinkMarkdownFiles(); } catch (_) {}
  try { await renderMermaidWithTheme(resolveDaisyUIThemePalette()); } catch (_) {}
  try { if (typeof HTMLReportMermaid !== "undefined") HTMLReportMermaid.initEnlarge(); } catch (_) {}
  try { checkInsufficientHorizontalSpace(); } catch (_) {}
  try { initPresentationShell(); } catch (_) {}
  try { initPublicFeeds(); } catch (_) {}
}

