import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { NATIVE_MCP_TOOLS } from "../skills/html-report/scripts/mcp-server.mjs";
import { discoverSkills, MAX_SKILL_SIZE_BYTES } from "../skills/html-report/scripts/skill-router.mjs";
import { normalizeDomainConfig, generateCliCommand } from "../skills/html-report/scripts/domain-model.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const FORBIDDEN_DEPRECATED_SYNONYMS = [
  "snippet",
  "partial",
  "bundler",
  "raw stitching",
  "file concat",
  "glue step",
  "admin bar",
  "bottom toolbar",
  "artifact file"
];

function findDeprecatedTerms(text) {
  const lower = String(text || "").toLowerCase();
  return FORBIDDEN_DEPRECATED_SYNONYMS.filter((term) => new RegExp(`\\b${term}\\b`, "i").test(lower));
}

describe("Domain-Language Code Alignment (Spec Delta: domain-code-alignment)", () => {
  it("CLI --help outputs for build-report, harness, html-grill, and skill-router contain zero deprecated synonyms", () => {
    const scripts = [
      "skills/html-report/scripts/build-report.mjs",
      "skills/html-report/scripts/harness.mjs",
      "skills/html-report/scripts/html-grill.mjs",
      "skills/html-report/scripts/skill-router.mjs"
    ];

    for (const script of scripts) {
      const helpOutput = execFileSync(process.execPath, [path.join(REPO_ROOT, script), "--help"], {
        encoding: "utf-8"
      });
      const found = findDeprecatedTerms(helpOutput);
      assert.deepEqual(found, [], `${script} --help contains deprecated terms: ${found.join(", ")}`);
    }
  });

  it("NATIVE_MCP_TOOLS schemas in mcp-server.mjs contain zero deprecated synonyms and use canonical terms", () => {
    const serialized = JSON.stringify(NATIVE_MCP_TOOLS);
    const found = findDeprecatedTerms(serialized);
    assert.deepEqual(found, [], `NATIVE_MCP_TOOLS contains deprecated terms: ${found.join(", ")}`);

    assert.ok(serialized.includes("Semantic Fragment"), "MCP tools should reference Semantic Fragment");
    assert.ok(serialized.includes("Output Deliverable"), "MCP tools should reference Output Deliverable");
    assert.ok(serialized.includes("Published Document"), "MCP tools should reference Published Document");
    assert.ok(serialized.includes("Target Element"), "MCP tools should reference Target Element");
  });

  it("create.html exposes Two-Axis selectors without agent-beneficiary clutter and stays in sync with assets/create.html", () => {
    const rootCreate = fs.readFileSync(path.join(REPO_ROOT, "create.html"), "utf-8");
    const assetCreate = fs.readFileSync(path.join(REPO_ROOT, "skills/html-report/assets/create.html"), "utf-8");
    assert.equal(rootCreate, assetCreate, "create.html and skills/html-report/assets/create.html must match");

    assert.ok(!rootCreate.includes('id="beneficiary-selector"'), "create.html should not expose #beneficiary-selector to end users");
    assert.ok(rootCreate.includes('id="behavioral-selector"'), "create.html must include #behavioral-selector");
    assert.ok(rootCreate.includes("selectWizardBehavioral"), "create.html must define selectWizardBehavioral");
  });

  it("normalizeDomainConfig preserves Delivery Archetype when PWA Offline Packaging Modifier is enabled", () => {
    const cfg = normalizeDomainConfig({ target: "report", appPackaging: "offline-app" });
    assert.equal(cfg.target, "report");
    assert.equal(cfg.targetDef.skillTag, "@html-report");
    assert.equal(cfg.appPackaging, "offline-app");

    const cli = generateCliCommand(cfg);
    assert.ok(cli.buildFlags.includes("--pwa"), "CLI flags must include --pwa modifier");
  });

  it("all 6 modular SKILL.md facades have domainMetadata and remain under 5KB limit", () => {
    const skills = discoverSkills();
    assert.equal(skills.length, 6);
    for (const s of skills) {
      assert.ok(s.sizeBytes <= MAX_SKILL_SIZE_BYTES, `${s.name} SKILL.md (${s.sizeBytes}B) exceeds 5KB`);
      assert.ok(s.domainMetadata, `${s.name} must include domainMetadata in skill-router.mjs`);
      assert.ok(s.domainMetadata.beneficiary, `${s.name} domainMetadata must declare beneficiary`);
      assert.ok(s.domainMetadata.servingMode, `${s.name} domainMetadata must declare servingMode`);
      assert.ok(s.domainMetadata.behavioralMode, `${s.name} domainMetadata must declare behavioralMode`);
    }
  });

  it("skill-router.mjs list --json outputs valid deterministic JSON", () => {
    const out = execFileSync(
      process.execPath,
      [path.join(REPO_ROOT, "skills/html-report/scripts/skill-router.mjs"), "list", "--json"],
      { encoding: "utf-8" }
    );
    const parsed = JSON.parse(out);
    assert.equal(parsed.count, 6);
    assert.ok(Array.isArray(parsed.skills));
  });
});
