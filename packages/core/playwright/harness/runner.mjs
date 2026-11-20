import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createDefaultRegistry } from "./registry.mjs";
import { Reporter } from "./reporter.mjs";
import { attachCdnDiskCache } from "./cdn-cache.mjs";
import { areUsedVendorsCached } from "../../scripts/lib/build/vendor-disk-cache.mjs";
import { detectSystemChrome } from "../../scripts/env.mjs";

export async function launchBrowserWithFallback(options = {}, launcher = chromium) {
  const launchOpts = { headless: !options.headed };
  if (process.env.PLAYWRIGHT_CHROME_EXECUTABLE && fs.existsSync(process.env.PLAYWRIGHT_CHROME_EXECUTABLE)) {
    launchOpts.executablePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE;
  }
  try {
    return await launcher.launch(launchOpts);
  } catch (primaryErr) {
    const fallbackPath = options.systemChromePath !== undefined ? options.systemChromePath : options.fallbackExecutablePath;
    const systemChrome = fallbackPath !== undefined ? fallbackPath : detectSystemChrome();
    if (systemChrome && systemChrome !== launchOpts.executablePath) {
      return await launcher.launch({
        ...launchOpts,
        executablePath: systemChrome
      });
    }
    throw primaryErr;
  }
}

export async function runHarness(htmlPath, rawOptions = {}) {
  const targetInput = rawOptions.url || htmlPath;
  if (!targetInput) {
    throw new Error("HTML report path must be provided.");
  }

  const isHttpUrl = /^https?:\/\//i.test(String(targetInput).trim());
  let resolvedHtmlPath = String(targetInput).trim();
  let fileUrl = resolvedHtmlPath;

  if (!isHttpUrl) {
    resolvedHtmlPath = path.resolve(process.cwd(), resolvedHtmlPath);
    if (!fs.existsSync(resolvedHtmlPath)) {
      throw new Error(`HTML report not found at ${resolvedHtmlPath}`);
    }
    fileUrl = pathToFileURL(resolvedHtmlPath).href;
  }

  const options = {
    ...rawOptions,
    url: isHttpUrl ? fileUrl : (rawOptions.url || null),
    expectedTheme: rawOptions.expectedTheme || rawOptions["expected-theme"] || null,
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
    cdnCache: rawOptions.cdnCache !== undefined
      ? Boolean(rawOptions.cdnCache)
      : (rawOptions["no-cdn-cache"] ? false : true),
    cacheDir: rawOptions.cacheDir || rawOptions["cache-dir"] || null
  };

  const reporter = new Reporter(options);
  const registry = options.registry || (await createDefaultRegistry());

  const browser = await launchBrowserWithFallback(options);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true
  });
  const cdnCacheSession = await attachCdnDiskCache(context, {
    enabled: options.cdnCache !== false,
    cacheDir: options.cacheDir
  });
  const page = await context.newPage();

  let allVendorsCachedOnDisk = false;
  if (!isHttpUrl && options.cdnCache !== false) {
    try {
      const reportHtml = fs.readFileSync(resolvedHtmlPath, "utf-8");
      allVendorsCachedOnDisk = areUsedVendorsCached(reportHtml, {
        cacheDir: cdnCacheSession.cacheDir
      });
    } catch (_) {}
  }

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
    if (isHttpUrl) {
      await page.goto(fileUrl, { waitUntil: "load", timeout: options.timeout });
      await page.waitForFunction(() => window.__REPORT_READY__ === true, null, { timeout: options.quick ? 4000 : 10000 }).catch(() => {});
      if (!options.quick) {
        await page.waitForTimeout(300);
      }
    } else if (options.quick || allVendorsCachedOnDisk) {
      await page.goto(fileUrl, { waitUntil: "domcontentloaded", timeout: options.timeout });
      await page.waitForFunction(
        () =>
          window.__REPORT_READY__ === true &&
          Array.from(document.querySelectorAll('link[rel="stylesheet"]')).every((l) => Boolean(l.sheet)),
        null,
        { timeout: options.quick ? 4000 : 10000 }
      ).catch(() => {});
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
    hasCode: Array.from(document.querySelectorAll("pre code, .hljs, code[class*='language-']")).some(
      (el) => !el.closest(".mockup-code") || el.classList.contains("hljs") || /\blanguage-/.test(el.className || "")
    ),
    hasMarkdown: Boolean(document.querySelector("#markdown-output, [data-markdown]")),
    hasLucide: Boolean(document.querySelector("[data-lucide], svg.lucide")),
    hasAlpine: Boolean(document.querySelector("[x-data], #alpine-example-card")),
    hasFullCalendar: Boolean(document.body && document.body.querySelector("#calendar, .fc, [data-fullcalendar]:not(style)")),
    hasReveal: Boolean(document.querySelector(".reveal .slides section, #presentation-deck"))
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

  const isTargetedSelection = Boolean(
    options.only ||
    options.suites ||
    options.grep ||
    options.allCdns ||
    options.cdns ||
    Object.entries(options).some(([k, v]) => v === true && k.startsWith("check"))
  );

  reporter.onRunStart({
    htmlPath: resolvedHtmlPath,
    mode: options.mode,
    detectedMode,
    quick: options.quick,
    totalChecks: activeChecks.length,
    targeted: isTargetedSelection,
    withCore: Boolean(options.withCore)
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

  if (options.reviewPacket) {
    try {
      const screenshotDir = typeof options.screenshots === "string" ? options.screenshots : "./screenshots";
      await page.setViewportSize({ width: 1280, height: 900 });
      await reporter.captureScreenshot(page, "review_desktop", screenshotDir);
      await page.setViewportSize({ width: 640, height: 800 });
      await reporter.captureScreenshot(page, "review_mobile", screenshotDir);
      await page.setViewportSize({ width: 1280, height: 900 });
      const inventory = await page.evaluate(() => {
        const title = document.getElementById("navbar-report-title")?.textContent?.trim() || document.title;
        const mode = document.documentElement.getAttribute("data-report-mode") || "report";
        const headings = Array.from(document.querySelectorAll("main h1, main h2, main h3")).map((h) => ({
          tag: h.tagName.toLowerCase(),
          id: h.id || null,
          text: h.textContent.trim().slice(0, 120)
        }));
        const insufficientSpaceCount = document.querySelectorAll('[data-insufficient-space="true"], .verify-insufficient-space').length;
        return {
          title,
          mode,
          headings,
          counts: {
            charts: document.querySelectorAll("main canvas").length,
            mermaid: document.querySelectorAll("main .mermaid").length,
            tables: document.querySelectorAll("main table").length,
            insufficientSpace: insufficientSpaceCount
          }
        };
      });
      reporter.reviewPacket = {
        generatedAt: new Date().toISOString(),
        reportPath: resolvedHtmlPath,
        ...inventory
      };
    } catch (_) {}
  }

  await browser.close();
  const summary = reporter.onRunComplete();
  summary.cdnCache = {
    enabled: cdnCacheSession.enabled,
    cacheDir: cdnCacheSession.cacheDir,
    ...cdnCacheSession.stats
  };
  return summary;
}
