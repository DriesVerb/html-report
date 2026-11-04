import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

import {
  CANONICAL_MODES,
  MODE_ALIASES,
  normalizeMode,
  buildReport
} from "../skills/html-report/scripts/build-report.mjs";

import {
  MODE_SERVER_POLICIES,
  runLifecycle,
  parseArgs as parseHarnessArgs
} from "../skills/html-report/scripts/harness.mjs";

import {
  detectReportMode,
  startServer
} from "../skills/html-report/scripts/serve-report.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const runtimePath = path.resolve(__dirname, "../skills/html-report/assets/report-runtime.js");
const runtime = await import(runtimePath);

function fetchUrl(url, { headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on("error", reject);
  });
}

describe("Canonical Report Rendering Modes", () => {
  it("defines exactly the six canonical modes", () => {
    assert.deepEqual(CANONICAL_MODES, [
      "print",
      "report",
      "presentation",
      "dashboard",
      "working-report",
      "live-report"
    ]);
  });

  it("normalizes canonical names, case-insensitively", () => {
    for (const mode of CANONICAL_MODES) {
      assert.equal(normalizeMode(mode), mode);
      assert.equal(normalizeMode(mode.toUpperCase()), mode);
    }
  });

  it("normalizes all recognized aliases to canonical modes", () => {
    assert.equal(normalizeMode("printable"), "print");
    assert.equal(normalizeMode("-p"), "print");
    assert.equal(normalizeMode("standard"), "report");
    assert.equal(normalizeMode("static"), "report");
    assert.equal(normalizeMode("slides"), "presentation");
    assert.equal(normalizeMode("deck"), "presentation");
    assert.equal(normalizeMode("impress"), "presentation");
    assert.equal(normalizeMode("dash"), "dashboard");
    assert.equal(normalizeMode("working"), "working-report");
    assert.equal(normalizeMode("journey"), "working-report");
    assert.equal(normalizeMode("live"), "live-report");
    assert.equal(normalizeMode("stream"), "live-report");
    assert.equal(normalizeMode("realtime"), "live-report");
    assert.equal(normalizeMode("-l"), "live-report");
  });

  it("returns null for unrecognized modes", () => {
    assert.equal(normalizeMode("badmode"), null);
    assert.equal(normalizeMode("unknown"), null);
    assert.equal(normalizeMode(""), null);
    assert.equal(normalizeMode(null), null);
    assert.equal(normalizeMode(undefined), null);
  });
});

describe("Deterministic HTML Mode Stamping & Conditional Ingestion", () => {
  const dummyFragment = `
    <section id="intro" class="p-4">
      <h2 class="text-xl font-bold">Intro Heading</h2>
      <p>Content for testing mode stamping.</p>
    </section>
  `;

  it("stamps data-report-mode on <html> and handles print mode styles", () => {
    const { html } = buildReport({
      title: "Test Print Report",
      content: dummyFragment,
      mode: "print"
    });

    assert.match(html, /<html[^>]*data-report-mode="print"/);
    assert.match(html, /@media print/);
    assert.doesNotMatch(html, /datastar@1\.0\.0-beta/);
  });

  it("stamps data-report-mode on <html> for standard report mode", () => {
    const { html } = buildReport({
      title: "Test Report",
      content: dummyFragment,
      mode: "report"
    });

    assert.match(html, /<html[^>]*data-report-mode="report"/);
    assert.doesNotMatch(html, /datastar@1\.0\.0-beta/);
  });

  it("stamps data-report-mode for presentation mode and includes Impress.js", () => {
    const { html } = buildReport({
      title: "Test Presentation",
      content: dummyFragment,
      mode: "presentation"
    });

    assert.match(html, /<html[^>]*data-report-mode="presentation"/);
    assert.match(html, /impress\.js/);
    assert.doesNotMatch(html, /datastar@1\.0\.0-beta/);
  });

  it("stamps data-report-mode for dashboard mode without mandating Datastar", () => {
    const { html } = buildReport({
      title: "Test Dashboard",
      content: dummyFragment,
      mode: "dashboard"
    });

    assert.match(html, /<html[^>]*data-report-mode="dashboard"/);
    assert.doesNotMatch(html, /datastar@1\.0\.0-beta/);
  });

  it("stamps data-report-mode for working-report mode without mandating Datastar", () => {
    const { html } = buildReport({
      title: "Test Working Report",
      content: dummyFragment,
      mode: "working-report"
    });

    assert.match(html, /<html[^>]*data-report-mode="working-report"/);
    assert.doesNotMatch(html, /datastar@1\.0\.0-beta/);
  });

  it("stamps data-report-mode for live-report mode and automatically injects Datastar", () => {
    const { html } = buildReport({
      title: "Test Live Report",
      content: dummyFragment,
      mode: "live-report"
    });

    assert.match(html, /<html[^>]*data-report-mode="live-report"/);
    assert.match(html, /datastar@1\.0\.0-beta/);
  });

  it("throws a descriptive error when building with an invalid mode", () => {
    assert.throws(
      () => {
        buildReport({
          title: "Invalid Mode Test",
          content: dummyFragment,
          mode: "unsupported-mode"
        });
      },
      (err) => {
        return err instanceof Error && err.message.includes('Invalid report mode "unsupported-mode"');
      }
    );
  });
});

