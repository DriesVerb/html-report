import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const CORE_DIR = path.join(REPO_ROOT, "packages", "core");
const STUDIO_DIR = path.join(REPO_ROOT, "packages", "studio");

function collectSourceFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(full));
    } else if (/\.(m?js|cjs|html|json|sh)$/i.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe("Two-Package Workspace Boundary (@html-report/core vs @html-report/studio)", () => {
  it("configures npm workspaces in root package.json and valid manifests for core and studio", () => {
    const rootPkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8"));
    const corePkg = JSON.parse(fs.readFileSync(path.join(CORE_DIR, "package.json"), "utf-8"));
    const studioPkg = JSON.parse(fs.readFileSync(path.join(STUDIO_DIR, "package.json"), "utf-8"));

    assert.equal(rootPkg.name, "html-report");
    assert.ok(Array.isArray(rootPkg.workspaces) && rootPkg.workspaces.includes("packages/*"));
    assert.equal(corePkg.name, "@html-report/core");
    assert.equal(studioPkg.name, "@html-report/studio");
    assert.ok(studioPkg.dependencies && studioPkg.dependencies["@html-report/core"]);
  });

  it("packages/core contains zero imports or references to @html-report/studio or packages/studio", () => {
    const files = collectSourceFiles(CORE_DIR);
    assert.ok(files.length > 0, "packages/core must contain source files");

    const forbidden = [
      /@html-report\/studio/,
      /\bpackages\/studio\b/,
      /\.\.\/\.\.\/studio\b/,
      /\.\.\/studio\b/
    ];

    const violations = [];
    for (const file of files) {
      const rel = path.relative(REPO_ROOT, file);
      const content = fs.readFileSync(file, "utf-8");
      for (const pattern of forbidden) {
        if (pattern.test(content)) {
          violations.push(`${rel} matched ${pattern}`);
        }
      }
    }
    assert.deepEqual(violations, [], `Core must not reference Studio:\n${violations.join("\n")}`);
  });

  it("packages/studio never uses relative deep imports into packages/core internals", () => {
    const files = collectSourceFiles(STUDIO_DIR);
    assert.ok(files.length > 0, "packages/studio must contain source files");

    const importRegex = /(?:import\s+[\s\S]*?\s+from\s+|import\s*\(|require\s*\()\s*["']([^"']+)["']/g;
    const violations = [];

    for (const file of files) {
      const rel = path.relative(REPO_ROOT, file);
      if (rel.endsWith("package-boundary.test.mjs")) continue;
      const content = fs.readFileSync(file, "utf-8");
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const spec = match[1];
        if (
          spec.includes("../core/") ||
          spec.includes("..\\core\\") ||
          spec.includes("packages/core/")
        ) {
          violations.push(`${rel} imports forbidden deep path "${spec}"`);
        }
      }
      if (/\.\.\/\.\.\/core\//.test(content) || /\bpackages\/core\/(?:scripts|assets|playwright)\//.test(content)) {
        if (!rel.endsWith(".test.mjs")) {
          violations.push(`${rel} references packages/core internals directly`);
        }
      }
    }

    assert.deepEqual(violations, [], `Studio must import @html-report/core via package exports only:\n${violations.join("\n")}`);
  });

  it("all declared package.json exports and bin targets resolve on disk", () => {
    const manifests = [
      { dir: REPO_ROOT, pkg: JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8")) },
      { dir: CORE_DIR, pkg: JSON.parse(fs.readFileSync(path.join(CORE_DIR, "package.json"), "utf-8")) },
      { dir: STUDIO_DIR, pkg: JSON.parse(fs.readFileSync(path.join(STUDIO_DIR, "package.json"), "utf-8")) }
    ];

    for (const { dir, pkg } of manifests) {
      for (const [subpath, target] of Object.entries(pkg.exports || {})) {
        if (subpath.includes("*")) continue;
        const resolved = path.resolve(dir, target);
        assert.ok(fs.existsSync(resolved), `${pkg.name} export "${subpath}" -> "${target}" must exist`);
      }
      for (const [binName, target] of Object.entries(pkg.bin || {})) {
        const resolved = path.resolve(dir, target);
        assert.ok(fs.existsSync(resolved), `${pkg.name} bin "${binName}" -> "${target}" must exist`);
      }
    }
  });
});
