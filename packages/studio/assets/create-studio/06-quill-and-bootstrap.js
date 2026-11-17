function downloadStarterHtml(btn) {
  const hasCharts = document.getElementById("chk-charts")?.checked ?? false;
  const hasMermaid = document.getElementById("chk-mermaid")?.checked ?? false;
  const hasGridjs = document.getElementById("chk-gridjs")?.checked ?? false;
  const hasLeaflet = document.getElementById("chk-leaflet")?.checked ?? false;
  const hasKatex = document.getElementById("chk-katex")?.checked ?? false;
  const hasHljs = document.getElementById("chk-hljs")?.checked ?? false;
  const hasDayjs = document.getElementById("chk-dayjs")?.checked ?? false;
  const hasQuill = document.getElementById("chk-quill")?.checked ?? false;

  let starterTitle = "Quarterly Strategic Performance Report";
  if (currentTarget === "print") starterTitle = "Formal Executive Audit & Compliance Document";
  if (currentTarget === "dashboard") starterTitle = "Live Telemetry & System Monitoring Cockpit";
  if (currentTarget === "presentation") starterTitle = "Strategic Roadmap & Product Keynote Deck";

  const htmlBundle = `<!DOCTYPE html>
<html lang="en" data-theme="${currentTheme}" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${starterTitle}</title>
  
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daisyui@4.12.14/dist/full.min.css" crossorigin="anonymous" />
  <' + 'script src="https://cdn.tailwindcss.com"><' + '/script>
  <' + 'script defer src="https://cdn.jsdelivr.net/npm/lucide@0.460.0/dist/umd/lucide.min.js"><' + '/script>
  ${hasCharts ? '<' + 'script defer src="https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js"><' + '/script>' : ''}
  ${hasMermaid ? '<' + 'script defer src="https://cdn.jsdelivr.net/npm/mermaid@11.4.0/dist/mermaid.min.js"><' + '/script>' : ''}
  ${hasGridjs ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gridjs/dist/theme/mermaid.min.css" /><' + 'script defer src="https://cdn.jsdelivr.net/npm/gridjs/dist/gridjs.umd.js"><' + '/script>' : ''}
  ${hasLeaflet ? '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><' + 'script defer src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><' + '/script>' : ''}
  ${hasKatex ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" /><' + 'script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><' + '/script>' : ''}
  ${hasHljs ? '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/github-dark.min.css" /><' + 'script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/highlight.min.js"><' + '/script>' : ''}
  ${hasDayjs ? '<' + 'script defer src="https://cdn.jsdelivr.net/npm/dayjs@1.11.13/dayjs.min.js"><' + '/script><' + 'script defer src="https://cdn.jsdelivr.net/npm/dayjs@1.11.13/plugin/relativeTime.js"><' + '/script>' : ''}
  ${hasQuill ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css" crossorigin="anonymous" />\n  <' + 'script defer src="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js" crossorigin="anonymous"><' + '/script>' : ''}
</head>
<body class="bg-base-100 text-base-content min-h-screen p-4 sm:p-8 font-sans">
  <div class="max-w-5xl mx-auto space-y-6">
<header class="border-b border-base-300 pb-4 flex items-center justify-between">
  <div>
    <h1 class="text-2xl sm:text-3xl font-black">${starterTitle}</h1>
    <p class="text-xs sm:text-sm text-base-content/70">Generated client-side via HTML Creation Studio (Zero Node)</p>
  </div>
  <span class="badge badge-primary font-mono text-xs font-bold">${currentTarget.toUpperCase()}</span>
</header>
<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
  <div class="stat bg-base-200/50 rounded-box border border-base-300">
    <div class="stat-title text-xs">Uptime</div>
    <div class="stat-value text-2xl text-success">99.98%</div>
  </div>
  <div class="stat bg-base-200/50 rounded-box border border-base-300">
    <div class="stat-title text-xs">Speed</div>
    <div class="stat-value text-2xl text-primary">14.2ms</div>
  </div>
  <div class="stat bg-base-200/50 rounded-box border border-base-300">
    <div class="stat-title text-xs">Score</div>
    <div class="stat-value text-2xl text-accent">100/100</div>
  </div>
</div>
${hasQuill ? `
<div class="card bg-base-100 shadow-sm border border-base-300 p-4 space-y-2">
  <h3 class="font-bold text-sm">Notes &amp; Findings (WYSIWYG)</h3>
  <div id="editor" class="bg-base-100 min-h-[120px]">
    <p>Document your executive summary, audit findings, or operational insights here...</p>
  </div>
</div>
<' + 'script>
  window.addEventListener("DOMContentLoaded", () => {
    if (typeof Quill !== "undefined") {
      new Quill("#editor", { theme: "snow" });
    }
  });
<' + '/script>` : ''}
  </div>
  <' + 'script>
document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) window.lucide.createIcons();
  if (window.mermaid) window.mermaid.initialize({ startOnLoad: true });
  if (window.hljs) window.hljs.highlightAll();
  if (window.dayjs && window.dayjs_plugin_relativeTime) window.dayjs.extend(window.dayjs_plugin_relativeTime);
});
  <' + '/script>
<' + '/body>
<' + '/html>`;

  const blob = new Blob([htmlBundle], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${currentTarget}-report.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const original = btn.innerHTML;
  btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 text-success"></i> Starter HTML Downloaded!';
  setTimeout(() => {
    btn.innerHTML = original;
    if (window.lucide) window.lucide.createIcons();
  }, 2500);
}

let quillEditor = null;
let boardGoalMode = "simple";

function updateRichEditorCharCount() {
  if (!quillEditor) return;
  const count = quillEditor.getText().trim().length;
  const el = document.getElementById("rich-editor-char-count");
  if (el) el.textContent = `${count} character${count === 1 ? '' : 's'}`;
}

function initQuillIfNeeded() {
  if (quillEditor || typeof Quill === "undefined") return quillEditor;
  const editorEl = document.getElementById("quill-board-goals-editor");
  if (!editorEl) return null;
  quillEditor = new Quill("#quill-board-goals-editor", {
    theme: "snow",
    placeholder: "e.g., Weekly executive sales metrics with regional breakdowns, revenue churn alerts, quota milestones...",
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["code-block", "clean"]
      ]
    }
  });
  quillEditor.on("text-change", () => {
    updateRichEditorCharCount();
  });
  return quillEditor;
}

