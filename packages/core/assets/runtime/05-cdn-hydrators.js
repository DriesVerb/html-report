/**
 * Day.js runtime initialization & data-dayjs hydration.
 */
function initDayjs() {
  if (typeof window === "undefined" || !window.dayjs) return;
  try {
    if (window.dayjs_plugin_relativeTime) {
      window.dayjs.extend(window.dayjs_plugin_relativeTime);
    }
    if (window.dayjs_plugin_customParseFormat) {
      window.dayjs.extend(window.dayjs_plugin_customParseFormat);
    }
  } catch (err) {
    console.warn("[html-report] Day.js plugin registration notice:", err);
  }

  try {
    document.querySelectorAll("[data-dayjs]").forEach((el) => {
      const raw = el.getAttribute("data-dayjs");
      const format = el.getAttribute("data-dayjs-format") || "YYYY-MM-DD HH:mm:ss";
      const fromNow = el.hasAttribute("data-dayjs-from-now") || el.getAttribute("data-dayjs-relative") === "true";
      const d = (raw && raw !== "now" && raw !== "true") ? window.dayjs(raw) : window.dayjs();
      if (fromNow && typeof d.fromNow === "function") {
        el.textContent = d.fromNow();
      } else {
        el.textContent = d.format(format);
      }
    });
  } catch (err) {
    console.warn("[html-report] Day.js DOM hydration notice:", err);
  }
}


/**
 * Mock.js runtime initialization & data-mock hydration.
 */
function initMockjs() {
  if (typeof window === "undefined" || !window.Mock) return;
  try {
    document.querySelectorAll("[data-mock]").forEach((el) => {
      if (el.dataset.mockInitialized) return;
      el.dataset.mockInitialized = "true";
      const raw = el.getAttribute("data-mock");
      if (!raw) return;
      try {
        const schema = JSON.parse(raw);
        const data = window.Mock.mock(schema);
        if (el.tagName.toLowerCase() === "code" || el.tagName.toLowerCase() === "pre") {
          el.textContent = JSON.stringify(data, null, 2);
        } else if (el.hasAttribute("data-mock-target")) {
          const target = document.querySelector(el.getAttribute("data-mock-target"));
          if (target) target.textContent = JSON.stringify(data, null, 2);
        }
      } catch (parseErr) {
        const data = window.Mock.mock(raw);
        el.textContent = String(data);
      }
    });
  } catch (err) {
    console.warn("[html-report] Mock.js hydration notice:", err);
  }
}

/**
 * Auto-links any mentioned *.md files in text nodes to interactive viewer triggers.
 */
function autoLinkMarkdownFiles(root = document.body) {
  if (typeof document === "undefined" || !root) return;
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.includes(".md")) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (tag === "a" || tag === "script" || tag === "style" || tag === "button" || tag === "textarea") {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    const mdRegex = /\b([a-zA-Z0-9_\/-]+\.md)\b/g;
    for (const node of nodes) {
      const text = node.nodeValue;
      if (!text || !text.match(mdRegex)) continue;
      const span = document.createElement("span");
      span.innerHTML = text.replace(mdRegex, (match) => {
        return `<a href="${match}" onclick="if(window.openMarkdownViewer){window.openMarkdownViewer('${match}');return false;}" class="link link-primary font-mono text-xs underline decoration-primary/40 hover:decoration-primary cursor-pointer">${match}</a>`;
      });
      node.parentNode.replaceChild(span, node);
    }
  } catch (_) {}
}

/**
 * Showdown runtime initialization & data-showdown hydration.
 */
function initShowdown() {
  if (typeof window === "undefined" || !window.showdown) return;
  try {
    const converter = new window.showdown.Converter({
      tables: true,
      tasklists: true,
      strikethrough: true,
      emoji: true,
      ghCodeBlocks: true
    });
    window.showdownConverter = converter;

    document.querySelectorAll("[data-showdown], [data-markdown-showdown]").forEach((el) => {
      if (el._sdInitialized || el.dataset.sdInitialized) return;
      el._sdInitialized = true;
      el.dataset.sdInitialized = "true";
      const srcSelector = el.getAttribute("data-showdown-source") || el.getAttribute("data-markdown-showdown-source");
      let md = "";
      if (srcSelector) {
        const srcEl = document.querySelector(srcSelector);
        if (srcEl) {
          md = srcEl.value !== undefined ? srcEl.value : srcEl.textContent;
        }
      } else {
        const rawAttr = el.getAttribute("data-markdown-showdown") || el.getAttribute("data-showdown");
        md = (rawAttr && rawAttr !== "true") ? rawAttr : el.textContent;
      }
      if (md) {
        el.innerHTML = converter.makeHtml(md);
      }
    });
  } catch (err) {
    console.warn("[html-report] Showdown markdown rendering notice:", err);
  }
}

