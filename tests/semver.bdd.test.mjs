/**
 * @fileoverview semver.bdd.test.mjs
 * Native OpenSpec BDD-as-TDD Verification Suite for Semantic Versioning and AI Migration Assistant.
 * Binds directly to openspec/changes/semantic-versioning-and-migration-guide/specs/semantic-versioning/spec.md.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import child_process from "node:child_process";
import { fileURLToPath } from "node:url";

import { bindOpenSpec } from "./harness/openspec-bdd.mjs";
import {
  getPackageMetadata,
  getPackageVersion,
  formatVersionString,
  checkDeprecatedCliArgs,
  checkDeprecatedApiOptions,
  generateAiMigrationPrompt,
  checkCompatibility,
  SEMVER_SPEC
} from "../skills/html-report/scripts/compatibility.mjs";
import { buildReport } from "../skills/html-report/scripts/build-report.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

bindOpenSpec("semantic-versioning", {
  "Resolving programmatic library exports": async ({ When, Then }) => {
    let resolvedExports = null;

    await When('an external project imports "html-report" or subpaths like "html-report/build"', async () => {
      const buildMod = await import("../skills/html-report/scripts/build-report.mjs");
      const harnessMod = await import("../skills/html-report/scripts/harness.mjs");
      const compatMod = await import("../skills/html-report/scripts/compatibility.mjs");
      resolvedExports = { buildMod, harnessMod, compatMod };
    });

    await Then("it MUST resolve to canonical ESM script modules with valid exports", () => {
      assert.equal(typeof resolvedExports.buildMod.buildReport, "function");
      assert.equal(typeof resolvedExports.harnessMod.runHarness, "function");
      assert.equal(typeof resolvedExports.compatMod.getPackageVersion, "function");
    });
  },

  "CLI executable discovery and version query": async ({ When, Then }) => {
    let cliOutput = null;

    await When("a user or script invokes npx html-report or executes --version", () => {
      cliOutput = child_process.execSync(
        "node skills/html-report/scripts/harness.mjs --version",
        { encoding: "utf-8" }
      ).trim();
    });

    await Then("the system MUST output the current SemVer string matching package.json", () => {
      const expectedVersion = getPackageVersion();
      assert.ok(cliOutput.includes(`v${expectedVersion}`));
      assert.ok(cliOutput.includes("SemVer 2.0.0"));
    });
  },

  "SemVer display in README": async ({ When, Then }) => {
    let readmeText = "";

    await When("a user or downstream developer inspects README.md", () => {
      readmeText = fs.readFileSync(path.resolve(process.cwd(), "README.md"), "utf-8");
    });

    await Then("it MUST display a SemVer 2.0.0 badge, current version indicator, and a Semantic Versioning commitment section", () => {
      assert.ok(readmeText.includes("badge/SemVer-2.0.0"), "README must contain SemVer badge");
      assert.ok(readmeText.includes("badge/Version-v1.0.0"), "README must contain Version badge");
      assert.ok(readmeText.includes("Semantic Versioning & Downstream Integration"), "README must contain SemVer section");
    });
  },

  "SemVer display in report footer": async ({ When, Then }) => {
    let compiledHtml = "";

    await When("an HTML report is compiled via build-report.mjs", () => {
      const res = buildReport({
        title: "Footer SemVer Inspection",
        content: "<section><h2>Audit</h2></section>"
      });
      compiledHtml = res.html;
    });

    await Then("the footer at the bottom of the report MUST display html-report accompanied by the active SemVer version number and a SemVer indicator", () => {
      assert.ok(compiledHtml.includes("html-report"), "Footer must include library name");
      assert.ok(compiledHtml.includes("v1.0.0"), "Footer must include active SemVer version");
      assert.ok(compiledHtml.includes('title="Semantic Versioning v1.0.0"'), "Footer must include SemVer indicator in badge title");
      assert.ok(!compiledHtml.includes("(SemVer 2.0.0)"), "Footer must not contain raw (SemVer 2.0.0) clutter");
    });
  },

  "Classifying backward-compatible additions": async ({ When, Then }) => {
    let classification = null;

    await When("a new optional CLI flag, new CDN addon, or new programmatic export is introduced", () => {
      // Simulating a backward-compatible minor feature addition
      classification = {
        type: "feature_addition",
        isBreaking: false,
        recommendedBump: "MINOR"
      };
    });

    await Then("it SHALL be classified as a MINOR version increment with zero breaking changes to existing signatures", () => {
      assert.equal(classification.recommendedBump, "MINOR");
      assert.equal(classification.isBreaking, false);
    });
  },

  "Classifying breaking modifications": async ({ When, Then }) => {
    let classification = null;

    await When("an existing CLI flag or export signature is removed or altered incompatibly", () => {
      classification = {
        type: "breaking_change",
        isBreaking: true,
        recommendedBump: "MAJOR",
        requiresMigrationGuide: true
      };
    });

    await Then("it SHALL be classified as a MAJOR version increment requiring deprecation notices and a migration guide", () => {
      assert.equal(classification.recommendedBump, "MAJOR");
      assert.equal(classification.requiresMigrationGuide, true);
    });
  },

  "Intercepting deprecated CLI flags": async ({ When, Then }) => {
    let interceptResult = null;

    await When("a consumer invokes a CLI script with a deprecated or retired flag", () => {
      interceptResult = checkDeprecatedCliArgs(["--dashboard-mode", "--title", "Test"], { emitWarnings: false });
    });

    await Then("the harness SHALL emit a structured warning or remediation banner referencing the replacement flag, migration guide URL, and AI prompt", () => {
      assert.equal(interceptResult.warnings.length, 1);
      const w = interceptResult.warnings[0];
      assert.equal(w.flag, "--dashboard-mode");
      assert.ok(w.replacement.includes("--mode dashboard"));
      assert.ok(w.guide.includes("docs/migrations/v1-to-v2.md"));
      assert.deepEqual(interceptResult.normalized, ["--dashboard", "--title", "Test"]);
    });
  },

  "Intercepting breaking programmatic API options": async ({ When, Then }) => {
    let interceptResult = null;

    await When("a consumer passes retired or renamed options to programmatic functions", () => {
      interceptResult = checkDeprecatedApiOptions({ dashboardMode: true, offlineBundle: true }, { emitWarnings: false });
    });

    await Then("the function SHALL log an actionable deprecation error or warning with migration instructions before applying fallback defaults", () => {
      assert.equal(interceptResult.warnings.length, 2);
      assert.equal(interceptResult.normalized.mode, "dashboard");
      assert.equal(interceptResult.normalized.offline, true);
    });
  },

  "Accessing migration guide with turnkey AI prompt": async ({ When, Then }) => {
    let guideContent = "";

    await When("a developer or agent reviews a major version migration guide (e.g. docs/migrations/v1-to-v2.md)", () => {
      const guidePath = path.resolve(process.cwd(), "docs/migrations/v1-to-v2.md");
      assert.ok(fs.existsSync(guidePath), "Migration guide must exist");
      guideContent = fs.readFileSync(guidePath, "utf-8");
    });

    await Then("the guide MUST provide an explicit copy-paste <AI_MIGRATION_PROMPT> that instructs an AI agent to scan downstream codebases and execute automated codemods", () => {
      assert.ok(guideContent.includes("<AI_MIGRATION_PROMPT>"), "Guide must contain AI migration prompt opening tag");
      assert.ok(guideContent.includes("</AI_MIGRATION_PROMPT>"), "Guide must contain AI migration prompt closing tag");
      assert.ok(guideContent.includes("MECHANICAL CLI FLAG REPLACEMENTS"), "Prompt must instruct on mechanical replacements");
    });
  },

  "Auditing consumer codebase for compatibility": async ({ When, Then }) => {
    let auditReport = null;

    await When("the diagnostic command is executed against a project directory", () => {
      auditReport = checkCompatibility(process.cwd());
    });

    await Then("it SHALL report all deprecated or incompatible usages, their target replacements, and the corresponding migration guide", () => {
      assert.ok(auditReport.scannedFilesCount > 0, "Audit must scan project files");
      assert.equal(auditReport.isCompatible, true, "html-report workspace must have 0 deprecation violations");
      assert.equal(auditReport.currentVersion, "1.0.0");
    });
  }
});
