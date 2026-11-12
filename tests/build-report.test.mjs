import test, { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, "../skills/html-report/scripts/build-report.mjs");

const {
  detectAddons,
  extractMainContent,
  stripDuplicateNavbars,
  generateFaviconTag,
  parseArgs,
  buildReport,
  ADDON_REGISTRY
} = await import(cliPath);

describe("Phase 2: build-report.mjs Deterministic Assembly Unit Tests", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "build-report-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("parseArgs", () => {
    it("should parse CLI flags correctly", () => {
      const argv = [
        "node",
        "build-report.mjs",
        "--title",
        "Custom Title",
        "--content",
        "fragment.html",
        "--output",
        "out.html",
        "--printable",
        "--addons",
        "chartjs,katex",
        "--theme",
        "synthwave",
        "--favicon",
        "🚀"
      ];
      const opts = parseArgs(argv);
      assert.equal(opts.title, "Custom Title");
      assert.equal(opts.content, "fragment.html");
      assert.equal(opts.output, "out.html");
      assert.equal(opts.printable, true);
      assert.equal(opts.theme, "synthwave");
      assert.deepEqual(opts.addons, ["chartjs", "katex"]);
      assert.equal(opts.favicon, "🚀");
    });

    it("should handle individual addon flags and aliases", () => {
      const argv = ["node", "build-report.mjs", "-c", "frag.html", "--charts", "--math", "--leaflet", "--fullcalender", "--mock", "--day"];
      const opts = parseArgs(argv);
      assert.ok(opts.addons.includes("charts"));
      assert.ok(opts.addons.includes("katex")); // alias for math
      assert.ok(opts.addons.includes("leaflet"));
      assert.ok(opts.addons.includes("fullcalendar"));
      assert.ok(opts.addons.includes("mockjs"));
      assert.ok(opts.addons.includes("dayjs"));
    });

    it("should handle --presentation flag and auto-include impress addon", () => {
      const argv = ["node", "build-report.mjs", "-c", "frag.html", "--presentation"];
      const opts = parseArgs(argv);
      assert.equal(opts.presentation, true);
      assert.ok(opts.addons.includes("impress"));
    });

    it("should handle --live and -l flags and auto-include datastar addon", () => {
      const argv1 = ["node", "build-report.mjs", "-c", "frag.html", "--live"];
      const opts1 = parseArgs(argv1);
      assert.equal(opts1.live, true);
      assert.ok(opts1.addons.includes("datastar"));

      const argv2 = ["node", "build-report.mjs", "-c", "frag.html", "-l"];
      const opts2 = parseArgs(argv2);
      assert.equal(opts2.live, true);
      assert.ok(opts2.addons.includes("datastar"));
    });

    it("should parse --custom-theme flag correctly", () => {
      const argv = ["node", "build-report.mjs", "-c", "frag.html", "--custom-theme", "brand.json"];
      const opts = parseArgs(argv);
      assert.equal(opts.customTheme, "brand.json");
    });
  });

  describe("detectAddons: Content Signature Scanning", () => {
    it("should return empty array for minimal content without signatures", () => {
      const content = `<section><h1>Hello World</h1><p>A simple report</p></section>`;
      const addons = detectAddons(content);
      assert.deepEqual(addons, []);
    });

    it("should auto-detect <canvas> as Chart.js", () => {
      const content = `<div><canvas id="metricsChart" class="w-full"></canvas></div>`;
      const addons = detectAddons(content);
      assert.ok(addons.includes("charts"));
      assert.equal(addons.length, 1);
    });

    it("should auto-detect .mermaid as Mermaid", () => {
      const content = `<div class="mermaid">graph TD\nA-->B</div>`;
      const addons = detectAddons(content);
      assert.ok(addons.includes("mermaid"));
    });

    it("should auto-detect data-gridjs as Grid.js", () => {
      const content = `<div id="table" data-gridjs="true"></div>`;
      const addons = detectAddons(content);
      assert.ok(addons.includes("gridjs"));
    });

    it("should auto-detect katex equations", () => {
      const content = `<p>Equation: \\( E = mc^2 \\)</p>`;
      const addons = detectAddons(content);
      assert.ok(addons.includes("katex"));
    });

    it("should auto-detect leaflet signatures", () => {
      const content = `<div id="datacenterMap" class="leaflet-pane"></div>`;
      const addons = detectAddons(content);
      assert.ok(addons.includes("leaflet"));
    });

    it("should auto-detect hljs code formatting", () => {
      const content = `<pre><code class="language-typescript">const x: number = 42;</code></pre>`;
      const addons = detectAddons(content);
      assert.ok(addons.includes("hljs"));
    });

    it("should auto-detect Day.js signatures", () => {
      const content = `<span data-dayjs="2026-11-03" data-dayjs-from-now></span>`;
      const addons = detectAddons(content);
      assert.ok(addons.includes("dayjs"));
    });

    it("should auto-detect Impress.js signatures", () => {
      const content = `<div id="impress"><div class="step" data-x="0" data-y="0">Slide 1</div></div>`;
      const addons = detectAddons(content);
      assert.ok(addons.includes("impress"));
    });

    it("should auto-detect Mock.js signatures", () => {
      const content = `<pre data-mock='{"list|5":[{"id|+1":1}]}'></pre>`;
      const addons = detectAddons(content);
      assert.ok(addons.includes("mockjs"));
    });

    it("should auto-detect Showdown signatures", () => {
      const content = `<div data-showdown="# Markdown Heading"></div>`;
      const addons = detectAddons(content);
      assert.ok(addons.includes("showdown"));
    });

    it("should auto-detect FullCalendar signatures", () => {
      const content = `<div id="calendar" data-fullcalendar="true"></div>`;
      const addons = detectAddons(content);
      assert.ok(addons.includes("fullcalendar"));
    });

    it("should auto-detect Datastar signatures (data-signals, data-bind, data-on-, etc.)", () => {
      const sigs = [
        '<div data-signals="{ count: 0 }"></div>',
        '<input data-bind="userInput" />',
        '<button data-on-click="$$get(\'/api/stream\')">Run</button>',
        '<div data-indicator="loading">Loading...</div>',
        '<div data-computed="doubled"></div>',
        '<span data-text="$user.name"></span>',
        '<span data-show="$isOpen">Visible</span>'
      ];
      for (const sig of sigs) {
        const addons = detectAddons(sig);
        assert.ok(addons.includes("datastar"), `Failed to auto-detect Datastar for signature: ${sig}`);
      }
    });

    it("should resolve CLI aliases for all new addons correctly", () => {
      const addons = detectAddons("", ["fullcalender", "mock", "day", "impressjs", "calendar", "markdown-showdown"]);
      assert.ok(addons.includes("fullcalendar"));
      assert.ok(addons.includes("mockjs"));
      assert.ok(addons.includes("dayjs"));
      assert.ok(addons.includes("impress"));
      assert.ok(addons.includes("showdown"));
    });

    it("should support multi-addon co-existence for Marked and Showdown together", () => {
      const content = `
        <div id="markdown-output">Marked content</div>
        <div data-showdown="# Showdown Title">Showdown content</div>
      `;
      const addons = detectAddons(content);
      assert.ok(addons.includes("marked"));
      assert.ok(addons.includes("showdown"));
      assert.equal(addons.length, 2);
    });

    it("should union auto-detected addons with explicit CLI requests", () => {
      const content = `<canvas id="perfChart"></canvas>`;
      const addons = detectAddons(content, ["katex", "mermaid"]);
      assert.ok(addons.includes("charts"));
      assert.ok(addons.includes("katex"));
      assert.ok(addons.includes("mermaid"));
      assert.equal(addons.length, 3);
    });
  });

  describe("extractMainContent", () => {
    it("should unwrap outer <main>...</main> tags safely", () => {
      const wrapped = `<main class="space-y-4">\n  <section>Content inside</section>\n</main>`;
      const extracted = extractMainContent(wrapped);
      assert.equal(extracted, "<section>Content inside</section>");
    });

    it("should strip YAML frontmatter if present", () => {
      const withFrontmatter = `---
title: Test
addons: [charts]
---
<section>Body text</section>`;
      const extracted = extractMainContent(withFrontmatter);
      assert.equal(extracted, "<section>Body text</section>");
    });

    it("should keep pure fragment untouched", () => {
      const pure = `<section class="card">Card content</section>`;
      assert.equal(extractMainContent(pure), pure);
    });
  });

  describe("buildReport deterministic assembly", () => {
    it("should assemble full HTML with title, content, runtime script, and detected addons", () => {
      const fragment = `
        <h1 id="perf-metrics">Performance Metrics</h1>
        <div><canvas id="myChart"></canvas></div>
        <div class="mermaid">graph LR\nA-->B</div>
      `;

      const result = buildReport({
        title: "Deterministic Benchmark Report",
        content: fragment,
        printable: false
      });

      assert.equal(result.mode, "report");
      assert.ok(result.activeAddons.includes("charts"));
      assert.ok(result.activeAddons.includes("mermaid"));
      assert.ok(!result.activeAddons.includes("leaflet"));

      const html = result.html;
      assert.ok(html.includes("<title>Deterministic Benchmark Report</title>"));
      assert.ok(html.includes('id="navbar-report-title"'));
      assert.ok(html.includes("Deterministic Benchmark Report"));
      assert.ok(html.includes('data-report-mode="report"'));
      assert.ok(html.includes('id="perf-metrics"'));
      assert.ok(html.includes("chart.umd.min.js"));
      assert.ok(html.includes("mermaid.min.js"));
      assert.ok(!html.includes("leaflet.js"));
      assert.ok(html.includes("report-runtime"));
    });

    it("should handle printable mode with @media print rules and static report mode", () => {
      const fragment = `<h1 id="exec-summary">Executive Summary</h1><p>Text</p>`;

      const result = buildReport({
        title: "Printable Report",
        content: fragment,
        printable: true
      });

      assert.equal(result.mode, "print");
      assert.ok(result.html.includes('data-report-mode="print"'));
      assert.ok(result.html.includes("@media print"));
      assert.ok(result.html.includes('id="printable-media-styles"'));
      assert.ok(!result.html.includes("Not PDF-Ready"));
    });

    it("should handle live mode with datastar addon and live report mode", () => {
      const fragment = `<h1 id="live-dashboard">Live Agent Dashboard</h1>`;

      const result = buildReport({
        title: "Live Report",
        content: fragment,
        live: true
      });

      assert.equal(result.mode, "live-report");
      assert.ok(result.html.includes('data-report-mode="live-report"'));
      assert.ok(result.activeAddons.includes("datastar"));
      assert.ok(result.html.includes("@starfederation/datastar@1.0.0-beta.9/dist/datastar.js"));
    });

    it("should set custom theme on html tag when theme parameter is passed", () => {
      const fragment = `<h1 id="theme-test">Themed Report</h1>`;
      const result = buildReport({
        title: "Themed Report",
        content: fragment,
        theme: "synthwave"
      });
      assert.ok(result.html.includes('data-theme="synthwave"'));
    });

    it("should inject new CDN addon scripts and handle presentation mode attribute", () => {
      const fragment = `
        <div id="calendar" data-fullcalendar="true"></div>
        <div data-dayjs="2026-11-03"></div>
        <div data-mock='{"id": 1}'></div>
        <div data-showdown="# Test"></div>
        <div id="impress"><div class="step">Slide</div></div>
      `;
      const result = buildReport({
        title: "New Addons Report",
        content: fragment,
        presentation: true
      });

      assert.ok(result.activeAddons.includes("fullcalendar"));
      assert.ok(result.activeAddons.includes("dayjs"));
      assert.ok(result.activeAddons.includes("mockjs"));
      assert.ok(result.activeAddons.includes("showdown"));
      assert.ok(result.activeAddons.includes("impress"));

      const html = result.html;
      assert.ok(html.includes("fullcalendar@6.1.15"));
      assert.ok(html.includes("dayjs@1.11.13"));
      assert.ok(html.includes("mockjs@1.1.0"));
      assert.ok(html.includes("showdown@2.1.0"));
      assert.ok(html.includes("impress.js@1.1.0"));
      assert.ok(html.includes('data-presentation="true"'));
    });

    it("should enforce print-equivalent fallback and presentation guard for impress slides", () => {
      const fragment = `<div id="impress"><div class="step" data-x="1000">Slide 1</div></div>`;
      
      // Standard analytical report mode (not presentation)
      const standardResult = buildReport({
        title: "Standard Report with Impress",
        content: fragment,
        presentation: false
      });
      assert.ok(standardResult.html.includes('html:not([data-presentation="true"]) .step'));
      assert.equal(/<html[^>]*data-presentation="true"/.test(standardResult.html), false);

      // Printable mode: must include @media print step rules
      const printableResult = buildReport({
        title: "Printable Report with Impress",
        content: fragment,
        printable: true
      });
      assert.ok(printableResult.html.includes(".step {"));
      assert.ok(printableResult.html.includes("break-inside: avoid !important;"));
      assert.ok(printableResult.html.includes("transform: none !important;"));
    });

    it("should inject custom theme CSS and activate theme via customTheme option", () => {
      const fragment = `<h1 id="custom-theme-test">Custom Themed Report</h1>`;
      const result = buildReport({
        title: "Custom Themed Report",
        content: fragment,
        customTheme: {
          "galaxy-corp": {
            extends: "dark",
            primary: "#3b82f6",
            secondary: "#ec4899"
          }
        }
      });

      assert.equal(result.theme, "galaxy-corp");
      assert.ok(result.html.includes('data-theme="galaxy-corp"'));
      assert.ok(result.html.includes('<style id="daisyui-custom-themes">'));
      assert.ok(result.html.includes('[data-theme="galaxy-corp"]'));
      assert.ok(result.html.includes("--p: 62.3"));
      assert.ok(result.hasCustomTheme);
    });
  });

  describe("CLI Execution via subprocess", () => {
    it("should build report from file using CLI and emit to disk in <100ms", () => {
      const fragmentFile = path.join(tmpDir, "frag.html");
      const outputFile = path.join(tmpDir, "out.html");

      fs.writeFileSync(
        fragmentFile,
        `<h1 id="sub-test">Subprocess Report</h1><div><canvas id="chart1"></canvas></div>`,
        "utf-8"
      );

      const start = performance.now();
      const stdout = execSync(
        `node ${cliPath} --content "${fragmentFile}" --output "${outputFile}" --title "CLI Test" --theme "cupcake"`,
        { encoding: "utf-8" }
      );
      const elapsed = performance.now() - start;

      assert.ok(stdout.includes("Report assembled"));
      assert.ok(fs.existsSync(outputFile));
      const builtHtml = fs.readFileSync(outputFile, "utf-8");
      assert.ok(builtHtml.includes("<title>CLI Test</title>"));
      assert.ok(builtHtml.includes('id="sub-test"'));
      assert.ok(builtHtml.includes('data-theme="cupcake"'));
      assert.ok(builtHtml.includes("chart.umd.min.js"));
      // Verify sub-second speed
      assert.ok(elapsed < 2000, `Execution took ${elapsed}ms`);
    });

    it("should build report with --custom-theme via CLI and inject custom styles", () => {
      const fragmentFile = path.join(tmpDir, "frag.html");
      const themeFile = path.join(tmpDir, "theme.json");
      const outputFile = path.join(tmpDir, "out-custom.html");

      fs.writeFileSync(
        fragmentFile,
        `<h1 id="brand-heading">Acme Analytics</h1>`,
        "utf-8"
      );

      fs.writeFileSync(
        themeFile,
        JSON.stringify({
          "acme-brand": {
            extends: "emerald",
            primary: "#2563eb",
            secondary: "#f43f5e"
          }
        }),
        "utf-8"
      );

      const stdout = execSync(
        `node ${cliPath} --content "${fragmentFile}" --output "${outputFile}" --custom-theme "${themeFile}"`,
        { encoding: "utf-8" }
      );

      assert.ok(stdout.includes("Report assembled"));
      assert.ok(fs.existsSync(outputFile));
      const builtHtml = fs.readFileSync(outputFile, "utf-8");
      assert.ok(builtHtml.includes('data-theme="acme-brand"'));
      assert.ok(builtHtml.includes('<style id="daisyui-custom-themes">'));
      assert.ok(builtHtml.includes('[data-theme="acme-brand"]'));
    });
  });

  describe("stripDuplicateNavbars", () => {
    it("strips a print:hidden sticky control bar with nested divs while preserving report content", () => {
      const fragment = `
        <div class="print:hidden bg-base-100 border rounded-2xl p-4 sticky top-16 z-30">
          <div class="flex items-center"><span>Executive Printable Suite</span></div>
          <div><button onclick="window.print()">Print / Save PDF</button></div>
        </div>
        <header class="border-b pb-4"><h1>Cover Title</h1></header>
        <section id="body">Real Content</section>
      `;
      const { html, strippedCount } = stripDuplicateNavbars(fragment);
      assert.equal(strippedCount, 1);
      assert.ok(!html.includes("Executive Printable Suite"));
      assert.ok(!html.includes("Print / Save PDF"));
      assert.ok(html.includes("<h1>Cover Title</h1>"));
      assert.ok(html.includes("Real Content"));
    });

    it("strips a nested .navbar element and ensures buildReport emits only the single shell navbar", () => {
      const fragment = `
        <nav class="navbar bg-base-200"><div><span>Duplicate Nav</span></div></nav>
        <section id="main-sec"><h2>Report Body</h2></section>
      `;
      const { html } = buildReport({
        title: "Print Test",
        content: fragment,
        mode: "print"
      });
      assert.ok(!html.includes("Duplicate Nav"));
      assert.ok(html.includes("<h2>Report Body</h2>"));
      const navbarMatches = html.match(/<nav\b[^>]*class="[^"]*\bnavbar\b[^"]*"/g) || [];
      assert.equal(navbarMatches.length, 1, "Only the shell navbar should exist in compiled output");
    });
  });
});
