#!/usr/bin/env node

/**
 * packages/core/scripts/harness.mjs
 *
 * Deterministic Finite State Machine (FSM) CLI Harness and Remediation Orchestrator.
 * Zero external runtime dependencies - pure Node.js standard library built-ins.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
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
import { isDirectCliExecution } from "./env.mjs";
import {
  MODE_SERVER_POLICIES,
  STATES,
  isPortActive,
  ensureDevServerRunning
} from "./lib/harness/server-policy.mjs";
import {
  slugify,
  collectExistingIds,
  generateUniqueId,
  lintFragment,
  stripOuterBoilerplate,
  injectHeadingIds,
  wrapBareTables,
  normalizeResponsiveSteppers,
  wrapBareCanvases,
  autoFixFragment
} from "./lib/harness/fragment-linter.mjs";
import {
  parseVerificationError,
  formatPrescriptiveDiagnostic,
  printRemediationBanner
} from "./lib/harness/diagnostics.mjs";
import {
  getHelpText,
  parseArgs,
  runHarnessCli
} from "./lib/harness/cli.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

export {
  CANONICAL_MODES,
  MODE_ALIASES,
  normalizeMode,
  MODE_SERVER_POLICIES,
  STATES,
  isPortActive,
  ensureDevServerRunning,
  slugify,
  collectExistingIds,
  generateUniqueId,
  lintFragment,
  stripOuterBoilerplate,
  injectHeadingIds,
  wrapBareTables,
  normalizeResponsiveSteppers,
  wrapBareCanvases,
  autoFixFragment,
  parseVerificationError,
  formatPrescriptiveDiagnostic,
  printRemediationBanner,
  getHelpText,
  parseArgs
};

/**
 * Deterministic Pure-Node Finite State Machine Lifecycle Runner.
 * Standalone Mode: IDLE -> VALIDATING -> AUTO_FIXING -> ASSEMBLING -> VERIFYING -> COMPLETED / REMEDIATING / FAILED
 * Caller-Aware Mode: IDLE -> RESOLVING_CALLER -> VALIDATING -> AUTO_FIXING -> ASSEMBLING -> VERIFYING -> RECORDING_RUN -> COMPLETED / REMEDIATING / FAILED
 */
