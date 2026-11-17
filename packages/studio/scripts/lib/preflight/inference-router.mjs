/**
 * @file lib/preflight/inference-router.mjs
 * CLI/HTTP AI provider registry, error sanitization, authentication detection,
 * smoke verification, and agent-agnostic dispatch routing.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { findExecutableOnPath } from "@html-report/core/env";

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

export function sanitizeCliError(stderr = "", err = null, providerId = null) {
  const raw = [stderr ? String(stderr) : "", err?.message ? String(err.message) : (typeof err === "string" ? err : "")]
    .filter(Boolean)
    .join("\n")
    .replace(/\x1b\[[0-9;]*m/g, "");
  const label = providerId ? `AI provider '${providerId}'` : "AI provider";

  if (/EROFS|read-only file system/i.test(raw)) {
    return `${label} cannot write to its home state directory (read-only filesystem / EROFS). Run outside a read-only sandbox or enable --ai-local mode.`;
  }
  if (/Please set an Auth method|not authenticated|missing.*api.?key|unauthorized|\b401\b/i.test(raw)) {
    return `${label} is not authenticated. Configure valid credentials or enable --ai-local mode.`;
  }
  if (/ENOENT|command not found|not found/i.test(raw)) {
    return `${label} executable was not found on PATH.`;
  }
  if (/ETIMEDOUT|timed out|AbortError/i.test(raw) || err?.killed) {
    return `${label} timed out before returning a response.`;
  }

  const cleaned = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^at\s+/.test(line) && !/^Node\.js v\d+/i.test(line))
    .join(" ")
    .replace(/^Command failed:\s*[^\n]+?(?=\s+[A-Z]|$)/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return `${label} failed to respond.`;
  return cleaned.length > 220 ? cleaned.slice(0, 217) + "..." : cleaned;
}

function isTruthyEnvFlag(val) {
  if (val === undefined || val === null) return false;
  const norm = String(val).trim().toLowerCase();
  return Boolean(norm && norm !== "0" && norm !== "false" && norm !== "no");
}

function hasGeminiSettingsAuth(home) {
  const settingsPath = path.join(home, ".gemini", "settings.json");
  if (fs.existsSync(settingsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      const authType =
        parsed?.security?.auth?.selectedType ||
        parsed?.selectedAuthType ||
        parsed?.auth?.selectedType;
      if (typeof authType === "string" && authType.trim().length > 0) {
        return true;
      }
    } catch (_) {}
  }
  const oauthCredsPath = path.join(home, ".gemini", "oauth_creds.json");
  return fs.existsSync(oauthCredsPath);
}

/**
 * Agent-agnostic Turnkey AI Bridge router supporting CLI harnesses and HTTP LLM APIs.
 */
export class AgentInferenceRouter {
  static _checkProviderAuthenticated(id, env = process.env) {
    try {
      const home = env.HOME || env.USERPROFILE || os.homedir();
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
            isTruthyEnvFlag(env.GOOGLE_GENAI_USE_VERTEXAI) ||
            isTruthyEnvFlag(env.GOOGLE_GENAI_USE_GCA) ||
            hasGeminiSettingsAuth(home)
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
      allowUnauthenticated = false,
      throwOnError = false
    } = merged;
    const normPrompt = String(prompt || "");
    const normSys = String(systemPrompt || "").trim();
    const effectiveSystemPrompt = normSys && normSys !== normPrompt.trim() ? normSys : "";
    const fullPrompt = effectiveSystemPrompt ? `${effectiveSystemPrompt}\n\n${normPrompt}` : normPrompt;
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
              const cleanMsg = sanitizeCliError(stderr, err, target.id);
              const wrapped = new Error(cleanMsg);
              wrapped.code = "inference_unavailable";
              wrapped.reason = cleanMsg;
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
      if (!target.authenticated && !allowUnauthenticated) {
        const unauthErr = new Error(
          `AI CLI provider '${target.id}' is installed but not authenticated. Configure valid credentials or enable --ai-local mode.`
        );
        unauthErr.code = "inference_unavailable";
        unauthErr.reason = unauthErr.message;
        unauthErr.provider = target.id;
        unauthErr.preflight = detection;
        return fail(unauthErr);
      }
      try {
        const res = await new Promise((resolve, reject) => {
          const args = target.buildArgs({ prompt: fullPrompt, model });
          const child = execFile(target.binPath || target.bin, args, { timeout: timeoutMs, env }, (err, stdout, stderr) => {
            if (err) {
              const cleanMsg = sanitizeCliError(stderr, err, target.id);
              const wrapped = new Error(cleanMsg);
              wrapped.code = "inference_unavailable";
              wrapped.reason = cleanMsg;
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
                ...(effectiveSystemPrompt ? [{ role: "system", content: effectiveSystemPrompt }] : []),
                { role: "user", content: normPrompt }
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
              system: effectiveSystemPrompt || undefined,
              messages: [{ role: "user", content: normPrompt }]
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
