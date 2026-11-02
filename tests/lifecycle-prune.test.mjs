import test, { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  recordRun,
  pruneRuns,
  MAX_RUN_RETENTION
} from "../skills/html-report/scripts/caller-registry.mjs";

describe("Ephemeral Run Lifecycle & 10-Run Pruning", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lifecycle-prune-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should record a run payload in the caller run directory", () => {
    const callerId = "profiler-agent";
    const payload = { metrics: { lcp: 1200, cls: 0.05 } };
    const overrides = { theme: "nord" };

    const result = recordRun(callerId, payload, { vaultDir: tmpDir, overrides });

    assert.equal(result.leafId, "profiler-agent");
    assert.ok(fs.existsSync(result.runDir));
    assert.ok(fs.existsSync(result.payloadPath));

    const storedPayload = JSON.parse(fs.readFileSync(result.payloadPath, "utf-8"));
    assert.deepEqual(storedPayload, payload);

    const storedOverrides = JSON.parse(fs.readFileSync(path.join(result.runDir, "overrides.json"), "utf-8"));
    assert.deepEqual(storedOverrides, overrides);
  });

  it("should simulate 15 consecutive runs and prune to retain exactly 10 most recent runs", async () => {
    const callerId = "benchmark-tool";
    const runsDir = path.join(tmpDir, "runs", callerId);

    // Run 15 sequential runs with slight timestamp delays to establish distinct mtimes
    const createdRunIds = [];
    for (let i = 1; i <= 15; i++) {
      const runId = `run-${String(i).padStart(3, "0")}`;
      createdRunIds.push(runId);
      recordRun(callerId, { runIndex: i }, { vaultDir: tmpDir, runId });
      // ensure distinct filesystem timestamp ordering if needed
      const dirPath = path.join(runsDir, runId);
      const fakeTime = 1700000000 + i * 10;
      fs.utimesSync(dirPath, fakeTime, fakeTime);
      // re-trigger prune to guarantee timestamp sort
      pruneRuns(runsDir, 10);
    }

    const remainingRuns = fs.readdirSync(runsDir);
    assert.equal(remainingRuns.length, 10, "Should retain exactly 10 runs");

    // The first 5 runs (run-001 through run-005) must be pruned
    for (let i = 1; i <= 5; i++) {
      const oldRunId = `run-${String(i).padStart(3, "0")}`;
      assert.equal(fs.existsSync(path.join(runsDir, oldRunId)), false, `${oldRunId} should be purged`);
    }

    // The last 10 runs (run-006 through run-015) must exist
    for (let i = 6; i <= 15; i++) {
      const recentRunId = `run-${String(i).padStart(3, "0")}`;
      assert.equal(fs.existsSync(path.join(runsDir, recentRunId)), true, `${recentRunId} should be retained`);
    }
  });

  it("should isolate run pruning between distinct callers", () => {
    const callerA = "agent-alpha";
    const callerB = "agent-beta";

    for (let i = 1; i <= 12; i++) {
      recordRun(callerA, { i }, { vaultDir: tmpDir, runId: `run-a-${i}` });
    }

    for (let j = 1; j <= 5; j++) {
      recordRun(callerB, { j }, { vaultDir: tmpDir, runId: `run-b-${j}` });
    }

    const runsA = fs.readdirSync(path.join(tmpDir, "runs", callerA));
    const runsB = fs.readdirSync(path.join(tmpDir, "runs", callerB));

    assert.equal(runsA.length, 10);
    assert.equal(runsB.length, 5);
  });
});
