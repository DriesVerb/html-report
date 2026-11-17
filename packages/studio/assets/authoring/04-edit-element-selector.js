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
};
