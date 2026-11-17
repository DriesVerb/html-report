/**
 * @file lib/server/workspace-scanner.mjs
 * Workspace path security checks, active OpenSpec change resolution, and
 * project metadata discovery for the Creation Studio directory.
 */

import fs from "node:fs";
import path from "node:path";
import { getPackageVersion } from "@html-report/core/compatibility";

export function findActiveChangeDir(startDir) {
  let curr = startDir;
  while (curr && curr !== path.dirname(curr)) {
    const changesDir = path.join(curr, "openspec", "changes");
    if (fs.existsSync(changesDir)) {
      const entries = fs.readdirSync(changesDir, { withFileTypes: true });
      const active = entries.filter((e) => e.isDirectory() && e.name !== "archive");
      if (active.length > 0) {
        active.sort((a, b) => {
          const aMtime = fs.statSync(path.join(changesDir, a.name)).mtimeMs;
          const bMtime = fs.statSync(path.join(changesDir, b.name)).mtimeMs;
          return bMtime - aMtime;
        });
        return path.join(changesDir, active[0].name);
      }

      const archiveDir = path.join(changesDir, "archive");
      if (fs.existsSync(archiveDir)) {
        const archivedEntries = fs.readdirSync(archiveDir, { withFileTypes: true });
        const archives = archivedEntries.filter((e) => e.isDirectory());
        if (archives.length > 0) {
          archives.sort((a, b) => {
            const aMtime = fs.statSync(path.join(archiveDir, a.name)).mtimeMs;
            const bMtime = fs.statSync(path.join(archiveDir, b.name)).mtimeMs;
            return bMtime - aMtime;
          });
          return path.join(archiveDir, archives[0].name);
        }
      }
    }
    curr = path.dirname(curr);
  }
  return null;
}

export function isPathInside(baseDir, targetPath) {
  const rel = path.relative(path.resolve(baseDir), path.resolve(targetPath));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function isLoopbackAddress(addr = "") {
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

export function findWorkspaceRoot(startDir) {
  let curr = path.resolve(startDir);
  while (curr && curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, ".git"))) {
      return curr;
    }
    const pkgPath = path.join(curr, "package.json");
    if (fs.existsSync(pkgPath)) {
      const parentBase = path.basename(path.dirname(curr));
      let isProjectSubpackage = parentBase === "projects";
      if (!isProjectSubpackage) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          if (pkg && typeof pkg.name === "string" && (
            pkg.name.startsWith("html-report-project-") ||
            (parentBase === "packages" && pkg.name.startsWith("@html-report/"))
          )) {
            isProjectSubpackage = true;
          }
        } catch (_) {}
      }
      if (!isProjectSubpackage) {
        return curr;
      }
    }
    curr = path.dirname(curr);
  }
  return path.resolve(startDir);
}

