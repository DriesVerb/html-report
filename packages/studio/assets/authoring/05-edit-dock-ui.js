Object.assign(HTMLReportEdit, {
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
});
