/**
 * @file lib/server/persona-and-session.mjs
 * HTTP MIME table, AI persona registry, multi-turn session state store,
 * CLI argument parser, browser launcher, and zero-key local bridge replies.
 */

import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";

export const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".csv": "text/csv; charset=utf-8",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".zip": "application/zip"
};

/**
 * Extensible registry and schema manager for AI co-pilot personas.
 */
export class PersonaRegistry {
  constructor() {
    this.personas = new Map();
    this._initDefaults();
  }

  _initDefaults() {
    const defaults = [
      {
        id: "analyst",
        name: "Telemetry Analyst",
        description: "Provides concise, high-signal, actionable insights based on telemetry and metrics.",
        badgeColor: "badge-primary",
        icon: "trending-up",
        systemPrompt: "You are an elite telemetry and systems data analyst. Provide concise, high-signal, actionable insights based on the provided data and context."
      },
      {
        id: "support",
        name: "Documentation Support",
        description: "Provides document-grounded setup, troubleshooting, and operational assistance.",
        badgeColor: "badge-info",
        icon: "life-buoy",
        systemPrompt: "You are a document-grounded technical support assistant. Answer using the provided documentation, setup steps, and troubleshooting guides."
      },
      {
        id: "debugger",
        name: "Systems Debugger",
        description: "Isolates root causes, potential regressions, and concrete remediation steps.",
        badgeColor: "badge-error",
        icon: "bug",
        systemPrompt: "You are an expert systems engineer and debugger. Identify root causes, potential regressions, and concrete remediation steps."
      },
      {
        id: "strategist",
        name: "Competitive Strategist",
        description: "Dissects competitive viability, systemic strengths, and critical weaknesses.",
        badgeColor: "badge-secondary",
        icon: "target",
        systemPrompt: "You are an elite competitive strategist. Dissect the viability, systemic strengths, and critical weaknesses."
      },
      {
        id: "executive",
        name: "Executive Advisor",
        description: "Provides high-impact bullet points summarizing key takeaways and business impact.",
        badgeColor: "badge-neutral",
        icon: "briefcase",
        systemPrompt: "You are a concise executive advisor. Provide two high-impact bullet points summarizing key takeaways and business impact."
      },
      {
        id: "sarcastic",
        name: "Sarcastic Critic",
        description: "Delivers devastating, hilarious roasts targeting flaws and architectural absurdities.",
        badgeColor: "badge-warning",
        icon: "flame",
        systemPrompt: "You are a ruthlessly sarcastic critic. Deliver a single devastating, hilarious one-liner roast targeting flaws, weaknesses, and biological/architectural absurdities."
      },
      {
        id: "oak",
        name: "Professor Oak",
        description: "Exasperated field researcher lamenting 30 years of biological confusion.",
        badgeColor: "badge-accent",
        icon: "book-open",
        systemPrompt: "You are an exasperated Professor Oak. Deliver a single hilarious one-liner lamenting 30 years of field research."
      },
      {
        id: "hype",
        name: "Esports Shoutcaster",
        description: "High-octane excitement screaming about stats and momentum.",
        badgeColor: "badge-info",
        icon: "zap",
        systemPrompt: "You are an over-the-top, high-octane esports shoutcaster screaming about stats and momentum."
      }
    ];

    for (const p of defaults) {
      this.personas.set(p.id, p);
    }
  }

  register(persona) {
    if (!persona || typeof persona !== "object") throw new Error("Persona must be an object");
    const id = String(persona.id || "").trim().toLowerCase();
    if (!id) throw new Error("Persona requires a non-empty 'id' string");
    if (!persona.systemPrompt) throw new Error("Persona requires a non-empty 'systemPrompt'");

    const normalized = {
      id,
      name: persona.name || (id.charAt(0).toUpperCase() + id.slice(1)),
      description: persona.description || "",
      systemPrompt: persona.systemPrompt,
      badgeColor: persona.badgeColor || "badge-primary",
      icon: persona.icon || "bot",
      formatting: persona.formatting || "",
      defaultModel: persona.defaultModel || "Gemini 3.8 Flash (Low)",
      defaultTarget: persona.defaultTarget || "#agent-reaction-bubble"
    };

    this.personas.set(id, normalized);
    return normalized;
  }

  get(id) {
    if (!id) return this.personas.get("analyst");
    const cleanId = String(id).trim().toLowerCase();
    return this.personas.get(cleanId) || this.personas.get("analyst");
  }

  has(id) {
    if (!id) return false;
    return this.personas.has(String(id).trim().toLowerCase());
  }

  list() {
    return Array.from(this.personas.values());
  }

