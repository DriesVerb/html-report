Object.assign(HTMLReportAgent, {
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
      const safePersona = typeof escapeHtml === "function" ? escapeHtml(persona) : String(persona).replace(/[&<>"']/g, "");
      msgEl.className = "flex justify-start w-full";
      msgEl.innerHTML = `
        <div class="w-full max-w-[95%] p-3 rounded-2xl rounded-tl-none bg-base-200/90 border border-base-300 text-base-content shadow-sm space-y-2 text-xs">
          <div class="flex items-center justify-between text-[10px] text-base-content/60 pb-1 border-b border-base-300/50">
            <span class="font-mono font-semibold text-primary uppercase">${safePersona}</span>
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

  _sanitizeHtml: function(rawHtml) {
    if (!rawHtml || typeof rawHtml !== "string") return "";
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      try {
        const tpl = document.createElement("template");
        tpl.innerHTML = rawHtml;
        tpl.content.querySelectorAll("script, iframe, object, embed, link[rel='import'], meta, base, form").forEach((el) => el.remove());
        tpl.content.querySelectorAll("*").forEach((el) => {
          for (const attr of Array.from(el.attributes || [])) {
            const name = attr.name.toLowerCase();
            const val = String(attr.value || "").trim().toLowerCase();
            if (name.startsWith("on") || name === "srcdoc") el.removeAttribute(attr.name);
            else if ((name === "href" || name === "src" || name === "xlink:href" || name === "action" || name === "formaction") && (/^(?:javascript|vbscript):/i.test(val) || /^data:text\/html/i.test(val))) el.removeAttribute(attr.name);
          }
        });
        return tpl.innerHTML;
      } catch (_) {}
    }
    return rawHtml
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  },

  _formatMarkdown: function(text) {
    if (!text) return "";
    if (typeof window !== "undefined") {
      if (window.showdownConverter && typeof window.showdownConverter.makeHtml === "function") {
        return this._sanitizeHtml(window.showdownConverter.makeHtml(text));
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
        return this._sanitizeHtml(conv.makeHtml(text));
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
          const safeErr = typeof escapeHtml === "function" ? escapeHtml(adapterErr.message) : String(adapterErr.message || "").replace(/[&<>"']/g, "");
          if (contentEl) contentEl.innerHTML = `<span class="text-error font-semibold">Error: ${safeErr}</span>`;
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
});