describe("Harness Server Orchestration Policies", () => {
  it("enforces exact requiresServer policy for each canonical mode", () => {
    assert.equal(MODE_SERVER_POLICIES.print.requiresServer, false);
    assert.equal(MODE_SERVER_POLICIES.report.requiresServer, false);
    assert.equal(MODE_SERVER_POLICIES.presentation.requiresServer, false);

    assert.equal(MODE_SERVER_POLICIES.dashboard.requiresServer, true);
    assert.equal(MODE_SERVER_POLICIES["working-report"].requiresServer, true);
    assert.equal(MODE_SERVER_POLICIES["live-report"].requiresServer, true);
  });

  it("parseArgs recognizes --mode, --dashboard, --working-report, --live-report, --print, --presentation", () => {
    const a1 = parseHarnessArgs(["run", "fragment.html", "--mode", "dashboard"]);
    assert.equal(a1.mode, "dashboard");

    const a2 = parseHarnessArgs(["run", "fragment.html", "--working-report"]);
    assert.equal(a2.mode, "working-report");

    const a3 = parseHarnessArgs(["run", "fragment.html", "-l"]);
    assert.equal(a3.mode, "live-report");

    const a4 = parseHarnessArgs(["run", "fragment.html", "-p"]);
    assert.equal(a4.mode, "print");
    assert.equal(a4.printable, true);

    const a5 = parseHarnessArgs(["run", "fragment.html", "--presentation"]);
    assert.equal(a5.mode, "presentation");
  });

  it("runLifecycle respects requiresServer=false for print and report modes", async () => {
    const tmpDir = path.resolve(__dirname, "../tmp-test-modes");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFrag = path.join(tmpDir, "frag.html");
    const tmpOut = path.join(tmpDir, "out-print.html");
    fs.writeFileSync(tmpFrag, `<section id="sec"><h2 class="text-lg">Section</h2><p>Text</p></section>`, "utf-8");

    let serverRunnerCalled = false;
    const mockServerRunner = async () => {
      serverRunnerCalled = true;
      return { running: true, port: 9999, url: "http://localhost:9999/" };
    };

    const mockVerifier = async () => ({
      passed: true,
      hasViolations: false,
      responsivePass: true,
      consoleErrors: [],
      insufficientSpaceErrors: []
    });

    const res = await runLifecycle({
      file: tmpFrag,
      output: tmpOut,
      mode: "print",
      verifier: mockVerifier,
      serverRunner: mockServerRunner
    });

    assert.equal(res.success, true);
    assert.equal(res.mode, "print");
    assert.equal(serverRunnerCalled, false);
    assert.equal(res.server, null);

    // Clean up
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  });

  it("runLifecycle invokes server runner for dashboard, working-report, and live-report modes", async () => {
    const tmpDir = path.resolve(__dirname, "../tmp-test-modes-server");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFrag = path.join(tmpDir, "frag.html");
    const tmpOut = path.join(tmpDir, "out-dash.html");
    fs.writeFileSync(tmpFrag, `<section id="sec"><h2 class="text-lg">Section</h2><p>Text</p></section>`, "utf-8");

    let serverRunnerModes = [];
    const mockServerRunner = async (opts) => {
      serverRunnerModes.push(opts.mode);
      return { running: true, port: 8888, url: `http://localhost:8888/` };
    };

    const mockVerifier = async () => ({
      passed: true,
      hasViolations: false,
      responsivePass: true,
      consoleErrors: [],
      insufficientSpaceErrors: []
    });

    for (const m of ["dashboard", "working-report", "live-report"]) {
      const res = await runLifecycle({
        file: tmpFrag,
        output: tmpOut,
        mode: m,
        verifier: mockVerifier,
        serverRunner: mockServerRunner
      });

      assert.equal(res.success, true);
      assert.equal(res.mode, m);
      assert.ok(res.server);
      assert.equal(res.server.port, 8888);
    }

    assert.deepEqual(serverRunnerModes, ["dashboard", "working-report", "live-report"]);

    // Clean up
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  });

  it("runLifecycle transitions to FAILED when given an invalid mode", async () => {
    const res = await runLifecycle({
      content: `<p>Sample</p>`,
      mode: "invalid-arbitrary-mode"
    });

    assert.equal(res.success, false);
    assert.equal(res.state, "FAILED");
    assert.equal(res.error.failureType, "INVALID_MODE");
    assert.match(res.error.instruction_for_agent, /Allowed modes/);
  });
});