/**
 * FullCalendar runtime initialization & DaisyUI theme synchronization.
 */
function initFullCalendar(retries = 25) {
  if (typeof window === "undefined") return;
  const calendarEls = document.querySelectorAll(
    "div[data-fullcalendar], div#calendar, [data-fullcalendar]:not(style):not(head *)"
  );
  if (!calendarEls.length) return;

  if (!window.FullCalendar) {
    if (retries > 0) {
      setTimeout(() => initFullCalendar(retries - 1), 100);
    }
    return;
  }

  window.reportCalendars = window.reportCalendars || [];

  try {
    calendarEls.forEach((el) => {
      if (el.dataset.calendarInitialized || el.tagName === "STYLE" || el.closest("head")) return;
      el.dataset.calendarInitialized = "true";

      let events = [];
      const rawEvents = el.getAttribute("data-calendar-events");
      if (rawEvents) {
        try {
          events = JSON.parse(rawEvents);
        } catch (_) {}
      }

      const calendar = new window.FullCalendar.Calendar(el, {
        initialView: el.getAttribute("data-calendar-view") || "dayGridMonth",
        headerToolbar: {
          left: el.getAttribute("data-calendar-header-left") || "prev,next today",
          center: el.getAttribute("data-calendar-header-center") || "title",
          right: el.getAttribute("data-calendar-header-right") || "dayGridMonth,timeGridWeek,listWeek"
        },
        height: el.getAttribute("data-calendar-height") || "auto",
        contentHeight: "auto",
        dayMaxEvents: true,
        handleWindowResize: true,
        events: events
      });
      calendar.render();
      window.reportCalendars.push(calendar);

      if (typeof ResizeObserver === "function") {
        let lastWidth = el.getBoundingClientRect ? el.getBoundingClientRect().width : 0;
        const ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const nextWidth = entry.contentRect ? entry.contentRect.width : 0;
            if (nextWidth > 0 && Math.abs(nextWidth - lastWidth) > 1) {
              lastWidth = nextWidth;
              try {
                if (typeof calendar.updateSize === "function") calendar.updateSize();
              } catch (_) {}
            } else if (nextWidth === 0) {
              lastWidth = 0;
            }
          }
        });
        ro.observe(el);
      }
    });
    if (typeof syncFullCalendarTheme === "function" && typeof resolveDaisyUIThemePalette === "function") {
      try { syncFullCalendarTheme(resolveDaisyUIThemePalette()); } catch (_) {}
    }
  } catch (err) {
    console.warn("[html-report] FullCalendar initialization notice:", err);
  }
}

/**
 * Fallback CDN mirrors for Lucide UMD in case primary jsDelivr CDN is blocked or slow.
 */
const LUCIDE_FALLBACK_CDNS = [
  "https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/lucide/0.460.0/umd/lucide.min.js"
];
let _lucideFallbackAttempted = false;

/**
 * Ensures Lucide UMD library is available (loading fallback CDN mirrors if needed)
 * and rehydrates all [data-lucide] placeholders in the DOM.
 */
function ensureLucideIcons(root = null) {
  if (typeof window === "undefined") return;
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    rehydrateLucideIcons(root);
    return;
  }
  if (_lucideFallbackAttempted || typeof document === "undefined" || !document.head) return;
  const hasIcons = typeof document.querySelector === "function"
    ? Boolean(document.querySelector(":not(svg)[data-lucide], [data-lucide]"))
    : false;
  if (!hasIcons) return;

  _lucideFallbackAttempted = true;
  const loadMirror = (index) => {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      rehydrateLucideIcons(root);
      return;
    }
    if (index >= LUCIDE_FALLBACK_CDNS.length) return;
    const s = document.createElement("script");
    s.src = LUCIDE_FALLBACK_CDNS[index];
    s.crossOrigin = "anonymous";
    s.async = true;
    s.onload = () => rehydrateLucideIcons(root);
    s.onerror = () => loadMirror(index + 1);
    document.head.appendChild(s);
  };
  loadMirror(0);
}

/**
 * Rehydrates Lucide icons in the DOM.
 */
function rehydrateLucideIcons(root = null) {
  if (typeof window === "undefined" || !window.lucide || typeof window.lucide.createIcons !== "function") return;
  try {
    if (root && root.nodeType === 1) {
      window.lucide.createIcons({ root });
    } else {
      window.lucide.createIcons();
    }
  } catch (err) {
    console.warn("[html-report] Lucide icon rehydration notice:", err);
  }
}

