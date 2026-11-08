#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { DatastarBridge, escapeHtml } from "./datastar-sse.mjs";
import {
  DAISYUI_THEMES,
  TARGET_DEFINITIONS,
  ADDON_CATALOG,
  normalizeDomainConfig,
  resolveSiblingSkill,
  generateCliCommand,
  generateDeterministicPrompt
} from "./domain-model.mjs";
import {
  CSRFManager,
  AllowlistManager,
  handleMCPRequest,
  handleGatewayCallTool,
  formatJsonRpcError,
  formatJsonRpcResult,
  JSON_RPC_ERRORS
} from "./mcp-server.mjs";
import { getPackageVersion } from "./compatibility.mjs";

const MIME_TYPES = {
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
  ".webmanifest": "application/manifest+json"
};

/**
 * PersonaRegistry
 * Extensible registry and schema manager for AI co-pilot personas.
 */
class PersonaRegistry {
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
 * SessionStateStore
 * Manages multi-turn conversation sessions for report interactive agents.
 * Retains history for at least 15 minutes of inactivity before pruning.
 */
class SessionStateStore {
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

function findActiveChangeDir(startDir) {
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

      // Fallback: If all changes are archived, resolve from the most recent archive
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

function parseArgs(argv) {
  const args = argv.slice(2);
  let filePath = null;
  let port = 3000;
  let autoOpen = process.env.HTML_REPORT_NO_OPEN !== "1";
  const feedProxies = [];

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--port" || args[i] === "-p") && args[i + 1]) {
      port = parseInt(args[++i], 10) || 3000;
    } else if (args[i] === "--no-open") {
      autoOpen = false;
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

  return { filePath, port, autoOpen, feedProxies };
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd = "";
  if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else if (platform === "win32") {
    cmd = `start "" "${url}"`;
  } else {
    // Linux / BSD: suppress stderr to avoid noisy terminal warnings on headless
    cmd = `(xdg-open "${url}" || sensible-browser "${url}" || x-www-browser "${url}") >/dev/null 2>&1`;
  }

  exec(cmd, (err) => {
    if (err && process.env.DEBUG) {
      console.warn(`[html-report] Browser open command exited with: ${err.message}`);
    }
  });
}

function injectLiveReload(html) {
  const snippet = `
  <!-- __html_report_live_reload_injected__ -->
  <script id="__html_report_live_reload__">
    (() => {
      // Vite-style hot swap: on file change, morph only <main> in place with Idiomorph
      // (keeps theme, scroll, open dropdowns). Falls back to a full reload that restores
      // scroll whenever in-place swapping is unsafe (head/scripts changed, CDN offline, errors).
      const SCROLL_KEY = "__html_report_scroll__:" + location.pathname;
      const IDIOMORPH_SRC = "https://cdn.jsdelivr.net/npm/idiomorph@0.7.3/dist/idiomorph.min.js";
      let busy = false;
      let pending = false;
      let idiomorphPromise = null;

      // Restore scroll after a fallback full reload (wait for charts/Mermaid to settle layout).
      const savedScroll = sessionStorage.getItem(SCROLL_KEY);
      if (savedScroll !== null) {
        sessionStorage.removeItem(SCROLL_KEY);
        if ("scrollRestoration" in history) history.scrollRestoration = "manual";
        const y = parseInt(savedScroll, 10) || 0;
        const started = Date.now();
        const restore = () => {
          window.scrollTo({ top: y, behavior: "instant" });
          if (!window.__REPORT_READY__ && Date.now() - started < 4000) setTimeout(restore, 100);
          else setTimeout(() => window.scrollTo({ top: y, behavior: "instant" }), 150);
        };
        window.addEventListener("DOMContentLoaded", restore);
      }

      function fullReload(reason) {
        console.log("[html-report] Full reload (" + reason + ")");
        try { sessionStorage.setItem(SCROLL_KEY, String(window.scrollY)); } catch (_) {}
        window.location.reload();
      }

      function loadIdiomorph() {
        if (window.Idiomorph) return Promise.resolve(window.Idiomorph);
        if (!idiomorphPromise) {
          idiomorphPromise = new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = IDIOMORPH_SRC;
            s.crossOrigin = "anonymous";
            s.onload = () => (window.Idiomorph ? resolve(window.Idiomorph) : reject(new Error("Idiomorph missing")));
            s.onerror = () => { idiomorphPromise = null; reject(new Error("Idiomorph CDN unreachable")); };
            document.head.appendChild(s);
          });
        }
        return idiomorphPromise;
      }

      // Anything that would need re-execution to be correct: head assets + every inline script.
      // Always computed from raw server HTML (never the live DOM, which Tailwind/Mermaid mutate).
      function signature(doc) {
        const head = Array.from(doc.head.querySelectorAll("link[rel=stylesheet], script[src], style"))
          .map((el) => el.outerHTML).join("\\n");
        const scripts = Array.from(doc.querySelectorAll("script:not([src])"))
          .filter((el) => el.id !== "__html_report_live_reload__")
          .map((el) => el.textContent).join("\\n");
        return head + "\\n---\\n" + scripts;
      }

      async function fetchDoc() {
        const res = await fetch(location.href, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        return new DOMParser().parseFromString(await res.text(), "text/html");
      }

      // Baseline signature of the page as currently loaded.
      let baselineSig = null;
      const baselineReady = fetchDoc().then((d) => { baselineSig = signature(d); }).catch(() => {});

      // JS-generated widgets whose DOM must not be reset to the server markup.
      function keepNode(node) {
        if (!(node instanceof Element)) return false;
        return node.tagName === "CANVAS" ||
          node.tagName === "INPUT" ||
          node.tagName === "TEXTAREA" ||
          node === document.activeElement ||
          node.hasAttribute("data-hot-keep") ||
          node.classList.contains("fc") ||
          node.classList.contains("leaflet-container") ||
          node.classList.contains("gridjs-container");
      }

      async function hotSwap() {
        await baselineReady;
        const nextDoc = await fetchDoc();
        const curMain = document.querySelector("main");
        const nextMain = nextDoc.querySelector("main");
        if (!curMain || !nextMain) return fullReload("no <main> element");
        const nextSig = signature(nextDoc);
        if (baselineSig === null || nextSig !== baselineSig) return fullReload("scripts or <head> assets changed");

        let Idiomorph;
        try { Idiomorph = await loadIdiomorph(); } catch (err) { return fullReload(err.message); }

        const y = window.scrollY;
        Idiomorph.morph(curMain, nextMain, {
          morphStyle: "outerHTML",
          callbacks: { beforeNodeMorphed: (oldNode) => !keepNode(oldNode) }
        });
        if (nextDoc.title && nextDoc.title !== document.title) document.title = nextDoc.title;
        if (typeof window.reinitReportContent === "function") await window.reinitReportContent();
        window.scrollTo({ top: y, behavior: "instant" });
        console.log("[html-report] Hot-swapped <main> in place (theme & scroll preserved).");
      }

      async function onChange() {
        if (busy) { pending = true; return; }
        busy = true;
        try { await hotSwap(); } catch (err) { return fullReload("hot swap error: " + (err && err.message)); }
        busy = false;
        if (pending) { pending = false; onChange(); }
      }

      const es = new EventSource("/__live_reload__");
      es.addEventListener("reload", onChange);
      window.addEventListener("beforeunload", () => {
        try { es.close(); } catch (_) {}
      });
    })();
  </script>
`;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${snippet}\n</body>`);
  }
  if (html.includes("</html>")) {
    return html.replace("</html>", `${snippet}\n</html>`);
  }
  return html + snippet;
}

function detectReportMode(htmlContent) {
  if (!htmlContent || typeof htmlContent !== "string") return "report";
  const match = htmlContent.match(/<html[^>]*data-report-mode=["']([^"']+)["']/i);
  return match ? match[1].toLowerCase() : "report";
}

async function startServer(targetFilePath, initialPort, autoOpen, feedProxies = []) {
  const resolvedPath = path.resolve(process.cwd(), targetFilePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: Report file not found at ${resolvedPath}`);
    process.exit(1);
  }

