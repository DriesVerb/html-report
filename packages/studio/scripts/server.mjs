#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildReport } from "@html-report/core/build";
import { lintFragment } from "@html-report/core/harness";
import { DatastarBridge, escapeHtml } from "./datastar-sse.mjs";
import { CSRFManager, AllowlistManager } from "./mcp-server.mjs";
import { AgentInferenceRouter, isDirectCliExecution } from "./preflight.mjs";
import { getAuthoringPlugin } from "./authoring-plugin.mjs";
import {
  MIME_TYPES,
  PersonaRegistry,
  SessionStateStore,
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
  detectReportMode
} from "./server-utils.mjs";
import { handleSseRoutes } from "./routes/sse.mjs";
import { handlePublishRoutes } from "./routes/publish.mjs";
import { handleMcpRoutes } from "./routes/mcp.mjs";
import { handleAgentBridgeRoutes } from "./routes/agent-bridge.mjs";
import { handleProjectRoutes } from "./routes/projects.mjs";
import { handleStaticRoutes } from "./routes/static.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer(targetFilePathOrOptions, initialPort = 3031, autoOpen = true, feedProxies = []) {
  let targetFilePath = targetFilePathOrOptions;
  let aiLocal = false;
  if (targetFilePathOrOptions && typeof targetFilePathOrOptions === "object" && !Array.isArray(targetFilePathOrOptions)) {
    targetFilePath = targetFilePathOrOptions.file || targetFilePathOrOptions.filePath || targetFilePathOrOptions.targetFilePath;
    initialPort = targetFilePathOrOptions.port !== undefined ? targetFilePathOrOptions.port : 3031;
    autoOpen = targetFilePathOrOptions.autoOpen !== undefined ? targetFilePathOrOptions.autoOpen : false;
    feedProxies = targetFilePathOrOptions.feedProxies || [];
    aiLocal = Boolean(targetFilePathOrOptions.aiLocal);
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
  const parsedInitialPort = Number(initialPort);
  const requestedPort = Number.isFinite(parsedInitialPort) && parsedInitialPort >= 0 ? parsedInitialPort : 3031;
  let serverPort = requestedPort;
  let activeReportTheme = "light";
  let themeOverriddenByMcp = false;
  let htmlHasLocalModeMeta = false;
  try {
    const initialHtml = fs.readFileSync(resolvedPath, "utf-8");
    const themeMatch = initialHtml.match(/<html[^>]*\bdata-theme=["']([^"']+)["']/i);
    if (themeMatch && themeMatch[1]) {
      activeReportTheme = themeMatch[1].trim();
    }
    htmlHasLocalModeMeta = /<meta\s+name=["']html-report-ai-mode["']\s+content=["']local["']/i.test(initialHtml);
  } catch (_) {}

  const resolveSiblingLocalCmd = () => {
    if (process.env.HTML_REPORT_AI_CMD && process.env.HTML_REPORT_AI_CMD.trim()) {
      return null;
    }
    const localScript = path.join(rootDir, "local-assistant.mjs");
    if (fs.existsSync(localScript) && fs.statSync(localScript).isFile()) {
      return `"${process.execPath}" "${localScript}"`;
    }
    return null;
  };

  const isLocalBridgeModeActive = () => {
    if (aiLocal) return true;
    if (String(process.env.HTML_REPORT_AI_MODE || "").trim().toLowerCase() === "local") return true;
    if (htmlHasLocalModeMeta) return true;
    try {
      const manifestPath = path.join(rootDir, "report.manifest.json");
      if (fs.existsSync(manifestPath)) {
        const m = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        if (m?.aiConfig?.local === true || m?.aiConfig?.mode === "local") return true;
      }
    } catch (_) {}
    return false;
  };

  const resolveInferenceStatus = (detectOptions = {}) => {
    const siblingCmd = resolveSiblingLocalCmd();
    const status = AgentInferenceRouter.detectProviders({
      ...(siblingCmd ? { aiCmd: siblingCmd } : {}),
      ...detectOptions
    });
    const hasAuthenticatedProvider = Boolean(status.providerAvailable && status.authenticated);
    const localBridgeEnabled = isLocalBridgeModeActive();

    if (!hasAuthenticatedProvider && localBridgeEnabled) {
      const localProvider = {
        id: "local-bridge",
        type: "local",
        name: "Local Context Bridge (Zero-Key)",
        installed: true,
        authenticated: true
      };
      return {
        ...status,
        installed: true,
        authenticated: true,
        providerAvailable: true,
        activeProvider: "local-bridge",
        activeProviderName: "Local Context Bridge (Zero-Key)",
        localMode: true,
        availableProviders: [localProvider, ...(status.availableProviders || [])],
        _useBuiltInLocalBridge: true,
        _siblingCmd: siblingCmd
      };
    }

    return {
      ...status,
      localMode: Boolean(localBridgeEnabled || siblingCmd),
      _useBuiltInLocalBridge: false,
      _siblingCmd: siblingCmd
    };
  };
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

  function broadcastLiveReloadEvent(eventName, payload) {
    const dataStr = typeof payload === "string" ? payload : JSON.stringify(payload);
    const sseMessage = `event: ${eventName}\ndata: ${dataStr}\n\n`;
    for (const client of sseClients) {
      try { client.write(sseMessage); } catch (_) { sseClients.delete(client); }
    }
    return sseClients.size;
  }

  function inspectServedReport() {
    let title = targetFileName;
    let theme = activeReportTheme;
    let mode = "report";
    const targetElements = [];

    try {
      const content = fs.readFileSync(resolvedPath, "utf-8");
      const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1].trim()) {
        title = titleMatch[1].trim();
      }
      if (!themeOverriddenByMcp) {
        const themeMatch = content.match(/<html[^>]*\bdata-theme=["']([^"']+)["']/i);
        if (themeMatch && themeMatch[1].trim()) {
          theme = themeMatch[1].trim();
          activeReportTheme = theme;
        }
      }
      mode = detectReportMode(content);

      const mainMatch = content.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
      const scanHtml = mainMatch ? mainMatch[1] : content;
      const seenIds = new Set();
      const idRegex = /<(section|h[1-3])\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi;
      let idMatch;
      while ((idMatch = idRegex.exec(scanHtml)) !== null && targetElements.length < 60) {
        const elId = idMatch[2].trim();
        if (elId && !seenIds.has(elId)) {
          seenIds.add(elId);
          targetElements.push(elId);
        }
      }
    } catch (_) {}

    let fragmentPath = null;
    try {
      const manifestPath = path.join(rootDir, "report.manifest.json");
      let fragCandidate = null;
      if (fs.existsSync(manifestPath) && fs.statSync(manifestPath).isFile()) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        if (manifest?.files?.fragment) {
          fragCandidate = path.resolve(rootDir, manifest.files.fragment);
        }
      }
      if (!fragCandidate) {
        const siblingFrag = path.join(rootDir, "fragment.html");
        if (fs.existsSync(siblingFrag) && fs.statSync(siblingFrag).isFile()) {
          fragCandidate = siblingFrag;
        }
      }
      if (fragCandidate && isPathInside(workspaceRootForState, fragCandidate) && fs.existsSync(fragCandidate)) {
        fragmentPath = path.relative(workspaceRootForState, fragCandidate).replace(/\\/g, "/");
      }
    } catch (_) {}

    const outputPath = path.relative(workspaceRootForState, resolvedPath).replace(/\\/g, "/");
    return { title, theme, mode, targetElements, fragmentPath, outputPath };
  }

  const mcpContext = {
    getTitle: () => inspectServedReport().title,
    getTheme: () => inspectServedReport().theme,
    getClientCount: () => sseClients.size + datastarClients.size,
    getActiveCards: () => inspectServedReport().targetElements,
    getMetadata: () => {
      const info = inspectServedReport();
      return {
        mode: info.mode,
        outputPath: info.outputPath,
        fragmentPath: info.fragmentPath,
        targetElements: info.targetElements,
        liveReloadClients: sseClients.size,
        datastarClients: datastarClients.size
      };
    },
    broadcastFragment: ({ selector, html, merge }) => {
      const resolvedMerge = merge || "morph";
      broadcastDatastarFragment({ selector, html, merge: resolvedMerge });
      broadcastLiveReloadEvent("mcp-fragment", { selector, html, merge: resolvedMerge });
    },
    setTheme: (theme) => {
      const safeTheme = String(theme || "light").replace(/[^a-zA-Z0-9_-]/g, "") || "light";
      activeReportTheme = safeTheme;
      themeOverriddenByMcp = true;
      const themeScript = `<script>document.documentElement.setAttribute('data-theme', '${escapeHtml(safeTheme)}'); try { localStorage.setItem('html_report_active_theme', '${escapeHtml(safeTheme)}'); } catch(_){} if (typeof setReportTheme === 'function') setReportTheme('${escapeHtml(safeTheme)}');</script>`;
      broadcastDatastarFragment({
        selector: "#theme-runtime-hook",
        html: `<div id="theme-runtime-hook">${themeScript}</div>`,
        merge: "inner"
      });
      broadcastLiveReloadEvent("mcp-theme", { theme: safeTheme });
    },
    appendAlert: ({ message, type = "info" }) => {
      const allowedTypes = new Set(["info", "success", "warning", "error"]);
      const safeType = allowedTypes.has(String(type).toLowerCase()) ? String(type).toLowerCase() : "info";
      const alertId = `mcp-alert-${Date.now()}`;
      const escapedMessage = escapeHtml(message);
      const alertHtml = `
        <div id="${alertId}" role="alert" class="alert alert-${safeType} shadow-lg mb-4 flex items-center justify-between text-xs">
          <span>${escapedMessage}</span>
          <button onclick="document.getElementById('${alertId}')?.remove()" class="btn btn-xs btn-ghost">&times;</button>
        </div>
      `;
      broadcastDatastarFragment({
        selector: "#agent-reaction-bubble",
        html: `<div id="agent-reaction-bubble">${alertHtml}</div>`,
        merge: "inner"
      });
      broadcastLiveReloadEvent("mcp-alert", {
        id: alertId,
        message: escapedMessage,
        text: String(message),
        type: safeType
      });
    },
    buildReport: async ({
      fragmentHtml,
      title,
      outputPath,
      mode,
      theme,
      addons,
      published = false,
      saveFragment = false
    } = {}) => {
      const workspaceRoot = workspaceRootForState;
      let targetOutPath = resolvedPath;
      if (outputPath !== undefined && outputPath !== null && String(outputPath).trim() !== "") {
        const rawOut = String(outputPath).trim();
        const candidate = path.isAbsolute(rawOut)
          ? path.resolve(rawOut)
          : path.resolve(workspaceRoot, rawOut);
        if (!isPathInside(workspaceRoot, candidate)) {
          throw new Error(`Forbidden: outputPath '${rawOut}' resolves outside the workspace root.`);
        }
        const ext = path.extname(candidate).toLowerCase();
        if (ext !== ".html" && ext !== ".htm") {
          throw new Error("Invalid outputPath: Output Deliverable must have .html or .htm extension.");
        }
        targetOutPath = candidate;
      }

      const lintResult = lintFragment(fragmentHtml);
      const lintErrors = lintResult.issues.filter((i) => i.type === "OUTER_BOILERPLATE");
      const warnings = lintResult.issues.map((i) => ({
        type: i.type,
        line: i.line,
        message: i.message,
        suggestedFix: i.suggestedFix
      }));

      const currentInfo = inspectServedReport();
      const resolvedTitle = title && String(title).trim() ? String(title).trim() : currentInfo.title;
      const resolvedMode = mode || currentInfo.mode || "report";
      const resolvedTheme = theme ? String(theme).toLowerCase().trim() : currentInfo.theme || "light";

      const t0 = performance.now();
      const built = buildReport({
        title: resolvedTitle,
        content: fragmentHtml,
        mode: resolvedMode,
        theme: resolvedTheme,
        addons: Array.isArray(addons) ? addons : [],
        published: Boolean(published),
        editable: !Boolean(published),
        authoringPlugin: published ? null : getAuthoringPlugin(),
        workspaceRoot
      });
      const buildTimeMs = Number((performance.now() - t0).toFixed(2));

      const targetDir = path.dirname(targetOutPath);
      fs.mkdirSync(targetDir, { recursive: true });
      const tmpOut = path.join(targetDir, `.${path.basename(targetOutPath)}.tmp-${process.pid}-${Date.now()}`);
      fs.writeFileSync(tmpOut, built.html, "utf-8");
      fs.renameSync(tmpOut, targetOutPath);

      if (saveFragment === true) {
        const fragTarget = path.join(targetDir, "fragment.html");
        const tmpFrag = path.join(targetDir, `.fragment.html.tmp-${process.pid}-${Date.now()}`);
        fs.writeFileSync(tmpFrag, fragmentHtml, "utf-8");
        fs.renameSync(tmpFrag, fragTarget);
      }

      if (path.resolve(targetOutPath) === path.resolve(resolvedPath)) {
        activeReportTheme = built.theme;
        themeOverriddenByMcp = Boolean(theme);
      }
      broadcastReload(targetOutPath);

      return {
        ok: true,
        outputPath: path.relative(workspaceRoot, targetOutPath).replace(/\\/g, "/"),
        mode: built.mode,
        theme: built.theme,
        detectedAddons: built.activeAddons,
        warnings,
        lintErrors,
        buildTimeMs
      };
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


  let editable = true;
  if (targetFilePathOrOptions && typeof targetFilePathOrOptions === "object" && targetFilePathOrOptions.editable === false) {
    editable = false;
  }

  const routeCtx = {
    resolvedPath,
    rootDir,
    targetFileName,
    feedProxies,
    sseClients,
    datastarClients,
    mcpSseClients,
    personaRegistry,
    sessionStore,
    csrfManager,
    allowlistManager,
    workspaceRootForState,
    shouldPersistBoardStateToDisk,
    saveBoardState,
    isValidLocalOrigin,
    applyLocalCorsHeaders,
    enforceLocalBridgeSecurity,
    isSameOriginOrLocalRequest,
    broadcastDatastarFragment,
    broadcastLiveReloadEvent,
    broadcastProjectsChanged,
    broadcastReload: (...args) => broadcastReload(...args),
    markProjectScaffolded: (...args) => markProjectScaffolded(...args),
    rebuildProjectFromFragment: (...args) => rebuildProjectFromFragment(...args),
    resolveInferenceStatus,
    inspectServedReport,
    mcpContext,
    editable,
    getServerPort: () => serverPort,
    getRequestedPort: () => requestedPort,
    getBoardState: () => boardState,
    getActiveReportTheme: () => activeReportTheme,
    setActiveReportTheme: (t) => { activeReportTheme = t; },
    getThemeOverriddenByMcp: () => themeOverriddenByMcp,
    setThemeOverriddenByMcp: (b) => { themeOverriddenByMcp = b; },
    getProjectsCache: () => projectsCache,
    setProjectsCache: (c) => { projectsCache = c; }
  };

  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://localhost:${serverPort}`);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    if (handleSseRoutes(req, res, parsedUrl, pathname, routeCtx)) return;
    if (handlePublishRoutes(req, res, parsedUrl, pathname, routeCtx)) return;
    if (handleMcpRoutes(req, res, parsedUrl, pathname, routeCtx)) return;
    if (handleAgentBridgeRoutes(req, res, parsedUrl, pathname, routeCtx)) return;
    if (handleProjectRoutes(req, res, parsedUrl, pathname, routeCtx)) return;
    handleStaticRoutes(req, res, parsedUrl, pathname, routeCtx);
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
  const examplesDevCurrentFeaturePath = path.resolve(rootDir, "examples", "dev", "current-feature.html");
  const activeFeaturePath = [currentFeaturePath, devCurrentFeaturePath, examplesDevCurrentFeaturePath].find((p) => fs.existsSync(p)) || null;
  if (activeFeaturePath) {
    try { mtimes.set(activeFeaturePath, fs.statSync(activeFeaturePath).mtimeMs); } catch (_) {}
  }

  const watchers = [];
  const fragmentMtimes = new Map();
  const fragmentRebuildTimers = new Map();
  const watchedProjectSubdirs = new Set();

  function rebuildProjectFromFragment(projectDir, { force = false } = {}) {
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

    if (!force && fragmentMtimes.get(resolvedDir) === sig) return false;
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
        source: manifest.project
          ? `projects/${manifest.project}/index.html`
          : (manifest.files?.entry || "index.html"),
        editable: true,
        authoringPlugin: getAuthoringPlugin({ aiDock: manifest.aiConfig?.floatingAssistant ?? true, aiPersona: manifest.aiConfig?.persona || "analyst", aiPurpose: manifest.aiConfig?.purpose || "" }),
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

  function markProjectScaffolded(projectDir) {
    try {
      const resolvedDir = path.resolve(projectDir);
      const fPath = path.join(resolvedDir, "fragment.html");
      const mPath = path.join(resolvedDir, "report.manifest.json");
      const ePath = path.join(resolvedDir, "index.html");
      if (fs.existsSync(fPath) && fs.existsSync(mPath)) {
        fragmentMtimes.set(resolvedDir, `${fs.statSync(fPath).mtimeMs}:${fs.statSync(mPath).mtimeMs}`);
      }
      if (fs.existsSync(ePath)) {
        mtimes.set(ePath, fs.statSync(ePath).mtimeMs);
      }
    } catch (_) {}
  }

  function shouldReloadSseClient(client, updatedFile) {
    const pagePath = client && client._pagePath ? String(client._pagePath) : "";
    const resolvedUpdated = path.resolve(updatedFile);
    const updatedBase = path.basename(resolvedUpdated).toLowerCase();
    const isCreateStudioPage = pagePath === "/create" || pagePath === "/create.html" || pagePath === "/html-create";
    if (isCreateStudioPage) {
      return updatedBase === "create.html";
    }
    if (pagePath.startsWith("/projects/")) {
      const targetRel = "/" + path.relative(workspaceRootForWatch, resolvedUpdated).replace(/\\/g, "/");
      return targetRel === pagePath || resolvedUpdated === resolvedPath;
    }
    return true;
  }

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

      const matchingClients = [];
      for (const client of sseClients) {
        if (shouldReloadSseClient(client, updatedFile)) {
          matchingClients.push(client);
        }
      }
      const activeCount = matchingClients.length;
      const fileName = path.basename(updatedFile);
      const targetUrl = `http://localhost:${serverPort}/`;

      if (activeCount > 0) {
        console.log(`\n[html-report] File updated: ${fileName}`);
        console.log(`[html-report] -> Refreshing ${activeCount} active tab(s) in place without opening new tabs.`);
        for (const client of matchingClients) {
          try {
            client.write("event: reload\ndata: {}\n\n");
          } catch (_) {
            sseClients.delete(client);
          }
        }
      } else if (autoOpen && path.resolve(updatedFile) === resolvedPath) {
        console.log(`\n[html-report] File updated: ${fileName}`);
        console.log(`[html-report] -> No active tabs detected. Reopening in browser: ${targetUrl}`);
        openBrowser(targetUrl);
      } else if (sseClients.size === 0) {
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

      const portMismatch = requestedPort > 0 && serverPort !== requestedPort;
      if (process.env.NODE_ENV !== "test") {
        console.log(`\n======================================================`);
        console.log(` 🚀 html-report Live-Reload Dev Server`);
        console.log(` Serving: ${resolvedPath} [mode: ${currentMode}]`);
        console.log(` URL:     ${serverUrl}`);
        if (portMismatch) {
          console.warn(` ⚠️  PORT FALLBACK WARNING: Requested port ${requestedPort} was occupied!`);
          console.warn(` ⚠️  Bound to fallback port ${serverPort} instead. Update --port or free :${requestedPort}.`);
        }
        console.log(` Status:  Watching for updates...`);
        console.log(`\n  • When updated while tab is open: refreshes existing tab in place.`);
        console.log(
          autoOpen
            ? `  • When updated while tab is closed: reopens automatically in a tab.`
            : `  • Browser auto-open disabled (--no-open).`
        );
        console.log(`======================================================\n`);
      } else if (portMismatch) {
        console.warn(`[html-report] PORT FALLBACK WARNING: Requested port ${requestedPort} was busy; bound to ${serverPort}.`);
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
          if (typeof server.closeAllConnections === "function") {
            try { server.closeAllConnections(); } catch (_) {}
          }
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
    path.join(__dirname, "authoring-plugin.mjs")
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
  scanWorkspaceProjects,
  resolveEditTarget,
  applyStyleToStandaloneHtml,
  extractFragmentContext,
  parseSurgicalPatchPayload,
  applySurgicalFragmentPatches
};

const isMainModule = isDirectCliExecution(process.argv[1], import.meta.url);

if (isMainModule) {
  const { filePath, port, autoOpen, feedProxies, aiLocal } = parseArgs(process.argv);
  if (!filePath) {
    console.error("Usage: node serve-report.mjs <path-to-report.html> [--port <number>] [--no-open] [--ai-local] [--feed-proxy <prefix=targetUrl>]");
    process.exit(1);
  }
  const selfWatchEnabled = process.env.HTML_REPORT_SUPERVISED !== "1" &&
    process.env.NODE_ENV !== "test" &&
    process.env.HTML_REPORT_NO_SELF_WATCH !== "1" &&
    !process.argv.includes("--no-self-watch");
  if (selfWatchEnabled) {
    runSupervisedServer(process.argv);
  } else {
    startServer({ filePath, port, autoOpen, feedProxies, aiLocal });
  }
}
