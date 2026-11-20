/**
 * Builds Table of Contents from main h1, h2, h3 elements.
 */
function initTOC() {
  if (typeof document === "undefined") return;
  const tocList = document.getElementById("report-toc-list");
  if (!tocList) return;
  const headings = Array.from(document.querySelectorAll("main h1, main h2, main h3")).filter(
    (h) => !h.closest(".fc, .katex, .gridjs, .notes, #presentation-notes-modal, #print-cover-page, [aria-hidden='true']") && !h.classList.contains("fc-toolbar-title")
  );
  tocList.innerHTML = "";

  headings.forEach((h) => {
    if (!h.id) {
      const slug = h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      h.id = slug || `section-${Math.random().toString(36).slice(2, 7)}`;
    }
    const level = parseInt(h.tagName.substring(1), 10);
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#${h.id}`;
    a.textContent = h.textContent.trim();
    a.className = level === 1 ? "font-bold text-xs" : level === 2 ? "pl-3 text-xs" : "pl-6 text-2xs opacity-80";
    a.addEventListener("click", (e) => {
      const targetSlide = h.closest(".reveal .slides section");
      const shell = document.getElementById("presentation-shell");
      const isStacked = Boolean(shell?.classList.contains("is-stacked") || h.closest(".reveal-stage.is-stacked"));
      if (targetSlide && !isStacked && window.revealInstance && typeof window.revealInstance.getIndices === "function") {
        e.preventDefault();
        try {
          const indices = window.revealInstance.getIndices(targetSlide);
          if (indices && typeof window.revealInstance.slide === "function") {
            window.revealInstance.slide(indices.h || 0, indices.v || 0);
          }
        } catch (_) {}
      }
      if (typeof HTMLReportSettings !== "undefined" && typeof HTMLReportSettings.closeToc === "function") {
        HTMLReportSettings.closeToc();
      } else {
        const dropdown = document.getElementById("toc-dropdown");
        const btn = document.getElementById("toc-dropdown-btn");
        if (dropdown) {
          dropdown.classList.remove("dropdown-open");
          dropdown.removeAttribute("open");
          if (document.activeElement && dropdown.contains(document.activeElement) && typeof document.activeElement.blur === "function") {
            document.activeElement.blur();
          }
        }
        if (btn) btn.setAttribute("aria-expanded", "false");
      }
    });
    li.appendChild(a);
    tocList.appendChild(li);
  });

  if (typeof HTMLReportSettings !== "undefined" && typeof HTMLReportSettings.initGear === "function") {
    try { HTMLReportSettings.initGear(); } catch (_) {}
  }
}

/**
 * Horizontal Scrollbar -> Insufficient Space Detector.
 * Flags elements where scrollWidth > clientWidth with [data-insufficient-space="true"].
 */
function checkInsufficientHorizontalSpace() {
  if (typeof document === "undefined") return [];
  const mainEl = document.querySelector("main");
  if (!mainEl) return [];

  const insufficient = [];
  const candidates = mainEl.querySelectorAll("section, div, pre, table, .card, .overflow-x-auto");

  candidates.forEach((el) => {
    // Grid.js handles horizontal scrolling intentionally inside .gridjs-wrapper for wide tables
    if (el.classList && (el.classList.contains("gridjs-wrapper") || el.classList.contains("gridjs-table"))) {
      el.removeAttribute("data-insufficient-space");
      el.classList.remove("verify-insufficient-space");
      return;
    }
    const style = (typeof window !== "undefined" && window.getComputedStyle) ? window.getComputedStyle(el) : el.style;
    if (style.display === "none" || style.visibility === "hidden" || el.clientWidth === 0) {
      el.removeAttribute("data-insufficient-space");
      if (el.classList) el.classList.remove("verify-insufficient-space");
      return;
    }
    const hasHorizontalScrollbar =
      el.scrollWidth > el.clientWidth + 2 &&
      ["auto", "scroll"].includes(style.overflowX);

    if (hasHorizontalScrollbar) {
      el.setAttribute("data-insufficient-space", "true");
      if (el.classList) el.classList.add("verify-insufficient-space");
      insufficient.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        className: typeof el.className === "string" ? el.className : "",
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        message: "Element has a horizontal scrollbar and does not have enough space"
      });
    } else {
      el.removeAttribute("data-insufficient-space");
      if (el.classList) el.classList.remove("verify-insufficient-space");
    }
  });

  return insufficient;
}

