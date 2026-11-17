/**
 * @file workspace-loader.mjs
 * Zero-dependency Node.js ESM module resolution hook for monorepo workspace packages.
 * Resolves declared workspace package exports directly from packages/* when
 * node_modules workspace symlinks are absent (e.g., fresh clones or isolated runners).
 */

import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isMainThread } from "node:worker_threads";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const LOADER_SYMBOL = Symbol.for("html-report.workspace-loader.registered");

let cachedPackages = null;

function loadWorkspacePackages() {
  if (cachedPackages) return cachedPackages;
  const map = new Map();
  const packagesDir = path.join(REPO_ROOT, "packages");
  if (!fs.existsSync(packagesDir)) {
    cachedPackages = map;
    return map;
  }

  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgDir = path.join(packagesDir, entry.name);
    const pkgJsonPath = path.join(pkgDir, "package.json");
    if (!fs.existsSync(pkgJsonPath)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
      if (pkg && typeof pkg.name === "string" && pkg.name.trim()) {
        map.set(pkg.name.trim(), { dir: pkgDir, pkg });
      }
    } catch (_) {}
  }

  cachedPackages = map;
  return map;
}

function extractExportTarget(entry) {
  if (!entry) return null;
  if (typeof entry === "string") return entry;
  if (typeof entry === "object") {
    return extractExportTarget(entry.import || entry.node || entry.default);
  }
  return null;
}

/**
 * Resolves a workspace package specifier (e.g., "@html-report/core/build") to a file:// URL.
 * Returns null if the specifier does not match a workspace package export on disk.
 */
export function resolveWorkspacePackageSpecifier(specifier) {
  if (!specifier || typeof specifier !== "string") return null;
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("file:") || specifier.startsWith("node:")) {
    return null;
  }

  const packages = loadWorkspacePackages();
  let matchedPkg = null;
  let subpath = ".";

  for (const [pkgName, info] of packages.entries()) {
    if (specifier === pkgName) {
      matchedPkg = info;
      subpath = ".";
      break;
    }
    if (specifier.startsWith(`${pkgName}/`)) {
      matchedPkg = info;
      subpath = `./${specifier.slice(pkgName.length + 1)}`;
      break;
    }
  }

  if (!matchedPkg) return null;
  const { dir, pkg } = matchedPkg;
  const exportsMap = pkg.exports || {};

  let targetRel = extractExportTarget(exportsMap[subpath]);
  if (!targetRel && subpath === "." && pkg.main) {
    targetRel = pkg.main;
  }

  if (!targetRel) {
    for (const [pattern, rawTarget] of Object.entries(exportsMap)) {
      const starIdx = pattern.indexOf("*");
      if (starIdx === -1) continue;
      const prefix = pattern.slice(0, starIdx);
      const suffix = pattern.slice(starIdx + 1);
      if (subpath.startsWith(prefix) && subpath.endsWith(suffix)) {
        const captured = subpath.slice(prefix.length, subpath.length - suffix.length);
        const mapped = extractExportTarget(rawTarget);
        if (mapped) {
          targetRel = mapped.replace(/\*/g, captured);
          break;
        }
      }
    }
  }

  if (!targetRel) return null;
  const resolvedPath = path.resolve(dir, targetRel);
  if (!fs.existsSync(resolvedPath)) return null;
  return pathToFileURL(resolvedPath).href;
}

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const resolvedUrl = resolveWorkspacePackageSpecifier(specifier);
    if (resolvedUrl) {
      return { url: resolvedUrl, shortCircuit: true };
    }
    throw err;
  }
}

export function registerWorkspaceLoader() {
  if (isMainThread && typeof register === "function" && !globalThis[LOADER_SYMBOL]) {
    const usesLegacyLoader = process.execArgv.some(
      (arg) => arg === "--loader" || arg === "--experimental-loader" || arg.startsWith("--loader=") || arg.startsWith("--experimental-loader=")
    );
    if (!usesLegacyLoader) {
      globalThis[LOADER_SYMBOL] = true;
      register(import.meta.url);
    }
  }
}

registerWorkspaceLoader();
