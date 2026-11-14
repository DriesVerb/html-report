import test, { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { parseArgs } from "../skills/html-report/playwright/verify-report.mjs";
import {
  VerificationCheck,
  CheckRegistry,
  createDefaultRegistry
} from "../skills/html-report/playwright/harness/registry.mjs";
import { parseViewports } from "../skills/html-report/playwright/harness/checks/core/responsive.mjs";
import { Reporter } from "../skills/html-report/playwright/harness/reporter.mjs";
import { runHarness } from "../skills/html-report/playwright/harness/runner.mjs";

describe("Playwright Extensible Harness Test Suite", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "playwright-harness-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("1. CLI Flags Parsing (parseArgs)", () => {
    it("should parse legacy flags correctly", () => {
      const parsed = parseArgs([
        "node",
        "verify-report.mjs",
        "report.html",
        "--quick",
        "--pdf",
        "out.pdf",
        "--mode",
        "static",
        "--caller",
        "ci-bot"
      ]);

      assert.equal(parsed.htmlPath, "report.html");
      assert.equal(parsed.quick, true);
      assert.equal(parsed.pdf, "out.pdf");
      assert.equal(parsed.mode, "static");
      assert.equal(parsed.caller, "ci-bot");
    });

    it("should parse precision execution flags (--timeout, --bail, --strict, --headed, --json, --screenshots)", () => {
      const parsed = parseArgs([
        "node",
        "verify-report.mjs",
        "test.html",
        "--timeout",
        "12000",
        "--bail",
        "--strict",
        "--headed",
        "--json",
        "results.json",
        "--screenshots",
        "test-shots"
      ]);

      assert.equal(parsed.timeout, 12000);
      assert.equal(parsed.bail, true);
      assert.equal(parsed.strict, true);
      assert.equal(parsed.headed, true);
      assert.equal(parsed.json, "results.json");
      assert.equal(parsed.screenshots, "test-shots");
    });

    it("should parse filtering flags (--suites, --only, --grep)", () => {
      const parsed = parseArgs([
        "node",
        "verify-report.mjs",
        "test.html",
        "--suites",
        "core,cdns,responsive",
        "--only",
        "mermaid",
        "--grep",
        "^cdn:"
      ]);

      assert.equal(parsed.suites, "core,cdns,responsive");
      assert.equal(parsed.only, "mermaid");
      assert.equal(parsed.grep, "^cdn:");
    });

    it("should parse CDN styleguide flags (--all-cdns, --cdns, --check-<cdn>)", () => {
      const parsed = parseArgs([
        "node",
        "verify-report.mjs",
        "test.html",
        "--all-cdns",
        "--cdns",
        "charts,mermaid,leaflet",
        "--check-charts",
        "--check-mermaid",
        "--check-maps",
        "--check-tables",
        "--check-math",
        "--check-code",
        "--check-markdown",
        "--check-icons",
        "--check-reactive",
        "--check-calendar",
        "--color-contrast"
      ]);

      assert.equal(parsed.allCdns, true);
      assert.equal(parsed.cdns, "charts,mermaid,leaflet");
      assert.equal(parsed.checkCharts, true);
      assert.equal(parsed.checkMermaid, true);
      assert.equal(parsed.checkMaps, true);
      assert.equal(parsed.checkLeaflet, true);
      assert.equal(parsed.checkTables, true);
      assert.equal(parsed.checkGridjs, true);
      assert.equal(parsed.checkMath, true);
      assert.equal(parsed.checkKatex, true);
      assert.equal(parsed.checkCode, true);
      assert.equal(parsed.checkHighlight, true);
      assert.equal(parsed.checkMarkdown, true);
      assert.equal(parsed.checkMarked, true);
      assert.equal(parsed.checkIcons, true);
      assert.equal(parsed.checkLucide, true);
      assert.equal(parsed.checkReactive, true);
      assert.equal(parsed.checkAlpine, true);
      assert.equal(parsed.checkCalendar, true);
      assert.equal(parsed.checkFullcalendar, true);
      assert.equal(parsed.colorContrast, true);
    });

    it("should parse --viewports and --themes flags", () => {
      const parsed = parseArgs([
        "node",
        "verify-report.mjs",
        "test.html",
        "--viewports",
        "sm,lg,1920x1080",
        "--themes",
        "light,dark,cyberpunk"
      ]);

      assert.equal(parsed.viewports, "sm,lg,1920x1080");
      assert.equal(parsed.themes, "light,dark,cyberpunk");
    });
  });

  describe("2. Viewports Parsing (parseViewports)", () => {
    it("should default to sm & lg in quick mode", () => {
      const viewports = parseViewports(null, true);
      assert.equal(viewports.length, 2);
      assert.equal(viewports[0].name, "sm");
      assert.equal(viewports[1].name, "lg");
    });

    it("should default to all 5 Tailwind breakpoints in standard mode", () => {
      const viewports = parseViewports(null, false);
      assert.equal(viewports.length, 5);
      assert.deepEqual(
        viewports.map((v) => v.name),
        ["sm", "md", "lg", "xl", "2xl"]
      );
    });

    it("should parse custom dimensions and named tokens", () => {
      const viewports = parseViewports("sm, 1920x1080, xl, 800x600");
      assert.equal(viewports.length, 4);
      assert.equal(viewports[0].name, "sm");
      assert.equal(viewports[1].name, "1920x1080");
      assert.equal(viewports[1].width, 1920);
      assert.equal(viewports[1].height, 1080);
      assert.equal(viewports[2].name, "xl");
      assert.equal(viewports[3].name, "800x600");
      assert.equal(viewports[3].width, 800);
      assert.equal(viewports[3].height, 600);
    });
  });

  describe("3. CheckRegistry & Pluggable Architecture", () => {
    it("should initialize default registry with all 17 checks (6 core + 11 CDNs)", async () => {
      const registry = await createDefaultRegistry();
      const all = registry.getAll();
      assert.equal(all.length, 17);

      const ids = all.map((c) => c.id);
      assert.ok(ids.includes("core:console-errors"));
      assert.ok(ids.includes("core:structure"));
      assert.ok(ids.includes("core:responsive"));
      assert.ok(ids.includes("core:theme-switcher"));
      assert.ok(ids.includes("core:print-pdf"));
      assert.ok(ids.includes("core:a11y-contrast"));

      assert.ok(ids.includes("cdn:charts"));
      assert.ok(ids.includes("cdn:mermaid"));
      assert.ok(ids.includes("cdn:leaflet"));
      assert.ok(ids.includes("cdn:gridjs"));
      assert.ok(ids.includes("cdn:katex"));
      assert.ok(ids.includes("cdn:highlight"));
      assert.ok(ids.includes("cdn:marked"));
      assert.ok(ids.includes("cdn:lucide"));
      assert.ok(ids.includes("cdn:alpine"));
      assert.ok(ids.includes("cdn:fullcalendar"));
      assert.ok(ids.includes("cdn:reveal"));
    });

    it("should register custom checks dynamically", () => {
      const registry = new CheckRegistry();
      class CustomSecurityAudit extends VerificationCheck {
        constructor() {
          super({
            id: "audit:security",
            name: "Security Headers Audit",
            category: "audit"
          });
        }
        async run() {
          return { id: this.id, status: "passed", errors: [] };
        }
      }

      const check = new CustomSecurityAudit();
      registry.register(check);

      assert.equal(registry.has("audit:security"), true);
      assert.equal(registry.get("audit:security"), check);
      assert.equal(registry.getAll().length, 1);
    });

    it("should filter checks by --suites", async () => {
      const registry = await createDefaultRegistry();

      const cdnsOnly = registry.filter({ suites: "cdns" });
      assert.equal(cdnsOnly.length, 11);
      assert.ok(cdnsOnly.every((c) => c.category === "cdn"));

      const themesOnly = registry.filter({ suites: "themes" });
      assert.equal(themesOnly.length, 1);
      assert.equal(themesOnly[0].id, "core:theme-switcher");

      const responsiveOnly = registry.filter({ suites: "responsive" });
      assert.equal(responsiveOnly.length, 1);
      assert.equal(responsiveOnly[0].id, "core:responsive");
    });

    it("should filter checks by --only and --grep", async () => {
      const registry = await createDefaultRegistry();

      const mermaidOnly = registry.filter({ only: "mermaid" });
      assert.equal(mermaidOnly.length, 1);
      assert.equal(mermaidOnly[0].id, "cdn:mermaid");

      const grepCore = registry.filter({ grep: "^core:" });
      assert.equal(grepCore.length, 6);
      assert.ok(grepCore.every((c) => c.id.startsWith("core:")));
    });

    it("should filter checks by --all-cdns and --cdns", async () => {
      const registry = await createDefaultRegistry();

      const allCdns = registry.filter({ allCdns: true });
      assert.equal(allCdns.length, 11);

      const specificCdns = registry.filter({ cdns: "mermaid,charts" });
      assert.equal(specificCdns.length, 2);
      assert.deepEqual(
        specificCdns.map((c) => c.id).sort(),
        ["cdn:charts", "cdn:mermaid"].sort()
      );
    });

    it("should filter checks by explicit flag (--check-mermaid)", async () => {
      const registry = await createDefaultRegistry();

      const filtered = registry.filter({ checkMermaid: true });
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].id, "cdn:mermaid");
    });
  });

  describe("4. Reporter & JSON Diagnostics Telemetry", () => {
    it("should record checks and summarize pass/fail state", () => {
      const reporter = new Reporter({ json: null });

      reporter.onRunStart({
        htmlPath: "/tmp/report.html",
        mode: "interactive",
        detectedMode: "interactive",
        quick: false,
        totalChecks: 2
      });

      reporter.onCheckComplete(
        { id: "core:structure", name: "Structure" },
        {
          id: "core:structure",
          name: "Structure",
          status: "passed",
          errors: [],
          assertions: [{ rule: "navbar", passed: true, message: "Navbar present" }]
        }
      );

      reporter.onCheckComplete(
        { id: "cdn:mermaid", name: "Mermaid" },
        {
          id: "cdn:mermaid",
          name: "Mermaid",
          status: "failed",
          errors: ["Syntax error in diagram"],
          assertions: []
        }
      );

      const summary = reporter.onRunComplete();
      assert.equal(summary.success, false);
      assert.equal(summary.failures.length, 1);
      assert.equal(summary.failures[0], "Syntax error in diagram");
      assert.equal(summary.results.length, 2);
    });

    it("should enforce strict mode treating warnings as errors", () => {
      const reporter = new Reporter({ strict: true });
      reporter.onRunStart({
        htmlPath: "/tmp/report.html",
        mode: "interactive",
        detectedMode: "interactive",
        quick: false,
        totalChecks: 1
      });

      reporter.onCheckComplete(
        { id: "core:responsive", name: "Responsive" },
        {
          id: "core:responsive",
          name: "Responsive",
          status: "warned",
          errors: [],
          warnings: ["Badge has slight wrapping"]
        }
      );

      const summary = reporter.onRunComplete();
      assert.equal(summary.success, false);
      assert.ok(summary.failures.some((f) => f.includes("[STRICT]")));
    });

    it("should emit machine-readable JSON telemetry file", () => {
      const jsonPath = path.join(tmpDir, "telemetry.json");
      const reporter = new Reporter({ json: jsonPath, quick: true });

      reporter.onRunStart({
        htmlPath: "/tmp/test.html",
        mode: "static",
        detectedMode: "static",
        quick: true,
        totalChecks: 1
      });

      reporter.onCheckComplete(
        { id: "cdn:charts", name: "Charts" },
        {
          id: "cdn:charts",
          name: "Charts",
          status: "passed",
          styleguide: { compliant: true, rulesChecked: ["canvas-present", "palette-sync"] },
          errors: [],
          warnings: [],
          messages: ["Charts loaded"]
        }
      );

      reporter.onRunComplete();

      assert.ok(fs.existsSync(jsonPath));
      const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      assert.equal(parsed.summary.passed, 1);
      assert.equal(parsed.summary.failed, 0);
      assert.equal(parsed.summary.compliant, true);
      assert.equal(parsed.results[0].id, "cdn:charts");
    });
  });

  describe("5. Pipeline Execution with Custom Check Registry", () => {
    it("should throw when HTML file does not exist", async () => {
      await assert.rejects(
        async () => {
          await runHarness("/nonexistent/file.html");
        },
        {
          message: /HTML report not found/
        }
      );
    });

    it("should execute custom registry pipeline and handle bail early termination", async () => {
      const dummyHtml = path.join(tmpDir, "dummy.html");
      fs.writeFileSync(
        dummyHtml,
        `<!DOCTYPE html><html data-theme="light"><head><title>Test</title></head><body><script>window.__REPORT_READY__ = true;</script></body></html>`,
        "utf-8"
      );

      const customRegistry = new CheckRegistry();
      const executionOrder = [];

      class FirstPassCheck extends VerificationCheck {
        constructor() {
          super({ id: "test:first", name: "First Check" });
        }
        async run() {
          executionOrder.push("first");
          return { id: this.id, name: this.name, status: "passed", errors: [] };
        }
      }

      class SecondFailCheck extends VerificationCheck {
        constructor() {
          super({ id: "test:second", name: "Second Check" });
        }
        async run() {
          executionOrder.push("second");
          return { id: this.id, name: this.name, status: "failed", errors: ["Intentional failure"] };
        }
      }

      class ThirdUnreachedCheck extends VerificationCheck {
        constructor() {
          super({ id: "test:third", name: "Third Check" });
        }
        async run() {
          executionOrder.push("third");
          return { id: this.id, name: this.name, status: "passed", errors: [] };
        }
      }

      customRegistry.register(new FirstPassCheck());
      customRegistry.register(new SecondFailCheck());
      customRegistry.register(new ThirdUnreachedCheck());

      const res = await runHarness(dummyHtml, {
        registry: customRegistry,
        quick: true,
        bail: true
      });

      assert.equal(res.success, false);
      assert.deepEqual(executionOrder, ["first", "second"]);
      assert.ok(!executionOrder.includes("third"), "Third check must NOT run when bail is enabled");
    });
  });

  describe("6. Core Structure Duplicate Navbar Verification", () => {
    it("should fail core:structure when a report contains a second navbar or sticky control bar inside <main>", async () => {
      const { buildReport } = await import(
        path.resolve(process.cwd(), "skills/html-report/scripts/build-report.mjs")
      );
      const { html } = buildReport({
        title: "Bad Layout Verification Test",
        content: `<h1 id="sec-1">Section 1</h1><p>Body</p>`,
        mode: "print"
      });
      // Inject a legacy/hand-edited duplicate sticky control bar into <main>
      const badHtml = html.replace(
        `<h1 id="sec-1">`,
        `<div class="print:hidden sticky top-16 z-30"><nav class="navbar">Duplicate</nav></div><h1 id="sec-1">`
      );
      const badFile = path.join(tmpDir, "bad-layout.html");
      fs.writeFileSync(badFile, badHtml, "utf-8");

      const res = await runHarness(badFile, {
        only: ["core:structure"],
        quick: true
      });

      assert.equal(res.success, false);
      const structureResult = res.results.find((r) => r.id === "core:structure");
      assert.ok(structureResult);
      assert.equal(structureResult.status, "failed");
      assert.ok(
        structureResult.errors.some((e) => e.includes("duplicate") || e.includes(".navbar")),
        `Expected duplicate navbar error, got: ${JSON.stringify(structureResult.errors)}`
      );
    });
  });
});
