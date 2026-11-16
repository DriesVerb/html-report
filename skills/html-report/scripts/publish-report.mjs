#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { buildReport, stripAuthoringMarkup } from "./build-report.mjs";
import { isDirectCliExecution } from "./preflight.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

const TEXT_EMBED_EXTENSIONS = new Set([".json", ".csv", ".md", ".txt"]);
const MAX_EMBEDDED_TEXT_BYTES = 512 * 1024; // 512 KB total fallback cap
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

// Precompute IEEE 802.3 CRC32 lookup table
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(buf) {
  const bytes = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf), "utf8");
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Deterministic zero-dependency ZIP archive writer using node:zlib deflateRawSync + CRC32.
 * Uses a fixed DOS timestamp (1980-01-01 00:00:00) so identical inputs yield identical bytes.
 */
export function createZipBuffer(entries = []) {
  const normalized = entries
    .map((entry) => ({
      name: String(entry.name || "").replace(/\\/g, "/").replace(/^\/+/, ""),
      data: Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data ?? ""), "utf8"),
      compress: entry.compress !== false
    }))
    .filter((entry) => entry.name.length > 0)
    .sort((a, b) => {
      if (a.name === "index.html" && b.name !== "index.html") return -1;
      if (b.name === "index.html" && a.name !== "index.html") return 1;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });

  // Fixed DOS timestamp: 1980-01-01 00:00:00
  const dosTime = 0x0000;
  const dosDate = 0x0021;
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of normalized) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const rawBuf = entry.data;
    const crc = crc32(rawBuf);
    const deflated = entry.compress ? zlib.deflateRawSync(rawBuf) : rawBuf;
    const useDeflate = entry.compress && deflated.length < rawBuf.length;
    const method = useDeflate ? 8 : 0;
    const compBuf = useDeflate ? deflated : rawBuf;

    // Local File Header (30 bytes + filename)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4);         // Version needed to extract (2.0)
    localHeader.writeUInt16LE(0x0800, 6);     // General purpose bit flag (UTF-8)
    localHeader.writeUInt16LE(method, 8);     // Compression method
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compBuf.length, 18);
    localHeader.writeUInt32LE(rawBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);         // Extra field length

    localParts.push(localHeader, nameBuf, compBuf);

    // Central Directory Header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
    centralHeader.writeUInt16LE(0x031e, 4);     // Version made by (Unix 3.0)
    centralHeader.writeUInt16LE(20, 6);         // Version needed
    centralHeader.writeUInt16LE(0x0800, 8);     // UTF-8 flag
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compBuf.length, 20);
    centralHeader.writeUInt32LE(rawBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);         // Extra field length
    centralHeader.writeUInt16LE(0, 32);         // Comment length
    centralHeader.writeUInt16LE(0, 34);         // Disk number start
    centralHeader.writeUInt16LE(0, 36);         // Internal file attributes
    centralHeader.writeUInt32LE(0x81a40000, 38); // External file attributes (-rw-r--r--)
    centralHeader.writeUInt32LE(offset, 42);    // Relative offset of local header

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compBuf.length;
  }

  const centralDirBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);            // End of central directory signature
  eocd.writeUInt16LE(0, 4);                     // Number of this disk
  eocd.writeUInt16LE(0, 6);                     // Disk where central directory starts
  eocd.writeUInt16LE(normalized.length, 8);     // Entries on this disk
  eocd.writeUInt16LE(normalized.length, 10);    // Total entries
  eocd.writeUInt32LE(centralDirBuf.length, 12); // Size of central directory
  eocd.writeUInt32LE(offset, 16);               // Offset of central directory
  eocd.writeUInt16LE(0, 20);                    // Comment length

  return Buffer.concat([...localParts, centralDirBuf, eocd]);
}

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

  // Only inspect inline scripts inside <main> (or standalone non-runtime scripts) for relative fetch() calls
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

  // Inline external <link rel="stylesheet" href="https://...">
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

  // Inline external <script ... src="https://..."> tags (skipping cdn.tailwindcss.com JIT runtime)
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

