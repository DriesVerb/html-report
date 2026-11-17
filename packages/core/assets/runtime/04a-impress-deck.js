/**
 * Impress.js runtime initialization with strict presentation guard.
 * Only initializes 3D canvas when explicitly requested as a presentation.
 */
function initImpress() {
  if (typeof window === "undefined") return;

  const impressRoot = document.getElementById("impress");
  if (!impressRoot) return;

  // Setup presentation mode observer once
  if (!window._impressObserverInstalled) {
    window._impressObserverInstalled = true;
    const observer = new MutationObserver(() => {
      initImpress();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-presentation"] });
    if (document.body) {
      observer.observe(document.body, { attributes: true, attributeFilter: ["data-presentation"] });
    }
  }

  // Presentation Guard: Impress 3D initialization ONLY activates when explicitly requested
  const isPresentationRequested =
    document.documentElement.getAttribute("data-presentation") === "true" ||
    document.body.getAttribute("data-presentation") === "true" ||
    impressRoot.getAttribute("data-presentation") === "true" ||
    impressRoot.classList.contains("impress-presentation-active");

  if (!isPresentationRequested) {
    // Treat as print/static: slides remain stacked in standard document flow
    impressRoot.classList.add("impress-static-fallback");
    return;
  }

  // Presentation mode active: clear static fallback
  impressRoot.classList.remove("impress-static-fallback");

  if (!window.impress) {
    console.warn("[html-report] Impress.js script not loaded.");
    return;
  }

  try {
    if (!impressRoot.dataset.impressInitialized) {
      impressRoot.dataset.impressInitialized = "true";
      const api = window.impress("impress");
      api.init();
      window.impressApi = api;
    } else if (window.impressApi && typeof window.impressApi.goto === "function") {
      window.impressApi.goto(0);
    }
  } catch (err) {
    console.warn("[html-report] Impress.js initialization notice:", err);
  }
}

function impressNext() {
  if (typeof window !== "undefined" && window.impressApi && typeof window.impressApi.next === "function") {
    return window.impressApi.next();
  }
}

function impressPrev() {
  if (typeof window !== "undefined" && window.impressApi && typeof window.impressApi.prev === "function") {
    return window.impressApi.prev();
  }
}

function impressGoto(step) {
  if (typeof window !== "undefined" && window.impressApi && typeof window.impressApi.goto === "function") {
    return window.impressApi.goto(step);
  }
}