/**
 * Builds a standalone, inlined HTML snapshot with fetched CSS and JS bundled directly.
 */
async function buildInlinedHtmlSnapshot(options = {}) {
  if (typeof document === "undefined") return "";
  const clone = document.documentElement.cloneNode(true);
  const publishedMode = Boolean(
    (options && options.mode === "published") ||
    (typeof HTMLReportPublisher !== "undefined" && typeof HTMLReportPublisher.isPublishedFlagOn === "function" && HTMLReportPublisher.isPublishedFlagOn())
  );

  // Strip dev-server live reload scripts, tooltips, and transient dropdown/accordion/button state
  clone.querySelectorAll("#__html_report_live_reload__, .mermaidTooltip, script[src*='idiomorph']").forEach((el) => el.remove());
  clone.querySelectorAll("#download-html-btn, #modal-download-html-btn").forEach((btn) => {
    btn.removeAttribute("disabled");
    btn.disabled = false;
  });
  clone.querySelectorAll("#settings-dropdown, #toc-dropdown").forEach((dd) => {
    dd.classList.remove("dropdown-open");
    dd.removeAttribute("open");
  });
  clone.querySelectorAll("#settings-gear-btn, #toc-dropdown-btn").forEach((btn) => {
    btn.setAttribute("aria-expanded", "false");
  });
  clone.querySelectorAll("#settings-section-appearance, #settings-section-download").forEach((det) => {
    det.removeAttribute("open");
  });

  // Reset pre-rendered Grid.js containers so Grid.js can mount cleanly into an empty host
  clone.querySelectorAll('[data-gridjs="true"]').forEach((el) => {
    if (el.querySelector(".gridjs-container") || el.classList.contains("gridjs-container")) {
      el.innerHTML = "";
    }
  });
  clone.querySelectorAll(".gridjs-container").forEach((container) => {
    const parent = container.parentElement;
    container.remove();
    if (parent && parent.children.length === 0 && !parent.textContent.trim()) {
      parent.innerHTML = "";
    }
  });

  // Strip pre-expanded Alpine x-for sibling nodes so Alpine does not render duplicates on re-init
  const liveXForTemplates = Array.from(document.querySelectorAll("template[x-for]"));
  const cloneXForTemplates = Array.from(clone.querySelectorAll("template[x-for]"));
  if (liveXForTemplates.length === cloneXForTemplates.length) {
    liveXForTemplates.forEach((liveTpl, idx) => {
      const cloneTpl = cloneXForTemplates[idx];
      const liveParent = liveTpl.parentElement;
      const cloneParent = cloneTpl.parentElement;
      if (!liveParent || !cloneParent) return;
      const lookupVals = liveTpl._x_lookup && typeof liveTpl._x_lookup === "object"
        ? new Set(Object.values(liveTpl._x_lookup))
        : null;
      const liveChildren = Array.from(liveParent.children);
      const cloneChildren = Array.from(cloneParent.children);
      if (liveChildren.length !== cloneChildren.length) return;
      const tplPos = liveChildren.indexOf(liveTpl);
      for (let i = tplPos + 1; i < liveChildren.length; i++) {
        const liveChild = liveChildren[i];
        if (
          (lookupVals && lookupVals.has(liveChild)) ||
          liveChild._x_dataStack ||
          liveChild.hasAttribute("data-x-for-rendered")
        ) {
          cloneChildren[i].remove();
        }
      }
    });
  }

  // Transition live board status badge to offline mode inside standalone snapshots
  clone.querySelectorAll("#live-board-status").forEach((el) => {
    el.textContent = "Offline (Local Save)";
    el.classList.remove("badge-success", "badge-warning", "badge-ghost");
    el.classList.add("badge-info", "badge-outline");
  });

  if (publishedMode) HTMLReportPublisher.prepare(clone);
  clone.setAttribute("data-theme", document.documentElement.getAttribute("data-theme") || "light");
  clone.querySelectorAll("[data-reveal-initialized]").forEach((el) => el.removeAttribute("data-reveal-initialized"));
  clone.querySelectorAll("[data-presentation-bound]").forEach((el) => el.removeAttribute("data-presentation-bound"));
  clone.querySelectorAll("#presentation-shell.is-fullscreen").forEach((el) => el.classList.remove("is-fullscreen"));

  // Inline external stylesheets
  const linkEls = Array.from(clone.querySelectorAll('link[rel="stylesheet"][href]'));
  await Promise.allSettled(
    linkEls.map(async (linkEl) => {
      const href = linkEl.getAttribute("href");
      if (!href || (!href.startsWith("http://") && !href.startsWith("https://"))) return;
      try {
        const res = await fetch(href);
        if (!res.ok) return;
        let cssText = await res.text();
        cssText = cssText.replace(/url\((['"]?)(?!data:|https?:|#)([^'")]+)\1\)/g, (match, quote, relPath) => {
          try {
            return `url("${new URL(relPath, href).href}")`;
          } catch {
            return match;
          }
        });
        const styleEl = document.createElement("style");
        styleEl.setAttribute("data-inlined-href", href);
        styleEl.textContent = cssText;
        linkEl.replaceWith(styleEl);
      } catch (_) {}
    })
  );

  // Inline external scripts while preserving type="module" and [defer] execution order
  const scriptEls = Array.from(clone.querySelectorAll("script[src]"));
  const cloneHead = clone.querySelector("head");
  const cloneBody = clone.querySelector("body");
  let tailwindStripped = false;
  const scriptResults = await Promise.all(
    scriptEls.map(async (scriptEl) => {
      const src = scriptEl.getAttribute("src");
      if (!src || (!src.startsWith("http://") && !src.startsWith("https://"))) return null;
      if (src.includes("cdn.tailwindcss.com")) {
        tailwindStripped = true;
        const marker = document.createElement("script");
        marker.setAttribute("data-inlined-src", src);
        marker.textContent = "/* Tailwind CSS styles pre-compiled inline in <head> */";
        return { scriptEl, inlineScript: marker, relocateToBody: false };
      }
      try {
        const res = await fetch(src);
        if (!res.ok) return null;
        const jsText = await res.text();
        const origType = (scriptEl.getAttribute("type") || "").trim();
        const hasDefer = scriptEl.hasAttribute("defer");
        const inlineScript = document.createElement("script");
        inlineScript.setAttribute("data-inlined-src", src);
        if (origType) {
          inlineScript.setAttribute("type", origType);
        }
        inlineScript.textContent = jsText.replace(/<\/script>/gi, "<\\/script>");
        const isModule = origType.toLowerCase() === "module";
        const inHead = Boolean(cloneHead && cloneHead.contains(scriptEl));
        const relocateToBody = Boolean(!isModule && hasDefer && inHead && cloneBody);
        return { scriptEl, inlineScript, relocateToBody };
      } catch (_) {
        return null;
      }
    })
  );

  for (const entry of scriptResults) {
    if (!entry) continue;
    if (entry.relocateToBody && cloneBody) {
      entry.scriptEl.remove();
      cloneBody.appendChild(entry.inlineScript);
    } else {
      entry.scriptEl.replaceWith(entry.inlineScript);
    }
  }

  if (tailwindStripped && cloneHead && !cloneHead.querySelector('style[data-inlined-tailwind-fallbacks]')) {
    const fallbackStyle = document.createElement("style");
    fallbackStyle.setAttribute("data-inlined-tailwind-fallbacks", "true");
    fallbackStyle.textContent = [
      ".hidden { display: none; }",
      ".line-through { text-decoration-line: line-through; }",
      ".opacity-0 { opacity: 0; }",
      ".opacity-50 { opacity: 0.5; }",
      ".opacity-60 { opacity: 0.6; }",
      ".opacity-100 { opacity: 1; }"
    ].join("\n");
    cloneHead.appendChild(fallbackStyle);
  }

  const serialized = "<!DOCTYPE html>\n" + clone.outerHTML;
  return publishedMode ? HTMLReportPublisher.normalizeSerialized(serialized) : serialized;
}

/**
 * Resizes active Chart.js instances so canvases fit print/A4 margins cleanly.
 */
function resizeChartsForPrint() {
  if (typeof window === "undefined") return;
  if (Array.isArray(window.reportCharts)) {
    window.reportCharts.forEach((chart) => {
      try {
        if (chart && typeof chart.resize === "function") chart.resize();
      } catch (_) {}
    });
  }
}

/**
 * Triggers PDF export / print dialog.
 */
function exportReportPdf() {
  if (typeof window === "undefined") return;
  resizeChartsForPrint();
  resizePresentationWidgets();
  if (window.reportLeafletMap && typeof window.reportLeafletMap.invalidateSize === "function") {
    window.reportLeafletMap.invalidateSize();
  }
  window.print();
}

/**
 * Mode-adaptive navbar status badge and download options.
 */
function initModeBadge() {
  if (typeof document === "undefined") return;
  const rawMode = document.documentElement.getAttribute("data-report-mode") || "report";
  const badgeEl = document.getElementById("navbar-mode-badge");
  const pdfStatusBadge = document.querySelector("#download-pdf-btn .badge");

  if (badgeEl) {
    badgeEl.classList.remove("hidden", "badge-neutral", "badge-primary", "badge-secondary", "badge-accent", "badge-info", "badge-success", "badge-warning", "badge-ghost");

    switch (rawMode) {
      case "print":
        badgeEl.textContent = "PRINT";
        badgeEl.classList.add("badge-neutral");
        break;
      case "presentation":
        badgeEl.textContent = "PRESENTATION";
        badgeEl.classList.add("badge-secondary");
        break;
      case "dashboard":
        badgeEl.textContent = "DASHBOARD";
        badgeEl.classList.add("badge-info");
        break;
      case "working-report":
        badgeEl.textContent = "JOURNEY";
        badgeEl.classList.add("badge-accent");
        break;
      case "live-report":
        badgeEl.innerHTML = `<span class="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse mr-1"></span>LIVE`;
        badgeEl.classList.add("badge-success", "badge-outline");
        break;
      case "pwa":
        badgeEl.textContent = "PWA";
        badgeEl.classList.add("badge-accent");
        break;
      case "report":
      default:
        badgeEl.textContent = "REPORT";
        badgeEl.classList.add("badge-ghost");
        break;
    }
  }

  if (pdfStatusBadge && rawMode === "print") {
    pdfStatusBadge.textContent = "PDF-Ready";
    pdfStatusBadge.classList.remove("badge-warning");
    pdfStatusBadge.classList.add("badge-success");
  }
}

let deferredPwaInstallPrompt = null;

/**
 * Synchronizes <meta name="theme-color"> with the active DaisyUI theme palette.
 */
function syncPwaThemeColor(palette = null) {
  if (typeof document === "undefined") return;
  const meta = (typeof document.getElementById === "function" && document.getElementById("pwa-theme-color")) ||
               (typeof document.querySelector === "function" ? document.querySelector('meta[name="theme-color"]') : null);
  if (!meta) return;
  const pal = palette || (typeof resolveDaisyUIThemePalette === "function" ? resolveDaisyUIThemePalette() : {});
  const hex = pal?.primary?.hex || pal?.base100?.hex || "#2563eb";
  if (typeof meta.setAttribute === "function") {
    meta.setAttribute("content", hex);
  }
}

/**
 * Initializes Progressive Web App (PWA) client runtime:
 * - Service worker registration
 * - Native beforeinstallprompt interception and navbar install button wiring
 * - Online / Offline network health indicator
 * - Dynamic theme-color sync
 */
function initPwa() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const manifestLink = typeof document.querySelector === "function" ? document.querySelector('link[rel="manifest"]') : null;
  if (!manifestLink) {
    return; // Not a PWA-enabled report, skip Service Worker registration & install wiring
  }

  // 1. Service Worker Registration
  if ("serviceWorker" in navigator) {
    const isHttp = location.protocol === "http:" || location.protocol === "https:";
    if (isHttp && !window.__PWA_SW_REGISTERED__) {
      window.__PWA_SW_REGISTERED__ = true;
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js")
          .then((reg) => {
            window.__PWA_REGISTRATION__ = reg;
            reg.addEventListener("updatefound", () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                    console.log("[html-report PWA] New version available. Refresh to update.");
                  }
                });
              }
            });
          })
          .catch((err) => {
            // Local dev or sandbox
          });
      });
    }
  }

  // 2. Native PWA Install Prompt Interception
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPwaInstallPrompt = e;
    const installBtn = document.getElementById("pwa-install-btn");
    if (installBtn) installBtn.classList.remove("hidden");
    const menuItem = document.getElementById("pwa-install-menu-item");
    if (menuItem) menuItem.classList.remove("hidden");
  });

  const triggerInstall = async () => {
    if (!deferredPwaInstallPrompt) {
      alert("To install this report as an app, use your browser menu ('Install' or 'Add to Home Screen').");
      return;
    }
    deferredPwaInstallPrompt.prompt();
    const choice = await deferredPwaInstallPrompt.userChoice;
    if (choice && choice.outcome === "accepted") {
      const installBtn = document.getElementById("pwa-install-btn");
      if (installBtn) installBtn.classList.add("hidden");
    }
    deferredPwaInstallPrompt = null;
  };

  window.triggerPwaInstall = triggerInstall;

  const pwaBtn = document.getElementById("pwa-install-btn");
  if (pwaBtn) pwaBtn.addEventListener("click", triggerInstall);

  const pwaDropdownBtn = document.getElementById("pwa-install-dropdown-btn");
  if (pwaDropdownBtn) pwaDropdownBtn.addEventListener("click", triggerInstall);

  window.addEventListener("appinstalled", () => {
    const installBtn = document.getElementById("pwa-install-btn");
    if (installBtn) installBtn.classList.add("hidden");
    const statusBadge = document.getElementById("pwa-install-status-badge");
    if (statusBadge) {
      statusBadge.textContent = "Installed";
      statusBadge.className = "badge badge-success badge-xs font-mono";
    }
    deferredPwaInstallPrompt = null;
  });

  // 3. Online / Offline Status Detection
  function updateNetworkStatus() {
    const offlineBadge = document.getElementById("pwa-offline-badge");
    if (!offlineBadge) return;
    if (navigator.onLine === false) {
      offlineBadge.classList.remove("hidden");
    } else {
      offlineBadge.classList.add("hidden");
    }
  }
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  updateNetworkStatus();

  // 4. Initial Theme-Color Sync
  setTimeout(() => syncPwaThemeColor(), 100);
}

