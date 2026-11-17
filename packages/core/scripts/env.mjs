/**
 * Shared zero-dependency runtime & environment helpers for @html-report/core.
 */

import fs from "node:fs";
import path from "node:path";
import { register as registerModuleLoader } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

export const DEFAULT_PRIMARY_PORT = 3031;
export const DEFAULT_SECONDARY_PORT = 3032;

const CORE_PKG_NAME = "@html-report/core";

/**
 * Ensures workspace package symlinks (e.g. node_modules/@html-report/core)
 * exist on disk and falls back to the zero-dependency ESM workspace loader hook
 * when running in a read-only or symlink-free checkout.
 */
export function ensureWorkspacePackageLinks(repoRoot = REPO_ROOT) {
  const packagesDir = path.join(repoRoot, "packages");
  let linksHealthy = false;
  try {
    if (fs.existsSync(packagesDir)) {
      for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const pkgDir = path.join(packagesDir, entry.name);
        const pkgJsonPath = path.join(pkgDir, "package.json");
        if (!fs.existsSync(pkgJsonPath)) continue;
        let pkgName = null;
        try {
          pkgName = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"))?.name;
        } catch (_) {}
        if (!pkgName || typeof pkgName !== "string") continue;

        const linkPath = path.join(repoRoot, "node_modules", ...pkgName.split("/"));
        let exists = false;
        try {
          exists = fs.existsSync(linkPath);
        } catch (_) {}
        if (!exists) {
          try {
            fs.mkdirSync(path.dirname(linkPath), { recursive: true });
            const target = process.platform === "win32"
              ? pkgDir
              : path.relative(path.dirname(linkPath), pkgDir);
            fs.symlinkSync(target, linkPath, process.platform === "win32" ? "junction" : "dir");
          } catch (_) {}
        }
      }
    }
    linksHealthy = fs.existsSync(path.join(repoRoot, "node_modules", ...CORE_PKG_NAME.split("/")));
  } catch (_) {
    linksHealthy = false;
  }

  if (!linksHealthy && typeof registerModuleLoader === "function") {
    const loaderSym = Symbol.for("html-report.workspace-loader.registered");
    if (!globalThis[loaderSym]) {
      try {
        globalThis[loaderSym] = true;
        registerModuleLoader(pathToFileURL(path.resolve(__dirname, "workspace-loader.mjs")).href);
      } catch (_) {}
    }
  }

  return linksHealthy;
}

/**
 * Builds Node CLI arguments for child/supervised processes, preserving
 * process.execArgv (--import, --loader, --conditions, etc.) and injecting
 * the workspace loader automatically if node_modules/@html-report/core is missing.
 */
export function getChildNodeExecArgs(extraArgs = [], repoRoot = REPO_ROOT) {
  const execArgs = [...process.execArgv];
  const coreLinkPath = path.join(repoRoot, "node_modules", ...CORE_PKG_NAME.split("/"));
  const hasCoreLink = fs.existsSync(coreLinkPath);
  if (!hasCoreLink) {
    const alreadyHasWorkspaceLoader = execArgs.some((a) => String(a).includes("workspace-loader.mjs"));
    if (!alreadyHasWorkspaceLoader) {
      execArgs.push("--import", pathToFileURL(path.resolve(__dirname, "workspace-loader.mjs")).href);
    }
  }
  return [...execArgs, ...extraArgs];
}

ensureWorkspacePackageLinks();

/**
 * Symlink-safe direct CLI execution check.
 * Canonicalizes both process.argv[1] and import.meta.url via fs.realpathSync
 * so symlinked skill installations (~/.agents/skills/html-report/...) always match.
 */
export function isDirectCliExecution(argv1, metaUrl) {
  if (!argv1 || !metaUrl) return false;
  try {
    const resolvedArgv = path.resolve(argv1);
    const metaPath = fileURLToPath(metaUrl);
    if (resolvedArgv === path.resolve(metaPath)) return true;
    const realArgv = fs.existsSync(resolvedArgv) ? fs.realpathSync(resolvedArgv) : resolvedArgv;
    const realMeta = fs.existsSync(metaPath) ? fs.realpathSync(metaPath) : path.resolve(metaPath);
    return realArgv === realMeta;
  } catch (_) {
    try {
      return pathToFileURL(path.resolve(argv1)).href === metaUrl;
    } catch (__) {
      return false;
    }
  }
}

/**
 * Fast, synchronous lookup of an executable name on PATH without spawning a shell.
 */
export function findExecutableOnPath(binName, envPath = process.env.PATH || "") {
  if (!binName) return null;
  if (path.isAbsolute(binName)) {
    try {
      fs.accessSync(binName, fs.constants.X_OK);
      return binName;
    } catch (_) {
      return null;
    }
  }
  const pathDirs = envPath.split(path.delimiter).filter(Boolean);
  const exts = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of pathDirs) {
    for (const ext of exts) {
      const fullPath = path.join(dir, binName + ext);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          fs.accessSync(fullPath, fs.constants.X_OK);
          return fullPath;
        }
      } catch (_) {}
    }
  }
  return null;
}

