/**
 * Local report asset discovery (refs/, relative src/href/fetch) and optional
 * CDN stylesheet/script inliner for @html-report/core publisher.
 */
import fs from "node:fs";
import path from "node:path";

const IGNORED_PROJECT_FILES = new Set([
  "index.html",
  "published.html",
  "fragment.html",
  "report.manifest.json",
  "agents.md",
  "package.json",
  "package-lock.json",
  "local-assistant.mjs",
  "personas.json",
  "sw.js",
  "manifest.webmanifest"
]);

function isRelativeLocalRef(rawRef) {
  if (!rawRef || typeof rawRef !== "string") return false;
  const trimmed = rawRef.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("/")) return false;
  if (trimmed.includes("${") || /[()<>]/.test(trimmed)) return false;
  if (/^(?:https?:|data:|blob:|mailto:|tel:|javascript:)/i.test(trimmed)) return false;
  return true;
}

function normalizeRelativeAssetPath(rawRef) {
  if (!isRelativeLocalRef(rawRef)) return null;
  const withoutQueryOrHash = rawRef.trim().split(/[?#]/)[0];
  if (!withoutQueryOrHash) return null;
  const posix = path.posix.normalize(withoutQueryOrHash.replace(/\\/g, "/").replace(/^\.\//, ""));
  if (!posix || posix === "." || posix.startsWith("../") || posix === ".." || posix.startsWith("/")) {
    return null;
  }
  return posix;
}

function walkFilesRecursive(dirPath, baseDir, out = []) {
  if (!fs.existsSync(dirPath)) return out;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFilesRecursive(full, baseDir, out);
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, full).replace(/\\/g, "/");
      out.push({
        relPath,
        diskPath: full,
        size: fs.statSync(full).size
      });
    }
  }
  return out;
}

/**
 * Inspects a project directory and compiled HTML to discover local relative assets
 * (`refs/`, relative `src`/`href`, and local `fetch(...)` calls).
 */
export function discoverReportAssets(projectDir, html = "") {
  const resolvedDir = projectDir ? path.resolve(projectDir) : null;
  const refsDir = resolvedDir ? path.join(resolvedDir, "refs") : null;
  const refsFiles = refsDir && fs.existsSync(refsDir) && fs.statSync(refsDir).isDirectory()
    ? walkFilesRecursive(refsDir, resolvedDir)
    : [];

  const referencedSet = new Set();
  const htmlWithoutScriptsOrStyles = String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  const attrRegex = /(?:^|\s)(?:src|href|poster|data)\s*=\s*(["'])([^"']+)\1/gi;
  let match;
  while ((match = attrRegex.exec(htmlWithoutScriptsOrStyles)) !== null) {
    const norm = normalizeRelativeAssetPath(match[2]);
    if (norm) referencedSet.add(norm);
  }

  const mainMatch = String(html).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const fetchScanTarget = mainMatch ? mainMatch[1] : String(html);
  const fetchRegex = /\bfetch\s*\(\s*(["'`])([^"'`\n]+)\1/gi;
  while ((match = fetchRegex.exec(fetchScanTarget)) !== null) {
    const norm = normalizeRelativeAssetPath(match[2]);
    if (norm) referencedSet.add(norm);
  }

  const assetMap = new Map();
  for (const rf of refsFiles) {
    assetMap.set(rf.relPath, rf);
  }

  const missingReferences = [];
  for (const relPath of referencedSet) {
    if (IGNORED_PROJECT_FILES.has(relPath.toLowerCase())) continue;
    if (assetMap.has(relPath)) continue;
    if (resolvedDir) {
      const candidate = path.resolve(resolvedDir, relPath);
      const inside = candidate === resolvedDir || candidate.startsWith(resolvedDir + path.sep);
      if (inside && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        assetMap.set(relPath, {
          relPath,
          diskPath: candidate,
          size: fs.statSync(candidate).size
        });
      } else {
        missingReferences.push(relPath);
      }
    }
  }

  const assets = Array.from(assetMap.values()).sort((a, b) =>
    a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0
  );

  return {
    isAssetBased: assets.length > 0,
    assets,
    refsFiles,
    referencedPaths: Array.from(referencedSet).sort(),
    missingReferences
  };
}

/**
 * Optionally inlines external CDN stylesheets and scripts while preserving ES module
 * semantics (`type="module"`) and relocating classic `[defer]` scripts to the end of `<body>`.
 */
export async function inlineCdnAssets(html, { fetchFn = globalThis.fetch } = {}) {
  if (typeof fetchFn !== "function") return html;
  let out = String(html);

  const linkMatches = [...out.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>/gi)];
  for (const m of linkMatches) {
    const fullTag = m[0];
    const href = m[1];
    try {
      const res = await fetchFn(href);
      if (!res || !res.ok) continue;
      let cssText = await res.text();
      cssText = cssText.replace(/url\((['"]?)(?!data:|https?:|#)([^'")]+)\1\)/g, (orig, quote, relPath) => {
        try {
          return `url("${new URL(relPath, href).href}")`;
        } catch {
          return orig;
        }
      });
      out = out.replace(fullTag, () => `<style data-inlined-href="${href}">\n${cssText}\n</style>`);
    } catch (_) {}
  }

  const scriptMatches = [...out.matchAll(/<script\b([^>]*?)\bsrc=["'](https?:\/\/[^"']+)["']([^>]*)>\s*<\/script>/gi)];
  const deferredToBody = [];
  for (const m of scriptMatches) {
    const fullTag = m[0];
    const attrs = `${m[1] || ""} ${m[3] || ""}`;
    const src = m[2];
    if (src.includes("cdn.tailwindcss.com")) continue;
    try {
      const res = await fetchFn(src);
      if (!res || !res.ok) continue;
      const jsText = (await res.text()).replace(/<\/script>/gi, "<\\/script>");
      const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
      const origType = typeMatch ? typeMatch[1].trim() : "";
      const hasDefer = /\bdefer\b/i.test(attrs);
      const isModule = origType.toLowerCase() === "module";
      const typeAttr = origType ? ` type="${origType}"` : "";
      const inlinedTag = `<script data-inlined-src="${src}"${typeAttr}>\n${jsText}\n</script>`;

      if (!isModule && hasDefer) {
        out = out.replace(fullTag, () => "");
        deferredToBody.push(inlinedTag);
      } else {
        out = out.replace(fullTag, () => inlinedTag);
      }
    } catch (_) {}
  }

  if (deferredToBody.length > 0 && /<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, () => `${deferredToBody.join("\n")}\n</body>`);
  }
  return out;
}