window.openRichEditorModal = function () {
  const modal = document.getElementById("modal-rich-goals");
  if (!modal) return;
  modal.showModal();
  const q = initQuillIfNeeded();
  if (q) {
    const currentQuillText = q.getText().trim();
    const simpleTextarea = document.getElementById("input-board-goals");
    const currentSimpleText = simpleTextarea?.value.trim() || "";
    if (!currentQuillText && currentSimpleText) {
      q.setText(currentSimpleText + "\n");
    }
    updateRichEditorCharCount();
    setTimeout(() => q.focus(), 80);
  }
  if (window.lucide) window.lucide.createIcons();
};

window.closeRichEditorModal = function () {
  const modal = document.getElementById("modal-rich-goals");
  if (modal && modal.close) modal.close();
};

window.saveRichGoalsAndClose = function () {
  const q = initQuillIfNeeded();
  if (q) {
    const root = q.root;
    const paragraphs = Array.from(root.children);
    const lines = paragraphs.map((p) => {
      const tag = p.tagName.toLowerCase();
      const text = p.innerText.trim();
      if (!text) return "";
      if (tag === "h1") return "# " + text;
      if (tag === "h2") return "## " + text;
      if (tag === "h3") return "### " + text;
      if (tag === "ul" || p.classList.contains("ql-bullet") || p.getAttribute("data-list") === "bullet") return "• " + text;
      if (tag === "ol" || p.classList.contains("ql-ordered") || p.getAttribute("data-list") === "ordered") return "- " + text;
      return text;
    }).filter(Boolean);
    const markdownGoals = lines.join("\n") || q.getText().trim();
    const richHtml = q.root.innerHTML;

    const simpleTextarea = document.getElementById("input-board-goals");
    if (simpleTextarea) {
      simpleTextarea.value = markdownGoals;
    }

    try {
      localStorage.setItem("html-report-create-goals-complex", richHtml);
      localStorage.setItem("html-report-create-goals-simple", markdownGoals);
      localStorage.setItem("html-report-create-goals-mode", "complex");
    } catch (_) {}

    boardGoalMode = "complex";
    const btnSimple = document.getElementById("btn-mode-simple");
    const btnComplex = document.getElementById("btn-mode-complex");
    if (btnSimple) { btnSimple.classList.remove("btn-primary"); btnSimple.classList.add("btn-ghost"); }
    if (btnComplex) { btnComplex.classList.add("btn-primary"); btnComplex.classList.remove("btn-ghost"); }
    const indicator = document.getElementById("rich-goals-indicator");
    if (indicator) indicator.classList.remove("hidden");

    updatePromptAndPreview();
  }
  closeRichEditorModal();
};

window.switchBoardGoalMode = function (mode) {
  if (mode === "complex" || mode === "rich") {
    openRichEditorModal();
    return;
  }

  boardGoalMode = "simple";
  const simpleTextarea = document.getElementById("input-board-goals");
  const btnSimple = document.getElementById("btn-mode-simple");
  const btnComplex = document.getElementById("btn-mode-complex");
  const indicator = document.getElementById("rich-goals-indicator");

  try {
    localStorage.setItem("html-report-create-goals-mode", "simple");
  } catch (_) {}

  if (btnComplex) { btnComplex.classList.remove("btn-primary"); btnComplex.classList.add("btn-ghost"); }
  if (btnSimple) { btnSimple.classList.add("btn-primary"); btnSimple.classList.remove("btn-ghost"); }
  if (indicator) indicator.classList.add("hidden");
  if (simpleTextarea) {
    simpleTextarea.classList.remove("hidden");
  }
  updatePromptAndPreview();
};

