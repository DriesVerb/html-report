/**
 * @file lib/server/mcp-context.mjs
 * Live report inspection and MCP bridge context factory for live SSE DOM updates,
 * theme switching, alert banners, and in-server fragment rebuilds.
 */

import fs from "node:fs";
import path from "node:path";
import { buildReport } from "@html-report/core/build";
import { lintFragment } from "@html-report/core/harness";
import { escapeHtml } from "../../datastar-sse.mjs";
import { getAuthoringPlugin } from "../../authoring-plugin.mjs";
import { detectReportMode } from "./persona-and-session.mjs";
import { isPathInside } from "./workspace-scanner.mjs";

export function createMcpRuntime({
  resolvedPath,
  rootDir,
  targetFileName,
  workspaceRootForState,
  sseClients,
  datastarClients,
  getServerPort,
  getActiveReportTheme,
  setActiveReportTheme,
  getThemeOverriddenByMcp,
  setThemeOverriddenByMcp,
  broadcastDatastarFragment,
  broadcastLiveReloadEvent,
  broadcastReload
}) {
  function inspectServedReport() {
    let title = targetFileName;
    let theme = getActiveReportTheme();
    let mode = "report";
    const targetElements = [];

    try {
      const content = fs.readFileSync(resolvedPath, "utf-8");
      const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1].trim()) {
        title = titleMatch[1].trim();
      }
      if (!getThemeOverriddenByMcp()) {
        const themeMatch = content.match(/<html[^>]*\bdata-theme=["']([^"']+)["']/i);
        if (themeMatch && themeMatch[1].trim()) {
          theme = themeMatch[1].trim();
          setActiveReportTheme(theme);
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
      setActiveReportTheme(safeTheme);
      setThemeOverriddenByMcp(true);
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
        setActiveReportTheme(built.theme);
        setThemeOverriddenByMcp(Boolean(theme));
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
        command: `npx playwright pdf http://localhost:${getServerPort()}/ "${targetPdf}"`,
        status: "ready"
      };
    }
  };

  return { inspectServedReport, mcpContext };
}
