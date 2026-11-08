import fs from "node:fs";
import path from "node:path";
import { VerificationCheck } from "../../registry.mjs";

export class StructureCheck extends VerificationCheck {
  constructor() {
    super({
      id: "core:structure",
      name: "Default 'light' Theme, Content-Aware Favicon, Swapped Navbar, Download Dropdown & Footer",
      category: "core",
      cliFlags: [],
      styleguideRules: [
        "default-theme-light",
        "favicon-present",
        "navbar-hierarchy",
        "download-dropdown-both-options",
        "download-btn-icon-only",
        "toc-mapped-headings",
        "centered-footer",
        "html-snapshot"
      ]
    });
  }

  async run({ page, options }) {
    const errors = [];
    const messages = [];
    const effectiveMode = (options.mode || options.detectedMode || "interactive").toLowerCase();

    const nav = await page.evaluate((currMode) => {
      const initialTheme = document.documentElement.getAttribute("data-theme");
      const activeThemeLabelText = document.getElementById("active-theme-label")?.textContent?.trim() || "";
      const faviconEl = document.querySelector('link[rel="icon"]');
      const faviconHref = faviconEl ? faviconEl.getAttribute("href") : "";
      const hasEmojiFavicon = Boolean(
        faviconHref && (faviconHref.startsWith("data:image/svg+xml") || faviconHref.includes("svg"))
      );

      const navbar = document.querySelector(".navbar");
      const navbarStart = document.querySelector(".navbar .navbar-start");
      const navbarEnd = document.querySelector(".navbar .navbar-end");
      const titleEl = document.getElementById("navbar-report-title");
      const tocDropdown = document.getElementById("toc-dropdown");
      const themeDropdown = document.getElementById("settings-dropdown");
      const downloadDropdown = document.getElementById("download-dropdown");
      const downloadTriggerBtn = document.getElementById("settings-gear-btn");
      const downloadHtmlBtn = document.getElementById("download-html-btn");
      const downloadPdfBtn = document.getElementById("download-pdf-btn");

      const titleInStart = Boolean(navbarStart && titleEl && navbarStart.contains(titleEl));
      const controlsInEnd = Boolean(
        navbarEnd &&
        tocDropdown &&
        themeDropdown &&
        navbarEnd.contains(tocDropdown) &&
        navbarEnd.contains(themeDropdown) &&
        navbarEnd.contains(themeDropdown)
      );

      const startRect = navbarStart ? navbarStart.getBoundingClientRect() : null;
      const endRect = navbarEnd ? navbarEnd.getBoundingClientRect() : null;
      const titleOnLeftAndControlsOnRight =
        startRect && endRect ? startRect.left < endRect.left : false;

      const downloadBtnText = downloadTriggerBtn ? downloadTriggerBtn.textContent.trim() : null;
      const downloadHasIcon = Boolean(downloadTriggerBtn && downloadTriggerBtn.querySelector("svg"));
      const hasBothDownloadOptions = Boolean(
        downloadDropdown &&
        downloadHtmlBtn &&
        downloadPdfBtn &&
        downloadDropdown.contains(downloadHtmlBtn) &&
        downloadDropdown.contains(downloadPdfBtn) &&
        downloadHtmlBtn.textContent.includes("Download as HTML") &&
        downloadPdfBtn.textContent.includes("Download as PDF")
      );

      const pdfBtnText = downloadPdfBtn ? downloadPdfBtn.textContent : "";
      const pdfNotReadyWarning = Boolean(
        downloadPdfBtn &&
        (downloadPdfBtn.querySelector(".badge-warning") ||
          pdfBtnText.includes("Not PDF-Ready") ||
          pdfBtnText.includes("Interactive"))
      );
      const modalEl = document.getElementById("pdf-not-ready-modal");
      const conversionPrompt = document.getElementById("pdf-conversion-prompt-text")?.textContent?.trim() || "";

      const tocLinks = Array.from(document.querySelectorAll("#report-toc-list a[href^='#']"));
      const headings = Array.from(document.querySelectorAll("main h1, main h2, main h3")).filter(
        (h) => !h.closest(".fc, .katex, .gridjs, [aria-hidden='true']") && !h.classList.contains("fc-toolbar-title")
      );
      const missingHeadingIds = headings.filter((h) => !h.id).map((h) => h.textContent.trim());
      const unmappedHeadings = headings
        .filter((h) => !tocLinks.some((a) => a.getAttribute("href") === `#${h.id}`))
        .map((h) => `#${h.id}`);

      const footerEl = document.querySelector("footer");
      const footerText = footerEl ? footerEl.textContent.trim() : "";
      const footerCentered = footerEl ? getComputedStyle(footerEl).textAlign === "center" : false;
      const footerLink = footerEl ? footerEl.querySelector("a") : null;
      const footerLinkValid = Boolean(
        footerLink &&
        footerLink.getAttribute("href") === "https://github.com/DriesVerb/html-report" &&
        footerLink.getAttribute("target") === "_blank" &&
        footerLink.textContent.trim() === "html-report"
      );

      return {
        initialTheme,
        activeThemeLabelText,
        hasEmojiFavicon,
        faviconHref,
        hasNavbar: Boolean(navbar),
        titleText: titleEl ? titleEl.textContent.trim() : "",
        titleInStart,
        controlsInEnd,
        titleOnLeftAndControlsOnRight,
        downloadBtnText,
        downloadHasIcon,
        hasBothDownloadOptions,
        pdfBtnText,
        pdfNotReadyWarning,
        hasModal: Boolean(modalEl),
        conversionPrompt,
        headingCount: headings.length,
        tocLinkCount: tocLinks.length,
        missingHeadingIds,
        unmappedHeadings,
        footerText,
        footerCentered,
        footerLinkValid
      };
    }, effectiveMode);

    if (nav.initialTheme !== "light" || nav.activeThemeLabelText !== "light") {
      errors.push(`Default theme must always be "light" (found data-theme="${nav.initialTheme}", label="${nav.activeThemeLabelText}").`);
    }
    if (!nav.hasEmojiFavicon) {
      errors.push(`Each report must have a favicon in <head> (<link rel="icon">, found "${nav.faviconHref}").`);
    }
    if (!nav.hasNavbar) errors.push("Missing DaisyUI .navbar element.");
    if (!nav.titleText || !nav.titleInStart) {
      errors.push("Report title must be inside .navbar-start on the left.");
    }
    if (!nav.controlsInEnd || !nav.titleOnLeftAndControlsOnRight) {
      errors.push("Contents dropdown and the Settings gear (theme + download) must be in .navbar-end on the right.");
    }
    if (nav.downloadBtnText !== "" || !nav.downloadHasIcon) {
      errors.push(`Settings gear trigger button must be icon-only with no text (found text: "${nav.downloadBtnText}").`);
    }
    if (!nav.hasBothDownloadOptions) {
      errors.push("Download dropdown (#download-dropdown) must include both #download-html-btn ('Download as HTML') and #download-pdf-btn ('Download as PDF').");
    }

    if (effectiveMode === "interactive") {
      if (!nav.pdfNotReadyWarning) {
        errors.push("In Interactive Mode, #download-pdf-btn in the download dropdown must indicate it is not PDF-ready ('Not PDF-Ready' badge or warning).");
      }
      if (!nav.hasModal || !nav.conversionPrompt.includes("@media print")) {
        errors.push("In Interactive Mode, clicking or viewing the PDF option must provide #pdf-not-ready-modal suggesting a prompt to make the report PDF-ready with media print queries.");
      }
    }

    if (nav.missingHeadingIds.length > 0) {
      errors.push(`Headings missing id attribute: ${nav.missingHeadingIds.join(", ")}`);
    }
    if (nav.unmappedHeadings.length > 0) {
      errors.push(`Headings missing from navbar TOC dropdown: ${nav.unmappedHeadings.join(", ")}`);
    }
    if (!nav.footerText.startsWith("generated by html-report") || !nav.footerCentered || !nav.footerLinkValid) {
      errors.push(`Footer must be centered and say "generated by html-report" with <a href="https://github.com/DriesVerb/html-report" target="_blank">html-report</a>.`);
    }

    // HTML snapshot check
    const snapshotCheck = await page.evaluate(async () => {
      if (typeof window.buildInlinedHtmlSnapshot !== "function") return { valid: false };
      const snapshot = await window.buildInlinedHtmlSnapshot();
      return {
        valid: Boolean(snapshot && snapshot.includes("</html>")),
        snapshotKb: Math.round(snapshot.length / 1024)
      };
    });
    if (!snapshotCheck.valid) {
      errors.push("window.buildInlinedHtmlSnapshot() failed to return valid HTML snapshot.");
    }

    // CSV showcase check if present
    const hasCsv = await page.evaluate(() =>
      Boolean(document.getElementById("csv-highlight-banner") || document.getElementById("csv-file-input"))
    );
    if (hasCsv) {
      const csvPath = path.resolve(process.cwd(), "skills/html-report/examples/example.csv");
      if (fs.existsSync(csvPath)) {
        await page.setInputFiles("#csv-file-input", csvPath);
        await page.waitForTimeout(options.quick ? 100 : 300);
        const count = await page.evaluate(() => document.getElementById("csv-matching-count")?.textContent?.trim() || "");
        if (count !== "8 / 8") {
          errors.push(`Expected 8 / 8 rows loaded from example.csv, got "${count}".`);
        }
      }
    }

    // Caller profile check if present
    if (options.caller) {
      try {
        const { resolveCaller } = await import("../../../scripts/caller-registry.mjs");
        const resolved = resolveCaller(options.caller);
        if (!resolved.profilePath || !fs.existsSync(resolved.profilePath)) {
          errors.push(`Caller profile file missing for "${options.caller}".`);
        }
      } catch (err) {
        errors.push(`Caller verification error: ${err.message}`);
      }
    }

    if (errors.length === 0) {
      messages.push(`Default theme: "light", Title: "${nav.titleText}", TOC: ${nav.tocLinkCount}/${nav.headingCount} headings mapped, Footer valid.`);
    }

    return {
      id: this.id,
      name: this.name,
      status: errors.length > 0 ? "failed" : "passed",
      errors,
      messages
    };
  }
}
