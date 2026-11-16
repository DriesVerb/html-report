/**
 * Shared zero-dependency runtime & environment helpers for @html-report/core.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_PRIMARY_PORT = 3031;
export const DEFAULT_SECONDARY_PORT = 3032;

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
