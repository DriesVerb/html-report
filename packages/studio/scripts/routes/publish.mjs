import fs from "node:fs";
import path from "node:path";
import { publishProject } from "@html-report/core/publish";
import { CSRFManager } from "../mcp-server.mjs";
import { slugifyProject } from "../scaffold-project.mjs";
import { isLoopbackAddress, isPathInside } from "../server-utils.mjs";

export function handlePublishRoutes(req, res, parsedUrl, pathname, ctx) {
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

    if (pathname === "/api/publish") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, applyLocalCorsHeaders(req, {
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }));
        res.end();
        return true;
      }

      if (!isSameOriginOrLocalRequest(req)) {
        res.writeHead(403, { "Content-Type": "application/json", "Cache-Control": "no-cache, no-store" });
        res.end(JSON.stringify({ ok: false, error: "Forbidden: Cross-origin publish request rejected." }));
        return true;
      }

      if (req.method !== "GET" && req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
        return true;
      }

      const handlePublishRequest = async (bodyParams = {}) => {
        try {
          const queryProject = parsedUrl.searchParams.get("project");
          const reqProject = queryProject || bodyParams.project || null;
          const reqTheme = parsedUrl.searchParams.get("theme") || bodyParams.theme || null;
          const inlineFlag = parsedUrl.searchParams.get("inline") === "1" ||
            parsedUrl.searchParams.get("inline") === "true" ||
            Boolean(bodyParams.inline || bodyParams.inlineCdn);

          let targetProjectDir = rootDir;
          let targetInputPath = resolvedPath;
          let targetProjectSlug = null;

          if (reqProject && typeof reqProject === "string" && reqProject.trim()) {
            const cleanSlug = slugifyProject(reqProject.trim());
            const candidate = path.resolve(workspaceRootForState, "projects", cleanSlug);
            if (isPathInside(workspaceRootForState, candidate) && fs.existsSync(candidate)) {
              targetProjectDir = candidate;
              targetInputPath = null;
              targetProjectSlug = cleanSlug;
            } else if (queryProject) {
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: false, error: `Project not found: ${cleanSlug}` }));
              return;
            }
          } else if (req.headers.referer) {
            try {
              const refPath = new URL(req.headers.referer).pathname || "";
              const refMatch = refPath.match(/^\/projects\/([^/]+)\//);
              if (refMatch) {
                const refSlug = decodeURIComponent(refMatch[1]);
                const candidate = path.resolve(workspaceRootForState, "projects", refSlug);
                if (isPathInside(workspaceRootForState, candidate) && fs.existsSync(candidate)) {
                  targetProjectDir = candidate;
                  targetInputPath = null;
                  targetProjectSlug = refSlug;
                }
              }
            } catch (_) {}
          }

          const result = await publishProject({
            project: targetProjectSlug,
            projectDir: targetProjectDir,
            inputPath: targetInputPath,
            theme: reqTheme || activeReportTheme || null,
            inlineCdn: inlineFlag,
            writeOutput: false,
            workspaceRoot: workspaceRootForState
          });

          const contentType = result.kind === "zip" ? "application/zip" : "text/html; charset=utf-8";
          res.writeHead(200, applyLocalCorsHeaders(req, {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${result.filename}"`,
            "Content-Length": String(result.buffer.length),
            "Cache-Control": "no-cache, no-store",
            "X-Published-Kind": result.kind,
            "X-Published-Assets": String(result.assets.length)
          }));
          res.end(result.buffer);
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      };

      if (req.method === "POST") {
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
          if (tooLarge) return;
          let parsed = {};
          try {
            if (body.trim()) parsed = JSON.parse(body);
          } catch (_) {}
          handlePublishRequest(parsed);
        });
        return true;
      }

      handlePublishRequest({});
      return true;
    }

    // 1a-2b. Ephemeral Agent Bridge CSRF Token (GET /api/agent/csrf-token)
  return false;
}
