#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec, execFile, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { DatastarBridge, escapeHtml } from "./datastar-sse.mjs";
import {
  DAISYUI_THEMES,
  TARGET_DEFINITIONS,
  ADDON_CATALOG,
  WIDGET_PRESETS,
  normalizeDomainConfig,
  resolveSiblingSkill,
  generateCliCommand,
  generateDeterministicPrompt
} from "./domain-model.mjs";
import { buildReport } from "./build-report.mjs";
import { scaffoldProject, slugifyProject } from "./scaffold-project.mjs";
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
import {
  AgentInferenceRouter,
  isDirectCliExecution
} from "./preflight.mjs";

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

function isPathInside(baseDir, targetPath) {
  const rel = path.relative(path.resolve(baseDir), path.resolve(targetPath));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function isLoopbackAddress(addr = "") {
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

let cachedVerifyResult = null;
let cachedVerifyExpiresAt = 0;

function findWorkspaceRoot(startDir) {
  let curr = path.resolve(startDir);
  while (curr && curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, ".git"))) {
      return curr;
    }
    const pkgPath = path.join(curr, "package.json");
    if (fs.existsSync(pkgPath)) {
      const parentBase = path.basename(path.dirname(curr));
      let isProjectSubpackage = parentBase === "projects";
      if (!isProjectSubpackage) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          if (pkg && typeof pkg.name === "string" && pkg.name.startsWith("html-report-project-")) {
            isProjectSubpackage = true;
          }
        } catch (_) {}
      }
      if (!isProjectSubpackage) {
        return curr;
      }
    }
    curr = path.dirname(curr);
  }
  return path.resolve(startDir);
}

function extractProjectMetadata(fullPath, relPath, workspaceRoot) {
  let title = path.basename(relPath, ".html");
  let version = "0.0.0-beta.1";
  let description = "";

  try {
    const fd = fs.openSync(fullPath, "r");
    const buffer = Buffer.alloc(8192);
    const bytesRead = fs.readSync(fd, buffer, 0, 8192, 0);
    fs.closeSync(fd);
    const headChunk = buffer.toString("utf-8", 0, bytesRead);

    // Title extraction: <title>...</title>
    const titleMatch = headChunk.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1].trim()) {
      title = titleMatch[1].trim();
    } else if (relPath.includes("openspec/changes/")) {
      const match = relPath.match(/openspec\/changes\/([^\/]+)/);
      if (match) {
        title = match[1].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " - Journey";
      }
    }

    // Version extraction
    const versionMatch =
      headChunk.match(/data-(?:report-)?version=["']([^"']+)["']/i) ||
      headChunk.match(/<!--\s*(?:VERSION|version):\s*([^\s-]+)\s*-->/i) ||
      headChunk.match(/<meta\s+name=["']version["']\s+content=["']([^"']+)["']/i) ||
      headChunk.match(/title=["']Semantic Versioning v([^"']+)["']/i) ||
      headChunk.match(/<!--\s*v?(\d+\.\d+\.\d+)\s*-->/);

    if (versionMatch && versionMatch[1] && !versionMatch[1].includes("{{")) {
      version = versionMatch[1].replace(/^v/, "").trim();
    } else {
      const pkgVer = getPackageVersion(workspaceRoot);
      if (pkgVer && pkgVer !== "unknown") {
        version = pkgVer.startsWith("v") ? pkgVer.slice(1) : pkgVer;
      }
    }

    // Description extraction
    const descMatch = headChunk.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (descMatch && descMatch[1].trim()) {
      description = descMatch[1].trim();
    }
  } catch (_) {}

  // Category determination
  let category = "HTML Report";
  const normalizedRel = relPath.replace(/\\/g, "/");
  const isFragment = path.basename(normalizedRel).includes("fragment");

  if (normalizedRel.startsWith("projects/")) {
    category = "Workspace Project";
  } else if (normalizedRel.startsWith("openspec/changes/")) {
    category = isFragment ? "OpenSpec Fragment" : "OpenSpec Journey";
  } else if (normalizedRel.startsWith("benchmark/")) {
    category = "Performance Benchmark";
  } else if (normalizedRel.startsWith("research/")) {
    category = "Research Report";
  } else if (normalizedRel.startsWith("dev/")) {
    category = "Dev Prototype";
  } else if (normalizedRel.startsWith("experiments/")) {
    category = "Experiment";
  } else if (normalizedRel.startsWith("reports/") || normalizedRel === "report.html") {
    category = "Analytical Report";
  } else if (normalizedRel.includes("examples/")) {
    category = "Showcase Example";
  } else if (path.basename(normalizedRel) === "create.html") {
    category = "Creation Studio";
  } else if (isFragment) {
    category = "HTML Fragment";
  }

  let stat;
  try {
    stat = fs.statSync(fullPath);
  } catch (_) {
    stat = { size: 0, mtime: new Date() };
  }

  return {
    title,
    path: normalizedRel,
    url: "/" + normalizedRel,
    category,
    version,
    updatedAt: stat.mtime.toISOString(),
    size: stat.size,
    description
  };
}

function scanWorkspaceProjects(workspaceRoot, maxDepth = 4) {
  const projectsDir = path.join(workspaceRoot, "projects");
  if (!fs.existsSync(projectsDir)) {
    return [];
  }

  const IGNORED_DIRS = new Set([
    ".git",
    "node_modules",
    ".cache",
    ".gemini",
    "coverage",
    "dist",
    "build",
    ".system_generated",
    "tmp",
    ".local",
    "tests"
  ]);

  const projects = [];

  function isIgnoredDir(name) {
    if (IGNORED_DIRS.has(name)) return true;
    if (name.startsWith(".") && name !== ".openspec.yaml") return true;
    if (name.startsWith("tmp-") || name.startsWith("tmp.")) return true;
    return false;
  }

  const visitedRealPaths = new Set();

  function walk(currentDir, depth) {
    if (depth > maxDepth) return;
    let realCurrent;
    try {
      realCurrent = fs.realpathSync(currentDir);
    } catch (_) {
      realCurrent = currentDir;
    }
    if (visitedRealPaths.has(realCurrent)) return;
    visitedRealPaths.add(realCurrent);

    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (_) {
      return;
    }

    const subdirs = [];
    const htmlFiles = [];

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        if (!isIgnoredDir(entry.name)) {
          subdirs.push(path.join(currentDir, entry.name));
        }
      } else if (entry.isFile() && entry.name.endsWith(".html")) {
        if (entry.name.includes("fragment")) continue;
        htmlFiles.push(entry.name);
      }
    }

    // Prefer a single primary entry point per directory (index.html over published snapshot)
    if (htmlFiles.length > 0) {
      const primaryFile = htmlFiles.includes("index.html")
        ? "index.html"
        : (htmlFiles.find((f) => !f.includes("published")) || htmlFiles[0]);
      const fullPath = path.join(currentDir, primaryFile);
      const relPath = path.relative(workspaceRoot, fullPath);
      projects.push(extractProjectMetadata(fullPath, relPath, workspaceRoot));
    }

    for (const sub of subdirs) {
      walk(sub, depth + 1);
    }
  }

  walk(projectsDir, 0);

  projects.sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return projects;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let filePath = null;
  let port = 3031;
  let autoOpen = process.env.HTML_REPORT_NO_OPEN !== "1";
  const feedProxies = [];

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--port" || args[i] === "-p") && args[i + 1]) {
      port = parseInt(args[++i], 10) || 3031;
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

