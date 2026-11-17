const DAISYUI_THEMES = [
  "light", "dark", "cupcake", "bumblebee", "emerald", "corporate", "synthwave",
  "retro", "cyberpunk", "valentine", "halloween", "garden", "forest", "aqua",
  "lofi", "pastel", "fantasy", "wireframe", "black", "luxury", "dracula",
  "cmyk", "autumn", "business", "acid", "lemonade", "night", "coffee", "winter",
  "dim", "nord", "sunset"
];

let lastScaffoldedProject = null;
let activeWorkspaceSlug = null;
let workspaceDirty = false;
let lastSyncedWorkspaceSnapshot = null;
let isSyncingWorkspaceState = false;
let studioInitialized = false;
let agentBridgePreflightOk = false;
let agentBridgeCsrfToken = null;

function slugifyClient(raw = "") {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function getActiveOrTypedSlug() {
  if (activeWorkspaceSlug) return activeWorkspaceSlug;
  return slugifyClient(document.getElementById("input-project-slug")?.value || "");
}

function getWorkspaceConfigSnapshot() {
  const payload = collectStudioPayload();
  return JSON.stringify({
    target: payload.target,
    operationalMode: payload.operationalMode,
    behavioralMode: payload.behavioralMode,
    appPackaging: payload.appPackaging,
    theme: payload.theme,
    customTheme: payload.customTheme,
    userGoals: payload.userGoals,
    userAudience: payload.userAudience,
    addons: payload.addons,
    widgets: payload.widgets,
    referenceFiles: payload.referenceFiles,
    ai: payload.ai,
    aiPort: payload.aiPort,
    aiPurpose: payload.aiPurpose,
    aiDock: payload.aiDock
  });
}

function updateWorkspaceActionButtons() {
  const updateBtn = document.getElementById("btn-update-workspace");
  const step6UpdateBtn = document.getElementById("btn-update-workspace-step6");
  const step6JumpLink = document.getElementById("step-output-workspace-jump");
  const hasActive = Boolean(activeWorkspaceSlug);
  if (updateBtn) {
    updateBtn.classList.toggle("hidden", !(hasActive && workspaceDirty));
  }
  if (step6UpdateBtn) {
    step6UpdateBtn.classList.toggle("hidden", !hasActive);
    step6UpdateBtn.classList.toggle("btn-warning", Boolean(hasActive && workspaceDirty));
    step6UpdateBtn.classList.toggle("btn-primary", !(hasActive && workspaceDirty));
  }
  if (step6JumpLink) {
    step6JumpLink.classList.toggle("hidden", hasActive);
  }
}

function onProjectSlugInput() {
  const rawVal = document.getElementById("input-project-slug")?.value || "";
  const typedSlug = slugifyClient(rawVal);
  if (activeWorkspaceSlug && typedSlug !== activeWorkspaceSlug) {
    activeWorkspaceSlug = null;
    workspaceDirty = false;
    lastScaffoldedProject = null;
    lastSyncedWorkspaceSnapshot = null;
    const banner = document.getElementById("scaffold-result-banner");
    if (banner) banner.classList.add("hidden");
    clearScaffoldError();
    setWorkspaceLifecycleState("draft");
  }
  updatePromptAndPreview();
}

function onProjectSlugBlur() {
  const typedSlug = slugifyClient(document.getElementById("input-project-slug")?.value || "");
  if (typedSlug && window.location.protocol !== "file:" && typeof syncProjectWorkspaceFiles === "function") {
    syncProjectWorkspaceFiles(typedSlug);
  }
}

function getSelectedWidgets() {
  return Array.from(document.querySelectorAll(".widget-preset-chk:checked"))
    .map((el) => el.getAttribute("data-widget"))
    .filter(Boolean);
}

function onWidgetPresetToggle(chk) {
  const widgetKey = chk?.getAttribute("data-widget");
  if (chk?.checked) {
    if (widgetKey === "chart-pair") {
      const el = document.getElementById("chk-charts");
      if (el) el.checked = true;
    } else if (widgetKey === "grid-table") {
      const el = document.getElementById("chk-gridjs");
      if (el) el.checked = true;
    } else if (widgetKey === "mermaid-flow") {
      const el = document.getElementById("chk-mermaid");
      if (el) el.checked = true;
    }
  }
  updatePromptAndPreview();
}

function createThemeSwatchItem(theme, currentActive, onSelect) {
  const isCustom = userCustomTheme && theme === userCustomTheme.name;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("data-theme", theme);
  btn.setAttribute("data-set-theme", theme);
  btn.className = "theme-swatch-item outline-base-content text-start rounded-btn w-full cursor-pointer font-sans";
  
  let swatchHtml = "";
  if (isCustom && userCustomTheme.colors) {
    swatchHtml = `
      <span class="rounded-badge w-2 h-4" style="background-color: ${userCustomTheme.colors.primary};"></span>
      <span class="rounded-badge w-2 h-4" style="background-color: ${userCustomTheme.colors.secondary};"></span>
      <span class="rounded-badge w-2 h-4" style="background-color: ${userCustomTheme.colors.accent};"></span>
      <span class="rounded-badge w-2 h-4" style="background-color: ${userCustomTheme.colors.neutral};"></span>
    `;
  } else {
    swatchHtml = `
      <span class="bg-primary rounded-badge w-2 h-4"></span>
      <span class="bg-secondary rounded-badge w-2 h-4"></span>
      <span class="bg-accent rounded-badge w-2 h-4"></span>
      <span class="bg-neutral rounded-badge w-2 h-4"></span>
    `;
  }

  btn.innerHTML = `
    <span class="bg-base-100 rounded-btn text-base-content block w-full cursor-pointer font-sans border border-base-300 hover:border-primary transition">
      <span class="grid grid-cols-5 grid-rows-3">
        <span class="col-span-5 row-span-3 row-start-1 flex items-center gap-2 px-3 py-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="theme-check h-3.5 w-3.5 shrink-0 ${theme === currentActive ? "opacity-100" : "opacity-0"}">
            <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"></path>
          </svg>
          <span class="flex-grow text-xs font-semibold capitalize flex items-center gap-1.5">
            <span>${theme}</span>
            ${isCustom ? '<span class="badge badge-primary badge-xs scale-90 font-mono">Custom</span>' : ''}
          </span>
          <span class="flex h-full shrink-0 flex-wrap gap-1" data-swatch-preview="${theme}">
            ${swatchHtml}
          </span>
        </span>
      </span>
    </span>
  `;
  btn.addEventListener("click", () => {
    onSelect(theme);
    // Cleanly blur dropdown trigger to close dropdown in all browsers
    const dd = btn.closest(".dropdown");
    if (dd) {
      const trigger = dd.querySelector('[role="button"]');
      if (trigger && typeof trigger.blur === "function") trigger.blur();
    }
    if (document.activeElement && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }
  });
  return btn;
}

function initNavbarThemeDropdown() {
  const listEl = document.getElementById("theme-swatch-list");
  if (!listEl) return;
  listEl.innerHTML = "";
  const current = document.documentElement.getAttribute("data-theme") || "light";
  DAISYUI_THEMES.forEach((theme) => {
    listEl.appendChild(createThemeSwatchItem(theme, current, (t) => {
      setStudioTheme(t);
    }));
  });
}

function updateNavbarThemeDropdown() {
  const listEl = document.getElementById("theme-swatch-list");
  if (!listEl) return;
  const current = document.documentElement.getAttribute("data-theme") || "light";
  listEl.querySelectorAll(".theme-check").forEach((check, i) => {
    const theme = DAISYUI_THEMES[i];
    if (theme === current) {
      check.classList.remove("opacity-0");
      check.classList.add("opacity-100");
    } else {
      check.classList.remove("opacity-100");
      check.classList.add("opacity-0");
    }
  });
}

function initInitialThemeDropdown() {
  const listEl = document.getElementById("initial-theme-swatch-list");
  if (!listEl) return;
  listEl.innerHTML = "";
  DAISYUI_THEMES.forEach((theme) => {
    listEl.appendChild(createThemeSwatchItem(theme, currentTheme, (t) => {
      changeDefaultTheme(t);
    }));
  });
}

function updateInitialThemeDropdown() {
  const listEl = document.getElementById("initial-theme-swatch-list");
  if (!listEl) return;
  listEl.querySelectorAll(".theme-check").forEach((check, i) => {
    const theme = DAISYUI_THEMES[i];
    if (theme === currentTheme) {
      check.classList.remove("opacity-0");
      check.classList.add("opacity-100");
    } else {
      check.classList.remove("opacity-100");
      check.classList.add("opacity-0");
    }
  });
}

function setStudioTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const label = document.getElementById("active-studio-theme");
  if (label) label.textContent = theme;
  const swatches = document.getElementById("navbar-theme-swatches");
  if (swatches) swatches.setAttribute("data-theme", theme);
  updateNavbarThemeDropdown();
}