/**
 * Injects reader-first fallbacks and a conditional Asset Recovery Banner into asset-based bundles ONLY.
 * Never injected into asset-free standalone HTML exports.
 */
export function injectAssetResilience(html, { assets = [] } = {}) {
  if (!assets || assets.length === 0) return html;

  // 1. Embed small text/data assets (.json, .csv, .md, .txt) up to 512 KB to bypass file:// CORS
  const embeddedMap = {};
  let totalBytes = 0;
  for (const asset of assets) {
    const ext = path.extname(asset.relPath).toLowerCase();
    if (!TEXT_EMBED_EXTENSIONS.has(ext)) continue;
    if (totalBytes + asset.size > MAX_EMBEDDED_TEXT_BYTES) continue;
    try {
      embeddedMap[asset.relPath] = fs.readFileSync(asset.diskPath, "utf-8");
      totalBytes += asset.size;
    } catch (_) {}
  }

  const safeEmbeddedJson = JSON.stringify(embeddedMap).replace(/<\//g, "<\\/");
  const assetListJson = JSON.stringify(assets.map((a) => a.relPath)).replace(/<\//g, "<\\/");

  const resilienceSnippet = `
  <script id="__html_report_embedded_assets__" type="application/json">${safeEmbeddedJson}</script>
  <script id="__html_report_asset_recovery__">
    (function () {
      if (typeof window === "undefined" || typeof document === "undefined") return;
      document.documentElement.setAttribute("data-asset-bundle", "true");

      var embeddedMap = {};
      try {
        var payloadEl = document.getElementById("__html_report_embedded_assets__");
        if (payloadEl && payloadEl.textContent) {
          embeddedMap = JSON.parse(payloadEl.textContent);
        }
      } catch (_) {}

      var expectedAssets = ${assetListJson};
      var missingAssets = new Set();
      var objectUrlMap = new Map();
      var bannerShown = false;

      function normalizeAssetPath(raw) {
        if (!raw || typeof raw !== "string") return "";
        var trimmed = raw.trim();
        if (!trimmed || trimmed.charAt(0) === "#" || trimmed.charAt(0) === "/") return "";
        if (/^(?:https?:|data:|blob:|mailto:|tel:|javascript:)/i.test(trimmed)) return "";
        var clean = trimmed.split(/[?#]/)[0].replace(/\\\\/g, "/").replace(/^\\.\\//, "");
        return clean;
      }

      function guessContentType(relPath) {
        var lower = String(relPath).toLowerCase();
        if (lower.endsWith(".json")) return "application/json; charset=utf-8";
        if (lower.endsWith(".csv")) return "text/csv; charset=utf-8";
        if (lower.endsWith(".md")) return "text/markdown; charset=utf-8";
        return "text/plain; charset=utf-8";
      }

      window.__resolveReportAsset = function (rawPath) {
        var norm = normalizeAssetPath(rawPath);
        if (norm && objectUrlMap.has(norm)) return { ok: true, url: objectUrlMap.get(norm), kind: "blob" };
        if (norm && Object.prototype.hasOwnProperty.call(embeddedMap, norm)) {
          return { ok: true, text: embeddedMap[norm], contentType: guessContentType(norm), kind: "embedded" };
        }
        return { ok: false, path: norm };
      };

      if (typeof window.fetch === "function") {
        var origFetch = window.fetch.bind(window);
        window.fetch = function (input, init) {
          var urlStr = typeof input === "string" ? input : (input && input.url ? input.url : "");
          var norm = normalizeAssetPath(urlStr);
          if (norm && Object.prototype.hasOwnProperty.call(embeddedMap, norm)) {
            if (window.location && window.location.protocol === "file:") {
              return Promise.resolve(new Response(embeddedMap[norm], {
                status: 200,
                headers: { "Content-Type": guessContentType(norm) }
              }));
            }
            return origFetch(input, init).catch(function () {
              return new Response(embeddedMap[norm], {
                status: 200,
                headers: { "Content-Type": guessContentType(norm) }
              });
            });
          }
          return origFetch(input, init);
        };
      }

      function renderBrokenImageFallback(img, relPath) {
        if (!img || img.dataset.assetFallbackApplied === "1") return;
        img.dataset.assetFallbackApplied = "1";
        img.setAttribute("data-orig-src", relPath);
        img.style.display = "none";

        var card = document.createElement("div");
        card.className = "rounded-box border border-dashed border-warning/70 bg-base-200/70 p-4 text-xs text-base-content/85 space-y-1.5 my-2";
        card.setAttribute("role", "status");
        card.setAttribute("data-asset-fallback-for", relPath);

        var badge = document.createElement("div");
        badge.className = "font-mono text-[11px] font-bold text-warning-content bg-warning/25 inline-block px-2 py-0.5 rounded";
        badge.textContent = "Missing image asset: " + relPath;

        var caption = document.createElement("p");
        caption.className = "text-xs leading-snug m-0";
        caption.textContent = img.getAttribute("alt") || ("Expected local file at " + relPath);

        card.appendChild(badge);
        card.appendChild(caption);
        if (img.parentNode) {
          img.parentNode.insertBefore(card, img.nextSibling);
        }
      }

      function showRecoveryBanner() {
        if (bannerShown || missingAssets.size === 0 || !document.body) return;
        bannerShown = true;

        var existing = document.getElementById("html-report-asset-recovery-banner");
        if (existing) existing.remove();

        var banner = document.createElement("div");
        banner.id = "html-report-asset-recovery-banner";
        banner.setAttribute("role", "region");
        banner.setAttribute("aria-label", "Missing local assets recovery");
        banner.className = "bg-warning/15 border-b border-warning/40 text-base-content px-4 py-3 text-xs print:hidden";
        banner.innerHTML =
          '<div class="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
            '<div class="space-y-0.5 min-w-0 flex-1">' +
              '<p class="font-bold text-xs sm:text-sm m-0">External report assets in <code>refs/</code> were not found alongside <code>index.html</code></p>' +
              '<p class="text-xs opacity-80 m-0">Keep <code>index.html</code> in the same unzipped folder as <code>refs/</code>, or locate your extracted <code>refs/</code> folder to restore images and documents in-browser (missing: <span id="html-report-missing-count" class="font-mono font-semibold">' + missingAssets.size + '</span>).</p>' +
            '</div>' +
            '<div class="flex items-center gap-2 shrink-0 flex-wrap">' +
              '<input id="html-report-refs-picker" type="file" webkitdirectory multiple class="hidden" aria-label="Select refs folder" />' +
              '<button id="html-report-select-refs-btn" type="button" class="btn btn-xs sm:btn-sm btn-warning font-semibold">Select refs/ Folder</button>' +
              '<button id="html-report-dismiss-recovery-btn" type="button" class="btn btn-xs sm:btn-sm btn-ghost">Dismiss</button>' +
            '</div>' +
          '</div>';

        var header = document.querySelector("header");
        if (header && header.parentNode) {
          header.parentNode.insertBefore(banner, header.nextSibling);
        } else {
          document.body.insertBefore(banner, document.body.firstChild);
        }

        var picker = document.getElementById("html-report-refs-picker");
        var pickBtn = document.getElementById("html-report-select-refs-btn");
        var dismissBtn = document.getElementById("html-report-dismiss-recovery-btn");

        if (dismissBtn) {
          dismissBtn.addEventListener("click", function () {
            banner.remove();
          });
        }
        if (pickBtn && picker) {
          pickBtn.addEventListener("click", function () {
            picker.click();
          });
          picker.addEventListener("change", function () {
            relinkSelectedFiles(picker.files, banner);
          });
        }
      }

      function relinkSelectedFiles(fileList, banner) {
        if (!fileList || fileList.length === 0) return;
        var byRel = new Map();
        var byBase = new Map();
        for (var i = 0; i < fileList.length; i++) {
          var f = fileList[i];
          var rel = String(f.webkitRelativePath || f.name || "").replace(/\\\\/g, "/");
          var blobUrl = URL.createObjectURL(f);
          var refsIdx = rel.indexOf("refs/");
          if (refsIdx !== -1) {
            byRel.set(rel.slice(refsIdx), blobUrl);
          }
          var cleanRel = rel.replace(/^[^/]+\\//, "");
          if (cleanRel) byRel.set(cleanRel, blobUrl);
          byBase.set(f.name, blobUrl);
        }

        var restored = 0;
        document.querySelectorAll("img").forEach(function (img) {
          var orig = img.getAttribute("data-orig-src") || normalizeAssetPath(img.getAttribute("src"));
          if (!orig) return;
          var base = orig.split("/").pop();
          var matched = byRel.get(orig) || byBase.get(base);
          if (matched) {
            objectUrlMap.set(orig, matched);
            img.src = matched;
            img.style.display = "";
            img.removeAttribute("data-asset-fallback-applied");
            missingAssets.delete(orig);
            document.querySelectorAll('[data-asset-fallback-for]').forEach(function (card) {
              if (card.getAttribute("data-asset-fallback-for") === orig) card.remove();
            });
            restored++;
          }
        });

        document.querySelectorAll("a[href]").forEach(function (anchor) {
          var orig = anchor.getAttribute("data-orig-href") || normalizeAssetPath(anchor.getAttribute("href"));
          if (!orig) return;
          var base = orig.split("/").pop();
          var matched = byRel.get(orig) || byBase.get(base);
          if (matched) {
            anchor.setAttribute("data-orig-href", orig);
            anchor.setAttribute("href", matched);
            objectUrlMap.set(orig, matched);
            missingAssets.delete(orig);
            restored++;
          }
        });

        if (restored > 0 && banner) {
          banner.classList.remove("bg-warning/15", "border-warning/40");
          banner.classList.add("bg-success/15", "border-success/40");
          var countEl = document.getElementById("html-report-missing-count");
          if (countEl) countEl.textContent = "0 (restored " + restored + ")";
        }
      }

      function markMissing(relPath, img) {
        if (!relPath) return;
        missingAssets.add(relPath);
        if (img) renderBrokenImageFallback(img, relPath);
      }

      document.addEventListener("error", function (e) {
        var target = e && e.target;
        if (!target || target.tagName !== "IMG") return;
        var norm = normalizeAssetPath(target.getAttribute("data-orig-src") || target.getAttribute("src"));
        if (norm) {
          markMissing(norm, target);
          showRecoveryBanner();
        }
      }, true);

      function auditRelativeAssets() {
        document.querySelectorAll("img[src]").forEach(function (img) {
          var norm = normalizeAssetPath(img.getAttribute("data-orig-src") || img.getAttribute("src"));
          if (!norm) return;
          if (img.complete && img.naturalWidth === 0) {
            markMissing(norm, img);
          }
        });
        if (missingAssets.size > 0) {
          showRecoveryBanner();
        }
      }

      if (document.readyState === "complete") {
        setTimeout(auditRelativeAssets, 450);
      } else {
        window.addEventListener("load", function () {
          setTimeout(auditRelativeAssets, 450);
        });
      }
      window.__HTMLReportAssetRecovery = {
        expectedAssets: expectedAssets,
        getMissingAssets: function () { return Array.from(missingAssets); },
        audit: auditRelativeAssets
      };
    })();
  </script>`;

  let out = String(html);
  if (/<html([^>]*)>/i.test(out)) {
    out = out.replace(/<html([^>]*)>/i, (full, attrs) =>
      /data-asset-bundle/i.test(attrs) ? full : `<html${attrs} data-asset-bundle="true">`
    );
  }
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, () => `${resilienceSnippet}\n</body>`);
  } else {
    out += resilienceSnippet;
  }
  return out;
}

