import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const buildReportPath = path.resolve(process.cwd(), "skills/html-report/scripts/build-report.mjs");
const { buildReport, stripVerificationArtifacts } = await import(buildReportPath);
const { runHarness } = await import(path.resolve(process.cwd(), "packages/core/playwright/harness/runner.mjs"));
const { chromium } = await import(
  path.resolve(process.cwd(), "packages/core/playwright/node_modules/playwright/index.mjs")
);

describe("Verification Pipeline Flows & Ephemeral Verification Classes", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "verify-pipeline-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("4.1a strips verify-* classes, data-insufficient-space, data-verify-*, and verify styles on --published", () => {
    const dirtyFragment = `
      <style id="html-report-verify-styles">.verify-insufficient-space { outline: 2px solid red; }</style>
      <section id="sec-1">
        <h2 id="h-1">Metrics</h2>
        <div id="box" class="card verify-insufficient-space verify-highlight" data-insufficient-space="true" data-verify-rule="overflow">Content</div>
        <span id="only-verify" class="verify-badge">Badge</span>
      </section>
    `;

    const draft = buildReport({ title: "Draft Verification", content: dirtyFragment, published: false });
    assert.ok(draft.html.includes("verify-insufficient-space"));
    assert.ok(draft.html.includes('data-insufficient-space="true"'));
    assert.ok(draft.html.includes("html-report-verify-styles"));

    const pub = buildReport({ title: "Published Final", content: dirtyFragment, published: true });
    const pubMain = pub.html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
    assert.ok(!pubMain.includes("verify-insufficient-space"), "verify-insufficient-space must be stripped from <main>");
    assert.ok(!pubMain.includes("verify-highlight"), "verify-highlight must be stripped from <main>");
    assert.ok(!pubMain.includes("verify-badge"), "verify-badge must be stripped from <main>");
    assert.ok(!pubMain.includes("data-insufficient-space"), "data-insufficient-space must be stripped from <main>");
    assert.ok(!pubMain.includes("data-verify-rule"), "data-verify-* must be stripped from <main>");
    assert.ok(!/<style[^>]*id=["']html-report-verify-styles["']/i.test(pub.html), "#html-report-verify-styles <style> must be stripped");
    assert.ok(pubMain.includes('class="card"'), "Non-verification classes like 'card' must be preserved");

    const cleaned = stripVerificationArtifacts(`<div class="verify-only" data-verify-test="1">ok</div>`);
    assert.equal(cleaned, `<div>ok</div>`);
  });

  it("4.1b checkInsufficientHorizontalSpace applies verify-insufficient-space and HTMLReportPublisher.prepare strips it", async () => {
    const { html } = buildReport({
      title: "Space Detector Lifecycle",
      content: `
        <style id="html-report-verify-styles">.verify-insufficient-space { outline: 2px dashed red; }</style>
        <h1 id="sec-overflow">Overflow Test</h1>
        <div id="narrow-box" style="width: 120px; overflow-x: auto;">
          <div style="width: 400px;">Wide inner content forcing horizontal scrollbar</div>
        </div>
      `,
      mode: "report"
    });
    const filePath = path.join(tmpDir, "overflow.html");
    fs.writeFileSync(filePath, html, "utf-8");

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(pathToFileURL(filePath).href, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => typeof window.checkInsufficientHorizontalSpace === "function");

      const result = await page.evaluate(() => {
        const flagged = window.checkInsufficientHorizontalSpace();
        const box = document.getElementById("narrow-box");
        const hasClassDuringVerify = box.classList.contains("verify-insufficient-space");
        const hasAttrDuringVerify = box.getAttribute("data-insufficient-space") === "true";

        const clone = document.documentElement.cloneNode(true);
        HTMLReportPublisher.prepare(clone);
        const pubBox = clone.querySelector("#narrow-box");
        return {
          flaggedCount: flagged.length,
          hasClassDuringVerify,
          hasAttrDuringVerify,
          pubHasVerifyClass: pubBox.classList.contains("verify-insufficient-space"),
          pubHasAttr: pubBox.hasAttribute("data-insufficient-space"),
          pubHasVerifyStyle: Boolean(clone.querySelector("#html-report-verify-styles"))
        };
      });

      assert.ok(result.flaggedCount >= 1);
      assert.equal(result.hasClassDuringVerify, true);
      assert.equal(result.hasAttrDuringVerify, true);
      assert.equal(result.pubHasVerifyClass, false);
      assert.equal(result.pubHasAttr, false);
      assert.equal(result.pubHasVerifyStyle, false);
    } finally {
      await browser.close();
    }
  });

  it("4.2a emits structured remediations in JSON and reviewPacket with screenshots", async () => {
    const { html } = buildReport({
      title: "Remediation & Review Packet Test",
      content: `<h1 id="sec-a">Overview</h1><p>Body text</p>`,
      mode: "print"
    });

    // Bad layout with duplicate navbar
    const badHtml = html.replace(`<h1 id="sec-a">`, `<nav class="navbar">Dup</nav><h1 id="sec-a">`);
    const badFile = path.join(tmpDir, "bad.html");
    const jsonFile = path.join(tmpDir, "verify.json");
    const rpFile = path.join(tmpDir, "review-packet.json");
    const ssDir = path.join(tmpDir, "screenshots");
    fs.writeFileSync(badFile, badHtml, "utf-8");

    const res = await runHarness(badFile, {
      only: ["core:structure"],
      quick: true,
      json: jsonFile,
      reviewPacket: rpFile,
      screenshots: ssDir
    });

    assert.equal(res.success, false);
    assert.ok(res.remediations.some((r) => r.ruleId === "core:structure:duplicate-navbar" && r.fixTarget === "fragment"));
    assert.ok(fs.existsSync(jsonFile));
    assert.ok(fs.existsSync(rpFile));

    const rp = JSON.parse(fs.readFileSync(rpFile, "utf-8"));
    assert.equal(rp.title, "Remediation & Review Packet Test");
    assert.equal(rp.mode, "print");
    assert.ok(Array.isArray(rp.headings) && rp.headings.length >= 1);
    assert.ok(Array.isArray(rp.screenshots) && rp.screenshots.length >= 1);
    assert.ok(fs.existsSync(rp.screenshots[0].path));
  });

  it("4.2b build-report.mjs --verify runs deterministic verification after assembly", () => {
    const fragFile = path.join(tmpDir, "frag.html");
    const outFile = path.join(tmpDir, "verified.html");
    fs.writeFileSync(fragFile, `<h1 id="intro">Introduction</h1><p>Valid report content.</p>`, "utf-8");

    const stdout = execFileSync(
      process.execPath,
      [buildReportPath, "--title", "Verified Build", "--content", fragFile, "--output", outFile, "--verify", "--json"],
      { encoding: "utf-8" }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.verification.summary.compliant, true);
  });

  it("4.3 narrow 3-col Grid.js stretches 100% and wide 10-col Grid.js scrolls cleanly inside .gridjs-wrapper at 640x800 and 1280x900", async () => {
    const { html } = buildReport({
      title: "Grid.js Narrow & Wide Table Regression",
      content: `
        <section id="tables-section" class="space-y-6">
          <h1 id="sec-tables">Grid.js Responsive Tables</h1>
          <div class="card bg-base-100 border border-base-300 p-4">
            <div id="narrow-grid" data-gridjs='{"columns":["Service","Region","Status"],"data":[["auth-gateway","us-east-1","Healthy"],["edge-router","global","Healthy"]]}'></div>
          </div>
          <div class="card bg-base-100 border border-base-300 p-4">
            <div id="wide-grid" data-gridjs='{"columns":["Service","Region","Avail (%)","P50 (ms)","P95 (ms)","P99 (ms)","Err (%)","Incidents","MTTR (m)","Cost ($/mo)"],"data":[["auth-gateway","us-east-1","99.98",14,42,88,"0.04",1,12,18400],["search-indexer","us-west-2","99.84",45,168,390,"0.34",4,41,27900]]}'></div>
          </div>
        </section>
      `,
      mode: "report",
      addons: ["gridjs"]
    });

    const reportFile = path.join(tmpDir, "gridjs-responsive.html");
    fs.writeFileSync(reportFile, html, "utf-8");

    const harnessRes = await runHarness(reportFile, { quick: true });
    assert.equal(
      harnessRes.success,
      true,
      `Expected narrow + wide Grid.js report to pass harness, got failures: ${JSON.stringify(harnessRes.failures)}`
    );

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(pathToFileURL(reportFile).href, { waitUntil: "load" });
      await page.waitForFunction(
        () =>
          document.querySelectorAll("#narrow-grid .gridjs-tr").length >= 2 &&
          document.querySelectorAll("#wide-grid .gridjs-tr").length >= 2,
        { timeout: 10000 }
      );

      const desktop = await page.evaluate(() => {
        const narrowWrap = document.querySelector("#narrow-grid .gridjs-wrapper");
        const narrowTable = document.querySelector("#narrow-grid .gridjs-table");
        const wideWrap = document.querySelector("#wide-grid .gridjs-wrapper");
        return {
          pageOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
          narrowScrollOverflow: narrowWrap.scrollWidth - narrowWrap.clientWidth,
          narrowTableWidth: narrowTable.getBoundingClientRect().width,
          narrowWrapClientWidth: narrowWrap.clientWidth,
          wideScrollOverflow: wideWrap.scrollWidth - wideWrap.clientWidth
        };
      });

      assert.equal(desktop.pageOverflow, 0, "Desktop (1280px) must have 0px page overflow");
      assert.ok(desktop.narrowScrollOverflow <= 2, "3-col Grid.js must not scroll horizontally on desktop");
      assert.ok(
        desktop.narrowTableWidth >= desktop.narrowWrapClientWidth - 4,
        `3-col Grid.js must fill 100% wrapper width on desktop (${desktop.narrowTableWidth} vs ${desktop.narrowWrapClientWidth})`
      );

      await page.setViewportSize({ width: 640, height: 800 });
      await page.waitForTimeout(100);

      const mobile = await page.evaluate(() => {
        const insufficient = typeof window.checkInsufficientHorizontalSpace === "function"
          ? window.checkInsufficientHorizontalSpace()
          : [];
        const narrowWrap = document.querySelector("#narrow-grid .gridjs-wrapper");
        const narrowTable = document.querySelector("#narrow-grid .gridjs-table");
        const wideWrap = document.querySelector("#wide-grid .gridjs-wrapper");
        const wideHeaders = Array.from(document.querySelectorAll("#wide-grid th.gridjs-th")).map((th) => ({
          text: th.textContent.trim(),
          height: th.getBoundingClientRect().height,
          whiteSpace: window.getComputedStyle(th).whiteSpace,
          scrollWidth: th.scrollWidth,
          clientWidth: th.clientWidth
        }));
        return {
          pageOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
          insufficientCount: insufficient.length,
          wideHasInsufficientAttr: wideWrap.hasAttribute("data-insufficient-space"),
          narrowScrollOverflow: narrowWrap.scrollWidth - narrowWrap.clientWidth,
          narrowTableWidth: narrowTable.getBoundingClientRect().width,
          narrowWrapClientWidth: narrowWrap.clientWidth,
          wideScrollOverflow: wideWrap.scrollWidth - wideWrap.clientWidth,
          wideHeaders
        };
      });

      assert.equal(mobile.pageOverflow, 0, "Mobile (640px) must have 0px page overflow");
      assert.equal(mobile.insufficientCount, 0, "Mobile (640px) must not flag .gridjs-wrapper as insufficient space");
      assert.equal(mobile.wideHasInsufficientAttr, false);
      assert.ok(mobile.narrowScrollOverflow <= 2, "3-col Grid.js must fit without horizontal scroll on 640px");
      assert.ok(
        mobile.narrowTableWidth >= mobile.narrowWrapClientWidth - 4,
        `3-col Grid.js must fill 100% wrapper width on 640px (${mobile.narrowTableWidth} vs ${mobile.narrowWrapClientWidth})`
      );
      assert.ok(mobile.wideScrollOverflow > 20, "10-col Grid.js must scroll horizontally inside .gridjs-wrapper on 640px");
      assert.equal(mobile.wideHeaders.length, 10);
      for (const h of mobile.wideHeaders) {
        assert.equal(h.whiteSpace, "nowrap", `Header "${h.text}" must have white-space: nowrap`);
        assert.ok(h.height <= 42, `Header "${h.text}" wrapped vertically (height=${h.height}px)`);
        assert.ok(h.scrollWidth <= h.clientWidth + 2, `Header "${h.text}" clipped horizontally`);
      }
    } finally {
      await browser.close();
    }
  });
});
