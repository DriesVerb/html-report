import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

function collectFiles(dir, exts) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, exts));
    } else if (entry.isFile() && exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results.sort();
}

describe("Codebase Digestibility & Modular Structure Guard", () => {
  it("enforces <= 650 lines for every .mjs and .js module under workspace packages scripts/ and assets/", () => {
    const MAX_MODULE_LINES = 650;
    const packagesDir = path.join(REPO_ROOT, "packages");
    const pkgNames = fs.readdirSync(packagesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    const violations = [];
    let inspectedCount = 0;

    for (const pkg of pkgNames) {
      for (const subDir of ["scripts", "assets"]) {
        const files = collectFiles(path.join(packagesDir, pkg, subDir), [".mjs", ".js"]);
        for (const file of files) {
          inspectedCount++;
          const lineCount = fs.readFileSync(file, "utf-8").split(/\r?\n/).length;
          if (lineCount > MAX_MODULE_LINES) {
            violations.push(`${path.relative(REPO_ROOT, file)}: ${lineCount} lines (max ${MAX_MODULE_LINES})`);
          }
        }
      }
    }

    assert.ok(inspectedCount > 0, "Expected to inspect workspace script and asset modules");
    assert.deepEqual(violations, [], `Oversized modules found:\n${violations.join("\n")}`);
  });

  it("enforces <= 1600 lines for the modularized Creation Studio HTML shell", () => {
    const packagesDir = path.join(REPO_ROOT, "packages");
    const htmlTargets = fs.readdirSync(packagesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(packagesDir, d.name, "assets", "create.html"))
      .filter((p) => fs.existsSync(p));

    assert.ok(htmlTargets.length > 0, "Expected Creation Studio HTML shell to exist");
    for (const target of htmlTargets) {
      const lineCount = fs.readFileSync(target, "utf-8").split(/\r?\n/).length;
      assert.ok(
        lineCount <= 1600,
        `${path.relative(REPO_ROOT, target)} has ${lineCount} lines (max 1600)`
      );
    }
  });

  it("validates JavaScript syntax (node --check) across all browser module chunk directories", () => {
    const packagesDir = path.join(REPO_ROOT, "packages");
    const chunkDirs = [];
    for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const assetsDir = path.join(packagesDir, entry.name, "assets");
      if (!fs.existsSync(assetsDir)) continue;
      for (const sub of fs.readdirSync(assetsDir, { withFileTypes: true })) {
        if (sub.isDirectory()) {
          chunkDirs.push(path.join(assetsDir, sub.name));
        }
      }
    }

    const chunkFiles = chunkDirs.flatMap((dir) => collectFiles(dir, [".js"]));
    assert.ok(chunkFiles.length >= 20, `Expected at least 20 browser chunk files, found ${chunkFiles.length}`);

    for (const file of chunkFiles) {
      const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf-8" });
      assert.equal(
        check.status,
        0,
        `Syntax check failed for ${path.relative(REPO_ROOT, file)}: ${check.stderr}`
      );
    }
  });

  it("ensures package navigation READMEs and repository codebase map exist and are non-empty", () => {
    const packagesDir = path.join(REPO_ROOT, "packages");
    const pkgReadmes = fs.readdirSync(packagesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join("packages", d.name, "README.md"));

    const requiredDocs = [...pkgReadmes, "docs/codebase-map.md"];
    for (const relDoc of requiredDocs) {
      const full = path.join(REPO_ROOT, relDoc);
      assert.ok(fs.existsSync(full), `Missing navigation document: ${relDoc}`);
      const content = fs.readFileSync(full, "utf-8").trim();
      assert.ok(content.length > 200, `Navigation document too small/empty: ${relDoc}`);
    }
  });

  it("enforces <= 150 lines and zero raw shell HTML templates in skills/html-report/references/architecture-and-styling.md", () => {
    const refPath = path.join(REPO_ROOT, "skills/html-report/references/architecture-and-styling.md");
    assert.ok(fs.existsSync(refPath), "Expected architecture-and-styling.md to exist");
    const content = fs.readFileSync(refPath, "utf-8");
    const lineCount = content.split(/\r?\n/).length;
    assert.ok(
      lineCount <= 150,
      `skills/html-report/references/architecture-and-styling.md has ${lineCount} lines (max 150)`
    );
    assert.ok(
      !content.includes('<header class="sticky'),
      "architecture-and-styling.md must not include raw sticky navbar HTML dumps"
    );
    assert.ok(
      !content.includes('<footer class="border-t'),
      "architecture-and-styling.md must not include raw footer HTML dumps"
    );
    assert.ok(
      content.includes("openMarkdownViewer(") && content.includes("steps-horizontal"),
      "architecture-and-styling.md must include canonical fragment recipes"
    );
  });
});
