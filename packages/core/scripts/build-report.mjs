#!/usr/bin/env node
/**
 * Deterministic Assembly Engine for @html-report/core (build-report.mjs)
 * Joins a Semantic Fragment (<main id="report-main">), template-shell.html, and
 * report-runtime.js into an Output Deliverable in <100ms.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { compileTheme, compileThemeFile } from "./theme-compiler.mjs";
import {
  buildPwaHeadTags,
  DEFAULT_PWA_CONFIG,
  deriveShortName
} from "./pwa-builder.mjs";
import { getPackageVersion } from "./compatibility.mjs";
import { isDirectCliExecution } from "./env.mjs";
import {
  ADDON_REGISTRY,
  CANONICAL_MODES,
  MODE_ALIASES,
  PRINT_MEDIA_CSS,
  escapeAttr,
  normalizeMode,
  detectAddons,
  generateFaviconTag
} from "./lib/build/addon-registry.mjs";
import {
  stripVerificationArtifacts,
  stripAiDockMarkup,
  stripAuthoringMarkup,
  extractMainElement,
  extractMainContent,
  stripDuplicateNavbars,
  resolveMermaidIncludes,
  fetchFeedSnapshotSync
} from "./lib/build/fragment-sanitizer.mjs";
import {
  loadDefaultAuthoringPlugin,
  stampAgentHooks,
  buildAgentManifest
} from "./lib/build/agent-manifest.mjs";
import { parseArgs, runBuildCli } from "./lib/build/cli.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export {
  ADDON_REGISTRY,
  CANONICAL_MODES,
  MODE_ALIASES,
  normalizeMode,
  detectAddons,
  stripVerificationArtifacts,
  stripAiDockMarkup,
  stripAuthoringMarkup,
  extractMainElement,
  extractMainContent,
  stripDuplicateNavbars,
  resolveMermaidIncludes,
  generateFaviconTag,
  parseArgs,
  fetchFeedSnapshotSync,
  stampAgentHooks,
  buildAgentManifest
};

const DEFAULT_MAIN_CLASSES = [
  "max-w-7xl",
  "mx-auto",
  "px-4",
  "sm:px-6",
  "lg:px-8",
  "py-8",
  "space-y-10",
  "flex-1",
  "w-full"
];

function loadRuntimeScriptSource(runtimeScriptPath) {
  const defaultRuntimePath = path.resolve(__dirname, "../assets/report-runtime.js");
  if (path.resolve(runtimeScriptPath) === defaultRuntimePath) {
    const req = createRequire(import.meta.url);
    const runtimeLoader = req(defaultRuntimePath);
    if (typeof runtimeLoader.getBundledRuntimeSource === "function") {
      return runtimeLoader.getBundledRuntimeSource();
    }
  }
  return fs.readFileSync(runtimeScriptPath, "utf-8");
}

function applyFeedDirectives(body, { feeds, feedInterval, freezeFeeds, mockFeeds, fetchSnapshot }) {
  let cleanBody = body;

  if (feeds && Object.keys(feeds).length > 0) {
    const regRegex = /<script\s+id=["']feed-registry["']\s+type=["']application\/json["']>([\s\S]*?)<\/script>/i;
    const match = cleanBody.match(regRegex);
    if (match) {
      let existing = {};
      try { existing = JSON.parse(match[1]); } catch (_) {}
      Object.assign(existing, feeds);
      cleanBody = cleanBody.replace(regRegex, `<script id="feed-registry" type="application/json">\n${JSON.stringify(existing, null, 2)}\n</script>`);
    } else {
      cleanBody = `<script id="feed-registry" type="application/json">\n${JSON.stringify(feeds, null, 2)}\n</script>\n` + cleanBody;
    }
  }

  const hasPublicFeed = /data-public-feed\b/i.test(cleanBody) || /data-feed\b/i.test(cleanBody);

  if (feedInterval && hasPublicFeed) {
    cleanBody = cleanBody.replace(
      /(<[^>]*\bdata-public-feed\b[^>]*?)(\/?>)/gi,
      (match, prefix, suffix) => {
        if (/data-feed-interval\b/i.test(prefix)) return match;
        return `${prefix} data-feed-interval="${feedInterval}"${suffix}`;
      }
    );
  }

  if (freezeFeeds && hasPublicFeed) {
    const combinedRegistry = Object.assign({}, feeds || {});
    const regMatch = cleanBody.match(/<script\s+id=["']feed-registry["']\s+type=["']application\/json["']>([\s\S]*?)<\/script>/i);
    if (regMatch) {
      try { Object.assign(combinedRegistry, JSON.parse(regMatch[1])); } catch (_) {}
    }

    cleanBody = cleanBody.replace(
      /(<[^>]*\bdata-public-feed=["']([^"']+)["'][^>]*?)(\/?>)/gi,
      (match, prefix, feedRef, suffix) => {
        let targetUrl = feedRef;
        if (feedRef.startsWith("@")) {
          targetUrl = combinedRegistry[feedRef.slice(1)] || feedRef;
        }

        let snapshot = null;
        if (mockFeeds && mockFeeds[feedRef]) {
          snapshot = mockFeeds[feedRef];
        } else if (mockFeeds && mockFeeds[targetUrl]) {
          snapshot = mockFeeds[targetUrl];
        } else if (typeof fetchSnapshot === "function") {
          snapshot = fetchSnapshot(targetUrl, feedRef);
        } else if (targetUrl && (targetUrl.startsWith("http://") || targetUrl.startsWith("https://"))) {
          snapshot = fetchFeedSnapshotSync(targetUrl);
        }

        if (snapshot !== null) {
          const serialized = JSON.stringify(snapshot).replace(/"/g, "&quot;");
          if (/data-feed-fallback\b/i.test(prefix)) {
            prefix = prefix.replace(/data-feed-fallback=["'][^"']*["']/i, `data-feed-fallback="${serialized}"`);
            return `${prefix}${suffix}`;
          }
          return `${prefix} data-feed-fallback="${serialized}"${suffix}`;
        }
        return match;
      }
    );
  }

  return { cleanBody, hasPublicFeed };
}

function resolveCompiledCustomTheme({ customTheme, customThemeCss, theme }) {
  let compiledCustomCss = "";
  let resolvedTheme = theme;

  if (customTheme) {
    if (typeof customTheme === "string") {
      const compiled = fs.existsSync(customTheme) ? compileThemeFile(customTheme) : compileTheme(customTheme);
      compiledCustomCss = compiled.css;
      if (!resolvedTheme) resolvedTheme = compiled.themeName;
    } else if (typeof customTheme === "object") {
      const compiled = compileTheme(customTheme);
      compiledCustomCss = compiled.css;
      if (!resolvedTheme) resolvedTheme = compiled.themeName;
    }
  }

  if (customThemeCss) {
    compiledCustomCss = (compiledCustomCss ? compiledCustomCss + "\n\n" : "") + customThemeCss;
  }

  return { compiledCustomCss, resolvedTheme };
}

function applyAuthoringCustomization(html, { aiPersona, aiPurpose }) {
  let out = html;
  const safePersona = escapeAttr(aiPersona);
  const escapedPersonaRegex = safePersona.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const personaLabel = aiPersona.charAt(0).toUpperCase() + aiPersona.slice(1);
  out = out.replace(
    /(<select id="agent-dock-persona"[^>]*>)([\s\S]*?)(<\/select>)/i,
    (full, openTag, innerOpts, closeTag) => {
      let updatedOpts = innerOpts.replace(/\s+selected\b/gi, "");
      const optRegex = new RegExp(`(<option\\s+value=["']${escapedPersonaRegex}["'])(>)`, "i");
      if (optRegex.test(updatedOpts)) {
        updatedOpts = updatedOpts.replace(optRegex, `$1 selected$2`);
      } else {
        updatedOpts = `\n            <option value="${safePersona}" selected>${escapeAttr(personaLabel)}</option>` + updatedOpts;
      }
      return `${openTag}${updatedOpts}${closeTag}`;
    }
  );

  if (aiPurpose) {
    const safePurpose = escapeAttr(aiPurpose);
    out = out.replace(
      /(<p id="agent-dock-welcome-copy"[^>]*>)[\s\S]*?(<\/p>)/i,
      (full, openTag, closeTag) => `${openTag}${safePurpose} Press <kbd class="kbd kbd-xs font-mono">⌘K</kbd> to toggle.${closeTag}`
    );
  } else if (aiPersona.toLowerCase() === "support") {
    out = out.replace(
      /(<p id="agent-dock-welcome-copy"[^>]*>)[\s\S]*?(<\/p>)/i,
      (full, openTag, closeTag) => `${openTag}Ask questions about the documentation, setup steps, or troubleshooting guidance on this page. Press <kbd class="kbd kbd-xs font-mono">⌘K</kbd> to toggle.${closeTag}`
    );
  }

  return out;
}

/**
 * Assembly Engine: Deterministically joins a Semantic Fragment (<main id="report-main">),
 * Template Shell (template-shell.html), and Runtime Script into an Output Deliverable (<100ms).
 */
