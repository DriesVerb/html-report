#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const REPORTER_VERSION = "1.0.0";
export const SUPPORTED_SCHEMA_VERSION = 1;
export const MAX_RUN_RETENTION = 10;

/**
 * Extracts leaf caller ID from a nested or chained caller string.
 * Example: "teamwork/subagent/memory-leak-debugging" -> "memory-leak-debugging"
 */
export function extractLeafCaller(callerChain) {
  if (!callerChain || typeof callerChain !== "string") {
    return "default";
  }
  const parts = callerChain.split(/[/\\]+/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return "default";
  return parts[parts.length - 1];
}

/**
 * Locates or creates the workspace vault root directory (.caller-requests).
 */
export function getVaultDir(startDir = process.cwd()) {
  let curr = path.resolve(startDir);
  while (curr !== path.dirname(curr)) {
    const candidate = path.join(curr, ".caller-requests");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    // Also check for repo indicators (.git or package.json or openspec)
    if (fs.existsSync(path.join(curr, ".git")) || fs.existsSync(path.join(curr, "openspec"))) {
      const target = path.join(curr, ".caller-requests");
      if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
      }
      return target;
    }
    curr = path.dirname(curr);
  }
  const fallback = path.resolve(startDir, ".caller-requests");
  if (!fs.existsSync(fallback)) {
    fs.mkdirSync(fallback, { recursive: true });
  }
  return fallback;
}

/**
 * Simple, robust YAML frontmatter parser for caller profiles.
 */
export function parseFrontmatter(content) {
  if (typeof content !== "string") {
    return { frontmatter: {}, body: "" };
  }

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content.trim() };
  }

  const yamlBlock = match[1];
  const body = match[2];
  const frontmatter = {};

  const lines = yamlBlock.split(/\r?\n/);
  let currentKey = null;
  let isMultiline = false;
  let multilineVal = [];
  let isList = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    // Check for multiline string continuation
    if (isMultiline) {
      if (/^\s{2,}/.test(rawLine)) {
        multilineVal.push(rawLine.replace(/^\s{2}/, ""));
        continue;
      } else {
        frontmatter[currentKey] = multilineVal.join("\n");
        isMultiline = false;
        multilineVal = [];
        currentKey = null;
      }
    }

    // Check for list items
    if (isList) {
      if (/^\s*-\s+/.test(rawLine)) {
        const itemVal = trimmed.replace(/^-\s+/, "").replace(/^["']|["']$/g, "");
        frontmatter[currentKey].push(itemVal);
        continue;
      } else {
        isList = false;
        currentKey = null;
      }
    }

    const kvMatch = rawLine.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      let val = kvMatch[2].trim();

      if (val === "|" || val === ">") {
        currentKey = key;
        isMultiline = true;
        multilineVal = [];
        continue;
      }

      if (val === "" && i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
        currentKey = key;
        isList = true;
        frontmatter[key] = [];
        continue;
      }

      // Scalar value
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      } else if (val.startsWith("'") && val.endsWith("'")) {
        val = val.slice(1, -1);
      } else if (/^\d+$/.test(val)) {
        val = parseInt(val, 10);
      } else if (/^\d+\.\d+$/.test(val)) {
        val = parseFloat(val);
      } else if (val === "true") {
        val = true;
      } else if (val === "false") {
        val = false;
      }

      frontmatter[key] = val;
    }
  }

  if (isMultiline && currentKey) {
    frontmatter[currentKey] = multilineVal.join("\n");
  }

  return { frontmatter, body };
}

/**
 * Checks compatibility between reporter engine and profile requirement.
 */
export function checkCompatibility(requiredRange, currentVersion = REPORTER_VERSION) {
  if (!requiredRange || typeof requiredRange !== "string") return true;

  const cleanCurrent = currentVersion.replace(/^[v^~>=<\s]+/, "");
  const [currMaj, currMin, currPatch] = cleanCurrent.split(".").map(Number);

  const cleanRequired = requiredRange.replace(/^[v^~>=<\s]+/, "");
  const [reqMaj, reqMin, reqPatch] = cleanRequired.split(".").map(Number);

  if (requiredRange.startsWith(">=")) {
    if (currMaj > reqMaj) return true;
    if (currMaj === reqMaj && currMin > reqMin) return true;
    if (currMaj === reqMaj && currMin === reqMin && (currPatch || 0) >= (reqPatch || 0)) return true;
    return false;
  }

  if (requiredRange.startsWith("^")) {
    return currMaj === reqMaj && currMin >= reqMin;
  }

  return currMaj >= reqMaj;
}

/**
 * Calculates SHA256 checksum of a file.
 */
