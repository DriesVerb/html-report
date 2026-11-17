/**
 * @file lib/server/live-reload-client.mjs
 * Server-connected Idiomorph hot-swap and MCP SSE browser client injected only
 * during HTTP serving (never emitted into standalone static builds).
 */

export function injectLiveReload(html) {
  const liveReloadScript = `
  <!-- __html_report_live_reload_injected__ -->
  <script id="__html_report_live_reload__">
    (() => {
      // Vite-style hot swap: on file change, morph only <main> in place with Idiomorph
      // (keeps theme, scroll, open dropdowns). Falls back to a full reload that restores
      // scroll whenever in-place swapping is unsafe (head/scripts changed, CDN offline, errors).
      const SCROLL_KEY = "__html_report_scroll__:" + location.pathname;
      const IDIOMORPH_SRC = "https://cdn.jsdelivr.net/npm/idiomorph@0.7.3/dist/idiomorph.min.js";
      let busy = false;
      let pending = false;
      let idiomorphPromise = null;

      // Restore scroll after a fallback full reload (wait for charts/Mermaid to settle layout).
      const savedScroll = sessionStorage.getItem(SCROLL_KEY);
      if (savedScroll !== null) {
        sessionStorage.removeItem(SCROLL_KEY);
        if ("scrollRestoration" in history) history.scrollRestoration = "manual";
        const y = parseInt(savedScroll, 10) || 0;
        const started = Date.now();
        const restore = () => {
          window.scrollTo({ top: y, behavior: "instant" });
          if (!window.__REPORT_READY__ && Date.now() - started < 4000) setTimeout(restore, 100);
          else setTimeout(() => window.scrollTo({ top: y, behavior: "instant" }), 150);
        };
        window.addEventListener("DOMContentLoaded", restore);
      }

      function fullReload(reason) {
        console.log("[html-report] Full reload (" + reason + ")");
        try { sessionStorage.setItem(SCROLL_KEY, String(window.scrollY)); } catch (_) {}
        window.location.reload();
      }

      function loadIdiomorph() {
        if (window.Idiomorph) return Promise.resolve(window.Idiomorph);
        if (!idiomorphPromise) {
          idiomorphPromise = new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = IDIOMORPH_SRC;
            s.crossOrigin = "anonymous";
            s.onload = () => (window.Idiomorph ? resolve(window.Idiomorph) : reject(new Error("Idiomorph missing")));
            s.onerror = () => { idiomorphPromise = null; reject(new Error("Idiomorph CDN unreachable")); };
            document.head.appendChild(s);
          });
        }
        return idiomorphPromise;
      }

      function signature(doc) {
        const head = Array.from(doc.head.querySelectorAll("link[rel=stylesheet], script[src], style"))
          .map((el) => el.outerHTML).join("\\n");
        const scripts = Array.from(doc.querySelectorAll("script:not([src])"))
          .filter((el) => {
            if (el.id === "__html_report_live_reload__") return false;
            const t = (el.getAttribute("type") || "").trim().toLowerCase();
            if (t === "application/json" || t === "application/ld+json" || t === "importmap") return false;
            if (el.closest && el.closest("main")) return false;
            return true;
          })
          .map((el) => el.textContent).join("\\n");
        return head + "\\n---\\n" + scripts;
      }

      function mainScriptSources(mainEl) {
        if (!mainEl) return [];
        return Array.from(mainEl.querySelectorAll("script:not([src])"))
          .filter((el) => {
            const t = (el.getAttribute("type") || "").trim().toLowerCase();
            return !t || t === "text/javascript" || t === "application/javascript";
          })
          .map((el) => el.textContent || "");
      }

      async function fetchDoc() {
        const res = await fetch(location.href, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        return new DOMParser().parseFromString(await res.text(), "text/html");
      }

      let baselineSig = null;
      const baselineReady = fetchDoc().then((d) => { baselineSig = signature(d); }).catch(() => {});

      function keepNode(node) {
        if (!(node instanceof Element)) return false;
        return node.tagName === "CANVAS" ||
          node.tagName === "INPUT" ||
          node.tagName === "TEXTAREA" ||
          node === document.activeElement ||
          node.hasAttribute("data-hot-keep") ||
          node.classList.contains("fc") ||
          node.classList.contains("leaflet-container") ||
          node.classList.contains("gridjs-container");
      }

      async function hotSwap() {
        await baselineReady;
        const nextDoc = await fetchDoc();
        const curMain = document.querySelector("main");
        const nextMain = nextDoc.querySelector("main");
        if (!curMain || !nextMain) return fullReload("no <main> element");
        const nextSig = signature(nextDoc);
        if (baselineSig === null || nextSig !== baselineSig) return fullReload("scripts or <head> assets changed");

        const prevScripts = mainScriptSources(curMain);
        const nextScripts = mainScriptSources(nextMain);
        const changedScripts = nextScripts.filter((code, idx) => code !== prevScripts[idx]);
        if (changedScripts.some((code) => /DOMContentLoaded/.test(code))) {
          return fullReload("<main> DOMContentLoaded script changed");
        }

        let Idiomorph;
        try { Idiomorph = await loadIdiomorph(); } catch (err) { return fullReload(err.message); }

        const y = window.scrollY;
        Idiomorph.morph(curMain, nextMain, {
          morphStyle: "outerHTML",
          callbacks: { beforeNodeMorphed: (oldNode) => !keepNode(oldNode) }
        });
        for (const jsonId of ["agent-manifest", "feed-registry"]) {
          const nextJson = nextDoc.getElementById(jsonId);
          const curJson = document.getElementById(jsonId);
          if (nextJson && curJson) curJson.textContent = nextJson.textContent;
        }
        if (changedScripts.length > 0) {
          for (const code of changedScripts) {
            try {
              (new Function(code))();
            } catch (err) {
              return fullReload("main script re-exec error: " + (err && err.message));
            }
          }
        }
        if (nextDoc.title && nextDoc.title !== document.title) document.title = nextDoc.title;
        if (typeof window.reinitReportContent === "function") await window.reinitReportContent();
        window.scrollTo({ top: y, behavior: "instant" });
        console.log("[html-report] Hot-swapped <main> in place (theme & scroll preserved).");
      }

      async function onChange() {
        if (busy) { pending = true; return; }
        busy = true;
        try { await hotSwap(); } catch (err) { return fullReload("hot swap error: " + (err && err.message)); }
        busy = false;
        if (pending) { pending = false; onChange(); }
      }

      const es = new EventSource("/__live_reload__?page=" + encodeURIComponent(window.location.pathname || "/"));
      let sseConnectedOnce = false;
      let sseDisconnected = false;
      es.addEventListener("open", () => {
        if (sseDisconnected) {
          sseDisconnected = false;
          window.dispatchEvent(new CustomEvent("html-report:server-reconnected"));
        }
        sseConnectedOnce = true;
      });
      es.addEventListener("error", () => {
        if (sseConnectedOnce) sseDisconnected = true;
      });
      es.addEventListener("reload", onChange);
      es.addEventListener("mcp-fragment", async (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          if (!payload.selector || typeof payload.html !== "string") return;
          let target = null;
          try {
            target = document.querySelector(payload.selector);
          } catch (_) {
            return;
          }
          if (!target) return;
          const mergeMode = payload.merge || "morph";
          if (mergeMode === "prepend") {
            target.insertAdjacentHTML("afterbegin", payload.html);
          } else if (mergeMode === "append") {
            target.insertAdjacentHTML("beforeend", payload.html);
          } else {
            let Idiomorph = null;
            try { Idiomorph = await loadIdiomorph(); } catch (_) {}
            if (Idiomorph) {
              Idiomorph.morph(target, payload.html, {
                morphStyle: mergeMode === "inner" ? "innerHTML" : "outerHTML",
                callbacks: { beforeNodeMorphed: (oldNode) => !keepNode(oldNode) }
              });
            } else if (mergeMode === "inner") {
              target.innerHTML = payload.html;
            } else {
              target.outerHTML = payload.html;
            }
          }
          if (typeof window.reinitReportContent === "function") {
            await window.reinitReportContent();
          }
        } catch (err) {
          console.warn("[html-report] mcp-fragment error:", err && err.message);
        }
      });
      es.addEventListener("mcp-theme", (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          const theme = payload && payload.theme ? String(payload.theme) : "";
          if (!theme) return;
          if (typeof window.setReportTheme === "function") {
            window.setReportTheme(theme);
          } else {
            document.documentElement.setAttribute("data-theme", theme);
            try { localStorage.setItem("html_report_active_theme", theme); } catch (_) {}
          }
        } catch (err) {
          console.warn("[html-report] mcp-theme error:", err && err.message);
        }
      });
      es.addEventListener("mcp-alert", (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          if (!payload || (!payload.text && !payload.message)) return;
          const allowed = { info: "alert-info", success: "alert-success", warning: "alert-warning", error: "alert-error" };
          const alertClass = allowed[payload.type] || "alert-info";
          const alertId = String(payload.id || ("mcp-alert-" + Date.now())).replace(/[^a-zA-Z0-9_-]/g, "");
          const container =
            document.getElementById("agent-reaction-bubble") ||
            document.getElementById("report-main") ||
            document.querySelector("main") ||
            document.body;
          if (!container) return;

          const existing = document.getElementById(alertId);
          if (existing) existing.remove();

          const banner = document.createElement("div");
          banner.id = alertId;
          banner.setAttribute("role", "alert");
          banner.className = "alert " + alertClass + " shadow-lg mb-4 flex items-center justify-between text-xs";

          const textSpan = document.createElement("span");
          textSpan.textContent = typeof payload.text === "string" ? payload.text : payload.message;

          const closeBtn = document.createElement("button");
          closeBtn.type = "button";
          closeBtn.className = "btn btn-xs btn-ghost";
          closeBtn.setAttribute("aria-label", "Dismiss alert");
          closeBtn.textContent = "×";
          closeBtn.addEventListener("click", () => banner.remove());

          banner.appendChild(textSpan);
          banner.appendChild(closeBtn);
          container.prepend(banner);
        } catch (err) {
          console.warn("[html-report] mcp-alert error:", err && err.message);
        }
      });
      es.addEventListener("projects-changed", () => {
        if (typeof window.loadWorkspaceProjects === "function") {
          window.loadWorkspaceProjects({ refresh: true });
        } else {
          window.dispatchEvent(new CustomEvent("html-report:projects-changed"));
        }
      });
      window.addEventListener("beforeunload", () => {
        try { es.close(); } catch (_) {}
      });
    })();
  </script>
`;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${liveReloadScript}\n</body>`);
  }
  if (html.includes("</html>")) {
    return html.replace("</html>", `${liveReloadScript}\n</html>`);
  }
  return html + liveReloadScript;
}