export function buildReport({
  title = "HTML Report",
  content = "",
  project = null,
  contentPath = null,
  mode = null,
  printable = false,
  presentation = false,
  live = false,
  pwa = false,
  pwaName = null,
  pwaShortName = null,
  pwaThemeColor = null,
  pwaBgColor = null,
  pwaIcon = null,
  ai = false,
  aiLocal = false,
  aiPort = 3031,
  aiModel = "Gemini 3.8 Flash (Low)",
  aiPersona = "analyst",
  aiPurpose = "",
  aiDock = true,
  editable = false,
  authoringPlugin = null,
  published = false,
  source = null,
  addons = [],
  autoDetectAddons = true,
  favicon = "📊",
  theme = null,
  customTheme = null,
  customThemeCss = null,
  feeds = {},
  freezeFeeds = false,
  feedInterval = null,
  mockFeeds = null,
  fetchSnapshot = null,
  workspaceRoot = process.cwd(),
  templateShellPath = path.resolve(__dirname, "../assets/template-shell.html"),
  runtimeScriptPath = path.resolve(__dirname, "../assets/report-runtime.js")
} = {}) {
  if (!fs.existsSync(templateShellPath)) {
    throw new Error(`Template shell not found at: ${templateShellPath}`);
  }
  if (!fs.existsSync(runtimeScriptPath)) {
    throw new Error(`Runtime script not found at: ${runtimeScriptPath}`);
  }

  const mainElement = extractMainElement(content);
  const { html: dedupedBody, strippedCount } = stripDuplicateNavbars(mainElement.innerHtml);
  if (strippedCount > 0 && process.env.NODE_ENV !== "test") {
    console.warn(`[html-report] Stripped ${strippedCount} duplicate navbar/control bar(s) from fragment.`);
  }

  const feedResult = applyFeedDirectives(dedupedBody, {
    feeds,
    feedInterval,
    freezeFeeds,
    mockFeeds,
    fetchSnapshot
  });
  let cleanBody = resolveMermaidIncludes(feedResult.cleanBody, {
    contentPath,
    workspaceRoot
  });
  const hasPublicFeed = feedResult.hasPublicFeed;

  let resolvedMode = normalizeMode(mode);
  if (mode && !resolvedMode) {
    throw new Error(`Invalid report mode "${mode}". Allowed modes: ${CANONICAL_MODES.join(", ")}`);
  }
  if (!resolvedMode) {
    if (live || hasPublicFeed) resolvedMode = "live-report";
    else if (printable) resolvedMode = "print";
    else if (presentation) resolvedMode = "presentation";
    else resolvedMode = "report";
  }

  const isPrintable = Boolean(printable || resolvedMode === "print");
  const isPresentation = Boolean(presentation || resolvedMode === "presentation");
  const isLive = Boolean(live || hasPublicFeed || resolvedMode === "live-report");
  const isPwa = Boolean(pwa);

  const shellTemplate = fs.readFileSync(templateShellPath, "utf-8");
  const runtimeScript = loadRuntimeScriptSource(runtimeScriptPath);

  const activeAddonKeys = detectAddons(cleanBody, addons, { autoDetect: autoDetectAddons });
  const hasImpressSignature = ADDON_REGISTRY.impress.signatures.some((p) => p.test(cleanBody));
  if (isPresentation && !activeAddonKeys.includes("reveal") && !activeAddonKeys.includes("impress") && !hasImpressSignature) {
    activeAddonKeys.push("reveal");
  }
  if (isLive && !activeAddonKeys.includes("datastar")) {
    activeAddonKeys.push("datastar");
  }

  const { compiledCustomCss, resolvedTheme } = resolveCompiledCustomTheme({ customTheme, customThemeCss, theme });

  const headExtraParts = [];
  for (const key of activeAddonKeys) {
    if (ADDON_REGISTRY[key]?.head) {
      headExtraParts.push(`  <!-- Addon: ${ADDON_REGISTRY[key].name} -->\n  ${ADDON_REGISTRY[key].head}`);
    }
  }
  if (isPrintable) headExtraParts.push(PRINT_MEDIA_CSS);
  if (isPwa) {
    headExtraParts.push(buildPwaHeadTags({
      manifestHref: "manifest.webmanifest",
      themeColor: pwaThemeColor || DEFAULT_PWA_CONFIG.themeColor,
      iconHref: "icon.svg",
      title: pwaName || title
    }));
  }
  if (source) {
    headExtraParts.push(`  <meta name="html-report-source" content="${escapeAttr(source)}" />`);
  }

  const resolvedAiPort = Number.isFinite(Number(aiPort)) && Number(aiPort) > 0 ? Number(aiPort) : 3031;
  const resolvedAiModel = aiModel && String(aiModel).trim() ? String(aiModel).trim() : "Gemini 3.8 Flash (Low)";
  const resolvedAiPersona = aiPersona && String(aiPersona).trim() ? String(aiPersona).trim() : "analyst";
  const resolvedAiPurpose = aiPurpose && String(aiPurpose).trim() ? String(aiPurpose).trim() : "";

  if (ai && !published) {
    headExtraParts.push('  <meta name="html-report-ai" content="on" />');
    headExtraParts.push(`  <meta name="html-report-ai-port" content="${escapeAttr(String(resolvedAiPort))}" />`);
    headExtraParts.push(`  <meta name="html-report-ai-model" content="${escapeAttr(resolvedAiModel)}" />`);
    headExtraParts.push(`  <meta name="html-report-ai-persona" content="${escapeAttr(resolvedAiPersona)}" />`);
    if (resolvedAiPurpose) {
      headExtraParts.push(`  <meta name="html-report-ai-purpose" content="${escapeAttr(resolvedAiPurpose)}" />`);
    }
    headExtraParts.push(`  <meta name="html-report-ai-dock" content="${aiDock ? "on" : "off"}" />`);
    if (aiLocal) headExtraParts.push('  <meta name="html-report-ai-mode" content="local" />');
  }
  if (published) {
    headExtraParts.push('  <meta name="html-report-published" content="true" />');
  }

  const stampedResult = stampAgentHooks(cleanBody);
  cleanBody = stampedResult.html;

  const agentManifest = buildAgentManifest({
    project,
    title,
    mode: resolvedMode,
    theme: resolvedTheme || "light",
    favicon,
    ai,
    aiLocal,
    aiPort: resolvedAiPort,
    aiModel: resolvedAiModel,
    aiPersona: resolvedAiPersona,
    aiPurpose: resolvedAiPurpose,
    aiDock,
    published,
    pwa: isPwa,
    activeAddons: activeAddonKeys,
    source,
    contentPath,
    sections: stampedResult.sections,
    widgets: stampedResult.widgets,
    workspaceRoot
  });
  const safeAgentManifestJson = JSON.stringify(agentManifest, null, 2).replace(/<\//g, "<\\/");
  headExtraParts.push(`  <!-- Deterministic Agent Manifest -->\n  <script type="application/json" id="agent-manifest">\n${safeAgentManifestJson}\n  </script>`);

  const headExtras = headExtraParts.join("\n\n");
  const faviconTag = generateFaviconTag(favicon);
  const inlinedRuntime = `<script>\n${runtimeScript}\n  </script>`;

  let html = shellTemplate;
  if (resolvedTheme) {
    html = html.replace(/data-theme="[^"]*"/i, `data-theme="${resolvedTheme}"`);
    html = html.replace(/(<span[^>]*id="active-theme-label"[^>]*>)[^<]*(<\/span>)/i, `$1${resolvedTheme}$2`);
    html = html.replace(/(<span[^>]*id="modal-active-theme-label"[^>]*>)[^<]*(<\/span>)/i, `$1${resolvedTheme}$2`);
  }

  html = html.replace(/<html([^>]*)>/i, (match, attrs) => {
    const updated = !attrs.includes("data-report-mode")
      ? ` data-report-mode="${resolvedMode}"` + attrs
      : attrs.replace(/data-report-mode="[^"]*"/, `data-report-mode="${resolvedMode}"`);
    return `<html${updated}>`;
  });

  if (isPresentation) {
    html = html.replace(/<html([^>]*)>/i, (match, attrs) =>
      attrs.includes("data-presentation") ? match : `<html data-presentation="true"${attrs}>`
    );
  }

  if (isPrintable) {
    html = html.replace(
      /<span class="badge badge-warning badge-xs font-mono">Not PDF-Ready<\/span>/,
      '<span class="badge badge-success badge-xs font-mono">PDF-Ready</span>'
    );
  }

  html = html.replace(/<!-- {{TITLE}} -->/g, () => title);
  html = html.replace(/<!-- {{FAVICON}} -->/g, () => faviconTag);

  let processedBody = cleanBody;
  if (activeAddonKeys.includes("datastar")) {
    processedBody = processedBody.replace(/\bdata-showdown\b/g, "data-markdown-showdown");
  }

  const mainId = mainElement.id || "report-main";
  const mergedMainClasses = Array.from(new Set([...DEFAULT_MAIN_CLASSES, ...mainElement.classes])).join(" ");
  const mainExtraAttrs = mainElement.extraAttrs.length > 0 ? " " + mainElement.extraAttrs.join(" ") : "";
  const renderedMainOpenTag = `<main id="${escapeAttr(mainId)}" class="${escapeAttr(mergedMainClasses)}"${mainExtraAttrs}>`;
  html = html.replace(/<main\b[^>]*>(?=\s*<!-- \{\{CONTENT\}\} -->)/i, () => renderedMainOpenTag);

  html = html.replace(/<!-- {{HEAD_EXTRAS}} -->/g, () => headExtras);
  html = html.replace(/<!-- {{CONTENT}} -->/g, () => processedBody);
  html = html.replace(/<!-- {{RUNTIME_SCRIPT}} -->/g, () => inlinedRuntime);
  html = html.replace(/<!-- {{CUSTOM_THEMES}} -->/g, () => compiledCustomCss ? `\n${compiledCustomCss}\n  ` : "");
  html = html.replace(/<!-- {{VERSION}} -->/g, () => getPackageVersion());

  const shouldInjectAuthoring = !published && Boolean(editable || ai || authoringPlugin);
  const resolvedAuthoring = shouldInjectAuthoring
    ? (authoringPlugin || loadDefaultAuthoringPlugin({ aiDock, aiPersona: resolvedAiPersona, aiPurpose: resolvedAiPurpose }))
    : null;

  html = html.replace(/<!-- {{AUTHORING_NAVBAR}} -->/g, () => (resolvedAuthoring?.navbar ? resolvedAuthoring.navbar : ""));
  html = html.replace(/<!-- {{AUTHORING_SETTINGS_TOP}} -->/g, () => (resolvedAuthoring?.settingsTop ? resolvedAuthoring.settingsTop : ""));
  html = html.replace(/<!-- {{AUTHORING_DOWNLOAD_TOP}} -->/g, () => (resolvedAuthoring?.downloadTop ? resolvedAuthoring.downloadTop : ""));
  html = html.replace(/<!-- {{AUTHORING_SETTINGS_EXTRA}} -->/g, () => (resolvedAuthoring?.settingsExtra ? resolvedAuthoring.settingsExtra : ""));
  html = html.replace(/<!-- {{AUTHORING_MARKUP}} -->/g, () => (resolvedAuthoring?.markup ? resolvedAuthoring.markup : ""));
  html = html.replace(/<!-- {{AUTHORING_SCRIPT}} -->/g, () =>
    resolvedAuthoring?.script ? `<script data-authoring="true">\n${resolvedAuthoring.script}\n  </script>` : ""
  );

  if (resolvedAuthoring && ai && !published) {
    html = applyAuthoringCustomization(html, { aiPersona: resolvedAiPersona, aiPurpose: resolvedAiPurpose });
  }
  if (!aiDock) html = stripAiDockMarkup(html);
  if (published) html = stripVerificationArtifacts(stripAuthoringMarkup(html));

  return {
    html,
    activeAddons: activeAddonKeys,
    mode: resolvedMode,
    theme: resolvedTheme || "light",
    hasCustomTheme: Boolean(compiledCustomCss),
    isPwa,
    agentManifest,
    mainElement,
    pwaConfig: isPwa ? {
      title: pwaName || title,
      shortName: pwaShortName || deriveShortName(pwaName || title),
      themeColor: pwaThemeColor || DEFAULT_PWA_CONFIG.themeColor,
      backgroundColor: pwaBgColor || DEFAULT_PWA_CONFIG.backgroundColor,
      emoji: pwaIcon || favicon
    } : null
  };
}

if (isDirectCliExecution(process.argv[1], import.meta.url)) {
  runBuildCli(process.argv, { buildReport });
}
