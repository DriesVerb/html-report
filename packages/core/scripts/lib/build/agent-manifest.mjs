/**
 * Deterministic Agent Hook Stamper, Agent Manifest Builder, and Opt-In Authoring Plugin Loader
 * for @html-report/core.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolveSkillPaths } from "../../env.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../../../..");

export function resolveAuthoringAssetsDir() {
  if (process.env.HTML_REPORT_AUTHORING_DIR && fs.existsSync(process.env.HTML_REPORT_AUTHORING_DIR)) {
    return process.env.HTML_REPORT_AUTHORING_DIR;
  }
  try {
    const req = createRequire(import.meta.url);
    const resolvedEntry = req.resolve("html-report/authoring");
    const candidate = path.resolve(path.dirname(resolvedEntry), "../assets");
    if (fs.existsSync(path.join(candidate, "edit-dock.html"))) return candidate;
  } catch (_) {}
  try {
    const rootPkgPath = path.join(REPO_ROOT, "package.json");
    if (fs.existsSync(rootPkgPath)) {
      const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));
      const authoringTarget = rootPkg?.exports?.["./authoring"];
      if (authoringTarget) {
        const candidate = path.resolve(REPO_ROOT, path.dirname(authoringTarget), "../assets");
        if (fs.existsSync(path.join(candidate, "edit-dock.html"))) return candidate;
      }
    }
  } catch (_) {}
  return null;
}

export function loadDefaultAuthoringPlugin({ aiDock = true } = {}) {
  const assetsDir = resolveAuthoringAssetsDir();
  if (!assetsDir) return null;
  const dockPath = path.join(assetsDir, "edit-dock.html");
  const scriptPath = path.join(assetsDir, "authoring-plugin.js");
  if (!fs.existsSync(dockPath) || !fs.existsSync(scriptPath)) return null;

  const rawDock = fs.readFileSync(dockPath, "utf-8");
  const chunksDir = path.join(assetsDir, "authoring");
  let script = "";
  if (fs.existsSync(chunksDir) && fs.statSync(chunksDir).isDirectory()) {
    const chunkFiles = fs.readdirSync(chunksDir).filter((f) => f.endsWith(".js")).sort();
    if (chunkFiles.length > 0) {
      const body = chunkFiles.map((f) => fs.readFileSync(path.join(chunksDir, f), "utf-8")).join("\n\n");
      script = `(function () {\n${body}\n})();\n`;
    }
  }
  if (!script) {
    script = fs.readFileSync(scriptPath, "utf-8");
  }

  const extractSlot = (name) => {
    const m = rawDock.match(new RegExp(`<!-- html-report:slot:${name} -->([\\s\\S]*?)<!-- /html-report:slot:${name} -->`));
    return m ? m[1].trim() : "";
  };

  let markup = extractSlot("body");
  if (!aiDock) {
    markup = markup.replace(/<!-- html-report:slot:ai-dock -->[\s\S]*?<!-- \/html-report:slot:ai-dock -->\n*/g, "");
  } else {
    markup = markup
      .replace(/<!-- html-report:slot:ai-dock -->\n?/g, "")
      .replace(/<!-- \/html-report:slot:ai-dock -->\n?/g, "");
  }

  return {
    navbar: extractSlot("navbar"),
    settingsTop: extractSlot("settings-top"),
    downloadTop: extractSlot("download-top"),
    settingsExtra: extractSlot("settings-extra"),
    markup,
    script
  };
}

/**
 * Deterministic Agent Hook Stamper:
 * Scans a Semantic Fragment (<main id="report-main">) in document order and
 * stamps deterministic data-agent-* attributes on sections and widgets
 * without clobbering existing IDs or attributes.
 */