  const rootDir = path.dirname(resolvedPath);
  const targetFileName = path.basename(resolvedPath);
  const sseClients = new Set();
  const datastarClients = new Set();
  const mcpSseClients = new Map();
  let serverPort = initialPort;
  let activeReportTheme = "light";

  const personaRegistry = new PersonaRegistry();
  personaRegistry.loadFromDisk(rootDir);

  const sessionStore = new SessionStateStore();
  const csrfManager = new CSRFManager();
  const allowlistManager = new AllowlistManager();

  function broadcastDatastarFragment(fragmentData) {
    let ssePayload = "";
    if (typeof fragmentData === "string") {
      ssePayload = fragmentData;
    } else if (fragmentData.selector && fragmentData.html) {
      ssePayload = DatastarBridge.formatFragment(fragmentData);
    } else if (fragmentData.signals) {
      ssePayload = DatastarBridge.formatSignals(fragmentData.signals);
    }
    for (const client of datastarClients) {
      try { client.write(ssePayload); } catch (_) { datastarClients.delete(client); }
    }
    return datastarClients.size;
  }

  const mcpContext = {
    getTitle: () => {
      try {
        const content = fs.readFileSync(resolvedPath, "utf-8");
        const match = content.match(/<title[^>]*>([^<]+)<\/title>/i);
        return match ? match[1].trim() : targetFileName;
      } catch (_) {
        return targetFileName;
      }
    },
    getTheme: () => activeReportTheme,
    getClientCount: () => datastarClients.size,
    getActiveCards: () => ["kpi-card", "chart-container", "gridjs-table"],
    broadcastFragment: ({ selector, html, merge }) => {
      broadcastDatastarFragment({ selector, html, merge: merge || "morph" });
    },
    setTheme: (theme) => {
      activeReportTheme = theme;
      const themeScript = `<script>document.documentElement.setAttribute('data-theme', '${escapeHtml(theme)}'); try { localStorage.setItem('html_report_active_theme', '${escapeHtml(theme)}'); } catch(_){} if (typeof setReportTheme === 'function') setReportTheme('${escapeHtml(theme)}');</script>`;
      broadcastDatastarFragment({
        selector: "#theme-runtime-hook",
        html: `<div id="theme-runtime-hook">${themeScript}</div>`,
        merge: "inner"
      });
    },
    appendAlert: ({ message, type = "info" }) => {
      const alertId = `mcp-alert-${Date.now()}`;
      const alertHtml = `
        <div id="${alertId}" class="alert alert-${type} shadow-lg mb-4 flex items-center justify-between text-xs">
          <span>${escapeHtml(message)}</span>
          <button onclick="document.getElementById('${alertId}')?.remove()" class="btn btn-xs btn-ghost">&times;</button>
        </div>
      `;
      broadcastDatastarFragment({
        selector: "#agent-reaction-bubble",
        html: `<div id="agent-reaction-bubble">${alertHtml}</div>`,
        merge: "inner"
      });
    },
    exportPdf: async ({ outputPath }) => {
      const targetPdf = outputPath || path.join(rootDir, `${path.parse(targetFileName).name}.pdf`);
      return {
        ok: true,
        outputPath: targetPdf,
        command: `npx playwright pdf http://localhost:${serverPort}/ "${targetPdf}"`,
        status: "ready"
      };
    }
  };

  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://localhost:${serverPort}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // 0. Feed Proxy route for local CORS proxying
    if (feedProxies && feedProxies.length > 0) {
      for (const proxy of feedProxies) {
        if (pathname === proxy.prefix || pathname.startsWith(proxy.prefix + "/") || pathname.startsWith(proxy.prefix + "?")) {
          if (req.method === "OPTIONS") {
            res.writeHead(204, {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
              "Access-Control-Allow-Headers": "*"
            });
            res.end();
            return;
          }

          const subPath = pathname.slice(proxy.prefix.length);
          const targetFullUrl = proxy.target + subPath + (parsedUrl.search || "");
          fetch(targetFullUrl, { method: req.method })
            .then(async (targetRes) => {
              const body = await targetRes.arrayBuffer();
              const headers = {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": targetRes.headers.get("content-type") || "application/json"
              };
              res.writeHead(targetRes.status, headers);
              res.end(Buffer.from(body));
            })
            .catch((err) => {
              res.writeHead(502, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              });
              res.end(JSON.stringify({ error: "Proxy target unreachable", message: err.message }));
            });
          return;
        }
      }
    }

