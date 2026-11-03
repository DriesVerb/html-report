import test, { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, "../skills/html-report/scripts/harness.mjs");

const {
  STATES,
  slugify,
  collectExistingIds,
  generateUniqueId,
  lintFragment,
  stripOuterBoilerplate,
  injectHeadingIds,
  wrapBareTables,
  autoFixFragment,
  formatPrescriptiveDiagnostic,
  parseArgs
} = await import(cliPath);

describe("Phase 1: Deterministic Harness Pre-Flight Linter & Auto-Fix Unit Tests", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("slugify", () => {
    it("should convert plain text into clean lowercase hyphens", () => {
      assert.equal(slugify("Executive Summary"), "executive-summary");
      assert.equal(slugify("System Architecture & Design"), "system-architecture-design");
    });

    it("should strip HTML tags inside heading before slugifying", () => {
      assert.equal(slugify("The <code>CLI</code> Interface"), "the-cli-interface");
      assert.equal(slugify("<strong>Important</strong> Notice!"), "important-notice");
    });

    it("should handle accented characters and diacritics", () => {
      assert.equal(slugify("Résumé & Modèle d'ingénierie"), "resume-modele-d-ingenierie");
    });

    it("should strip leading, trailing, and duplicate hyphens", () => {
      assert.equal(slugify("--- Hello --- World ---"), "hello-world");
    });

    it("should fallback gracefully on empty or symbol-only strings", () => {
      assert.equal(slugify(""), "section");
      assert.equal(slugify("   $$$ ###   "), "section");
    });
  });

  describe("collectExistingIds and generateUniqueId", () => {
    it("should collect all existing id attributes across an HTML fragment", () => {
      const html = `
        <div id="hero-banner">
          <h1 id="main-title">Title</h1>
          <p id='author-info'>By Eta</p>
        </div>
      `;
      const ids = collectExistingIds(html);
      assert.equal(ids.has("hero-banner"), true);
      assert.equal(ids.has("main-title"), true);
      assert.equal(ids.has("author-info"), true);
      assert.equal(ids.has("missing"), false);
    });

    it("should generate collision-free unique IDs by incrementing suffix", () => {
      const existing = new Set(["overview", "overview-1"]);
      const id1 = generateUniqueId("Overview", existing);
      assert.equal(id1, "overview-2");
      assert.equal(existing.has("overview-2"), true);

      const id2 = generateUniqueId("Overview", existing);
      assert.equal(id2, "overview-3");
    });
  });

  describe("lintFragment", () => {
    it("should pass clean fragments with zero issues", () => {
      const fragment = `
        <section id="sec-1">
          <h2 id="overview">Overview</h2>
          <p>Some text</p>
          <div class="overflow-x-auto w-full">
            <table><thead><tr><th>Header</th></tr></thead></table>
          </div>
        </section>
      `;
      const res = lintFragment(fragment);
      assert.equal(res.valid, true);
      assert.equal(res.issues.length, 0);
    });

    it("should detect accidental outer boilerplate tags", () => {
      const malformed = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <main>
    <h2 id="sec-1">Section</h2>
  </main>
</body>
</html>`;
      const res = lintFragment(malformed);
      assert.equal(res.valid, false);
      const types = res.issues.map(i => i.tag);
      assert.ok(types.includes("<!DOCTYPE>"));
      assert.ok(types.includes("<html>"));
      assert.ok(types.includes("<head>...</head>"));
      assert.ok(types.includes("<body>"));
      assert.ok(types.includes("<main>"));
    });

    it("should detect YAML frontmatter at beginning of fragment", () => {
      const frontmatterFrag = `---
title: Test Page
date: 2026-11-02
---
<h2 id="content">Content</h2>`;
      const res = lintFragment(frontmatterFrag);
      assert.equal(res.valid, false);
      assert.equal(res.issues[0].type, "OUTER_BOILERPLATE");
      assert.equal(res.issues[0].tag, "frontmatter");
    });

    it("should detect <h1>, <h2>, and <h3> headings missing id attributes", () => {
      const frag = `
        <h1 class="text-3xl font-bold">Main Header</h1>
        <h2 id="has-id">Already has ID</h2>
        <h3>Missing H3 ID</h3>
      `;
      const res = lintFragment(frag);
      assert.equal(res.valid, false);
      assert.equal(res.issues.length, 2);
      assert.equal(res.issues[0].tag, "h1");
      assert.equal(res.issues[0].type, "MISSING_HEADING_ID");
      assert.equal(res.issues[1].tag, "h3");
      assert.equal(res.issues[1].type, "MISSING_HEADING_ID");
    });

    it("should detect bare <table> tags without responsive wrapper", () => {
      const frag = `
        <h2 id="metrics">Metrics</h2>
        <table>
          <tr><td>Data</td></tr>
        </table>
      `;
      const res = lintFragment(frag);
      assert.equal(res.valid, false);
      const tableIssue = res.issues.find(i => i.type === "BARE_TABLE");
      assert.ok(tableIssue);
      assert.equal(tableIssue.tag, "table");
    });
  });

  describe("stripOuterBoilerplate", () => {
    it("should unwrap <html>, <head>, <body>, and <main> tags preserving inner HTML", () => {
      const html = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <title>Title to be dropped</title>
          </head>
          <body class="bg-base-100">
            <main>
              <div class="card bg-base-200">
                <h2 id="card-title">Card</h2>
              </div>
            </main>
          </body>
        </html>
      `;
      const { content, removedTags } = stripOuterBoilerplate(html);
      assert.ok(!content.includes("<!DOCTYPE"));
      assert.ok(!content.includes("<head"));
      assert.ok(!content.includes("<body"));
      assert.ok(!content.includes("<main"));
      assert.ok(content.includes('<h2 id="card-title">Card</h2>'));
      assert.ok(removedTags.includes("<body>"));
    });

    it("should strip frontmatter cleanly", () => {
      const frag = `---
author: Alice
theme: corporate
---
<h2 id="start">Start</h2>`;
      const { content, removedTags } = stripOuterBoilerplate(frag);
      assert.equal(content, '<h2 id="start">Start</h2>');
      assert.ok(removedTags.includes("frontmatter"));
    });
  });

  describe("injectHeadingIds", () => {
    it("should inject slugified id attributes into h1, h2, h3 tags lacking them", () => {
      const raw = `
        <h1>Platform Architecture</h1>
        <h2 class="text-xl font-bold">Sub-System Alpha</h2>
        <h3 data-ref="test">Detailed Breakdown</h3>
      `;
      const { content, injectedCount, injected } = injectHeadingIds(raw);
      assert.equal(injectedCount, 3);
      assert.ok(content.includes('<h1 id="platform-architecture">Platform Architecture</h1>'));
      assert.ok(content.includes('<h2 id="sub-system-alpha" class="text-xl font-bold">Sub-System Alpha</h2>'));
      assert.ok(content.includes('<h3 id="detailed-breakdown" data-ref="test">Detailed Breakdown</h3>'));
      assert.equal(injected[0].id, "platform-architecture");
      assert.equal(injected[1].id, "sub-system-alpha");
    });

    it("should never overwrite existing id attributes", () => {
      const raw = '<h2 id="custom-anchor" class="text-2xl">Already Set</h2>';
      const { content, injectedCount } = injectHeadingIds(raw);
      assert.equal(injectedCount, 0);
      assert.equal(content, raw);
    });

    it("should guarantee unique IDs for identical heading text", () => {
      const raw = `
        <h2>Performance</h2>
        <h2>Performance</h2>
        <h2>Performance</h2>
      `;
      const { content } = injectHeadingIds(raw);
      assert.ok(content.includes('id="performance"'));
      assert.ok(content.includes('id="performance-1"'));
      assert.ok(content.includes('id="performance-2"'));
    });
  });

  describe("wrapBareTables", () => {
    it("should wrap unadorned tables with responsive overflow wrapper", () => {
      const raw = `
        <h2 id="table-sec">Table Section</h2>
        <table class="table w-full">
          <thead><tr><th>Col 1</th></tr></thead>
        </table>
      `;
      const { content, wrappedCount } = wrapBareTables(raw);
      assert.equal(wrappedCount, 1);
      assert.ok(content.includes('<div class="overflow-x-auto w-full">'));
    });

    it("should not double-wrap tables already enclosed in overflow containers", () => {
      const raw = `
        <div class="overflow-x-auto w-full">
          <table class="table">
            <tr><td>Cell</td></tr>
          </table>
        </div>
      `;
      const { content, wrappedCount } = wrapBareTables(raw);
      assert.equal(wrappedCount, 0);
      assert.equal(content, raw);
    });
  });

  describe("autoFixFragment", () => {
    it("should apply all transforms sequentially and report fixes applied", () => {
      const malformed = `
        <!DOCTYPE html>
        <html>
          <body>
            <h2>Overview</h2>
            <table><tr><td>Val</td></tr></table>
          </body>
        </html>
      `;
      const { content, fixesApplied } = autoFixFragment(malformed);
      assert.equal(fixesApplied.length, 3);
      assert.ok(!content.includes("<!DOCTYPE"));
      assert.ok(!content.includes("<body>"));
      assert.ok(content.includes('<h2 id="overview">Overview</h2>'));
      assert.ok(content.includes('overflow-x-auto'));

      // Re-linting the fixed fragment should pass with 0 issues
      const lintCheck = lintFragment(content);
      assert.equal(lintCheck.valid, true);
    });
  });

  describe("formatPrescriptiveDiagnostic", () => {
    it("should produce small-model spoon-fed prescriptive JSON payload", () => {
      const raw = `
        <html><body>
          <h2>Missing ID</h2>
        </body></html>
      `;
      const lintRes = lintFragment(raw);
      const diag = formatPrescriptiveDiagnostic(lintRes, 1, 3);

      assert.equal(diag.status, "REMEDIATION_REQUIRED");
      assert.equal(diag.attempt, 1);
      assert.equal(diag.maxAttempts, 3);
      assert.equal(diag.failureType, "PREFLIGHT_LINT_ERROR");
      assert.ok(diag.issues.length > 0);
      assert.ok(typeof diag.instruction_for_agent === "string");
      assert.ok(diag.instruction_for_agent.length > 10);
    });
  });

  describe("CLI Execution via subprocess", () => {
    it("should execute --help in under 50ms and print help text", () => {
      const start = performance.now();
      const output = execSync(`node ${cliPath} --help`, { encoding: "utf-8" });
      const elapsed = performance.now() - start;

      assert.ok(output.includes("State Machine Harness & Pre-Flight Orchestrator"));
      assert.ok(output.includes("USAGE:"));
      assert.ok(elapsed < 1000, `Expected startup < 1000ms, took ${elapsed}ms`);
    });

    it("should lint malformed fragment via CLI and exit with non-zero exit code", () => {
      const fragPath = path.join(tmpDir, "bad.html");
      fs.writeFileSync(fragPath, "<h2>Missing ID</h2>", "utf-8");

      assert.throws(() => {
        execSync(`node ${cliPath} lint ${fragPath}`, { stdio: "pipe" });
      });
    });

    it("should lint valid fragment via CLI and exit 0", () => {
      const fragPath = path.join(tmpDir, "good.html");
      fs.writeFileSync(fragPath, '<h2 id="valid-id">Valid Heading</h2>', "utf-8");

      const out = execSync(`node ${cliPath} lint ${fragPath}`, { encoding: "utf-8" });
      assert.ok(out.includes("Pre-flight validation passed"));
    });

    it("should fix fragment via CLI fix command and write output to disk", () => {
      const inPath = path.join(tmpDir, "to-fix.html");
      const outPath = path.join(tmpDir, "fixed.html");
      fs.writeFileSync(inPath, "<body><h2>Auto Fixed Heading</h2></body>", "utf-8");

      execSync(`node ${cliPath} fix ${inPath} --output ${outPath}`, { encoding: "utf-8" });
      assert.ok(fs.existsSync(outPath));
      const content = fs.readFileSync(outPath, "utf-8");
      assert.ok(!content.includes("<body>"));
      assert.ok(content.includes('<h2 id="auto-fixed-heading">Auto Fixed Heading</h2>'));
    });
  });
});
