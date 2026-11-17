/**
 * @file routes/studio-files.mjs
 * HTTP route handlers for Creation Studio reference uploads (/api/create/upload)
 * and workspace file discovery (/api/create/workspace-files).
 */

import fs from "node:fs";
import path from "node:path";
import { slugifyProject } from "../scaffold-project.mjs";
import { findWorkspaceRoot } from "../server-utils.mjs";

export function handleStudioFileRoutes(req, res, parsedUrl, pathname, ctx) {
  const { rootDir, applyLocalCorsHeaders, enforceLocalBridgeSecurity } = ctx;

  if (pathname === "/api/create/upload") {
    if (req.method === "OPTIONS") {
      if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return true;
      res.writeHead(204, applyLocalCorsHeaders(req, {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }));
      res.end();
      return true;
    }
    if (req.method === "POST") {
      if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return true;
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
          const rawSlug = payload.projectSlug !== undefined
            ? String(payload.projectSlug || "").trim()
            : (payload.slug !== undefined
                ? String(payload.slug || "").trim()
                : (payload.project !== undefined ? String(payload.project || "").trim() : ""));

          if (rawSlug && (rawSlug.includes("..") || rawSlug.includes("/") || rawSlug.includes("\\"))) {
            res.writeHead(403, applyLocalCorsHeaders(req, { "Content-Type": "application/json" }));
            res.end(JSON.stringify({ ok: false, error: "Invalid projectSlug path" }));
            return;
          }
          const safeSlug = rawSlug ? slugifyProject(rawSlug) : "";
          if (rawSlug && !safeSlug) {
            res.writeHead(400, applyLocalCorsHeaders(req, { "Content-Type": "application/json" }));
            res.end(JSON.stringify({ ok: false, error: "Invalid projectSlug" }));
            return;
          }

          const baseName = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, "_");
          const safeName = (!baseName || baseName === "." || baseName === "..") ? `upload-${Date.now()}` : baseName;

          const workspaceRoot = findWorkspaceRoot(rootDir);
          const projectsRoot = path.resolve(workspaceRoot, "projects");
          const targetDir = safeSlug
            ? path.resolve(projectsRoot, safeSlug, "refs")
            : path.resolve(projectsRoot, "_uploads");
          const relDirCheck = path.relative(projectsRoot, targetDir);
          if (relDirCheck.startsWith("..") || path.isAbsolute(relDirCheck) || relDirCheck === "") {
            res.writeHead(403, applyLocalCorsHeaders(req, { "Content-Type": "application/json" }));
            res.end(JSON.stringify({ ok: false, error: "Upload directory escapes projects root" }));
            return;
          }
          fs.mkdirSync(targetDir, { recursive: true });

          const destPath = path.resolve(targetDir, safeName);
          const relFromTarget = path.relative(targetDir, destPath);
          if (relFromTarget.startsWith("..") || path.isAbsolute(relFromTarget) || relFromTarget === "") {
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

          if (safeSlug) {
            const manifestPath = path.join(projectsRoot, safeSlug, "report.manifest.json");
            if (fs.existsSync(manifestPath)) {
              try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
                const existingRefs = Array.isArray(manifest.referenceFiles) ? manifest.referenceFiles : [];
                const alreadyIdx = existingRefs.findIndex((r) => r && (r.stagedPath === relPath || r.originalPath === relPath));
                const nextEntry = {
                  name: safeName,
                  originalPath: relPath,
                  stagedPath: relPath,
                  note: alreadyIdx >= 0 ? (existingRefs[alreadyIdx].note || "") : ""
                };
                if (alreadyIdx >= 0) {
                  existingRefs[alreadyIdx] = { ...existingRefs[alreadyIdx], ...nextEntry };
                } else {
                  existingRefs.push(nextEntry);
                }
                manifest.referenceFiles = existingRefs;
                fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
              } catch (_) {}
            }
          }

          res.writeHead(200, applyLocalCorsHeaders(req, { "Content-Type": "application/json" }));
          res.end(JSON.stringify({
            ok: true,
            name: safeName,
            path: relPath,
            scope: safeSlug ? "workspace" : "staging",
            ...(safeSlug ? { projectSlug: safeSlug } : {}),
            sizeBytes: buffer.length
          }));
        } catch (err) {
          res.writeHead(400, applyLocalCorsHeaders(req, { "Content-Type": "application/json" }));
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
      return true;
    }
    return true;
  }

  if (pathname === "/api/create/workspace-files") {
    if (req.method === "OPTIONS") {
      if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return true;
      res.writeHead(204, applyLocalCorsHeaders(req, {
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }));
      res.end();
      return true;
    }
    if (req.method === "GET") {
      if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return true;
      try {
        const workspaceRoot = findWorkspaceRoot(rootDir);
        const query = (parsedUrl.searchParams.get("q") || "").trim().toLowerCase();
        const rawProject = (parsedUrl.searchParams.get("project") || "").trim();
        if (rawProject && (rawProject.includes("..") || rawProject.includes("/") || rawProject.includes("\\"))) {
          res.writeHead(403, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          res.end(JSON.stringify({ ok: false, error: "Invalid project path" }));
          return true;
        }
        const safeProject = rawProject ? slugifyProject(rawProject) : "";
        const SKIP_DIRS = new Set([
          "node_modules", ".git", ".agents", ".gemini", "dist", "build",
          ".next", "coverage", "playwright-report", "test-results"
        ]);
        const PROJECT_BOILERPLATE = new Set([
          "index.html", "fragment.html", "report.manifest.json",
          "agents.md", "package.json", "sw.js", "manifest.webmanifest", "offline.html"
        ]);
        const MAX_FILES = 300;
        const projectFiles = [];
        const projectFilePaths = new Set();

        if (safeProject) {
          const projectsRoot = path.resolve(workspaceRoot, "projects");
          const projectDir = path.resolve(projectsRoot, safeProject);
          const relCheck = path.relative(projectsRoot, projectDir);
          if (!relCheck.startsWith("..") && !path.isAbsolute(relCheck) && fs.existsSync(projectDir)) {
            const walkProject = (dir, depth) => {
              if (depth > 6 || projectFiles.length >= MAX_FILES) return;
              let entries;
              try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
              } catch {
                return;
              }
              entries.sort((a, b) => {
                if (dir === projectDir) {
                  if (a.isDirectory() && a.name === "refs") return -1;
                  if (b.isDirectory() && b.name === "refs") return 1;
                }
                return a.name.localeCompare(b.name);
              });
              for (const entry of entries) {
                if (projectFiles.length >= MAX_FILES) break;
                if (entry.isSymbolicLink()) continue;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                  if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
                  walkProject(full, depth + 1);
                } else if (entry.isFile()) {
                  if (dir === projectDir && PROJECT_BOILERPLATE.has(entry.name.toLowerCase())) continue;
                  const rel = path.relative(workspaceRoot, full).replace(/\\/g, "/");
                  if (query && !rel.toLowerCase().includes(query)) continue;
                  let sizeBytes = 0;
                  try { sizeBytes = fs.statSync(full).size; } catch {}
                  projectFilePaths.add(rel);
                  projectFiles.push({
                    name: entry.name,
                    path: rel,
                    sizeBytes,
                    inProjectWorkspace: true
                  });
                }
              }
            };
            walkProject(projectDir, 0);
          }
        }

        const generalFiles = [];
        const uploadsRelPrefix = "projects/_uploads/";

        const walk = (dir, depth) => {
          if (depth > 6 || (projectFiles.length + generalFiles.length) >= MAX_FILES) return;
          let entries;
          try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
          } catch {
            return;
          }
          entries.sort((a, b) => a.name.localeCompare(b.name));
          for (const entry of entries) {
            if ((projectFiles.length + generalFiles.length) >= MAX_FILES) break;
            if (entry.isSymbolicLink()) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
              walk(full, depth + 1);
            } else if (entry.isFile()) {
              const rel = path.relative(workspaceRoot, full).replace(/\\/g, "/");
              if (rel.startsWith(uploadsRelPrefix)) continue;
              if (projectFilePaths.has(rel)) continue;
              if (query && !rel.toLowerCase().includes(query)) continue;
              let sizeBytes = 0;
              try { sizeBytes = fs.statSync(full).size; } catch {}
              generalFiles.push({
                name: entry.name,
                path: rel,
                sizeBytes
              });
            }
          }
        };
        walk(workspaceRoot, 0);
        const files = [...projectFiles, ...generalFiles].slice(0, MAX_FILES);

        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache, no-store"
        });
        res.end(JSON.stringify({
          ok: true,
          workspaceRoot,
          project: safeProject || null,
          projectFiles,
          files
        }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return true;
    }
    return true;
  }

  return false;
}