export function getFileChecksum(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Formats caller id into a human-readable title.
 */
function formatTitle(id) {
  return id
    .split(/[-_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Generates baseline default profile template content for a caller.
 */
export function generateBaselineProfile(callerId) {
  const leafId = extractLeafCaller(callerId);
  const title = formatTitle(leafId);

  return `---
schema_version: 1
reporter_compatibility: ">=1.0.0"
caller_id: "${leafId}"
caller_title: "${title} Reporter"
default_theme: "light"
required_cdns:
  - "tailwind"
  - "daisyui"
  - "lucide"
  - "alpinejs"
  - "chartjs"
  - "mermaid"
  - "gridjs"
  - "katex"
  - "marked"
  - "highlightjs"
custom_instructions: |
  Baseline execution rules for ${title}:
  - Adhere to the responsive DaisyUI sticky navbar contract.
  - Deliverables should be modular, clean, and self-contained.
  - Synchronize dynamic charts and Mermaid diagrams with DaisyUI themes.
---

# ${title} Analytical Report

Executive summary and technical diagnostics for ${leafId}.

## Summary
- **Caller ID**: \`${leafId}\`
- **Auto-Scaffolded Baseline**: Yes
`;
}

/**
 * Resolves a caller profile, auto-scaffolding if not present.
 */
export function resolveCaller(callerId, options = {}) {
  const vaultDir = options.vaultDir || getVaultDir(options.cwd || process.cwd());
  const profilesDir = path.join(vaultDir, "profiles");
  const runsDir = path.join(vaultDir, "runs");

  if (!fs.existsSync(profilesDir)) fs.mkdirSync(profilesDir, { recursive: true });
  if (!fs.existsSync(runsDir)) fs.mkdirSync(runsDir, { recursive: true });

  const leafId = extractLeafCaller(callerId);
  const profilePath = path.join(profilesDir, `${leafId}.md`);

  let isNew = false;
  if (!fs.existsSync(profilePath)) {
    const baseline = generateBaselineProfile(leafId);
    fs.writeFileSync(profilePath, baseline, "utf-8");
    isNew = true;
  }

  const rawContent = fs.readFileSync(profilePath, "utf-8");
  const checksum = crypto.createHash("sha256").update(rawContent).digest("hex");
  const { frontmatter, body } = parseFrontmatter(rawContent);

  const schemaVersion = frontmatter.schema_version;
  let isCompatible = true;
  let warning = null;

  if (schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    warning = `Warning: Profile ${leafId} specifies schema_version ${schemaVersion}, but only ${SUPPORTED_SCHEMA_VERSION} is supported.`;
    isCompatible = false;
  }

  if (frontmatter.reporter_compatibility && !checkCompatibility(frontmatter.reporter_compatibility)) {
    warning = `Warning: Profile ${leafId} requires reporter ${frontmatter.reporter_compatibility}, but engine is ${REPORTER_VERSION}.`;
    isCompatible = false;
  }

  return {
    callerId: leafId,
    profilePath,
    isNew,
    checksum,
    schemaVersion: schemaVersion || SUPPORTED_SCHEMA_VERSION,
    isCompatible,
    warning,
    frontmatter,
    body
  };
}

/**
 * Records a run payload and prunes old runs exceeding the retention limit (10 runs).
 */
export function recordRun(callerId, payload = {}, options = {}) {
  const vaultDir = options.vaultDir || getVaultDir(options.cwd || process.cwd());
  const leafId = extractLeafCaller(callerId);
  const callerRunsDir = path.join(vaultDir, "runs", leafId);

  if (!fs.existsSync(callerRunsDir)) {
    fs.mkdirSync(callerRunsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runId = options.runId || `${timestamp}`;
  const runDir = path.join(callerRunsDir, runId);
  fs.mkdirSync(runDir, { recursive: true });

  // Store payload
  const payloadPath = path.join(runDir, "payload.json");
  fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), "utf-8");

  if (options.overrides) {
    const overridesPath = path.join(runDir, "overrides.json");
    fs.writeFileSync(overridesPath, JSON.stringify(options.overrides, null, 2), "utf-8");
  }

  // Prune older runs exceeding MAX_RUN_RETENTION
  const pruned = pruneRuns(callerRunsDir, options.maxRetention || MAX_RUN_RETENTION);

  return {
    leafId,
    runId,
    runDir,
    payloadPath,
    pruned
  };
}

/**
 * Records a harness execution run trace, state transitions, and overrides inside the caller vault.
 */
export function recordHarnessRun(callerId, { run = {}, trace = {}, overrides = {} } = {}, options = {}) {
  const vaultDir = options.vaultDir || getVaultDir(options.cwd || process.cwd());
  const leafId = extractLeafCaller(callerId);
  const callerRunsDir = path.join(vaultDir, "runs", leafId);

  if (!fs.existsSync(callerRunsDir)) {
    fs.mkdirSync(callerRunsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runId = options.runId || `${timestamp}`;
  const runDir = path.join(callerRunsDir, runId);
  if (!fs.existsSync(runDir)) {
    fs.mkdirSync(runDir, { recursive: true });
  }

  const runJsonPath = path.join(runDir, "run.json");
  const traceJsonPath = path.join(runDir, "trace.json");
  const overridesJsonPath = path.join(runDir, "overrides.json");

  // Read prior run if updating existing run-id across remediation retries
  let existingRun = {};
  if (fs.existsSync(runJsonPath)) {
    try {
      existingRun = JSON.parse(fs.readFileSync(runJsonPath, "utf-8"));
    } catch {}
  }

  const mergedRun = {
    ...existingRun,
    ...run,
    callerId: leafId,
    leafCallerId: leafId,
    runId,
    timestamp: existingRun.timestamp || run.timestamp || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stateHistory: run.stateHistory || existingRun.stateHistory || []
  };

  fs.writeFileSync(runJsonPath, JSON.stringify(mergedRun, null, 2), "utf-8");
  fs.writeFileSync(traceJsonPath, JSON.stringify(trace, null, 2), "utf-8");
  if (overrides && Object.keys(overrides).length > 0) {
    fs.writeFileSync(overridesJsonPath, JSON.stringify(overrides, null, 2), "utf-8");
  }

  const pruned = pruneRuns(callerRunsDir, options.maxRetention || MAX_RUN_RETENTION);

  return {
    leafId,
    runId,
    runDir,
    runJsonPath,
    traceJsonPath,
    overridesJsonPath,
    pruned
  };
}

/**
 * Prunes run directories in callerRunsDir to retain at most maxRetention runs.
 */
export function pruneRuns(callerRunsDir, maxRetention = MAX_RUN_RETENTION) {
  if (!fs.existsSync(callerRunsDir)) return [];

  const entries = fs.readdirSync(callerRunsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const fullPath = path.join(callerRunsDir, e.name);
      const stat = fs.statSync(fullPath);
      return {
        name: e.name,
        path: fullPath,
        mtimeMs: stat.mtimeMs,
        birthtimeMs: stat.birthtimeMs
      };
    });

  // Sort newest first
  entries.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const pruned = [];
  if (entries.length > maxRetention) {
    const toRemove = entries.slice(maxRetention);
    for (const item of toRemove) {
      fs.rmSync(item.path, { recursive: true, force: true });
      pruned.push(item.name);
    }
  }

  return pruned;
}

/**
 * Merges instructions across the 3-tier hierarchy:
 * 1. Core Quality Standards (Immutable)
 * 2. Caller Profile Rules (Persistent defaults)
 * 3. Runtime Ephemeral Overrides (Per-run parameters)
 */
export function mergeInstructions(coreStandards = {}, profileRules = {}, runtimeOverrides = {}) {
  const mergedTheme = runtimeOverrides.theme || runtimeOverrides.default_theme || profileRules.default_theme || coreStandards.default_theme || "light";

  const cdns = new Set([
    ...(coreStandards.required_cdns || []),
    ...(profileRules.required_cdns || []),
    ...(runtimeOverrides.required_cdns || [])
  ]);

  const customInstructions = [
    coreStandards.instructions,
    profileRules.instructions || profileRules.custom_instructions,
    runtimeOverrides.instructions || runtimeOverrides.custom_instructions
  ].filter(Boolean).join("\n\n---\n\n");

  return {
    theme: mergedTheme,
    required_cdns: Array.from(cdns),
    instructions: customInstructions,
    reportMode: runtimeOverrides.reportMode || profileRules.reportMode || coreStandards.reportMode || "interactive",
    meta: {
      ...(coreStandards.meta || {}),
      ...(profileRules.meta || {}),
      ...(runtimeOverrides.meta || {})
    }
  };
}

/**
 * Computes default output file path in the caller's working directory.
 */
export function getOutputPath(callerId, explicitPath = null, options = {}) {
  if (explicitPath) {
    return path.resolve(options.cwd || process.cwd(), explicitPath);
  }
  const leafId = extractLeafCaller(callerId);
  const ext = options.ext || ".html";
  return path.resolve(options.cwd || process.cwd(), `report-${leafId}${ext}`);
}

/**
 * Computes both HTML and PDF output paths in the caller's working directory.
 */
export function getOutputPaths(callerId, explicitPath = null, options = {}) {
  const leafId = extractLeafCaller(callerId);
  const cwd = options.cwd || process.cwd();
  if (explicitPath) {
    const resolved = path.resolve(cwd, explicitPath);
    const parsed = path.parse(resolved);
    return {
      htmlPath: path.format({ ...parsed, base: undefined, ext: ".html" }),
      pdfPath: path.format({ ...parsed, base: undefined, ext: ".pdf" }),
      outputPath: resolved
    };
  }
  return {
    htmlPath: path.resolve(cwd, `report-${leafId}.html`),
    pdfPath: path.resolve(cwd, `report-${leafId}.pdf`),
    outputPath: path.resolve(cwd, `report-${leafId}.html`)
  };
}

// CLI execution helper
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [,, cmd, callerArg] = process.argv;
  if (!cmd || cmd === "--help" || cmd === "-h") {
    console.log(`
Usage: node caller-registry.mjs <command> [args]

Commands:
  resolve <caller-id>       Resolves or auto-scaffolds a profile
  leaf <caller-chain>       Extracts leaf caller ID
  prune <caller-id> [max]   Prunes runs for a caller
`);
    process.exit(0);
  }

  if (cmd === "resolve" && callerArg) {
    const res = resolveCaller(callerArg);
    console.log(JSON.stringify(res, null, 2));
  } else if (cmd === "leaf" && callerArg) {
    console.log(extractLeafCaller(callerArg));
  } else {
    console.error("Unknown command or missing arguments");
    process.exit(1);
  }
}