// PWA Service Worker Registration & Install Interception
let deferredPwaPrompt = null;
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const installBtn = document.getElementById("pwa-install-btn");
  if (installBtn) installBtn.classList.remove("hidden");
  const statusBadge = document.getElementById("pwa-install-status-badge");
  if (statusBadge) statusBadge.classList.remove("hidden");
});

window.triggerPwaInstall = async function () {
  if (!deferredPwaPrompt) {
    alert("To install this Creation Studio as an app, use your browser menu ('Install' or 'Add to Home Screen').");
    return;
  }
  deferredPwaPrompt.prompt();
  const choice = await deferredPwaPrompt.userChoice;
  if (choice.outcome === "accepted") {
    const installBtn = document.getElementById("pwa-install-btn");
    if (installBtn) installBtn.classList.add("hidden");
  }
  deferredPwaPrompt = null;
};

window.addEventListener("appinstalled", () => {
  const installBtn = document.getElementById("pwa-install-btn");
  if (installBtn) installBtn.classList.add("hidden");
  const statusBadge = document.getElementById("pwa-install-status-badge");
  if (statusBadge) {
    statusBadge.textContent = "Installed";
    statusBadge.className = "badge badge-success badge-xs font-mono";
  }
  deferredPwaPrompt = null;
});

function syncThemeColorMeta() {
  const meta = document.getElementById("pwa-theme-color") || document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  try {
    const primaryEl = document.querySelector(".bg-primary") || document.body;
    const bg = window.getComputedStyle(primaryEl).backgroundColor;
    if (bg && bg !== "transparent") {
      meta.setAttribute("content", bg);
    }
  } catch (_) {}
}
const themeObserver = new MutationObserver(() => syncThemeColorMeta());
themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });


document.addEventListener("DOMContentLoaded", () => {
  try {
    const savedMode = localStorage.getItem("html-report-create-goals-mode");
    const savedSimple = localStorage.getItem("html-report-create-goals-simple");
    const savedComplex = localStorage.getItem("html-report-create-goals-complex");
    if (savedSimple && document.getElementById("input-board-goals")) {
      document.getElementById("input-board-goals").value = savedSimple;
    }
    if (savedMode === "complex" || savedMode === "rich") {
      boardGoalMode = "complex";
      const btnSimple = document.getElementById("btn-mode-simple");
      const btnComplex = document.getElementById("btn-mode-complex");
      if (btnSimple) { btnSimple.classList.remove("btn-primary"); btnSimple.classList.add("btn-ghost"); }
      if (btnComplex) { btnComplex.classList.add("btn-primary"); btnComplex.classList.remove("btn-ghost"); }
      const indicator = document.getElementById("rich-goals-indicator");
      if (indicator) indicator.classList.remove("hidden");
      const q = initQuillIfNeeded();
      if (q && savedComplex) {
        q.root.innerHTML = savedComplex;
      }
    }
  } catch (_) {}

  const ensureIconsReady = () => {
    if (window.__rehydrateCreateIcons && window.__rehydrateCreateIcons()) return true;
    if (window.__loadLucideFallback) window.__loadLucideFallback();
    return false;
  };
  ensureIconsReady();

  const safeCall = (fn) => {
    try { if (typeof fn === "function") fn(); } catch (err) { console.warn("[create] init notice:", err); }
  };
  safeCall(initNavbarThemeDropdown);
  safeCall(initInitialThemeDropdown);
  safeCall(initFileDropZone);
  safeCall(renderCollectedFiles);
  safeCall(updatePromptAndPreview);
  studioInitialized = true;
  safeCall(syncConfigFromServer);
  safeCall(checkAgentBridgePreflight);
  setTimeout(syncThemeColorMeta, 250);

  // Initialize route & preload projects
  if (window.location.hash === "#projects") {
    window.switchView("projects", false);
  } else {
    window.loadWorkspaceProjects();
  }

  ensureIconsReady();
  window.addEventListener("load", ensureIconsReady);

  if (typeof MutationObserver !== "undefined" && document.body) {
    let iconTimer = null;
    const iconObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type !== "childList" || m.addedNodes.length === 0) continue;
        for (const node of m.addedNodes) {
          if (node.nodeType === 1 && (
            (node.matches && node.matches(":not(svg)[data-lucide]")) ||
            (node.querySelector && node.querySelector(":not(svg)[data-lucide]"))
          )) {
            if (iconTimer) clearTimeout(iconTimer);
            iconTimer = setTimeout(ensureIconsReady, 16);
            return;
          }
        }
      }
    });
    iconObserver.observe(document.body, { childList: true, subtree: true });
  }
});