function slugifyTitle(str = "html-report") {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "html-report";
}

function ensurePublishedMeta(html) {
  let out = stripAuthoringMarkup(String(html));
  out = out.replace(/[ \t]*<!-- __html_report_live_reload_injected__ -->[\s\S]*?<script id="__html_report_live_reload__"[\s\S]*?<\/script>\s*/gi, "");
  if (!/<meta\s+name=["']html-report-published["']/i.test(out) && /<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, '  <meta name="html-report-published" content="true" />\n</head>');
  }
  return out;
}

/**
 * Publishes an html-report project or HTML file as either:
 * - A single self-contained `<slug>-published.html` (when asset-free)
 * - A deterministic `<slug>-published.zip` (`index.html` + `refs/...`) when local assets exist.
 */
export async function publishProject({
  project = null,
  projectDir = null,
  inputPath = null,
  outputPath = null,
  theme = null,
  inlineCdn = false,
  writeOutput = true,
  workspaceRoot = REPO_ROOT,
  fetchFn = globalThis.fetch
} = {}) {
  let resolvedProjectDir = projectDir ? path.resolve(projectDir) : null;
  if (!resolvedProjectDir && project) {
    resolvedProjectDir = path.resolve(workspaceRoot, "projects", project);
  }
  if (!resolvedProjectDir && inputPath) {
    resolvedProjectDir = path.dirname(path.resolve(inputPath));
  }
  if (!resolvedProjectDir || !fs.existsSync(resolvedProjectDir)) {
    throw new Error(`Project directory not found: ${resolvedProjectDir || "(unspecified)"}`);
  }

  let manifest = {};
  const manifestPath = path.join(resolvedProjectDir, "report.manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch (_) {}
  }

  const slug = slugifyTitle(project || manifest.project || path.basename(resolvedProjectDir));
  const resolvedInput = inputPath ? path.resolve(inputPath) : null;
  let fragmentPath = null;
  if (resolvedInput && path.basename(resolvedInput).includes("fragment") && fs.existsSync(resolvedInput)) {
    fragmentPath = resolvedInput;
  } else if (manifest?.files?.fragment) {
    const cand = path.resolve(workspaceRoot, manifest.files.fragment);
    const localCand = path.resolve(resolvedProjectDir, path.basename(manifest.files.fragment));
    if (fs.existsSync(cand)) fragmentPath = cand;
    else if (fs.existsSync(localCand)) fragmentPath = localCand;
  } else if (fs.existsSync(path.join(resolvedProjectDir, "fragment.html"))) {
    fragmentPath = path.join(resolvedProjectDir, "fragment.html");
  }

  let html = "";
  let title = manifest.title || slug;
  let mode = manifest.mode || null;
  let resolvedTheme = theme || manifest.theme || "light";

  if (fragmentPath && fs.existsSync(fragmentPath)) {
    const fragmentContent = fs.readFileSync(fragmentPath, "utf-8");
    const built = buildReport({
      title,
      content: fragmentContent,
      project: slug,
      contentPath: path.relative(workspaceRoot, fragmentPath).replace(/\\/g, "/"),
      mode,
      theme: resolvedTheme,
      favicon: manifest.favicon || "📊",
      addons: Array.isArray(manifest.activeAddons) ? manifest.activeAddons : [],
      published: true,
      workspaceRoot
    });
    html = built.html;
    mode = built.mode;
    resolvedTheme = built.theme;
  } else {
    const htmlCandidate =
      (resolvedInput && fs.existsSync(resolvedInput) && resolvedInput) ||
      (fs.existsSync(path.join(resolvedProjectDir, "index.html")) && path.join(resolvedProjectDir, "index.html")) ||
      null;
    if (!htmlCandidate) {
      throw new Error(`No fragment.html or entry HTML found in ${resolvedProjectDir}`);
    }
    html = ensurePublishedMeta(fs.readFileSync(htmlCandidate, "utf-8"));
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1].trim()) title = titleMatch[1].trim();
  }

  if (inlineCdn) {
    html = await inlineCdnAssets(html, { fetchFn });
  }

  const discovery = discoverReportAssets(resolvedProjectDir, html);
  let kind = "html";
  let filename = `${slug}-published.html`;
  let buffer;

  if (discovery.isAssetBased) {
    kind = "zip";
    filename = `${slug}-published.zip`;
    const resilientHtml = injectAssetResilience(html, {
      assets: discovery.assets,
      projectDir: resolvedProjectDir
    });
    const zipEntries = [
      { name: "index.html", data: Buffer.from(resilientHtml, "utf-8") },
      ...discovery.assets.map((asset) => ({
        name: asset.relPath,
        data: fs.readFileSync(asset.diskPath)
      }))
    ];
    buffer = createZipBuffer(zipEntries);
    html = resilientHtml;
  } else {
    buffer = Buffer.from(html, "utf-8");
  }

  let writtenPath = null;
  if (writeOutput) {
    const targetPath = outputPath
      ? path.resolve(outputPath)
      : path.join(resolvedProjectDir, filename);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, buffer);
    writtenPath = targetPath;
  }

  return {
    ok: true,
    slug,
    title,
    mode,
    theme: resolvedTheme,
    kind,
    filename,
    outputPath: writtenPath,
    isAssetBased: discovery.isAssetBased,
    assets: discovery.assets.map((a) => ({ relPath: a.relPath, size: a.size })),
    missingReferences: discovery.missingReferences,
    byteLength: buffer.length,
    buffer,
    html
  };
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    project: null,
    dir: null,
    input: null,
    output: null,
    theme: null,
    inlineCdn: false,
    json: false,
    help: false
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === "--project" || arg === "-p") && args[i + 1]) opts.project = args[++i];
    else if ((arg === "--dir" || arg === "-d") && args[i + 1]) opts.dir = args[++i];
    else if ((arg === "--input" || arg === "-i") && args[i + 1]) opts.input = args[++i];
    else if ((arg === "--output" || arg === "-o") && args[i + 1]) opts.output = args[++i];
    else if ((arg === "--theme" || arg === "-t") && args[i + 1]) opts.theme = args[++i];
    else if (arg === "--inline-cdn") opts.inlineCdn = true;
    else if (arg === "--json") opts.json = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
  }
  return opts;
}

