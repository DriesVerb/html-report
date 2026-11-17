Object.assign(HTMLReportEdit, {
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
});
