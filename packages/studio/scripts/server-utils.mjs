import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildReport } from "@html-report/core/build";
import { compileTheme } from "@html-report/core/theme";
import { lintFragment } from "@html-report/core/harness";
import { getAuthoringPlugin } from "./authoring-plugin.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  ".webmanifest": "application/manifest+json",
  ".zip": "application/zip"
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
          if (pkg && typeof pkg.name === "string" && (
            pkg.name.startsWith("html-report-project-") ||
            (parentBase === "packages" && pkg.name.startsWith("@html-report/"))
          )) {
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

/**
 * Resolves an Edit Mode target HTML file safely inside workspaceRoot and locates
 * any sibling Semantic Fragment (fragment.html) and report.manifest.json.
 */
function resolveEditTarget(requestedFile, servedFilePath, rootDir) {
  const workspaceRoot = findWorkspaceRoot(rootDir);
  const raw = typeof requestedFile === "string" ? requestedFile.split(/[?#]/)[0].trim() : "";

  let targetHtmlPath = path.resolve(servedFilePath);
  if (raw && raw !== "/") {
    if (path.isAbsolute(raw) && fs.existsSync(raw) && !isPathInside(workspaceRoot, raw) && !isPathInside(rootDir, raw)) {
      return { ok: false, status: 403, error: "Edit target must stay inside workspace root." };
    }
    const normalized = raw.replace(/\\/g, "/");
    const rel = normalized.replace(/^\/+/, "");
    const wsCandidate = path.resolve(workspaceRoot, rel);
    const rootCandidate = path.resolve(rootDir, rel);

    const insideWs = isPathInside(workspaceRoot, wsCandidate);
    const insideRoot = isPathInside(rootDir, rootCandidate);
    if (!insideWs && !insideRoot) {
      return { ok: false, status: 403, error: "Edit target must stay inside workspace root." };
    }

    if (insideWs && fs.existsSync(wsCandidate) && fs.statSync(wsCandidate).isFile()) {
      targetHtmlPath = wsCandidate;
    } else if (insideRoot && fs.existsSync(rootCandidate) && fs.statSync(rootCandidate).isFile()) {
      targetHtmlPath = rootCandidate;
    } else if (path.basename(rel) === path.basename(servedFilePath) && !rel.includes("/")) {
      targetHtmlPath = path.resolve(servedFilePath);
    } else {
      const extCheck = path.extname(rel).toLowerCase();
      if (extCheck && extCheck !== ".html" && extCheck !== ".htm") {
        return { ok: false, status: 403, error: "Edits are restricted to HTML report deliverables." };
      }
      return { ok: false, status: 404, error: `Target report not found: ${rel}` };
    }
  }

  const ext = path.extname(targetHtmlPath).toLowerCase();
  if (ext !== ".html" && ext !== ".htm") {
    return { ok: false, status: 403, error: "Edits are restricted to HTML report deliverables." };
  }

  const targetDir = path.dirname(targetHtmlPath);
  const manifestCandidate = path.join(targetDir, "report.manifest.json");
  let manifest = null;
  let manifestPath = null;
  if (fs.existsSync(manifestCandidate) && fs.statSync(manifestCandidate).isFile()) {
    manifestPath = manifestCandidate;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestCandidate, "utf-8"));
    } catch (_) {
      manifest = null;
    }
  }

  let fragmentPath = null;
  const manifestFrag = manifest?.files?.fragment;
  if (manifestFrag) {
    const cand = path.resolve(targetDir, manifestFrag);
    if (isPathInside(workspaceRoot, cand) && fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      fragmentPath = cand;
    }
  }
  if (!fragmentPath) {
    const siblingFrag = path.join(targetDir, "fragment.html");
    if (fs.existsSync(siblingFrag) && fs.statSync(siblingFrag).isFile()) {
      fragmentPath = siblingFrag;
    }
  }

  return {
    ok: true,
    workspaceRoot,
    targetHtmlPath,
    targetDir,
    targetRel: path.relative(workspaceRoot, targetHtmlPath).replace(/\\/g, "/"),
    fragmentPath,
    fragmentRel: fragmentPath ? path.relative(workspaceRoot, fragmentPath).replace(/\\/g, "/") : null,
    manifestPath,
    manifest
  };
}