export function extractProjectMetadata(fullPath, relPath, workspaceRoot) {
  let title = path.basename(relPath, ".html");
  let version = "0.0.0-beta.1";
  let description = "";

  try {
    const fd = fs.openSync(fullPath, "r");
    const buffer = Buffer.alloc(8192);
    const bytesRead = fs.readSync(fd, buffer, 0, 8192, 0);
    fs.closeSync(fd);
    const headChunk = buffer.toString("utf-8", 0, bytesRead);

    const titleMatch = headChunk.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1].trim()) {
      title = titleMatch[1].trim();
    } else if (relPath.includes("openspec/changes/")) {
      const match = relPath.match(/openspec\/changes\/([^\/]+)/);
      if (match) {
        title = match[1].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " - Journey";
      }
    }

    const versionMatch =
      headChunk.match(/data-(?:report-)?version=["']([^"']+)["']/i) ||
      headChunk.match(/<!--\s*(?:VERSION|version):\s*([^\s-]+)\s*-->/i) ||
      headChunk.match(/<meta\s+name=["']version["']\s+content=["']([^"']+)["']/i) ||
      headChunk.match(/title=["']Semantic Versioning v([^"']+)["']/i) ||
      headChunk.match(/<!--\s*v?(\d+\.\d+\.\d+)\s*-->/);

    if (versionMatch && versionMatch[1] && !versionMatch[1].includes("{{")) {
      version = versionMatch[1].replace(/^v/, "").trim();
    } else {
      const pkgVer = getPackageVersion(workspaceRoot);
      if (pkgVer && pkgVer !== "unknown") {
        version = pkgVer.startsWith("v") ? pkgVer.slice(1) : pkgVer;
      }
    }

    const descMatch = headChunk.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (descMatch && descMatch[1].trim()) {
      description = descMatch[1].trim();
    }
  } catch (_) {}

  let category = "HTML Report";
  const normalizedRel = relPath.replace(/\\/g, "/");
  const isFragment = path.basename(normalizedRel).includes("fragment");

  if (normalizedRel.startsWith("projects/")) {
    category = "Workspace Project";
  } else if (normalizedRel.startsWith("openspec/changes/")) {
    category = isFragment ? "OpenSpec Fragment" : "OpenSpec Journey";
  } else if (normalizedRel.startsWith("benchmark/") || normalizedRel.startsWith("examples/benchmark/")) {
    category = "Performance Benchmark";
  } else if (normalizedRel.startsWith("research/") || normalizedRel.startsWith("docs/research/")) {
    category = "Research Report";
  } else if (normalizedRel.startsWith("dev/") || normalizedRel.startsWith("examples/dev/")) {
    category = "Dev Prototype";
  } else if (normalizedRel.startsWith("experiments/") || normalizedRel.startsWith("examples/experiments/")) {
    category = "Experiment";
  } else if (normalizedRel.startsWith("reports/") || normalizedRel === "report.html") {
    category = "Analytical Report";
  } else if (normalizedRel.includes("examples/")) {
    category = "Showcase Example";
  } else if (path.basename(normalizedRel) === "create.html") {
    category = "Creation Studio";
  } else if (isFragment) {
    category = "HTML Fragment";
  }

  let stat;
  try {
    stat = fs.statSync(fullPath);
  } catch (_) {
    stat = { size: 0, mtime: new Date() };
  }

  return {
    title,
    path: normalizedRel,
    url: "/" + normalizedRel,
    category,
    version,
    updatedAt: stat.mtime.toISOString(),
    size: stat.size,
    description
  };
}

export function scanWorkspaceProjects(workspaceRoot, maxDepth = 4) {
  const projectsDir = path.join(workspaceRoot, "projects");
  if (!fs.existsSync(projectsDir)) {
    return [];
  }

  const IGNORED_DIRS = new Set([
    ".git",
    "node_modules",
    ".cache",
    ".gemini",
    "coverage",
    "dist",
    "build",
    ".system_generated",
    "tmp",
    ".local",
    "tests"
  ]);

  const projects = [];

  function isIgnoredDir(name) {
    if (IGNORED_DIRS.has(name)) return true;
    if (name.startsWith(".") && name !== ".openspec.yaml") return true;
    if (name.startsWith("tmp-") || name.startsWith("tmp.")) return true;
    return false;
  }

  const visitedRealPaths = new Set();

  function walk(currentDir, depth) {
    if (depth > maxDepth) return;
    let realCurrent;
    try {
      realCurrent = fs.realpathSync(currentDir);
    } catch (_) {
      realCurrent = currentDir;
    }
    if (visitedRealPaths.has(realCurrent)) return;
    visitedRealPaths.add(realCurrent);

    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (_) {
      return;
    }

    const subdirs = [];
    const htmlFiles = [];

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        if (!isIgnoredDir(entry.name)) {
          subdirs.push(path.join(currentDir, entry.name));
        }
      } else if (entry.isFile() && entry.name.endsWith(".html")) {
        if (entry.name.includes("fragment")) continue;
        htmlFiles.push(entry.name);
      }
    }

    if (htmlFiles.length > 0) {
      const primaryFile = htmlFiles.includes("index.html")
        ? "index.html"
        : (htmlFiles.find((f) => !f.includes("published")) || htmlFiles[0]);
      const fullPath = path.join(currentDir, primaryFile);
      const relPath = path.relative(workspaceRoot, fullPath);
      projects.push(extractProjectMetadata(fullPath, relPath, workspaceRoot));
    }

    for (const sub of subdirs) {
      walk(sub, depth + 1);
    }
  }

  walk(projectsDir, 0);

  projects.sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return projects;
}