function changeDefaultTheme(theme) {
  currentTheme = theme;
  const initialLabel = document.getElementById("initial-theme-label");
  if (initialLabel) initialLabel.textContent = theme;
  const initialSwatches = document.getElementById("initial-theme-swatches");
  if (initialSwatches) initialSwatches.setAttribute("data-theme", theme);
  const sel = document.getElementById("select-default-theme");
  if (sel) sel.value = theme;
  setStudioTheme(theme);
  updateInitialThemeDropdown();
  updatePromptAndPreview();
  if (typeof window.closeAllNavbarDropdowns === "function") {
    window.closeAllNavbarDropdowns("studio-settings-dropdown");
  }
}

function syncThemeInput(colorKey, val, source) {
  let clean = (val || "").trim();
  const textId = colorKey === "base-100" ? "text-base" : `text-${colorKey}`;
  const pickerId = colorKey === "base-100" ? "picker-base" : `picker-${colorKey}`;
  if (source === "color") {
    const textEl = document.getElementById(textId);
    if (textEl) textEl.value = clean.toUpperCase();
  } else {
    if (!clean.startsWith("#")) clean = "#" + clean;
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(clean)) {
      const pickerEl = document.getElementById(pickerId);
      if (pickerEl) pickerEl.value = clean;
    }
  }
}

