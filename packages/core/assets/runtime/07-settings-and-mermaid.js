
const _authoringMemStore = {};

function _authoringStorage() {
  try {
    if (typeof localStorage !== "undefined" && localStorage) return localStorage;
  } catch (_) {}
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(_authoringMemStore, k) ? _authoringMemStore[k] : null),
    setItem: (k, v) => { _authoringMemStore[k] = String(v); },
    removeItem: (k) => { delete _authoringMemStore[k]; }
  };
}

/** Stable per-board key: html-report-source meta, else location.pathname. */
function getPageKey() {
  try {
    if (typeof document !== "undefined") {
      const meta = document.querySelector('meta[name="html-report-source"]');
      if (meta && meta.getAttribute("content")) return meta.getAttribute("content");
    }
    if (typeof window !== "undefined" && window.location && window.location.pathname) return window.location.pathname;
  } catch (_) {}
  return "page";
}

function isPublishedDocument() {
  if (typeof document === "undefined") return false;
  const meta = document.querySelector('meta[name="html-report-published"]');
  return Boolean(meta && meta.getAttribute("content") === "true");
}

/**
 * Settings gear section registry. Built-in sections (Appearance, Export) are
 * static markup; other features register sections that render by `order`.
 */
const HTMLReportSettings = {
  _sections: [],

  registerSection(section) {
    if (!section || !section.id || typeof section.render !== "function") return false;
    const next = { title: section.id, icon: null, order: 100, ...section };
    const idx = this._sections.findIndex((s) => s.id === next.id);
    if (idx >= 0) this._sections[idx] = next; else this._sections.push(next);
    this.renderAll();
    return true;
  },

  getSections() {
    return this._sections.slice().sort((a, b) => (a.order - b.order) || String(a.id).localeCompare(String(b.id)));
  },

  renderAll() {
    if (typeof document === "undefined") return;
    const host = document.getElementById("settings-extra-sections");
    if (!host) return;
    host.innerHTML = "";
    for (const s of this.getSections()) {
      const wrap = document.createElement("details");
      wrap.className = "collapse collapse-arrow bg-base-200/50 border border-base-300 rounded-box";
      wrap.id = `settings-section-${s.id}`;
      wrap.setAttribute("data-settings-section", s.id);
      const summary = document.createElement("summary");
      summary.className = "collapse-title text-3xs font-bold uppercase tracking-wider text-base-content/80 min-h-0 py-2.5 px-3 flex items-center justify-between cursor-pointer select-none";
      summary.innerHTML = `<span>${s.title}</span>`;
      const content = document.createElement("div");
      content.className = "collapse-content px-3 pb-3 pt-2";
      const body = document.createElement("div");
      body.className = "mt-1.5";
      content.appendChild(body);
      wrap.appendChild(summary);
      wrap.appendChild(content);
      host.appendChild(wrap);
      try { s.render(body); } catch (err) { console.warn("[html-report] settings section failed:", s.id, err); }
    }
  },

    initGear() {
    if (typeof document === "undefined") return;
    const dd = document.getElementById("settings-dropdown");
    const btn = document.getElementById("settings-gear-btn");
    const tocDd = document.getElementById("toc-dropdown");
    const tocBtn = document.getElementById("toc-dropdown-btn");

    const closeDropdown = (dropdownEl, triggerBtn) => {
      if (!dropdownEl) return;
      dropdownEl.classList.remove("dropdown-open");
      dropdownEl.removeAttribute("open");
      if (triggerBtn) triggerBtn.setAttribute("aria-expanded", "false");
      const active = document.activeElement;
      if (active && dropdownEl.contains(active) && typeof active.blur === "function") {
        active.blur();
      }
    };

    const openDropdown = (dropdownEl, triggerBtn) => {
      if (!dropdownEl) return;
      dropdownEl.classList.add("dropdown-open");
      if (triggerBtn) triggerBtn.setAttribute("aria-expanded", "true");
    };

    const closeSettings = () => closeDropdown(dd, btn);
    const closeToc = () => closeDropdown(tocDd, tocBtn);
    const closeAll = () => {
      closeSettings();
      closeToc();
    };

    this.close = closeSettings;
    this.closeToc = closeToc;
    this.closeAll = closeAll;

    if (tocDd && tocBtn && !tocDd.__tocWired) {
      tocDd.__tocWired = true;
      tocBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = tocDd.classList.contains("dropdown-open");
        if (isOpen) {
          closeToc();
        } else {
          closeSettings();
          openDropdown(tocDd, tocBtn);
        }
      });
      tocBtn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          tocBtn.click();
        }
      });
    }

    if (dd && btn && !dd.__gearWired) {
      dd.__gearWired = true;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = dd.classList.contains("dropdown-open");
        if (isOpen) {
          closeSettings();
        } else {
          closeToc();
          openDropdown(dd, btn);
        }
      });
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          btn.click();
        }
      });

      const panel = document.getElementById("settings-panel");
      if (panel) {
        panel.addEventListener("click", (e) => {
          const actionBtn = e.target && e.target.closest && e.target.closest("#open-all-settings-btn, #download-html-btn, #download-pdf-btn, #pwa-install-dropdown-btn, #settings-open-editor");
          if (actionBtn) {
            setTimeout(() => closeSettings(), 0);
          }
        });
      }
    }

    if (!document.__toolbarDropdownsGlobalWired) {
      document.__toolbarDropdownsGlobalWired = true;
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          const gearEl = document.getElementById("settings-dropdown");
          const tocEl = document.getElementById("toc-dropdown");
          if ((gearEl && gearEl.classList.contains("dropdown-open")) || (tocEl && tocEl.classList.contains("dropdown-open"))) {
            closeAll();
          }
        }
      });
      document.addEventListener("mousedown", (e) => {
        const gearEl = document.getElementById("settings-dropdown");
        const tocEl = document.getElementById("toc-dropdown");
        if (gearEl && gearEl.classList.contains("dropdown-open") && !gearEl.contains(e.target)) {
          closeDropdown(gearEl, document.getElementById("settings-gear-btn"));
        }
        if (tocEl && tocEl.classList.contains("dropdown-open") && !tocEl.contains(e.target)) {
          closeDropdown(tocEl, document.getElementById("toc-dropdown-btn"));
        }
      });
    }
  }
};

