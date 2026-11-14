#!/usr/bin/env node
/**
 * preflight.mjs
 * Fast, deterministic pre-authoring environment & AI provider preflight utility
 * for html-report. Also provides shared symlink-safe CLI detection, browser
 * fallback discovery, and the AgentInferenceRouter used by serve-report.mjs.
 */

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { execFile, spawnSync } from "node:child_process";
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
 * Resolves the canonical skill root directory (skills/html-report) and determines
 * whether the target workspace has a local skills/html-report/ directory.
 */
export function resolveSkillPaths(workspaceRoot = process.cwd()) {
  const rawSkillRoot = path.resolve(__dirname, "..");
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

/**
 * Checks whether a TCP port is free to bind on 127.0.0.1 / :: / default interface.
 */
export function checkPortAvailable(port, host = undefined) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", () => resolve(false));
    const listenArgs = host ? [port, host] : [port];
    srv.listen(...listenArgs, () => {
      srv.close(() => resolve(true));
    });
  });
}

/**
 * Probes primary (3031), secondary (3032), and fallback ports (3033..3039).
 */
export async function probePorts(primaryPort = DEFAULT_PRIMARY_PORT, secondaryPort = DEFAULT_SECONDARY_PORT) {
  const candidates = [primaryPort, secondaryPort];
  for (let p = 3033; p <= 3039; p++) {
    if (!candidates.includes(p)) candidates.push(p);
  }

  const availability = {};
  let recommendedPort = null;

  for (const p of candidates) {
    const free = await checkPortAvailable(p);
    availability[p] = free;
    if (free && recommendedPort === null) {
      recommendedPort = p;
    }
  }

  return {
    primaryPort,
    primaryAvailable: Boolean(availability[primaryPort]),
    secondaryPort,
    fallbackPort: secondaryPort,
    secondaryAvailable: Boolean(availability[secondaryPort]),
    recommendedPort: recommendedPort || primaryPort,
    availability
  };
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

  // Fallback PATH lookup on POSIX
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
 * Supported CLI and HTTP AI provider definitions for AgentInferenceRouter.
 */
export const SUPPORTED_CLI_PROVIDERS = [
  {
    id: "claude",
    name: "Claude Code CLI",
    bin: "claude",
    buildArgs: ({ prompt }) => ["-p", prompt]
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    bin: "gemini",
    buildArgs: ({ prompt }) => ["-p", prompt]
  },
  {
    id: "codex",
    name: "OpenAI Codex CLI",
    bin: "codex",
    buildArgs: ({ prompt }) => ["exec", prompt]
  },
  {
    id: "opencode",
    name: "OpenCode CLI",
    bin: "opencode",
    buildArgs: ({ prompt }) => ["run", prompt]
  },
  {
    id: "agy",
    name: "Google Antigravity CLI",
    bin: "agy",
    buildArgs: ({ prompt, model }) => (model ? ["--model", model, "-p", prompt] : ["-p", prompt])
  },
  {
    id: "ollama",
    name: "Ollama CLI",
    bin: "ollama",
    buildArgs: ({ prompt, model }) => ["run", model && !model.includes(" ") ? model : "llama3.2", prompt]
  }
];

/**
 * AgentInferenceRouter
 * Agent-agnostic Turnkey AI Bridge router supporting CLI harnesses and HTTP LLM APIs.
 */
export class AgentInferenceRouter {
  static _checkProviderAuthenticated(id, env = process.env) {
    try {
      const home = os.homedir();
      switch (id) {
        case "custom-cmd":
        case "http-custom":
        case "ollama":
          return true;
        case "openai-http":
          return Boolean(env.OPENAI_API_KEY);
        case "anthropic-http":
          return Boolean(env.ANTHROPIC_API_KEY);
        case "gemini-http":
          return Boolean(env.GEMINI_API_KEY);
        case "codex":
          return Boolean(
            env.OPENAI_API_KEY ||
            fs.existsSync(path.join(home, ".codex", "auth.json")) ||
            fs.existsSync(path.join(home, ".codex", "config.toml"))
          );
        case "claude":
          return Boolean(
            env.ANTHROPIC_API_KEY ||
            fs.existsSync(path.join(home, ".claude.json")) ||
            fs.existsSync(path.join(home, ".claude"))
          );
        case "gemini":
          return Boolean(
            env.GEMINI_API_KEY ||
            fs.existsSync(path.join(home, ".gemini")) ||
            fs.existsSync(path.join(home, ".config", "gcloud"))
          );
        case "agy":
          return Boolean(
            env.GEMINI_API_KEY ||
            env.GOOGLE_API_KEY ||
            fs.existsSync(path.join(home, ".gemini", "antigravity-cli")) ||
            fs.existsSync(path.join(home, ".config", "antigravity"))
          );
        case "opencode":
          return Boolean(
            env.OPENAI_API_KEY ||
            env.ANTHROPIC_API_KEY ||
            fs.existsSync(path.join(home, ".config", "opencode")) ||
            fs.existsSync(path.join(home, ".local", "share", "opencode"))
          );
        default:
          return false;
      }
    } catch (_) {
      return false;
    }
  }

  static detectProviders(options = {}) {
    const env = options.env || process.env;
    const envPath = options.envPath !== undefined ? options.envPath : (env.PATH || "");
    const preferredProvider = (options.provider || env.HTML_REPORT_AI_PROVIDER || "").trim().toLowerCase();
    const customCmd = (options.aiCmd || env.HTML_REPORT_AI_CMD || "").trim();
    const checkedProviders = [];
    const available = [];

    // 1. Custom CLI command override
    checkedProviders.push("custom-cmd");
    if (customCmd) {
      available.push({
        id: "custom-cmd",
        type: "cli-custom",
        name: `Custom Command (${customCmd.split(/\s+/)[0]})`,
        command: customCmd,
        installed: true,
        authenticated: true
      });
    }

    // 2. Direct HTTP API endpoints
    checkedProviders.push("http-custom", "openai-http", "anthropic-http", "gemini-http");
    if (env.HTML_REPORT_AI_URL) {
      available.push({
        id: "http-custom",
        type: "http",
        name: "Custom HTTP LLM Endpoint",
        url: env.HTML_REPORT_AI_URL,
        installed: true,
        authenticated: true
      });
    }
    if (env.OPENAI_API_KEY) {
      available.push({
        id: "openai-http",
        type: "http",
        name: "OpenAI HTTP API",
        url: "https://api.openai.com/v1/chat/completions",
        installed: true,
        authenticated: true
      });
    }
    if (env.ANTHROPIC_API_KEY) {
      available.push({
        id: "anthropic-http",
        type: "http",
        name: "Anthropic Messages API",
        url: "https://api.anthropic.com/v1/messages",
        installed: true,
        authenticated: true
      });
    }
    if (env.GEMINI_API_KEY) {
      available.push({
        id: "gemini-http",
        type: "http",
        name: "Google Gemini HTTP API",
        url: "https://generativelanguage.googleapis.com/v1beta/models",
        installed: true,
        authenticated: true
      });
    }

    // 3. Installed CLI harnesses on PATH
    const disabledClis = String(env.HTML_REPORT_DISABLE_AI_CLIS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    for (const def of SUPPORTED_CLI_PROVIDERS) {
      checkedProviders.push(def.id);
      if (disabledClis.includes("all") || disabledClis.includes(def.id)) continue;
      const binPath = findExecutableOnPath(def.bin, envPath);
      if (binPath) {
        available.push({
          id: def.id,
          type: "cli",
          name: def.name,
          bin: def.bin,
          binPath,
          buildArgs: def.buildArgs,
          installed: true,
          authenticated: AgentInferenceRouter._checkProviderAuthenticated(def.id, env)
        });
      }
    }

    let activeProvider = null;
    if (preferredProvider) {
      activeProvider = available.find((p) => p.id === preferredProvider || p.bin === preferredProvider) || null;
    } else if (available.length > 0) {
      activeProvider = available.find((p) => p.authenticated) || available[0];
    }

    return {
      installed: Boolean(activeProvider),
      authenticated: activeProvider ? Boolean(activeProvider.authenticated) : false,
      inferenceVerified: false,
      providerAvailable: Boolean(activeProvider),
      activeProvider: activeProvider ? activeProvider.id : null,
      activeProviderName: activeProvider ? activeProvider.name : null,
      checkedProviders,
      availableProviders: available.map((p) => ({
        id: p.id,
        type: p.type,
        name: p.name,
        installed: true,
        authenticated: Boolean(p.authenticated),
        ...(p.binPath ? { binPath: p.binPath } : {})
      })),
      _resolvedActive: activeProvider
    };
  }

  /**
   * Executes a tiny bounded smoke request to verify end-to-end provider authentication and inference.
   */
  static async verifyInference(options = {}) {
    const detected = AgentInferenceRouter.detectProviders(options);
    if (!detected.providerAvailable) {
      return {
        ...detected,
        installed: false,
        authenticated: false,
        inferenceVerified: false,
        verificationError: "No AI provider installed."
      };
    }
    const startMs = Date.now();
    const res = await AgentInferenceRouter.dispatch(
      {
        prompt: options.probePrompt || "Reply with the single word OK.",
        timeoutMs: options.timeoutMs || 8000,
        provider: options.provider || detected.activeProvider
      },
      options
    );
    const latencyMs = Date.now() - startMs;
    return {
      ...detected,
      installed: true,
      authenticated: res.ok ? true : detected.authenticated,
      inferenceVerified: Boolean(res.ok),
      latencyMs,
      ...(res.ok
        ? { sampleOutput: String(res.text || "").slice(0, 80) }
        : { verificationError: res.error || res.reason || "Inference probe failed." })
    };
  }

  /**
   * Dispatches a prompt through the resolved provider (CLI or HTTP).
   * Rejects with a structured error if no provider is available or execution fails.
   */
  static async dispatch(arg1 = {}, arg2 = {}) {
    const merged = { ...(arg1 || {}), ...(arg2 || {}) };
    const {
      prompt,
      systemPrompt = "",
      model = "Gemini 3.8 Flash (Low)",
      provider = null,
      aiCmd = null,
      timeoutMs = 20000,
      env = process.env,
      envPath = undefined,
      throwOnError = false
    } = merged;
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : String(prompt || "");
    const detection = AgentInferenceRouter.detectProviders({ provider, aiCmd, env, envPath });
    const target = detection._resolvedActive;

    const fail = (err) => {
      if (throwOnError) throw err;
      return {
        ok: false,
        status: "error",
        code: err.code || "inference_unavailable",
        error: err.message,
        reason: err.reason || err.message,
        provider: err.provider || null,
        preflight: err.preflight || detection
      };
    };

    if (!target) {
      const err = new Error(
        `No AI inference provider is available (checked: ${detection.checkedProviders.join(", ")}).`
      );
      err.code = "inference_unavailable";
      err.preflight = detection;
      return fail(err);
    }

    if (target.type === "cli-custom") {
      try {
        const res = await new Promise((resolve, reject) => {
          const tokens = (target.command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [])
            .map((t) => t.replace(/^["']|["']$/g, ""));
          const cmd = tokens[0];
          const baseArgs = tokens.slice(1);
          const child = execFile(cmd, [...baseArgs, fullPrompt], { timeout: timeoutMs, env }, (err, stdout, stderr) => {
            if (err) {
              const wrapped = new Error(`Custom AI command '${cmd}' failed: ${err.message}`);
              wrapped.code = "inference_unavailable";
              wrapped.reason = stderr ? String(stderr).trim() || err.message : err.message;
              wrapped.provider = target.id;
              wrapped.preflight = detection;
              return reject(wrapped);
            }
            const text = String(stdout || "").trim().replace(/^["']|["']$/g, "");
            if (!text) {
              const emptyErr = new Error(`Custom AI command '${cmd}' returned empty output.`);
              emptyErr.code = "inference_unavailable";
              emptyErr.provider = target.id;
              emptyErr.preflight = detection;
              return reject(emptyErr);
            }
            resolve({ ok: true, text, result: text, provider: target.id, providerName: target.name });
          });
          if (child && child.stdin) {
            try { child.stdin.end(); } catch (_) {}
          }
        });
        return res;
      } catch (err) {
        return fail(err);
      }
    }

    if (target.type === "cli") {
      try {
        const res = await new Promise((resolve, reject) => {
          const args = target.buildArgs({ prompt: fullPrompt, model });
          const child = execFile(target.binPath || target.bin, args, { timeout: timeoutMs, env }, (err, stdout, stderr) => {
            if (err) {
              const wrapped = new Error(`AI CLI provider '${target.id}' failed: ${err.message}`);
              wrapped.code = "inference_unavailable";
              wrapped.reason = stderr ? String(stderr).trim() || err.message : err.message;
              wrapped.provider = target.id;
              wrapped.preflight = detection;
              return reject(wrapped);
            }
            const text = String(stdout || "").trim().replace(/^["']|["']$/g, "");
            if (!text) {
              const emptyErr = new Error(`AI CLI provider '${target.id}' returned empty output.`);
              emptyErr.code = "inference_unavailable";
              emptyErr.provider = target.id;
              emptyErr.preflight = detection;
              return reject(emptyErr);
            }
            resolve({ ok: true, text, result: text, provider: target.id, providerName: target.name });
          });
          if (child && child.stdin) {
            try { child.stdin.end(); } catch (_) {}
          }
        });
        return res;
      } catch (err) {
        return fail(err);
      }
    }

    if (target.type === "http") {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let res;
        if (target.id === "http-custom" || target.id === "openai-http") {
          const headers = { "Content-Type": "application/json" };
          if (env.OPENAI_API_KEY) headers.Authorization = `Bearer ${env.OPENAI_API_KEY}`;
          res = await fetch(target.url, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: model && !model.includes(" ") ? model : "gpt-4o-mini",
              messages: [
                ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
                { role: "user", content: String(prompt || "") }
              ]
            }),
            signal: controller.signal
          });
        } else if (target.id === "anthropic-http") {
          res = await fetch(target.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": env.ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: "claude-3-5-haiku-latest",
              max_tokens: 512,
              system: systemPrompt || undefined,
              messages: [{ role: "user", content: String(prompt || "") }]
            }),
            signal: controller.signal
          });
        } else {
          const geminiUrl = `${target.url}/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`;
          res = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }]
            }),
            signal: controller.signal
          });
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} from ${target.name}`);
        }
        const data = await res.json();
        const text =
          data.result ||
          data.text ||
          data.choices?.[0]?.message?.content ||
          data.content?.[0]?.text ||
          data.candidates?.[0]?.content?.parts?.[0]?.text ||
          "";
        const trimmed = String(text).trim();
        if (!trimmed) {
          throw new Error(`Empty response payload from ${target.name}`);
        }
        return { ok: true, text: trimmed, result: trimmed, provider: target.id, providerName: target.name };
      } catch (err) {
        const wrapped = new Error(`HTTP AI provider '${target.id}' failed: ${err.message}`);
        wrapped.code = "inference_unavailable";
        wrapped.reason = err.message;
        wrapped.provider = target.id;
        wrapped.preflight = detection;
        return fail(wrapped);
      } finally {
        clearTimeout(timer);
      }
    }

    const unknownErr = new Error(`Unsupported provider type: ${target.type}`);
    unknownErr.code = "inference_unavailable";
    return fail(unknownErr);
  }
}

/**
 * Executes a full environment preflight check.
 */
export async function runPreflight(options = {}) {
  const primaryPort = Number(options.port) || DEFAULT_PRIMARY_PORT;
  const secondaryPort = Number(options.fallbackPort) || DEFAULT_SECONDARY_PORT;
  const workspaceRoot = options.workspaceRoot || process.cwd();

  const skillPaths = resolveSkillPaths(workspaceRoot);
  const ports = await probePorts(primaryPort, secondaryPort);
  const browser = await detectBrowserReadiness();
  const ai = options.verifyAi
    ? await AgentInferenceRouter.verifyInference(options)
    : AgentInferenceRouter.detectProviders(options);

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    skillRoot: skillPaths.skillRoot,
    isMonorepoLocal: skillPaths.isMonorepoLocal,
    skillPaths,
    paths: skillPaths,
    ports: {
      [primaryPort]: ports.primaryAvailable,
      [secondaryPort]: ports.secondaryAvailable,
      primaryPort: ports.primaryPort,
      primaryAvailable: ports.primaryAvailable,
      secondaryPort: ports.secondaryPort,
      secondaryAvailable: ports.secondaryAvailable,
      recommendedPort: ports.recommendedPort,
      availability: ports.availability
    },
    browser,
    ai: {
      installed: ai.installed,
      authenticated: ai.authenticated,
      inferenceVerified: Boolean(ai.inferenceVerified),
      providerAvailable: ai.providerAvailable,
      activeProvider: ai.activeProvider,
      activeProviderName: ai.activeProviderName,
      checkedProviders: ai.checkedProviders,
      availableProviders: ai.availableProviders,
      ...(ai.latencyMs !== undefined ? { latencyMs: ai.latencyMs } : {}),
      ...(ai.verificationError ? { verificationError: ai.verificationError } : {})
    }
  };
}

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    port: DEFAULT_PRIMARY_PORT,
    fallbackPort: DEFAULT_SECONDARY_PORT,
    verifyAi: false,
    json: false,
    help: false
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json") opts.json = true;
    else if (arg === "--verify-ai" || arg === "--probe-ai") opts.verifyAi = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if ((arg === "--port" || arg === "-p") && args[i + 1]) {
      opts.port = Number(args[++i]) || DEFAULT_PRIMARY_PORT;
    } else if (arg === "--fallback-port" && args[i + 1]) {
      opts.fallbackPort = Number(args[++i]) || DEFAULT_SECONDARY_PORT;
    }
  }
  return opts;
}

if (isDirectCliExecution(process.argv[1], import.meta.url)) {
  const opts = parseCliArgs(process.argv);
  if (opts.help) {
    console.log(`
