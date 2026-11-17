/**
 * Fragment extraction, sanitization, and synchronous feed snapshot fetching
 * for @html-report/core deterministic assembly.
 */
import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { escapeAttr } from "./addon-registry.mjs";

function loadMermaidFileContent(rawRef, { contentPath = null, workspaceRoot = process.cwd() } = {}) {
  const ref = String(rawRef || "").trim();
  if (!ref) {
    throw new Error("Mermaid diagram file reference cannot be empty.");
  }

  const resolvedWorkspace = path.resolve(workspaceRoot || process.cwd());
  let baseDir = resolvedWorkspace;
  if (contentPath && typeof contentPath === "string") {
    const absContentPath = path.isAbsolute(contentPath)
      ? contentPath
      : (fs.existsSync(path.resolve(process.cwd(), contentPath))
          ? path.resolve(process.cwd(), contentPath)
          : path.resolve(resolvedWorkspace, contentPath));
    baseDir = path.dirname(absContentPath);
  }

  const candidates = [path.resolve(baseDir, ref)];
  const wsCandidate = path.resolve(resolvedWorkspace, ref);
  if (wsCandidate !== candidates[0]) {
    candidates.push(wsCandidate);
  }

  const foundPath = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
  if (!foundPath) {
    throw new Error(`Mermaid diagram file not found: "${ref}" (checked ${candidates.join(", ")})`);
  }

  let source = fs.readFileSync(foundPath, "utf-8").trim();
  source = source.replace(/^```(?:mermaid)?\r?\n([\s\S]*?)\r?\n```\s*$/i, "$1").trim();
  // Prevent accidental HTML tag parsing inside <div class="mermaid"> while preserving --> and ->> operators.
  return source.replace(/<(?=[a-zA-Z\/!])/g, "&lt;");
}

/**
 * Resolves external .mmd / .mermaid diagram inclusions in a fragment:
 * 1. <div class="mermaid" data-mermaid-src="./arch.mmd"></div> (or data-src)
 * 2. <!-- {{MERMAID:./arch.mmd}} --> or <!-- @mermaid ./arch.mmd -->
 */
export function resolveMermaidIncludes(html = "", { contentPath = null, workspaceRoot = process.cwd() } = {}) {
  if (!html || typeof html !== "string") return html || "";

  let result = html.replace(/<(div|pre)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (full, tag, attrs) => {
    if (!/\bclass=["'][^"']*\bmermaid\b[^"']*["']/i.test(attrs)) return full;
    const srcMatch = attrs.match(/\b(data-mermaid-src|data-src)=["']([^"']+)["']/i);
    if (!srcMatch) return full;

    const attrName = srcMatch[1];
    const rawRef = srcMatch[2].trim();
    const diagramSource = loadMermaidFileContent(rawRef, { contentPath, workspaceRoot });
    let nextAttrs = attrs;
    if (attrName.toLowerCase() === "data-src" && !/\bdata-mermaid-src=/i.test(attrs)) {
      nextAttrs = attrs.replace(/\bdata-src=(["'][^"']*["'])/i, "data-mermaid-src=$1");
    }
    return `<${tag}${nextAttrs}>\n${diagramSource}\n</${tag}>`;
  });

  const commentRegex = /<!--\s*(?:\{\{MERMAID:([^}]+)\}\}|@mermaid\s+([^\s]+?))\s*-->/gi;
  result = result.replace(commentRegex, (full, curlyRef, atRef, offset, whole) => {
    const rawRef = String(curlyRef || atRef || "").trim();
    const diagramSource = loadMermaidFileContent(rawRef, { contentPath, workspaceRoot });
    const before = whole.slice(0, offset);
    const lastMermaidOpen = Math.max(
      before.search(/<(?:div|pre)\b[^>]*\bclass=["'][^"']*\bmermaid\b[^"']*["'][^>]*>(?![\s\S]*<\/(?:div|pre)>)/i),
      -1
    );
    if (lastMermaidOpen !== -1) {
      return diagramSource;
    }
    return `<div class="mermaid bg-base-200/50 p-4 rounded-box overflow-x-auto text-center" data-mermaid-src="${escapeAttr(rawRef)}">\n${diagramSource}\n</div>`;
  });

  return result;
}

/**
 * Removes verification overlays and classes from HTML. Deterministic and idempotent.
 */
export function stripVerificationArtifacts(html = "") {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<style\s+id=["']html-report-verify-styles["'][^>]*>[\s\S]*?<\/style>\s*/gi, "")
    .replace(/\s+data-insufficient-space(?:=["'][^"']*["'])?/gi, "")
    .replace(/\s+data-verify-[\w-]+(?:=["'][^"']*["'])?/gi, "")
    .replace(/\sclass=(["'])([^"']*)\1/gi, (full, quote, classValue) => {
      const kept = classValue
        .split(/\s+/)
        .filter((token) => token && !token.startsWith("verify-"));
      return kept.length > 0 ? ` class=${quote}${kept.join(" ")}${quote}` : "";
    });
}

export function stripAiDockMarkup(html = "") {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/[ \t]*<!-- html-report:authoring:start (?:agent-dock|agent-reconnect-modal) -->[\s\S]*?<!-- html-report:authoring:end (?:agent-dock|agent-reconnect-modal) -->\n?/g, "")
    .replace(/[ \t]*<!-- html-report:slot:ai-dock -->[\s\S]*?<!-- \/html-report:slot:ai-dock -->\n?/g, "");
}

export function stripAuthoringMarkup(html = "") {
  const withoutAuthoring = html
    .replace(/[ \t]*<!-- html-report:authoring:start ([\w-]+) -->[\s\S]*?<!-- html-report:authoring:end \1 -->\n?/g, "");
  return stripVerificationArtifacts(withoutAuthoring);
}

/**
 * Extracts <main> element attributes, classes, id, and inner content from a fragment.
 * Preserves reactive attributes (x-data, x-init, x-*, @*, :*, data-*, aria-*, role, style, etc.).
 */
export function extractMainElement(rawContent = "") {
  let content = String(rawContent || "").trim();

  if (content.startsWith("---")) {
    const endMatch = content.slice(3).indexOf("\n---");
    if (endMatch !== -1) {
      content = content.slice(endMatch + 7).trim();
    }
  }

  const mainMatch = content.match(/^<main\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/main>\s*$/i)
    || content.match(/<main\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/main>/i);

  if (!mainMatch) {
    return {
      hasMainWrapper: false,
      id: "report-main",
      classes: [],
      extraAttrs: [],
      attributes: {},
      innerHtml: content
    };
  }

  const rawAttrs = mainMatch[1] || "";
  const innerHtml = mainMatch[2].trim();
  let id = "report-main";
  const classes = [];
  const extraAttrs = [];
  const attributes = {};

  const attrRegex = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=>]+)))?/g;
  let match;
  while ((match = attrRegex.exec(rawAttrs)) !== null) {
    const fullToken = match[0].trim();
    const attrName = match[1];
    const attrNameLower = attrName.toLowerCase();
    const attrValue = match[2] !== undefined
      ? match[2]
      : (match[3] !== undefined ? match[3] : (match[4] !== undefined ? match[4] : ""));

    if (attrNameLower === "id") {
      if (attrValue.trim()) {
        id = attrValue.trim();
        attributes.id = id;
      }
    } else if (attrNameLower === "class") {
      const tokens = attrValue.split(/\s+/).map((t) => t.trim()).filter(Boolean);
      classes.push(...tokens);
      attributes.class = tokens.join(" ");
    } else {
      extraAttrs.push(fullToken);
      attributes[attrName] = match[2] !== undefined || match[3] !== undefined || match[4] !== undefined ? attrValue : true;
    }
  }

  return {
    hasMainWrapper: true,
    id,
    classes: Array.from(new Set(classes)),
    extraAttrs,
    attributes,
    innerHtml
  };
}

