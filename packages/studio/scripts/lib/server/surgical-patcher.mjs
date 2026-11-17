/**
 * @file lib/server/surgical-patcher.mjs
 * Safe Edit-Mode target resolution, standalone HTML theme/style mutation,
 * bounded fragment slicing, and validated search-and-replace patching.
 */

import fs from "node:fs";
import path from "node:path";
import { buildReport } from "@html-report/core/build";
import { lintFragment } from "@html-report/core/harness";
import { isPathInside, findWorkspaceRoot } from "./workspace-scanner.mjs";

/**
 * Resolves an Edit Mode target HTML file safely inside workspaceRoot and locates
 * any sibling Semantic Fragment (fragment.html) and report.manifest.json.
 */
export function resolveEditTarget(requestedFile, servedFilePath, rootDir) {
  const workspaceRoot = findWorkspaceRoot(rootDir);
  const raw = typeof requestedFile === "string" ? requestedFile.split(/[?#]/)[0].trim() : "";

  let targetHtmlPath = path.resolve(servedFilePath);
  if (raw && raw !== "/") {
    if (path.isAbsolute(raw) && fs.existsSync(raw) && !isPathInside(workspaceRoot, raw) && !isPathInside(rootDir, raw)) {
      return { ok: false, status: 403, error: "Edit target must stay inside workspace root." };
    }
    const normalized = raw.replace(/\\/g, "/");
    const rel = normalized.replace(/^\/+/, "");
    const wsCandidate = path.resolve(workspaceRoot, rel);
    const rootCandidate = path.resolve(rootDir, rel);

    const insideWs = isPathInside(workspaceRoot, wsCandidate);
    const insideRoot = isPathInside(rootDir, rootCandidate);
    if (!insideWs && !insideRoot) {
      return { ok: false, status: 403, error: "Edit target must stay inside workspace root." };
    }

    if (insideWs && fs.existsSync(wsCandidate) && fs.statSync(wsCandidate).isFile()) {
      targetHtmlPath = wsCandidate;
    } else if (insideRoot && fs.existsSync(rootCandidate) && fs.statSync(rootCandidate).isFile()) {
      targetHtmlPath = rootCandidate;
    } else if (path.basename(rel) === path.basename(servedFilePath) && !rel.includes("/")) {
      targetHtmlPath = path.resolve(servedFilePath);
    } else {
      const extCheck = path.extname(rel).toLowerCase();
      if (extCheck && extCheck !== ".html" && extCheck !== ".htm") {
        return { ok: false, status: 403, error: "Edits are restricted to HTML report deliverables." };
      }
      return { ok: false, status: 404, error: `Target report not found: ${rel}` };
    }
  }

  const ext = path.extname(targetHtmlPath).toLowerCase();
  if (ext !== ".html" && ext !== ".htm") {
    return { ok: false, status: 403, error: "Edits are restricted to HTML report deliverables." };
  }

  const targetDir = path.dirname(targetHtmlPath);
  const manifestCandidate = path.join(targetDir, "report.manifest.json");
  let manifest = null;
  let manifestPath = null;
  if (fs.existsSync(manifestCandidate) && fs.statSync(manifestCandidate).isFile()) {
    manifestPath = manifestCandidate;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestCandidate, "utf-8"));
    } catch (_) {
      manifest = null;
    }
  }

  let fragmentPath = null;
  const manifestFrag = manifest?.files?.fragment;
  if (manifestFrag) {
    const cand = path.resolve(targetDir, manifestFrag);
    if (isPathInside(workspaceRoot, cand) && fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      fragmentPath = cand;
    }
  }
  if (!fragmentPath) {
    const siblingFrag = path.join(targetDir, "fragment.html");
    if (fs.existsSync(siblingFrag) && fs.statSync(siblingFrag).isFile()) {
      fragmentPath = siblingFrag;
    }
  }

  return {
    ok: true,
    workspaceRoot,
    targetHtmlPath,
    targetDir,
    targetRel: path.relative(workspaceRoot, targetHtmlPath).replace(/\\/g, "/"),
    fragmentPath,
    fragmentRel: fragmentPath ? path.relative(workspaceRoot, fragmentPath).replace(/\\/g, "/") : null,
    manifestPath,
    manifest
  };
}

/**
 * Updates theme, custom theme <style>, and #agent-manifest inside a standalone HTML report.
 */