export function stampAgentHooks(fragmentHtml = "") {
  if (!fragmentHtml || typeof fragmentHtml !== "string") {
    return { html: "", sections: [], widgets: [] };
  }

  const sections = [];
  const widgets = [];
  const seenSlugs = new Map();
  let sectionIndex = 0;

  const slugify = (text, fallback) => {
    const clean = String(text || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z0-9#]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    return clean || fallback;
  };

  const extractAttr = (attrs, name) => {
    const m = attrs.match(new RegExp(`(?:^|\\s)${name}=["']([^"']*)["']`, "i"));
    return m ? m[1] : null;
  };

  let stamped = fragmentHtml.replace(/<section\b([^>]*)>/gi, (fullMatch, attrs, offset) => {
    sectionIndex += 1;
    const afterOffset = offset + fullMatch.length;
    const rest = fragmentHtml.slice(afterOffset);
    const nextBoundary = rest.search(/<\/section>|<section\b/i);
    const innerSnippet = nextBoundary >= 0 ? rest.slice(0, nextBoundary) : rest.slice(0, 600);
    const headingMatch = innerSnippet.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
    const label = headingMatch
      ? headingMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : `Section ${sectionIndex}`;

    const existingId = extractAttr(attrs, "id");
    let slug = extractAttr(attrs, "data-agent-section");
    if (!slug) {
      const baseSlug = slugify(label, `section-${sectionIndex}`);
      const count = (seenSlugs.get(baseSlug) || 0) + 1;
      seenSlugs.set(baseSlug, count);
      slug = count > 1 ? `${baseSlug}-${count}` : baseSlug;
    }

    let agentId = extractAttr(attrs, "data-agent-id");
    if (!agentId) {
      agentId = `section-${sectionIndex}`;
    }

    let updatedAttrs = attrs;
    if (!/\bdata-agent-section=/i.test(updatedAttrs)) {
      updatedAttrs += ` data-agent-section="${slug}"`;
    }
    if (!/\bdata-agent-id=/i.test(updatedAttrs)) {
      updatedAttrs += ` data-agent-id="${agentId}"`;
    }

    sections.push({
      agentId,
      slug,
      label,
      id: existingId,
      selector: existingId ? `#${existingId}` : `[data-agent-id="${agentId}"]`
    });

    return `<section${updatedAttrs}>`;
  });

  const widgetCounters = { kpi: 0, chart: 0, mermaid: 0, table: 0 };
  const stampWidgetTag = (tagPattern, type) => {
    stamped = stamped.replace(tagPattern, (fullMatch, tagName, attrs) => {
      widgetCounters[type] += 1;
      const idx = widgetCounters[type];
      const existingId = extractAttr(attrs, "id");
      const existingAgentId = extractAttr(attrs, "data-agent-id");
      const agentId = existingAgentId || `${type}-${idx}`;

      let updatedAttrs = attrs;
      if (!/\bdata-agent-widget=/i.test(updatedAttrs)) {
        updatedAttrs += ` data-agent-widget="${type}"`;
      }
      if (!/\bdata-agent-id=/i.test(updatedAttrs)) {
        updatedAttrs += ` data-agent-id="${agentId}"`;
      }

      widgets.push({
        agentId,
        type,
        id: existingId,
        selector: existingId ? `#${existingId}` : `[data-agent-id="${agentId}"]`
      });

      return `<${tagName}${updatedAttrs}>`;
    });
  };

  stampWidgetTag(/<(div)\b([^>]*\bclass=["'](?:[^"']*\s)?stat(?:\s[^"']*)?["'][^>]*)>/gi, "kpi");
  stampWidgetTag(/<(canvas)\b([^>]*)>/gi, "chart");
  stampWidgetTag(/<(div)\b([^>]*\bclass=["'](?:[^"']*\s)?mermaid(?:\s[^"']*)?["'][^>]*)>/gi, "mermaid");
  stampWidgetTag(/<(table)\b([^>]*)>/gi, "table");

  return { html: stamped, sections, widgets };
}

/**
 * Builds the deterministic machine-readable Agent Manifest for both
 * embedded HTML (<script id="agent-manifest">) and workspace report.manifest.json.
 */
export function buildAgentManifest({
  project = null,
  title = "HTML Report",
  mode = "report",
  theme = "light",
  favicon = "📊",
  ai = false,
  aiLocal = false,
  aiPort = 3031,
  aiModel = "Gemini 3.8 Flash (Low)",
  aiPersona = "analyst",
  aiPurpose = "",
  aiDock = true,
  published = false,
  pwa = false,
  activeAddons = [],
  source = null,
  contentPath = null,
  sections = [],
  widgets = [],
  workspaceRoot = process.cwd()
} = {}) {
  const entryPath = project ? `projects/${project}/index.html` : (source || "report.html");
  const fragmentPath = project ? `projects/${project}/fragment.html` : (contentPath || "fragment.html");
  const publishedPath = project ? `projects/${project}/published.html` : null;

  const resolvedAiPort = Number.isFinite(Number(aiPort)) && Number(aiPort) > 0 ? Number(aiPort) : 3031;
  const resolvedAiModel = aiModel && String(aiModel).trim() ? String(aiModel).trim() : "Gemini 3.8 Flash (Low)";
  const resolvedAiPersona = aiPersona && String(aiPersona).trim() ? String(aiPersona).trim() : "analyst";
  const resolvedAiPurpose = aiPurpose && String(aiPurpose).trim() ? String(aiPurpose).trim() : "";
  const resolvedFavicon = favicon && String(favicon).trim() ? String(favicon).trim() : "📊";

  const skillPaths = resolveSkillPaths(workspaceRoot);

  const rebuildArgs = [
    `node ${skillPaths.buildScript}`,
    project ? `--project ${project}` : `--output ${entryPath}`,
    `--content ${fragmentPath}`,
    `--title "${String(title).replace(/"/g, '\\"')}"`,
    `--mode ${mode}`,
    `--theme ${theme}`
  ];
  if (resolvedFavicon && resolvedFavicon !== "📊") {
    rebuildArgs.push(`--favicon "${resolvedFavicon.replace(/"/g, '\\"')}"`);
  }
  if (activeAddons.length > 0) rebuildArgs.push(`--addons ${activeAddons.join(",")}`);
  if (ai) {
    rebuildArgs.push("--ai");
    if (aiLocal) rebuildArgs.push("--ai-local");
    rebuildArgs.push(`--ai-port ${resolvedAiPort}`);
    if (resolvedAiModel !== "Gemini 3.8 Flash (Low)") rebuildArgs.push(`--ai-model "${resolvedAiModel.replace(/"/g, '\\"')}"`);
    rebuildArgs.push(`--ai-persona ${resolvedAiPersona}`);
    if (resolvedAiPurpose) rebuildArgs.push(`--ai-purpose "${resolvedAiPurpose.replace(/"/g, '\\"')}"`);
    if (!aiDock) rebuildArgs.push("--no-ai-dock");
  }
  if (pwa) rebuildArgs.push("--pwa");

  return {
    schemaVersion: "1.0.0",
    project: project || null,
    title,
    mode,
    theme,
    favicon: resolvedFavicon,
    aiBridge: Boolean(ai),
    aiConfig: ai ? {
      port: resolvedAiPort,
      model: resolvedAiModel,
      persona: resolvedAiPersona,
      floatingAssistant: Boolean(aiDock),
      ...(aiLocal ? { local: true } : {}),
      ...(resolvedAiPurpose ? { purpose: resolvedAiPurpose } : {})
    } : null,
    published: Boolean(published),
    pwa: Boolean(pwa),
    activeAddons,
    files: {
      entry: entryPath,
      fragment: fragmentPath,
      ...(publishedPath ? { published: publishedPath } : {}),
      ...(project ? {
        manifest: `projects/${project}/report.manifest.json`,
        agents: `projects/${project}/AGENTS.md`,
        packageJson: `projects/${project}/package.json`
      } : {})
    },
    pipeline: {
      rebuildCommand: rebuildArgs.join(" "),
      serveCommand: `node ${skillPaths.serveScript} ${entryPath} --port ${resolvedAiPort}${aiLocal ? " --ai-local" : ""} --no-open`,
      verifyCommand: `node ${skillPaths.verifyScript} ${entryPath}`,
      preflightCommand: `node ${skillPaths.preflightScript} --json`,
      authoringGuide: skillPaths.authoringGuide
    },
    sections,
    widgets
  };
}