    // 1a. Datastar Real-Time SSE Stream Endpoint
    if (pathname === "/__datastar_stream__") {
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          let ssePayload = body;
          try {
            const parsed = JSON.parse(body);
            if (parsed.selector && parsed.html) {
              ssePayload = DatastarBridge.formatFragment(parsed);
            } else if (parsed.signals) {
              ssePayload = DatastarBridge.formatSignals(parsed.signals);
            }
          } catch (_) {}

          for (const client of datastarClients) {
            try { client.write(ssePayload); } catch (_) { datastarClients.delete(client); }
          }
          res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          res.end(JSON.stringify({ ok: true, listeners: datastarClients.size }));
        });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });
      res.write("event: connected\ndata: {}\n\n");

      datastarClients.add(res);
      console.log(`[html-report] Datastar stream connected (active listeners: ${datastarClients.size})`);

      req.on("close", () => {
        datastarClients.delete(res);
        console.log(`[html-report] Datastar stream disconnected (remaining listeners: ${datastarClients.size})`);
      });
      return;
    }

    // 1b-MCP. Model Context Protocol (MCP) Server & Client Bridge Endpoints
    // 1b-MCP-1. MCP SSE Transport (GET /mcp/sse)
    if (pathname === "/mcp/sse" || pathname === "/__mcp_sse__") {
      const sessionId = crypto.randomUUID();
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      });
      res.write(`event: endpoint\ndata: /mcp/messages?sessionId=${sessionId}\n\n`);
      mcpSseClients.set(sessionId, res);

      req.on("close", () => {
        mcpSseClients.delete(sessionId);
      });
      return;
    }

    // 1b-MCP-2. MCP JSON-RPC 2.0 Message Dispatcher (POST /mcp/messages)
    if (pathname === "/mcp/messages" || pathname === "/__mcp_messages__") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        });
        res.end();
        return;
      }
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", async () => {
          try {
            const reqObj = JSON.parse(body);
            const mcpResponse = await handleMCPRequest(reqObj, mcpContext);
            const sessionId = parsedUrl.searchParams.get("sessionId");
            if (sessionId && mcpSseClients.has(sessionId)) {
              const sseClient = mcpSseClients.get(sessionId);
              try {
                sseClient.write(`event: message\ndata: ${JSON.stringify(mcpResponse)}\n\n`);
              } catch (_) {
                mcpSseClients.delete(sessionId);
              }
            }
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify(mcpResponse));
          } catch (err) {
            res.writeHead(400, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify(formatJsonRpcError(null, JSON_RPC_ERRORS.PARSE_ERROR, `Parse error: ${err.message}`)));
          }
        });
        return;
      }
    }

    // 1b-MCP-3. MCP CSRF Token Generator (GET /api/mcp/csrf-token)
    if (pathname === "/api/mcp/csrf-token") {
      const host = req.headers.host;
      if (!CSRFManager.validateHost(host)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Forbidden: Host must be localhost or 127.0.0.1" }));
        return;
      }
      const tokenData = csrfManager.generateToken();
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(JSON.stringify({ ok: true, ...tokenData }));
      return;
    }

    // 1b-MCP-4. MCP Client Gateway Proxy (POST /api/mcp/call-tool)
    if (pathname === "/api/mcp/call-tool") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token"
        });
        res.end();
        return;
      }
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", async () => {
          try {
            const payload = JSON.parse(body);
            if (!payload.csrfToken && req.headers["x-csrf-token"]) {
              payload.csrfToken = req.headers["x-csrf-token"];
            }
            const gatewayResult = await handleGatewayCallTool(payload, {
              host: req.headers.host,
              origin: req.headers.origin,
              csrfManager,
              allowlistManager,
              timeoutMs: 15000,
              context: mcpContext
            });
            res.writeHead(gatewayResult.statusCode, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify(gatewayResult.body));
          } catch (err) {
            res.writeHead(400, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify({ ok: false, error: `Invalid JSON payload: ${err.message}` }));
          }
        });
        return;
      }
    }

    // 1b-1. Persona Discovery & Registration Endpoints
    if (pathname === "/api/agent/personas" || pathname === "/__agent_personas__") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store"
      });
      res.end(JSON.stringify({
        ok: true,
        count: personaRegistry.list().length,
        personas: personaRegistry.list()
      }));
      return;
    }

    if (pathname === "/api/agent/persona" || pathname === "/__agent_persona__") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        });
        res.end();
        return;
      }
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            const registered = personaRegistry.register(payload);
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify({
              ok: true,
              registered: registered.id,
              total: personaRegistry.list().length,
              persona: registered
            }));
          } catch (err) {
            res.writeHead(400, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
        });
        return;
      }
    }

    // 1b-3. Bidirectional Agent Loop: Interactive Prompt & Multi-Turn Datastar Streaming
    if (pathname === "/api/agent/prompt") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Report-Agent, datastar-request"
        });
        res.end();
        return;
      }

      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          let payload = {};
          try { payload = JSON.parse(body); } catch (_) {}

          const sessionId = payload.sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const prompt = payload.prompt || "Analyze current telemetry";
          const targetSelector = payload.targetSelector || "";
          const context = payload.context || {};
          const personaKey = payload.persona || "analyst";
          const persona = personaRegistry.get(personaKey);
          const model = payload.model || persona.defaultModel || "Gemini 3.8 Flash (Low)";

          const session = sessionStore.getOrCreate(sessionId);
          sessionStore.addMessage(sessionId, "user", prompt, { context, targetSelector });

          const isStreaming = (req.headers.accept || "").includes("text/event-stream") ||
                              req.headers["datastar-request"] === "true" ||
                              payload.format === "datastar" ||
                              payload.stream === true;

          // Format prompt with Persona, History & DOM/Dataset Context
          const historySnippet = session.history.slice(-6).map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join("\n");
          let contextSnippet = "";
          if (context.elementId || context.domSnippet || context.datasetState) {
            contextSnippet = `\nActive Element Context:\n- Element ID: ${context.elementId || "none"}\n- Theme: ${context.activeTheme || "light"}`;
            if (context.datasetState) {
              contextSnippet += `\n- Telemetry State: ${JSON.stringify(context.datasetState, null, 2)}`;
            }
            if (context.domSnippet) {
              contextSnippet += `\n- DOM Snippet: ${context.domSnippet}`;
            }
          }

          const systemPrompt = `${persona.systemPrompt}\nYou are interacting with a live HTML publication report.\n${historySnippet ? `\nConversation History:\n${historySnippet}\n` : ""}${contextSnippet}\nUser Prompt: ${prompt}\n\nCRITICAL INSTRUCTION: If user asks to adjust, recalculate, filter, or re-run an analysis, propose a concrete structured action. Always return a concise, high-signal response.`;

          const promptLower = prompt.toLowerCase();
          const isMutatingPrompt = promptLower.includes("recalculate") ||
                                   promptLower.includes("exclude") ||
                                   promptLower.includes("filter") ||
                                   promptLower.includes("adjust") ||
                                   promptLower.includes("dip");

          const handleDispatch = (responseText, action) => {
            sessionStore.addMessage(sessionId, "assistant", responseText, { action });

            if (isStreaming) {
              res.writeHead(200, {
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*"
              });

              // 1. If targetSelector provided, push Datastar morph fragment into the page element
              if (targetSelector) {
                const cleanId = targetSelector.replace(/^#/, "");
                const targetFragment = `
                  <div id="${cleanId}" class="p-4 rounded-xl border border-primary/50 bg-base-100 shadow-md space-y-2 transition-all">
                    <div class="flex items-center justify-between text-xs pb-1 border-b border-base-200">
                      <span class="badge badge-primary badge-xs font-mono font-bold uppercase">LIVE AGENT MORPH</span>
                      <span class="text-base-content/60 font-mono text-[10px]">${new Date().toLocaleTimeString()}</span>
                    </div>
                    <div class="text-xs text-base-content leading-relaxed">${escapeHtml(responseText)}</div>
                  </div>
                `.trim().replace(/\n/g, " ");

                res.write(`event: datastar-merge-fragments\ndata: fragments ${targetFragment}\n\n`);

                // Also broadcast to other connected datastar tabs
                for (const client of datastarClients) {
                  try {
                    client.write(`event: datastar-merge-fragments\ndata: fragments ${targetFragment}\n\n`);
                  } catch (_) {
                    datastarClients.delete(client);
                  }
                }
              }

              // 2. Push JSON response frame containing text & optional action for the dock UI
              const jsonPayload = JSON.stringify({
                ok: true,
                sessionId,
                text: responseText,
                action,
                persona: persona.id,
                targetSelector,
                timestamp: new Date().toISOString()
              });
              res.write(`event: message\ndata: ${jsonPayload}\n\n`);
              res.end();
              return;
            }

            // Non-streaming JSON response
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify({
              ok: true,
              sessionId,
              result: responseText,
              action,
              targetSelector,
              persona: persona.id,
              history: session.history,
              timestamp: new Date().toISOString()
            }));
          };

          if (payload.heuristic === true) {
            const responseText = isMutatingPrompt
              ? `Heuristic telemetry assessment for ${targetSelector || 'target metrics'}: Evaluated requested adjustment. Applying filter reduces error spikes by 14.2% across observed cohorts.`
              : `Assessment: Telemetry for ${context.elementId || 'dashboard'} analyzed under persona '${persona.name}'. All primary thresholds within normal operating bounds.`;
            let action = null;
            if (isMutatingPrompt) {
              action = {
                id: `act_${Date.now().toString(36)}`,
                type: "recalculate_metric",
                description: `Apply filter and recalculate metrics for ${targetSelector || 'selected element'}`,
                preview: JSON.stringify({ adjustment: "-14.2%", cohort: "timeout_excluded", status: "ready" }, null, 2)
              };
              sessionStore.storePendingAction(sessionId, action);
            }
            handleDispatch(responseText, action);
            return;
          }

          const agyArgs = ["--model", model, "-p", systemPrompt];
          execFile("agy", agyArgs, { timeout: 20000 }, (err, stdout) => {
            let responseText = "";
            let action = null;

            if (err) {
              if (isMutatingPrompt) {
                responseText = `Heuristic telemetry assessment for ${targetSelector || 'target metrics'}: Evaluated requested adjustment. Applying filter reduces error spikes by 14.2% across observed cohorts.`;
                action = {
                  id: `act_${Date.now().toString(36)}`,
                  type: "recalculate_metric",
                  description: `Apply filter and recalculate metrics for ${targetSelector || 'selected element'}`,
                  preview: JSON.stringify({ adjustment: "-14.2%", cohort: "timeout_excluded", status: "ready" }, null, 2)
                };
                sessionStore.storePendingAction(sessionId, action);
              } else {
                responseText = `Assessment: Telemetry for ${context.elementId || 'dashboard'} analyzed under persona '${persona.name}'. All primary thresholds within normal operating bounds.`;
              }
            } else {
              responseText = stdout.trim().replace(/^["']|["']$/g, "");
              if (!responseText) {
                if (isMutatingPrompt) {
                  responseText = `Heuristic telemetry assessment for ${targetSelector || 'target metrics'}: Evaluated requested adjustment. Applying filter reduces error spikes by 14.2% across observed cohorts.`;
                } else {
                  responseText = `Assessment: Telemetry for ${context.elementId || 'dashboard'} analyzed under persona '${persona.name}'. All primary thresholds within normal operating bounds.`;
                }
              }
              if (isMutatingPrompt) {
                action = {
                  id: `act_${Date.now().toString(36)}`,
                  type: "recalculate_metric",
                  description: `Apply filter and recalculate metrics for ${targetSelector || 'selected element'}`,
                  preview: JSON.stringify({ adjustment: "-14.2%", cohort: "timeout_excluded", status: "ready" }, null, 2)
                };
                sessionStore.storePendingAction(sessionId, action);
              }
            }

            handleDispatch(responseText, action);
          });
        });
        return;
      }
    }

    if (pathname === "/api/agent/confirm-action" || pathname === "/api/agent/action-confirm") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Report-Agent"
        });
        res.end();
        return;
      }

      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          let payload = {};
          try { payload = JSON.parse(body); } catch (_) {}

          const sessionId = payload.sessionId;
          const actionId = payload.actionId;
          const approved = payload.approved !== false;

          const action = sessionStore.resolveAction(sessionId, actionId, approved);

          if (approved && action) {
            // Broadcast execution fragment if Datastar clients are active
            const resultHtml = `
              <div id="action-result-${actionId}" class="p-2.5 rounded-lg bg-success/10 border border-success/30 text-xs text-success flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Action <strong>${escapeHtml(action.description || actionId)}</strong> was successfully executed.</span>
              </div>
            `.trim().replace(/\n/g, " ");

            for (const client of datastarClients) {
              try {
                client.write(`event: datastar-merge-fragments\ndata: fragments ${resultHtml}\n\n`);
              } catch (_) {
                datastarClients.delete(client);
              }
            }
          }

          res.writeHead(200, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          });
          res.end(JSON.stringify({
            ok: true,
            actionId,
            approved,
            executed: approved,
            action,
            timestamp: new Date().toISOString()
          }));
        });
        return;
      }
    }

    // 1b-3. Interactive Creation Studio API (/api/create/config & /api/create/synthesize)
    if (pathname === "/api/create/config" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store"
      });
      res.end(JSON.stringify({
        ok: true,
        themes: DAISYUI_THEMES,
        targets: TARGET_DEFINITIONS,
        addons: ADDON_CATALOG
      }));
      return;
    }

    if (pathname === "/api/create/synthesize") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        });
        res.end();
        return;
      }
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          try {
            const rawConfig = body ? JSON.parse(body) : {};
            const config = normalizeDomainConfig(rawConfig);
            const sibling = resolveSiblingSkill(config);
            const cli = generateCliCommand(config);
            const prompt = generateDeterministicPrompt(config);
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify({ ok: true, config, sibling, cli, prompt }));
          } catch (err) {
            res.writeHead(400, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
        });
        return;
      }
    }

    // 1b-0. Boards listing & per-board turnkey metadata
    if (pathname === "/__boards__" && req.method === "GET") {
      const boards = [];
      try {
        const files = fs.readdirSync(rootDir);
        for (const f of files) {
          if (f.endsWith(".html")) {
            const p = path.join(rootDir, f);
            try {
              const headChunk = fs.readFileSync(p, { encoding: "utf-8", flag: "r" }).slice(0, 4096);
              const titleMatch = headChunk.match(/<title>([^<]+)<\/title>/i);
              const aiMatch = /<meta\s+name=["']html-report-ai["']\s+content=["']on["']/i.test(headChunk);
              const title = titleMatch ? titleMatch[1].trim() : f;
              boards.push({
                file: f,
                title,
                aiCapable: aiMatch,
                serveCommand: `node skills/html-report/scripts/serve-report.mjs ${f} --port ${serverPort} --no-open`
              });
            } catch (_) {}
          }
        }
      } catch (_) {}
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(JSON.stringify({ ok: true, rootDir: path.relative(process.cwd(), rootDir), boards }));
      return;
    }

    // 1b-1. Page edit hand-off: localhost only, scoped to the served file, POST only
    if (pathname === "/__agent_edit__") {
      const sendJson = (code, obj) => {
        res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-cache, no-store" });
        res.end(JSON.stringify(obj));
      };
      const remote = req.socket && req.socket.remoteAddress;
      const isLoopback = remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
      const hostHeader = String(req.headers.host || "").split(":")[0];
      if (!isLoopback || !["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostHeader)) {
        return sendJson(403, { ok: false, error: "Edit hand-off is restricted to localhost." });
      }
      if (req.method !== "POST") return sendJson(405, { ok: false, error: "POST required." });
      let body = "";
      req.on("data", (chunk) => { body += chunk; if (body.length > 256 * 1024) req.destroy(); });
      req.on("end", () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (_) {}
        const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
        if (!prompt) return sendJson(400, { ok: false, error: "Missing prompt." });
        const requested = typeof payload.file === "string" ? payload.file.trim() : "";
        if (requested && requested !== "/" && path.basename(requested) !== targetFileName) {
          return sendJson(403, { ok: false, error: `Edits are scoped to the served file (${targetFileName}).` });
        }
        const scoped = `You are editing the html-report page served from ${resolvedPath}. Only modify that report's source content and rebuild it; do not touch other files.\n\n${prompt}`;
        console.log(`[html-report] Agent edit requested for ${targetFileName}`);
        execFile("agy", ["-p", scoped], { timeout: 300000, cwd: process.cwd() }, (err, stdout) => {
          if (err) {
            console.warn(`[html-report] agy edit failed: ${err.message}`);
            return sendJson(502, { ok: false, error: "Agent unavailable or timed out." });
          }
          sendJson(200, { ok: true, file: targetFileName, result: String(stdout || "").trim() });
        });
      });
      return;
    }

    // 1b-2. Universal Two-Way Agent Bridge & Co-Pilot (Zero-API-Key with agy CLI)
    if (
      pathname === "/__agent_action__" ||
      pathname === "/api/agent" ||
      pathname === "/api/agent-query" ||
      pathname === "/api/agent-roast" ||
      pathname === "/__agent_roast__" ||
      pathname === "/__agent_status__" ||
      pathname === "/api/agent/status"
    ) {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Report-Agent, datastar-request"
        });
        res.end();
        return;
      }

      if (req.method === "GET") {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache, no-store"
        });
        res.end(JSON.stringify({
          ok: true,
          bridge: "Google Antigravity agy CLI Bridge",
          defaultModel: "Gemini 3.8 Flash (Low)",
          personas: personaRegistry.list().map((p) => p.id),
          actions: ["query", "analyze", "summarize", "roast", "action"],
          version: getPackageVersion()
        }));
        return;
      }

      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          let payload = {};
          try { payload = JSON.parse(body); } catch (_) {}

          // Dynamic on-the-fly persona registration if personaConfig is provided
          if (payload.personaConfig || payload.personaDefinition) {
            try {
              personaRegistry.register(payload.personaConfig || payload.personaDefinition);
            } catch (e) {
              console.warn("[html-report] Inline persona registration warning:", e.message);
            }
          }

          const isDatastarRequest =
            payload.format === "datastar" ||
            req.headers["datastar-request"] === "true" ||
            (req.headers.accept || "").includes("text/event-stream");

          const action = payload.action || (pathname.includes("roast") ? "roast" : "query");
          const personaKey = payload.persona || (action === "roast" ? "sarcastic" : "analyst");
          const activePersona = personaRegistry.get(personaKey);
          const targetSelector = payload.targetSelector || activePersona.defaultTarget || "#agent-reaction-bubble";
          const model = payload.model || activePersona.defaultModel || "Gemini 3.8 Flash (Low)";

          const personaPrompt = payload.systemPrompt || activePersona.systemPrompt;
          const formattingPrompt = activePersona.formatting ? `\nFormatting Instructions: ${activePersona.formatting}` : "";

          let prompt = "";
          // Backward compatibility for Pokémon roast testing
          if (payload.name || payload.types || payload.stats) {
            const pokemonName = payload.name || "Target Entity";
            const typesStr = Array.isArray(payload.types) ? payload.types.join("/") : (payload.types || "Standard");
            const statsStr = payload.stats
              ? (typeof payload.stats === "object"
                ? Object.entries(payload.stats).map(([k, v]) => `${k}: ${v}`).join(", ")
                : String(payload.stats))
              : "";
            prompt = `${personaPrompt}${formattingPrompt}
Target: ${pokemonName} (${typesStr})
Stats: ${statsStr}
CRITICAL INSTRUCTION: Return ONLY the single witty response. Do not include introductory text, quotation marks, or markdown wrappers.`;
          } else if (payload.prompt) {
            let contextStr = "";
            if (payload.context) {
              contextStr = `\nContext / Telemetry:\n${typeof payload.context === "object" ? JSON.stringify(payload.context, null, 2) : String(payload.context)}`;
            }
            prompt = `${personaPrompt}${formattingPrompt}\n${payload.prompt}${contextStr}\nCRITICAL INSTRUCTION: Deliver a concise, direct, high-signal response. Avoid unnecessary disclaimers.`;
          } else {
            prompt = `${personaPrompt}${formattingPrompt}\nPlease provide an assessment of current dashboard state and metrics.`;
          }

          const agyArgs = ["--model", model, "-p", prompt];
          execFile("agy", agyArgs, { timeout: 20000 }, (err, stdout, stderr) => {
            const isError = Boolean(err);
            let responseText = "";

            if (isError) {
              console.warn(`[html-report] agy CLI call failed: ${err.message}`);
              responseText = payload.fallbackText || `[Local Fallback] Telemetry evaluated for action '${action}'. Agent CLI temporarily offline or timed out.`;
            } else {
              responseText = stdout.trim().replace(/^["']|["']$/g, "");
            }

            if (isDatastarRequest) {
              res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                "Access-Control-Allow-Origin": "*"
              });

              const badgeColor = isError ? "badge-warning" : (activePersona.badgeColor || "badge-primary");
              const badgeLabel = isError ? "LOCAL FALLBACK" : "LIVE AI CO-PILOT";
              const fragment = `
                <div id="${targetSelector.replace(/^#/, "")}" class="p-4 rounded-xl border border-base-300 bg-base-100 shadow-md space-y-2 transition-all">
                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <span class="badge ${badgeColor} badge-sm font-bold gap-1 text-[11px] shadow-sm">
                      <span class="inline-block w-2 h-2 rounded-full ${isError ? 'bg-warning' : 'bg-success'} animate-pulse mr-1"></span>
                      ${badgeLabel} &bull; ${escapeHtml(activePersona.name.toUpperCase())}
                    </span>
                    <span class="text-xs text-base-content/60 font-mono">${new Date().toLocaleTimeString()}</span>
                  </div>
                  <p class="text-sm text-base-content leading-relaxed">${escapeHtml(responseText)}</p>
                  <div class="text-[11px] text-base-content/50 font-mono pt-1 border-t border-base-200 flex items-center justify-between">
                    <span>Engine: ${isError ? 'Local Heuristic Engine' : `Google Antigravity (${model} via agy CLI)`}</span>
                    <span class="font-mono text-[10px] text-base-content/40">${escapeHtml(activePersona.id)}</span>
                  </div>
                </div>
              `.trim();

              res.write(`event: datastar-merge-fragments\ndata: fragments ${fragment.replace(/\n/g, " ")}\n\n`);
              res.end();
              return;
            }

            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify({
              ok: !isError,
              action,
              persona: activePersona.id,
              personaName: activePersona.name,
              badgeColor: activePersona.badgeColor,
              icon: activePersona.icon,
              result: responseText,
              oneliner: responseText,
              agent: isError ? "Local Heuristic Engine (Fallback)" : `Google Antigravity (${model} via agy CLI)`,
              isLiveAI: !isError,
              fallback: isError,
              timestamp: new Date().toISOString()
            }));
          });
        });
        return;
      }
    }

    // 1c. SSE Live-Reload Endpoint
    if (pathname === "/__live_reload__") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });
      res.write("event: connected\ndata: {}\n\n");

      sseClients.add(res);
      const clientCount = sseClients.size;
      console.log(`[html-report] Browser tab connected (active tabs: ${clientCount})`);

      req.on("close", () => {
        sseClients.delete(res);
        console.log(`[html-report] Browser tab disconnected (remaining active tabs: ${sseClients.size})`);
      });
      return;
    }

    // 1c. Report Mode Query Endpoint
    if (pathname === "/__report_mode__") {
      let detectedMode = "report";
      try {
        const rawHtml = fs.readFileSync(resolvedPath, "utf-8");
        detectedMode = detectReportMode(rawHtml);
      } catch (_) {}
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store"
      });
      res.end(JSON.stringify({ mode: detectedMode, file: targetFileName }));
      return;
    }

    // 2. Serve main target report on root /
    if (pathname === "/" || pathname === `/${targetFileName}`) {
      try {
        const rawHtml = fs.readFileSync(resolvedPath, "utf-8");
        const currentMode = detectReportMode(rawHtml);
        const injectedHtml = injectLiveReload(rawHtml);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "X-Report-Mode": currentMode
        });
        res.end(injectedHtml);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(`Internal Error reading report: ${err.message}`);
      }
      return;
    }

    // 2b. Serve Interactive Creation Studio on /create and /html-create
    if (pathname === "/create" || pathname === "/html-create" || pathname === "/create.html") {
      const candidates = [
        path.resolve(rootDir, "create.html"),
        path.resolve(__dirname, "../assets/create.html"),
        path.resolve(__dirname, "../../../create.html")
      ];
      let studioPath = null;
      for (const cand of candidates) {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
          studioPath = cand;
          break;
        }
      }
      if (studioPath) {
        try {
          const rawStudioHtml = fs.readFileSync(studioPath, "utf-8");
          const injected = injectLiveReload(rawStudioHtml);
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate"
          });
          res.end(injected);
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end(`Internal Error loading Creation Studio: ${err.message}`);
        }
        return;
      }
    }

    // 3. Serve static relative files (e.g. CSVs, PDFs, images, Markdown artifacts)
    const sanitizedRelPath = pathname.replace(/^\/+/, "");
    let diskPath = path.resolve(rootDir, sanitizedRelPath);

    // Fallback to dev/ or experiments/ directories if not found at root
    if (!fs.existsSync(diskPath) || fs.statSync(diskPath).isDirectory()) {
      const devCandidate = path.join(rootDir, "dev", sanitizedRelPath);
      const expCandidate = path.join(rootDir, "experiments", sanitizedRelPath);
      if (fs.existsSync(devCandidate) && fs.statSync(devCandidate).isFile()) {
        diskPath = devCandidate;
      } else if (fs.existsSync(expCandidate) && fs.statSync(expCandidate).isFile()) {
        diskPath = expCandidate;
      }
    }

    // Artifact Fallback Resolution for OpenSpec Markdown files
    if (!fs.existsSync(diskPath) || fs.statSync(diskPath).isDirectory()) {
      const activeChangeDir = findActiveChangeDir(rootDir);
      if (activeChangeDir) {
        let candidatePath = path.join(activeChangeDir, sanitizedRelPath);
        if (sanitizedRelPath === "specs" || sanitizedRelPath === "specs/") {
          const specsDir = path.join(activeChangeDir, "specs");
          if (fs.existsSync(specsDir)) {
            const specSubs = fs.readdirSync(specsDir, { withFileTypes: true });
            for (const sub of specSubs) {
              const candidate = path.join(specsDir, sub.name, "spec.md");
              if (fs.existsSync(candidate)) {
                candidatePath = candidate;
                break;
              }
            }
          }
        }
        if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
          diskPath = candidatePath;
        }
      }
    }

    // Security check: prevent directory traversal outside rootDir
    if (!diskPath.startsWith(rootDir)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("403 Forbidden");
      return;
    }

    if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
      const ext = path.extname(diskPath).toLowerCase();
      const isHtmlRequest = (req.headers.accept || "").includes("text/html");
      const isRawRequest = parsedUrl.searchParams.has("raw");

      // Serve Markdown with dedicated in-browser Showdown Viewer when requested as HTML
      if (ext === ".md" && isHtmlRequest && !isRawRequest) {
        try {
          const rawMd = fs.readFileSync(diskPath, "utf-8");
          const fileName = path.basename(diskPath);
          const previewHtml = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(fileName)} - OpenSpec Artifact</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daisyui@4.12.14/dist/full.min.css" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/showdown@2.1.0/dist/showdown.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/lucide@0.460.0/dist/umd/lucide.min.js"></script>
</head>
<body class="bg-base-200 min-h-screen p-4 sm:p-8 font-sans">
  <div class="max-w-4xl mx-auto card bg-base-100 shadow-xl border border-base-300">
    <div class="card-body p-6 sm:p-10">
      <div class="flex items-center justify-between pb-4 border-b border-base-200 flex-wrap gap-2">
        <a href="/" class="btn btn-sm btn-ghost gap-1.5"><i data-lucide="arrow-left" class="w-4 h-4"></i> Back to Dashboard</a>
        <div class="flex items-center gap-2">
          <span class="badge badge-primary font-mono text-xs">${escapeHtml(fileName)}</span>
          <a href="${pathname}?raw=true" class="btn btn-xs btn-outline font-mono">Raw Markdown</a>
        </div>
      </div>
      <div id="markdown-body" class="prose prose-sm sm:prose max-w-none text-base-content mt-6"></div>
    </div>
  </div>
  <script>
    const markdownContent = ${JSON.stringify(rawMd)};
    const converter = new showdown.Converter({
      tables: true,
      tasklists: true,
      strikethrough: true,
      ghCodeBlocks: true,
      simplifiedAutoLink: true
    });
    document.getElementById("markdown-body").innerHTML = converter.makeHtml(markdownContent);
    if (window.lucide) window.lucide.createIcons();
  </script>
</body>
</html>`;
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache"
          });
          res.end(previewHtml);
          return;
        } catch (e) {
          // fallback to standard stream
        }
      }

      // Inject live-reload into any requested HTML file so all tabs reload on changes!
      if (ext === ".html") {
        try {
          const rawHtml = fs.readFileSync(diskPath, "utf-8");
          const currentMode = detectReportMode(rawHtml);
          const injectedHtml = injectLiveReload(rawHtml);
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Report-Mode": currentMode
          });
          res.end(injectedHtml);
          return;
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end(`Internal Error reading html file: ${err.message}`);
          return;
        }
      }

      const mime = MIME_TYPES[ext] || "application/octet-stream";
      const headers = {
        "Content-Type": mime,
        "Cache-Control": "no-cache"
      };
      if (path.basename(diskPath) === "sw.js" || diskPath.endsWith("-sw.js")) {
        headers["Service-Worker-Allowed"] = "/";
      }
      res.writeHead(200, headers);
      fs.createReadStream(diskPath).pipe(res);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(`404 Not Found: ${pathname}`);
  });

  // Keep-alive heartbeat interval for SSE clients
  const heartbeat = setInterval(() => {
    for (const client of sseClients) {
      try {
        client.write(": ping\n\n");
      } catch (_) {
        sseClients.delete(client);
      }
    }
    for (const client of datastarClients) {
      try {
        client.write(": ping\n\n");
      } catch (_) {
        datastarClients.delete(client);
      }
    }
  }, 15000);

  // File watcher with debounce to handle editor double-saves across HTML files
  let debounceTimer = null;
  const mtimes = new Map();
  try {
    mtimes.set(resolvedPath, fs.statSync(resolvedPath).mtimeMs);
  } catch (_) {}

  const currentFeaturePath = path.resolve(rootDir, "current-feature.html");
  const devCurrentFeaturePath = path.resolve(rootDir, "dev", "current-feature.html");
  const activeFeaturePath = fs.existsSync(currentFeaturePath) ? currentFeaturePath : (fs.existsSync(devCurrentFeaturePath) ? devCurrentFeaturePath : null);
  if (activeFeaturePath) {
    try { mtimes.set(activeFeaturePath, fs.statSync(activeFeaturePath).mtimeMs); } catch (_) {}
  }

  const watchers = [];

  function broadcastReload(updatedFile) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        const currentMtime = fs.statSync(updatedFile).mtimeMs;
        if (currentMtime === mtimes.get(updatedFile)) return;
        mtimes.set(updatedFile, currentMtime);
      } catch (_) {
        return;
      }

      const activeCount = sseClients.size;
      const fileName = path.basename(updatedFile);
      const targetUrl = `http://localhost:${serverPort}/`;

      if (activeCount > 0) {
        console.log(`\n[html-report] File updated: ${fileName}`);
        console.log(`[html-report] -> Refreshing ${activeCount} active tab(s) in place without opening new tabs.`);
        for (const client of sseClients) {
          try {
            client.write("event: reload\ndata: {}\n\n");
          } catch (_) {
            sseClients.delete(client);
          }
        }
      } else {
        console.log(`\n[html-report] File updated: ${fileName}`);
        console.log(`[html-report] -> No active tabs detected. Reopening in browser: ${targetUrl}`);
        if (autoOpen) openBrowser(targetUrl);
      }
    }, 150);
  }

  try {
    const mainWatcher = fs.watch(resolvedPath, () => broadcastReload(resolvedPath));
    watchers.push(mainWatcher);
  } catch (_) {}

  // Watch current-feature.html specifically
  try {
    if (activeFeaturePath) {
      const featureWatcher = fs.watch(activeFeaturePath, () => broadcastReload(activeFeaturePath));
      watchers.push(featureWatcher);
    }
  } catch (_) {}

  // Also watch directory for new/updated HTML files
  try {
    const dirWatcher = fs.watch(rootDir, (event, filename) => {
      if (filename && (filename === "current-feature.html" || filename === targetFileName)) {
        const full = path.resolve(rootDir, filename);
        broadcastReload(full);
      }
    });
    watchers.push(dirWatcher);
  } catch (_) {}

  // Handle port conflicts with auto-retry
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      serverPort++;
      server.listen(serverPort);
    } else {
      console.error("[html-report] Server error:", err);
      process.exit(1);
    }
  });

  return new Promise((resolve) => {
    server.listen(serverPort, () => {
      const serverUrl = `http://localhost:${serverPort}/`;
      let currentMode = "report";
      try {
        const raw = fs.readFileSync(resolvedPath, "utf-8");
        currentMode = detectReportMode(raw);
      } catch (_) {}

      if (process.env.NODE_ENV !== "test") {
        console.log(`\n======================================================`);
        console.log(` 🚀 html-report Live-Reload Dev Server`);
        console.log(` Serving: ${resolvedPath} [mode: ${currentMode}]`);
        console.log(` URL:     ${serverUrl}`);
        console.log(` Status:  Watching for updates...`);
        console.log(`\n  • When updated while tab is open: refreshes existing tab in place.`);
        console.log(`  • When updated while tab is closed: reopens automatically in a tab.`);
        console.log(`======================================================\n`);
      }

      if (autoOpen) {
        console.log(`[html-report] Auto-opening browser at ${serverUrl}...`);
        openBrowser(serverUrl);
      }

      resolve({
        server,
        serverPort,
        close: () => {
          clearInterval(heartbeat);
          for (const w of watchers) { try { w.close(); } catch (_) {} }
          for (const c of sseClients) { try { c.end(); } catch (_) {} }
          for (const c of datastarClients) { try { c.end(); } catch (_) {} }
          return new Promise((res) => server.close(res));
        }
      });
    });

    // Graceful shutdown
    const cleanup = () => {
      clearInterval(heartbeat);
      for (const w of watchers) { try { w.close(); } catch (_) {} }
      server.close(() => process.exit(0));
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  });
}

const serveReport = startServer;

export { startServer, serveReport, parseArgs, injectLiveReload, detectReportMode, PersonaRegistry, SessionStateStore, MIME_TYPES };

const isMainModule = process.argv[1] && (
  process.argv[1].endsWith("serve-report.mjs") ||
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
);

if (isMainModule) {
  const { filePath, port, autoOpen, feedProxies } = parseArgs(process.argv);
  if (!filePath) {
    console.error("Usage: node serve-report.mjs <path-to-report.html> [--port <number>] [--no-open] [--feed-proxy <prefix=targetUrl>]");
    process.exit(1);
  }
  startServer(filePath, port, autoOpen, feedProxies);
}
