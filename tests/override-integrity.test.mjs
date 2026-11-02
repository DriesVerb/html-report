import test, { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  mergeInstructions,
  resolveCaller,
  recordRun,
  getFileChecksum
} from "../skills/html-report/scripts/caller-registry.mjs";

describe("Precedence & Non-Destructive Override Engine", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "override-integrity-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("mergeInstructions", () => {
    it("should respect the 3-tier hierarchy: Runtime Overrides > Caller Profile > Core Baseline", () => {
      const core = {
        default_theme: "light",
        required_cdns: ["tailwind", "daisyui"],
        instructions: "Core standards: responsive navbar and 11 CDNs."
      };

      const profile = {
        default_theme: "dark",
        required_cdns: ["chartjs", "gridjs"],
        custom_instructions: "Profile rules: focus on memory leak graphs."
      };

      const overrides = {
        theme: "nord",
        required_cdns: ["leaflet"],
        custom_instructions: "Ephemeral override: include geographic trace map."
      };

      const merged = mergeInstructions(core, profile, overrides);

      // Theme precedence
      assert.equal(merged.theme, "nord", "Runtime theme override must take top precedence");

      // CDN union without duplicates
      assert.deepEqual(
        merged.required_cdns.sort(),
        ["chartjs", "daisyui", "gridjs", "leaflet", "tailwind"].sort(),
        "CDNs should be merged as a deduplicated union"
      );

      // Instructions concatenated in order Core -> Profile -> Overrides
      assert.ok(merged.instructions.includes("Core standards"));
      assert.ok(merged.instructions.includes("Profile rules"));
      assert.ok(merged.instructions.includes("Ephemeral override"));
      assert.ok(
        merged.instructions.indexOf("Core standards") <
        merged.instructions.indexOf("Profile rules") &&
        merged.instructions.indexOf("Profile rules") <
        merged.instructions.indexOf("Ephemeral override")
      );
    });

    it("should fallback to profile rules when runtime overrides are omitted", () => {
      const core = { default_theme: "light" };
      const profile = { default_theme: "dracula" };
      const merged = mergeInstructions(core, profile, {});
      assert.equal(merged.theme, "dracula");
    });
  });

  describe("Non-Destructive Mutation Guarantee", () => {
    it("should ensure persistent profile SHA256 checksum remains identical before and after runs with custom overrides", () => {
      const callerId = "perf-test";
      const resolved = resolveCaller(callerId, { vaultDir: tmpDir });
      const initialChecksum = getFileChecksum(resolved.profilePath);
      const initialStat = fs.statSync(resolved.profilePath);

      assert.ok(initialChecksum, "Initial checksum must be generated");

      // Execute multiple runs with heavy overrides and temporary payloads
      for (let i = 1; i <= 5; i++) {
        const payload = {
          iteration: i,
          temporaryFlags: { debug: true, sampleRate: 100 }
        };
        const overrides = {
          theme: "synthwave",
          required_cdns: ["marked"],
          custom_instructions: `Run ${i} specific instructions that must never be written to profile`
        };

        recordRun(callerId, payload, { vaultDir: tmpDir, overrides });
        const merged = mergeInstructions({}, resolved.frontmatter, overrides);
        assert.equal(merged.theme, "synthwave");
      }

      // Check profile file checksum and modification time
      const finalChecksum = getFileChecksum(resolved.profilePath);
      const finalStat = fs.statSync(resolved.profilePath);

      assert.equal(finalChecksum, initialChecksum, "Profile file SHA256 hash must be identical");
      assert.equal(finalStat.mtimeMs, initialStat.mtimeMs, "Profile file modification time must be untouched");
    });
  });
});