if (isDirectCliExecution(process.argv[1], import.meta.url)) {
  const opts = parseArgs(process.argv);
  if (opts.help || (!opts.project && !opts.dir && !opts.input)) {
    console.log(`
html-report Asset-Aware Publisher

Usage:
  node skills/html-report/scripts/publish-report.mjs --project <slug> [options]
  node skills/html-report/scripts/publish-report.mjs --dir <project-dir> [options]

Options:
  -p, --project <slug>   Publish projects/<slug>/
  -d, --dir <path>       Explicit project directory path
  -i, --input <path>     Explicit fragment.html or entry HTML path
  -o, --output <path>    Output .html or .zip file path
  -t, --theme <name>     Override DaisyUI theme
      --inline-cdn       Fetch & inline external CDN stylesheets/scripts
      --json             Emit machine-readable JSON summary
  -h, --help             Show this help message
    `.trim());
    process.exit(opts.help ? 0 : 1);
  }

  publishProject({
    project: opts.project,
    projectDir: opts.dir,
    inputPath: opts.input,
    outputPath: opts.output,
    theme: opts.theme,
    inlineCdn: opts.inlineCdn
  })
    .then((result) => {
      if (opts.json) {
        const { buffer: _buf, html: _html, ...summary } = result;
        console.log(JSON.stringify(summary, null, 2));
      } else {
        console.log(
          `✅ Published (${result.kind.toUpperCase()}): ${result.outputPath} (${result.byteLength} bytes, assets=${result.assets.length})`
        );
      }
    })
    .catch((err) => {
      console.error(`❌ Publish failed: ${err.message}`);
      process.exit(1);
    });
}