/**
 * Updates theme, custom theme <style>, and #agent-manifest inside a standalone HTML report.
 */
function applyStyleToStandaloneHtml(rawHtml, { theme = "light", compiledCustomCss = "" } = {}) {
  let html = String(rawHtml || "");
  const safeTheme = String(theme || "light").replace(/[^a-zA-Z0-9_-]/g, "") || "light";

  if (/<html\b[^>]*\bdata-theme=["'][^"']*["']/i.test(html)) {
    html = html.replace(/(<html\b[^>]*\bdata-theme=["'])[^"']*(["'])/i, `$1${safeTheme}$2`);
  } else {
    html = html.replace(/<html\b([^>]*)>/i, `<html$1 data-theme="${safeTheme}">`);
  }

  html = html.replace(/(<span\b[^>]*\bid=["']active-theme-label["'][^>]*>)[^<]*(<\/span>)/i, `$1${safeTheme}$2`);
  html = html.replace(/(<span\b[^>]*\bid=["']modal-active-theme-label["'][^>]*>)[^<]*(<\/span>)/i, `$1${safeTheme}$2`);

  const styleBlockRegex = /(<style\b[^>]*\bid=["']daisyui-custom-themes["'][^>]*>)[\s\S]*?(<\/style>)/i;
  if (styleBlockRegex.test(html)) {
    const inner = compiledCustomCss ? `\n${compiledCustomCss}\n  ` : "\n  ";
    html = html.replace(styleBlockRegex, `$1${inner}$2`);
  } else if (compiledCustomCss) {
    const styleTag = `  <style id="daisyui-custom-themes">\n${compiledCustomCss}\n  </style>\n`;
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${styleTag}</head>`) : `${styleTag}${html}`;
  }

  const manifestRegex = /(<script\b[^>]*\bid=["']agent-manifest["'][^>]*>)([\s\S]*?)(<\/script>)/i;
  const mMatch = html.match(manifestRegex);
  if (mMatch) {
    try {
      const parsed = JSON.parse(mMatch[2]);
      parsed.theme = safeTheme;
      if (parsed.pipeline && typeof parsed.pipeline.rebuildCommand === "string") {
        parsed.pipeline.rebuildCommand = parsed.pipeline.rebuildCommand.replace(/--theme\s+[^\s"']+/, `--theme ${safeTheme}`);
      }
      const safeJson = JSON.stringify(parsed, null, 2).replace(/<\//g, "<\\/");
      html = html.replace(manifestRegex, `$1\n${safeJson}\n  $3`);
    } catch (_) {}
  }

  return html;
}

/**
 * Extracts bounded outerHTML element/section slices matching target/anchor IDs
 * plus a compact section outline from fragment.html to eliminate discovery turns.
 */
function extractFragmentContext(fragmentHtml, { targetIds = [], anchorIds = [], prompt = "" } = {}) {
  const html = String(fragmentHtml || "");
  const ids = [];
  const pushId = (id) => {
    const clean = String(id || "").replace(/^#/, "").trim();
    if (clean && !ids.includes(clean)) ids.push(clean);
  };

  for (const id of targetIds || []) pushId(id);
  for (const id of anchorIds || []) pushId(id);

  const targetMatches = prompt.matchAll(/Target Element:\s*#([a-zA-Z0-9_-]+)/g);
  for (const m of targetMatches) pushId(m[1]);
  const sectionMatches = prompt.matchAll(/Section:\s*[^\n(]*\(#([a-zA-Z0-9_-]+)\)/g);
  for (const m of sectionMatches) pushId(m[1]);

  const outline = [];
  const outlineRegex = /<(section|h[1-3])\b([^>]*\bid=["']([^"']+)["'][^>]*)>/gi;
  let oMatch;
  while ((oMatch = outlineRegex.exec(html)) !== null && outline.length < 30) {
    outline.push({ tag: oMatch[1].toLowerCase(), id: oMatch[3] });
  }

  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const slices = [];

  for (const id of ids) {
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const attrRegex = new RegExp(`<(?:[a-zA-Z][\\w:-]*)\\b[^>]*(?:id|data-agent-id)=["']${escapedId}["'][^>]*>`, "i");
    const m = attrRegex.exec(html);
    if (!m) continue;

    const startIdx = m.index;
    const tagMatch = m[0].match(/^<([a-zA-Z][\w:-]*)/);
    const tagName = tagMatch ? tagMatch[1].toLowerCase() : "";
    let endIdx = Math.min(html.length, startIdx + 6000);

    if (tagName && !voidTags.has(tagName) && !m[0].endsWith("/>")) {
      const openCloseRegex = new RegExp(`<(\\/)?${tagName}\\b[^>]*>`, "gi");
      openCloseRegex.lastIndex = startIdx;
      let depth = 0;
      let tMatch;
      while ((tMatch = openCloseRegex.exec(html)) !== null) {
        if (tMatch[1]) {
          depth -= 1;
          if (depth <= 0) {
            endIdx = tMatch.index + tMatch[0].length;
            break;
          }
        } else if (!tMatch[0].endsWith("/>")) {
          depth += 1;
        }
        if (tMatch.index - startIdx > 12000) break;
      }
    } else if (tagName) {
      endIdx = startIdx + m[0].length;
    }

    const sliceHtml = html.slice(startIdx, endIdx);
    slices.push({
      id,
      html: sliceHtml.length > 8000 ? sliceHtml.slice(0, 8000) + "\n<!-- ...truncated... -->" : sliceHtml
    });
  }

  return { requestedIds: ids, outline, slices };
}

/**
 * Parses a JSON surgical patch payload ({ patches: [{ find, replace }] }) from model output.
 */
function parseSurgicalPatchPayload(rawText) {
  const text = String(rawText || "").trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    if (!parsed || !Array.isArray(parsed.patches) || parsed.patches.length === 0) return null;
    return parsed.patches;
  } catch (_) {
    return null;
  }
}

/**
 * Applies exact search-and-replace patches in memory, checks for lint regressions
 * relative to baseline, and verifies <100ms buildReport() assembly before disk write.
 */
function applySurgicalFragmentPatches(fragmentHtml, patches, { buildOptions = null } = {}) {
  const original = String(fragmentHtml || "");
  if (!Array.isArray(patches) || patches.length === 0) {
    return { ok: false, reason: "No patches provided." };
  }

  let working = original;
  for (let i = 0; i < patches.length; i += 1) {
    const p = patches[i];
    if (!p || typeof p.find !== "string" || !p.find.length || typeof p.replace !== "string") {
      return { ok: false, reason: `Patch #${i + 1} is missing valid 'find' and 'replace' strings.` };
    }
    const first = working.indexOf(p.find);
    if (first === -1) {
      return { ok: false, reason: `Patch #${i + 1} 'find' substring did not match fragment.html.` };
    }
    const second = working.indexOf(p.find, first + p.find.length);
    if (second !== -1) {
      return { ok: false, reason: `Patch #${i + 1} 'find' substring matched multiple locations.` };
    }
    working = working.slice(0, first) + p.replace + working.slice(first + p.find.length);
  }

  if (!working.trim()) {
    return { ok: false, reason: "Patched fragment is empty." };
  }
  if (/<!DOCTYPE\b|<html\b|<head\b|<body\b/i.test(working)) {
    return { ok: false, reason: "Patched fragment introduced forbidden document boilerplate tags." };
  }
  const origHasMain = /<main\b/i.test(original);
  const newHasMain = /<main\b/i.test(working);
  if (!origHasMain && newHasMain) {
    return { ok: false, reason: "Patched fragment unexpectedly introduced <main> wrapper." };
  }
  if (origHasMain && (!/<main\b/i.test(working) || !/<\/main>/i.test(working))) {
    return { ok: false, reason: "Patched fragment broke <main> wrapper balance." };
  }

  const baseLint = lintFragment(original);
  const nextLint = lintFragment(working);
  const countType = (res, type) => res.issues.filter((iss) => iss.type === type).length;
  for (const issueType of ["MISSING_HEADING_ID", "BARE_TABLE"]) {
    if (countType(nextLint, issueType) > countType(baseLint, issueType)) {
      return { ok: false, reason: `Patched fragment introduced new ${issueType} lint regression.` };
    }
  }

  try {
    buildReport({
      title: buildOptions?.title || "HTML Report",
      content: working,
      mode: buildOptions?.mode || "report",
      theme: buildOptions?.theme || "light",
      addons: Array.isArray(buildOptions?.addons) ? buildOptions.addons : [],
      ai: Boolean(buildOptions?.ai),
      pwa: Boolean(buildOptions?.pwa)
    });
  } catch (err) {
    return { ok: false, reason: `Assembly validation failed: ${err.message}` };
  }

  return { ok: true, html: working, patchesApplied: patches.length };
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
  } else if (normalizedRel.startsWith("benchmark/") || normalizedRel.startsWith("examples/benchmark/")) {
    category = "Performance Benchmark";
  } else if (normalizedRel.startsWith("research/") || normalizedRel.startsWith("docs/research/")) {
    category = "Research Report";
  } else if (normalizedRel.startsWith("dev/") || normalizedRel.startsWith("examples/dev/")) {
    category = "Dev Prototype";
  } else if (normalizedRel.startsWith("experiments/") || normalizedRel.startsWith("examples/experiments/")) {
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
  let aiLocal = false;
  const feedProxies = [];

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--port" || args[i] === "-p") && args[i + 1]) {
      port = parseInt(args[++i], 10) || 3031;
    } else if (args[i] === "--no-open") {
      autoOpen = false;
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

      // Head assets and non-<main> executable runtime scripts.
      // Excludes JSON metadata blocks (#agent-manifest, #feed-registry) and <main> widget scripts
      // so fragment edits hot-swap <main> in place instead of triggering full browser reloads.
      function signature(doc) {
        const head = Array.from(doc.head.querySelectorAll("link[rel=stylesheet], script[src], style"))
          .map((el) => el.outerHTML).join("\\n");
        const scripts = Array.from(doc.querySelectorAll("script:not([src])"))
          .filter((el) => {
            if (el.id === "__html_report_live_reload__") return false;
            const t = (el.getAttribute("type") || "").trim().toLowerCase();
            if (t === "application/json" || t === "application/ld+json" || t === "importmap") return false;
            if (el.closest && el.closest("main")) return false;
            return true;
          })
          .map((el) => el.textContent).join("\\n");
        return head + "\\n---\\n" + scripts;
      }

      function mainScriptSources(mainEl) {
        if (!mainEl) return [];
        return Array.from(mainEl.querySelectorAll("script:not([src])"))
          .filter((el) => {
            const t = (el.getAttribute("type") || "").trim().toLowerCase();
            return !t || t === "text/javascript" || t === "application/javascript";
          })
          .map((el) => el.textContent || "");
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

        const prevScripts = mainScriptSources(curMain);
        const nextScripts = mainScriptSources(nextMain);
        const changedScripts = nextScripts.filter((code, idx) => code !== prevScripts[idx]);
        if (changedScripts.some((code) => /DOMContentLoaded/.test(code))) {
          return fullReload("<main> DOMContentLoaded script changed");
        }

        let Idiomorph;
        try { Idiomorph = await loadIdiomorph(); } catch (err) { return fullReload(err.message); }

        const y = window.scrollY;
        Idiomorph.morph(curMain, nextMain, {
          morphStyle: "outerHTML",
          callbacks: { beforeNodeMorphed: (oldNode) => !keepNode(oldNode) }
        });
        for (const jsonId of ["agent-manifest", "feed-registry"]) {
          const nextJson = nextDoc.getElementById(jsonId);
          const curJson = document.getElementById(jsonId);
          if (nextJson && curJson) curJson.textContent = nextJson.textContent;
        }
        if (changedScripts.length > 0) {
          for (const code of changedScripts) {
            try {
              (new Function(code))();
            } catch (err) {
              return fullReload("main script re-exec error: " + (err && err.message));
            }
          }
        }
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

      const es = new EventSource("/__live_reload__?page=" + encodeURIComponent(window.location.pathname || "/"));
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
      es.addEventListener("mcp-fragment", async (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          if (!payload.selector || typeof payload.html !== "string") return;
          let target = null;
          try {
            target = document.querySelector(payload.selector);
          } catch (_) {
            return;
          }
          if (!target) return;
          const mergeMode = payload.merge || "morph";
          if (mergeMode === "prepend") {
            target.insertAdjacentHTML("afterbegin", payload.html);
          } else if (mergeMode === "append") {
            target.insertAdjacentHTML("beforeend", payload.html);
          } else {
            let Idiomorph = null;
            try { Idiomorph = await loadIdiomorph(); } catch (_) {}
            if (Idiomorph) {
              Idiomorph.morph(target, payload.html, {
                morphStyle: mergeMode === "inner" ? "innerHTML" : "outerHTML",
                callbacks: { beforeNodeMorphed: (oldNode) => !keepNode(oldNode) }
              });
            } else if (mergeMode === "inner") {
              target.innerHTML = payload.html;
            } else {
              target.outerHTML = payload.html;
            }
          }
          if (typeof window.reinitReportContent === "function") {
            await window.reinitReportContent();
          }
        } catch (err) {
          console.warn("[html-report] mcp-fragment error:", err && err.message);
        }
      });
      es.addEventListener("mcp-theme", (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          const theme = payload && payload.theme ? String(payload.theme) : "";
          if (!theme) return;
          if (typeof window.setReportTheme === "function") {
            window.setReportTheme(theme);
          } else {
            document.documentElement.setAttribute("data-theme", theme);
            try { localStorage.setItem("html_report_active_theme", theme); } catch (_) {}
          }
        } catch (err) {
          console.warn("[html-report] mcp-theme error:", err && err.message);
        }
      });
      es.addEventListener("mcp-alert", (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          if (!payload || (!payload.text && !payload.message)) return;
          const allowed = { info: "alert-info", success: "alert-success", warning: "alert-warning", error: "alert-error" };
          const alertClass = allowed[payload.type] || "alert-info";
          const alertId = String(payload.id || ("mcp-alert-" + Date.now())).replace(/[^a-zA-Z0-9_-]/g, "");
          const container =
            document.getElementById("agent-reaction-bubble") ||
            document.getElementById("report-main") ||
            document.querySelector("main") ||
            document.body;
          if (!container) return;

          const existing = document.getElementById(alertId);
          if (existing) existing.remove();

          const banner = document.createElement("div");
          banner.id = alertId;
          banner.setAttribute("role", "alert");
          banner.className = "alert " + alertClass + " shadow-lg mb-4 flex items-center justify-between text-xs";

          const textSpan = document.createElement("span");
          textSpan.textContent = typeof payload.text === "string" ? payload.text : payload.message;

          const closeBtn = document.createElement("button");
          closeBtn.type = "button";
          closeBtn.className = "btn btn-xs btn-ghost";
          closeBtn.setAttribute("aria-label", "Dismiss alert");
          closeBtn.textContent = "×";
          closeBtn.addEventListener("click", () => banner.remove());

          banner.appendChild(textSpan);
          banner.appendChild(closeBtn);
          container.prepend(banner);
        } catch (err) {
          console.warn("[html-report] mcp-alert error:", err && err.message);
        }
      });
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

/**
 * Generates a context-grounded Markdown response for zero-API-key local bridge mode
 * (`--ai-local` / `HTML_REPORT_AI_MODE=local`) using report headings, DOM/dataset context,
 * and manifest metadata without external LLM calls or $HOME filesystem writes.
 */
function buildLocalBridgeReply({ prompt, persona, context = {}, targetSelector = "", resolvedPath, rootDir }) {
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

export {
  MIME_TYPES,
  PersonaRegistry,
  SessionStateStore,
  findActiveChangeDir,
  isPathInside,
  isLoopbackAddress,
  findWorkspaceRoot,
  resolveEditTarget,
  applyStyleToStandaloneHtml,
  extractFragmentContext,
  parseSurgicalPatchPayload,
  applySurgicalFragmentPatches,
  extractProjectMetadata,
  scanWorkspaceProjects,
  parseArgs,
  openBrowser,
  injectLiveReload,
  detectReportMode,
  buildLocalBridgeReply
};