/**
 * Initializes MutationObserver to rehydrate Lucide icons post-morph and handle Datastar signal events.
 */
let _datastarObserverInstance = null;
let _lucideRehydrationTimer = null;

function initDatastarObserver() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return null;
  if (typeof document === "undefined" || !document.body) return null;
  if (_datastarObserverInstance) return _datastarObserverInstance;

  _datastarObserverInstance = new MutationObserver((mutations) => {
    let needsRehydrate = false;
    for (const m of mutations) {
      if (m.type === "childList" && m.addedNodes.length > 0) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            if (node.hasAttribute && node.hasAttribute("data-lucide")) {
              needsRehydrate = true;
              break;
            }
            if (node.querySelector && node.querySelector("[data-lucide]")) {
              needsRehydrate = true;
              break;
            }
          }
        }
      }
      if (needsRehydrate) break;
    }

    if (needsRehydrate) {
      if (_lucideRehydrationTimer) clearTimeout(_lucideRehydrationTimer);
      _lucideRehydrationTimer = setTimeout(() => {
        ensureLucideIcons();
      }, 16);
    }
  });

  _datastarObserverInstance.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also listen for explicit Datastar fragment events if dispatched
  document.addEventListener("datastar-fragment-applied", () => {
    rehydrateLucideIcons();
  });

  return _datastarObserverInstance;
}

/**
 * Synchronizes DaisyUI theme switcher selection with Datastar $theme reactive signal.
 */
function syncDatastarTheme(themeName) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // 1. Dispatch custom event for Datastar signals
  try {
    const evt = new CustomEvent("datastar-merge-signals", {
      bubbles: true,
      detail: { theme: themeName }
    });
    document.dispatchEvent(evt);
  } catch (_) {}

  // 2. Direct API call if Datastar is active on window
  if (window.datastar) {
    if (typeof window.datastar.mergeSignals === "function") {
      try { window.datastar.mergeSignals({ theme: themeName }); } catch (_) {}
    } else if (window.datastar.signals && typeof window.datastar.signals === "object") {
      try { window.datastar.signals.theme = themeName; } catch (_) {}
    }
  }

  // 3. Update DOM signal attributes for initial or bound elements
  try {
    const signalHolders = document.querySelectorAll("[data-signals]");
    signalHolders.forEach((el) => {
      if (el._dsSignals && typeof el._dsSignals === "object") {
        el._dsSignals.theme = themeName;
      }
    });
  } catch (_) {}
}

/**
 * Ensures the built-in Showdown Markdown Viewer modal exists in the DOM.
 */
function ensureMarkdownViewerModal() {
  if (typeof document === "undefined" || !document.body) return null;
  let modal = document.getElementById("markdown-viewer-modal");
  if (modal) return modal;

  modal = document.createElement("dialog");
  modal.id = "markdown-viewer-modal";
  modal.className = "modal modal-bottom sm:modal-middle";
  modal.setAttribute("aria-label", "Markdown Document Viewer");
  modal.innerHTML = [
    '<div class="modal-box max-w-4xl w-11/12 max-h-[88vh] flex flex-col p-0 bg-base-100 text-base-content border border-base-300 shadow-2xl overflow-hidden">',
    '  <div class="flex items-center justify-between px-5 py-3.5 border-b border-base-300 bg-base-200/60 gap-3">',
    '    <div class="min-w-0">',
    '      <h3 id="markdown-modal-title" class="font-bold text-sm sm:text-base font-mono truncate">Document</h3>',
    '      <p class="text-3xs text-base-content/60">Rendered with Showdown Markdown Viewer</p>',
    '    </div>',
    '    <button type="button" id="markdown-modal-close-btn" class="btn btn-sm btn-circle btn-ghost" aria-label="Close">✕</button>',
    '  </div>',
    '  <div id="markdown-modal-content" class="p-5 sm:p-6 overflow-y-auto flex-1 prose prose-sm max-w-none text-base-content/90 leading-relaxed space-y-3"></div>',
    '  <div class="px-5 py-3 border-t border-base-300 bg-base-200/40 flex items-center justify-between gap-2">',
    '    <a id="markdown-modal-raw-link" href="#" target="_blank" rel="noopener noreferrer" class="btn btn-xs btn-ghost font-mono">Open Raw File</a>',
    '    <button type="button" id="markdown-modal-done-btn" class="btn btn-xs sm:btn-sm btn-primary">Close</button>',
    '  </div>',
    '</div>',
    '<form method="dialog" class="modal-backdrop bg-neutral/40"><button>close</button></form>'
  ].join("\n");
  document.body.appendChild(modal);

  const closeBtn = modal.querySelector("#markdown-modal-close-btn");
  const doneBtn = modal.querySelector("#markdown-modal-done-btn");
  if (closeBtn) closeBtn.addEventListener("click", () => closeMarkdownViewer());
  if (doneBtn) doneBtn.addEventListener("click", () => closeMarkdownViewer());
  return modal;
}