/**
 * Locates an installed system Google Chrome or Chromium binary on the host.
 */
export function detectSystemChrome() {
  const envCandidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    process.env.CHROMIUM_BIN
  ].filter(Boolean);

  const platformCandidates =
    process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
          "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
        ]
      : process.platform === "win32"
        ? [
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/snap/bin/chromium"
          ];

  for (const candidate of [...envCandidates, ...platformCandidates]) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (_) {}
  }

  if (process.platform !== "win32") {
    for (const binName of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
      const found = findExecutableOnPath(binName);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Inspects both Playwright's bundled Chromium executable and system Chrome fallback.
 */
export async function detectBrowserReadiness() {
  let playwrightChromium = null;
  let playwrightExists = false;

  try {
    let pw = null;
    try {
      pw = await import("playwright");
    } catch (_) {
      const bundledPlaywright = path.resolve(__dirname, "../playwright/node_modules/playwright/index.mjs");
      if (fs.existsSync(bundledPlaywright)) {
        pw = await import(pathToFileURL(bundledPlaywright).href);
      }
    }
    if (pw && pw.chromium && typeof pw.chromium.executablePath === "function") {
      const execPath = pw.chromium.executablePath();
      if (execPath && fs.existsSync(execPath)) {
        playwrightChromium = execPath;
        playwrightExists = true;
      }
    }
  } catch (_) {}

  const systemChrome = detectSystemChrome();
  const recommendedExecutable = playwrightChromium || systemChrome || null;

  return {
    ready: Boolean(recommendedExecutable),
    playwrightChromium,
    playwrightBundledReady: playwrightExists,
    systemChrome,
    systemChromeReady: Boolean(systemChrome),
    recommendedExecutable,
    strategy: playwrightExists ? "playwright-bundled" : (systemChrome ? "system-chrome-fallback" : "unavailable")
  };
}

/**
 * Resolves the canonical skill/package root directory and determines
 * whether the target workspace has a local skills/html-report/ directory.
 */
export function resolveSkillPaths(workspaceRoot = process.cwd()) {
  const repoSkillDir = path.resolve(__dirname, "../../../skills/html-report");
  const rawSkillRoot = fs.existsSync(repoSkillDir) ? repoSkillDir : path.resolve(__dirname, "..");
  let canonicalSkillRoot = rawSkillRoot;
  try {
    canonicalSkillRoot = fs.realpathSync(rawSkillRoot);
  } catch (_) {}

  const resolvedWorkspace = path.resolve(workspaceRoot);
  const repoLocalBuildScript = path.join(resolvedWorkspace, "skills", "html-report", "scripts", "build-report.mjs");
  const agentsBuildScript = path.join(resolvedWorkspace, ".agents", "skills", "html-report", "scripts", "build-report.mjs");
  const isMonorepoLocal = fs.existsSync(repoLocalBuildScript);
  const isAgentsSkillLocal = !isMonorepoLocal && fs.existsSync(agentsBuildScript);

  const mode = isMonorepoLocal ? "repo-local" : (isAgentsSkillLocal ? "agents-skill" : "external");

  const scriptsPrefix = isMonorepoLocal
    ? "skills/html-report/scripts"
    : (isAgentsSkillLocal ? ".agents/skills/html-report/scripts" : path.join(canonicalSkillRoot, "scripts"));

  const playwrightPrefix = isMonorepoLocal
    ? "skills/html-report/playwright"
    : (isAgentsSkillLocal ? ".agents/skills/html-report/playwright" : path.join(canonicalSkillRoot, "playwright"));

  const referencesPrefix = isMonorepoLocal
    ? "../../skills/html-report/references"
    : (isAgentsSkillLocal ? "../../.agents/skills/html-report/references" : path.join(canonicalSkillRoot, "references"));

  return {
    mode,
    installMode: mode,
    skillRoot: canonicalSkillRoot,
    rawSkillRoot,
    workspaceRoot: resolvedWorkspace,
    isMonorepoLocal,
    isAgentsSkillLocal,
    scriptsPrefix,
    playwrightPrefix,
    referencesPrefix,
    buildScript: `${scriptsPrefix}/build-report.mjs`,
    serveScript: `${scriptsPrefix}/serve-report.mjs`,
    scaffoldScript: `${scriptsPrefix}/scaffold-project.mjs`,
    preflightScript: `${scriptsPrefix}/preflight.mjs`,
    verifyScript: `${playwrightPrefix}/verify-report.mjs`,
    authoringGuide: `${referencesPrefix}/agent-authoring-guide.md`
  };
}