// Server-Connected live-reload script: injected only at HTTP serve time (never into Static File builds).
function injectLiveReload(html) {
  const liveReloadScript = `
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
      let sseConnectedOnce = false;
      let sseDisconnected = false;
      es.addEventListener("open", () => {
        if (sseDisconnected) {
          sseDisconnected = false;
          window.dispatchEvent(new CustomEvent("html-report:server-reconnected"));
        }
        sseConnectedOnce = true;
      });
      es.addEventListener("error", () => {
        if (sseConnectedOnce) sseDisconnected = true;
      });
      es.addEventListener("reload", onChange);
      es.addEventListener("projects-changed", () => {
        if (typeof window.loadWorkspaceProjects === "function") {
          window.loadWorkspaceProjects({ refresh: true });
        } else {
          window.dispatchEvent(new CustomEvent("html-report:projects-changed"));
        }
      });
      window.addEventListener("beforeunload", () => {
        try { es.close(); } catch (_) {}
      });
    })();
  </script>
`;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${liveReloadScript}\n</body>`);
  }
  if (html.includes("</html>")) {
    return html.replace("</html>", `${liveReloadScript}\n</html>`);
  }
  return html + liveReloadScript;
}

function detectReportMode(htmlContent) {
  if (!htmlContent || typeof htmlContent !== "string") return "report";
  const match = htmlContent.match(/<html[^>]*data-report-mode=["']([^"']+)["']/i);
  return match ? match[1].toLowerCase() : "report";
}

async function startServer(targetFilePathOrOptions, initialPort = 3031, autoOpen = true, feedProxies = []) {
  let targetFilePath = targetFilePathOrOptions;
  if (targetFilePathOrOptions && typeof targetFilePathOrOptions === "object" && !Array.isArray(targetFilePathOrOptions)) {
    targetFilePath = targetFilePathOrOptions.file || targetFilePathOrOptions.filePath || targetFilePathOrOptions.targetFilePath;
    initialPort = targetFilePathOrOptions.port !== undefined ? targetFilePathOrOptions.port : 3031;
    autoOpen = targetFilePathOrOptions.autoOpen !== undefined ? targetFilePathOrOptions.autoOpen : false;
    feedProxies = targetFilePathOrOptions.feedProxies || [];
  }
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
  let projectsCache = { timestamp: 0, data: null };
  let projectsDebounceTimer = null;

  function broadcastProjectsChanged() {
    projectsCache = { timestamp: 0, data: null };
    clearTimeout(projectsDebounceTimer);
    projectsDebounceTimer = setTimeout(() => {
      for (const client of sseClients) {
        try {
          client.write("event: projects-changed\ndata: {}\n\n");
        } catch (_) {
          sseClients.delete(client);
        }
      }
    }, 100);
  }

  const personaRegistry = new PersonaRegistry();
  personaRegistry.loadFromDisk(rootDir);

  const sessionStore = new SessionStateStore();
  const csrfManager = new CSRFManager();
  const allowlistManager = new AllowlistManager();

  // Turnkey Board State Persistence (in-memory + disk inside project/temp directories)
  const workspaceRootForState = findWorkspaceRoot(rootDir);
  const boardStateFile = path.join(rootDir, ".board-state.json");
  const shouldPersistBoardStateToDisk =
    path.resolve(rootDir) !== path.resolve(workspaceRootForState) ||
    fs.existsSync(path.join(rootDir, "report.manifest.json")) ||
    fs.existsSync(boardStateFile);

  let boardState = {
    updatedAt: null
  };
  if (fs.existsSync(boardStateFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(boardStateFile, "utf-8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        boardState = parsed;
      }
    } catch (_) {}
  }

  function saveBoardState(nextState) {
    boardState = {
      ...boardState,
      ...nextState,
      updatedAt: new Date().toISOString()
    };
    try {
      fs.writeFileSync(boardStateFile, JSON.stringify(boardState, null, 2) + "\n", "utf-8");
    } catch (_) {}
    return boardState;
  }

  function isValidLocalOrigin(originHeader) {
    if (!originHeader || originHeader === "null") return false;
    try {
      const originUrl = new URL(originHeader);
      if (originUrl.protocol !== "http:" && originUrl.protocol !== "https:") return false;
      const host = originUrl.hostname.toLowerCase();
      return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
    } catch (_) {
      return false;
    }
  }

  function applyLocalCorsHeaders(req, headers = {}) {
    const originHeader = req.headers.origin;
    if (originHeader && isValidLocalOrigin(originHeader)) {
      return {
        ...headers,
        "Access-Control-Allow-Origin": originHeader,
        Vary: "Origin"
      };
    }
    return headers;
  }

  function enforceLocalBridgeSecurity(req, res, options = {}) {
    const { requireCsrf = false, csrfToken = null } = options;
    const remoteAddr = req.socket?.remoteAddress || "";
    if (!isLoopbackAddress(remoteAddr)) {
      res.writeHead(403, { "Content-Type": "application/json", "Cache-Control": "no-cache, no-store" });
      res.end(JSON.stringify({ ok: false, error: "Forbidden: Bridge is restricted to localhost loopback." }));
      return false;
    }
    const hostHeader = String(req.headers.host || "");
    if (hostHeader && !CSRFManager.validateHost(hostHeader)) {
      res.writeHead(403, { "Content-Type": "application/json", "Cache-Control": "no-cache, no-store" });
      res.end(JSON.stringify({ ok: false, error: "Forbidden: Host must be localhost or 127.0.0.1" }));
      return false;
    }
    const originHeader = req.headers.origin;
    if (originHeader !== undefined && !isValidLocalOrigin(originHeader)) {
      res.writeHead(403, { "Content-Type": "application/json", "Cache-Control": "no-cache, no-store" });
      res.end(JSON.stringify({ ok: false, error: "Forbidden: Cross-origin bridge request rejected." }));
      return false;
    }
    if (requireCsrf && originHeader !== undefined) {
      const token = csrfToken || req.headers["x-csrf-token"];
      if (!csrfManager.validateToken(token)) {
        res.writeHead(401, applyLocalCorsHeaders(req, { "Content-Type": "application/json", "Cache-Control": "no-cache, no-store" }));
        res.end(JSON.stringify({ ok: false, code: "invalid_csrf", error: "Unauthorized: Invalid or missing CSRF token." }));
        return false;
      }
    }
    return true;
  }

  function isSameOriginOrLocalRequest(req) {
    const hostHeader = String(req.headers.host || "");
    if (hostHeader && !CSRFManager.validateHost(hostHeader)) {
      return false;
    }
    const originHeader = req.headers.origin;
    if (originHeader !== undefined && !isValidLocalOrigin(originHeader)) {
      return false;
    }
    return true;
  }

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

    // 1a. Datastar Real-Time SSE Stream Endpoint (/events, /api/events, /__datastar_stream__)
    if (pathname === "/__datastar_stream__" || pathname === "/events" || pathname === "/api/events") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, datastar-request, Cache-Control"
        });
        res.end();
        return;
      }

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
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });
      const initialStatusHtml = `<div id="live-board-status" data-board-updated="${boardState.updatedAt || "initial"}">Live stream connected</div>`;
      res.write(
        `: connected\n\nevent: connected\ndata: {"ok":true}\n\nevent: board-state\ndata: ${JSON.stringify(boardState)}\n\nevent: datastar-merge-fragments\ndata: fragments ${initialStatusHtml}\n\n`
      );

      datastarClients.add(res);
      if (process.env.NODE_ENV !== "test") {
        console.log(`[html-report] Datastar SSE stream connected on ${pathname} (active listeners: ${datastarClients.size})`);
      }

      req.on("close", () => {
        datastarClients.delete(res);
        if (process.env.NODE_ENV !== "test") {
          console.log(`[html-report] Datastar SSE stream disconnected (remaining listeners: ${datastarClients.size})`);
        }
      });
      return;
    }

    // 1a-2. Turnkey Board State Persistence & SSE Broadcast (GET/POST /api/board/state)
    if (pathname === "/api/board/state") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": `http://localhost:${serverPort}`,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, datastar-request"
        });
        res.end();
        return;
      }

      if (req.method === "GET") {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store"
        });
        res.end(JSON.stringify({
          ok: true,
          state: boardState,
          updatedAt: boardState.updatedAt
        }));
        return;
      }

      if (req.method === "POST") {
        if (!isSameOriginOrLocalRequest(req)) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            ok: false,
            error: "Forbidden: Cross-origin board state mutation rejected."
          }));
          return;
        }

        let body = "";
        let tooLarge = false;
        req.on("data", (chunk) => {
          body += chunk;
          if (body.length > 1024 * 1024) {
            tooLarge = true;
            req.destroy();
          }
        });
        req.on("end", () => {
          if (tooLarge) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "Payload too large (1MB limit)." }));
            return;
          }

          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch (_) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "Invalid JSON payload: expected a JSON object." }));
            return;
          }

          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "Invalid board state: JSON object required." }));
            return;
          }

          const updated = saveBoardState(parsed);
          const stateEventPayload = `event: board-state\ndata: ${JSON.stringify(updated)}\n\n`;
          for (const client of datastarClients) {
            try { client.write(stateEventPayload); } catch (_) { datastarClients.delete(client); }
          }
          const statusHtml = `<div id="live-board-status" data-board-updated="${escapeHtml(updated.updatedAt)}" class="text-xs font-mono text-success">Saved ${escapeHtml(new Date(updated.updatedAt).toLocaleTimeString())}</div>`;
          broadcastDatastarFragment({
            selector: "#live-board-status",
            html: statusHtml,
            merge: "morph"
          });

          const isDatastarReq =
            req.headers["datastar-request"] === "true" ||
            (req.headers.accept || "").includes("text/event-stream");

          if (isDatastarReq) {
            res.writeHead(200, {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform"
            });
            res.write(DatastarBridge.formatFragment({ selector: "#live-board-status", html: statusHtml, merge: "morph" }));
            res.end();
            return;
          }

          res.writeHead(200, {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store"
          });
          res.end(JSON.stringify({
            ok: true,
            state: updated,
            updatedAt: updated.updatedAt,
            listeners: datastarClients.size
          }));
        });
        return;
      }
    }

    // 1a-2b. Ephemeral Agent Bridge CSRF Token (GET /api/agent/csrf-token)
    if (pathname === "/api/agent/csrf-token" && req.method === "GET") {
      if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return;
      const tokenData = csrfManager.generateToken();
      res.writeHead(200, applyLocalCorsHeaders(req, {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store"
      }));
      res.end(JSON.stringify({ ok: true, ...tokenData }));
      return;
    }

    // 1a-3. Turnkey AI Preflight & Health Endpoint (GET /api/agent/preflight & /api/agent/health)
    if ((pathname === "/api/agent/preflight" || pathname === "/api/agent/health") && req.method === "GET") {
      const shouldVerify = parsedUrl.searchParams.get("verify") === "1" || parsedUrl.searchParams.get("probe") === "1";
      const isLocalCaller = isLoopbackAddress(req.socket?.remoteAddress || "")
        && (!req.headers.host || CSRFManager.validateHost(req.headers.host))
        && (req.headers.origin === undefined || isValidLocalOrigin(req.headers.origin));
      const respondPreflight = (providerStatus, verification = null) => {
        const inferenceVerified = verification ? Boolean(verification.inferenceVerified) : Boolean(providerStatus.inferenceVerified);
        const hasVerifiedProvider = Boolean(
          providerStatus.providerAvailable &&
          (providerStatus.authenticated || inferenceVerified)
        );
        const secureBridge = Boolean(isLocalCaller && hasVerifiedProvider);
        const csrfToken = secureBridge ? csrfManager.generateToken().csrfToken : null;
        res.writeHead(200, applyLocalCorsHeaders(req, {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store"
        }));
        res.end(JSON.stringify({
          ok: true,
          bridge: "online",
          uiConfigured: true,
          bridgeReachable: true,
          secureBridge,
          csrfRequired: true,
          csrfEndpoint: "/api/agent/csrf-token",
          ...(csrfToken ? { csrfToken } : {}),
          installed: providerStatus.installed,
          authenticated: providerStatus.authenticated,
          inferenceVerified,
          providerAvailable: providerStatus.providerAvailable,
          activeProvider: providerStatus.activeProvider,
          activeProviderName: providerStatus.activeProviderName,
          availableProviders: providerStatus.availableProviders,
          authenticatedProviders: providerStatus.authenticatedProviders,
          checkedProviders: providerStatus.checkedProviders,
          ...(verification ? { verification } : {}),
          ai: {
            available: providerStatus.providerAvailable,
            installed: providerStatus.installed,
            authenticated: providerStatus.authenticated,
            inferenceVerified,
            providerAvailable: providerStatus.providerAvailable,
            activeProvider: providerStatus.activeProvider,
            activeProviderName: providerStatus.activeProviderName,
            availableProviders: providerStatus.availableProviders,
            authenticatedProviders: providerStatus.authenticatedProviders,
            checkedProviders: providerStatus.checkedProviders
          },
          streamConnected: datastarClients.size > 0,
          streamListeners: datastarClients.size,
          modelConfigured: true,
          defaultModel: "Gemini 3.8 Flash (Low)",
          port: serverPort,
          version: getPackageVersion()
        }));
      };

      const providerStatus = AgentInferenceRouter.detectProviders();
      if (shouldVerify) {
        const remoteAddr = req.socket?.remoteAddress || "";
        const origin = req.headers.origin || "";
        const isLocalOrigin = !origin || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);
        if (!isLoopbackAddress(remoteAddr) || !isLocalOrigin) {
          respondPreflight(providerStatus, {
            ok: false,
            inferenceVerified: false,
            verificationError: "Live inference probe is restricted to local requests."
          });
          return;
        }
        const now = Date.now();
        if (cachedVerifyResult && now < cachedVerifyExpiresAt) {
          respondPreflight(providerStatus, cachedVerifyResult);
          return;
        }
        AgentInferenceRouter.verifyInference({ timeoutMs: 12000 })
          .then((verification) => {
            cachedVerifyResult = verification;
            cachedVerifyExpiresAt = Date.now() + 30000;
            respondPreflight(providerStatus, verification);
          })
          .catch((err) => respondPreflight(providerStatus, { ok: false, inferenceVerified: false, error: err.message }));
        return;
      }
      respondPreflight(providerStatus);
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
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return;
        res.writeHead(204, applyLocalCorsHeaders(req, {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Report-Agent, X-CSRF-Token, datastar-request"
        }));
        res.end();
        return;
      }

      if (req.method === "POST") {
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return;
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          let payload = {};
          try { payload = JSON.parse(body); } catch (_) {}
          if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: true, csrfToken: payload.csrfToken })) return;

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
              res.writeHead(200, applyLocalCorsHeaders(req, {
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive"
              }));

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
            res.writeHead(200, applyLocalCorsHeaders(req, {
              "Content-Type": "application/json"
            }));
            res.end(JSON.stringify({
              ok: true,
              sessionId,
              result: responseText,
              action,
              targetSelector,
              persona: persona.id,
              provider: activeProvider,
              history: session.history,
              timestamp: new Date().toISOString()
            }));
          };

          let activeProvider = "heuristic";
          if (payload.heuristic === true) {
            const responseText = isMutatingPrompt
              ? `[Demo Fixture] Simulated adjustment preview for ${targetSelector || "target element"} under persona '${persona.name}'. (Demo-only fixture; no live telemetry recalculated).`
              : `[Demo Fixture] Simulated response for ${context.elementId || "document"} under persona '${persona.name}'. (Demo-only fixture; live AI provider not invoked).`;
            let action = null;
            if (isMutatingPrompt) {
              action = {
                id: `act_${Date.now().toString(36)}`,
                type: "recalculate_metric",
                description: `[Demo Fixture] Preview action for ${targetSelector || "selected element"}`,
                preview: JSON.stringify({ fixture: true, target: targetSelector || "document", status: "demo_only" }, null, 2)
              };
              sessionStore.storePendingAction(sessionId, action);
            }
            handleDispatch(responseText, action);
            return;
          }

          AgentInferenceRouter.dispatch({
            prompt,
            systemPrompt,
            model,
            provider: payload.provider || null,
            timeoutMs: 25000,
            throwOnError: true
          })
            .then((dispatchResult) => {
              activeProvider = dispatchResult.provider || null;
              const responseText = String(dispatchResult.text || "").trim().replace(/^["']|["']$/g, "");
              if (!responseText) {
                const emptyErr = new Error("AI inference provider returned an empty response.");
                emptyErr.code = "inference_unavailable";
                emptyErr.reason = "Provider returned empty output.";
                throw emptyErr;
              }
              let action = null;
              if (isMutatingPrompt) {
                action = {
                  id: `act_${Date.now().toString(36)}`,
                  type: "recalculate_metric",
                  description: `Apply filter and recalculate metrics for ${targetSelector || "selected element"}`,
                  preview: JSON.stringify({ target: targetSelector || "document", status: "ready" }, null, 2)
                };
                sessionStore.storePendingAction(sessionId, action);
              }
              handleDispatch(responseText, action);
            })
            .catch((err) => {
              const preflightInfo = err.preflight || AgentInferenceRouter.detectProviders();
              res.writeHead(503, applyLocalCorsHeaders(req, {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache, no-store"
              }));
              res.end(JSON.stringify({
                ok: false,
                status: "error",
                code: err.code || "inference_unavailable",
                error: err.message || "AI inference provider is unavailable.",
                reason: err.reason || err.message || "No AI CLI or HTTP LLM provider is configured or reachable.",
                sessionId,
                preflight: preflightInfo,
                timestamp: new Date().toISOString()
              }));
            });
        });
        return;
      }
    }

    if (pathname === "/api/agent/confirm-action" || pathname === "/api/agent/action-confirm") {
      if (req.method === "OPTIONS") {
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return;
        res.writeHead(204, applyLocalCorsHeaders(req, {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Report-Agent, X-CSRF-Token"
        }));
        res.end();
        return;
      }

      if (req.method === "POST") {
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return;
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          let payload = {};
          try { payload = JSON.parse(body); } catch (_) {}
          if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: true, csrfToken: payload.csrfToken })) return;

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

          res.writeHead(200, applyLocalCorsHeaders(req, {
            "Content-Type": "application/json"
          }));
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
        port: serverPort,
        supervised: process.env.HTML_REPORT_SUPERVISED === "1",
        capabilities: [
          "scaffold",
          "synthesize",
          "upload",
          "workspace-files",
          ...(process.env.HTML_REPORT_SUPERVISED === "1" ? ["self-restart"] : [])
        ],
        themes: DAISYUI_THEMES,
        targets: TARGET_DEFINITIONS,
        addons: ADDON_CATALOG,
        widgets: WIDGET_PRESETS
      }));
      return;
    }

    if (pathname === "/api/server/restart" && req.method === "POST") {
      const remoteAddr = req.socket?.remoteAddress || "";
      const origin = req.headers.origin || "";
      const isLocalOrigin = !origin || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);
      if (!isLoopbackAddress(remoteAddr) || !isLocalOrigin) {
        res.writeHead(403, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ ok: false, error: "Server restart is restricted to localhost." }));
        return;
      }
      if (process.env.HTML_REPORT_SUPERVISED === "1" && typeof process.send === "function") {
        res.writeHead(202, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ ok: true, restarting: true }));
        setTimeout(() => {
          try { process.send({ type: "restart", reason: "api-request" }); } catch (_) {}
        }, 50);
      } else {
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({
          ok: false,
          supported: false,
          error: "Server is not running under supervised auto-restart mode."
        }));
      }
      return;
    }

    if (pathname === "/api/create/scaffold") {
      if (req.method === "OPTIONS") {
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return;
        res.writeHead(204, applyLocalCorsHeaders(req, {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token"
        }));
        res.end();
        return;
      }
      if (req.method === "POST") {
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return;
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          try {
            const payload = body ? JSON.parse(body) : {};
            if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: true, csrfToken: payload.csrfToken })) return;
            const workspaceRoot = findWorkspaceRoot(rootDir);
            const target = String(payload.target || "report").trim().toLowerCase();
            const rawGoals = typeof payload.userGoals === "string"
              ? payload.userGoals
              : (typeof payload.goals === "string" ? payload.goals : "");
            const rawTitle = typeof payload.title === "string"
              ? payload.title
              : (typeof payload.heroTitle === "string" ? payload.heroTitle : "");
            const explicitSlug = slugifyProject(
              payload.projectSlug || payload.slug || payload.project || ""
            );
            const derivedSlug = explicitSlug ||
              slugifyProject(rawGoals || rawTitle || `${target}-project`) ||
              `${target || "report"}-project`;

            const opMode = payload.operationalMode === "live" || payload.servingMode === "live" || payload.mode === "live-report" || payload.mode === "dashboard"
              ? "live"
              : "static";
            const scaffoldMode = payload.mode ||
              (opMode === "live" && target === "report" ? "live-report" : target);
            const appPkg = payload.appPackaging || payload.app || "browser";
            const pwaEnabled = Boolean(payload.pwa || (appPkg !== "browser" && appPkg !== "none"));
            const displayTitle = rawTitle.trim() ||
              (rawGoals.trim()
                ? (rawGoals.trim().length > 55 ? rawGoals.trim().slice(0, 52) + "..." : rawGoals.trim())
                : derivedSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));

            const force = Boolean(payload.force);
            const result = scaffoldProject({
              project: derivedSlug,
              title: displayTitle,
              mode: scaffoldMode,
              theme: payload.theme || payload.defaultStartupTheme || "light",
              customTheme: payload.customTheme || payload.customBrandColorHex || null,
              addons: Array.isArray(payload.addons) ? payload.addons : [],
              widgets: Array.isArray(payload.widgets) ? payload.widgets : [],
              referenceFiles: Array.isArray(payload.referenceFiles) ? payload.referenceFiles : [],
              servingMode: payload.servingMode || opMode,
              behavioralMode: payload.behavioralMode || (scaffoldMode === "print" ? "passive" : "interactive"),
              goals: rawGoals.trim(),
              audience: typeof payload.userAudience === "string" ? payload.userAudience.trim() : (typeof payload.audience === "string" ? payload.audience.trim() : ""),
              ai: Boolean(payload.ai),
              aiPort: Number(payload.aiPort) > 0 ? Number(payload.aiPort) : 3031,
              aiModel: payload.aiModel || "Gemini 3.8 Flash (Low)",
              aiPersona: payload.aiPersona || "analyst",
              aiPurpose: payload.aiPurpose || "",
              aiDock: payload.aiDock !== undefined ? Boolean(payload.aiDock) : true,
              pwa: pwaEnabled,
              content: typeof payload.content === "string" ? payload.content : null,
              force,
              avoidCollision: !force,
              rootDir: workspaceRoot,
              workspaceRoot
            });

            if (typeof attachProjectsWatcher === "function") attachProjectsWatcher();
            if (typeof syncProjectSubdirWatchers === "function") syncProjectSubdirWatchers();
            if (typeof broadcastProjectsChanged === "function") broadcastProjectsChanged();

            res.writeHead(200, applyLocalCorsHeaders(req, {
              "Content-Type": "application/json"
            }));
            res.end(JSON.stringify({
              ok: true,
              slug: result.slug,
              projectDir: `projects/${result.slug}`,
              entryUrl: `/projects/${result.slug}/index.html`,
              fragmentPath: `projects/${result.slug}/fragment.html`,
              manifestPath: `projects/${result.slug}/report.manifest.json`,
              stagedRefs: result.stagedRefs,
              datasets: result.datasets,
              manifest: result.manifest
            }));
          } catch (err) {
            res.writeHead(400, applyLocalCorsHeaders(req, {
              "Content-Type": "application/json"
            }));
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
        });
        return;
      }
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

    // 1b-3a. Creation Studio Reference File Upload & Workspace File Discovery
    if (pathname === "/api/create/upload") {
      if (req.method === "OPTIONS") {
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return;
        res.writeHead(204, applyLocalCorsHeaders(req, {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }));
        res.end();
        return;
      }
      if (req.method === "POST") {
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return;
        const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
        const chunks = [];
        let totalLen = 0;
        let aborted = false;
        req.on("data", (chunk) => {
          if (aborted) return;
          totalLen += chunk.length;
          if (totalLen > MAX_UPLOAD_BYTES * 1.4) {
            aborted = true;
            res.writeHead(413, applyLocalCorsHeaders(req, { "Content-Type": "application/json" }));
            res.end(JSON.stringify({ ok: false, error: "File exceeds 25 MB upload limit" }));
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        req.on("end", () => {
          if (aborted) return;
          try {
            const rawBody = Buffer.concat(chunks).toString("utf-8");
            const payload = rawBody ? JSON.parse(rawBody) : {};
            const rawName = String(payload.name || "").trim();
            const contentBase64 = typeof payload.contentBase64 === "string" ? payload.contentBase64 : "";
            if (!rawName) {
              res.writeHead(400, applyLocalCorsHeaders(req, { "Content-Type": "application/json" }));
              res.end(JSON.stringify({ ok: false, error: "Missing 'name'" }));
              return;
            }
            const baseName = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, "_");
            const safeName = (!baseName || baseName === "." || baseName === "..") ? `upload-${Date.now()}` : baseName;

            const workspaceRoot = findWorkspaceRoot(rootDir);
            const uploadsDir = path.join(workspaceRoot, "projects", "_uploads");
            fs.mkdirSync(uploadsDir, { recursive: true });

            const destPath = path.resolve(uploadsDir, safeName);
            const relFromUploads = path.relative(uploadsDir, destPath);
            if (relFromUploads.startsWith("..") || path.isAbsolute(relFromUploads) || relFromUploads === "") {
              res.writeHead(403, applyLocalCorsHeaders(req, { "Content-Type": "application/json" }));
              res.end(JSON.stringify({ ok: false, error: "Invalid upload filename" }));
              return;
            }

            const buffer = Buffer.from(contentBase64, "base64");
            if (buffer.length > MAX_UPLOAD_BYTES) {
              res.writeHead(413, applyLocalCorsHeaders(req, { "Content-Type": "application/json" }));
              res.end(JSON.stringify({ ok: false, error: "Decoded file exceeds 25 MB upload limit" }));
              return;
            }
            fs.writeFileSync(destPath, buffer);
            const relPath = path.relative(workspaceRoot, destPath).replace(/\\/g, "/");

            res.writeHead(200, applyLocalCorsHeaders(req, { "Content-Type": "application/json" }));
            res.end(JSON.stringify({
              ok: true,
              name: safeName,
              path: relPath,
              sizeBytes: buffer.length
            }));
          } catch (err) {
            res.writeHead(400, applyLocalCorsHeaders(req, { "Content-Type": "application/json" }));
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
        });
        return;
      }
    }

    if (pathname === "/api/create/workspace-files") {
      if (req.method === "OPTIONS") {
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return;
        res.writeHead(204, applyLocalCorsHeaders(req, {
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }));
        res.end();
        return;
      }
      if (req.method === "GET") {
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return;
        try {
          const workspaceRoot = findWorkspaceRoot(rootDir);
          const query = (parsedUrl.searchParams.get("q") || "").trim().toLowerCase();
          const SKIP_DIRS = new Set([
            "node_modules", ".git", ".agents", ".gemini", "dist", "build",
            ".next", "coverage", "playwright-report", "test-results"
          ]);
          const MAX_FILES = 300;
          const files = [];

          const walk = (dir, depth) => {
            if (depth > 6 || files.length >= MAX_FILES) return;
            let entries;
            try {
              entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch {
              return;
            }
            entries.sort((a, b) => a.name.localeCompare(b.name));
            for (const entry of entries) {
              if (files.length >= MAX_FILES) break;
              if (entry.isSymbolicLink()) continue;
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
                walk(full, depth + 1);
              } else if (entry.isFile()) {
                const rel = path.relative(workspaceRoot, full).replace(/\\/g, "/");
                if (query && !rel.toLowerCase().includes(query)) continue;
                let sizeBytes = 0;
                try {
                  sizeBytes = fs.statSync(full).size;
                } catch {}
                files.push({
                  name: entry.name,
                  path: rel,
                  sizeBytes
                });
              }
            }
          };
          walk(workspaceRoot, 0);

          res.writeHead(200, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache, no-store"
          });
          res.end(JSON.stringify({ ok: true, workspaceRoot, files }));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
        return;
      }
    }

    // 1b-3b. Workspace Projects Discovery & Management API (/api/projects)
    if (pathname === "/api/projects" || pathname === "/api/projects/delete") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        });
        res.end();
        return;
      }

      if (req.method === "DELETE" || (req.method === "POST" && pathname === "/api/projects/delete")) {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          try {
            const raw = body ? JSON.parse(body) : {};
            const targetRel = (raw.path || parsedUrl.searchParams.get("path") || "").trim();
            if (!targetRel) {
              res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
              res.end(JSON.stringify({ ok: false, error: "Missing 'path' parameter" }));
              return;
            }

            const workspaceRoot = findWorkspaceRoot(rootDir);
            const projectsDir = path.join(workspaceRoot, "projects");
            const fullTarget = path.resolve(workspaceRoot, targetRel);

            // Security guard: Ensure target is inside <workspaceRoot>/projects/ and not projects root itself
            const relFromProjects = path.relative(projectsDir, fullTarget);
            if (relFromProjects.startsWith("..") || relFromProjects === "" || path.isAbsolute(relFromProjects)) {
              res.writeHead(403, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
              res.end(JSON.stringify({ ok: false, error: "Access denied: Target must be inside projects/ directory" }));
              return;
            }

            // Determine target to delete: if file was provided inside a project subfolder, delete its containing folder;
            // if file is directly inside projects/, delete just that file.
            let targetToDelete = fullTarget;
            let isDirectFile = false;
            try {
              const stat = fs.lstatSync(fullTarget);
              if (stat.isFile()) {
                if (path.dirname(fullTarget) === projectsDir) {
                  isDirectFile = true;
                  targetToDelete = fullTarget;
                } else {
                  targetToDelete = path.dirname(fullTarget);
                }
              }
            } catch (_) {
              // If file not found directly, check if target was already a directory path
              if (fullTarget.endsWith(".html") && path.dirname(fullTarget) !== projectsDir) {
                targetToDelete = path.dirname(fullTarget);
              }
            }

            // Check if targetToDelete is inside projects and not projects itself
            const targetRelFromProjects = path.relative(projectsDir, targetToDelete);
            if (targetRelFromProjects.startsWith("..") || targetRelFromProjects === "") {
              res.writeHead(403, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
              res.end(JSON.stringify({ ok: false, error: "Cannot delete root projects directory" }));
              return;
            }

            // Delete project folder or direct file
            if (fs.existsSync(targetToDelete)) {
              if (isDirectFile) {
                fs.unlinkSync(targetToDelete);
              } else {
                fs.rmSync(targetToDelete, { recursive: true, force: true });
              }
            }

            // Also remove matching symlinks (e.g. trailing hyphen aliases)
            if (!isDirectFile) {
              try {
                const baseName = path.basename(targetToDelete);
                const siblingEntries = fs.readdirSync(projectsDir, { withFileTypes: true });
                for (const entry of siblingEntries) {
                  if (entry.isSymbolicLink() && (entry.name === baseName || entry.name.replace(/-+$/, "") === baseName.replace(/-+$/, ""))) {
                    fs.unlinkSync(path.join(projectsDir, entry.name));
                  }
                }
              } catch (_) {}
            }

            // Invalidate projects cache and notify connected tabs
            broadcastProjectsChanged();

            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify({ ok: true, deleted: path.relative(workspaceRoot, targetToDelete) }));
          } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
        });
        return;
      }

      if (req.method === "GET") {
        const now = Date.now();
        const workspaceRoot = findWorkspaceRoot(rootDir);
        const forceRefresh = parsedUrl.searchParams.get("refresh") === "1" || parsedUrl.searchParams.get("force") === "1";
        let projects;
        if (!forceRefresh && projectsCache.data && (now - projectsCache.timestamp < 5000)) {
          projects = projectsCache.data;
        } else {
          projects = scanWorkspaceProjects(workspaceRoot, 4);
          projectsCache = { timestamp: now, data: projects };
        }

        const q = parsedUrl.searchParams.get("search") || parsedUrl.searchParams.get("q");
        const cat = parsedUrl.searchParams.get("category");
        let filtered = projects;

        if (cat && cat.toLowerCase() !== "all") {
          filtered = filtered.filter((p) => p.category.toLowerCase() === cat.toLowerCase());
        }
        if (q) {
          const cleanQ = q.toLowerCase();
          filtered = filtered.filter((p) =>
            p.title.toLowerCase().includes(cleanQ) ||
            p.path.toLowerCase().includes(cleanQ) ||
            p.category.toLowerCase().includes(cleanQ) ||
            (p.description && p.description.toLowerCase().includes(cleanQ))
          );
        }

        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache, no-store"
        });
        res.end(JSON.stringify({ ok: true, count: filtered.length, projects: filtered }));
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
        res.writeHead(code, applyLocalCorsHeaders(req, { "Content-Type": "application/json", "Cache-Control": "no-cache, no-store" }));
        res.end(JSON.stringify(obj));
      };
      if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return;
      if (req.method !== "POST") return sendJson(405, { ok: false, error: "POST required." });
      let body = "";
      req.on("data", (chunk) => { body += chunk; if (body.length > 256 * 1024) req.destroy(); });
      req.on("end", () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (_) {}
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: true, csrfToken: payload.csrfToken })) return;
        const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
        if (!prompt) return sendJson(400, { ok: false, error: "Missing prompt." });
        const requested = typeof payload.file === "string" ? payload.file.trim() : "";
        if (requested && requested !== "/" && path.basename(requested) !== targetFileName) {
          return sendJson(403, { ok: false, error: `Edits are scoped to the served file (${targetFileName}).` });
        }
        const scoped = `You are editing the html-report page served from ${resolvedPath}. Only modify that report's source content and rebuild it; do not touch other files.\n\n${prompt}`;
        console.log(`[html-report] Agent edit requested for ${targetFileName}`);
        AgentInferenceRouter.dispatch({ prompt: scoped, systemPrompt: scoped, timeoutMs: 300000 })
          .then((dispatchResult) => {
            sendJson(200, {
              ok: true,
              file: targetFileName,
              provider: dispatchResult.provider,
              result: String(dispatchResult.text || "").trim()
            });
          })
          .catch((err) => {
            console.warn(`[html-report] Agent edit failed: ${err.message}`);
            return sendJson(502, {
              ok: false,
              code: err.code || "inference_unavailable",
              error: err.message || "Agent unavailable or timed out.",
              preflight: err.preflight || AgentInferenceRouter.detectProviders()
            });
          });
      });
      return;
    }

    // 1b-2. Universal Two-Way Agent Bridge & Co-Pilot (Agent-Agnostic Turnkey Bridge)
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
        const providerStatus = AgentInferenceRouter.detectProviders();
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache, no-store"
        });
        res.end(JSON.stringify({
          ok: true,
          bridge: providerStatus.activeProviderName
            ? `Turnkey AI Bridge (${providerStatus.activeProviderName} / agy CLI compatible)`
            : "Google Antigravity agy CLI Bridge",
          uiConfigured: true,
          bridgeReachable: true,
          installed: providerStatus.installed,
          authenticated: providerStatus.authenticated,
          inferenceVerified: Boolean(providerStatus.inferenceVerified),
          providerAvailable: providerStatus.providerAvailable,
          activeProvider: providerStatus.activeProvider,
          activeProviderName: providerStatus.activeProviderName,
          availableProviders: providerStatus.availableProviders,
          authenticatedProviders: providerStatus.authenticatedProviders,
          checkedProviders: providerStatus.checkedProviders,
          streamConnected: datastarClients.size > 0,
          streamListeners: datastarClients.size,
          modelConfigured: true,
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

          const completeAgentResponse = (isError, rawText, providerId, errObj = null) => {
            let responseText = "";
            if (isError) {
              if (errObj) {
                console.warn(`[html-report] Agent inference call failed: ${errObj.message}`);
              }
              responseText = payload.fallbackText || `[Local Fallback] Request evaluated for action '${action}'. Agent provider temporarily offline or timed out.`;
            } else {
              responseText = String(rawText || "").trim().replace(/^["']|["']$/g, "");
            }

            const engineLabel = isError
              ? "Local Heuristic Engine (Fallback)"
              : `Turnkey AI Bridge (${providerId || "agy"} • ${model})`;

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
                    <span>Engine: ${escapeHtml(engineLabel)}</span>
                    <span class="font-mono text-[10px] text-base-content/40">${escapeHtml(activePersona.id)}</span>
                  </div>
                </div>
              `.trim();

              res.write(DatastarBridge.formatFragment({ selector: targetSelector, html: fragment, merge: "morph" }));
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
              provider: providerId || null,
              result: responseText,
              oneliner: responseText,
              agent: engineLabel,
              isLiveAI: !isError,
              fallback: isError,
              timestamp: new Date().toISOString()
            }));
          };

          AgentInferenceRouter.dispatch({
            prompt,
            systemPrompt: `${personaPrompt}${formattingPrompt}`,
            model,
            provider: payload.provider || null,
            timeoutMs: 25000,
            throwOnError: true
          })
            .then((dispatchResult) => {
              const out = String(dispatchResult.text || "").trim();
              if (!out) {
                throw new Error("Empty inference output");
              }
              completeAgentResponse(false, out, dispatchResult.provider);
            })
            .catch((err) => {
              completeAgentResponse(true, "", null, err);
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

    // 2c. Dedicated Creation Studio PWA manifest endpoint for /create context
    if (pathname === "/manifest.webmanifest") {
      const referer = req.headers.referer || "";
      const isStudio = targetFileName === "create.html" || referer.includes("/create") || referer.includes("/html-create");
      if (isStudio) {
        const rootManifest = path.resolve(__dirname, "../../../manifest.webmanifest");
        if (fs.existsSync(rootManifest)) {
          res.writeHead(200, {
            "Content-Type": "application/manifest+json; charset=utf-8",
            "Cache-Control": "no-cache"
          });
          fs.createReadStream(rootManifest).pipe(res);
          return;
        }
      }
    }

    // 3. Serve static relative files (e.g. CSVs, PDFs, images, Markdown artifacts)
    const sanitizedRelPath = pathname.replace(/^\/+/, "");
    const workspaceRootDir = findWorkspaceRoot(rootDir);
    let diskPath = path.resolve(rootDir, sanitizedRelPath);

    // Fallback to workspaceRootDir, dev/, or experiments/ directories if not found at rootDir
    if (!fs.existsSync(diskPath) || fs.statSync(diskPath).isDirectory()) {
      const wsCandidate = path.resolve(workspaceRootDir, sanitizedRelPath);
      const hasDotSegment = sanitizedRelPath.split(/[\\/]+/).some((seg) => seg.startsWith("."));
      const devCandidate = path.join(rootDir, "dev", sanitizedRelPath);
      const expCandidate = path.join(rootDir, "experiments", sanitizedRelPath);
      if (!hasDotSegment && isPathInside(workspaceRootDir, wsCandidate) && fs.existsSync(wsCandidate) && fs.statSync(wsCandidate).isFile()) {
        diskPath = wsCandidate;
      } else if (isPathInside(rootDir, devCandidate) && fs.existsSync(devCandidate) && fs.statSync(devCandidate).isFile()) {
        diskPath = devCandidate;
      } else if (isPathInside(rootDir, expCandidate) && fs.existsSync(expCandidate) && fs.statSync(expCandidate).isFile()) {
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

    // Security check: prevent directory traversal outside rootDir / workspaceRootDir
    if (!isPathInside(rootDir, diskPath) && !isPathInside(workspaceRootDir, diskPath)) {
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
  const fragmentMtimes = new Map();
  const fragmentRebuildTimers = new Map();
  const watchedProjectSubdirs = new Set();

  function rebuildProjectFromFragment(projectDir) {
    const resolvedDir = path.resolve(projectDir);
    const fragmentPath = path.join(resolvedDir, "fragment.html");
    const manifestPath = path.join(resolvedDir, "report.manifest.json");
    const entryPath = path.join(resolvedDir, "index.html");
    if (!fs.existsSync(fragmentPath) || !fs.existsSync(manifestPath)) return false;

    let sig = "";
    try {
      const fStat = fs.statSync(fragmentPath);
      const mStat = fs.statSync(manifestPath);
      sig = `${fStat.mtimeMs}:${mStat.mtimeMs}`;
    } catch (_) {
      return false;
    }

    if (fragmentMtimes.get(resolvedDir) === sig) return false;
    fragmentMtimes.set(resolvedDir, sig);

    try {
      const fragmentHtml = fs.readFileSync(fragmentPath, "utf-8");
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      const workspaceRootDir = findWorkspaceRoot(rootDir);
      const built = buildReport({
        title: manifest.title || "HTML Report",
        content: fragmentHtml,
        project: manifest.project || null,
        contentPath: manifest.files?.fragment || "fragment.html",
        mode: manifest.mode || "report",
        theme: manifest.theme || "light",
        customTheme: manifest.customTheme || null,
        favicon: manifest.favicon || "📊",
        addons: Array.isArray(manifest.activeAddons) ? manifest.activeAddons : [],
        ai: Boolean(manifest.aiBridge),
        aiPort: manifest.aiConfig?.port || 3031,
        aiModel: manifest.aiConfig?.model || "Gemini 3.8 Flash (Low)",
        aiPersona: manifest.aiConfig?.persona || "analyst",
        aiPurpose: manifest.aiConfig?.purpose || "",
        aiDock: manifest.aiConfig?.floatingAssistant ?? true,
        pwa: Boolean(manifest.pwa),
        source: manifest.files?.entry || "index.html",
        workspaceRoot: workspaceRootDir
      });
      fs.writeFileSync(entryPath, built.html, "utf-8");
      broadcastReload(entryPath);
      return true;
    } catch (err) {
      console.warn(`[html-report] Auto-rebuild from ${fragmentPath} failed: ${err.message}`);
      return false;
    }
  }

  function scheduleFragmentRebuild(projectDir) {
    const resolvedDir = path.resolve(projectDir);
    const prev = fragmentRebuildTimers.get(resolvedDir);
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => {
      fragmentRebuildTimers.delete(resolvedDir);
      rebuildProjectFromFragment(resolvedDir);
    }, 100);
    fragmentRebuildTimers.set(resolvedDir, timer);
  }

  // Seed initial fragment/manifest signatures for served directory
  try {
    const fPath = path.join(rootDir, "fragment.html");
    const mPath = path.join(rootDir, "report.manifest.json");
    if (fs.existsSync(fPath) && fs.existsSync(mPath)) {
      fragmentMtimes.set(path.resolve(rootDir), `${fs.statSync(fPath).mtimeMs}:${fs.statSync(mPath).mtimeMs}`);
    }
  } catch (_) {}

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
      } else if (autoOpen) {
        console.log(`\n[html-report] File updated: ${fileName}`);
        console.log(`[html-report] -> No active tabs detected. Reopening in browser: ${targetUrl}`);
        openBrowser(targetUrl);
      } else {
        console.log(`\n[html-report] File updated: ${fileName}`);
        console.log(`[html-report] -> No active tabs detected (--no-open active; waiting for browser connection at ${targetUrl}).`);
      }
    }, 150);
  }

  try {
    const mainWatcher = fs.watch(resolvedPath, () => broadcastReload(resolvedPath));
    watchers.push(mainWatcher);
  } catch (_) {}

  // Watch sibling fragment.html and report.manifest.json in the served report's directory
  try {
    const siblingFragment = path.join(rootDir, "fragment.html");
    const siblingManifest = path.join(rootDir, "report.manifest.json");
    if (fs.existsSync(siblingFragment)) {
      watchers.push(fs.watch(siblingFragment, () => scheduleFragmentRebuild(rootDir)));
    }
    if (fs.existsSync(siblingManifest)) {
      watchers.push(fs.watch(siblingManifest, () => scheduleFragmentRebuild(rootDir)));
    }
  } catch (_) {}

  // Watch current-feature.html specifically
  try {
    if (activeFeaturePath) {
      const featureWatcher = fs.watch(activeFeaturePath, () => broadcastReload(activeFeaturePath));
      watchers.push(featureWatcher);
    }
  } catch (_) {}

  // Also watch directory for new/updated HTML and fragment/manifest files
  try {
    const dirWatcher = fs.watch(rootDir, (event, filename) => {
      if (filename && (filename === "current-feature.html" || filename === targetFileName)) {
        const full = path.resolve(rootDir, filename);
        broadcastReload(full);
      } else if (filename && (filename === "fragment.html" || filename === "report.manifest.json")) {
        scheduleFragmentRebuild(rootDir);
      }
    });
    watchers.push(dirWatcher);
  } catch (_) {}

  // Watch projects/ directory for additions, deletions, fragment saves, and metadata updates
  const workspaceRootForWatch = findWorkspaceRoot(rootDir);
  const watchedProjectsDir = path.join(workspaceRootForWatch, "projects");
  let projectsDirWatched = false;

  const syncProjectSubdirWatchers = () => {
    if (!fs.existsSync(watchedProjectsDir)) return;
    try {
      const entries = fs.readdirSync(watchedProjectsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
        const subdir = path.join(watchedProjectsDir, entry.name);
        if (watchedProjectSubdirs.has(subdir)) continue;
        watchedProjectSubdirs.add(subdir);
        try {
          const fPath = path.join(subdir, "fragment.html");
          const mPath = path.join(subdir, "report.manifest.json");
          if (fs.existsSync(fPath) && fs.existsSync(mPath)) {
            fragmentMtimes.set(path.resolve(subdir), `${fs.statSync(fPath).mtimeMs}:${fs.statSync(mPath).mtimeMs}`);
          }
          const subWatcher = fs.watch(subdir, (event, fname) => {
            if (!fname || fname === "fragment.html" || fname === "report.manifest.json") {
              scheduleFragmentRebuild(subdir);
            }
            broadcastProjectsChanged();
          });
          watchers.push(subWatcher);
        } catch (_) {}
      }
    } catch (_) {}
  };

  const attachProjectsWatcher = () => {
    if (projectsDirWatched || !fs.existsSync(watchedProjectsDir)) return;
    projectsDirWatched = true;
    try {
      const projectsWatcher = fs.watch(watchedProjectsDir, { recursive: true }, (event, filename) => {
        if (filename) {
          const relStr = String(filename).replace(/\\/g, "/");
          const firstSeg = relStr.split("/")[0];
          const base = path.basename(relStr);
          if (firstSeg && !firstSeg.startsWith("_") && (base === "fragment.html" || base === "report.manifest.json")) {
            scheduleFragmentRebuild(path.join(watchedProjectsDir, firstSeg));
          }
        }
        syncProjectSubdirWatchers();
        broadcastProjectsChanged();
      });
      watchers.push(projectsWatcher);
    } catch (_) {
      // Fallback for platforms where recursive fs.watch is unavailable
      try {
        const projectsWatcher = fs.watch(watchedProjectsDir, () => {
          syncProjectSubdirWatchers();
          broadcastProjectsChanged();
        });
        watchers.push(projectsWatcher);
      } catch (_) {}
    }
    syncProjectSubdirWatchers();
  };
  attachProjectsWatcher();
  if (!projectsDirWatched && fs.existsSync(workspaceRootForWatch)) {
    try {
      const wsWatcher = fs.watch(workspaceRootForWatch, (event, filename) => {
        if (filename === "projects" && fs.existsSync(watchedProjectsDir)) {
          attachProjectsWatcher();
          broadcastProjectsChanged();
        }
      });
      watchers.push(wsWatcher);
    } catch (_) {}
  }

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
      const addr = server.address();
      if (addr && typeof addr === "object" && addr.port) {
        serverPort = addr.port;
      }
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
        console.log(
          autoOpen
            ? `  • When updated while tab is closed: reopens automatically in a tab.`
            : `  • Browser auto-open disabled (--no-open).`
        );
        console.log(`======================================================\n`);
      }

      if (autoOpen) {
        console.log(`[html-report] Auto-opening browser at ${serverUrl}...`);
        openBrowser(serverUrl);
      }

      const shutdownResources = () => {
        clearInterval(heartbeat);
        clearTimeout(debounceTimer);
        clearTimeout(projectsDebounceTimer);
        for (const t of fragmentRebuildTimers.values()) clearTimeout(t);
        fragmentRebuildTimers.clear();
        for (const w of watchers) { try { w.close(); } catch (_) {} }
        for (const c of sseClients) { try { c.end(); } catch (_) {} }
        for (const c of datastarClients) { try { c.end(); } catch (_) {} }
      };
      server.on("close", shutdownResources);

      resolve({
        server,
        serverPort,
        close: () => {
          shutdownResources();
          return new Promise((res) => server.close(res));
        }
      });
    });

    // Graceful shutdown
    let closing = false;
    const cleanup = () => {
      if (closing) return;
      closing = true;
      shutdownResources();
      if (typeof server.closeAllConnections === "function") {
        try { server.closeAllConnections(); } catch (_) {}
      }
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 500).unref();
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
    if (process.env.HTML_REPORT_SUPERVISED === "1") {
      process.on("disconnect", cleanup);
    }
  });
}

/**
 * Lightweight self-reloading supervisor for CLI usage so non-dev users
 * never need to manually restart the server after server-script updates.
 */
function runSupervisedServer(argv) {
  const watchedScripts = [
    __filename,
    path.join(__dirname, "scaffold-project.mjs"),
    path.join(__dirname, "domain-model.mjs"),
    path.join(__dirname, "build-report.mjs")
  ].filter((p) => fs.existsSync(p));

  const childArgs = [__filename, ...argv.slice(2)];
  let child = null;
  let shuttingDown = false;
  let restarting = false;
  let pendingRestart = false;
  let restartTimer = null;
  let hasStartedOnce = false;
  const scriptWatchers = [];

  const spawnWorker = (suppressAutoOpen = false) => {
    const workerArgs = suppressAutoOpen && !childArgs.includes("--no-open")
      ? [...childArgs, "--no-open"]
      : childArgs;
    child = spawn(process.execPath, workerArgs, {
      stdio: ["inherit", "inherit", "inherit", "ipc"],
      env: {
        ...process.env,
        HTML_REPORT_SUPERVISED: "1",
        ...(suppressAutoOpen ? { HTML_REPORT_NO_OPEN: "1" } : {})
      }
    });
    hasStartedOnce = true;

    child.on("message", (msg) => {
      if (msg && msg.type === "restart") {
        triggerRestart(msg.reason || "api-request");
      }
    });

    child.on("exit", (code, signal) => {
      const wasRestarting = restarting;
      child = null;
      if (shuttingDown) {
        process.exit(code ?? 0);
        return;
      }
      if (wasRestarting) {
        restarting = false;
        spawnWorker(true);
        if (pendingRestart) {
          pendingRestart = false;
          triggerRestart("queued-update");
        }
        return;
      }
      if (signal) {
        process.exit(0);
      } else {
        process.exit(code ?? 0);
      }
    });
  };

  const triggerRestart = (reason) => {
    if (shuttingDown) return;
    if (restarting) {
      pendingRestart = true;
      return;
    }
    if (!child) {
      spawnWorker(hasStartedOnce);
      return;
    }
    restarting = true;
    console.log(`\n[html-report] Server update detected (${reason}) — restarting automatically...`);
    const target = child;
    try { target.kill("SIGTERM"); } catch (_) {}
    setTimeout(() => {
      if (child === target) {
        try { target.kill("SIGKILL"); } catch (_) {}
      }
    }, 2000).unref();
  };

  for (const scriptPath of watchedScripts) {
    try {
      let lastMtime = fs.statSync(scriptPath).mtimeMs;
      const w = fs.watch(scriptPath, () => {
        try {
          const nextMtime = fs.statSync(scriptPath).mtimeMs;
          if (nextMtime === lastMtime) return;
          lastMtime = nextMtime;
        } catch (_) {
          return;
        }
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => {
          triggerRestart(path.basename(scriptPath));
        }, 250);
      });
      scriptWatchers.push(w);
    } catch (_) {}
  }

  const shutdownSupervisor = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearTimeout(restartTimer);
    for (const w of scriptWatchers) { try { w.close(); } catch (_) {} }
    if (child) {
      const target = child;
      try { target.kill("SIGTERM"); } catch (_) {}
      setTimeout(() => {
        try { target.kill("SIGKILL"); } catch (_) {}
        process.exit(0);
      }, 1500).unref();
    } else {
      process.exit(0);
    }
  };

  process.on("SIGINT", shutdownSupervisor);
  process.on("SIGTERM", shutdownSupervisor);

  spawnWorker(false);
}

const serveReport = startServer;

export {
  startServer,
  serveReport,
  parseArgs,
  injectLiveReload,
  detectReportMode,
  PersonaRegistry,
  SessionStateStore,
  MIME_TYPES,
  findWorkspaceRoot,
  extractProjectMetadata,
  scanWorkspaceProjects
};

const isMainModule = isDirectCliExecution(process.argv[1], import.meta.url);

if (isMainModule) {
  const { filePath, port, autoOpen, feedProxies } = parseArgs(process.argv);
  if (!filePath) {
    console.error("Usage: node serve-report.mjs <path-to-report.html> [--port <number>] [--no-open] [--feed-proxy <prefix=targetUrl>]");
    process.exit(1);
  }
  const selfWatchEnabled = process.env.HTML_REPORT_SUPERVISED !== "1" &&
    process.env.NODE_ENV !== "test" &&
    process.env.HTML_REPORT_NO_SELF_WATCH !== "1" &&
    !process.argv.includes("--no-self-watch");
  if (selfWatchEnabled) {
    runSupervisedServer(process.argv);
  } else {
    startServer(filePath, port, autoOpen, feedProxies);
  }
}
