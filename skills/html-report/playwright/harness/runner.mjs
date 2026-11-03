import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createDefaultRegistry } from "./registry.mjs";
import { Reporter } from "./reporter.mjs";

export async function runHarness(htmlPath, rawOptions = {}) {
  if (!htmlPath) {
    throw new Error("HTML report path must be provided.");
  }

  const resolvedHtmlPath = path.resolve(process.cwd(), htmlPath);
  if (!fs.existsSync(resolvedHtmlPath)) {
    throw new Error(`HTML report not found at ${resolvedHtmlPath}`);
  }

  const options = {
    quick: Boolean(rawOptions.quick),
    headed: Boolean(rawOptions.headed),
    bail: Boolean(rawOptions.bail),
    strict: Boolean(rawOptions.strict),
    timeout: rawOptions.timeout ? Number(rawOptions.timeout) : (rawOptions.quick ? 5000 : 30000),
    caller: rawOptions.caller || null,
    pdf: rawOptions.pdf || null,
    pdfPath: rawOptions.pdf || rawOptions.pdfPath || null,
    mode: rawOptions.mode || null,
    viewports: rawOptions.viewports || null,
    themes: rawOptions.themes || null,
    suites: rawOptions.suites || null,
    only: rawOptions.only || null,
    grep: rawOptions.grep || null,
    json: rawOptions.json || null,
    screenshots: rawOptions.screenshots || null,
    colorContrast: Boolean(rawOptions.colorContrast || rawOptions["color-contrast"]),
    allCdns: Boolean(rawOptions.allCdns || rawOptions["all-cdns"]),
    cdns: rawOptions.cdns || null,
    ...rawOptions
  };

  const reporter = new Reporter(options);
  const registry = options.registry || (await createDefaultRegistry());
  const fileUrl = pathToFileURL(resolvedHtmlPath).href;

  const browser = await chromium.launch({ headless: !options.headed });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true
  });
  const page = await context.newPage();

  const sharedState = {
    consoleErrors: [],
    pageErrors: [],
    consoleWarnings: [],
    failedTileResponses: []
  };

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      sharedState.consoleErrors.push(msg.text());
    } else if (msg.type() === "warning") {
      sharedState.consoleWarnings.push(msg.text());
    }
  });

  page.on("pageerror", (err) => {
    sharedState.pageErrors.push(err.message || String(err));
  });

  page.on("response", (res) => {
    const url = res.url();
    if (
      (url.includes("tile.openstreetmap.org") ||
        url.includes("basemaps.cartocdn.com") ||
        url.includes("server.arcgisonline.com")) &&
      res.status() >= 400
    ) {
      sharedState.failedTileResponses.push(`${res.status()} ${url}`);
    }
  });

  try {
    if (options.quick) {
      await page.goto(fileUrl, { waitUntil: "domcontentloaded", timeout: options.timeout });
      await page.waitForFunction(() => window.__REPORT_READY__ === true, null, { timeout: 4000 }).catch(() => {});
    } else {
      await page.goto(fileUrl, { waitUntil: "networkidle", timeout: options.timeout });
      await page.waitForFunction(() => window.__REPORT_READY__ === true, null, { timeout: 15000 }).catch(() => {});
    }
  } catch (err) {
    sharedState.pageErrors.push(`Navigation failed: ${err.message}`);
  }

  const detectedMode = await page.evaluate(() => {
    return document.documentElement.getAttribute("data-report-mode") || "interactive";
  });
  options.detectedMode = detectedMode;

  const detectedFeatures = await page.evaluate(() => ({
    hasCanvas: Boolean(document.querySelector("canvas")),
    hasMermaid: Boolean(document.querySelector(".mermaid")),
    hasLeaflet: Boolean(document.querySelector("#datacenterMap, #map, .leaflet-container")),
    hasGridJs: Boolean(document.querySelector("[data-gridjs], #gridjs-benchmark-table, .gridjs")),
    hasKaTeX: Boolean(document.querySelector(".katex, #katex-math-block, [data-katex]")),
    hasCode: Boolean(document.querySelector("pre code, .hljs, code[class*='language-']")),
    hasMarkdown: Boolean(document.querySelector("#markdown-output, [data-markdown]")),
    hasLucide: Boolean(document.querySelector("[data-lucide], svg.lucide")),
    hasAlpine: Boolean(document.querySelector("[x-data], #alpine-example-card")),
    hasFullCalendar: Boolean(document.querySelector("#calendar, .fc, [data-fullcalendar]"))
  }));

  const candidateChecks = registry.filter(options);
  const activeChecks = [];
  for (const check of candidateChecks) {
    const should = await check.shouldRun({
      page,
      browser,
      context,
      reportUrl: fileUrl,
      options,
      detectedFeatures,
      mode: options.mode || detectedMode
    });
    if (should) {
      activeChecks.push(check);
    }
  }

  reporter.onRunStart({
    htmlPath: resolvedHtmlPath,
    mode: options.mode,
    detectedMode,
    quick: options.quick,
    totalChecks: activeChecks.length
  });

  let step = 1;
  for (const check of activeChecks) {
    reporter.onCheckStart(check, step++, activeChecks.length);

    let timeoutTimer = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutTimer = setTimeout(
        () => reject(new Error(`Check "${check.id}" timed out after ${options.timeout}ms`)),
        options.timeout
      );
    });

    let result;
    const startTime = performance.now();
    try {
      result = await Promise.race([
        check.run({
          page,
          browser,
          context,
          reportUrl: fileUrl,
          options,
          reporter,
          sharedState,
          detectedFeatures,
          mode: options.mode || detectedMode
        }),
        timeoutPromise
      ]);
    } catch (err) {
      result = {
        id: check.id,
        name: check.name,
        status: "failed",
        errors: [err.message || String(err)]
      };
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    }

    result.durationMs = performance.now() - startTime;
    reporter.onCheckComplete(check, result);

    const hasErrors = result.errors && result.errors.length > 0;
    const hasStrictFailures = options.strict && result.warnings && result.warnings.length > 0;

    if (hasErrors || hasStrictFailures) {
      if (options.screenshots) {
        await reporter.captureScreenshot(page, check.id, options.screenshots);
      }
      if (options.bail) {
        console.log(`\n[BAIL] Aborting remaining checks due to failure in "${check.id}".`);
        break;
      }
    }
  }

  await browser.close();
  return reporter.onRunComplete();
}
