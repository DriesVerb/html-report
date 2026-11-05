#!/usr/bin/env node

/**
 * skills/html-report/scripts/harness.mjs
 *
 * Deterministic Finite State Machine (FSM) CLI Harness and Remediation Orchestrator.
 * Zero external runtime dependencies - pure Node.js standard library built-ins.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  REPORTER_VERSION,
  extractLeafCaller,
  resolveCaller,
  recordHarnessRun,
  mergeInstructions,
  getOutputPath,
  getOutputPaths
} from "./caller-registry.mjs";
import {
  CANONICAL_MODES,
  MODE_ALIASES,
  normalizeMode
} from "./build-report.mjs";
import {
  getPackageVersion,
  formatVersionString,
  checkDeprecatedCliArgs,
  checkCompatibility
} from "./compatibility.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export { CANONICAL_MODES, MODE_ALIASES, normalizeMode };

export const MODE_SERVER_POLICIES = Object.freeze({
  print: { requiresServer: false, defaultAction: "export_or_static" },
  report: { requiresServer: false, defaultAction: "open_static" },
  presentation: { requiresServer: false, defaultAction: "open_static" },
  dashboard: { requiresServer: true, defaultAction: "serve" },
  "working-report": { requiresServer: true, defaultAction: "serve" },
  "live-report": { requiresServer: true, defaultAction: "serve" },
  pwa: { requiresServer: true, defaultAction: "serve" }
});

export async function isPortActive(port, host = "localhost") {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/`, { timeout: 800 }, (res) => {
      resolve(true);
      req.destroy();
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

export async function ensureDevServerRunning({
  filePath,
  port = 3000,
  mode = "dashboard"
}) {
  const active = await isPortActive(port);
  if (active) {
    return {
      running: true,
      alreadyRunning: true,
      port,
      url: `http://localhost:${port}/`
    };
  }

  const serveScript = path.resolve(__dirname, "./serve-report.mjs");
  const child = spawn(process.execPath, [serveScript, filePath, "--port", String(port)], {
    detached: true,
    stdio: "ignore"
  });
  child.unref();

  return {
    running: true,
    alreadyRunning: false,
    port,
    url: `http://localhost:${port}/`,
    pid: child.pid
  };
}

export const STATES = Object.freeze({
  IDLE: "IDLE",
  RESOLVING_CALLER: "RESOLVING_CALLER",
  VALIDATING: "VALIDATING",
  AUTO_FIXING: "AUTO_FIXING",
  ASSEMBLING: "ASSEMBLING",
  VERIFYING: "VERIFYING",
  RECORDING_RUN: "RECORDING_RUN",
  REMEDIATING: "REMEDIATING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED"
});

/**
 * Converts any arbitrary heading or section title into a URL-friendly slug.
 */
export function slugify(text = "") {
  const plain = text.replace(/<[^>]+>/g, "").trim();
  
  const normalized = plain
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric chars with hyphens
    .replace(/^-+|-+$/g, ""); // Trim leading and trailing hyphens

  return normalized || "section";
}

/**
 * Scans HTML string and collects all existing ID attribute values.
 */
export function collectExistingIds(html = "") {
  const ids = new Set();
  const idRegex = /\bid\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = idRegex.exec(html)) !== null) {
    if (match[1]) {
      ids.add(match[1]);
    }
  }
  return ids;
}

/**
 * Generates a unique ID given base text and an existing set of IDs.
 */
export function generateUniqueId(text, existingIds) {
  const baseSlug = slugify(text);
  let candidate = baseSlug;
  let counter = 1;

  while (existingIds.has(candidate)) {
    candidate = `${baseSlug}-${counter}`;
    counter++;
  }

  existingIds.add(candidate);
  return candidate;
}

/**
 * Helper to compute line and column numbers from character index offset.
 */
function getLineAndCol(str, index) {
  const pre = str.slice(0, index);
  const lines = pre.split("\n");
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  return { line, col };
}

/**
 * Lints an HTML fragment for structural flaws:
 * 1. Accidental outer boilerplate (<!DOCTYPE>, <html>, <head>, <body>, <main>, frontmatter)
 * 2. Missing IDs on <h1>, <h2>, <h3> headings
 * 3. Bare <table> elements lacking horizontal overflow wrappers
 */
