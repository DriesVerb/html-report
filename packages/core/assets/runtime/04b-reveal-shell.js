/**
 * Sanitizes speaker notes HTML (<aside class="notes">) so rich formatting
 * (<p>, <ul>, <ol>, <li>, <strong>, <em>, <code>) is preserved safely.
 */
function sanitizeSpeakerNotesHtml(rawHtml = "") {
  if (typeof document === "undefined") return String(rawHtml || "");
  const tpl = document.createElement("template");
  tpl.innerHTML = String(rawHtml || "");
  const blockedTags = tpl.content.querySelectorAll("script, style, iframe, object, embed, link, meta, base, form");
  blockedTags.forEach((el) => el.remove());
  const all = tpl.content.querySelectorAll("*");
  all.forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const val = String(attr.value || "").trim();
      if (name.startsWith("on") || name === "srcdoc") {
        el.removeAttribute(attr.name);
      } else if ((name === "href" || name === "src" || name === "xlink:href") && /^(?:javascript|vbscript|data\s*:\s*text\/html):/i.test(val)) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return tpl.innerHTML.trim();
}

/**
 * Re-measures Reveal.js layout, Chart.js canvases, and Leaflet maps after
 * slide transitions, fullscreen changes, or stacked-view toggles.
 */
function resizePresentationWidgets() {
  if (typeof window === "undefined") return;
  try {
    if (window.revealInstance && typeof window.revealInstance.layout === "function") {
      window.revealInstance.layout();
    }
  } catch (_) {}
  try {
    if (Array.isArray(window.reportCharts)) {
      window.reportCharts.forEach((c) => {
        try { if (c && typeof c.resize === "function") c.resize(); } catch (_) {}
      });
    }
    if (window.Chart && window.Chart.instances) {
      const list = Array.isArray(window.Chart.instances)
        ? window.Chart.instances
        : Object.values(window.Chart.instances);
      list.forEach((c) => {
        try { if (c && typeof c.resize === "function") c.resize(); } catch (_) {}
      });
    }
  } catch (_) {}
  try {
    if (window.__htmlReportLeafletMaps && typeof window.__htmlReportLeafletMaps.forEach === "function") {
      window.__htmlReportLeafletMaps.forEach((m) => {
        try { if (m && typeof m.invalidateSize === "function") m.invalidateSize({ animate: false }); } catch (_) {}
      });
    }
    if (Array.isArray(window.reportMaps)) {
      window.reportMaps.forEach((m) => {
        try { if (m && typeof m.invalidateSize === "function") m.invalidateSize({ animate: false }); } catch (_) {}
      });
    }
    if (window.leafletMap && typeof window.leafletMap.invalidateSize === "function") {
      window.leafletMap.invalidateSize({ animate: false });
    }
  } catch (_) {}
  try {
    window.dispatchEvent(new Event("resize"));
  } catch (_) {}
}

function registerLeafletInitHook() {
  if (typeof window === "undefined" || window.__htmlReportLeafletHooked) return;
  if (window.L && window.L.Map && typeof window.L.Map.addInitHook === "function") {
    window.__htmlReportLeafletHooked = true;
    window.L.Map.addInitHook(function () {
      window.__htmlReportLeafletMaps = window.__htmlReportLeafletMaps || new Set();
      window.__htmlReportLeafletMaps.add(this);
    });
  }
}

function extractSlideLabel(sectionEl, fallbackLabel = "Slide") {
  if (!sectionEl) return fallbackLabel;
  const explicit = sectionEl.getAttribute("data-title");
  if (explicit && explicit.trim()) return explicit.trim();
  const heading = sectionEl.querySelector("h1, h2, h3, [data-slide-title]");
  if (heading && heading.textContent && heading.textContent.trim()) {
    return heading.textContent.trim().replace(/\s+/g, " ");
  }
  return fallbackLabel;
}

function extractSlideNotesHtml(sectionEl) {
  if (!sectionEl) return { hasNotes: false, html: "" };
  const asideNotes = Array.from(sectionEl.querySelectorAll(":scope > aside.notes, :scope > .slide-body > aside.notes, aside.notes"))
    .filter((el) => el.closest("section") === sectionEl);
  if (asideNotes.length > 0) {
    const combined = asideNotes
      .map((el) => sanitizeSpeakerNotesHtml(el.innerHTML))
      .filter(Boolean)
      .join("<hr class=\"my-2 border-base-300\" />");
    if (combined) {
      return { hasNotes: true, html: combined };
    }
  }
  const attrNotes = sectionEl.getAttribute("data-notes");
  if (attrNotes && attrNotes.trim()) {
    return { hasNotes: true, html: `<p>${escapeHtml(attrNotes.trim())}</p>` };
  }
  return { hasNotes: false, html: "" };
}

