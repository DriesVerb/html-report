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
  runLifecycle,
  parseVerificationError,
  formatPrescriptiveDiagnostic,
  parseArgs
} = await import(cliPath);

describe("Phase 2 & 3: FSM Lifecycle Engine & Remediation Supervisor Unit Tests", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-lifecycle-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("parseVerificationError", () => {
    it("should parse horizontal element overflow and extract selector and dimensions", () => {
      const mockStdout = `
[2/7] Checking 5 Responsive Viewports & Layout Density...
  ✗ sm (640x800): FAIL
    Breakpoint sm (640px) elements without enough space: <div#performance-matrix> (780px > 526px: Element scrollWidth exceeds clientWidth)
✗ VERIFICATION FAILED:
  - Breakpoint sm (640px) elements without enough space: <div#performance-matrix> (780px > 526px: Element scrollWidth exceeds clientWidth)
`;
      const parsed = parseVerificationError(mockStdout, "");

      assert.equal(parsed.failureType, "HORIZONTAL_OVERFLOW");
      assert.equal(parsed.culprit.selector, "#performance-matrix");
      assert.equal(parsed.culprit.tag, "div");
      assert.equal(parsed.culprit.id, "performance-matrix");
      assert.equal(parsed.culprit.viewport, "640px (sm)");
      assert.equal(parsed.culprit.scrollWidth, 780);
      assert.equal(parsed.culprit.clientWidth, 526);
      assert.ok(parsed.instruction_for_agent.includes("#performance-matrix"));
      assert.ok(parsed.instruction_for_agent.includes("overflow-x-auto"));
    });

    it("should parse page body horizontal overflow", () => {
      const mockStdout = `
Breakpoint sm (640px) has page horizontal overflow: scrollWidth=750px > innerWidth=640px
`;
      const parsed = parseVerificationError(mockStdout, "");
      assert.equal(parsed.failureType, "PAGE_HORIZONTAL_OVERFLOW");
      assert.equal(parsed.culprit.viewport, "640px (sm)");
      assert.equal(parsed.culprit.scrollWidth, 750);
      assert.equal(parsed.culprit.innerWidth, 640);
      assert.ok(parsed.instruction_for_agent.includes("max-w-full"));
    });

    it("should parse browser runtime console errors", () => {
      const mockStderr = "Browser console errors (1): Uncaught ReferenceError: foo is not defined";
      const parsed = parseVerificationError("", mockStderr);
      assert.equal(parsed.failureType, "BROWSER_CONSOLE_ERROR");
      assert.ok(parsed.culprit.error.includes("ReferenceError: foo is not defined"));
      assert.ok(parsed.instruction_for_agent.includes("runtime exception"));
    });

    it("should fallback cleanly on general assertion failures", () => {
      const mockStdout = `
✗ VERIFICATION FAILED:
  - Report title must be inside .navbar-start on the left.
`;
      const parsed = parseVerificationError(mockStdout, "");
      assert.equal(parsed.failureType, "VERIFICATION_ASSERTION_FAILED");
      assert.ok(parsed.culprit.failures[0].includes("Report title must be inside .navbar-start"));
    });
  });

  describe("FSM State Transitions via runLifecycle", () => {
    it("should follow linear progression IDLE -> VALIDATING -> ASSEMBLING -> VERIFYING -> COMPLETED", async () => {
      const validContent = `<section id="sec-1"><h2 id="overview">Overview</h2><p>Content</p></section>`;
      const outPath = path.join(tmpDir, "out.html");
      const stateHistory = [];

      const res = await runLifecycle({
        content: validContent,
        output: outPath,
        verify: true,
        verifier: async () => ({ passed: true, stdout: "All passed" }),
        onStateChange: (state) => stateHistory.push(state)
      });

      assert.equal(res.success, true);
      assert.equal(res.state, STATES.COMPLETED);
      assert.deepEqual(stateHistory, [
        STATES.VALIDATING,
        STATES.ASSEMBLING,
        STATES.VERIFYING,
        STATES.COMPLETED
      ]);
      assert.ok(fs.existsSync(outPath));
    });

    it("should follow auto-fix path: IDLE -> VALIDATING -> AUTO_FIXING -> VALIDATING -> ASSEMBLING -> VERIFYING -> COMPLETED", async () => {
      const malformed = `<body><h2>Missing ID</h2></body>`;
      const outPath = path.join(tmpDir, "fixed-out.html");
      const stateHistory = [];

      const res = await runLifecycle({
        content: malformed,
        output: outPath,
        autoFix: true,
        verify: true,
        verifier: async () => ({ passed: true }),
        onStateChange: (state) => stateHistory.push(state)
      });

      assert.equal(res.success, true);
      assert.equal(res.state, STATES.COMPLETED);
      assert.deepEqual(stateHistory, [
        STATES.VALIDATING,
        STATES.AUTO_FIXING,
        STATES.VALIDATING,
        STATES.ASSEMBLING,
        STATES.VERIFYING,
        STATES.COMPLETED
      ]);
    });

    it("should halt in VALIDATING and transition to REMEDIATING when autoFix is disabled", async () => {
      const malformed = `<body><h2>Missing ID</h2></body>`;
      const outPath = path.join(tmpDir, "fail.html");
      const stateHistory = [];

      const res = await runLifecycle({
        content: malformed,
        output: outPath,
        autoFix: false,
        attempt: 1,
        maxAttempts: 3,
        onStateChange: (state) => stateHistory.push(state)
      });

      assert.equal(res.success, false);
      assert.equal(res.state, STATES.REMEDIATING);
      assert.deepEqual(stateHistory, [
        STATES.VALIDATING,
        STATES.REMEDIATING
      ]);
      // Verify assembly and verification were NOT invoked
      assert.equal(fs.existsSync(outPath), false);
    });

    it("should route verification failures to REMEDIATING when attempt < maxAttempts", async () => {
      const valid = `<h2 id="metrics">Metrics</h2>`;
      const outPath = path.join(tmpDir, "verif-fail.html");
      const stateHistory = [];

      const res = await runLifecycle({
        content: valid,
        output: outPath,
        attempt: 1,
        maxAttempts: 3,
        verifier: async () => ({
          passed: false,
          stdout: "Breakpoint sm (640px) elements without enough space: <div#chart-box> (800px > 500px: overflow)"
        }),
        onStateChange: (state) => stateHistory.push(state)
      });

      assert.equal(res.success, false);
      assert.equal(res.state, STATES.REMEDIATING);
      assert.equal(res.error.failureType, "HORIZONTAL_OVERFLOW");
      assert.equal(res.error.culprit.selector, "#chart-box");
      assert.deepEqual(stateHistory, [
        STATES.VALIDATING,
        STATES.ASSEMBLING,
        STATES.VERIFYING,
        STATES.REMEDIATING
      ]);
    });
  });

  describe("Bounded Retry Supervisor", () => {
    it("should transition to FAILED when attempt reaches or exceeds maxAttempts", async () => {
      const valid = `<h2 id="metrics">Metrics</h2>`;
      const outPath = path.join(tmpDir, "retry-failed.html");
      const stateHistory = [];

      const res = await runLifecycle({
        content: valid,
        output: outPath,
        attempt: 3,
        maxAttempts: 3,
        verifier: async () => ({
          passed: false,
          stdout: "Breakpoint sm (640px) elements without enough space: <table#t1> (900px > 500px: overflow)"
        }),
        onStateChange: (state) => stateHistory.push(state)
      });

      assert.equal(res.success, false);
      assert.equal(res.state, STATES.FAILED);
      assert.equal(res.error.status, "FAILED");
      assert.equal(res.error.attempt, 3);
      assert.equal(res.error.maxAttempts, 3);
      assert.deepEqual(stateHistory, [
        STATES.VALIDATING,
        STATES.ASSEMBLING,
        STATES.VERIFYING,
        STATES.FAILED
      ]);
    });

    it("should transition pre-flight validation failure to FAILED on max retry attempt", async () => {
      const malformed = `<body><h2>No ID</h2></body>`;
      const stateHistory = [];

      const res = await runLifecycle({
        content: malformed,
        autoFix: false,
        attempt: 3,
        maxAttempts: 3,
        onStateChange: (state) => stateHistory.push(state)
      });

      assert.equal(res.success, false);
      assert.equal(res.state, STATES.FAILED);
      assert.equal(res.error.status, "FAILED");
      assert.deepEqual(stateHistory, [
        STATES.VALIDATING,
        STATES.FAILED
      ]);
    });
  });

  describe("CLI Execution chaining via subprocess", () => {
    it("should execute full lifecycle with --no-verify and exit 0", () => {
      const fragPath = path.join(tmpDir, "frag.html");
      const outPath = path.join(tmpDir, "report.html");
      fs.writeFileSync(fragPath, `<h2 id="sec-1">Hello</h2><p>Testing</p>`, "utf-8");

      const stdout = execSync(
        `node ${cliPath} run ${fragPath} --output ${outPath} --no-verify`,
        { encoding: "utf-8" }
      );

      assert.ok(stdout.includes("Report successfully assembled and verified"));
      assert.ok(fs.existsSync(outPath));
      const htmlContent = fs.readFileSync(outPath, "utf-8");
      assert.ok(htmlContent.includes('<h2 id="sec-1">Hello</h2>'));
    });

    it("should fail and exit 1 when validation fails without auto-fix", () => {
      const fragPath = path.join(tmpDir, "bad.html");
      fs.writeFileSync(fragPath, `<body><h2>Bad Heading</h2></body>`, "utf-8");

      assert.throws(() => {
        execSync(`node ${cliPath} run ${fragPath} --no-auto-fix`, { stdio: "pipe" });
      });
    });

    it("should output JSON diagnostic when --json flag is provided on failure", () => {
      const fragPath = path.join(tmpDir, "json-fail.html");
      fs.writeFileSync(fragPath, `<body><h2>Bad Heading</h2></body>`, "utf-8");

      try {
        execSync(`node ${cliPath} run ${fragPath} --no-auto-fix --json`, {
          encoding: "utf-8",
          stdio: "pipe"
        });
        assert.fail("Command should have thrown");
      } catch (err) {
        assert.equal(err.status, 1);
        const parsed = JSON.parse(err.stdout);
        assert.equal(parsed.status, "REMEDIATION_REQUIRED");
        assert.equal(parsed.failureType, "PREFLIGHT_LINT_ERROR");
        assert.ok(parsed.instruction_for_agent);
      }
    });
  });
});
