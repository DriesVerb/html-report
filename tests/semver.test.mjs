import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
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

test("SemVer Package Foundation & Metadata Integrity", async (t) => {
  await t.test("package.json exists and adheres to SemVer standard", () => {
    const pkgPath = path.resolve(process.cwd(), "package.json");
    assert.ok(fs.existsSync(pkgPath), "package.json must exist at root");

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    assert.equal(pkg.name, "html-report");
    assert.equal(pkg.version, "1.0.0");
    assert.equal(pkg.type, "module");
    assert.ok(pkg.exports, "package.json must declare subpath exports");
    assert.ok(pkg.bin, "package.json must declare bin entries");

    // Verify subpath export targets exist
    for (const [subpath, target] of Object.entries(pkg.exports)) {
      const resolved = path.resolve(process.cwd(), target);
      assert.ok(fs.existsSync(resolved), `Subpath ${subpath} target ${target} must exist on disk`);
    }

    // Verify bin targets exist
    for (const [binName, binTarget] of Object.entries(pkg.bin)) {
      const resolved = path.resolve(process.cwd(), binTarget);
      assert.ok(fs.existsSync(resolved), `Bin ${binName} target ${binTarget} must exist on disk`);
    }
  });

  await t.test("compatibility.mjs returns accurate version and SemVer formatting", () => {
    const meta = getPackageMetadata();
    assert.equal(meta.name, "html-report");
    assert.equal(getPackageVersion(), "1.0.0");
    assert.equal(formatVersionString(), "html-report v1.0.0 (SemVer 2.0.0)");
    assert.equal(SEMVER_SPEC, "2.0.0");
  });
});

test("Deprecation Interceptors & Compatibility Diagnostics", async (t) => {
  await t.test("checkDeprecatedCliArgs detects legacy flags and maps to canonical", () => {
    const rawArgs = ["--dashboard-mode", "--title", "Audit"];
    const { normalized, warnings } = checkDeprecatedCliArgs(rawArgs, { emitWarnings: false });

    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].flag, "--dashboard-mode");
    assert.equal(warnings[0].retiredIn, "2.0.0");
    assert.deepEqual(normalized, ["--dashboard", "--title", "Audit"]);
  });

  await t.test("checkDeprecatedApiOptions detects legacy properties and applies fallbacks", () => {
    const rawOptions = { dashboardMode: true, title: "Audit" };
    const { normalized, warnings } = checkDeprecatedApiOptions(rawOptions, { emitWarnings: false });

    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].property, "dashboardMode");
    assert.equal(normalized.mode, "dashboard");
  });

  await t.test("generateAiMigrationPrompt produces structured turnkey agent instructions", () => {
    const prompt = generateAiMigrationPrompt({
      fromVersion: "1.x",
      toVersion: "2.0.0",
      breakingItems: [{ old: "--dashboard-mode", new: "--mode dashboard", desc: "canonical mode" }]
    });

    assert.ok(prompt.includes("<AI_MIGRATION_PROMPT>"));
    assert.ok(prompt.includes("</AI_MIGRATION_PROMPT>"));
    assert.ok(prompt.includes("Target Upgrade: v1.x -> v2.0.0"));
    assert.ok(prompt.includes("--dashboard-mode"));
  });

  await t.test("checkCompatibility successfully audits workspace directory", () => {
    const audit = checkCompatibility(process.cwd());
    assert.ok(audit.scannedFilesCount > 50, "Scanner must audit multiple repository files");
    assert.equal(typeof audit.isCompatible, "boolean");
    assert.equal(audit.currentVersion, "1.0.0");
  });
});

test("CLI Executable Version Flags", async (t) => {
  await t.test("build-report.mjs --version prints SemVer string and exits 0", () => {
    const stdout = execSync("node skills/html-report/scripts/build-report.mjs --version", { encoding: "utf-8" });
    assert.ok(stdout.includes("html-report v1.0.0 (SemVer 2.0.0)"));
  });

  await t.test("harness.mjs --version and -v print SemVer string and exit 0", () => {
    const stdoutVersion = execSync("node skills/html-report/scripts/harness.mjs --version", { encoding: "utf-8" });
    assert.ok(stdoutVersion.includes("html-report v1.0.0 (SemVer 2.0.0)"));

    const stdoutShort = execSync("node skills/html-report/scripts/harness.mjs -v", { encoding: "utf-8" });
    assert.ok(stdoutShort.includes("html-report v1.0.0 (SemVer 2.0.0)"));
  });

  await t.test("harness.mjs --check-compatibility command executes successfully", () => {
    const stdout = execSync("node skills/html-report/scripts/harness.mjs --check-compatibility", { encoding: "utf-8" });
    assert.ok(stdout.includes("Auditing codebase compatibility"));
    assert.ok(stdout.includes("Compatible with html-report v1.0.0"));
  });
});

test("Report Footer Semantic Versioning & README Visibility", async (t) => {
  await t.test("buildReport dynamically injects SemVer version into report footer", () => {
    const res = buildReport({
      title: "SemVer Footer Verification",
      content: "<section><h1>Test Content</h1></section>"
    });

    assert.ok(res.html.includes('title="Semantic Versioning v1.0.0"'), "Footer must contain version title attribute");
    assert.ok(res.html.includes("v1.0.0"), "Footer must render active version number");
    assert.ok(!res.html.includes("(SemVer 2.0.0)"), "Footer must not contain (SemVer 2.0.0)");
  });

  await t.test("README.md prominently features SemVer badges and dedicated section", () => {
    const readmeContent = fs.readFileSync(path.resolve(process.cwd(), "README.md"), "utf-8");
    assert.ok(readmeContent.includes("badge/SemVer-2.0.0"), "README must contain SemVer 2.0.0 badge");
    assert.ok(readmeContent.includes("badge/Version-v1.0.0"), "README must contain Version v1.0.0 badge");
    assert.ok(readmeContent.includes("Semantic Versioning & Downstream Integration"), "README must contain SemVer section");
    assert.ok(readmeContent.includes("docs/semantic-versioning.md"), "README must link to docs/semantic-versioning.md");
    assert.ok(readmeContent.includes("MIGRATION.md"), "README must link to MIGRATION.md");
  });
});
