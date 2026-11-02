import test, { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  parseFrontmatter,
  checkCompatibility,
  resolveCaller,
  extractLeafCaller,
  REPORTER_VERSION,
  SUPPORTED_SCHEMA_VERSION
} from "../skills/html-report/scripts/caller-registry.mjs";

describe("caller-registry unit tests", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "caller-registry-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("parseFrontmatter", () => {
    it("should parse standard YAML frontmatter correctly", () => {
      const raw = `---
schema_version: 1
reporter_compatibility: ">=1.0.0"
caller_id: "memory-leak-debugging"
default_theme: "dark"
required_cdns:
  - "tailwind"
  - "chartjs"
custom_instructions: |
  Line one
  Line two
---
# Memory Leak Report Body
Content here`;

      const { frontmatter, body } = parseFrontmatter(raw);
      assert.equal(frontmatter.schema_version, 1);
      assert.equal(frontmatter.reporter_compatibility, ">=1.0.0");
      assert.equal(frontmatter.caller_id, "memory-leak-debugging");
      assert.equal(frontmatter.default_theme, "dark");
      assert.deepEqual(frontmatter.required_cdns, ["tailwind", "chartjs"]);
      assert.equal(frontmatter.custom_instructions, "Line one\nLine two");
      assert.ok(body.includes("# Memory Leak Report Body"));
    });

    it("should handle empty or malformed frontmatter gracefully", () => {
      const { frontmatter, body } = parseFrontmatter("Just markdown without frontmatter");
      assert.deepEqual(frontmatter, {});
      assert.equal(body, "Just markdown without frontmatter");
    });
  });

  describe("checkCompatibility", () => {
    it("should validate >= expressions accurately", () => {
      assert.equal(checkCompatibility(">=1.0.0", "1.0.0"), true);
      assert.equal(checkCompatibility(">=1.0.0", "1.2.0"), true);
      assert.equal(checkCompatibility(">=1.0.0", "2.0.0"), true);
      assert.equal(checkCompatibility(">=2.0.0", "1.0.0"), false);
      assert.equal(checkCompatibility(">=1.5.0", "1.2.0"), false);
    });

    it("should handle missing or empty compatibility string", () => {
      assert.equal(checkCompatibility(null, "1.0.0"), true);
      assert.equal(checkCompatibility("", "1.0.0"), true);
    });
  });

  describe("extractLeafCaller", () => {
    it("should extract direct leaf identifier from nested chains", () => {
      assert.equal(extractLeafCaller("memory-leak-debugging"), "memory-leak-debugging");
      assert.equal(extractLeafCaller("teamwork/memory-leak-debugging"), "memory-leak-debugging");
      assert.equal(extractLeafCaller("orchestrator/subagent/debug-optimize-lcp"), "debug-optimize-lcp");
      assert.equal(extractLeafCaller(""), "default");
      assert.equal(extractLeafCaller(null), "default");
    });
  });

  describe("resolveCaller and auto-scaffolding", () => {
    it("should auto-scaffold a new baseline profile for unknown caller", () => {
      const callerId = "test-agent-alpha";
      const result = resolveCaller(callerId, { vaultDir: tmpDir });

      assert.equal(result.callerId, "test-agent-alpha");
      assert.equal(result.isNew, true);
      assert.equal(result.schemaVersion, SUPPORTED_SCHEMA_VERSION);
      assert.equal(result.isCompatible, true);
      assert.equal(result.warning, null);

      assert.ok(fs.existsSync(result.profilePath));
      const content = fs.readFileSync(result.profilePath, "utf-8");
      assert.ok(content.includes('caller_id: "test-agent-alpha"'));
      assert.ok(content.includes("schema_version: 1"));
      assert.ok(content.includes('reporter_compatibility: ">=1.0.0"'));
    });

    it("should read existing profile without overwriting it", () => {
      const profilesDir = path.join(tmpDir, "profiles");
      fs.mkdirSync(profilesDir, { recursive: true });
      const customProfile = `---
schema_version: 1
reporter_compatibility: ">=1.0.0"
caller_id: "custom-tester"
default_theme: "synthwave"
---
# Custom Tester
Custom content`;
      fs.writeFileSync(path.join(profilesDir, "custom-tester.md"), customProfile, "utf-8");

      const result = resolveCaller("custom-tester", { vaultDir: tmpDir });
      assert.equal(result.isNew, false);
      assert.equal(result.frontmatter.default_theme, "synthwave");
      assert.equal(result.isCompatible, true);
    });

    it("should warn on unsupported schema_version and mark incompatible", () => {
      const profilesDir = path.join(tmpDir, "profiles");
      fs.mkdirSync(profilesDir, { recursive: true });
      const customProfile = `---
schema_version: 99
reporter_compatibility: ">=1.0.0"
caller_id: "future-agent"
---
# Future`;
      fs.writeFileSync(path.join(profilesDir, "future-agent.md"), customProfile, "utf-8");

      const result = resolveCaller("future-agent", { vaultDir: tmpDir });
      assert.equal(result.isCompatible, false);
      assert.ok(result.warning.includes("schema_version"));
    });
  });
});
