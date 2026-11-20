import test, { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, "../../../skills/html-report/scripts/build-report.mjs");

const {
  detectAddons,
  extractMainContent,
  stripDuplicateNavbars,
  resolveMermaidIncludes,
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

    it("should handle --presentation flag with reveal default and explicit --impress support", () => {
      const argv = ["node", "build-report.mjs", "-c", "frag.html", "--presentation"];
      const opts = parseArgs(argv);
      assert.equal(opts.presentation, true);
      assert.equal(opts.mode, "presentation");

      const legacyOpts = parseArgs(["node", "build-report.mjs", "-c", "frag.html", "--presentation", "--impress"]);
      assert.equal(legacyOpts.presentation, true);
      assert.ok(legacyOpts.addons.includes("impress"));
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

  describe("Clean-by-default & Opt-in Authoring + Explicit Mirroring", () => {
    it("includes Studio authoring chrome by default (Edit Mode enabled unless --published or --no-editable)", () => {
      const { html } = buildReport({
        title: "Default Editable Report",
        content: `<h1 id="default-title">Default Editable Report</h1><p>Edit mode ready</p>`
      });
      assert.ok(html.includes('id="edit-dock"'), "Default build must inject #edit-dock");
      assert.ok(html.includes('id="all-settings-modal"'), "Default build must inject #all-settings-modal");
      assert.ok(html.includes('id="open-all-settings-btn"'), "Default build must inject #open-all-settings-btn");
      assert.ok(html.includes('id="settings-publish-toggle"'), "Default build must inject #settings-publish-toggle");
      assert.ok(html.includes("HTMLReportEdit"), "Default build must include authoring runtime");
      assert.ok(html.includes('id="settings-gear-btn"'), "Default build must retain settings gear switcher");

      const fragFile = path.join(tmpDir, "default-edit-frag.html");
      const outFile = path.join(tmpDir, "default-edit-out.html");
      fs.writeFileSync(fragFile, `<h1 id="cli-default-edit">CLI Default Editable</h1>`, "utf8");
      execSync(`node ${cliPath} --content "${fragFile}" --output "${outFile}"`, { encoding: "utf8" });
      const cliHtml = fs.readFileSync(outFile, "utf8");
      assert.ok(cliHtml.includes('id="edit-dock"'), "Default CLI build must inject #edit-dock");
      assert.ok(cliHtml.includes('id="all-settings-modal"'), "Default CLI build must inject #all-settings-modal");
      assert.ok(cliHtml.includes('id="open-all-settings-btn"'), "Default CLI build must inject #open-all-settings-btn");
      assert.ok(cliHtml.includes('id="settings-publish-toggle"'), "Default CLI build must inject #settings-publish-toggle");
      assert.ok(cliHtml.includes("HTMLReportEdit"), "Default CLI build must include authoring runtime");
    });

    it("omits authoring plugin chrome when published: true / --published or editable: false / --no-editable is passed", () => {
      const { html: publishedHtml } = buildReport({
        title: "Published Report",
        content: `<h1 id="pub-title">Published Report</h1>`,
        published: true
      });
      assert.equal(publishedHtml.includes('id="edit-dock"'), false, "published: true must omit #edit-dock");
      assert.equal(publishedHtml.includes('id="all-settings-modal"'), false, "published: true must omit #all-settings-modal");
      assert.equal(publishedHtml.includes('id="open-all-settings-btn"'), false, "published: true must omit #open-all-settings-btn");
      assert.equal(publishedHtml.includes('id="settings-publish-toggle"'), false, "published: true must omit #settings-publish-toggle");
      assert.equal(publishedHtml.includes("HTMLReportEdit"), false, "published: true must omit authoring runtime");
      assert.ok(publishedHtml.includes('id="settings-gear-btn"'), "published: true must retain lightweight gear switcher");

      const { html: nonEditableHtml } = buildReport({
        title: "Non-Editable Report",
        content: `<h1 id="no-edit-title">Non-Editable Report</h1>`,
        editable: false
      });
      assert.equal(nonEditableHtml.includes('id="edit-dock"'), false, "editable: false must omit #edit-dock");
      assert.equal(nonEditableHtml.includes('id="all-settings-modal"'), false, "editable: false must omit #all-settings-modal");
      assert.equal(nonEditableHtml.includes('id="open-all-settings-btn"'), false, "editable: false must omit #open-all-settings-btn");
      assert.equal(nonEditableHtml.includes('id="settings-publish-toggle"'), false, "editable: false must omit #settings-publish-toggle");
      assert.equal(nonEditableHtml.includes("HTMLReportEdit"), false, "editable: false must omit authoring runtime");
      assert.ok(nonEditableHtml.includes('id="settings-gear-btn"'), "editable: false must retain lightweight gear switcher");

      const fragFile = path.join(tmpDir, "edit-frag.html");
      const pubOutFile = path.join(tmpDir, "pub-out.html");
      const noEditOutFile = path.join(tmpDir, "no-edit-out.html");
      fs.writeFileSync(fragFile, `<h1 id="cli-edit">CLI Opt-Out</h1>`, "utf8");

      execSync(`node ${cliPath} --content "${fragFile}" --output "${pubOutFile}" --published`, { encoding: "utf8" });
      const pubCliHtml = fs.readFileSync(pubOutFile, "utf8");
      assert.equal(pubCliHtml.includes('id="edit-dock"'), false, "--published CLI flag must omit #edit-dock");
      assert.equal(pubCliHtml.includes("HTMLReportEdit"), false, "--published CLI flag must omit HTMLReportEdit");

      execSync(`node ${cliPath} --content "${fragFile}" --output "${noEditOutFile}" --no-editable`, { encoding: "utf8" });
      const noEditCliHtml = fs.readFileSync(noEditOutFile, "utf8");
      assert.equal(noEditCliHtml.includes('id="edit-dock"'), false, "--no-editable CLI flag must omit #edit-dock");
      assert.equal(noEditCliHtml.includes("HTMLReportEdit"), false, "--no-editable CLI flag must omit HTMLReportEdit");
    });

    it("mirrors output only when --mirror-dir is explicitly supplied", () => {
      const fragFile = path.join(tmpDir, "mirror-frag.html");
      const outFile = path.join(tmpDir, "out", "index.html");
      const mirrorDir = path.join(tmpDir, "mirror-target");
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(fragFile, `<h1 id="m-title">Mirror Test</h1>`, "utf8");

      execSync(
        `node ${cliPath} --content "${fragFile}" --output "${outFile}" --project demo-proj --mirror-dir "${mirrorDir}"`,
        { encoding: "utf8" }
      );
      const mirroredFile = path.join(mirrorDir, "demo-proj", "index.html");
      assert.ok(fs.existsSync(mirroredFile), "--mirror-dir must copy compiled output to <mirrorDir>/<project>/index.html");
      assert.equal(fs.readFileSync(mirroredFile, "utf8"), fs.readFileSync(outFile, "utf8"));
    });
  });

  describe("Review Learnings: Minimal Addon Detection, --only-addons & Mermaid File Inclusion", () => {
    it("does not trigger addon injection on prose containing English words like marked, showdown, Leaflet, KaTeX, Chart.js, hljs, dayjs, or datastar", () => {
      const proseFragment = `
        <section id="prose-only">
          <h1 id="notes">Release Notes</h1>
          <p>Tasks were marked complete after comparing Leaflet, KaTeX, Chart.js, hljs, dayjs, datastar, and a markdown showdown in prose.</p>
          <div class="overflow-x-auto w-full">
            <table class="table table-sm w-full"><thead><tr><th>Item</th></tr></thead><tbody><tr><td>Text</td></tr></tbody></table>
          </div>
        </section>
      `;

      assert.deepEqual(detectAddons(proseFragment), []);
      const { html, activeAddons } = buildReport({
        title: "Prose Report",
        content: proseFragment
      });
      assert.deepEqual(activeAddons, []);
      assert.ok(!html.includes("marked.min.js"));
      assert.ok(!html.includes("showdown.min.js"));
      assert.ok(!html.includes("leaflet.js"));
      assert.ok(!html.includes("katex.min.js"));
      assert.ok(!html.includes("chart.umd.min.js"));
      assert.ok(!html.includes("highlight.min.js"));
      assert.ok(!html.includes("dayjs.min.js"));
      assert.ok(!html.includes("@starfederation/datastar"));
    });

    it("supports --only-addons and --no-auto-addons in parseArgs, detectAddons, and buildReport CLI", () => {
      const onlyMermaid = parseArgs(["node", "build-report.mjs", "-c", "f.html", "--only-addons", "mermaid"]);
      assert.equal(onlyMermaid.autoDetectAddons, false);
      assert.deepEqual(onlyMermaid.addons, ["mermaid"]);

      const onlyNone = parseArgs(["node", "build-report.mjs", "-c", "f.html", "--only-addons", "none"]);
      assert.equal(onlyNone.autoDetectAddons, false);
      assert.deepEqual(onlyNone.addons, []);

      const noAuto = parseArgs(["node", "build-report.mjs", "-c", "f.html", "--no-auto-addons"]);
      assert.equal(noAuto.autoDetectAddons, false);

      const contentWithCanvasAndMermaid = `<canvas id="c1"></canvas><div class="mermaid">graph TD\nA-->B</div>`;
      assert.deepEqual(detectAddons(contentWithCanvasAndMermaid, ["mermaid"], { autoDetect: false }), ["mermaid"]);
      assert.deepEqual(detectAddons(contentWithCanvasAndMermaid, ["none"], { autoDetect: false }), []);

      const fragFile = path.join(tmpDir, "only-frag.html");
      const outFile = path.join(tmpDir, "only-out.html");
      fs.writeFileSync(fragFile, `<h1 id="o1">Only Addons</h1>${contentWithCanvasAndMermaid}`, "utf-8");
      execSync(`node ${cliPath} --content "${fragFile}" --output "${outFile}" --only-addons mermaid`, { encoding: "utf-8" });
      const builtHtml = fs.readFileSync(outFile, "utf-8");
      assert.ok(builtHtml.includes("mermaid.min.js"));
      assert.ok(!builtHtml.includes("chart.umd.min.js"));
    });

    it("resolves direct .mmd file inclusions via data-mermaid-src, data-src, and <!-- {{MERMAID:...}} -->", () => {
      const diagramsDir = path.join(tmpDir, "diagrams");
      fs.mkdirSync(diagramsDir, { recursive: true });
      fs.writeFileSync(
        path.join(diagramsDir, "flow.mmd"),
        "```mermaid\nflowchart LR\n  Client --> Server\n```\n",
        "utf-8"
      );
      fs.writeFileSync(
        path.join(tmpDir, "seq.mmd"),
        "sequenceDiagram\n  Alice->>Bob: Sync\n",
        "utf-8"
      );

      const fragPath = path.join(tmpDir, "frag.html");
      const fragment = `
        <h1 id="arch">Architecture</h1>
        <div class="mermaid bg-base-200/50 p-4 rounded-box" data-mermaid-src="./diagrams/flow.mmd"></div>
        <!-- {{MERMAID:./seq.mmd}} -->
      `;
      fs.writeFileSync(fragPath, fragment, "utf-8");

      const resolved = resolveMermaidIncludes(fragment, { contentPath: fragPath, workspaceRoot: tmpDir });
      assert.ok(resolved.includes("Client --> Server"));
      assert.ok(!resolved.includes("```mermaid"));
      assert.ok(resolved.includes("Alice->>Bob: Sync"));

      const built = buildReport({
        title: "Mermaid Include Test",
        content: fragment,
        contentPath: fragPath,
        workspaceRoot: tmpDir
      });
      assert.ok(built.activeAddons.includes("mermaid"));
      assert.ok(built.html.includes("Client --> Server"));
      assert.ok(built.html.includes("Alice->>Bob: Sync"));
      assert.ok(built.html.includes("mermaid.min.js"));

      assert.throws(
        () => resolveMermaidIncludes(`<div class="mermaid" data-mermaid-src="./missing.mmd"></div>`, {
          contentPath: fragPath,
          workspaceRoot: tmpDir
        }),
        /Mermaid diagram file not found/
      );
    });

    it("routes CLI builds without --output into projects/<slug>/index.html instead of root report.html", () => {
      const projDir = path.join(tmpDir, "projects", "tax-roadmap");
      fs.mkdirSync(projDir, { recursive: true });
      const fragFile = path.join(projDir, "fragment.html");
      fs.writeFileSync(fragFile, `<main id="report-main"><h1 id="t1">Tax Roadmap</h1></main>`, "utf-8");

      execSync(`node "${cliPath}" --content "${fragFile}" --title "Tax Roadmap"`, {
        cwd: tmpDir,
        encoding: "utf-8"
      });

      assert.ok(fs.existsSync(path.join(projDir, "index.html")), "Should write to projects/tax-roadmap/index.html");
      assert.equal(fs.existsSync(path.join(tmpDir, "report.html")), false, "Must not write report.html in workspace root");
    });
  });
});
