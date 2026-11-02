#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const TAILWIND_BREAKPOINTS = [
  { name: "sm", width: 640, height: 800 },
  { name: "md", width: 768, height: 900 },
  { name: "lg", width: 1024, height: 900 },
  { name: "xl", width: 1280, height: 900 },
  { name: "2xl", width: 1536, height: 900 }
];

const QUICK_BREAKPOINTS = [
  { name: "sm", width: 640, height: 800 },
  { name: "lg", width: 1024, height: 900 }
];

function parseArgs(argv) {
  const args = argv.slice(2);
  let htmlPath = null;
  let pdfPath = null;
  let mode = null;
  let caller = null;
  let quick = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pdf" && args[i + 1]) {
      pdfPath = args[++i];
    } else if (args[i] === "--mode" && args[i + 1]) {
      mode = args[++i];
    } else if (args[i] === "--caller" && args[i + 1]) {
      caller = args[++i];
    } else if (args[i] === "--quick" || args[i] === "-q") {
      quick = true;
    } else if (!args[i].startsWith("--") && !htmlPath) {
      htmlPath = args[i];
    }
  }

  return { htmlPath, pdfPath, mode, caller, quick };
}

async function main() {
  const { htmlPath, pdfPath, mode, caller, quick } = parseArgs(process.argv);
  if (!htmlPath) {
    console.error(
      "Usage: node verify-report.mjs <path-to-report.html> [--mode <interactive|static>] [--pdf <output.pdf>] [--caller <caller-id>] [--quick]"
    );
    process.exit(1);
  }

  const resolvedHtmlPath = path.resolve(process.cwd(), htmlPath);
  if (!fs.existsSync(resolvedHtmlPath)) {
    console.error(`Error: HTML report not found at ${resolvedHtmlPath}`);
    process.exit(1);
  }

  const startTime = performance.now();
  const fileUrl = pathToFileURL(resolvedHtmlPath).href;
  console.log(`\n=== Verifying HTML Report: ${resolvedHtmlPath} [${quick ? "QUICK MODE" : "FULL SUITE"}] ===`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedTileResponses = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message || String(err));
  });
  page.on("response", (res) => {
    const url = res.url();
    if (
      (url.includes("tile.openstreetmap.org") ||
        url.includes("basemaps.cartocdn.com") ||
        url.includes("server.arcgisonline.com")) &&
      res.status() >= 400
    ) {
      failedTileResponses.push(`${res.status()} ${url}`);
    }
  });

  if (quick) {
    await page.goto(fileUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForFunction(() => window.__REPORT_READY__ === true, null, { timeout: 4000 }).catch(() => {});
  } else {
    await page.goto(fileUrl, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForFunction(() => window.__REPORT_READY__ === true, null, { timeout: 15000 }).catch(() => {});
  }

  const detectedMode = await page.evaluate(() => {
    return document.documentElement.getAttribute("data-report-mode") || "interactive";
  });
  const effectiveMode = (mode || detectedMode || "interactive").toLowerCase();
  console.log(`Report Mode: ${effectiveMode.toUpperCase()} (mode arg: ${mode || "none"}, detected: ${detectedMode})`);

  const failures = [];

  // 0. Check for Visible "Syntax error in text" on Render
  const initialSyntaxError = await page.evaluate(() => {
    const text = document.body ? (document.body.innerText || "") : "";
    const hasSyntaxError = /syntax error in text/i.test(text);
    const errorSvg = document.querySelectorAll("svg[aria-roledescription='error'], .error-text").length > 0;
    return hasSyntaxError || errorSvg;
  });
  if (initialSyntaxError) {
    failures.push('Visible "Syntax error in text" detected on initial page render.');
  }

  // 1. Check Default Light Theme, Favicon, DaisyUI Navbar, Download Dropdown & Centered Footer
  console.log("\n[1/7] Checking Default 'light' Theme, Content-Aware Favicon, Swapped Navbar, Download Dropdown & Footer...");
  const navAndFooterCheck = await page.evaluate((currMode) => {
    const initialTheme = document.documentElement.getAttribute("data-theme");
    const activeThemeLabelText = document.getElementById("active-theme-label")?.textContent?.trim() || "";
    const faviconEl = document.querySelector('link[rel="icon"]');
    const faviconHref = faviconEl ? faviconEl.getAttribute("href") : "";
    const hasEmojiFavicon = Boolean(
      faviconHref &&
      (faviconHref.startsWith("data:image/svg+xml") || faviconHref.includes("svg"))
    );

    const navbar = document.querySelector(".navbar");
    const navbarStart = document.querySelector(".navbar .navbar-start");
    const navbarEnd = document.querySelector(".navbar .navbar-end");
    const titleEl = document.getElementById("navbar-report-title");
    const tocDropdown = document.getElementById("toc-dropdown");
    const themeDropdown = document.getElementById("theme-dropdown");
    const downloadDropdown = document.getElementById("download-dropdown");
    const downloadTriggerBtn = document.getElementById("download-dropdown-btn");
    const downloadHtmlBtn = document.getElementById("download-html-btn");
    const downloadPdfBtn = document.getElementById("download-pdf-btn");

    const titleInStart = Boolean(navbarStart && titleEl && navbarStart.contains(titleEl));
    const controlsInEnd = Boolean(
      navbarEnd &&
      tocDropdown &&
      themeDropdown &&
      downloadDropdown &&
      navbarEnd.contains(tocDropdown) &&
      navbarEnd.contains(themeDropdown) &&
      navbarEnd.contains(downloadDropdown)
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

    // Interactive mode PDF warning & prompt inspection
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
    const headings = Array.from(document.querySelectorAll("main h1, main h2, main h3"));
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

  if (navAndFooterCheck.initialTheme !== "light" || navAndFooterCheck.activeThemeLabelText !== "light") {
    failures.push(
      `Default theme must always be "light" (found data-theme="${navAndFooterCheck.initialTheme}", label="${navAndFooterCheck.activeThemeLabelText}").`
    );
  }
  if (!navAndFooterCheck.hasEmojiFavicon) {
    failures.push(`Each report must have a favicon in <head> (<link rel="icon">, found "${navAndFooterCheck.faviconHref}").`);
  }
  if (!navAndFooterCheck.hasNavbar) failures.push("Missing DaisyUI .navbar element.");
  if (!navAndFooterCheck.titleText || !navAndFooterCheck.titleInStart) {
    failures.push("Report title must be inside .navbar-start on the left.");
  }
  if (!navAndFooterCheck.controlsInEnd || !navAndFooterCheck.titleOnLeftAndControlsOnRight) {
    failures.push("Contents dropdown, Theme dropdown, and Download dropdown must be in .navbar-end on the right.");
  }
  if (navAndFooterCheck.downloadBtnText !== "" || !navAndFooterCheck.downloadHasIcon) {
    failures.push(`Download dropdown trigger button must be icon-only with no text (found text: "${navAndFooterCheck.downloadBtnText}").`);
  }
  if (!navAndFooterCheck.hasBothDownloadOptions) {
    failures.push("Download dropdown (#download-dropdown) must include both #download-html-btn ('Download as HTML') and #download-pdf-btn ('Download as PDF').");
  }

  if (effectiveMode === "interactive") {
    if (!navAndFooterCheck.pdfNotReadyWarning) {
      failures.push("In Interactive Mode, #download-pdf-btn in the download dropdown must indicate it is not PDF-ready ('Not PDF-Ready' badge or warning).");
    }
    if (!navAndFooterCheck.hasModal || !navAndFooterCheck.conversionPrompt.includes("@media print")) {
      failures.push("In Interactive Mode, clicking or viewing the PDF option must provide #pdf-not-ready-modal suggesting a prompt to make the report PDF-ready with media print queries.");
    }
  }

  if (navAndFooterCheck.missingHeadingIds.length > 0) {
    failures.push(`Headings missing id attribute: ${navAndFooterCheck.missingHeadingIds.join(", ")}`);
  }
  if (navAndFooterCheck.unmappedHeadings.length > 0) {
    failures.push(`Headings missing from navbar TOC dropdown: ${navAndFooterCheck.unmappedHeadings.join(", ")}`);
  }
  if (
    navAndFooterCheck.footerText !== "generated by html-report" ||
    !navAndFooterCheck.footerCentered ||
    !navAndFooterCheck.footerLinkValid
  ) {
    failures.push(
      `Footer must be centered and say "generated by html-report" with <a href="https://github.com/DriesVerb/html-report" target="_blank">html-report</a>.`
    );
  }
  console.log(`  ✓ Default theme: "light", Title: "${navAndFooterCheck.titleText}", TOC: ${navAndFooterCheck.tocLinkCount}/${navAndFooterCheck.headingCount} headings mapped, Footer valid.`);

  // 2. Responsive Breakpoints & Horizontal Scrollbar Detection
  const targetBreakpoints = quick ? QUICK_BREAKPOINTS : TAILWIND_BREAKPOINTS;
  console.log(`\n[2/7] Checking ${targetBreakpoints.length} Breakpoint(s) (${targetBreakpoints.map(b => b.name).join(", ")}) & Space Detector...`);

  for (const bp of targetBreakpoints) {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.waitForTimeout(quick ? 40 : 150);

    const bpMetrics = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      const insufficientElements =
        typeof window.checkInsufficientHorizontalSpace === "function"
          ? window.checkInsufficientHorizontalSpace()
          : [];
      return {
        docWidth,
        winWidth,
        overflowPx: Math.max(0, docWidth - winWidth),
        insufficientElements
      };
    });

    if (bpMetrics.overflowPx > 2) {
      failures.push(
        `Breakpoint ${bp.name} (${bp.width}px) has page horizontal overflow: scrollWidth=${bpMetrics.docWidth}px > innerWidth=${bpMetrics.winWidth}px`
      );
    }
    if (bpMetrics.insufficientElements.length > 0) {
      const details = bpMetrics.insufficientElements
        .map((item) => `<${item.tag}${item.id ? "#" + item.id : ""}> (${item.scrollWidth}px > ${item.clientWidth}px: ${item.message})`)
        .join("; ");
      failures.push(`Breakpoint ${bp.name} (${bp.width}px) elements without enough space: ${details}`);
    } else {
      console.log(`  ✓ ${bp.name} (${bp.width}x${bp.height}): 0px page overflow & 0 elements with horizontal scrollbar.`);
    }
  }

  // Restore desktop viewport
  await page.setViewportSize({ width: 1280, height: 900 });

  // 3. DaisyUI Theme Dropdown Swatches & Palette Reactivity
  console.log("\n[3/7] Checking 32 DaisyUI Themes & Color Palette Switching...");
  const themeCheck = await page.evaluate(async () => {
    const swatchItems = Array.from(document.querySelectorAll("#theme-swatch-list .theme-swatch-item"));
    const allHaveDataThemeAnd4Swatches =
      swatchItems.length >= 32 &&
      swatchItems.every((item) => {
        const themeAttr = item.getAttribute("data-theme");
        const swatches = item.querySelectorAll(
          ".bg-primary, .bg-secondary, .bg-accent, .bg-neutral"
        );
        return Boolean(themeAttr) && swatches.length === 4;
      });

    const hasCharts = Boolean(window.reportCharts && window.reportCharts.length > 0);
    const initialChartColor = hasCharts ? (window.reportCharts[0]?.data?.datasets?.[0]?.borderColor || null) : null;

    if (typeof window.setReportTheme === "function") {
      await window.setReportTheme("dark");
    }

    const activeThemeAfterSwitch = document.documentElement.getAttribute("data-theme");
    const updatedChartColor = hasCharts ? (window.reportCharts[0]?.data?.datasets?.[0]?.borderColor || null) : null;
    const chartColorChanged = hasCharts
      ? Boolean(initialChartColor && updatedChartColor && initialChartColor !== updatedChartColor)
      : true;

    if (typeof window.setReportTheme === "function") {
      await window.setReportTheme("light");
    }

    return {
      swatchCount: swatchItems.length,
      allHaveDataThemeAnd4Swatches,
      activeThemeAfterSwitch,
      hasCharts,
      chartColorChanged
    };
  });

  if (!themeCheck.allHaveDataThemeAnd4Swatches) {
    failures.push(`Theme dropdown must render all 32 DaisyUI themes with 4 color swatches each (found ${themeCheck.swatchCount}).`);
  }
  if (themeCheck.activeThemeAfterSwitch !== "dark" || !themeCheck.chartColorChanged) {
    failures.push("Theme switching did not dynamically update <html data-theme> or Chart.js colors.");
  }
  console.log(`  ✓ DaisyUI 32-theme dropdown verified (${themeCheck.swatchCount} themes, charts reactive=${themeCheck.chartColorChanged}).`);

  // 4. Dynamic Active CDN Addon Validation (Assert Only Present Features)
  console.log("\n[4/7] Checking Active CDN Addons & Subsystems...");
  const cdnCheck = await page.evaluate(() => {
    const hasCdnCatalog = Boolean(document.getElementById("cdn-directory-grid"));
    const catalogLinks = Array.from(document.querySelectorAll("#cdn-directory-grid a[data-cdn-name][href^='#']"));
    const brokenCatalogLinks = catalogLinks
      .filter((a) => !document.querySelector(a.getAttribute("href")))
      .map((a) => `${a.getAttribute("data-cdn-name")} -> ${a.getAttribute("href")}`);

    const hasLucideMarkup = Boolean(document.querySelector("[data-lucide]"));
    const lucideSvgCount = document.querySelectorAll("svg.lucide").length;

    const hasAlpineMarkup = Boolean(document.querySelector("[x-data]"));
    const alpineRendered = Boolean(document.querySelector("#alpine-example-card, [x-data]"));

    const hasCanvas = Boolean(document.querySelector("canvas"));
    const chartCount = window.reportCharts ? window.reportCharts.length : 0;

    const hasMermaid = Boolean(document.querySelector(".mermaid"));
    const mermaidSvgCount = document.querySelectorAll(".mermaid svg").length;
    const mermaidErrorElements = Array.from(
      document.querySelectorAll(".mermaid svg, svg[aria-roledescription='error'], .error-text, svg text")
    ).filter((el) => {
      const text = (el.textContent || "").trim();
      return /syntax error in text/i.test(text) || el.getAttribute("aria-roledescription") === "error";
    });
    const mermaidErrorCount = mermaidErrorElements.length;
    const bodyText = document.body ? (document.body.innerText || "") : "";
    const hasVisibleSyntaxErrorInText = /syntax error in text/i.test(bodyText) || mermaidErrorCount > 0;

    const hasLeaflet = Boolean(document.querySelector("#datacenterMap, #map, .leaflet-container"));
    const leafletPaneCount = document.querySelectorAll(".leaflet-pane").length;
    const leafletTiles = Array.from(document.querySelectorAll(".leaflet-tile"));
    const leafletTileUrls = leafletTiles.map((img) => img.src);
    const loadedTileCount = leafletTiles.filter((img) => img.complete && img.naturalWidth > 0).length;

    const hasGridJs = Boolean(document.querySelector("[data-gridjs], #gridjs-benchmark-table, .gridjs"));
    const gridjsRowCount = document.querySelectorAll(".gridjs-tr").length;

    const hasKaTeX = Boolean(document.querySelector(".katex, #katex-math-block"));
    const katexNodeCount = document.querySelectorAll(".katex").length;

    const hasMarkdown = Boolean(document.querySelector("#markdown-output"));
    const markdownRendered = Boolean(document.querySelector("#markdown-output h3, #markdown-output ul, #markdown-output p"));

    const tsCode = document.getElementById("frontend-ts-code") || document.querySelector("code.language-typescript");
    const ktCode = document.getElementById("backend-kotlin-code") || document.querySelector("code.language-kotlin");
    const hasTsCode = Boolean(tsCode);
    const hasKtCode = Boolean(ktCode);
    const tsHighlighted = Boolean(tsCode && tsCode.querySelectorAll(".hljs-keyword").length >= 1);
    const ktHighlighted = Boolean(ktCode && ktCode.querySelectorAll(".hljs-keyword").length >= 1);

    return {
      hasCdnCatalog,
      catalogLinkCount: catalogLinks.length,
      brokenCatalogLinks,
      hasLucideMarkup,
      lucideSvgCount,
      hasAlpineMarkup,
      alpineRendered,
      hasCanvas,
      chartCount,
      hasMermaid,
      mermaidSvgCount,
      mermaidErrorCount,
      hasVisibleSyntaxErrorInText,
      hasLeaflet,
      leafletPaneCount,
      leafletTileCount: loadedTileCount,
      usesBlockedTileServer: leafletTileUrls.some(
        (u) => u.includes("tile.openstreetmap.org") || u.includes("basemaps.cartocdn.com")
      ),
      hasGridJs,
      gridjsRowCount,
      hasKaTeX,
      katexNodeCount,
      hasMarkdown,
      markdownRendered,
      hasTsCode,
      tsHighlighted,
      hasKtCode,
      ktHighlighted
    };
  });

  if (cdnCheck.hasCdnCatalog) {
    if (cdnCheck.catalogLinkCount < 11 || cdnCheck.brokenCatalogLinks.length > 0) {
      failures.push(
        `All 11 CDN directory cards must be linkable anchors (count=${cdnCheck.catalogLinkCount}, broken=${cdnCheck.brokenCatalogLinks.join(", ")}).`
      );
    }
  }

  if (cdnCheck.hasLucideMarkup && cdnCheck.lucideSvgCount === 0) {
    failures.push("Lucide Icons did not render SVG icons.");
  }
  if (cdnCheck.hasAlpineMarkup && !cdnCheck.alpineRendered) {
    failures.push("Alpine.js interactive component did not render.");
  }
  if (cdnCheck.hasCanvas && cdnCheck.chartCount === 0) {
    failures.push("Canvas element detected but Chart.js charts failed to initialize.");
  }
  if (cdnCheck.hasMermaid && cdnCheck.mermaidSvgCount === 0) {
    failures.push("Mermaid diagram element detected but SVG diagram failed to render.");
  }
  if (cdnCheck.hasVisibleSyntaxErrorInText || cdnCheck.mermaidErrorCount > 0) {
    failures.push('Visible "Syntax error in text" detected in report (Mermaid diagram syntax error).');
  }
  if (cdnCheck.hasLeaflet) {
    if (cdnCheck.leafletPaneCount < 1 || cdnCheck.leafletTileCount < 1) {
      failures.push("Leaflet map detected but failed to load map tiles.");
    }
    if (cdnCheck.usesBlockedTileServer || failedTileResponses.length > 0) {
      failures.push(`Leaflet map had 403 tile responses: ${failedTileResponses.join(", ")}`);
    }
  }
  if (cdnCheck.hasGridJs && cdnCheck.gridjsRowCount === 0) {
    failures.push("Grid.js table detected but failed to render rows.");
  }
  if (cdnCheck.hasKaTeX && cdnCheck.katexNodeCount === 0) {
    failures.push("KaTeX equations detected but failed to render formatted math.");
  }
  if (cdnCheck.hasMarkdown && !cdnCheck.markdownRendered) {
    failures.push("Marked markdown block detected but failed to render HTML.");
  }
  if (cdnCheck.hasTsCode && !cdnCheck.tsHighlighted) {
    failures.push("TypeScript code block detected but Highlight.js failed to highlight keywords.");
  }
  if (cdnCheck.hasKtCode && !cdnCheck.ktHighlighted) {
    failures.push("Kotlin code block detected but Highlight.js failed to highlight keywords.");
  }

  console.log(
    `  ✓ Active addons verified: Lucide=${cdnCheck.lucideSvgCount}, Alpine=${cdnCheck.alpineRendered}, Charts=${cdnCheck.chartCount}, Mermaid=${cdnCheck.mermaidSvgCount} (errors=${cdnCheck.mermaidErrorCount}), Leaflet=${cdnCheck.leafletTileCount}, Grid.js=${cdnCheck.gridjsRowCount}, KaTeX=${cdnCheck.katexNodeCount}.`
  );

  // 5. Optional CSV Showcase Section (Executed Only When Present)
  const hasCsvSection = await page.evaluate(() =>
    Boolean(document.getElementById("csv-highlight-banner") || document.getElementById("csv-file-input"))
  );

  if (hasCsvSection) {
    console.log("\n[5/7] Checking CSV-Backed Form Showcase...");
    const candidateCsvPaths = [
      path.join(path.dirname(resolvedHtmlPath), "example.csv"),
      path.join(path.dirname(resolvedHtmlPath), "skills/html-report/examples/example.csv")
    ];
    const exampleCsvPath = candidateCsvPaths.find((p) => fs.existsSync(p)) || candidateCsvPaths[0];

    if (fs.existsSync(exampleCsvPath)) {
      await page.setInputFiles("#csv-file-input", exampleCsvPath);
      await page.waitForTimeout(quick ? 100 : 300);
      const csvCount = await page.evaluate(
        () => document.getElementById("csv-matching-count")?.textContent?.trim() || ""
      );
      if (csvCount !== "8 / 8") {
        failures.push(`Expected 8 / 8 rows loaded from example.csv, got "${csvCount}".`);
      }
      console.log(`  ✓ CSV-backed showcase verified: ${csvCount} rows loaded.`);
    }
  } else {
    console.log("\n[5/7] CSV Showcase: Skipped (no CSV-specific showcase inputs detected in this report).");
  }

  // 6. Inlined HTML Snapshot Download
  console.log("\n[6/7] Checking Self-Contained Inlined HTML Snapshot...");
  const downloadCheck = await page.evaluate(async () => {
    if (typeof window.buildInlinedHtmlSnapshot !== "function") return { valid: false };
    const snapshot = await window.buildInlinedHtmlSnapshot();
    return {
      valid: Boolean(snapshot && snapshot.includes("</html>")),
      snapshotKb: Math.round(snapshot.length / 1024)
    };
  });

  if (!downloadCheck.valid) {
    failures.push("window.buildInlinedHtmlSnapshot() failed to return valid HTML snapshot.");
  } else {
    console.log(`  ✓ Standalone HTML download snapshot verified (${downloadCheck.snapshotKb} KB).`);
  }

  // 7. @media print Verification & On-Demand Single Target PDF Export
  if (effectiveMode === "interactive") {
    console.log("\n[7/7] Interactive Mode: Skipping @media print checks (web-first report).");
    if (pdfPath) {
      const targetPdfPath = path.resolve(process.cwd(), pdfPath);
      fs.mkdirSync(path.dirname(targetPdfPath), { recursive: true });
      const pdfBuffer = await page.pdf({
        path: targetPdfPath,
        format: "A4",
        printBackground: true,
        margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" }
      });
      console.log(`  ✓ Single target PDF generated on demand: ${targetPdfPath} (${Math.round(pdfBuffer.length / 1024)} KB)`);
    } else {
      console.log("  ✓ On-Demand PDF export skipped: No --pdf flag provided (0 PDFs generated).");
    }
  } else {
    console.log("\n[7/7] Static Mode: Verifying @media print rules & On-Demand Target PDF...");
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(quick ? 50 : 200);

    const printCheck = await page.evaluate(() => {
      const headerEl = document.querySelector("header");
      const navbarEl = document.querySelector(".navbar");
      const coverPage = document.getElementById("print-cover-page");
      const headerHidden = headerEl ? getComputedStyle(headerEl).display === "none" : true;
      const navbarHidden = navbarEl ? getComputedStyle(navbarEl).display === "none" : true;
      const hasCover = Boolean(coverPage);
      const coverVisible = hasCover ? getComputedStyle(coverPage).display === "flex" : true;

      return {
        headerHidden,
        navbarHidden,
        coverVisible
      };
    });

    if (!printCheck.headerHidden || !printCheck.navbarHidden) {
      failures.push("In @media print, header and .navbar must be hidden (display: none).");
    }
    console.log(`  ✓ @media print verified: navbar hidden (display:none).`);

    if (pdfPath) {
      const targetPdfPath = path.resolve(process.cwd(), pdfPath);
      fs.mkdirSync(path.dirname(targetPdfPath), { recursive: true });
      const pdfBuffer = await page.pdf({
        path: targetPdfPath,
        format: "A4",
        printBackground: true,
        margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" }
      });
      console.log(`  ✓ Single target PDF generated on demand: ${targetPdfPath} (${Math.round(pdfBuffer.length / 1024)} KB)`);
    } else {
      console.log("  ✓ On-Demand PDF export skipped: No --pdf flag provided (0 PDFs generated).");
    }

    await page.emulateMedia({ media: "screen" });
  }

  // 8. Caller Verification
  if (caller) {
    try {
      const { resolveCaller, getOutputPaths } = await import("../scripts/caller-registry.mjs");
      const resolved = resolveCaller(caller);
      if (!resolved.profilePath || !fs.existsSync(resolved.profilePath)) {
        failures.push(`Caller profile file missing for "${caller}".`);
      } else {
        console.log(`  ✓ Caller profile resolved: ${resolved.profilePath}`);
      }
    } catch (err) {
      failures.push(`Caller verification error: ${err.message}`);
    }
  }

  if (consoleErrors.length > 0) {
    failures.push(`Browser console errors (${consoleErrors.length}): ${consoleErrors.join(" | ")}`);
  }
  if (pageErrors.length > 0) {
    failures.push(`Uncaught page errors (${pageErrors.length}): ${pageErrors.join(" | ")}`);
  }

  await browser.close();

  const totalTimeSeconds = Math.round((performance.now() - startTime) / 100) / 10;
  console.log(`\nVerification finished in ${totalTimeSeconds}s.`);

  if (failures.length > 0) {
    console.error("\n✗ VERIFICATION FAILED:");
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log("\n✔ REPORT VERIFICATION PASSED SUCCESSFULLY!\n");
}

main().catch((err) => {
  console.error("Fatal error running Playwright verifier:", err);
  process.exit(1);
});