describe("Dev Server data-report-mode Detection & Endpoints", () => {
  it("detectReportMode parses data-report-mode from HTML string", () => {
    assert.equal(detectReportMode('<html lang="en" data-report-mode="dashboard">'), "dashboard");
    assert.equal(detectReportMode('<html data-theme="light" data-report-mode="live-report" lang="en">'), "live-report");
    assert.equal(detectReportMode('<html lang="en">'), "report");
    assert.equal(detectReportMode(""), "report");
    assert.equal(detectReportMode(null), "report");
  });

  it("serves HTML with X-Report-Mode header and provides /__report_mode__ endpoint", async () => {
    const tmpDir = path.resolve(__dirname, "../tmp-test-serve");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const reportFile = path.join(tmpDir, "report.html");

    const sampleHtml = `<!DOCTYPE html>
<html lang="en" data-theme="light" data-report-mode="working-report">
<head><title>Working Report Test</title></head>
<body><h1>Working Journey</h1></body>
</html>`;
    fs.writeFileSync(reportFile, sampleHtml, "utf-8");

    const testPort = 3198;
    const devServer = await startServer(reportFile, testPort, false);

    try {
      // 1. Query root
      const rootRes = await fetchUrl(`http://localhost:${testPort}/`);
      assert.equal(rootRes.statusCode, 200);
      assert.equal(rootRes.headers["x-report-mode"], "working-report");
      assert.match(rootRes.body, /Working Journey/);

      // 2. Query /__report_mode__
      const modeRes = await fetchUrl(`http://localhost:${testPort}/__report_mode__`);
      assert.equal(modeRes.statusCode, 200);
      const modeData = JSON.parse(modeRes.body);
      assert.equal(modeData.mode, "working-report");
      assert.equal(modeData.file, "report.html");
    } finally {
      await devServer.close();
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
  });
});

describe("Runtime Mode Badge & Navbar Download Adaptivity", () => {
  it("exports initModeBadge function", () => {
    assert.equal(typeof runtime.initModeBadge, "function");
  });
});