function _triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Initializes the download menu actions (HTML & PDF).
 */
function initDownloadButton() {
  if (typeof document === "undefined") return;
  const htmlBtn = document.getElementById("download-html-btn");
  const pdfBtn = document.getElementById("download-pdf-btn");

  initModeBadge();

  if (htmlBtn) {
    htmlBtn.addEventListener("click", async () => {
      try {
        htmlBtn.disabled = true;
        const isPub = typeof HTMLReportPublisher !== "undefined" && typeof HTMLReportPublisher.isPublishedFlagOn === "function" && HTMLReportPublisher.isPublishedFlagOn();
        if (isPub && typeof HTMLReportPublisher !== "undefined" && typeof HTMLReportPublisher.tryServerPublishDownload === "function") {
          const serverRes = await HTMLReportPublisher.tryServerPublishDownload();
          if (serverRes && serverRes.ok) return;
        }
        const htmlContent = await buildInlinedHtmlSnapshot(isPub ? { mode: "published" } : {});
        const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
        const docTitle = document.title || "html-report";
        const baseName = docTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "html-report";
        _triggerBlobDownload(blob, isPub ? `${baseName}-published.html` : `${baseName}-standalone.html`);
      } catch (err) {
        console.error("[html-report] Failed to bundle inlined HTML snapshot:", err);
      } finally {
        htmlBtn.disabled = false;
      }
    });
  }

  if (pdfBtn) {
    pdfBtn.addEventListener("click", () => {
      const reportMode = document.documentElement.getAttribute("data-report-mode") || "report";
      if (reportMode !== "print") {
        const modal = document.getElementById("pdf-not-ready-modal");
        if (modal && typeof modal.showModal === "function") {
          modal.showModal();
          return;
        }
      }
      exportReportPdf();
    });
  }
}

