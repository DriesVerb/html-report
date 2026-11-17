import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escapeHtml } from "../datastar-sse.mjs";
import { injectAuthoringPlugin } from "../authoring-plugin.mjs";
import {
  MIME_TYPES,
  findActiveChangeDir,
  isPathInside,
  findWorkspaceRoot,
  injectLiveReload,
  detectReportMode
} from "../server-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function handleStaticRoutes(req, res, parsedUrl, pathname, ctx) {
  const {
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
    broadcastReload,
    markProjectScaffolded,
    resolveInferenceStatus,
    inspectServedReport,
    mcpContext,
    editable
  } = ctx;
  const serverPort = ctx.getServerPort();
  const requestedPort = ctx.getRequestedPort();
  const boardState = ctx.getBoardState();
  let activeReportTheme = ctx.getActiveReportTheme();
  const projectsCache = ctx.getProjectsCache();
  const setProjectsCache = ctx.setProjectsCache;

    // 1c. SSE Live-Reload Endpoint
    if (pathname === "/__live_reload__") {
      let pagePath = parsedUrl.searchParams.get("page") || "";
      if (!pagePath && req.headers.referer) {
        try {
          pagePath = new URL(req.headers.referer).pathname || "";
        } catch (_) {}
      }
      res._pagePath = pagePath;

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
      return true;
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
      return true;
    }

    // 2. Serve main target report on root /
    if (pathname === "/" || pathname === `/${targetFileName}`) {
      try {
        const rawHtml = fs.readFileSync(resolvedPath, "utf-8");
        const currentMode = detectReportMode(rawHtml);
        const authoringReadyHtml = editable !== false ? injectAuthoringPlugin(rawHtml) : rawHtml;
          const injectedHtml = injectLiveReload(authoringReadyHtml);
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
      return true;
    }

    // 2b. Serve Interactive Creation Studio on /studio, /html-studio, and legacy /create, /html-create
    if (pathname === "/studio" || pathname === "/html-studio" || pathname === "/create" || pathname === "/html-create" || pathname === "/create.html") {
      const candidates = [
        path.resolve(__dirname, "../../assets/create.html"),
        path.resolve(rootDir, "create.html")
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
        return true;
      }
    }

    // 2b-2. Serve Creation Studio modular scripts (/create-studio/*.js)
    if (pathname.startsWith("/create-studio/")) {
      const studioScriptsDir = path.resolve(__dirname, "../../assets/create-studio");
      const relScript = pathname.slice("/create-studio/".length);
      const scriptPath = path.resolve(studioScriptsDir, relScript);
      if (isPathInside(studioScriptsDir, scriptPath) && scriptPath.endsWith(".js") && fs.existsSync(scriptPath) && fs.statSync(scriptPath).isFile()) {
        res.writeHead(200, {
          "Content-Type": "text/javascript; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate"
        });
        fs.createReadStream(scriptPath).pipe(res);
        return true;
      }
    }

    // 2c. Dedicated Creation Studio PWA manifest endpoint for /create context
    if (pathname === "/manifest.webmanifest" || pathname === "/sw.js" || pathname === "/icon.svg") {
      const referer = req.headers.referer || "";
      const isStudio = targetFileName === "create.html" || referer.includes("/studio") || referer.includes("/html-studio") || referer.includes("/create") || referer.includes("/html-create");
      if (isStudio) {
        const assetName = pathname.slice(1);
        const studioAsset = path.resolve(__dirname, "../../public", assetName);
        if (fs.existsSync(studioAsset)) {
          const ext = path.extname(studioAsset).toLowerCase();
          const headers = {
            "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
            "Cache-Control": "no-cache"
          };
          if (assetName === "sw.js") headers["Service-Worker-Allowed"] = "/";
          res.writeHead(200, headers);
          fs.createReadStream(studioAsset).pipe(res);
          return true;
        }
      }
    }

    // 3. Serve static relative files (e.g. CSVs, PDFs, images, Markdown artifacts)
    const sanitizedRelPath = pathname.replace(/^\/+/, "");
    const workspaceRootDir = findWorkspaceRoot(rootDir);
    let diskPath = path.resolve(rootDir, sanitizedRelPath);

    // Fallback to workspaceRootDir, dev/, examples/dev/, experiments/, or examples/experiments/ directories if not found at rootDir
    if (!fs.existsSync(diskPath) || fs.statSync(diskPath).isDirectory()) {
      const wsCandidate = path.resolve(workspaceRootDir, sanitizedRelPath);
      const hasDotSegment = sanitizedRelPath.split(/[\\/]+/).some((seg) => seg.startsWith("."));
      const fallbackCandidates = [
        path.join(rootDir, "dev", sanitizedRelPath),
        path.join(rootDir, "experiments", sanitizedRelPath),
        path.join(workspaceRootDir, "examples", "dev", sanitizedRelPath),
        path.join(workspaceRootDir, "examples", "experiments", sanitizedRelPath)
      ];
      if (!hasDotSegment && isPathInside(workspaceRootDir, wsCandidate) && fs.existsSync(wsCandidate) && fs.statSync(wsCandidate).isFile()) {
        diskPath = wsCandidate;
      } else {
        const matched = fallbackCandidates.find((cand) =>
          (isPathInside(rootDir, cand) || isPathInside(workspaceRootDir, cand)) &&
          fs.existsSync(cand) &&
          fs.statSync(cand).isFile()
        );
        if (matched) diskPath = matched;
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
      return true;
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
          return true;
        } catch (e) {
          // fallback to standard stream
        }
      }

      // Inject live-reload into any requested HTML file so all tabs reload on changes!
      if (ext === ".html") {
        try {
          const rawHtml = fs.readFileSync(diskPath, "utf-8");
          const currentMode = detectReportMode(rawHtml);
          const authoringReadyHtml = editable !== false ? injectAuthoringPlugin(rawHtml) : rawHtml;
          const injectedHtml = injectLiveReload(authoringReadyHtml);
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Report-Mode": currentMode
          });
          res.end(injectedHtml);
          return true;
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end(`Internal Error reading html file: ${err.message}`);
          return true;
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
      return true;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(`404 Not Found: ${pathname}`);
    return true;
}