/**
 * Normalizes content fragment, removing accidental outer <main> wrappers or frontmatter.
 */
export function extractMainContent(rawContent = "") {
  return extractMainElement(rawContent).innerHtml;
}

function removeBalancedElement(html, startIdx, tagName) {
  let depth = 0;
  const tokenRe = new RegExp(`<(/?)${tagName}\\b[^>]*>`, "gi");
  tokenRe.lastIndex = startIdx;
  let match;
  while ((match = tokenRe.exec(html)) !== null) {
    if (match[1] === "/") {
      depth--;
      if (depth <= 0) {
        return html.slice(0, startIdx) + html.slice(tokenRe.lastIndex);
      }
    } else {
      depth++;
    }
  }
  return html;
}

/**
 * Strips duplicate navbars or sticky print:hidden control bars from fragments
 * so template-shell.html remains the single source of truth for navigation.
 */
export function stripDuplicateNavbars(html = "") {
  if (!html || typeof html !== "string") return { html: html || "", strippedCount: 0 };
  let result = html;
  let strippedCount = 0;

  const patterns = [
    { tag: "nav", regex: /<nav\b[^>]*class=["'][^"']*\bnavbar\b[^"']*["'][^>]*>/i },
    { tag: "header", regex: /<header\b[^>]*class=["'](?=[^"']*\bsticky\b)(?=[^"']*\btop-(?:0|12|14|16|20)\b)[^"']*["'][^>]*>/i },
    { tag: "div", regex: /<div\b[^>]*class=["'](?=[^"']*\bprint:hidden\b)(?=[^"']*\bsticky\b)(?=[^"']*\btop-(?:0|12|14|16|20)\b)[^"']*["'][^>]*>/i }
  ];

  for (const { tag, regex } of patterns) {
    let match;
    while ((match = regex.exec(result)) !== null) {
      const next = removeBalancedElement(result, match.index, tag);
      if (next === result) break;
      result = next;
      strippedCount++;
    }
  }

  return { html: result.trim(), strippedCount };
}

/**
 * Synchronously fetches a feed URL for build-time freezing.
 */
export function fetchFeedSnapshotSync(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const stdout = child_process.execSync(
      `curl -sSL -m 5 "${url.replace(/"/g, '\\"')}"`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );
    return JSON.parse(stdout);
  } catch (_) {
    return null;
  }
}
