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

const EXPECTED_CDN_NAMES = [
  "Tailwind CSS",
  "DaisyUI",
  "Lucide Icons",
  "Alpine.js",
  "Chart.js",
  "Mermaid",
  "Leaflet",
  "Grid.js",
  "KaTeX",
  "Marked",
  "Highlight.js"
];

const MOCK_PDF_THEMES = [
  "light",
  "dark",
  "cupcake",
  "synthwave",
  "nord"
];

function parseArgs(argv) {
  const args = argv.slice(2);
  let htmlPath = null;
  let pdfPath = null;
  let mode = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pdf" && args[i + 1]) {
      pdfPath = args[++i];
    } else if (args[i] === "--mode" && args[i + 1]) {
      mode = args[++i];
    } else if (!args[i].startsWith("--") && !htmlPath) {
      htmlPath = args[i];
    }
  }

  return { htmlPath, pdfPath, mode };
}

async function main() {
  const { htmlPath, pdfPath, mode } = parseArgs(process.argv);
  if (!htmlPath) {
    console.error("Usage: node verify-report.mjs <path-to-report.html> [--mode <interactive|static>] [--pdf <output.pdf>]");
    process.exit(1);
  }

  const resolvedHtmlPath = path.resolve(process.cwd(), htmlPath);
  if (!fs.existsSync(resolvedHtmlPath)) {
    console.error(`Error: HTML report not found at ${resolvedHtmlPath}`);
    process.exit(1);
  }

  const fileUrl = pathToFileURL(resolvedHtmlPath).href;
  console.log(`\n=== Verifying HTML Report: ${resolvedHtmlPath} ===`);

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

  await page.goto(fileUrl, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForFunction(() => window.__REPORT_READY__ === true, null, { timeout: 15000 }).catch(() => {});

  const detectedMode = await page.evaluate(() => {
    return document.documentElement.getAttribute("data-report-mode") || "interactive";
  });
  const effectiveMode = (mode || detectedMode || "interactive").toLowerCase();
  console.log(`Report Mode: ${effectiveMode.toUpperCase()} (mode arg: ${mode || "none"}, detected: ${detectedMode})`);

  const failures = [];

  // 1. Check Default Light Theme, Content-Aware Favicon Emoticon, DaisyUI Navbar, Download Dropdown (HTML + PDF) & Centered Footer
  console.log("\n[1/7] Checking Default 'light' Theme, Content-Aware Favicon, Swapped Navbar, Download Dropdown & Footer...");
  const navAndFooterCheck = await page.evaluate((currMode) => {
    const initialTheme = document.documentElement.getAttribute("data-theme");
    const activeThemeLabelText = document.getElementById("active-theme-label")?.textContent?.trim() || "";
    const faviconEl = document.querySelector('link[rel="icon"]');
    const faviconHref = faviconEl ? faviconEl.getAttribute("href") : "";
    const hasEmojiFavicon = Boolean(
      faviconHref &&
      faviconHref.startsWith("data:image/svg+xml") &&
      decodeURIComponent(faviconHref).match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u)
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
    failures.push(`Each report must have a content-aware emoji SVG favicon in <head> (<link rel="icon">, found "${navAndFooterCheck.faviconHref}").`);
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
      `Footer must be centered and say "generated by html-report" with <a href="https://github.com/DriesVerb/html-report" target="_blank">html-report</a> (found "${navAndFooterCheck.footerText}", centered=${navAndFooterCheck.footerCentered}, linkValid=${navAndFooterCheck.footerLinkValid}).`
    );
  }
  console.log(
    `  ✓ Default theme verified: data-theme="${navAndFooterCheck.initialTheme}" (label="${navAndFooterCheck.activeThemeLabelText}").`
  );
  console.log(
    `  ✓ Content-aware emoji favicon verified in <head>.`
  );
  console.log(
    `  ✓ Navbar verified: Title "${navAndFooterCheck.titleText}" on LEFT; TOC (${navAndFooterCheck.tocLinkCount}/${navAndFooterCheck.headingCount} h1/h2/h3 links), Theme picker & Download dropdown on RIGHT.`
  );
  if (effectiveMode === "interactive") {
    console.log(
      `  ✓ Interactive Mode PDF notice verified: "Not PDF-Ready" warning shown with suggested conversion prompt: "${navAndFooterCheck.conversionPrompt}".`
    );
  }
  console.log(`  ✓ Footer verified: "${navAndFooterCheck.footerText}" with target="_blank" link to https://github.com/DriesVerb/html-report (centered=${navAndFooterCheck.footerCentered}).`);

  // 2. Check All 5 Tailwind Breakpoints & Element-Level Horizontal Scrollbar ("Insufficient Space") Detection
  console.log("\n[2/7] Checking all 5 Tailwind breakpoints & Element-Level Horizontal Scrollbar ('Insufficient Space') indicator...");
  for (const bp of TAILWIND_BREAKPOINTS) {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.waitForTimeout(200);

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
      console.log(`  ✗ ${bp.name} (${bp.width}px): ${details}`);
    } else {
      console.log(
        `  ✓ ${bp.name} (${bp.width}x${bp.height}): 0px page overflow & 0 elements with horizontal scrollbar (all elements have sufficient space)`
      );
    }
  }

  // Verify the detector actively flags an element when a horizontal scrollbar IS present
  const detectorSelfTest = await page.evaluate(() => {
    const mainEl = document.querySelector("main");
    const probe = document.createElement("div");
    probe.id = "overflow-space-probe";
    probe.style.cssText = "width: 120px; overflow-x: auto;";
    probe.innerHTML = '<div style="width: 400px; height: 10px;">Wide content</div>';
    mainEl.appendChild(probe);

    const detected = window.checkInsufficientHorizontalSpace();
    const flaggedAttr = probe.getAttribute("data-insufficient-space") === "true";
    const matchedProbe = detected.some((d) => d.id === "overflow-space-probe");

    probe.remove();
    window.checkInsufficientHorizontalSpace();
    return { flaggedAttr, matchedProbe };
  });

  if (!detectorSelfTest.flaggedAttr || !detectorSelfTest.matchedProbe) {
    failures.push("Horizontal scrollbar detector failed to mark overflowing element with data-insufficient-space='true'.");
  } else {
    console.log("  ✓ Horizontal scrollbar detector verified: elements with scrollWidth > clientWidth are marked [data-insufficient-space='true'].");
  }

  // Restore desktop viewport
  await page.setViewportSize({ width: 1280, height: 900 });

  // 3. Check DaisyUI Theme Dropdown Color Swatches, Chart.js Reactivity & Grid.js Dark-Mode Readability
  console.log("\n[3/7] Checking DaisyUI Theme Dropdown Color Swatches, Chart.js Sync & Grid.js Dark-Mode Readability...");
  const themeCheck = await page.evaluate(async () => {
    function parseRgbLuminance(rgbStr) {
      const m = rgbStr.match(/(\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return 0.5;
      const [r, g, b] = [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

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

    const initialChartColor =
      window.reportCharts?.[0]?.data?.datasets?.[0]?.borderColor || null;

    if (typeof window.setReportTheme === "function") {
      await window.setReportTheme("dark");
    }

    const activeThemeAfterSwitch = document.documentElement.getAttribute("data-theme");
    const updatedChartColor =
      window.reportCharts?.[0]?.data?.datasets?.[0]?.borderColor || null;

    const tdEl = document.querySelector("#gridjs-benchmark-table td.gridjs-td");
    const thEl = document.querySelector("#gridjs-benchmark-table th.gridjs-th");
    const darkTdBg = tdEl ? getComputedStyle(tdEl).backgroundColor : "";
    const darkTdColor = tdEl ? getComputedStyle(tdEl).color : "";
    const darkThBg = thEl ? getComputedStyle(thEl).backgroundColor : "";
    const darkThColor = thEl ? getComputedStyle(thEl).color : "";
    const tdBgLum = darkTdBg ? parseRgbLuminance(darkTdBg) : 1;
    const tdTextLum = darkTdColor ? parseRgbLuminance(darkTdColor) : 0;
    const thBgLum = darkThBg ? parseRgbLuminance(darkThBg) : 1;
    const thTextLum = darkThColor ? parseRgbLuminance(darkThColor) : 0;
    const gridReadableInDarkMode =
      tdTextLum - tdBgLum > 0.35 && thTextLum - thBgLum > 0.35;

    if (typeof window.setReportTheme === "function") {
      await window.setReportTheme("light");
    }

    return {
      swatchCount: swatchItems.length,
      allHaveDataThemeAnd4Swatches,
      activeThemeAfterSwitch,
      initialChartColor,
      updatedChartColor,
      chartColorChanged:
        Boolean(initialChartColor && updatedChartColor) &&
        initialChartColor !== updatedChartColor,
      gridReadableInDarkMode,
      tdBg: darkTdBg,
      tdColor: darkTdColor
    };
  });

  if (!themeCheck.allHaveDataThemeAnd4Swatches) {
    failures.push(
      `Theme dropdown must render all 32 DaisyUI themes with data-theme and 4 color swatches (found ${themeCheck.swatchCount}).`
    );
  }
  if (themeCheck.activeThemeAfterSwitch !== "dark" || !themeCheck.chartColorChanged) {
    failures.push("Theme switching did not dynamically update <html data-theme> and Chart.js colors.");
  }
  if (!themeCheck.gridReadableInDarkMode) {
    failures.push(
      `Grid.js is not readable in dark mode (td bg=${themeCheck.tdBg}, color=${themeCheck.tdColor}).`
    );
  }
  console.log(
    `  ✓ DaisyUI color-swatch dropdown verified: ${themeCheck.swatchCount} themes with 4 color pills each; Chart.js updated ${themeCheck.initialChartColor} -> ${themeCheck.updatedChartColor}; Grid.js dark-mode contrast verified (bg=${themeCheck.tdBg}, text=${themeCheck.tdColor}); restored to default "light" theme.`
  );

  // 4. Check Section 1.1 Linkable CDN Cards, All 11 Live Examples, Highlight.js TypeScript (Frontend) + Kotlin (Backend), and Leaflet Zero-403 Tiles
  console.log("\n[4/7] Checking Linkable 1.1 CDN Cards, All 11 Live Examples, TS/Kotlin Code & Leaflet Tiles...");
  const cdnCheck = await page.evaluate((expectedNames) => {
    const bodyText = document.body.innerText;
    const missingNames = expectedNames.filter((name) => !bodyText.includes(name));

    const catalogLinks = Array.from(document.querySelectorAll("#cdn-directory-grid a[data-cdn-name][href^='#']"));
    const brokenCatalogLinks = catalogLinks
      .filter((a) => !document.querySelector(a.getAttribute("href")))
      .map((a) => `${a.getAttribute("data-cdn-name")} -> ${a.getAttribute("href")}`);

    const tsCode = document.getElementById("frontend-ts-code");
    const ktCode = document.getElementById("backend-kotlin-code");
    const tsHighlighted = Boolean(
      tsCode &&
      tsCode.classList.contains("language-typescript") &&
      tsCode.querySelectorAll(".hljs-keyword").length >= 2
    );
    const ktHighlighted = Boolean(
      ktCode &&
      ktCode.classList.contains("language-kotlin") &&
      ktCode.querySelectorAll(".hljs-keyword").length >= 2
    );

    const leafletTiles = Array.from(document.querySelectorAll("#datacenterMap img.leaflet-tile"));
    const leafletTileUrls = leafletTiles.map((img) => img.src);
    const loadedTileCount = leafletTiles.filter((img) => img.complete && img.naturalWidth > 0).length;

    return {
      missingNames,
      catalogLinkCount: catalogLinks.length,
      brokenCatalogLinks,
      lucideSvgCount: document.querySelectorAll("svg.lucide").length,
      alpineRendered: Boolean(document.querySelector("#alpine-example-card")),
      chartCount: window.reportCharts ? window.reportCharts.length : 0,
      mermaidSvgCount: document.querySelectorAll(".mermaid svg").length,
      leafletPaneCount: document.querySelectorAll(".leaflet-pane").length,
      leafletTileCount: loadedTileCount,
      usesBlockedTileServer: leafletTileUrls.some(
        (u) => u.includes("tile.openstreetmap.org") || u.includes("basemaps.cartocdn.com")
      ),
      gridjsRowCount: document.querySelectorAll("#gridjs-benchmark-table .gridjs-tr").length,
      katexNodeCount: document.querySelectorAll("#katex-math-block .katex").length,
      markdownRendered: Boolean(document.querySelector("#markdown-output h3, #markdown-output ul")),
      tsHighlighted,
      ktHighlighted
    };
  }, EXPECTED_CDN_NAMES);

  if (cdnCheck.missingNames.length > 0) {
    failures.push(`Report is missing CDN names: ${cdnCheck.missingNames.join(", ")}`);
  }
  if (cdnCheck.catalogLinkCount < 11 || cdnCheck.brokenCatalogLinks.length > 0) {
    failures.push(
      `All 11 CDN cards in Section 1.1 must be linkable <a href="#..."> anchors (count=${cdnCheck.catalogLinkCount}, broken=${cdnCheck.brokenCatalogLinks.join(", ")}).`
    );
  }
  if (cdnCheck.lucideSvgCount < 5) failures.push("Lucide Icons did not render SVG icons.");
  if (!cdnCheck.alpineRendered) failures.push("Alpine.js interactive card missing.");
  if (cdnCheck.chartCount < 2) failures.push("Chart.js charts did not initialize.");
  if (cdnCheck.mermaidSvgCount < 1) failures.push("Mermaid SVG diagram did not render.");
  if (cdnCheck.leafletPaneCount < 1 || cdnCheck.leafletTileCount < 1) {
    failures.push("Leaflet map or tiles did not initialize.");
  }
  if (cdnCheck.usesBlockedTileServer || failedTileResponses.length > 0) {
    failures.push(
      `Leaflet map tiles had 403/API-key-blocked responses: ${failedTileResponses.join(", ")}`
    );
  }
  if (cdnCheck.gridjsRowCount < 2) failures.push("Grid.js interactive table did not render rows.");
  if (cdnCheck.katexNodeCount < 2) failures.push("KaTeX mathematical formulas did not render.");
  if (!cdnCheck.markdownRendered) failures.push("Marked markdown block did not render.");
  if (!cdnCheck.tsHighlighted || !cdnCheck.ktHighlighted) {
    failures.push(
      `Highlight.js must highlight both Frontend TypeScript (${cdnCheck.tsHighlighted}) and Backend Kotlin (${cdnCheck.ktHighlighted}).`
    );
  }

  console.log(
    `  ✓ Section 1.1 linkable CDN cards verified (${cdnCheck.catalogLinkCount}/11 clickable anchors).`
  );
  console.log(
    `  ✓ All 11 CDNs verified live: Lucide=${cdnCheck.lucideSvgCount} icons, Alpine.js=true, Chart.js=${cdnCheck.chartCount}, Mermaid=${cdnCheck.mermaidSvgCount}, Leaflet=${cdnCheck.leafletTileCount} tiles (0 HTTP 403s), Grid.js=${cdnCheck.gridjsRowCount} rows, KaTeX=${cdnCheck.katexNodeCount} formulas, Marked=true, Highlight.js=(TS=${cdnCheck.tsHighlighted}, Kotlin=${cdnCheck.ktHighlighted}).`
  );

  // 5. Check CSV-Backed Form Highlight, Initial Empty State, Step 1 Load CSV -> Step 2 Search Underneath -> Chart.js + Grid.js + Alpine.js Actions
  console.log("\n[5/7] Checking CSV-Backed Form (Starts Empty, Step 1 Load CSV -> Step 2 Search Underneath -> Chart.js, Grid.js & Alpine.js)...");
  const candidateCsvPaths = [
    path.join(path.dirname(resolvedHtmlPath), "example.csv"),
    path.join(path.dirname(resolvedHtmlPath), "skills/html-report/examples/example.csv")
  ];
  const exampleCsvPath = candidateCsvPaths.find((p) => fs.existsSync(p)) || candidateCsvPaths[0];
  const hasExampleCsvFile = fs.existsSync(exampleCsvPath);
  if (!hasExampleCsvFile) {
    failures.push(`Expected example.csv file at ${exampleCsvPath}`);
  }

  // Verify initial state is completely empty
  const csvEmptyInitial = await page.evaluate(() => {
    const highlightBanner = document.getElementById("csv-highlight-banner");
    const isHighlighted =
      Boolean(highlightBanner) &&
      highlightBanner.getAttribute("data-csv-highlight") === "true" &&
      highlightBanner.getAttribute("data-csv-filename") === "example.csv";
    const emptyStateEl = document.getElementById("csv-empty-state");
    const loadedWorkspace = document.getElementById("csv-loaded-workspace");
    const emptyStateVisible = Boolean(emptyStateEl && getComputedStyle(emptyStateEl).display !== "none");
    const workspaceHiddenInitially = Boolean(loadedWorkspace && getComputedStyle(loadedWorkspace).display === "none");
    const initialGridRows = document.querySelectorAll("#csv-gridjs-table tbody tr.gridjs-tr").length;
    const initialCsvChart = Boolean(window.csvChartInstance);

    return {
      isHighlighted,
      emptyStateVisible,
      workspaceHiddenInitially,
      initialGridRows,
      initialCsvChart
    };
  });

  if (
    !csvEmptyInitial.isHighlighted ||
    !csvEmptyInitial.emptyStateVisible ||
    !csvEmptyInitial.workspaceHiddenInitially ||
    csvEmptyInitial.initialGridRows !== 0 ||
    csvEmptyInitial.initialCsvChart
  ) {
    failures.push(
      `CSV section must start completely empty (highlighted=${csvEmptyInitial.isHighlighted}, emptyVisible=${csvEmptyInitial.emptyStateVisible}, workspaceHidden=${csvEmptyInitial.workspaceHiddenInitially}, gridRows=${csvEmptyInitial.initialGridRows}, chart=${csvEmptyInitial.initialCsvChart}).`
    );
  }

  // Load example.csv via the file input (#csv-file-input)
  await page.setInputFiles("#csv-file-input", exampleCsvPath);
  await page.waitForTimeout(300);

  const csvAfterLoad = await page.evaluate(() => {
    const loadBox = document.getElementById("csv-step-1-load");
    const searchBox = document.getElementById("csv-step-2-search");
    const gridSection = document.getElementById("csv-grid-section");
    const chartSection = document.getElementById("csv-chart-section");
    const rLoad = loadBox ? loadBox.getBoundingClientRect() : null;
    const rSearch = searchBox ? searchBox.getBoundingClientRect() : null;
    const rGrid = gridSection ? gridSection.getBoundingClientRect() : null;
    const rChart = chartSection ? chartSection.getBoundingClientRect() : null;

    const searchIsUnderneathLoad = Boolean(rLoad && rSearch && rSearch.top >= rLoad.bottom - 2);
    const chartIsUnderneathGrid = Boolean(rGrid && rChart && rChart.top >= rGrid.bottom - 2);
    const hasCustomFilters = Boolean(
      document.getElementById("csv-region-select") &&
      document.getElementById("csv-min-rps-range") &&
      document.getElementById("csv-max-latency-range")
    );

    const countText = document.getElementById("csv-matching-count")?.textContent?.trim() || "";
    const gridRows = document.querySelectorAll("#csv-gridjs-table tbody tr.gridjs-tr").length;
    const chartPoints = window.csvChartInstance?.data?.labels?.length || 0;

    return {
      searchIsUnderneathLoad,
      chartIsUnderneathGrid,
      hasCustomFilters,
      countText,
      gridRows,
      chartPoints
    };
  });

  if (!csvAfterLoad.searchIsUnderneathLoad) {
    failures.push("Search & custom filters box (#csv-step-2-search) must be positioned underneath Load CSV (#csv-step-1-load).");
  }
  if (!csvAfterLoad.chartIsUnderneathGrid) {
    failures.push("CSV Chart.js section (#csv-chart-section) must be positioned underneath the CSV Grid.js table (#csv-grid-section).");
  }
  if (!csvAfterLoad.hasCustomFilters) {
    failures.push("Custom DaisyUI filter controls (#csv-region-select, #csv-min-rps-range, #csv-max-latency-range) must be present.");
  }
  if (csvAfterLoad.countText !== "8 / 8" || csvAfterLoad.gridRows !== 5 || csvAfterLoad.chartPoints !== 8) {
    failures.push(
      `After loading example.csv, expected 8/8 Alpine rows, 5 paginated Grid.js rows, and 8 Chart.js bars (got count="${csvAfterLoad.countText}", gridRows=${csvAfterLoad.gridRows}, chartPoints=${csvAfterLoad.chartPoints}).`
    );
  }

  // Test Search + Custom DaisyUI Region Select Filter
  await page.selectOption("#csv-region-select", "eu-west-1");
  await page.waitForTimeout(250);
  const csvAfterSearch = await page.evaluate(() => {
    return {
      countText: document.getElementById("csv-matching-count")?.textContent?.trim() || "",
      gridRows: document.querySelectorAll("#csv-gridjs-table tbody tr.gridjs-tr").length,
      chartPoints: window.csvChartInstance?.data?.labels?.length || 0
    };
  });

  if (csvAfterSearch.countText !== "2 / 8" || csvAfterSearch.gridRows !== 2 || csvAfterSearch.chartPoints !== 2) {
    failures.push(
      `Filtering region "eu-west-1" in example.csv should update Alpine.js (2 / 8), Grid.js (2 rows), and Chart.js (2 bars), got count="${csvAfterSearch.countText}", gridRows=${csvAfterSearch.gridRows}, chartPoints=${csvAfterSearch.chartPoints}.`
    );
  }

  // Clear back to empty, then test the "Load example.csv" quick button (#load-example-csv-btn), then clear back to empty
  await page.click("#csv-clear-btn");
  await page.waitForTimeout(200);
  await page.click("#load-example-csv-btn");
  await page.waitForTimeout(250);
  const quickBtnCount = await page.evaluate(
    () => document.getElementById("csv-matching-count")?.textContent?.trim() || ""
  );
  if (quickBtnCount !== "8 / 8") {
    failures.push(`Clicking #load-example-csv-btn should load 8 / 8 rows, got "${quickBtnCount}".`);
  }
  await page.click("#csv-clear-btn");
  await page.waitForTimeout(200);

  console.log(
    `  ✓ CSV-backed form verified: starts empty -> Load CSV -> Search & custom DaisyUI filters (underneath Load CSV) -> Grid.js (${csvAfterSearch.gridRows} rows) -> Chart.js underneath Grid.js (${csvAfterSearch.chartPoints} bars).`
  );

  // 6. Check Self-Contained CDN-Inlining HTML Download
  console.log("\n[6/7] Checking Self-Contained CDN-Inlining HTML Download Snapshot...");
  const downloadCheck = await page.evaluate(async () => {
    const snapshot = await window.buildInlinedHtmlSnapshot();
    const inlinedStylesCount = (snapshot.match(/data-inlined-href=/g) || []).length;
    const inlinedScriptsCount = (snapshot.match(/data-inlined-src=/g) || []).length;
    return {
      inlinedStylesCount,
      inlinedScriptsCount,
      snapshotKb: Math.round(snapshot.length / 1024)
    };
  });

  if (downloadCheck.inlinedStylesCount < 5 || downloadCheck.inlinedScriptsCount < 10) {
    failures.push(
      `Expected all 5 CDN stylesheets and >=10 CDN scripts to be inlined (got styles=${downloadCheck.inlinedStylesCount}, scripts=${downloadCheck.inlinedScriptsCount}).`
    );
  }
  console.log(
    `  ✓ Standalone HTML Download verified: ${downloadCheck.inlinedStylesCount} CDN stylesheets and ${downloadCheck.inlinedScriptsCount} CDN scripts embedded (${downloadCheck.snapshotKb} KB).`
  );

  // 7. @media print Verification & Mock PDF Exports (Static Mode Only)
  if (effectiveMode === "interactive") {
    console.log(
      "\n[7/7] Interactive Mode Active: Skipping @media print verification & multi-theme mock PDF generation (report is optimized for client-side interactivity, not static print)."
    );
    if (pdfPath) {
      const targetPdfPath = path.resolve(process.cwd(), pdfPath);
      const pdfBuffer = await page.pdf({
        path: targetPdfPath,
        format: "A4",
        printBackground: true,
        margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" }
      });
      console.log(
        `  ✓ Optional interactive snapshot PDF saved to: ${targetPdfPath} (${Math.round(pdfBuffer.length / 1024)} KB)`
      );
    }
  } else {
    console.log("\n[7/7] Static Mode Active: Verifying @media print Queries, Page 1 Cover + H1/H2/H3 TOC, & Generating 5 Multi-Theme Mock PDFs...");
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(200);

    const printQueryCheck = await page.evaluate(() => {
      const headerEl = document.querySelector("header");
      const navbarEl = document.querySelector(".navbar");
      const coverPage = document.getElementById("print-cover-page");
      const coverTitle = document.getElementById("print-cover-title");
      const coverTocItems = Array.from(document.querySelectorAll("#print-toc-list li"));
      const mainHeadings = Array.from(document.querySelectorAll("main h1, main h2, main h3"));
      const interactiveControls = Array.from(document.querySelectorAll(".print-interactive-control"));
      const staticFallback = document.getElementById("csv-print-static-fallback");

      const headerHiddenInPrint = headerEl ? getComputedStyle(headerEl).display === "none" : true;
      const navbarHiddenInPrint = navbarEl ? getComputedStyle(navbarEl).display === "none" : true;
      const coverStyle = coverPage ? getComputedStyle(coverPage) : null;
      const coverVisibleInPrint = Boolean(coverStyle && coverStyle.display === "flex");
      const coverHasPageBreak = Boolean(
        coverStyle &&
        (coverStyle.breakAfter === "page" || coverStyle.pageBreakAfter === "always")
      );
      const coverTitleText = coverTitle ? coverTitle.textContent.trim() : "";
      const allHeadingsInPrintToc =
        coverTocItems.length === mainHeadings.length &&
        mainHeadings.every((h) =>
          coverTocItems.some((li) => li.textContent.includes(h.textContent.trim()))
        );
      const interactiveControlsHiddenInPrint =
        interactiveControls.length > 0 &&
        interactiveControls.every((el) => getComputedStyle(el).display === "none");
      const staticFallbackVisibleInPrint = Boolean(
        staticFallback && getComputedStyle(staticFallback).display === "block"
      );

      return {
        headerHiddenInPrint,
        navbarHiddenInPrint,
        coverVisibleInPrint,
        coverHasPageBreak,
        coverTitleText,
        printTocCount: coverTocItems.length,
        headingCount: mainHeadings.length,
        allHeadingsInPrintToc,
        interactiveControlCount: interactiveControls.length,
        interactiveControlsHiddenInPrint,
        staticFallbackVisibleInPrint
      };
    });

    if (!printQueryCheck.headerHiddenInPrint || !printQueryCheck.navbarHiddenInPrint) {
      failures.push("In @media print, the navbar (header / .navbar) must not exist (display: none).");
    }
    if (!printQueryCheck.coverVisibleInPrint || !printQueryCheck.coverHasPageBreak || !printQueryCheck.coverTitleText) {
      failures.push(
        `In @media print, #print-cover-page must be visible on Page 1 with report title and page-break-after (visible=${printQueryCheck.coverVisibleInPrint}, pageBreak=${printQueryCheck.coverHasPageBreak}, title="${printQueryCheck.coverTitleText}").`
      );
    }
    if (!printQueryCheck.allHeadingsInPrintToc) {
      failures.push(
        `In @media print, #print-toc-list on Page 1 must list all ${printQueryCheck.headingCount} h1/h2/h3 headings (found ${printQueryCheck.printTocCount}).`
      );
    }
    if (!printQueryCheck.interactiveControlsHiddenInPrint || !printQueryCheck.staticFallbackVisibleInPrint) {
      failures.push(
        `In @media print, interactive controls (.print-interactive-control) must be hidden (${printQueryCheck.interactiveControlsHiddenInPrint}) and static print summary (#csv-print-static-fallback) must be visible (${printQueryCheck.staticFallbackVisibleInPrint}).`
      );
    }
    console.log(
      `  ✓ @media print verified: navbar hidden (display:none), Page 1 Cover ("${printQueryCheck.coverTitleText}") + ${printQueryCheck.printTocCount}/${printQueryCheck.headingCount} H1/H2/H3 TOC items visible with page break, ${printQueryCheck.interactiveControlCount} interactive controls hidden, and static CSV fallback table visible.`
    );

    const mockPdfsDir = path.join(path.dirname(resolvedHtmlPath), "mock-pdfs");
    fs.mkdirSync(mockPdfsDir, { recursive: true });

    const targetPdfPath = pdfPath
      ? path.resolve(process.cwd(), pdfPath)
      : path.join(path.dirname(resolvedHtmlPath), `${path.basename(resolvedHtmlPath, ".html")}.pdf`);

    for (const theme of MOCK_PDF_THEMES) {
      await page.evaluate(async (t) => {
        if (typeof window.setReportTheme === "function") {
          await window.setReportTheme(t);
        }
        window.reportCharts?.forEach((c) => c.resize());
        window.reportLeafletMap?.invalidateSize();
      }, theme);
      await page.waitForTimeout(250);

      const activeThemeVerify = await page.evaluate(() => ({
        dataTheme: document.documentElement.getAttribute("data-theme"),
        coverThemeLabel: document.getElementById("print-cover-theme")?.textContent?.trim() || "",
        bgColor: getComputedStyle(document.body).backgroundColor
      }));

      if (activeThemeVerify.dataTheme !== theme || activeThemeVerify.coverThemeLabel !== theme) {
        failures.push(
          `Mock PDF theme switch to "${theme}" failed (data-theme="${activeThemeVerify.dataTheme}", coverLabel="${activeThemeVerify.coverThemeLabel}").`
        );
      }

      const mockPdfFile = path.join(mockPdfsDir, `mock-report-${theme}.pdf`);
      const pdfBuf = await page.pdf({
        path: mockPdfFile,
        format: "A4",
        printBackground: true,
        margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" }
      });

      if (!pdfBuf || pdfBuf.length < 50000) {
        failures.push(`Mock PDF for theme "${theme}" is empty or unexpectedly small (${pdfBuf ? pdfBuf.length : 0} bytes).`);
      } else {
        console.log(
          `  ✓ Mock PDF [${theme}] verified & saved: ${mockPdfFile} (${Math.round(pdfBuf.length / 1024)} KB, body bg=${activeThemeVerify.bgColor})`
        );
      }

      if (theme === "light") {
        fs.copyFileSync(mockPdfFile, targetPdfPath);
        console.log(
          `  ✓ Primary default ('light' theme) PDF saved: ${targetPdfPath} (${Math.round(pdfBuf.length / 1024)} KB)`
        );
      }
    }

    // Restore default 'light' theme and screen media emulation
    await page.evaluate(async () => {
      if (typeof window.setReportTheme === "function") {
        await window.setReportTheme("light");
      }
    });
    await page.emulateMedia({ media: "screen" });
  }

  if (consoleErrors.length > 0) {
    failures.push(`Browser console errors (${consoleErrors.length}): ${consoleErrors.join(" | ")}`);
  }
  if (pageErrors.length > 0) {
    failures.push(`Uncaught page errors (${pageErrors.length}): ${pageErrors.join(" | ")}`);
  }

  await browser.close();

  if (failures.length > 0) {
    console.error("\n✗ VERIFICATION FAILED:");
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log("\n✔ ALL PLAYWRIGHT MULTI-BREAKPOINT, SPACE-CHECK, 11-CDN, DARK-GRID, TS/KOTLIN, LEAFLET, @MEDIA PRINT & 5-THEME MOCK PDF CHECKS PASSED!\n");
}

main().catch((err) => {
  console.error("Fatal error running Playwright verifier:", err);
  process.exit(1);
});