/**
 * Resolves markdown source text from embedded artifact maps or HTTP fetch.
 */
async function resolveMarkdownArtifact(docPath) {
  const key = String(docPath || "").trim();
  const base = key.split("/").pop();
  const sources = [];
  if (typeof window !== "undefined") {
    if (window.MARKDOWN_ARTIFACTS && typeof window.MARKDOWN_ARTIFACTS === "object") {
      sources.push(window.MARKDOWN_ARTIFACTS);
    }
    if (window.OPEN_SPEC_ARTIFACTS && typeof window.OPEN_SPEC_ARTIFACTS === "object") {
      sources.push(window.OPEN_SPEC_ARTIFACTS);
    }
  }
  if (typeof document !== "undefined") {
    for (const scriptId of ["markdown-artifacts-data", "open-spec-artifacts-data"]) {
      const el = document.getElementById(scriptId);
      if (el && el.textContent) {
        try { sources.push(JSON.parse(el.textContent)); } catch (_) {}
      }
    }
  }
  for (const map of sources) {
    if (typeof map[key] === "string") return map[key];
    if (base && typeof map[base] === "string") return map[base];
  }

  const proto = typeof window !== "undefined" && window.location ? window.location.protocol : "";
  if ((proto === "http:" || proto === "https:") && typeof fetch === "function" && key) {
    const cleanRel = key.replace(/^\/+/, "");
    const candidates = [key, "/" + cleanRel];
    if (base && base !== cleanRel) candidates.push(base);
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          return await res.text();
        }
      } catch (_) {}
    }
  }

  return `# ${key || "Document"}\n\nPreview is unavailable offline under \`file://\` without embedded artifacts.\n\nOpen the source file directly: [${key}](${key})`;
}

/**
 * Closes the Showdown Markdown Viewer modal.
 */
function closeMarkdownViewer() {
  if (typeof document === "undefined") return;
  const modal = document.getElementById("markdown-viewer-modal");
  if (!modal) return;
  if (typeof modal.close === "function" && modal.open) {
    modal.close();
  } else {
    modal.removeAttribute("open");
  }
}

/**
 * Opens the Showdown Markdown Viewer modal for a given markdown path or artifact key.
 */
async function openMarkdownViewer(docPath) {
  if (typeof document === "undefined") return null;
  const targetDoc = String(docPath || "").trim() || "README.md";
  const modal = ensureMarkdownViewerModal();
  if (!modal) return null;

  const titleEl = document.getElementById("markdown-modal-title");
  if (titleEl) titleEl.textContent = targetDoc;
  const rawLink = document.getElementById("markdown-modal-raw-link");
  if (rawLink) rawLink.setAttribute("href", targetDoc);

  if (typeof modal.showModal === "function") {
    if (!modal.open) modal.showModal();
  } else {
    modal.setAttribute("open", "true");
  }

  const contentEl =
    document.getElementById("markdown-modal-content") ||
    document.getElementById("markdown-modal-body") ||
    document.getElementById("modal-markdown-body");

  if (contentEl) {
    contentEl.innerHTML = '<div class="flex items-center gap-2 text-xs opacity-70 py-6"><span class="loading loading-spinner loading-sm text-primary"></span><span>Loading document...</span></div>';
  }

  const markdown = await resolveMarkdownArtifact(targetDoc);
  let rendered = "";
  if (typeof window !== "undefined" && window.showdownConverter && typeof window.showdownConverter.makeHtml === "function") {
    rendered = window.showdownConverter.makeHtml(markdown);
  } else if (typeof window !== "undefined" && window.showdown && typeof window.showdown.Converter === "function") {
    const conv = new window.showdown.Converter({
      tables: true,
      tasklists: true,
      strikethrough: true,
      emoji: true,
      ghCodeBlocks: true
    });
    window.showdownConverter = conv;
    rendered = conv.makeHtml(markdown);
  } else if (typeof window !== "undefined" && window.marked && typeof window.marked.parse === "function") {
    rendered = window.marked.parse(markdown);
  } else {
    rendered = `<pre class="whitespace-pre-wrap text-xs font-mono bg-base-200 p-4 rounded-lg overflow-x-auto">${escapeHtml(markdown)}</pre>`;
  }

  if (contentEl) {
    contentEl.innerHTML = rendered;
  }
  try { rehydrateLucideIcons(modal); } catch (_) {}
  return modal;
}