  loadFromDisk(rootDir) {
    const candidates = [
      path.join(rootDir, "personas.json"),
      path.join(rootDir, ".html-report", "personas.json")
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          const raw = fs.readFileSync(p, "utf-8");
          const parsed = JSON.parse(raw);
          const list = Array.isArray(parsed) ? parsed : Object.values(parsed);
          for (const item of list) {
            this.register(item);
          }
          console.log(`[html-report] Loaded ${list.length} custom persona(s) from ${path.basename(p)}`);
        } catch (e) {
          console.warn(`[html-report] Failed to load personas from ${p}:`, e.message);
        }
      }
    }
  }
}

/**
 * Manages multi-turn conversation sessions for report interactive agents.
 * Retains history for at least 15 minutes of inactivity before pruning.
 */
export class SessionStateStore {
  constructor(maxIdleMs = 15 * 60 * 1000) {
    this.maxIdleMs = maxIdleMs;
    this.sessions = new Map();
  }

  get(sessionId) {
    if (!sessionId) return null;
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (Date.now() - session.lastActive > this.maxIdleMs) {
      this.sessions.delete(sessionId);
      return null;
    }
    session.lastActive = Date.now();
    return session;
  }

  getOrCreate(sessionId) {
    let session = this.get(sessionId);
    if (!session) {
      const id = sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      session = {
        id,
        history: [],
        createdAt: Date.now(),
        lastActive: Date.now(),
        pendingActions: new Map()
      };
      this.sessions.set(id, session);
    }
    return session;
  }

  addMessage(sessionId, role, content, metadata = {}) {
    const session = this.getOrCreate(sessionId);
    const msg = {
      role,
      content,
      timestamp: new Date().toISOString(),
      ...metadata
    };
    session.history.push(msg);
    if (session.history.length > 30) {
      session.history = session.history.slice(-30);
    }
    session.lastActive = Date.now();
    return msg;
  }

  storePendingAction(sessionId, action) {
    const session = this.getOrCreate(sessionId);
    session.pendingActions.set(action.id, action);
    return action;
  }

  getPendingAction(sessionId, actionId) {
    const session = this.get(sessionId);
    if (!session) return null;
    return session.pendingActions.get(actionId) || null;
  }

  resolveAction(sessionId, actionId, approved) {
    const session = this.get(sessionId);
    if (!session) return null;
    const action = session.pendingActions.get(actionId);
    if (!action) return null;
    action.status = approved ? "approved" : "declined";
    action.resolvedAt = Date.now();
    return action;
  }

  prune() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActive > this.maxIdleMs) {
        this.sessions.delete(id);
      }
    }
  }
}

export function isAgentOrSandboxedEnv(env = process.env) {
  if (!env || typeof env !== "object") return false;
  return Boolean(
    env.HTML_REPORT_NO_OPEN === "1" ||
    env.CI === "true" ||
    env.CI === "1" ||
    env.ANTIGRAVITY_AGENT ||
    env.ANTIGRAVITY_CONVERSATION_ID ||
    env.CLAUDECODE ||
    env.CODEX_SANDBOX ||
    env.CURSOR_TRACE_ID
  );
}

export function parseArgs(argv, env = process.env) {
  const args = argv.slice(2);
  let filePath = null;
  let port = 3031;
  let autoOpen = !isAgentOrSandboxedEnv(env);
  let aiLocal = false;
  const feedProxies = [];

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--port" || args[i] === "-p") && args[i + 1]) {
      port = parseInt(args[++i], 10) || 3031;
    } else if (args[i] === "--no-open") {
      autoOpen = false;
    } else if (args[i] === "--open") {
      autoOpen = true;
    } else if (args[i] === "--ai-local") {
      aiLocal = true;
    } else if (args[i] === "--feed-proxy" && args[i + 1]) {
      const pair = args[++i];
      const eqIdx = pair.indexOf("=");
      if (eqIdx !== -1) {
        let prefix = pair.slice(0, eqIdx).trim();
        if (!prefix.startsWith("/")) prefix = "/" + prefix;
        if (prefix.endsWith("/")) prefix = prefix.slice(0, -1);
        let target = pair.slice(eqIdx + 1).trim();
        if (target.endsWith("/")) target = target.slice(0, -1);
        feedProxies.push({ prefix, target });
      }
    } else if (!args[i].startsWith("--") && !filePath) {
      filePath = args[i];
    }
  }

  return { filePath, port, autoOpen, feedProxies, aiLocal };
}

export function openBrowser(url) {
  if (isAgentOrSandboxedEnv(process.env)) {
    return;
  }
  const platform = process.platform;
  let cmd = "";
  if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else if (platform === "win32") {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `(xdg-open "${url}" || sensible-browser "${url}" || x-www-browser "${url}") >/dev/null 2>&1`;
  }

  exec(cmd, (err) => {
    if (err && process.env.DEBUG) {
      console.warn(`[html-report] Browser open command exited with: ${err.message}`);
    }
  });
}