/* -------------------------------- Mermaid Enlarge -------------------------------- */

const HTMLReportMermaid = {
  _scale: 1.0,
  _panX: 0,
  _panY: 0,
  _isDragging: false,
  _startX: 0,
  _startY: 0,
  _isFullscreen: false,
  _controlsBound: false,

  /**
   * Initializes or updates enlarge buttons on all .mermaid diagram containers.
   */
  initEnlarge() {
    if (typeof document === "undefined") return;
    this._bindControls();
    const mermaidNodes = document.querySelectorAll(".mermaid");
    mermaidNodes.forEach((node) => {
      let wrapper = node.closest(".mermaid-wrapper");
      if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.className = "mermaid-wrapper relative group";
        node.parentNode.insertBefore(wrapper, node);
        wrapper.appendChild(node);
      }

      let btn = wrapper.querySelector(".mermaid-enlarge-btn");
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-xs btn-ghost bg-base-100/90 backdrop-blur border border-base-300 hover:bg-base-200 shadow-xs gap-1 text-3xs font-medium mermaid-enlarge-btn";
        btn.title = "Enlarge diagram";
        btn.setAttribute("aria-label", "Enlarge diagram");
        btn.innerHTML = '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg><span>Enlarge</span>';
        wrapper.appendChild(btn);
      }
      if (!btn.__enlargeWired) {
        btn.__enlargeWired = true;
        btn.addEventListener("click", () => this.openModal(node));
      }
    });
  },

  _bindControls() {
    if (this._controlsBound || typeof document === "undefined") return;
    this._controlsBound = true;

    const zoomInBtn = document.getElementById("mermaid-zoom-in-btn");
    const zoomOutBtn = document.getElementById("mermaid-zoom-out-btn");
    const zoomResetBtn = document.getElementById("mermaid-zoom-reset-btn");
    const zoomFitBtn = document.getElementById("mermaid-zoom-fit-btn");
    const fullscreenBtn = document.getElementById("mermaid-fullscreen-btn");
    const viewport = document.getElementById("mermaid-enlarge-viewport");
    const modal = document.getElementById("mermaid-enlarge-modal");

    if (zoomInBtn) zoomInBtn.addEventListener("click", () => this.zoomIn());
    if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => this.zoomOut());
    if (zoomResetBtn) zoomResetBtn.addEventListener("click", () => this.resetZoom());
    if (zoomFitBtn) zoomFitBtn.addEventListener("click", () => this.fitToViewport());
    if (fullscreenBtn) fullscreenBtn.addEventListener("click", () => this.toggleFullscreen());

    if (viewport) {
      viewport.addEventListener("wheel", (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        this.setScale(this._scale + delta);
      }, { passive: false });

      viewport.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        this._isDragging = true;
        this._startX = e.clientX - this._panX;
        this._startY = e.clientY - this._panY;
        viewport.classList.add("cursor-grabbing");
        viewport.classList.remove("cursor-grab");
      });

      window.addEventListener("mousemove", (e) => {
        if (!this._isDragging) return;
        this._panX = e.clientX - this._startX;
        this._panY = e.clientY - this._startY;
        this.updateTransform();
      });

      window.addEventListener("mouseup", () => {
        if (this._isDragging) {
          this._isDragging = false;
          if (viewport) {
            viewport.classList.remove("cursor-grabbing");
            viewport.classList.add("cursor-grab");
          }
        }
      });
    }

    if (modal) {
      window.addEventListener("keydown", (e) => {
        if (!modal.open && !modal.hasAttribute("open")) return;
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          this.zoomIn();
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          this.zoomOut();
        } else if (e.key === "0") {
          e.preventDefault();
          this.resetZoom();
        }
      });
    }
  },

  setScale(scale) {
    this._scale = Math.min(Math.max(scale, 0.25), 4.0);
    this.updateTransform();
  },

  zoomIn(step = 0.2) {
    this.setScale(this._scale + step);
  },

  zoomOut(step = 0.2) {
    this.setScale(this._scale - step);
  },

  resetZoom() {
    this._scale = 1.0;
    this._panX = 0;
    this._panY = 0;
    this.updateTransform();
  },

  fitToViewport() {
    const viewport = document.getElementById("mermaid-enlarge-viewport");
    const content = document.getElementById("mermaid-enlarge-content");
    const svg = content?.querySelector("svg");
    if (!viewport || !svg) {
      this.resetZoom();
      return;
    }
    const vpRect = viewport.getBoundingClientRect();
    let svgW = 800;
    let svgH = 500;
    const vb = svg.getAttribute("viewBox");
    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        svgW = parts[2];
        svgH = parts[3];
      }
    } else {
      svgW = svg.clientWidth || 800;
      svgH = svg.clientHeight || 500;
    }
    const scaleX = (vpRect.width - 40) / svgW;
    const scaleY = (vpRect.height - 40) / svgH;
    const fitScale = Math.min(scaleX, scaleY, 1.5);
    this._panX = 0;
    this._panY = 0;
    this.setScale(fitScale);
  },

  toggleFullscreen() {
    this._isFullscreen = !this._isFullscreen;
    if (typeof document === "undefined") return;
    const box = document.getElementById("mermaid-modal-box");
    if (!box) return;
    if (this._isFullscreen) {
      box.classList.remove("max-w-6xl", "w-11/12", "max-h-[90vh]");
      box.classList.add("max-w-none", "w-[98vw]", "h-[96vh]", "max-h-[96vh]");
    } else {
      box.classList.remove("max-w-none", "w-[98vw]", "h-[96vh]", "max-h-[96vh]");
      box.classList.add("max-w-6xl", "w-11/12", "max-h-[90vh]");
    }
  },

  updateTransform() {
    if (typeof document === "undefined") return;
    const content = document.getElementById("mermaid-enlarge-content");
    const zoomLevelEl = document.getElementById("mermaid-zoom-level");
    if (content) {
      content.style.transform = `translate(${this._panX}px, ${this._panY}px) scale(${this._scale})`;
    }
    if (zoomLevelEl) {
      zoomLevelEl.textContent = `${Math.round(this._scale * 100)}%`;
    }
  },

  /**
   * Opens the enlarged diagram modal displaying a readable clone of the SVG.
   */
  openModal(mermaidNode) {
    if (typeof document === "undefined" || !mermaidNode) return;
    this._bindControls();
    const modal = document.getElementById("mermaid-enlarge-modal");
    const container = document.getElementById("mermaid-enlarge-content");
    if (!modal || !container) return;

    this._scale = 1.0;
    this._panX = 0;
    this._panY = 0;

    const svg = mermaidNode.querySelector("svg");
    container.innerHTML = "";
    if (svg) {
      const clone = svg.cloneNode(true);
      clone.removeAttribute("height");
      clone.removeAttribute("width");
      clone.style.width = "100%";
      clone.style.height = "auto";
      clone.style.maxWidth = "none";

      // Detect SVG viewBox / aspect ratio
      let isWide = false;
      const vb = clone.getAttribute("viewBox");
      if (vb) {
        const parts = vb.split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          const aspect = parts[2] / parts[3];
          if (aspect > 1.8) {
            isWide = true;
          }
        }
      }

      if (isWide) {
        clone.style.minWidth = "min(160%, 1100px)";
      } else {
        clone.style.minWidth = "min(100%, 750px)";
      }
      container.appendChild(clone);
    } else {
      const pre = document.createElement("pre");
      pre.className = "text-xs font-mono p-4 overflow-auto";
      pre.textContent = mermaidNode.textContent;
      container.appendChild(pre);
    }

    this.updateTransform();

    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "true");
    }
  }
};

