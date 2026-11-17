/**
 * @file lib/server/file-watcher.mjs
 * Debounced file watchers, fragment.html auto-rebuild pipeline, and scoped
 * SSE reload dispatch for report deliverables and Creation Studio projects.
 */

import fs from "node:fs";
import path from "node:path";
import { buildReport } from "@html-report/core/build";
import { getAuthoringPlugin } from "../../authoring-plugin.mjs";
import { openBrowser } from "./persona-and-session.mjs";
import { findWorkspaceRoot } from "./workspace-scanner.mjs";

export function createProjectFileWatcher({
  resolvedPath,
  rootDir,
  targetFileName,
  sseClients,
  getServerPort,
  autoOpen,
  broadcastProjectsChanged
}) {
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
  const workspaceRootForWatch = findWorkspaceRoot(rootDir);

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
      const manifestFragment = manifest.files?.fragment;
      const resolvedContentPath = manifestFragment && fs.existsSync(path.resolve(workspaceRootDir, manifestFragment))
        ? manifestFragment
        : fragmentPath;
      const built = buildReport({
        title: manifest.title || "HTML Report",
        content: fragmentHtml,
        project: manifest.project || null,
        contentPath: resolvedContentPath,
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
        authoringPlugin: getAuthoringPlugin({
          aiDock: manifest.aiConfig?.floatingAssistant ?? true,
          aiPersona: manifest.aiConfig?.persona || "analyst",
          aiPurpose: manifest.aiConfig?.purpose || ""
        }),
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

  const fragmentRebuildForced = new Set();
  const isMermaidSourceFile = (name) => /\.(?:mmd|mermaid)$/i.test(String(name || ""));

  function scheduleFragmentRebuild(projectDir, { force = false } = {}) {
    const resolvedDir = path.resolve(projectDir);
    if (force) fragmentRebuildForced.add(resolvedDir);
    const prev = fragmentRebuildTimers.get(resolvedDir);
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => {
      fragmentRebuildTimers.delete(resolvedDir);
      const shouldForce = fragmentRebuildForced.delete(resolvedDir);
      rebuildProjectFromFragment(resolvedDir, { force: shouldForce });
    }, 100);
    fragmentRebuildTimers.set(resolvedDir, timer);
  }

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
    const projectsRoot = path.resolve(workspaceRootForWatch, "projects");
    if (resolvedUpdated.startsWith(projectsRoot + path.sep) && resolvedUpdated !== resolvedPath) {
      return false;
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
      const targetUrl = `http://localhost:${getServerPort()}/`;

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
    watchers.push(fs.watch(resolvedPath, () => broadcastReload(resolvedPath)));
  } catch (_) {}

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

  try {
    if (activeFeaturePath) {
      watchers.push(fs.watch(activeFeaturePath, () => broadcastReload(activeFeaturePath)));
    }
  } catch (_) {}

  try {
    const watchRootTree = (event, filename) => {
      if (filename && (filename === "current-feature.html" || filename === targetFileName)) {
        broadcastReload(path.resolve(rootDir, filename));
      } else if (filename && (filename === "fragment.html" || filename === "report.manifest.json")) {
        scheduleFragmentRebuild(rootDir);
      } else if (isMermaidSourceFile(filename)) {
        scheduleFragmentRebuild(rootDir, { force: true });
      }
    };
    let dirWatcher;
    const isWorkspaceRootDir = path.resolve(rootDir) === path.resolve(workspaceRootForWatch);
    if (!isWorkspaceRootDir) {
      try {
        dirWatcher = fs.watch(rootDir, { recursive: true }, watchRootTree);
      } catch (_) {
        dirWatcher = fs.watch(rootDir, watchRootTree);
      }
    } else {
      dirWatcher = fs.watch(rootDir, watchRootTree);
    }
    watchers.push(dirWatcher);
  } catch (_) {}

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
            } else if (isMermaidSourceFile(fname)) {
              scheduleFragmentRebuild(subdir, { force: true });
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
          if (firstSeg && !firstSeg.startsWith("_") && (base === "fragment.html" || base === "report.manifest.json" || isMermaidSourceFile(base))) {
            scheduleFragmentRebuild(path.join(watchedProjectsDir, firstSeg), { force: isMermaidSourceFile(base) });
          }
        }
        syncProjectSubdirWatchers();
        broadcastProjectsChanged();
      });
      watchers.push(projectsWatcher);
    } catch (_) {
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

  function closeWatchers() {
    clearTimeout(debounceTimer);
    for (const t of fragmentRebuildTimers.values()) clearTimeout(t);
    fragmentRebuildTimers.clear();
    for (const w of watchers) {
      try { w.close(); } catch (_) {}
    }
  }

  return {
    rebuildProjectFromFragment,
    scheduleFragmentRebuild,
    markProjectScaffolded,
    broadcastReload,
    closeWatchers
  };
}