export function detectReportMode(htmlContent) {
  if (!htmlContent || typeof htmlContent !== "string") return "report";
  const match = htmlContent.match(/<html[^>]*data-report-mode=["']([^"']+)["']/i);
  return match ? match[1].toLowerCase() : "report";
}

/**
 * Generates a context-grounded Markdown response for zero-API-key local bridge mode
 * (`--ai-local` / `HTML_REPORT_AI_MODE=local`) using report headings, DOM/dataset context,
 * and manifest metadata without external LLM calls or $HOME filesystem writes.
 */
export function buildLocalBridgeReply({ prompt, persona, context = {}, targetSelector = "", resolvedPath, rootDir }) {
  const cleanPrompt = String(prompt || "").trim();
  const promptLower = cleanPrompt.toLowerCase();

  let title = "Interactive HTML Report";
  const headings = [];
  let manifest = null;

  try {
    const htmlPath = fs.existsSync(path.join(rootDir, "fragment.html"))
      ? path.join(rootDir, "fragment.html")
      : resolvedPath;
    const rawHtml = fs.readFileSync(htmlPath, "utf-8");
    const titleMatch = rawHtml.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) title = titleMatch[1].trim();
    const headingMatches = [...rawHtml.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
    for (const m of headingMatches) {
      const txt = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (txt) headings.push(txt);
    }
  } catch (_) {}

  try {
    const manifestPath = path.join(rootDir, "report.manifest.json");
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (manifest.title) title = manifest.title;
    }
  } catch (_) {}

  const lines = [`**${persona?.name || "Assistant"} (Local Context Bridge — \`${persona?.id || "analyst"}\`):**`];

  if (context.elementId || targetSelector) {
    lines.push(`- **Focused Target:** \`${targetSelector || context.elementId}\``);
  } else {
    lines.push(`- **Report Context:** *${title}*${manifest?.mode ? ` (\`${manifest.mode}\`)` : ""}`);
  }

  if (context.datasetState) {
    if (Array.isArray(context.datasetState.datasets) && context.datasetState.datasets.length > 0) {
      const summary = context.datasetState.datasets
        .slice(0, 3)
        .map((ds) => `${ds.label || "Series"}: [${(ds.data || []).slice(0, 5).join(", ")}${(ds.data || []).length > 5 ? ", ..." : ""}]`)
        .join("; ");
      lines.push(`- **Chart Telemetry:** ${summary}`);
    } else if (Array.isArray(context.datasetState.headers) && context.datasetState.headers.length > 0) {
      lines.push(`- **Table Columns:** \`${context.datasetState.headers.join("`, `")}\` (${(context.datasetState.sampleRows || []).length} sample rows visible)`);
    }
  } else if (context.domSnippet) {
    const plainSnippet = String(context.domSnippet)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);
    if (plainSnippet) {
      lines.push(`- **Visible Context:** ${plainSnippet}${plainSnippet.length >= 220 ? "..." : ""}`);
    }
  }

  const promptWords = promptLower.split(/\W+/).filter((w) => w.length >= 3);
  const matchedHeadings = headings.filter((h) => {
    const hl = h.toLowerCase();
    return promptWords.some((w) => hl.includes(w));
  });
  const displayHeadings = (matchedHeadings.length > 0 ? matchedHeadings : headings).slice(0, 4);
  if (displayHeadings.length > 0) {
    lines.push(`- **Relevant Sections:** ${displayHeadings.map((h) => `*${h}*`).join(" · ")}`);
  }

  if (Array.isArray(manifest?.referenceFiles) && manifest.referenceFiles.length > 0) {
    const refNames = manifest.referenceFiles
      .slice(0, 4)
      .map((r) => `\`${r.fileName || r.relPath || r.name || "reference"}\``)
      .join(", ");
    lines.push(`- **Attached References:** ${refNames}`);
  }

  lines.push(`- **Answer Summary:** Processed *"${cleanPrompt.slice(0, 140)}"* locally with zero external API keys.`);
  return lines.join("\n");
}

export const MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024;

export function readRequestBody(req, res, { maxBytes = MAX_REQUEST_BODY_BYTES, corsHeaders = null } = {}) {
  return new Promise((resolve) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    req.on("data", (chunk) => {
      if (settled) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        settled = true;
        if (res && !res.writableEnded) {
          res.writeHead(413, corsHeaders || { "Content-Type": "application/json", "Cache-Control": "no-cache, no-store" });
          res.end(JSON.stringify({ ok: false, error: `Payload exceeds ${maxBytes} byte limit` }));
        }
        req.destroy();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });

    req.on("error", () => {
      if (settled) return;
      settled = true;
      resolve(null);
    });
  });
}