html-report Pre-Authoring Environment Preflight CLI (preflight.mjs)

Usage:
  node skills/html-report/scripts/preflight.mjs [--port 3031] [--fallback-port 3032] [--json]
`);
    process.exit(0);
  }

  runPreflight(opts)
    .then((report) => {
      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(`[html-report] Environment Preflight:`);
        console.log(`  Skill Root:       ${report.skillRoot} (${report.isMonorepoLocal ? "repo-local" : "external install"})`);
        console.log(`  Primary Port:     ${report.ports.primaryPort} (${report.ports.primaryAvailable ? "FREE" : "OCCUPIED"})`);
        console.log(`  Secondary Port:   ${report.ports.secondaryPort} (${report.ports.secondaryAvailable ? "FREE" : "OCCUPIED"})`);
        console.log(`  Recommended Port: ${report.ports.recommendedPort}`);
        console.log(`  Browser Engine:   ${report.browser.ready ? `READY (${report.browser.strategy}: ${report.browser.recommendedExecutable})` : "UNAVAILABLE"}`);
        console.log(`  AI Inference:     ${report.ai.providerAvailable ? `READY (${report.ai.activeProviderName})` : `UNAVAILABLE (checked: ${report.ai.checkedProviders.join(", ")})`}`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("[html-report] Preflight error:", err.message);
      process.exit(1);
    });
}