export function lintFragment(rawContent = "") {
  const issues = [];
  const content = String(rawContent);

  // 1. Check for YAML frontmatter
  if (content.trim().startsWith("---")) {
    const endMatch = content.slice(3).indexOf("\n---");
    if (endMatch !== -1) {
      issues.push({
        type: "OUTER_BOILERPLATE",
        tag: "frontmatter",
        line: 1,
        message: "HTML fragment contains YAML frontmatter header.",
        snippet: content.slice(0, endMatch + 7),
        fixable: true,
        suggestedFix: "Strip YAML frontmatter from fragment."
      });
    }
  }

  // 2. Check for outer boilerplate tags
  const boilerplateTags = [
    { tag: "<!DOCTYPE", regex: /<!DOCTYPE\b[^>]*>/gi, name: "<!DOCTYPE>" },
    { tag: "<html", regex: /<html\b[^>]*>/gi, name: "<html>" },
    { tag: "</html>", regex: /<\/html>/gi, name: "</html>" },
    { tag: "<head", regex: /<head\b[^>]*>[\s\S]*?<\/head>/gi, name: "<head>...</head>" },
    { tag: "<body", regex: /<body\b[^>]*>/gi, name: "<body>" },
    { tag: "</body>", regex: /<\/body>/gi, name: "</body>" },
    { tag: "<main", regex: /<main\b[^>]*>/gi, name: "<main>" },
    { tag: "</main>", regex: /<\/main>/gi, name: "</main>" }
  ];

  for (const bp of boilerplateTags) {
    let match;
    bp.regex.lastIndex = 0;
    while ((match = bp.regex.exec(content)) !== null) {
      const { line } = getLineAndCol(content, match.index);
      issues.push({
        type: "OUTER_BOILERPLATE",
        tag: bp.name,
        line,
        message: `HTML fragment contains outer boilerplate tag ${bp.name}. Fragments should only contain inner markup.`,
        snippet: match[0].length > 100 ? match[0].slice(0, 97) + "..." : match[0],
        fixable: true,
        suggestedFix: `Strip outer ${bp.name} tag.`
      });
    }
  }

  // 3. Check for missing IDs on <h1>, <h2>, <h3> tags
  const headingRegex = /<(h[1-3])(\s+[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let hMatch;
  while ((hMatch = headingRegex.exec(content)) !== null) {
    const fullHeading = hMatch[0];
    const tag = hMatch[1].toLowerCase();
    const attrs = hMatch[2] || "";
    const innerText = hMatch[3] || "";
    const hasId = /\bid\s*=\s*["'][^"']+["']/i.test(attrs);

    if (!hasId) {
      const { line } = getLineAndCol(content, hMatch.index);
      const textPreview = innerText.replace(/<[^>]+>/g, "").trim();
      const generatedSlug = slugify(textPreview);
      issues.push({
        type: "MISSING_HEADING_ID",
        tag,
        line,
        message: `<${tag}> heading "${textPreview}" is missing an 'id' attribute required for Table of Contents navigation.`,
        snippet: fullHeading.length > 100 ? fullHeading.slice(0, 97) + "..." : fullHeading,
        fixable: true,
        suggestedFix: `Add id="${generatedSlug}" to <${tag}>.`
      });
    }
  }

  // 4. Check for bare <table> elements
  const tableRegex = /<table\b[\s\S]*?<\/table>/gi;
  let tMatch;
  while ((tMatch = tableRegex.exec(content)) !== null) {
    const tableIndex = tMatch.index;
    const preText = content.slice(Math.max(0, tableIndex - 300), tableIndex);
    const hasResponsiveWrapper = /<div\b[^>]*class\s*=\s*["'][^"']*(?:overflow-x-auto|overflow-auto)[^"']*["'][^>]*>\s*$/i.test(preText);

    if (!hasResponsiveWrapper) {
      const { line } = getLineAndCol(content, tableIndex);
      issues.push({
        type: "BARE_TABLE",
        tag: "table",
        line,
        message: "<table> element lacks responsive horizontal overflow wrapper (<div class=\"overflow-x-auto w-full\">).",
        snippet: tMatch[0].length > 100 ? tMatch[0].slice(0, 97) + "..." : tMatch[0],
        fixable: true,
        suggestedFix: "Wrap <table> in <div class=\"overflow-x-auto w-full\">."
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Strips outer boilerplate elements (<head>, <body>, <html>, <!DOCTYPE>, <main>, YAML frontmatter).
 */
export function stripOuterBoilerplate(rawContent = "") {
  let content = String(rawContent).trim();
  const removedTags = [];

  // Strip YAML frontmatter
  if (content.startsWith("---")) {
    const endMatch = content.slice(3).indexOf("\n---");
    if (endMatch !== -1) {
      content = content.slice(endMatch + 7).trim();
      removedTags.push("frontmatter");
    }
  }

  // Remove <head>...</head> blocks
  if (/<head\b[^>]*>[\s\S]*?<\/head>/i.test(content)) {
    content = content.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "").trim();
    removedTags.push("<head>");
  }

  // Extract inner <body> if present
  const bodyMatch = content.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    content = bodyMatch[1].trim();
    removedTags.push("<body>");
  }

  // Extract inner <html> if present (in case body wasn't present)
  const htmlMatch = content.match(/<html\b[^>]*>([\s\S]*?)<\/html>/i);
  if (htmlMatch) {
    content = htmlMatch[1].trim();
    removedTags.push("<html>");
  }

  // Extract inner <main> if present
  const mainMatch = content.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    content = mainMatch[1].trim();
    removedTags.push("<main>");
  }

  // Remove any lingering standalone boilerplate tags
  const tagsToStrip = [
    /<!DOCTYPE\b[^>]*>/gi,
    /<\/?html\b[^>]*>/gi,
    /<\/?body\b[^>]*>/gi,
    /<\/?main\b[^>]*>/gi
  ];

  for (const regex of tagsToStrip) {
    if (regex.test(content)) {
      content = content.replace(regex, "").trim();
    }
  }

  return {
    content: content.trim(),
    removedTags
  };
}

/**
 * Injects deterministic, slugified unique 'id' attributes into <h1>, <h2>, and <h3> headings lacking them.
 */
export function injectHeadingIds(rawContent = "") {
  let content = String(rawContent);
  const existingIds = collectExistingIds(content);
  const injected = [];

  content = content.replace(/<(h[1-3])(\s+[^>]*)?>([\s\S]*?)<\/\1>/gi, (match, tag, attrs = "", innerContent) => {
    if (/\bid\s*=\s*["'][^"']+["']/i.test(attrs)) {
      return match;
    }

    const text = innerContent.replace(/<[^>]+>/g, "").trim();
    const id = generateUniqueId(text, existingIds);

    injected.push({
      tag: tag.toLowerCase(),
      id,
      text
    });

    const cleanAttrs = attrs.trim();
    const newOpeningTag = cleanAttrs
      ? `<${tag} id="${id}" ${cleanAttrs}>`
      : `<${tag} id="${id}">`;

    return `${newOpeningTag}${innerContent}</${tag}>`;
  });

  return {
    content,
    injectedCount: injected.length,
    injected
  };
}

/**
 * Wraps bare <table> elements in <div class="overflow-x-auto w-full">.
 */
export function wrapBareTables(rawContent = "") {
  let content = String(rawContent);
  let wrappedCount = 0;

  const tableRegex = /<table\b[\s\S]*?<\/table>/gi;
  content = content.replace(tableRegex, (tableHtml, offset, fullString) => {
    const preText = fullString.slice(Math.max(0, offset - 300), offset);
    const hasResponsiveWrapper = /<div\b[^>]*class\s*=\s*["'][^"']*(?:overflow-x-auto|overflow-auto)[^"']*["'][^>]*>\s*$/i.test(preText);

    if (hasResponsiveWrapper) {
      return tableHtml;
    }

    wrappedCount++;
    return `<div class="overflow-x-auto w-full">\n  ${tableHtml}\n</div>`;
  });

  return {
    content,
    wrappedCount
  };
}

/**
 * Orchestrates mechanical auto-fix transforms on raw HTML fragment.
 */
export function autoFixFragment(rawContent = "", options = {}) {
  const {
    stripBoilerplate = true,
    injectHeadings = true,
    wrapTables = true
  } = options;

  let current = String(rawContent);
  const fixesApplied = [];

  if (stripBoilerplate) {
    const stripRes = stripOuterBoilerplate(current);
    if (stripRes.removedTags.length > 0) {
      fixesApplied.push({
        type: "STRIPPED_BOILERPLATE",
        description: `Stripped outer boilerplate wrappers: ${stripRes.removedTags.join(", ")}`,
        count: stripRes.removedTags.length,
        details: stripRes.removedTags
      });
      current = stripRes.content;
    }
  }

  if (injectHeadings) {
    const headingRes = injectHeadingIds(current);
    if (headingRes.injectedCount > 0) {
      fixesApplied.push({
        type: "INJECTED_HEADING_IDS",
        description: `Injected unique 'id' attributes into ${headingRes.injectedCount} heading(s).`,
        count: headingRes.injectedCount,
        details: headingRes.injected
      });
      current = headingRes.content;
    }
  }

  if (wrapTables) {
    const tableRes = wrapBareTables(current);
    if (tableRes.wrappedCount > 0) {
      fixesApplied.push({
        type: "WRAPPED_BARE_TABLES",
        description: `Wrapped ${tableRes.wrappedCount} bare <table> element(s) with responsive overflow container.`,
        count: tableRes.wrappedCount
      });
      current = tableRes.content;
    }
  }

  return {
    content: current,
    fixesApplied
  };
}

/**
 * Parses Playwright verification stdout/stderr to extract precise overflow/console diagnostics
 * and synthesizes prescriptive, spoon-fed instructions for smaller models.
 */
export function parseVerificationError(stdout = "", stderr = "") {
  const combined = `${stdout}\n${stderr}`;

  // 1. Element lacking space (horizontal scrollbar inside element)
  const elemOverflowMatch = combined.match(
    /Breakpoint\s+(\w+)\s+\((\d+)px\)\s+elements without enough space:\s+<([a-zA-Z0-9_-]+)(?:#([a-zA-Z0-9_-]+))?>\s+\((\d+)px\s*>\s*(\d+)px:\s*([^)]*)\)/i
  );

  if (elemOverflowMatch) {
    const bpName = elemOverflowMatch[1];
    const bpWidth = elemOverflowMatch[2];
    const tag = elemOverflowMatch[3];
    const id = elemOverflowMatch[4] || null;
    const scrollWidth = Number(elemOverflowMatch[5]);
    const clientWidth = Number(elemOverflowMatch[6]);
    const selector = id ? `#${id}` : tag;

    const instruction = id
      ? `In your fragment file, find '${selector}'. Wrap this element in <div class="overflow-x-auto w-full"> or change the grid to single-column on mobile with 'grid-cols-1 md:grid-cols-2'. Then re-run the harness command.`
      : `In your fragment file, find <${tag}>. Wrap this element in <div class="overflow-x-auto w-full"> or ensure max-w-full. Then re-run the harness command.`;

    return {
      failureType: "HORIZONTAL_OVERFLOW",
      culprit: {
        selector,
        tag,
        id,
        viewport: `${bpWidth}px (${bpName})`,
        scrollWidth,
        clientWidth
      },
      instruction_for_agent: instruction
    };
  }

  // 2. Entire page body horizontal overflow
  const pageOverflowMatch = combined.match(
    /Breakpoint\s+(\w+)\s+\((\d+)px\)\s+has page horizontal overflow:\s+scrollWidth=(\d+)px\s*>\s*innerWidth=(\d+)px/i
  );

  if (pageOverflowMatch) {
    const bpName = pageOverflowMatch[1];
    const bpWidth = pageOverflowMatch[2];
    const scrollWidth = Number(pageOverflowMatch[3]);
    const innerWidth = Number(pageOverflowMatch[4]);

    return {
      failureType: "PAGE_HORIZONTAL_OVERFLOW",
      culprit: {
        viewport: `${bpWidth}px (${bpName})`,
        scrollWidth,
        innerWidth
      },
      instruction_for_agent: `Page body has horizontal overflow at ${bpWidth}px (${bpName}). Check elements with fixed widths or margin/padding exceeding viewport, and ensure responsive containers use max-w-full.`
    };
  }

  // 3. Browser console errors
  const consoleMatch = combined.match(/Browser console errors\s*\(\d+\):\s*(.*)/i);
  if (consoleMatch) {
    return {
      failureType: "BROWSER_CONSOLE_ERROR",
      culprit: {
        error: consoleMatch[1].trim()
      },
      instruction_for_agent: `A browser runtime exception was thrown: "${consoleMatch[1].trim()}". Fix the client-side JavaScript or syntax in your fragment.`
    };
  }

  // 4. Missing elements or generic verification failure
  const failureLines = [];
  const lines = combined.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") && failureLines.length < 5) {
      failureLines.push(trimmed.slice(2));
    }
  }

  if (failureLines.length > 0) {
    return {
      failureType: "VERIFICATION_ASSERTION_FAILED",
      culprit: {
        failures: failureLines
      },
      instruction_for_agent: `Verification assertion failed: ${failureLines[0]}. Adjust fragment markup to satisfy publication requirements.`
    };
  }

  return {
    failureType: "VERIFICATION_FAILURE",
    culprit: {
      rawOutput: combined.slice(-500).trim()
    },
    instruction_for_agent: "Headless browser verification failed. Inspect the console logs and correct any layout or script errors."
  };
}

/**
 * Formats a prescriptive JSON diagnostic error payload for agents and small models.
 */
export function formatPrescriptiveDiagnostic(lintResult, attempt = 1, maxAttempts = 3) {
  const { issues = [] } = lintResult;
  const primaryIssue = issues[0] || {};
  const isFinal = attempt >= maxAttempts;

  return {
    status: isFinal ? "FAILED" : "REMEDIATION_REQUIRED",
    attempt,
    maxAttempts,
    failureType: "PREFLIGHT_LINT_ERROR",
    issueCount: issues.length,
    issues: issues.map(iss => ({
      type: iss.type,
      line: iss.line,
      tag: iss.tag,
      snippet: iss.snippet,
      instruction: iss.suggestedFix || iss.message
    })),
    instruction_for_agent: isFinal
      ? `Maximum remediation attempts (${maxAttempts}) reached. Halt and inspect errors manually.`
      : (primaryIssue.suggestedFix
          ? `Fix line ${primaryIssue.line}: ${primaryIssue.suggestedFix}. Alternatively run with --auto-fix.`
          : "Resolve the pre-flight linting issues listed in the issues array.")
  };
}

/**
 * Emits a high-contrast terminal remediation banner followed by structured JSON.
 */
export function printRemediationBanner(payload) {
  const isFailed = payload.status === "FAILED";
  const title = isFailed
    ? `✗ FATAL PIPELINE FAILURE: MAXIMUM RETRIES (${payload.maxAttempts}) EXCEEDED`
    : `⚠ REMEDIATION DIRECTIVE FOR AGENT (Attempt ${payload.attempt} of ${payload.maxAttempts})`;

  console.error("\n" + "=".repeat(80));
  console.error(title);
  console.error("-".repeat(80));
  if (payload.instruction_for_agent) {
    console.error(`DIRECTIVE: ${payload.instruction_for_agent}`);
  }
  if (payload.culprit?.selector) {
    console.error(`CULPRIT SELECTOR: ${payload.culprit.selector} (${payload.culprit.viewport || ""})`);
  }
  console.error("=".repeat(80));
  console.error(JSON.stringify(payload, null, 2) + "\n");
}

/**
 * Deterministic Pure-Node Finite State Machine Lifecycle Runner.
 * Standalone Mode: IDLE -> VALIDATING -> AUTO_FIXING -> ASSEMBLING -> VERIFYING -> COMPLETED / REMEDIATING / FAILED
 * Caller-Aware Mode: IDLE -> RESOLVING_CALLER -> VALIDATING -> AUTO_FIXING -> ASSEMBLING -> VERIFYING -> RECORDING_RUN -> COMPLETED / REMEDIATING / FAILED
 */
export async function runLifecycle({
  file,
  content = null,
  output = null,
  title = "HTML Report",
  theme = null,
  runId = null,
  printable = false,
  autoFix = true,
  verify = true,
  quick = true,
  mode = null,
  serve = null,
  port = 3000,
  caller = null,
  pdf = null,
  pwa = false,
  attempt = 1,
  maxAttempts = 3,
  json = false,
  onStateChange = null,
  // Optional test verifier injection hook for hermetic testing
  verifier = null,
  // Optional test server runner hook
  serverRunner = null
} = {}) {
  const startTime = performance.now();
  let currentState = STATES.IDLE;
  const history = [currentState];
  const stateTransitions = [];

  function transition(toState) {
    const fromState = currentState;
    currentState = toState;
    history.push(toState);
    stateTransitions.push({
      from: fromState,
      to: toState,
      timestamp: new Date().toISOString()
    });
    if (typeof onStateChange === "function") {
      onStateChange(toState, history);
    }
  }

  // Resolve and validate canonical report mode
  let resolvedMode = normalizeMode(mode);
  if (mode && !resolvedMode) {
    transition(STATES.FAILED);
    const errPayload = {
      status: "FAILED",
      attempt,
      maxAttempts,
      failureType: "INVALID_MODE",
      instruction_for_agent: `Invalid report mode "${mode}". Allowed modes: ${CANONICAL_MODES.join(", ")}`
    };
    if (json) console.log(JSON.stringify(errPayload, null, 2));
    else printRemediationBanner(errPayload);
    return { success: false, state: currentState, history, error: errPayload };
  }

  if (!resolvedMode) {
    if (printable) resolvedMode = "print";
    else resolvedMode = "report";
  }

  const serverPolicy = MODE_SERVER_POLICIES[resolvedMode] || { requiresServer: false, defaultAction: "open_static" };
  const shouldServe = serve !== null ? Boolean(serve) : serverPolicy.requiresServer;

  // Caller resolution & 3-tier configuration merge (strictly when caller is provided)
  let leafCallerId = null;
  let callerInfo = null;
  let mergedConfig = null;
  let activeRunId = runId || null;

  if (caller) {
    leafCallerId = extractLeafCaller(caller);
    if (!activeRunId) {
      activeRunId = new Date().toISOString().replace(/[:.]/g, "-");
    }

    transition(STATES.RESOLVING_CALLER);
    try {
      callerInfo = resolveCaller(caller);
    } catch (err) {
      transition(STATES.FAILED);
      const errPayload = {
        status: "FAILED",
        attempt,
        maxAttempts,
        failureType: "CALLER_RESOLUTION_ERROR",
        instruction_for_agent: `Failed to resolve caller profile for "${caller}": ${err.message}`
      };
      if (json) console.log(JSON.stringify(errPayload, null, 2));
      else printRemediationBanner(errPayload);
      return { success: false, state: currentState, history, error: errPayload };
    }

    if (!callerInfo.isCompatible) {
      transition(STATES.FAILED);
      const errPayload = {
        status: "FAILED",
        attempt,
        maxAttempts,
        failureType: "CALLER_PROFILE_INCOMPATIBLE",
        instruction_for_agent: callerInfo.warning || `Profile for ${leafCallerId} is incompatible with reporter version ${REPORTER_VERSION}.`
      };
      if (json) console.log(JSON.stringify(errPayload, null, 2));
      else printRemediationBanner(errPayload);
      return { success: false, state: currentState, history, error: errPayload };
    }

    // 3-tier configuration merge:
    // Tier 1: Core baseline standards
    // Tier 2: Caller profile rules
    // Tier 3: Runtime ephemeral overrides
    const coreStandards = {
      default_theme: "light",
      required_cdns: ["tailwind", "daisyui", "lucide", "alpinejs"],
      instructions: "Adhere to the responsive DaisyUI sticky navbar contract.",
      reportMode: "report"
    };
    const profileRules = callerInfo.frontmatter || {};
    const runtimeOverrides = {
      theme: theme || null,
      required_cdns: [],
      reportMode: resolvedMode
    };
    mergedConfig = mergeInstructions(coreStandards, profileRules, runtimeOverrides);
  }

  // Output deliverable routing:
  // Standalone mode: defaults to ./report.html
  // Caller mode: defaults to ./report-<leafCallerId>.html
  const resolvedOutput = output
    ? path.resolve(process.cwd(), output)
    : (caller ? getOutputPath(caller) : path.resolve(process.cwd(), "./report.html"));

  const resolvedPdf = pdf
    ? (pdf === true
        ? (caller ? getOutputPaths(caller, resolvedOutput).pdfPath : resolvedOutput.replace(/\.html$/, ".pdf"))
        : path.resolve(process.cwd(), pdf))
    : null;

  let detectedLintIssues = [];
  let autoFixesApplied = [];
  let verificationErrorObj = null;

  function recordRunIfCaller(finalState, finalPayload = null) {
    if (!caller) return null;
    transition(STATES.RECORDING_RUN);
    transition(finalState);
    const durationMs = Math.round(performance.now() - startTime);
    const runData = {
      callerId: caller,
      leafCallerId,
      runId: activeRunId,
      timestamp: new Date().toISOString(),
      status: finalState,
      attempt,
      maxAttempts,
      durationMs,
      outputHtml: resolvedOutput,
      outputPdf: resolvedPdf,
      stateHistory: stateTransitions
    };

    const traceData = {
      attempt,
      status: finalState,
      directives: finalPayload?.instruction_for_agent ? [finalPayload.instruction_for_agent] : [],
      lintIssues: detectedLintIssues,
      autoFixesApplied,
      verificationErrors: verificationErrorObj,
      rawError: finalPayload || null
    };

    const runtimeOverrides = {
      theme: theme || null,
      pdf: pdf || null,
      printable: printable || false,
      mode: mode || "interactive"
    };

    const recordResult = recordHarnessRun(
      caller,
      { run: runData, trace: traceData, overrides: runtimeOverrides },
      { runId: activeRunId }
    );
    return recordResult;
  }

  // 1. Resolve content
  let raw = content;
  let resolvedFilePath = null;
  if (raw === null && file) {
    resolvedFilePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(resolvedFilePath)) {
      const errPayload = {
        status: "FAILED",
        attempt,
        maxAttempts,
        failureType: "FILE_NOT_FOUND",
        instruction_for_agent: `Fragment file not found at: ${resolvedFilePath}. Check file path.`
      };
      if (caller) recordRunIfCaller(STATES.FAILED, errPayload);
      else transition(STATES.FAILED);

      if (json) console.log(JSON.stringify(errPayload, null, 2));
      else printRemediationBanner(errPayload);
      return { success: false, state: currentState, history, error: errPayload };
    }
    raw = fs.readFileSync(resolvedFilePath, "utf-8");
  }

  if (raw === null) {
    const errPayload = {
      status: "FAILED",
      attempt,
      maxAttempts,
      failureType: "MISSING_INPUT",
      instruction_for_agent: "No input fragment provided to harness. Pass a fragment file or content."
    };
    if (caller) recordRunIfCaller(STATES.FAILED, errPayload);
    else transition(STATES.FAILED);

    if (json) console.log(JSON.stringify(errPayload, null, 2));
    else printRemediationBanner(errPayload);
    return { success: false, state: currentState, history, error: errPayload };
  }

  // 2. Validate
  transition(STATES.VALIDATING);
  let lintRes = lintFragment(raw);
  detectedLintIssues = lintRes.issues || [];

  // 3. Auto-fix if invalid & allowed
  if (!lintRes.valid && autoFix) {
    transition(STATES.AUTO_FIXING);
    const fixRes = autoFixFragment(raw);
    autoFixesApplied = fixRes.fixesApplied || [];
    raw = fixRes.content;
    if (resolvedFilePath && fs.existsSync(resolvedFilePath)) {
      try {
        fs.writeFileSync(resolvedFilePath, raw, "utf-8");
      } catch {
        // Non-fatal if read-only
      }
    }
    transition(STATES.VALIDATING);
    lintRes = lintFragment(raw);
    detectedLintIssues = lintRes.issues || [];
  }

  // Check validation outcome
  if (!lintRes.valid) {
    const isTerminal = attempt >= maxAttempts;
    const targetState = isTerminal ? STATES.FAILED : STATES.REMEDIATING;
    const errPayload = formatPrescriptiveDiagnostic(lintRes, attempt, maxAttempts);
    if (caller) {
      errPayload.runId = activeRunId;
      recordRunIfCaller(targetState, errPayload);
    } else {
      transition(targetState);
    }
    if (json) console.log(JSON.stringify(errPayload, null, 2));
    else printRemediationBanner(errPayload);
    return { success: false, state: currentState, history, error: errPayload, runId: activeRunId };
  }

  // 4. Assemble Report
  transition(STATES.ASSEMBLING);
  let assembledHtml = "";
  try {
    const { buildReport } = await import("./build-report.mjs");
    const activeTheme = mergedConfig ? mergedConfig.theme : (theme || null);
    const activeAddons = mergedConfig ? mergedConfig.required_cdns : [];
    const isPrintable = printable || resolvedMode === "print" || (mergedConfig && mergedConfig.reportMode === "print");

    const isPwa = Boolean(pwa);

    const buildRes = buildReport({
      title,
      content: raw,
      mode: resolvedMode,
      printable: isPrintable,
      pwa: isPwa,
      theme: activeTheme,
      addons: activeAddons
    });
    assembledHtml = typeof buildRes === "string" ? buildRes : buildRes.html;

    const outDir = path.dirname(resolvedOutput);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(resolvedOutput, assembledHtml, "utf-8");

    if (buildRes.isPwa && buildRes.pwaConfig) {
      const { generatePwaAssets } = await import("./pwa-builder.mjs");
      generatePwaAssets({
        outputDir: outDir,
        reportFileName: path.basename(resolvedOutput),
        title: buildRes.pwaConfig.title,
        shortName: buildRes.pwaConfig.shortName,
        themeColor: buildRes.pwaConfig.themeColor,
        backgroundColor: buildRes.pwaConfig.backgroundColor,
        emoji: buildRes.pwaConfig.emoji,
        writeFiles: true
      });
    }
  } catch (assembleErr) {
    const isTerminal = attempt >= maxAttempts;
    const targetState = isTerminal ? STATES.FAILED : STATES.REMEDIATING;
    const errPayload = {
      status: isTerminal ? "FAILED" : "REMEDIATION_REQUIRED",
      attempt,
      maxAttempts,
      failureType: "ASSEMBLY_ERROR",
      instruction_for_agent: `Assembly failed: ${assembleErr.message}. Inspect template shell or fragment syntax.`
    };
    if (caller) {
      errPayload.runId = activeRunId;
      recordRunIfCaller(targetState, errPayload);
    } else {
      transition(targetState);
    }
    if (json) console.log(JSON.stringify(errPayload, null, 2));
    else printRemediationBanner(errPayload);
    return { success: false, state: currentState, history, error: errPayload, runId: activeRunId };
  }

  // 5. Verify Report
  if (verify) {
    transition(STATES.VERIFYING);

    let verifyPassed = false;
    let verifyStdout = "";
    let verifyStderr = "";

    if (typeof verifier === "function") {
      const vResult = await verifier({
        htmlPath: resolvedOutput,
        quick,
        mode: resolvedMode,
        caller,
        pdf: resolvedPdf
      });
      verifyPassed = Boolean(vResult.passed);
      verifyStdout = vResult.stdout || "";
      verifyStderr = vResult.stderr || "";
    } else {
      const verifyScript = path.resolve(__dirname, "../playwright/verify-report.mjs");
      const vArgs = [verifyScript, resolvedOutput];
      if (quick) vArgs.push("--quick");
      if (resolvedMode) vArgs.push("--mode", resolvedMode);
      if (caller) vArgs.push("--caller", caller);
      if (resolvedPdf) vArgs.push("--pdf", resolvedPdf);

      const spawnRes = spawnSync(process.execPath, vArgs, {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"]
      });

      verifyPassed = spawnRes.status === 0;
      verifyStdout = spawnRes.stdout || "";
      verifyStderr = spawnRes.stderr || "";
    }

    if (!verifyPassed) {
      const isTerminal = attempt >= maxAttempts;
      const targetState = isTerminal ? STATES.FAILED : STATES.REMEDIATING;
      const parsed = parseVerificationError(verifyStdout, verifyStderr);
      verificationErrorObj = parsed;
      const errPayload = {
        status: isTerminal ? "FAILED" : "REMEDIATION_REQUIRED",
        attempt,
        maxAttempts,
        ...parsed
      };
      if (caller) {
        errPayload.runId = activeRunId;
        recordRunIfCaller(targetState, errPayload);
      } else {
        transition(targetState);
      }
      if (json) console.log(JSON.stringify(errPayload, null, 2));
      else printRemediationBanner(errPayload);
      return { success: false, state: currentState, history, error: errPayload, runId: activeRunId };
    }
  }

  // 6. Record run if caller, then Complete
  if (caller) {
    recordRunIfCaller(STATES.COMPLETED);
  } else {
    transition(STATES.COMPLETED);
  }

  // Dev Server Orchestration according to MODE_SERVER_POLICIES
  let serverInfo = null;
  if (shouldServe) {
    try {
      if (typeof serverRunner === "function") {
        serverInfo = await serverRunner({
          filePath: resolvedOutput,
          port,
          mode: resolvedMode
        });
      } else {
        serverInfo = await ensureDevServerRunning({
          filePath: resolvedOutput,
          port,
          mode: resolvedMode
        });
      }
    } catch (serverErr) {
      console.warn(`[html-report] Server orchestration notice: ${serverErr.message}`);
    }
  }

  const successPayload = {
    status: "COMPLETED",
    output: resolvedOutput,
    pdf: resolvedPdf,
    state: currentState,
    history,
    runId: activeRunId,
    caller: leafCallerId,
    mode: resolvedMode,
    server: serverInfo
  };

  if (json) {
    console.log(JSON.stringify(successPayload, null, 2));
  } else {
    console.log(`\n✔ [HARNESS] Report successfully assembled and verified -> ${resolvedOutput}`);
    if (resolvedPdf) {
      console.log(`✔ [HARNESS] PDF deliverable generated -> ${resolvedPdf}`);
    }
    if (shouldServe && serverInfo) {
      console.log(`✔ [HARNESS] Dev server active on ${serverInfo.url} (${resolvedMode} mode)`);
    } else {
      console.log(`✔ [HARNESS] Standalone deliverable ready (no background server for ${resolvedMode} mode)`);
    }
    if (caller) {
      console.log(`✔ [HARNESS] Run recorded to vault -> .caller-requests/runs/${leafCallerId}/${activeRunId}\n`);
    } else {
      console.log("");
    }
  }

  return {
    success: true,
    state: currentState,
    history,
    output: resolvedOutput,
    pdf: resolvedPdf,
    runId: activeRunId,
    mode: resolvedMode,
    server: serverInfo
  };
}

export const runHarness = runLifecycle;

/**
 * CLI Help text
 */
export function getHelpText() {
  return `
State Machine Harness & Pre-Flight Orchestrator (Zero-Dep Pure Node)

USAGE:
  node harness.mjs <command> [options]

COMMANDS:
  run <fragment.html>       Execute full lifecycle: Validate -> Auto-Fix -> Assemble -> Verify
  lint <fragment.html>      Perform pre-flight semantic linting on fragment
  fix <fragment.html>       Apply deterministic auto-fixes to fragment and output result

OPTIONS:
  --output, -o <file>       Output file destination (default: ./report.html or ./report-<caller>.html)
  --title, -t <title>       Report title (default: "HTML Report")
  --theme <name>            DaisyUI theme override (e.g. "light", "cupcake", "synthwave")
  --run-id <runId>          Run ID for multi-attempt correlation in vault
  --mode, -m <name>         Report mode: print, report, presentation, dashboard, working-report, live-report, pwa
  --print, -p, --printable  Enable printable styles (@media print, static mode)
  --presentation            Enable interactive presentation mode
  --dashboard               Enable interactive dashboard mode
  --working-report          Enable working journey companion mode
  --live-report, -l         Enable real-time live streaming mode
  --pwa                     Enable Progressive Web App mode (manifest, sw.js, and icons)
  --serve                   Force start/check dev server
  --no-serve                Disable dev server regardless of mode policy
  --port <number>           Target dev server port (default: 3000)
  --no-auto-fix             Disable mechanical auto-fix transforms during run/validate
  --no-verify               Skip Playwright responsive & console verification
  --full-verify             Verify across all 5 responsive breakpoints (default: quick 2)
  --attempt <number>        Current retry attempt number (default: 1)
  --max-attempts <number>   Maximum allowed remediation attempts before failure (default: 3)
  --caller <id>             Caller identifier for profile-aware overrides and vault tracking
  --pdf [file.pdf]          Generate on-demand PDF export during verification
  --json                    Output machine-readable JSON diagnostics
  --check-compatibility    Scan project directory for deprecated flags and APIs
  --version, -v             Display semantic version
  --help, -h                Show this help screen
`.trim();
}

/**
 * CLI Argument parser
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const { normalized: rawArgs } = checkDeprecatedCliArgs(argv);
  argv = rawArgs;
  const args = {
    command: "",
    file: "",
    output: null,
    title: "HTML Report",
    theme: null,
    runId: null,
    printable: false,
    autoFix: true,
    verify: true,
    quick: true,
    attempt: 1,
    maxAttempts: 3,
    mode: null,
    serve: null,
    port: 3000,
    caller: null,
    pdf: null,
    json: false,
    pwa: false,
    checkCompatibility: false,
    version: false,
    help: false
  };

  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--version" || arg === "-v") {
      args.version = true;
    } else if (arg === "--check-compatibility" || arg === "--compat") {
      args.checkCompatibility = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--no-auto-fix") {
      args.autoFix = false;
    } else if (arg === "--no-verify") {
      args.verify = false;
    } else if (arg === "--full-verify") {
      args.quick = false;
    } else if (arg === "--print" || arg === "--printable" || arg === "-p") {
      args.printable = true;
      args.mode = "print";
    } else if (arg === "--presentation") {
      args.mode = "presentation";
    } else if (arg === "--dashboard") {
      args.mode = "dashboard";
    } else if (arg === "--working" || arg === "--working-report") {
      args.mode = "working-report";
    } else if (arg === "--live" || arg === "--live-report" || arg === "-l") {
      args.mode = "live-report";
    } else if (arg === "--pwa") {
      args.mode = "pwa";
      args.pwa = true;
    } else if (arg === "--serve") {
      args.serve = true;
    } else if (arg === "--no-serve") {
      args.serve = false;
    } else if ((arg === "--port") && argv[i + 1]) {
      args.port = parseInt(argv[++i], 10) || 3000;
    } else if ((arg === "--output" || arg === "-o") && argv[i + 1]) {
      args.output = argv[++i];
    } else if ((arg === "--title" || arg === "-t") && argv[i + 1]) {
      args.title = argv[++i];
    } else if (arg === "--theme" && argv[i + 1]) {
      args.theme = argv[++i];
    } else if (arg === "--run-id" && argv[i + 1]) {
      args.runId = argv[++i];
    } else if (arg === "--attempt" && argv[i + 1]) {
      args.attempt = parseInt(argv[++i], 10) || 1;
    } else if (arg === "--max-attempts" && argv[i + 1]) {
      args.maxAttempts = parseInt(argv[++i], 10) || 3;
    } else if ((arg === "--mode" || arg === "-m") && argv[i + 1]) {
      args.mode = argv[++i];
    } else if (arg === "--caller" && argv[i + 1]) {
      args.caller = argv[++i];
    } else if (arg === "--pdf" && argv[i + 1] && !argv[i + 1].startsWith("-")) {
      args.pdf = argv[++i];
    } else if (arg === "--pdf") {
      args.pdf = true;
    } else if (arg.startsWith("-")) {
      // Ignored unrecognized flags
    } else {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    if (["run", "lint", "fix", "compat", "check-compatibility"].includes(positional[0])) {
      args.command = positional[0] === "check-compatibility" ? "compat" : positional[0];
      args.file = positional[1] || "";
    } else {
      args.command = "run";
      args.file = positional[0];
    }
  }

  return args;
}

/**
 * CLI Entry point
 */
export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);

  if (args.version) {
    console.log(formatVersionString());
    process.exit(0);
  }

  if (args.checkCompatibility || args.command === "compat") {
    const targetDir = args.file ? path.resolve(process.cwd(), args.file) : process.cwd();
    console.log(`\n🔍 Auditing codebase compatibility for html-report in: ${targetDir}`);
    const report = checkCompatibility(targetDir);
    console.log(`   Scanned ${report.scannedFilesCount} files.`);
    if (report.findings.length === 0) {
      console.log(`\x1b[32m✔ 100% Compatible with html-report v${report.currentVersion} (SemVer ${report.semverSpec})\x1b[0m\n`);
      process.exit(0);
    } else {
      console.log(`\x1b[33m⚠️ Found ${report.findings.length} compatibility issue(s):\x1b[0m`);
      for (const f of report.findings) {
        console.log(`   - [${f.type}] ${f.file}:${f.line} -> '${f.match}' (Replace with: '${f.replacement}')`);
      }
      console.log(`\n📖 Refer to MIGRATION.md or run an AI Refactor Prompt.\n`);
      process.exit(0);
    }
  }

  if (args.help || (!args.command && !args.file)) {
    console.log(getHelpText());
    process.exit(0);
  }

  if (!args.file) {
    console.error("Error: Missing required fragment file path.");
    console.log(getHelpText());
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: Fragment file not found: ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, "utf-8");

  if (args.command === "lint") {
    const lintRes = lintFragment(raw);
    if (args.json) {
      if (!lintRes.valid) {
        console.log(JSON.stringify(formatPrescriptiveDiagnostic(lintRes, args.attempt, args.maxAttempts), null, 2));
        process.exit(1);
      }
      console.log(JSON.stringify({ status: "VALID", valid: true, issues: [] }, null, 2));
      process.exit(0);
    } else {
      if (lintRes.valid) {
        console.log("✓ Pre-flight validation passed: 0 issues found.");
        process.exit(0);
      } else {
        printRemediationBanner(formatPrescriptiveDiagnostic(lintRes, args.attempt, args.maxAttempts));
        process.exit(1);
      }
    }
  }

  if (args.command === "fix") {
    const fixRes = autoFixFragment(raw);
    if (args.output && args.output !== "./report.html") {
      const outPath = path.resolve(process.cwd(), args.output);
      fs.writeFileSync(outPath, fixRes.content, "utf-8");
      console.log(`✓ Auto-fixes applied (${fixRes.fixesApplied.length} transforms) -> Written to: ${outPath}`);
    } else {
      if (args.json) {
        console.log(JSON.stringify(fixRes, null, 2));
      } else {
        process.stdout.write(fixRes.content);
      }
    }
    process.exit(0);
  }

  if (args.command === "run") {
    const runResult = await runLifecycle({
      file: args.file,
      output: args.output,
      title: args.title,
      theme: args.theme,
      runId: args.runId,
      printable: args.printable,
      autoFix: args.autoFix,
      verify: args.verify,
      quick: args.quick,
      mode: args.mode,
      serve: args.serve,
      port: args.port,
      caller: args.caller,
      pdf: args.pdf,
      pwa: args.pwa,
      attempt: args.attempt,
      maxAttempts: args.maxAttempts,
      json: args.json
    });

    if (!runResult.success) {
      process.exit(1);
    }
    process.exit(0);
  }
}

// Direct execution guard
const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedFile === currentFile) {
  main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