function getLeafSlides(deckEl) {
  if (!deckEl) return [];
  const all = Array.from(deckEl.querySelectorAll(".slides section"));
  return all.filter((sec) => !sec.querySelector(":scope > section"));
}

/**
 * Initializes #presentation-shell, Reveal.js embedded runtime, Fullscreen mode,
 * modeless Follow-Along Speaker Notes popup (#presentation-notes-modal),
 * Stacked view toggle, and widget resize hooks.
 */
function initPresentationShell(retries = 25) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  registerLeafletInitHook();

  const deckEl = document.querySelector("#report-main .reveal, .reveal#presentation-deck, .reveal");
  if (!deckEl) return;

  // 1. Ensure #presentation-shell wraps toolbar + .reveal-stage
  let stageEl = deckEl.closest(".reveal-stage");
  if (!stageEl) {
    stageEl = document.createElement("div");
    stageEl.className = "reveal-stage";
    deckEl.parentNode.insertBefore(stageEl, deckEl);
    stageEl.appendChild(deckEl);
  }

  let shell = stageEl.closest("#presentation-shell");
  if (!shell) {
    shell = document.createElement("div");
    shell.id = "presentation-shell";
    stageEl.parentNode.insertBefore(shell, stageEl);
    const maybeToolbar = shell.previousElementSibling;
    if (maybeToolbar && maybeToolbar.classList.contains("presentation-toolbar")) {
      shell.appendChild(maybeToolbar);
    }
    shell.appendChild(stageEl);
  }

  // Ensure a presentation toolbar exists if fragment omitted it
  let toolbar = shell.querySelector(".presentation-toolbar");
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.className = "presentation-toolbar flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-base-100 border border-base-300 rounded-box shadow-sm print:hidden";
    toolbar.innerHTML = `
      <div class="flex items-center gap-2 text-xs text-base-content/75 font-mono">
        <span class="badge badge-primary badge-outline badge-xs font-mono">Slides</span>
        <span id="presentation-toolbar-counter">1 / 1</span>
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <button id="presentation-notes-btn" type="button" class="btn btn-xs btn-ghost border border-base-300 gap-1.5" title="Toggle Follow-Along Speaker Notes (N)" aria-pressed="false">
          <span>Notes</span>
          <kbd class="kbd kbd-xs font-mono hidden sm:inline-flex">N</kbd>
          <span id="presentation-notes-dot" class="hidden w-2 h-2 rounded-full bg-primary" aria-hidden="true"></span>
        </button>
        <button id="presentation-stack-btn" type="button" class="btn btn-xs btn-ghost border border-base-300 gap-1.5" title="Toggle Stacked All-Slides View" aria-pressed="false">
          <span>All Slides</span>
        </button>
        <button id="presentation-fullscreen-btn" type="button" class="btn btn-xs btn-primary gap-1.5" title="Enter Fullscreen Presentation (F)" aria-pressed="false">
          <span>Fullscreen</span>
          <kbd class="kbd kbd-xs bg-primary-content/20 text-primary-content border-none font-mono hidden sm:inline-flex">F</kbd>
        </button>
      </div>
    `;
    shell.insertBefore(toolbar, stageEl);
  }

  // Ensure compact Fullscreen mini-HUD exists inside #presentation-shell
  let fsHud = document.getElementById("presentation-fullscreen-hud");
  if (!fsHud) {
    fsHud = document.createElement("div");
    fsHud.id = "presentation-fullscreen-hud";
    fsHud.setAttribute("aria-label", "Fullscreen Presentation Controls");
    fsHud.innerHTML = `
      <button id="presentation-hud-prev" type="button" class="btn btn-ghost btn-xs btn-circle" title="Previous slide" aria-label="Previous slide">&larr;</button>
      <span id="presentation-hud-counter" class="text-xs font-mono font-semibold px-1.5 tabular-nums">1 / 1</span>
      <button id="presentation-hud-next" type="button" class="btn btn-ghost btn-xs btn-circle" title="Next slide" aria-label="Next slide">&rarr;</button>
      <button id="presentation-hud-notes" type="button" class="btn btn-ghost btn-xs gap-1" title="Toggle Speaker Notes (N)">Notes</button>
      <button id="presentation-hud-exit" type="button" class="btn btn-outline btn-xs" title="Exit Fullscreen (F / Esc)">Exit</button>
    `;
    shell.appendChild(fsHud);
  }

  // Ensure modeless Follow-Along Speaker Notes popup modal exists inside #presentation-shell
  let notesModal = document.getElementById("presentation-notes-modal");
  if (!notesModal) {
    notesModal = document.createElement("aside");
    notesModal.id = "presentation-notes-modal";
    notesModal.className = "hidden print:hidden";
    notesModal.setAttribute("role", "dialog");
    notesModal.setAttribute("aria-modal", "false");
    notesModal.setAttribute("aria-labelledby", "presentation-notes-title");
    notesModal.setAttribute("data-dock", "bottom-right");
    notesModal.setAttribute("data-notes-size", "md");
    notesModal.innerHTML = `
      <div class="px-3 py-2 bg-base-200/90 border-b border-base-300 flex items-center justify-between gap-2 shrink-0">
        <div class="min-w-0 flex items-center gap-2">
          <span id="presentation-notes-badge" class="badge badge-primary badge-xs font-mono shrink-0">1</span>
          <h3 id="presentation-notes-title" class="text-xs font-bold truncate">Speaker Notes</h3>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button id="presentation-notes-size-btn" type="button" class="btn btn-ghost btn-xs font-mono px-1.5 h-6 min-h-0" title="Toggle notes text size">Aa</button>
          <select id="presentation-notes-dock-select" class="select select-bordered select-xs h-6 min-h-0 text-[11px] font-mono" aria-label="Notes popup dock position" title="Dock position">
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="side-right">Side Right</option>
          </select>
          <button id="presentation-notes-close-btn" type="button" class="btn btn-ghost btn-xs btn-circle h-6 min-h-0 w-6" aria-label="Close speaker notes" title="Close (N / Esc)">&times;</button>
        </div>
      </div>
      <div id="presentation-notes-body" class="p-3 overflow-y-auto flex-1 leading-relaxed text-base-content/90 space-y-2">
        <p class="text-xs italic opacity-60">No speaker notes for this slide.</p>
      </div>
      <div class="px-3 py-2 bg-base-200/70 border-t border-base-300 flex items-center justify-between gap-2 text-xs shrink-0">
        <div id="presentation-notes-upnext" class="truncate text-base-content/70 font-medium">Up Next: —</div>
        <div class="flex items-center gap-1 shrink-0">
          <button id="presentation-notes-prev" type="button" class="btn btn-ghost btn-xs border border-base-300 h-6 min-h-0 px-2" title="Previous slide">Prev</button>
          <button id="presentation-notes-next" type="button" class="btn btn-primary btn-xs h-6 min-h-0 px-2" title="Next slide">Next</button>
        </div>
      </div>
    `;
    shell.appendChild(notesModal);
  }

  // Wait for Reveal.js CDN if still loading
  if (!window.Reveal) {
    if (retries > 0) {
      setTimeout(() => initPresentationShell(retries - 1), 120);
    }
    return;
  }

  const updatePresenterUI = () => {
    const deck = window.revealInstance;
    const leafSlides = getLeafSlides(deckEl);
    const total = Math.max(1, leafSlides.length);
    let currentSlide = null;
    let indices = { h: 0, v: 0 };
    try {
      if (deck && typeof deck.getCurrentSlide === "function") {
        currentSlide = deck.getCurrentSlide();
      }
      if (deck && typeof deck.getIndices === "function") {
        indices = deck.getIndices() || { h: 0, v: 0 };
      }
    } catch (_) {}
    if (!currentSlide && leafSlides.length > 0) {
      currentSlide = leafSlides[0];
    }

    const leafIdx = currentSlide ? Math.max(0, leafSlides.indexOf(currentSlide)) : 0;
    const slideNumberLabel = indices.v > 0 ? `${(indices.h || 0) + 1}.${indices.v + 1}` : `${(indices.h || 0) + 1}`;
    const counterText = `${leafIdx + 1} / ${total}`;

    const toolbarCounter = document.getElementById("presentation-toolbar-counter");
    if (toolbarCounter) toolbarCounter.textContent = counterText;
    const hudCounter = document.getElementById("presentation-hud-counter");
    if (hudCounter) hudCounter.textContent = counterText;

    const slideTitle = extractSlideLabel(currentSlide, `Slide ${slideNumberLabel}`);
    const { hasNotes, html: notesHtml } = extractSlideNotesHtml(currentSlide);

    const notesDot = document.getElementById("presentation-notes-dot");
    if (notesDot) notesDot.classList.toggle("hidden", !hasNotes);

    const notesBadge = document.getElementById("presentation-notes-badge");
    if (notesBadge) notesBadge.textContent = slideNumberLabel;
    const notesTitleEl = document.getElementById("presentation-notes-title");
    if (notesTitleEl) notesTitleEl.textContent = slideTitle;

    const notesBody = document.getElementById("presentation-notes-body");
    if (notesBody) {
      notesBody.innerHTML = hasNotes
        ? notesHtml
        : `<p class="text-xs italic opacity-60">No speaker notes for this slide.</p>`;
    }

    const upNextEl = document.getElementById("presentation-notes-upnext");
    if (upNextEl) {
      const nextLeaf = leafIdx + 1 < leafSlides.length ? leafSlides[leafIdx + 1] : null;
      upNextEl.textContent = nextLeaf
        ? `Up Next: ${extractSlideLabel(nextLeaf, `Slide ${leafIdx + 2}`)}`
        : "Up Next: End of Deck";
    }
  };

  const isNativeFullscreen = () => Boolean(document.fullscreenElement === shell || document.webkitFullscreenElement === shell);
  const isAnyFullscreen = () => isNativeFullscreen() || shell.classList.contains("is-fullscreen");

  const syncFullscreenButtons = () => {
    const active = isAnyFullscreen();
    const fsBtn = document.getElementById("presentation-fullscreen-btn");
    if (fsBtn) {
      fsBtn.setAttribute("aria-pressed", active ? "true" : "false");
      const labelSpan = fsBtn.querySelector("span");
      if (labelSpan) labelSpan.textContent = active ? "Exit Fullscreen" : "Fullscreen";
    }
  };

  const enterFullscreen = async () => {
    if (shell.classList.contains("is-stacked")) {
      setStackedMode(false);
    }
    const reqFs = shell.requestFullscreen || shell.webkitRequestFullscreen;
    let enteredNative = false;
    if (typeof reqFs === "function") {
      try {
        await reqFs.call(shell);
        enteredNative = isNativeFullscreen();
      } catch (_) {
        enteredNative = false;
      }
    }
    if (!enteredNative) {
      shell.classList.add("is-fullscreen");
    }
    syncFullscreenButtons();
    setTimeout(() => resizePresentationWidgets(), 60);
  };

  const exitFullscreen = async () => {
    shell.classList.remove("is-fullscreen");
    if (isNativeFullscreen()) {
      const exitFs = document.exitFullscreen || document.webkitExitFullscreen;
      if (typeof exitFs === "function") {
        try { await exitFs.call(document); } catch (_) {}
      }
    }
    syncFullscreenButtons();
    setTimeout(() => resizePresentationWidgets(), 60);
  };

  const toggleFullscreen = async () => {
    if (isAnyFullscreen()) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  };

  const setNotesOpen = (open) => {
    notesModal.classList.toggle("hidden", !open);
    const notesBtn = document.getElementById("presentation-notes-btn");
    if (notesBtn) notesBtn.setAttribute("aria-pressed", open ? "true" : "false");
    if (open) updatePresenterUI();
  };

  const toggleNotes = () => {
    setNotesOpen(notesModal.classList.contains("hidden"));
  };

  const setStackedMode = (stacked) => {
    shell.classList.toggle("is-stacked", Boolean(stacked));
    stageEl.classList.toggle("is-stacked", Boolean(stacked));
    const stackBtn = document.getElementById("presentation-stack-btn");
    if (stackBtn) {
      stackBtn.setAttribute("aria-pressed", stacked ? "true" : "false");
      stackBtn.classList.toggle("btn-active", Boolean(stacked));
    }
    setTimeout(() => resizePresentationWidgets(), 60);
  };

  if (!shell.dataset.presentationBound) {
    shell.dataset.presentationBound = "true";

    document.getElementById("presentation-fullscreen-btn")?.addEventListener("click", () => toggleFullscreen());
    document.getElementById("presentation-hud-exit")?.addEventListener("click", () => exitFullscreen());
    document.getElementById("presentation-notes-btn")?.addEventListener("click", () => toggleNotes());
    document.getElementById("presentation-hud-notes")?.addEventListener("click", () => toggleNotes());
    document.getElementById("presentation-notes-close-btn")?.addEventListener("click", () => setNotesOpen(false));
    document.getElementById("presentation-stack-btn")?.addEventListener("click", () => {
      setStackedMode(!shell.classList.contains("is-stacked"));
    });

    const goPrev = () => { try { window.revealInstance?.prev?.(); } catch (_) {} };
    const goNext = () => { try { window.revealInstance?.next?.(); } catch (_) {} };
    document.getElementById("presentation-hud-prev")?.addEventListener("click", goPrev);
    document.getElementById("presentation-hud-next")?.addEventListener("click", goNext);
    document.getElementById("presentation-notes-prev")?.addEventListener("click", goPrev);
    document.getElementById("presentation-notes-next")?.addEventListener("click", goNext);

    const sizes = ["sm", "md", "lg"];
    document.getElementById("presentation-notes-size-btn")?.addEventListener("click", () => {
      const cur = notesModal.getAttribute("data-notes-size") || "md";
      const next = sizes[(sizes.indexOf(cur) + 1) % sizes.length];
      notesModal.setAttribute("data-notes-size", next);
    });

    document.getElementById("presentation-notes-dock-select")?.addEventListener("change", (e) => {
      notesModal.setAttribute("data-dock", e.target.value || "bottom-right");
    });

    document.addEventListener("fullscreenchange", () => {
      if (!isNativeFullscreen()) {
        shell.classList.remove("is-fullscreen");
      }
      syncFullscreenButtons();
      setTimeout(() => resizePresentationWidgets(), 60);
    });
    document.addEventListener("webkitfullscreenchange", () => {
      if (!isNativeFullscreen()) {
        shell.classList.remove("is-fullscreen");
      }
      syncFullscreenButtons();
      setTimeout(() => resizePresentationWidgets(), 60);
    });

    if (!window._presentationKeydownBound) {
      window._presentationKeydownBound = true;
      document.addEventListener("keydown", (e) => {
        const active = document.activeElement;
        const inEditable = Boolean(
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.tagName === "SELECT" ||
            active.isContentEditable ||
            active.closest?.(".ql-editor"))
        );

        if (e.key === "Escape") {
          const blockingModalOpen = Boolean(
            document.getElementById("all-settings-modal")?.open ||
            document.getElementById("markdown-viewer-modal")?.open ||
            document.getElementById("mermaid-enlarge-modal")?.open ||
            document.getElementById("pdf-not-ready-modal")?.open ||
            document.getElementById("agent-reconnect-modal")?.open
          );
          if (blockingModalOpen) return;
          if (!notesModal.classList.contains("hidden")) {
            setNotesOpen(false);
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
            return;
          }
          if (shell.classList.contains("is-fullscreen")) {
            exitFullscreen();
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
          }
          return;
        }

        if (inEditable || e.ctrlKey || e.metaKey || e.altKey) return;
        const key = String(e.key || "").toLowerCase();
        if (key === "f") {
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
          toggleFullscreen();
        } else if (key === "n") {
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
          toggleNotes();
        }
      }, true);
    }
  }

  // Initialize Reveal.js once per deck element
  if (!deckEl.dataset.revealInitialized) {
    deckEl.dataset.revealInitialized = "true";
    const revealConfig = {
      embedded: true,
      disableLayout: true,
      hash: false,
      keyboard: {
        70: null,
        78: null
      },
      controls: true,
      progress: true,
      slideNumber: "c/t",
      center: false,
      transition: "slide"
    };
    try {
      const useSingleton = document.querySelectorAll(".reveal").length <= 1 && typeof window.Reveal.initialize === "function";
      const deck = useSingleton
        ? window.Reveal
        : (typeof window.Reveal === "function" ? new window.Reveal(deckEl, revealConfig) : window.Reveal);
      window.revealInstance = deck;
      window.revealDeck = deck;

      if (typeof deck.on === "function") {
        deck.on("ready", () => {
          updatePresenterUI();
          setTimeout(() => resizePresentationWidgets(), 50);
        });
        deck.on("slidechanged", () => {
          updatePresenterUI();
          setTimeout(() => resizePresentationWidgets(), 50);
        });
      }

      const initPromise = typeof deck.initialize === "function"
        ? deck.initialize(revealConfig)
        : Promise.resolve();
      Promise.resolve(initPromise).then(() => {
        updatePresenterUI();
        setTimeout(() => resizePresentationWidgets(), 60);
      }).catch((err) => {
        console.warn("[html-report] Reveal.js initialization notice:", err);
      });
    } catch (err) {
      console.warn("[html-report] Reveal.js initialization notice:", err);
    }
  } else {
    updatePresenterUI();
    resizePresentationWidgets();
  }

  window.presentationToggleFullscreen = toggleFullscreen;
  window.presentationToggleNotes = toggleNotes;
  window.presentationToggleStacked = () => setStackedMode(!shell.classList.contains("is-stacked"));
}