function hexToOklch(hex) {
  let clean = (hex || "").replace(/^#/, "").trim();
  if (clean.length === 3) clean = clean.split("").map((c) => c + c).join("");
  if (clean.length !== 6) return "60% 0.15 250";
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return "60% 0.15 250";
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const s2l = (c) => {
    const n = c / 255;
    return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  const lr = s2l(r), lg = s2l(g), lb = s2l(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6261798610 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C = Math.sqrt(a * a + b_ * b_);
  let H = Math.atan2(b_, a) * (180 / Math.PI);
  if (H < 0) H += 360;
  return `${(L * 100).toFixed(2)}% ${C.toFixed(3)} ${H.toFixed(2)}`;
}

function getContrastOklch(hex) {
  let clean = (hex || "").replace(/^#/, "").trim();
  if (clean.length === 3) clean = clean.split("").map((c) => c + c).join("");
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return "0% 0 0";
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "20% 0.03 260" : "98% 0.01 260";
}

function injectCustomThemeCss(customTheme) {
  let styleEl = document.getElementById("daisyui-custom-themes");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "daisyui-custom-themes";
    document.head.appendChild(styleEl);
  }
  const name = customTheme.name;
  const colors = customTheme.colors;
  const pOklch = hexToOklch(colors.primary);
  const sOklch = hexToOklch(colors.secondary);
  const aOklch = hexToOklch(colors.accent);
  const nOklch = hexToOklch(colors.neutral);
  const b1Oklch = hexToOklch(colors["base-100"]);
  const pcOklch = getContrastOklch(colors.primary);
  const scOklch = getContrastOklch(colors.secondary);
  const acOklch = getContrastOklch(colors.accent);
  const ncOklch = getContrastOklch(colors.neutral);
  const bcOklch = getContrastOklch(colors["base-100"]);

  styleEl.textContent = `
    [data-theme="${name}"] {
      color-scheme: light;
      --p: ${pOklch};
      --pc: ${pcOklch};
      --s: ${sOklch};
      --sc: ${scOklch};
      --a: ${aOklch};
      --ac: ${acOklch};
      --n: ${nOklch};
      --nc: ${ncOklch};
      --b1: ${b1Oklch};
      --b2: ${b1Oklch};
      --b3: ${b1Oklch};
      --bc: ${bcOklch};
      --rounded-box: 1rem;
      --rounded-btn: 0.5rem;
      --rounded-badge: 1.9rem;
      --animation-btn: 0.25s;
      --animation-input: .2s;
      --btn-focus-scale: 0.95;
      --border-btn: 1px;
      --tab-border: 1px;
      --tab-radius: 0.5rem;
    }
  `;
}

function saveCustomTheme() {
  const nameInput = document.getElementById("custom-theme-name-input");
  let rawName = nameInput ? nameInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") : "";
  if (!rawName) rawName = "user";

  const primaryVal = document.getElementById("text-primary")?.value.trim() || "#4f46e5";
  const secondaryVal = document.getElementById("text-secondary")?.value.trim() || "#ec4899";
  const accentVal = document.getElementById("text-accent")?.value.trim() || "#f59e0b";
  const neutralVal = document.getElementById("text-neutral")?.value.trim() || "#1e293b";
  const baseVal = document.getElementById("text-base")?.value.trim() || "#ffffff";

  // Enforce: "a user can for now only manage one custom theme per creation"
  if (userCustomTheme && userCustomTheme.name !== rawName) {
    const oldIdx = DAISYUI_THEMES.indexOf(userCustomTheme.name);
    if (oldIdx !== -1) DAISYUI_THEMES.splice(oldIdx, 1);
  }

  // Add/update new custom theme at top of dropdown
  const existingIdx = DAISYUI_THEMES.indexOf(rawName);
  if (existingIdx !== -1) {
    DAISYUI_THEMES.splice(existingIdx, 1);
  }
  DAISYUI_THEMES.unshift(rawName);

  userCustomTheme = {
    name: rawName,
    colors: {
      primary: primaryVal,
      secondary: secondaryVal,
      accent: accentVal,
      neutral: neutralVal,
      "base-100": baseVal
    }
  };

  injectCustomThemeCss(userCustomTheme);

  if (nameInput) nameInput.value = rawName;
  const badge = document.getElementById("custom-theme-badge");
  if (badge) badge.textContent = `Theme: ${rawName}`;

  initNavbarThemeDropdown();
  initInitialThemeDropdown();
  changeDefaultTheme(rawName);

  const btn = document.getElementById("btn-save-custom-theme");
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="check" class="w-3 h-3 text-success"></i> Added "${rawName}"!`;
    setTimeout(() => {
      btn.innerHTML = orig;
      if (window.lucide) window.lucide.createIcons();
    }, 2000);
  }
}

function selectWizardTarget(target, cardEl) {
  currentTarget = target;
  document.querySelectorAll(".wizard-target-card").forEach((c) => {
    c.classList.remove("border-primary", "bg-primary/5", "border-2");
    c.classList.add("border-base-300", "bg-base-100");
    c.querySelector(".target-check-badge")?.classList.add("hidden");
  });
  cardEl.classList.remove("border-base-300", "bg-base-100");
  cardEl.classList.add("border-primary", "bg-primary/5", "border-2");
  cardEl.querySelector(".target-check-badge")?.classList.remove("hidden");

  // Constraint pruning: Printable PDF is strictly static paper document
  const liveModeCard = document.querySelector('[data-mode="live"]');
  const staticModeCard = document.querySelector('[data-mode="static"]');
  const modeNotice = document.getElementById("mode-status-badge");

  const liveAppCard = document.getElementById("app-card-live");
  const offlineAppCard = document.getElementById("app-card-offline");
  const noneAppCard = document.getElementById("app-card-none");
  const printAppHint = document.getElementById("print-app-hint");
  const appBadge = document.getElementById("app-status-badge");

  if (target === "print") {
    selectWizardMode("static", staticModeCard);
    selectWizardBehavioral("passive", document.querySelector('[data-behavioral="passive"]'));
    if (liveModeCard) liveModeCard.classList.add("opacity-40", "pointer-events-none");
    if (modeNotice) modeNotice.textContent = "Print mode: Locked to Static + Passive";

    // Eliminate offline-first app and install-app in print mode
    if (liveAppCard) liveAppCard.classList.add("hidden");
    if (offlineAppCard) offlineAppCard.classList.add("hidden");
    if (printAppHint) printAppHint.classList.remove("hidden");
    if (appBadge) appBadge.textContent = "Print: Browser Only";
    selectWizardApp("none", noneAppCard);
  } else {
    if (liveModeCard) liveModeCard.classList.remove("opacity-40", "pointer-events-none");
    if (modeNotice) modeNotice.textContent = "Core Transport";

    // Restore app options when not in print mode
    if (liveAppCard) liveAppCard.classList.remove("hidden");
    if (offlineAppCard) offlineAppCard.classList.remove("hidden");
    if (printAppHint) printAppHint.classList.add("hidden");
    if (appBadge) appBadge.textContent = "PWA Packaging";

    if (target === "dashboard" && currentMode === "static") {
      selectWizardMode("live", liveModeCard);
    }
    if (currentBehavioral === "passive") {
      selectWizardBehavioral("interactive", document.querySelector('[data-behavioral="interactive"]'));
    }
  }

  updatePromptAndPreview();
}

function selectWizardBehavioral(behavioral, btnEl) {
  if (currentTarget === "print" && behavioral !== "passive") {
    behavioral = "passive";
  }
  currentBehavioral = behavioral;
  document.querySelectorAll(".wizard-behavioral-btn").forEach((b) => {
    b.classList.remove("btn-accent");
    b.classList.add("btn-outline");
  });
  if (btnEl) {
    btnEl.classList.remove("btn-outline");
    btnEl.classList.add("btn-accent");
  }
  updatePromptAndPreview();
}

function selectWizardMode(mode, cardEl) {
  currentMode = mode;
  document.querySelectorAll(".wizard-mode-card").forEach((c) => {
    c.classList.remove("border-secondary", "bg-secondary/5", "border-2");
    c.classList.add("border-base-300", "bg-base-100");
    c.querySelector(".mode-check-badge")?.classList.add("hidden");
  });
  if (cardEl) {
    cardEl.classList.remove("border-base-300", "bg-base-100");
    cardEl.classList.add("border-secondary", "bg-secondary/5", "border-2");
    cardEl.querySelector(".mode-check-badge")?.classList.remove("hidden");
  }

  // Enable or disable Intelligence Features based on Mode
  const containerAi = document.getElementById("container-chk-ai");
  const containerMcp = document.getElementById("container-chk-mcp");
  const chkAi = document.getElementById("chk-ai-agent");
  const chkMcp = document.getElementById("chk-mcp-tools");
  const intelNotice = document.getElementById("intel-notice-badge");

  if (mode === "live") {
    if (containerAi) containerAi.classList.remove("opacity-50", "pointer-events-none");
    if (containerMcp) containerMcp.classList.remove("opacity-50", "pointer-events-none");
    if (intelNotice) { intelNotice.textContent = "Features Active"; intelNotice.classList.add("badge-success"); }
  } else {
    if (containerAi) containerAi.classList.add("opacity-50", "pointer-events-none");
    if (containerMcp) containerMcp.classList.add("opacity-50", "pointer-events-none");
    if (chkAi) chkAi.checked = false;
    if (chkMcp) chkMcp.checked = false;
    const aiConfigPanel = document.getElementById("ai-turnkey-config");
    if (aiConfigPanel) aiConfigPanel.classList.add("hidden");
    if (intelNotice) { intelNotice.textContent = "Requires Live Mode"; intelNotice.classList.remove("badge-success"); }
  }

  updatePromptAndPreview();
}

function selectWizardApp(appMode, cardEl) {
  if (currentTarget === "print" && appMode !== "none") {
    appMode = "none";
  }
  currentApp = appMode;
  document.querySelectorAll(".wizard-app-card").forEach((c) => {
    c.classList.remove("border-info", "bg-info/5", "border-2");
    c.classList.add("border-base-300", "bg-base-100");
    c.querySelector(".app-check-badge")?.classList.add("hidden");
  });
  if (cardEl) {
    cardEl.classList.remove("border-base-300", "bg-base-100");
    cardEl.classList.add("border-info", "bg-info/5", "border-2");
    cardEl.querySelector(".app-check-badge")?.classList.remove("hidden");
  }
  updatePromptAndPreview();
}
