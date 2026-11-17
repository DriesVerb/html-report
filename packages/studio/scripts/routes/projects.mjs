import fs from "node:fs";
import path from "node:path";
import { getPackageVersion } from "@html-report/core/compatibility";
import {
  DAISYUI_THEMES,
  TARGET_DEFINITIONS,
  ADDON_CATALOG,
  WIDGET_PRESETS,
  normalizeDomainConfig,
  resolveSiblingSkill,
  generateCliCommand,
  generateDeterministicPrompt
} from "../domain-model.mjs";
import { scaffoldProject, slugifyProject } from "../scaffold-project.mjs";
import {
  isPathInside,
  isLoopbackAddress,
  findWorkspaceRoot,
  scanWorkspaceProjects
} from "../server-utils.mjs";
import { handleStudioFileRoutes } from "./studio-files.mjs";

export function handleProjectRoutes(req, res, parsedUrl, pathname, ctx) {
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
      return true;
    }

    if (pathname === "/api/server/restart" && req.method === "POST") {
      const remoteAddr = req.socket?.remoteAddress || "";
      const origin = req.headers.origin || "";
      const isLocalOrigin = !origin || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);
      if (!isLoopbackAddress(remoteAddr) || !isLocalOrigin) {
        res.writeHead(403, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ ok: false, error: "Server restart is restricted to localhost." }));
        return true;
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
      return true;
    }

    if (pathname === "/api/create/scaffold") {
      if (req.method === "OPTIONS") {
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return true;
        res.writeHead(204, applyLocalCorsHeaders(req, {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token"
        }));
        res.end();
        return true;
      }
      if (req.method === "POST") {
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return true;
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
            const updateExisting = Boolean(payload.updateExisting);
            const regenerateFragment = Boolean(payload.regenerateFragment);
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
              updateExisting,
              regenerateFragment,
              avoidCollision: !force && !updateExisting,
              rootDir: workspaceRoot,
              workspaceRoot
            });

            if (typeof markProjectScaffolded === "function") {
              markProjectScaffolded(result.projectDir);
            }
            if (typeof attachProjectsWatcher === "function") attachProjectsWatcher();
            if (typeof syncProjectSubdirWatchers === "function") syncProjectSubdirWatchers();
            if (typeof broadcastProjectsChanged === "function") broadcastProjectsChanged();

            res.writeHead(200, applyLocalCorsHeaders(req, {
              "Content-Type": "application/json"
            }));
            res.end(JSON.stringify({
              ok: true,
              updated: updateExisting,
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
        return true;
      }
      return true;
    }

    if (pathname === "/api/create/synthesize") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        });
        res.end();
        return true;
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
        return true;
      }
      return true;
    }

    if (handleStudioFileRoutes(req, res, parsedUrl, pathname, ctx)) return true;

    // 1b-3b. Workspace Projects Discovery & Management API (/api/projects)
    if (pathname === "/api/projects" || pathname === "/api/projects/delete") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        });
        res.end();
        return true;
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
        return true;
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
          setProjectsCache({ timestamp: now, data: projects });
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
        return true;
      }
      return true;
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
      return true;
    }

    // 1b-1. Page edit hand-off: localhost only, workspace-scoped, Tier 1 fast-patch + Tier 2 CLI fallback
  return false;
}
