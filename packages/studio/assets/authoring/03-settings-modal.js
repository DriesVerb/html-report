// Extend HTMLReportSettings with All Settings Modal controls
if (HTMLReportSettings) {
  Object.assign(HTMLReportSettings, {
  initAllSettingsModal() {
    if (typeof document === "undefined") return;
    const modal = document.getElementById("all-settings-modal");
    const openBtn = document.getElementById("open-all-settings-btn");
    if (!modal) return;

    if (openBtn && !openBtn.__wired) {
      openBtn.__wired = true;
      openBtn.addEventListener("click", () => {
        if (HTMLReportSettings.close) HTMLReportSettings.close();
        if (typeof modal.showModal === "function") {
          modal.showModal();
        } else {
          modal.setAttribute("open", "true");
        }
        this.refreshModalState();
      });
    }

    // Tab switching inside modal
    const tabBtns = modal.querySelectorAll('.tabs [role="tab"]');
    tabBtns.forEach((tab) => {
      if (tab.__wired) return;
      tab.__wired = true;
      tab.addEventListener("click", () => {
        const targetId = tab.getAttribute("data-tab-target");
        tabBtns.forEach((t) => t.classList.remove("tab-active"));
        tab.classList.add("tab-active");
        modal.querySelectorAll(".settings-tab-panel").forEach((p) => {
          p.classList.toggle("hidden", p.id !== targetId);
        });
      });
    });

    // Populate 32-theme selector grid (re-populate if custom themes were added)
    const themeGrid = document.getElementById("modal-theme-grid");
    if (themeGrid && typeof DAISYUI_THEMES !== "undefined" && themeGrid.__populatedCount !== DAISYUI_THEMES.length) {
      themeGrid.__populatedCount = DAISYUI_THEMES.length;
      themeGrid.innerHTML = "";
      const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
      DAISYUI_THEMES.forEach((theme) => {
        const item = document.createElement("button");
        item.type = "button";
        item.setAttribute("data-theme", theme);
        item.setAttribute("data-modal-set-theme", theme);
        item.className = "outline-base-content text-start rounded-btn cursor-pointer font-sans w-full transition";
        item.innerHTML = `
          <div class="bg-base-100 rounded-btn text-base-content block w-full p-2.5 border ${theme === currentTheme ? "border-primary ring-2 ring-primary/30" : "border-base-300"} hover:border-primary transition">
            <div class="flex items-center justify-between gap-1.5">
              <div class="flex items-center gap-1.5 min-w-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="modal-theme-check h-3 w-3 shrink-0 ${theme === currentTheme ? "opacity-100 text-primary" : "opacity-0"}">
                  <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"></path>
                </svg>
                <span class="text-xs font-semibold capitalize truncate">${theme}</span>
              </div>
              <div class="flex shrink-0 gap-0.5">
                <span class="bg-primary rounded-badge w-1.5 h-3"></span>
                <span class="bg-secondary rounded-badge w-1.5 h-3"></span>
                <span class="bg-accent rounded-badge w-1.5 h-3"></span>
                <span class="bg-neutral rounded-badge w-1.5 h-3"></span>
              </div>
            </div>
          </div>
        `;
        item.addEventListener("click", () => {
          if (typeof setReportTheme === "function") setReportTheme(theme);
          this.refreshModalState();
        });
        themeGrid.appendChild(item);
      });
    }

    // Modal publish toggle
    const pubToggle = document.getElementById("modal-publish-toggle");
    if (pubToggle && !pubToggle.__wired) {
      pubToggle.__wired = true;
      pubToggle.addEventListener("change", () => {
        if (typeof HTMLReportPublisher !== "undefined") {
          HTMLReportPublisher.setPublishedFlag(pubToggle.checked);
        }
      });
    }

    // Modal download actions forwarding
    const modalDownHtml = document.getElementById("modal-download-html-btn");
    const htmlBtn = document.getElementById("download-html-btn");
    if (modalDownHtml && htmlBtn && !modalDownHtml.__wired) {
      modalDownHtml.__wired = true;
      modalDownHtml.addEventListener("click", () => htmlBtn.click());
    }

    const modalDownPdf = document.getElementById("modal-download-pdf-btn");
    const pdfBtn = document.getElementById("download-pdf-btn");
    if (modalDownPdf && pdfBtn && !modalDownPdf.__wired) {
      modalDownPdf.__wired = true;
      modalDownPdf.addEventListener("click", () => pdfBtn.click());
    }

    // Modal AI toggle
    const modalAiToggle = document.getElementById("modal-ai-toggle");
    if (modalAiToggle && !modalAiToggle.__wired) {
      modalAiToggle.__wired = true;
      modalAiToggle.addEventListener("change", () => {
        if (typeof HTMLReportAgent !== "undefined") {
          HTMLReportAgent.setAiActive(modalAiToggle.checked);
          this.refreshModalState();
        }
      });
    }

    // Modal Reconnect prompt copy
    const copyBtn = document.getElementById("modal-copy-reconnect-btn");
    if (copyBtn && !copyBtn.__wired) {
      copyBtn.__wired = true;
      copyBtn.addEventListener("click", (e) => {
        if (typeof HTMLReportAgent !== "undefined") {
          HTMLReportAgent.copyReconnectPrompt(e.currentTarget);
        }
      });
    }

    // Modal Page Editor launcher
    const openEditorBtn = document.getElementById("modal-open-editor-btn");
    if (openEditorBtn && !openEditorBtn.__wired) {
      openEditorBtn.__wired = true;
      openEditorBtn.addEventListener("click", () => {
        if (typeof modal.close === "function") modal.close();
        if (typeof HTMLReportEdit !== "undefined") HTMLReportEdit.openDock();
      });
    }

    this.refreshModalState();
  },

  refreshModalState() {
    if (typeof document === "undefined") return;
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const label = document.getElementById("modal-active-theme-label");
    if (label) label.textContent = currentTheme;

    const themeGrid = document.getElementById("modal-theme-grid");
    if (themeGrid) {
      themeGrid.querySelectorAll("[data-modal-set-theme]").forEach((btn) => {
        const isCurrent = btn.getAttribute("data-modal-set-theme") === currentTheme;
        const card = btn.firstElementChild;
        if (card) {
          card.classList.toggle("border-primary", isCurrent);
          card.classList.toggle("ring-2", isCurrent);
          card.classList.toggle("ring-primary/30", isCurrent);
          card.classList.toggle("border-base-300", !isCurrent);
        }
        const check = btn.querySelector(".modal-theme-check");
        if (check) {
          check.classList.toggle("opacity-100", isCurrent);
          check.classList.toggle("text-primary", isCurrent);
          check.classList.toggle("opacity-0", !isCurrent);
        }
      });
    }

    if (typeof HTMLReportPublisher !== "undefined") {
      const isPub = HTMLReportPublisher.isPublishedFlagOn();
      const pt = document.getElementById("modal-publish-toggle");
      if (pt && pt.checked !== isPub) pt.checked = isPub;
      const pb = document.getElementById("modal-publish-badge");
      if (pb) pb.classList.toggle("hidden", !isPub);
    }

    if (typeof HTMLReportAgent !== "undefined") {
      const isAi = HTMLReportAgent.isAiCapable();
      const at = document.getElementById("modal-ai-toggle");
      if (at && at.checked !== isAi) at.checked = isAi;
      const pre = document.getElementById("modal-reconnect-prompt");
      if (pre) pre.textContent = HTMLReportAgent.getReconnectPrompt();
    }
  },
  });
}
