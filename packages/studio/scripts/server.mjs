#!/usr/bin/env node
/**
 * @file server.mjs
 * Live-Reload Dev Server, Two-Way AI Bridge host, and MCP SSE endpoint.
 * Delegates context, file watching, and process supervision to lib/server/*.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatastarBridge } from "./datastar-sse.mjs";
import { CSRFManager, AllowlistManager } from "./mcp-server.mjs";
import { AgentInferenceRouter, isDirectCliExecution } from "./preflight.mjs";
import {
  MIME_TYPES,
  PersonaRegistry,
  SessionStateStore,
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
import { createMcpRuntime } from "./lib/server/mcp-context.mjs";
import { createProjectFileWatcher } from "./lib/server/file-watcher.mjs";
import { runSupervisedServer } from "./lib/server/supervisor.mjs";
import { handleSseRoutes } from "./routes/sse.mjs";
import { handlePublishRoutes } from "./routes/publish.mjs";
import { handleMcpRoutes } from "./routes/mcp.mjs";
import { handleAgentBridgeRoutes } from "./routes/agent-bridge.mjs";
import { handleProjectRoutes } from "./routes/projects.mjs";
import { handleStaticRoutes } from "./routes/static.mjs";

const __filename = fileURLToPath(import.meta.url);

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

  const workspaceRootForState = findWorkspaceRoot(rootDir);
  const boardStateFile = path.join(rootDir, ".board-state.json");
  const shouldPersistBoardStateToDisk =
    path.resolve(rootDir) !== path.resolve(workspaceRootForState) ||
    fs.existsSync(path.join(rootDir, "report.manifest.json")) ||
    fs.existsSync(boardStateFile);

  let boardState = { updatedAt: null };
  if (fs.existsSync(boardStateFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(boardStateFile, "utf-8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        boardState = parsed;
      }
    } catch (_) {}
  }

  function saveBoardState(nextState) {
    boardState = { ...boardState, ...nextState, updatedAt: new Date().toISOString() };
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
      return { ...headers, "Access-Control-Allow-Origin": originHeader, Vary: "Origin" };
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

  const watcherApi = createProjectFileWatcher({
    resolvedPath,
    rootDir,
    targetFileName,
    sseClients,
    getServerPort: () => serverPort,
    autoOpen,
    broadcastProjectsChanged
  });

  const { inspectServedReport, mcpContext } = createMcpRuntime({
    resolvedPath,
    rootDir,
    targetFileName,
    workspaceRootForState,
    sseClients,
    datastarClients,
    getServerPort: () => serverPort,
    getActiveReportTheme: () => activeReportTheme,
    setActiveReportTheme: (t) => { activeReportTheme = t; },
    getThemeOverriddenByMcp: () => themeOverriddenByMcp,
    setThemeOverriddenByMcp: (b) => { themeOverriddenByMcp = b; },
    broadcastDatastarFragment,
    broadcastLiveReloadEvent,
    broadcastReload: (...args) => watcherApi.broadcastReload(...args)
  });

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
    broadcastReload: (...args) => watcherApi.broadcastReload(...args),
    markProjectScaffolded: (...args) => watcherApi.markProjectScaffolded(...args),
    rebuildProjectFromFragment: (...args) => watcherApi.rebuildProjectFromFragment(...args),
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

  const heartbeat = setInterval(() => {
    for (const client of sseClients) {
      try { client.write(": ping\n\n"); } catch (_) { sseClients.delete(client); }
    }
    for (const client of datastarClients) {
      try { client.write(": ping\n\n"); } catch (_) { datastarClients.delete(client); }
    }
  }, 15000);

  const shutdownResources = () => {
    clearInterval(heartbeat);
    clearTimeout(projectsDebounceTimer);
    watcherApi.closeWatchers();
    for (const c of sseClients) { try { c.end(); } catch (_) {} }
    for (const c of datastarClients) { try { c.end(); } catch (_) {} }
  };

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
        currentMode = detectReportMode(fs.readFileSync(resolvedPath, "utf-8"));
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
    runSupervisedServer(process.argv, __filename);
  } else {
    startServer({ filePath, port, autoOpen, feedProxies, aiLocal });
  }
}