export async function runLifecycle({
  file,
  project = null,
  content = null,
  output = null,
  title = "HTML Report",
  theme = null,
  runId = null,
  printable = false,
  autoFix = true,
  verify = true,
  fast = false,
  quick = true,
  mode = null,
  serve = null,
  port = 3031,
  ai = null,
  aiLocal = null,
  aiPort = null,
  caller = null,
  pdf = null,
  pwa = false,
  editable = true,
  published = false,
  authoringPlugin = null,
  attempt = 1,
  maxAttempts = 3,
  json = false,
  onStateChange = null,
  verifier = null,
  serverRunner = null
} = {}) {
  const startTime = performance.now();
  let currentState = STATES.IDLE;
  const history = [currentState];
  const stateTransitions = [];

  if (fast) verify = false;

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

  function emitError(errPayload) {
    if (json) console.log(JSON.stringify(errPayload, null, 2));
    else printRemediationBanner(errPayload);
  }

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
    emitError(errPayload);
    return { success: false, state: currentState, history, error: errPayload };
  }

  if (!resolvedMode) {
    resolvedMode = printable ? "print" : "report";
  }

  const serverPolicy = MODE_SERVER_POLICIES[resolvedMode] || { requiresServer: false, defaultAction: "open_static" };
  const shouldServe = fast ? false : (serve !== null ? Boolean(serve) : serverPolicy.requiresServer);

  let siblingManifest = null;
  let inferredProjectSlug = project
    ? String(project)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : null;
  if (!file && inferredProjectSlug && content === null) {
    file = path.join("projects", inferredProjectSlug, "fragment.html");
  }
  if (file) {
    const normFile = String(file).replace(/\\/g, "/");
    const projMatch = normFile.match(/(?:^|\/)projects\/([a-z0-9-]+)\//i);
    if (projMatch && !inferredProjectSlug) inferredProjectSlug = projMatch[1].toLowerCase();
  }
  if (file && content === null) {
    const absInput = path.resolve(process.cwd(), file);
    const candidateManifest = path.join(path.dirname(absInput), "report.manifest.json");
    if (fs.existsSync(candidateManifest)) {
      try {
        siblingManifest = JSON.parse(fs.readFileSync(candidateManifest, "utf-8"));
        if (!mode && siblingManifest.mode) {
          const manifestMode = normalizeMode(siblingManifest.mode);
          if (manifestMode) resolvedMode = manifestMode;
        }
      } catch (_) {
        siblingManifest = null;
      }
    }
  }

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
      emitError(errPayload);
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
      emitError(errPayload);
      return { success: false, state: currentState, history, error: errPayload };
    }

    const coreStandards = {
      default_theme: "light",
      required_cdns: ["tailwind", "daisyui", "lucide", "alpinejs"],
      instructions: "Adhere to the responsive DaisyUI sticky navbar contract.",
      reportMode: "report"
    };
    mergedConfig = mergeInstructions(coreStandards, callerInfo.frontmatter || {}, {
      theme: theme || null,
      required_cdns: [],
      reportMode: resolvedMode
    });
  }

  let resolvedOutput = output
    ? path.resolve(process.cwd(), output)
    : ((siblingManifest || inferredProjectSlug) && file
        ? path.join(path.dirname(path.resolve(process.cwd(), file)), published ? "published.html" : "index.html")
        : (caller ? getOutputPath(caller) : path.resolve(process.cwd(), "./report.html")));

  const repoRootReportHtml = path.resolve(REPO_ROOT, "report.html");
  const isCanonicalShowcase = file && String(file).replace(/\\/g, "/").endsWith("examples/dev/landing-fragment.html");
  if (resolvedOutput === repoRootReportHtml && !isCanonicalShowcase) {
    const fallbackSlug =
      inferredProjectSlug ||
      siblingManifest?.project ||
      (title && title !== "HTML Report" ? slugify(title) : "") ||
      (file ? slugify(path.basename(file, path.extname(file)).replace(/(?:^|-)fragment$/i, "")) : "") ||
      "report";
    inferredProjectSlug = fallbackSlug;
    resolvedOutput = path.join(REPO_ROOT, "projects", fallbackSlug, "index.html");
  }

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
    return recordHarnessRun(
      caller,
      {
        run: {
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
        },
        trace: {
          attempt,
          status: finalState,
          directives: finalPayload?.instruction_for_agent ? [finalPayload.instruction_for_agent] : [],
          lintIssues: detectedLintIssues,
          autoFixesApplied,
          verificationErrors: verificationErrorObj,
          rawError: finalPayload || null
        },
        overrides: {
          theme: theme || null,
          pdf: pdf || null,
          printable: printable || false,
          mode: mode || "interactive"
        }
      },
      { runId: activeRunId }
    );
  }

  function failOrRemediate(targetState, errPayload) {
    if (caller) {
      errPayload.runId = activeRunId;
      recordRunIfCaller(targetState, errPayload);
    } else {
      transition(targetState);
    }
    emitError(errPayload);
    return { success: false, state: currentState, history, error: errPayload, runId: activeRunId };
  }

  // 1. Resolve content
  let raw = content;
  let resolvedFilePath = null;
  if (raw === null && file) {
    resolvedFilePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(resolvedFilePath)) {
      return failOrRemediate(STATES.FAILED, {
        status: "FAILED",
        attempt,
        maxAttempts,
        failureType: "FILE_NOT_FOUND",
        instruction_for_agent: `Fragment file not found at: ${resolvedFilePath}. Check file path.`
      });
    }
    raw = fs.readFileSync(resolvedFilePath, "utf-8");
  }

  if (raw === null) {
    return failOrRemediate(STATES.FAILED, {
      status: "FAILED",
      attempt,
      maxAttempts,
      failureType: "MISSING_INPUT",
      instruction_for_agent: "No input fragment provided to harness. Pass a fragment file or content."
    });
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
      } catch {}
    }
    transition(STATES.VALIDATING);
    lintRes = lintFragment(raw);
    detectedLintIssues = lintRes.issues || [];
  }

  if (!lintRes.valid) {
    const targetState = attempt >= maxAttempts ? STATES.FAILED : STATES.REMEDIATING;
    return failOrRemediate(targetState, formatPrescriptiveDiagnostic(lintRes, attempt, maxAttempts));
  }

  // 4. Assemble Report
  transition(STATES.ASSEMBLING);
  let assembledHtml = "";
  try {
    const { buildReport } = await import("./build-report.mjs");
    const activeTheme = mergedConfig ? mergedConfig.theme : (theme || siblingManifest?.theme || null);
    const activeAddons = mergedConfig ? mergedConfig.required_cdns : (Array.isArray(siblingManifest?.activeAddons) ? siblingManifest.activeAddons : []);
    const isPrintable = printable || resolvedMode === "print" || (mergedConfig && mergedConfig.reportMode === "print");
    const effectiveTitle = (title === "HTML Report" && siblingManifest?.title) ? siblingManifest.title : title;
    const isPwa = Boolean(pwa || siblingManifest?.pwa);

    const activeProject = inferredProjectSlug || siblingManifest?.project || null;
    const resolvedAi = ai !== null ? Boolean(ai) : Boolean(siblingManifest?.aiBridge);
    const resolvedAiLocal = aiLocal !== null ? Boolean(aiLocal) : Boolean(siblingManifest?.aiConfig?.local);
    const resolvedAiPort = (aiPort !== null && Number.isFinite(Number(aiPort)) && Number(aiPort) > 0)
      ? Number(aiPort)
      : (siblingManifest?.aiConfig?.port || 3031);
    const buildRes = buildReport({
      title: effectiveTitle,
      content: raw,
      project: activeProject,
      contentPath: siblingManifest?.files?.fragment || file || null,
      mode: resolvedMode,
      printable: isPrintable,
      pwa: isPwa,
      theme: activeTheme,
      customTheme: siblingManifest?.customTheme || null,
      favicon: siblingManifest?.favicon || "📊",
      addons: activeAddons,
      ai: resolvedAi,
      aiLocal: resolvedAiLocal,
      aiPort: resolvedAiPort,
      aiModel: siblingManifest?.aiConfig?.model || "Gemini 3.8 Flash (Low)",
      aiPersona: siblingManifest?.aiConfig?.persona || "analyst",
      aiPurpose: siblingManifest?.aiConfig?.purpose || "",
      aiDock: siblingManifest?.aiConfig?.floatingAssistant ?? true,
      editable: Boolean(editable && !published),
      published: Boolean(published),
      authoringPlugin,
      source: siblingManifest?.files?.entry || (activeProject ? `projects/${activeProject}/${published ? "published.html" : "index.html"}` : null)
    });
    assembledHtml = typeof buildRes === "string" ? buildRes : buildRes.html;

    const outDir = path.dirname(resolvedOutput);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(resolvedOutput, assembledHtml, "utf-8");

    if (activeProject && !published && buildRes.agentManifest) {
      const manifestPath = path.join(outDir, "report.manifest.json");
      const preservedFields = {};
      for (const k of ["servingMode", "behavioralMode", "starterFragmentHash", "presetWidgets", "referenceFiles", "customTheme", "audience", "goals"]) {
        if (siblingManifest && siblingManifest[k] !== undefined) preservedFields[k] = siblingManifest[k];
      }
      const nextManifest = { ...buildRes.agentManifest, ...preservedFields };
      fs.writeFileSync(manifestPath, JSON.stringify(nextManifest, null, 2) + "\n", "utf-8");
    }

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
    return failOrRemediate(isTerminal ? STATES.FAILED : STATES.REMEDIATING, {
      status: isTerminal ? "FAILED" : "REMEDIATION_REQUIRED",
      attempt,
      maxAttempts,
      failureType: "ASSEMBLY_ERROR",
      instruction_for_agent: `Assembly failed: ${assembleErr.message}. Inspect template shell or fragment syntax.`
    });
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
      const parsed = parseVerificationError(verifyStdout, verifyStderr);
      verificationErrorObj = parsed;
      return failOrRemediate(isTerminal ? STATES.FAILED : STATES.REMEDIATING, {
        status: isTerminal ? "FAILED" : "REMEDIATION_REQUIRED",
        attempt,
        maxAttempts,
        ...parsed
      });
    }
  }

  // 6. Record run if caller, then Complete
  if (caller) recordRunIfCaller(STATES.COMPLETED);
  else transition(STATES.COMPLETED);

  let serverInfo = null;
  if (shouldServe) {
    try {
      if (typeof serverRunner === "function") {
        serverInfo = await serverRunner({ filePath: resolvedOutput, port, mode: resolvedMode });
      } else {
        serverInfo = await ensureDevServerRunning({ filePath: resolvedOutput, port, mode: resolvedMode });
      }
    } catch (serverErr) {
      console.warn(`[html-report] Server orchestration notice: ${serverErr.message}`);
    }
  }

  const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
  const successPayload = {
    status: "COMPLETED",
    fast: Boolean(fast),
    durationMs,
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
    console.log(
      fast
        ? `\n✔ [HARNESS] Fast static verification passed (${durationMs}ms) -> ${resolvedOutput}`
        : `\n✔ [HARNESS] Report successfully assembled and verified -> ${resolvedOutput}`
    );
    if (resolvedPdf) console.log(`✔ [HARNESS] PDF deliverable generated -> ${resolvedPdf}`);
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
    fast: Boolean(fast),
    durationMs,
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

export async function main(argv = process.argv.slice(2)) {
  return runHarnessCli(argv, { runLifecycle });
}

if (isDirectCliExecution(process.argv[1], import.meta.url)) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
