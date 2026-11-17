/**
 * Reader-first embedded asset fallback & conditional Asset Recovery Banner injector
 * for asset-based published ZIP bundles.
 */
import fs from "node:fs";
import path from "node:path";

const TEXT_EMBED_EXTENSIONS = new Set([".json", ".csv", ".md", ".txt"]);
const MAX_EMBEDDED_TEXT_BYTES = 512 * 1024;

/**
 * Injects reader-first fallbacks and a conditional Asset Recovery Banner into asset-based bundles ONLY.
 * Never injected into asset-free standalone HTML exports.
 */
export function injectAssetResilience(html, { assets = [] } = {}) {
  if (!assets || assets.length === 0) return html;

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
