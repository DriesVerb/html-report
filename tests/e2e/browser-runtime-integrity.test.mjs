import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const buildReportPath = path.resolve(__dirname, "../../skills/html-report/scripts/build-report.mjs");
const playwrightPath = path.resolve(__dirname, "../../packages/core/playwright/node_modules/playwright/index.mjs");

const { buildReport } = await import(buildReportPath);
const { chromium } = await import(playwrightPath);

describe("Browser Runtime Integrity & CDN Health Tests", () => {
  it("should assemble a report and load in headless browser with zero console errors and active Tailwind", async () => {
    const testFragment = `
      <main class="max-w-4xl mx-auto p-6 space-y-6">
        <h1 id="test-heading" class="text-3xl font-extrabold text-primary">Browser Integrity Test</h1>
        <div class="card bg-base-100 shadow-xl border border-base-300 p-6">
          <p class="text-sm font-semibold text-secondary">Card content for style validation</p>
          <div class="w-full overflow-x-auto">
            <ul class="steps steps-horizontal w-full min-w-[500px] text-xs font-semibold">
              <li class="step step-primary" data-content="✓">Step 1</li>
              <li class="step step-primary" data-content="★">Step 2</li>
              <li class="step" data-content="3">Step 3</li>
            </ul>
          </div>
        </div>
      </main>
    `;

    const { html } = buildReport({
      title: "Browser Integrity Test",
      content: testFragment,
      theme: "light"
    });

    const tempHtmlPath = path.resolve(__dirname, "../tmp-browser-test.html");
    fs.writeFileSync(tempHtmlPath, html, "utf-8");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    try {
      await page.goto("file://" + tempHtmlPath, { waitUntil: "load" });
      await page.waitForTimeout(1000);

      // 1. Assert zero console errors & zero unhandled page errors
      assert.deepEqual(pageErrors, [], `Page threw runtime errors: ${pageErrors.join(", ")}`);
      assert.deepEqual(consoleErrors, [], `Browser logged console errors: ${consoleErrors.join("; ")}`);

      // 2. Assert Core CDNs are loaded in browser window
      const windowGlobals = await page.evaluate(() => ({
        hasTailwind: typeof window.tailwind !== "undefined",
        hasLucide: typeof window.lucide !== "undefined",
        hasAlpine: typeof window.Alpine !== "undefined"
      }));

      assert.strictEqual(windowGlobals.hasTailwind, true, "window.tailwind must be loaded and initialized");
      assert.strictEqual(windowGlobals.hasLucide, true, "window.lucide must be loaded");
      assert.strictEqual(windowGlobals.hasAlpine, true, "window.Alpine must be loaded");

      // 3. Assert DaisyUI & Tailwind styles are actively computed by the browser
      const computedStyles = await page.evaluate(() => {
        const heading = document.getElementById("test-heading");
        const card = document.querySelector(".card");
        const stepper = document.querySelector("ul.steps");

        return {
          headingWeight: heading ? getComputedStyle(heading).fontWeight : null,
          cardDisplay: card ? getComputedStyle(card).display : null,
          stepperGridFlow: stepper ? getComputedStyle(stepper).gridAutoFlow : null
        };
      });

      assert.strictEqual(computedStyles.cardDisplay, "flex", ".card class must compute display: flex from DaisyUI/Tailwind");
      assert.strictEqual(computedStyles.stepperGridFlow, "column", ".steps-horizontal must compute grid-auto-flow: column");
      assert.ok(
        ["800", "bold", "extrabold"].includes(computedStyles.headingWeight) || parseInt(computedStyles.headingWeight, 10) >= 700,
        `Heading must have bold/extrabold font-weight, got: ${computedStyles.headingWeight}`
      );
    } finally {
      await browser.close();
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
    }
  });

  it("should guard template-shell.html against Tailwind CORS regression", () => {
    const shellPath = path.resolve(__dirname, "../../packages/core/assets/template-shell.html");
    const shellContent = fs.readFileSync(shellPath, "utf-8");

    // Extract the Tailwind script tag
    const twMatch = shellContent.match(/<script[^>]*src=["'][^"']*cdn\.tailwindcss\.com[^"']*["'][^>]*>/i);
    assert.ok(twMatch, "template-shell.html must contain cdn.tailwindcss.com script tag");
    assert.strictEqual(
      twMatch[0].includes("crossorigin"),
      false,
      "cdn.tailwindcss.com script MUST NOT contain crossorigin attribute because Tailwind CDN blocks CORS anonymous requests"
    );
  });

  it("should load GitHub Pages index.html in headless browser with zero console errors and full 16-CDN parity", async () => {
    const indexPath = path.resolve(__dirname, "../../index.html");
    assert.ok(fs.existsSync(indexPath), "index.html must exist at repo root");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    try {
      await page.goto("file://" + indexPath, { waitUntil: "load" });
      await page.waitForTimeout(1000);

      assert.deepEqual(pageErrors, [], `index.html threw runtime errors: ${pageErrors.join(", ")}`);
      assert.deepEqual(consoleErrors, [], `index.html logged console errors: ${consoleErrors.join("; ")}`);

      // Verify 16 CDN globals loaded
      const globals = await page.evaluate(() => ({
        hasTailwind: typeof window.tailwind !== "undefined",
        hasLucide: typeof window.lucide !== "undefined",
        hasAlpine: typeof window.Alpine !== "undefined",
        hasChart: typeof window.Chart !== "undefined",
        hasMermaid: typeof window.mermaid !== "undefined",
        hasLeaflet: typeof window.L !== "undefined",
        hasGridjs: typeof window.gridjs !== "undefined",
        hasKatex: typeof window.katex !== "undefined",
        hasMarked: typeof window.marked !== "undefined",
        hasHljs: typeof window.hljs !== "undefined",
        hasDayjs: typeof window.dayjs !== "undefined",
        hasImpress: typeof window.impress !== "undefined",
        hasMock: typeof window.Mock !== "undefined",
        hasShowdown: typeof window.showdown !== "undefined",
        hasFullCalendar: typeof window.FullCalendar !== "undefined"
      }));

      assert.strictEqual(globals.hasTailwind, true, "Tailwind must be present");
      assert.strictEqual(globals.hasLucide, true, "Lucide must be present");
      assert.strictEqual(globals.hasAlpine, true, "Alpine must be present");
      assert.strictEqual(globals.hasChart, true, "Chart.js must be present");
      assert.strictEqual(globals.hasMermaid, true, "Mermaid must be present");
      assert.strictEqual(globals.hasLeaflet, true, "Leaflet must be present");
      assert.strictEqual(globals.hasGridjs, true, "Grid.js must be present");
      assert.strictEqual(globals.hasKatex, true, "KaTeX must be present");
      assert.strictEqual(globals.hasMarked, true, "Marked must be present");
      assert.strictEqual(globals.hasHljs, true, "Highlight.js must be present");
      assert.strictEqual(globals.hasDayjs, true, "Day.js must be present");
      assert.strictEqual(globals.hasImpress, true, "Impress.js must be present");
      assert.strictEqual(globals.hasMock, true, "Mock.js must be present");
      assert.strictEqual(globals.hasShowdown, true, "Showdown must be present");
      assert.strictEqual(globals.hasFullCalendar, true, "FullCalendar must be present");
    } finally {
      await browser.close();
    }
  });

  it("should assemble example.html and load in headless browser with zero console errors", async () => {
    const examplePath = path.resolve(__dirname, "../../skills/html-report/examples/example.html");
    const content = fs.readFileSync(examplePath, "utf-8");

    const { html } = buildReport({
      title: "16-CDN Showcase Example Test",
      content,
      allAddons: true,
      theme: "light"
    });

    const tempPath = path.resolve(__dirname, "../tmp-example-test.html");
    fs.writeFileSync(tempPath, html, "utf-8");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    try {
      await page.goto("file://" + tempPath, { waitUntil: "load" });
      await page.waitForTimeout(1000);

      assert.deepEqual(pageErrors, [], `example.html threw runtime errors: ${pageErrors.join(", ")}`);
      assert.deepEqual(consoleErrors, [], `example.html logged console errors: ${consoleErrors.join("; ")}`);
    } finally {
      await browser.close();
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  });

  it("should auto-hydrate declarative data-chart, data-gridjs, and data-leaflet widgets over file:// and react to DaisyUI theme switches", async () => {
    const declarativeFragment = `
      <main id="report-main" class="max-w-4xl mx-auto p-6 space-y-6">
        <h1 id="decl-heading" class="text-2xl font-bold">Declarative Widget Auto-Hydration E2E</h1>
        <div class="relative h-72 w-full min-w-0">
          <canvas
            id="decl-chart"
            data-chart='{"type":"bar","data":{"labels":["Q1","Q2"],"datasets":[{"label":"Revenue","data":[42,58]}]}}'
          ></canvas>
        </div>
        <div
          id="decl-grid"
          data-gridjs='{"columns":["Name","Score"],"data":[["Alice",98],["Bob",91]]}'
        ></div>
        <div
          id="decl-map"
          class="h-72 w-full"
          data-leaflet='{"center":[51.505,-0.09],"zoom":12,"markers":[{"lat":51.505,"lng":-0.09,"popup":"London HQ"}]}'
        ></div>
      </main>
    `;

    const { html, activeAddons } = buildReport({
      title: "Declarative Widget Auto-Hydration E2E",
      content: declarativeFragment,
      theme: "light"
    });

    assert.ok(activeAddons.includes("charts"), "buildReport must auto-detect charts addon from data-chart");
    assert.ok(activeAddons.includes("gridjs"), "buildReport must auto-detect gridjs addon from data-gridjs");
    assert.ok(activeAddons.includes("leaflet"), "buildReport must auto-detect leaflet addon from data-leaflet");

    const tempPath = path.resolve(__dirname, "../tmp-declarative-widgets-test.html");
    fs.writeFileSync(tempPath, html, "utf-8");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    try {
      await page.goto("file://" + tempPath, { waitUntil: "load" });
      await page.waitForFunction(() => window.__REPORT_READY__ === true, { timeout: 10000 });
      await page.waitForFunction(
        () =>
          Array.isArray(window.reportCharts) &&
          window.reportCharts.length === 1 &&
          Boolean(document.querySelector("#decl-grid .gridjs-container")) &&
          Boolean(document.querySelector("#decl-map .leaflet-pane")),
        { timeout: 10000 }
      );

      assert.deepEqual(pageErrors, [], `Declarative widgets threw page errors: ${pageErrors.join(", ")}`);

      const state = await page.evaluate(async () => {
        const chart = window.reportCharts[0];
        const lightBorder = chart.data.datasets[0].borderColor;
        await window.setReportTheme("dracula");
        const draculaBorder = chart.data.datasets[0].borderColor;
        const gridText = document.querySelector("#decl-grid")?.textContent || "";
        const markerCount = document.querySelectorAll("#decl-map .leaflet-marker-icon").length;
        return {
          lightBorder,
          draculaBorder,
          hasGridSearch: Boolean(document.querySelector("#decl-grid input.gridjs-input")),
          hasAliceRow: gridText.includes("Alice"),
          markerCount
        };
      });

      assert.ok(state.lightBorder, "Declarative chart must have resolved initial light theme borderColor");
      assert.ok(state.draculaBorder, "Declarative chart must have resolved dracula theme borderColor");
      assert.notEqual(state.lightBorder, state.draculaBorder, "Switching DaisyUI theme must update declarative chart palette");
      assert.equal(state.hasGridSearch, true, "Declarative Grid.js must mount with search enabled by default");
      assert.equal(state.hasAliceRow, true, "Declarative Grid.js must render table rows");
      assert.equal(state.markerCount, 1, "Declarative Leaflet must render marker icon");
    } finally {
      await browser.close();
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  });
});
