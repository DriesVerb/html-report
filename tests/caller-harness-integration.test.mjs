import test, { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const harnessScript = path.resolve(__dirname, "../skills/html-report/scripts/harness.mjs");

const { STATES, runLifecycle, runHarness } = await import(harnessScript);

describe("caller-aware-harness Integration Test Suite", () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "caller-harness-test-"));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("Zero Standalone Footprint", () => {
    it("should create zero .caller-requests files or directories and bypass caller states when standalone", async () => {
      const fragment = `<section id="test-sec"><h2 id="heading">Simple Title</h2><p>Body</p></section>`;
      const fragPath = path.join(tmpDir, "simple-fragment.html");
      fs.writeFileSync(fragPath, fragment, "utf-8");

      const stateHistory = [];
      const res = await runLifecycle({
        file: fragPath,
        verify: true,
        verifier: async () => ({ passed: true }),
        onStateChange: (state) => stateHistory.push(state)
      });

      assert.equal(res.success, true);
      assert.equal(res.state, STATES.COMPLETED);

      // Verify FSM states bypass RESOLVING_CALLER and RECORDING_RUN
      assert.deepEqual(stateHistory, [
        STATES.VALIDATING,
        STATES.ASSEMBLING,
        STATES.VERIFYING,
        STATES.COMPLETED
      ]);
      assert.ok(!stateHistory.includes(STATES.RESOLVING_CALLER));
      assert.ok(!stateHistory.includes(STATES.RECORDING_RUN));

      // Verify default output is ./report.html
      const expectedOut = path.resolve(tmpDir, "report.html");
      assert.equal(res.output, expectedOut);
      assert.ok(fs.existsSync(expectedOut));

      // Verify zero .caller-requests directory created anywhere
      const vaultPath = path.join(tmpDir, ".caller-requests");
      assert.equal(fs.existsSync(vaultPath), false, ".caller-requests must NOT be created in standalone mode");
    });

    it("should execute standalone run via CLI without touching or creating vault", () => {
      const fragment = `<section id="sec"><h2 id="title">CLI Test</h2></section>`;
      const fragPath = path.join(tmpDir, "cli-frag.html");
      fs.writeFileSync(fragPath, fragment, "utf-8");

      const stdout = execSync(`node "${harnessScript}" run "${fragPath}" --no-verify`, {
        cwd: tmpDir,
        encoding: "utf-8"
      });

      assert.ok(stdout.includes("Report successfully assembled"));
      assert.ok(fs.existsSync(path.join(tmpDir, "report.html")));
      assert.equal(fs.existsSync(path.join(tmpDir, ".caller-requests")), false);
    });
  });

  describe("Caller Auto-Scaffolding & Profile Injection", () => {
    it("should auto-scaffold profile for new caller and apply profile theme to assembled report", async () => {
      const fragment = `<section id="caller-sec"><h2 id="caller-h2">Auto-Scaffold Test</h2></section>`;
      const fragPath = path.join(tmpDir, "frag.html");
      fs.writeFileSync(fragPath, fragment, "utf-8");

      const stateHistory = [];
      const res = await runLifecycle({
        file: fragPath,
        caller: "profiler-bot",
        verify: true,
        verifier: async () => ({ passed: true }),
        onStateChange: (state) => stateHistory.push(state)
      });

      assert.equal(res.success, true);
      assert.deepEqual(stateHistory, [
        STATES.RESOLVING_CALLER,
        STATES.VALIDATING,
        STATES.ASSEMBLING,
        STATES.VERIFYING,
        STATES.RECORDING_RUN,
        STATES.COMPLETED
      ]);

      // Check auto-scaffolded profile exists
      const profilePath = path.join(tmpDir, ".caller-requests", "profiles", "profiler-bot.md");
      assert.ok(fs.existsSync(profilePath), "Profile should be auto-scaffolded");

      const profileContent = fs.readFileSync(profilePath, "utf-8");
      assert.ok(profileContent.includes('caller_id: "profiler-bot"'));
      assert.ok(profileContent.includes('default_theme: "light"'));

      // Check output was routed to report-profiler-bot.html
      const expectedOutput = path.join(tmpDir, "report-profiler-bot.html");
      assert.equal(res.output, expectedOutput);
      assert.ok(fs.existsSync(expectedOutput));

      // Modify profile to custom theme
      const customProfile = profileContent.replace('default_theme: "light"', 'default_theme: "synthwave"');
      fs.writeFileSync(profilePath, customProfile, "utf-8");

      // Run again with modified profile
      const res2 = await runLifecycle({
        file: fragPath,
        caller: "profiler-bot",
        verify: true,
        verifier: async () => ({ passed: true })
      });

      assert.equal(res2.success, true);
      const builtHtml = fs.readFileSync(expectedOutput, "utf-8");
      assert.ok(builtHtml.includes('data-theme="synthwave"'), "Report should reflect profile theme");
    });
  });

  describe("Runtime Override Precedence & Non-Destructive Guarantee", () => {
    it("should allow runtime --theme to override profile theme without mutating profile on disk", async () => {
      const fragment = `<section id="override-sec"><h2 id="override-h2">Precedence Test</h2></section>`;
      const fragPath = path.join(tmpDir, "override-frag.html");
      fs.writeFileSync(fragPath, fragment, "utf-8");

      // First create profile with default_theme: "synthwave"
      await runLifecycle({
        file: fragPath,
        caller: "override-agent",
        verify: true,
        verifier: async () => ({ passed: true })
      });

      const profilePath = path.join(tmpDir, ".caller-requests", "profiles", "override-agent.md");
      let profileContent = fs.readFileSync(profilePath, "utf-8");
      profileContent = profileContent.replace('default_theme: "light"', 'default_theme: "synthwave"');
      fs.writeFileSync(profilePath, profileContent, "utf-8");

      const initialChecksum = crypto.createHash("sha256").update(fs.readFileSync(profilePath)).digest("hex");

      // Run with runtime override --theme cupcake
      const res = await runLifecycle({
        file: fragPath,
        caller: "override-agent",
        theme: "cupcake",
        verify: true,
        verifier: async () => ({ passed: true })
      });

      assert.equal(res.success, true);
      const builtHtml = fs.readFileSync(res.output, "utf-8");
      assert.ok(builtHtml.includes('data-theme="cupcake"'), "Runtime override must take precedence");

      // Verify persistent profile was NOT altered on disk
      const finalChecksum = crypto.createHash("sha256").update(fs.readFileSync(profilePath)).digest("hex");
      assert.equal(initialChecksum, finalChecksum, "Caller profile on disk must remain pristine and non-destructively preserved");
    });
  });

  describe("Vault Ephemeral Traces & 10-Run Pruning", () => {
    it("should persist run.json and trace.json in vault and prune older runs to 10 max", async () => {
      const callerId = "trace-prune-agent";
      const fragment = `<section id="p-sec"><h2 id="p-h2">Prune Test</h2></section>`;
      const fragPath = path.join(tmpDir, "prune-frag.html");
      fs.writeFileSync(fragPath, fragment, "utf-8");

      // Execute 14 runs
      const runsDir = path.join(tmpDir, ".caller-requests", "runs", callerId);
      for (let i = 1; i <= 14; i++) {
        const runId = `run-${String(i).padStart(3, "0")}`;
        const res = await runLifecycle({
          file: fragPath,
          caller: callerId,
          runId,
          verify: true,
          verifier: async () => ({ passed: true })
        });
        assert.equal(res.success, true);

        // Adjust mtimes so sorting is deterministic across filesystems
        const currentRunDir = path.join(runsDir, runId);
        const fakeTime = 1700000000 + i * 10;
        fs.utimesSync(currentRunDir, fakeTime, fakeTime);
      }

      // Read remaining runs in caller directory
      const remainingRuns = fs.readdirSync(runsDir);
      assert.equal(remainingRuns.length, 10, "Should strictly retain 10 most recent runs");

      // Runs 1 through 4 should be pruned
      for (let i = 1; i <= 4; i++) {
        const prunedId = `run-${String(i).padStart(3, "0")}`;
        assert.equal(fs.existsSync(path.join(runsDir, prunedId)), false, `${prunedId} should be purged`);
      }

      // Run 14 should exist with valid run.json and trace.json
      const latestRunDir = path.join(runsDir, "run-014");
      assert.ok(fs.existsSync(latestRunDir));
      const runJson = JSON.parse(fs.readFileSync(path.join(latestRunDir, "run.json"), "utf-8"));
      const traceJson = JSON.parse(fs.readFileSync(path.join(latestRunDir, "trace.json"), "utf-8"));

      assert.equal(runJson.status, STATES.COMPLETED);
      assert.equal(runJson.callerId, callerId);
      assert.ok(runJson.durationMs >= 0);
      assert.ok(Array.isArray(runJson.stateHistory));
      assert.equal(traceJson.status, STATES.COMPLETED);
    });
  });

  describe("Multi-Attempt Correlation via --run-id", () => {
    it("should update the same run directory across retry attempts instead of creating disconnected runs", async () => {
      const callerId = "retry-agent";
      const runId = "correlated-run-123";

      // Attempt 1: Malformed fragment with autoFix disabled to trigger REMEDIATING
      const malformed = `<body><h2>Missing ID</h2></body>`;
      const fragPath = path.join(tmpDir, "retry-frag.html");
      fs.writeFileSync(fragPath, malformed, "utf-8");

      const attempt1 = await runLifecycle({
        file: fragPath,
        caller: callerId,
        runId,
        autoFix: false,
        attempt: 1,
        maxAttempts: 3
      });

      assert.equal(attempt1.success, false);
      assert.equal(attempt1.state, STATES.REMEDIATING);

      const runDir = path.join(tmpDir, ".caller-requests", "runs", callerId, runId);
      assert.ok(fs.existsSync(runDir), "Run directory should exist after attempt 1");

      const runJson1 = JSON.parse(fs.readFileSync(path.join(runDir, "run.json"), "utf-8"));
      assert.equal(runJson1.attempt, 1);
      assert.equal(runJson1.status, STATES.REMEDIATING);

      // Attempt 2: Fix fragment and re-run with attempt 2 and same run-id
      fs.writeFileSync(fragPath, `<section id="fixed"><h2 id="heading">Fixed</h2></section>`, "utf-8");
      const attempt2 = await runLifecycle({
        file: fragPath,
        caller: callerId,
        runId,
        attempt: 2,
        maxAttempts: 3,
        verify: true,
        verifier: async () => ({ passed: true })
      });

      assert.equal(attempt2.success, true);
      assert.equal(attempt2.state, STATES.COMPLETED);

      // Verify that no extra run directory was created
      const allRuns = fs.readdirSync(path.join(tmpDir, ".caller-requests", "runs", callerId));
      assert.deepEqual(allRuns, [runId], "Only a single correlated run directory should exist");

      const runJson2 = JSON.parse(fs.readFileSync(path.join(runDir, "run.json"), "utf-8"));
      assert.equal(runJson2.attempt, 2);
      assert.equal(runJson2.status, STATES.COMPLETED);
      assert.ok(runJson2.updatedAt);
    });
  });

  describe("Caller CWD Output Routing & Leaf Identification", () => {
    it("should default to report-<caller>.html in CWD and handle chained caller identifiers", async () => {
      const fragment = `<section id="routing"><h2 id="route-h2">Routing Test</h2></section>`;
      const fragPath = path.join(tmpDir, "route.html");
      fs.writeFileSync(fragPath, fragment, "utf-8");

      // Chained caller string
      const res = await runLifecycle({
        file: fragPath,
        caller: "teamwork/subagents/debug-optimize-lcp",
        verify: true,
        verifier: async () => ({ passed: true })
      });

      assert.equal(res.success, true);
      const expectedLeafOutput = path.join(tmpDir, "report-debug-optimize-lcp.html");
      assert.equal(res.output, expectedLeafOutput);
      assert.ok(fs.existsSync(expectedLeafOutput));

      // With on-demand PDF flag
      const resPdf = await runLifecycle({
        file: fragPath,
        caller: "memory-leak-debugging",
        pdf: true,
        verify: true,
        verifier: async () => ({ passed: true })
      });

      assert.equal(resPdf.success, true);
      assert.equal(resPdf.output, path.join(tmpDir, "report-memory-leak-debugging.html"));
      assert.equal(resPdf.pdf, path.join(tmpDir, "report-memory-leak-debugging.pdf"));

      // With explicit output override
      const customOut = path.join(tmpDir, "custom", "deliverable.html");
      const resCustom = await runLifecycle({
        file: fragPath,
        caller: "memory-leak-debugging",
        output: customOut,
        verify: true,
        verifier: async () => ({ passed: true })
      });

      assert.equal(resCustom.success, true);
      assert.equal(resCustom.output, customOut);
      assert.ok(fs.existsSync(customOut));
    });
  });
});