export function applyStyleToStandaloneHtml(rawHtml, { theme = "light", compiledCustomCss = "" } = {}) {
  let html = String(rawHtml || "");
  const safeTheme = String(theme || "light").replace(/[^a-zA-Z0-9_-]/g, "") || "light";

  if (/<html\b[^>]*\bdata-theme=["'][^"']*["']/i.test(html)) {
    html = html.replace(/(<html\b[^>]*\bdata-theme=["'])[^"']*(["'])/i, `$1${safeTheme}$2`);
  } else {
    html = html.replace(/<html\b([^>]*)>/i, `<html$1 data-theme="${safeTheme}">`);
  }

  html = html.replace(/(<span\b[^>]*\bid=["']active-theme-label["'][^>]*>)[^<]*(<\/span>)/i, `$1${safeTheme}$2`);
  html = html.replace(/(<span\b[^>]*\bid=["']modal-active-theme-label["'][^>]*>)[^<]*(<\/span>)/i, `$1${safeTheme}$2`);

  const styleBlockRegex = /(<style\b[^>]*\bid=["']daisyui-custom-themes["'][^>]*>)[\s\S]*?(<\/style>)/i;
  if (styleBlockRegex.test(html)) {
    const inner = compiledCustomCss ? `\n${compiledCustomCss}\n  ` : "\n  ";
    html = html.replace(styleBlockRegex, `$1${inner}$2`);
  } else if (compiledCustomCss) {
    const styleTag = `  <style id="daisyui-custom-themes">\n${compiledCustomCss}\n  </style>\n`;
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${styleTag}</head>`) : `${styleTag}${html}`;
  }

  const manifestRegex = /(<script\b[^>]*\bid=["']agent-manifest["'][^>]*>)([\s\S]*?)(<\/script>)/i;
  const mMatch = html.match(manifestRegex);
  if (mMatch) {
    try {
      const parsed = JSON.parse(mMatch[2]);
      parsed.theme = safeTheme;
      if (parsed.pipeline && typeof parsed.pipeline.rebuildCommand === "string") {
        parsed.pipeline.rebuildCommand = parsed.pipeline.rebuildCommand.replace(/--theme\s+[^\s"']+/, `--theme ${safeTheme}`);
      }
      const safeJson = JSON.stringify(parsed, null, 2).replace(/<\//g, "<\\/");
      html = html.replace(manifestRegex, `$1\n${safeJson}\n  $3`);
    } catch (_) {}
  }

  return html;
}

/**
 * Extracts bounded outerHTML element/section slices matching target/anchor IDs
 * plus a compact section outline from fragment.html to eliminate discovery turns.
 */
export function extractFragmentContext(fragmentHtml, { targetIds = [], anchorIds = [], prompt = "" } = {}) {
  const html = String(fragmentHtml || "");
  const ids = [];
  const pushId = (id) => {
    const clean = String(id || "").replace(/^#/, "").trim();
    if (clean && !ids.includes(clean)) ids.push(clean);
  };

  for (const id of targetIds || []) pushId(id);
  for (const id of anchorIds || []) pushId(id);

  const targetMatches = prompt.matchAll(/Target Element:\s*#([a-zA-Z0-9_-]+)/g);
  for (const m of targetMatches) pushId(m[1]);
  const sectionMatches = prompt.matchAll(/Section:\s*[^\n(]*\(#([a-zA-Z0-9_-]+)\)/g);
  for (const m of sectionMatches) pushId(m[1]);

  const outline = [];
  const outlineRegex = /<(section|h[1-3])\b([^>]*\bid=["']([^"']+)["'][^>]*)>/gi;
  let oMatch;
  while ((oMatch = outlineRegex.exec(html)) !== null && outline.length < 30) {
    outline.push({ tag: oMatch[1].toLowerCase(), id: oMatch[3] });
  }

  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const slices = [];

  for (const id of ids) {
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const attrRegex = new RegExp(`<(?:[a-zA-Z][\\w:-]*)\\b[^>]*(?:id|data-agent-id)=["']${escapedId}["'][^>]*>`, "i");
    const m = attrRegex.exec(html);
    if (!m) continue;

    const startIdx = m.index;
    const tagMatch = m[0].match(/^<([a-zA-Z][\w:-]*)/);
    const tagName = tagMatch ? tagMatch[1].toLowerCase() : "";
    let endIdx = Math.min(html.length, startIdx + 6000);

    if (tagName && !voidTags.has(tagName) && !m[0].endsWith("/>")) {
      const openCloseRegex = new RegExp(`<(\\/)?${tagName}\\b[^>]*>`, "gi");
      openCloseRegex.lastIndex = startIdx;
      let depth = 0;
      let tMatch;
      while ((tMatch = openCloseRegex.exec(html)) !== null) {
        if (tMatch[1]) {
          depth -= 1;
          if (depth <= 0) {
            endIdx = tMatch.index + tMatch[0].length;
            break;
          }
        } else if (!tMatch[0].endsWith("/>")) {
          depth += 1;
        }
        if (tMatch.index - startIdx > 12000) break;
      }
    } else if (tagName) {
      endIdx = startIdx + m[0].length;
    }

    const sliceHtml = html.slice(startIdx, endIdx);
    slices.push({
      id,
      html: sliceHtml.length > 8000 ? sliceHtml.slice(0, 8000) + "\n<!-- ...truncated... -->" : sliceHtml
    });
  }

  return { requestedIds: ids, outline, slices };
}

/**
 * Parses a JSON surgical patch payload ({ patches: [{ find, replace }] }) from model output.
 */
export function parseSurgicalPatchPayload(rawText) {
  const text = String(rawText || "").trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    if (!parsed || !Array.isArray(parsed.patches) || parsed.patches.length === 0) return null;
    return parsed.patches;
  } catch (_) {
    return null;
  }
}

/**
 * Applies exact search-and-replace patches in memory, checks for lint regressions
 * relative to baseline, and verifies <100ms buildReport() assembly before disk write.
 */
export function applySurgicalFragmentPatches(fragmentHtml, patches, { buildOptions = null } = {}) {
  const original = String(fragmentHtml || "");
  if (!Array.isArray(patches) || patches.length === 0) {
    return { ok: false, reason: "No patches provided." };
  }

  let working = original;
  for (let i = 0; i < patches.length; i += 1) {
    const p = patches[i];
    if (!p || typeof p.find !== "string" || !p.find.length || typeof p.replace !== "string") {
      return { ok: false, reason: `Patch #${i + 1} is missing valid 'find' and 'replace' strings.` };
    }
    const first = working.indexOf(p.find);
    if (first === -1) {
      return { ok: false, reason: `Patch #${i + 1} 'find' substring did not match fragment.html.` };
    }
    const second = working.indexOf(p.find, first + p.find.length);
    if (second !== -1) {
      return { ok: false, reason: `Patch #${i + 1} 'find' substring matched multiple locations.` };
    }
    working = working.slice(0, first) + p.replace + working.slice(first + p.find.length);
  }

  if (!working.trim()) {
    return { ok: false, reason: "Patched fragment is empty." };
  }
  if (/<!DOCTYPE\b|<html\b|<head\b|<body\b/i.test(working)) {
    return { ok: false, reason: "Patched fragment introduced forbidden document boilerplate tags." };
  }
  const origHasMain = /<main\b/i.test(original);
  const newHasMain = /<main\b/i.test(working);
  if (!origHasMain && newHasMain) {
    return { ok: false, reason: "Patched fragment unexpectedly introduced <main> wrapper." };
  }
  if (origHasMain && (!/<main\b/i.test(working) || !/<\/main>/i.test(working))) {
    return { ok: false, reason: "Patched fragment broke <main> wrapper balance." };
  }

  const baseLint = lintFragment(original);
  const nextLint = lintFragment(working);
  const countType = (res, type) => res.issues.filter((iss) => iss.type === type).length;
  for (const issueType of ["MISSING_HEADING_ID", "BARE_TABLE"]) {
    if (countType(nextLint, issueType) > countType(baseLint, issueType)) {
      return { ok: false, reason: `Patched fragment introduced new ${issueType} lint regression.` };
    }
  }

  try {
    buildReport({
      title: buildOptions?.title || "HTML Report",
      content: working,
      mode: buildOptions?.mode || "report",
      theme: buildOptions?.theme || "light",
      addons: Array.isArray(buildOptions?.addons) ? buildOptions.addons : [],
      ai: Boolean(buildOptions?.ai),
      pwa: Boolean(buildOptions?.pwa)
    });
  } catch (err) {
    return { ok: false, reason: `Assembly validation failed: ${err.message}` };
  }

  return { ok: true, html: working, patchesApplied: patches.length };
}
