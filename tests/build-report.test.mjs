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
      const argv = ["node", "build-report.mjs", "-c", "frag.html", "--charts", "--math", "--leaflet"];
      const opts = parseArgs(argv);
      assert.ok(opts.addons.includes("charts"));
      assert.ok(opts.addons.includes("katex")); // alias for math
      assert.ok(opts.addons.includes("leaflet"));
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

      assert.equal(result.mode, "interactive");
      assert.ok(result.activeAddons.includes("charts"));
      assert.ok(result.activeAddons.includes("mermaid"));
      assert.ok(!result.activeAddons.includes("leaflet"));

      const html = result.html;
      assert.ok(html.includes("<title>Deterministic Benchmark Report</title>"));
      assert.ok(html.includes('id="navbar-report-title"'));
      assert.ok(html.includes("Deterministic Benchmark Report"));
      assert.ok(html.includes('data-report-mode="interactive"'));
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

      assert.equal(result.mode, "static");
      assert.ok(result.html.includes('data-report-mode="static"'));
      assert.ok(result.html.includes("@media print"));
      assert.ok(result.html.includes('id="printable-media-styles"'));
      assert.ok(!result.html.includes("Not PDF-Ready"));
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
});
