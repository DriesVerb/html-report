/**
 * On-Demand Disk Vendor Downloader & Local CDN Cache (@html-report/core)
 *
 * Lazily resolves and persists only the CDN packages actually used by a report
 * (`Core 4` + active addons detected via `detectAddons()`) into `.cache/html-report-cdn/`.
 * Uses atomic temp-file + rename persistence (`<sha256>.body` + `<sha256>.meta.json`)
 * and optional cryptographic SRI verification (`sha256-`, `sha384-`, `sha512-`).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ADDON_REGISTRY, detectAddons } from "./addon-registry.mjs";

export const SUPPORTED_CDN_HOSTS = [
  "cdn.tailwindcss.com",
  "cdn.jsdelivr.net",
  "unpkg.com",
  "cdnjs.cloudflare.com",
  "server.arcgisonline.com"
];

export const CORE_CDN_ASSETS = [
  {
    url: "https://cdn.jsdelivr.net/npm/daisyui@4.12.14/dist/full.min.css",
    addonKey: "core:daisyui",
    integrity: "sha384-iMbeRReqpIEp0z+cPe0FZxnbV/GbGyGjDfou8Rjcr6KSJIptc245QXNVjLMtu5TR",
    crossOrigin: "anonymous",
    contentType: "text/css; charset=utf-8"
  },
  {
    url: "https://cdn.tailwindcss.com",
    addonKey: "core:tailwindcss",
    integrity: null,
    crossOrigin: null,
    contentType: "application/javascript; charset=utf-8"
  },
  {
    url: "https://cdn.jsdelivr.net/npm/lucide@0.460.0/dist/umd/lucide.min.js",
    addonKey: "core:lucide",
    integrity: "sha384-ieG+IKD0d/ZPXyCBTMVAbqsQdns8QGJR/e26WMw7M4fkaI/rHcS/YIoi+ah9WGge",
    crossOrigin: "anonymous",
    contentType: "application/javascript; charset=utf-8"
  },
  {
    url: "https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js",
    addonKey: "core:alpinejs",
    integrity: "sha384-iZD2X8o1Zdq0HR5H/7oa8W30WS4No+zWCKUPD7fHRay9I1Gf+C4F8sVmw7zec1wW",
    crossOrigin: "anonymous",
    contentType: "application/javascript; charset=utf-8"
  }
];

/**
 * Normalizes a CDN URL so bare origins (e.g. `https://cdn.tailwindcss.com`)
 * and trailing-slash origins (`https://cdn.tailwindcss.com/`) hash identically.
 */
export function normalizeCdnUrl(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).toString();
  } catch (_) {
    return trimmed;
  }
}

/**
 * Checks whether a URL belongs to one of the supported external CDN hosts.
 */
export function isSupportedCdnUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || "").trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    return SUPPORTED_CDN_HOSTS.includes(parsed.hostname.toLowerCase());
  } catch (_) {
    return false;
  }
}

/**
 * Computes the deterministic SHA-256 hex key for a CDN URL.
 */
export function getCdnCacheKey(rawUrl) {
  const normalized = normalizeCdnUrl(rawUrl);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Resolves the default disk cache directory (`<workspaceRoot>/.cache/html-report-cdn`),
 * falling back to `os.tmpdir()/html-report-cdn-cache` if unwritable.
 */
export function getDefaultCdnCacheDir(workspaceRoot = process.cwd()) {
  const preferred = path.resolve(workspaceRoot, ".cache", "html-report-cdn");
  try {
    fs.mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch (_) {
    const fallback = path.join(os.tmpdir(), "html-report-cdn-cache");
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

export function resolveCdnCacheDir(cacheDir = null, workspaceRoot = process.cwd()) {
  if (cacheDir && String(cacheDir).trim()) {
    const resolved = path.resolve(workspaceRoot, String(cacheDir).trim());
    fs.mkdirSync(resolved, { recursive: true });
    return resolved;
  }
  return getDefaultCdnCacheDir(workspaceRoot);
}

/**
 * Returns the `<sha256>.body` and `<sha256>.meta.json` paths for a URL in `cacheDir`.
 */
export function getCdnCachePaths(rawUrl, cacheDir = null) {
  const dir = resolveCdnCacheDir(cacheDir);
  const key = getCdnCacheKey(rawUrl);
  return {
    cacheDir: dir,
    key,
    bodyPath: path.join(dir, `${key}.body`),
    metaPath: path.join(dir, `${key}.meta.json`)
  };
}

/**
 * Infers an HTTP Content-Type header for a CDN URL when not explicitly supplied.
 */
export function inferCdnContentType(rawUrl, responseContentType = null) {
  if (responseContentType && String(responseContentType).trim()) {
    return String(responseContentType).trim();
  }
  const cleanUrl = String(rawUrl || "").split("?")[0].toLowerCase();
  if (cleanUrl.endsWith(".css")) return "text/css; charset=utf-8";
  if (cleanUrl.endsWith(".js") || cleanUrl.endsWith(".mjs") || cleanUrl.includes("cdn.tailwindcss.com")) {
    return "application/javascript; charset=utf-8";
  }
  if (cleanUrl.endsWith(".json") || cleanUrl.endsWith(".map")) return "application/json; charset=utf-8";
  if (cleanUrl.endsWith(".svg")) return "image/svg+xml";
  if (cleanUrl.endsWith(".png")) return "image/png";
  if (cleanUrl.endsWith(".woff2")) return "font/woff2";
  if (cleanUrl.endsWith(".woff")) return "font/woff";
  if (cleanUrl.endsWith(".ttf")) return "font/ttf";
  return "application/octet-stream";
}

/**
 * Verifies a Buffer against an SRI integrity string (e.g., `sha384-...`).
 * Returns `{ valid: true, algorithm, expected, actual }` or `{ valid: false, ... }`.
 */
export function verifySriIntegrity(bodyBuffer, integrity) {
  if (!integrity || !String(integrity).trim()) {
    return { valid: true, skipped: true };
  }
  const buffer = Buffer.isBuffer(bodyBuffer) ? bodyBuffer : Buffer.from(bodyBuffer);
  const tokens = String(integrity).trim().split(/\s+/).filter(Boolean);
  let lastResult = { valid: true, skipped: true };

  for (const token of tokens) {
    const match = token.match(/^(sha256|sha384|sha512)-([A-Za-z0-9+/=]+)$/);
    if (!match) continue;
    const [, algorithm, expectedHash] = match;
    const actualHash = crypto.createHash(algorithm).update(buffer).digest("base64");
    if (actualHash === expectedHash) {
      return {
        valid: true,
        skipped: false,
        algorithm,
        expected: `${algorithm}-${expectedHash}`,
        actual: `${algorithm}-${actualHash}`
      };
    }
    lastResult = {
      valid: false,
      skipped: false,
      algorithm,
      expected: `${algorithm}-${expectedHash}`,
      actual: `${algorithm}-${actualHash}`
    };
  }

  return lastResult;
}

/**
 * Parses `<script src="...">` and `<link rel="stylesheet" href="...">` tags from an HTML snippet.
 */
function parseHeadAssetTags(htmlSnippet = "", addonKey = "addon") {
  const assets = [];
  const tagRegex = /<(script|link)\b([^>]*)>/gi;
  let match;
  while ((match = tagRegex.exec(htmlSnippet)) !== null) {
    const tagName = match[1].toLowerCase();
    const attrs = match[2] || "";
    const urlMatch = tagName === "script"
      ? attrs.match(/\bsrc=["']([^"']+)["']/i)
      : attrs.match(/\bhref=["']([^"']+)["']/i);
    if (!urlMatch) continue;
    if (tagName === "link" && !/\brel=["']stylesheet["']/i.test(attrs)) continue;

    const url = urlMatch[1].trim();
    if (!isSupportedCdnUrl(url)) continue;

    const integrityMatch = attrs.match(/\bintegrity=["']([^"']+)["']/i);
    const crossOriginMatch = attrs.match(/\bcrossorigin(?:=["']([^"']*)["'])?/i);

    assets.push({
      url,
      addonKey,
      integrity: integrityMatch ? integrityMatch[1].trim() : null,
      crossOrigin: crossOriginMatch ? (crossOriginMatch[1] || "anonymous") : null,
      contentType: inferCdnContentType(url)
    });
  }
  return assets;
}

/**
 * Builds a lookup table of known CDN assets (Core 4 + all ADDON_REGISTRY entries)
 * keyed by normalized URL for fast SRI & metadata lookup.
 */
function buildKnownAssetMap() {
  const map = new Map();
  for (const item of CORE_CDN_ASSETS) {
    map.set(normalizeCdnUrl(item.url), item);
  }
  for (const [key, addon] of Object.entries(ADDON_REGISTRY)) {
    for (const item of parseHeadAssetTags(addon.head || "", key)) {
      map.set(normalizeCdnUrl(item.url), item);
    }
  }
  return map;
}

const KNOWN_CDN_ASSET_MAP = buildKnownAssetMap();

export function getKnownCdnAssetMeta(rawUrl) {
  return KNOWN_CDN_ASSET_MAP.get(normalizeCdnUrl(rawUrl)) || null;
}

/**
 * Extracts the exact set of CDN asset descriptors (`Core 4` + active addons)
 * actually used by a report or `<main>` fragment. Never includes unused addons.
 */
export function extractUsedCdnAssets(html = "", { explicitAddons = [], autoDetect = true } = {}) {
  const source = String(html || "");
  const byNormalizedUrl = new Map();

  for (const coreAsset of CORE_CDN_ASSETS) {
    byNormalizedUrl.set(normalizeCdnUrl(coreAsset.url), { ...coreAsset });
  }

  let manifestAddons = null;
  const manifestMatch = source.match(/<script\b[^>]*id=["']agent-manifest["'][^>]*>([\s\S]*?)<\/script>/i);
  if (manifestMatch) {
    try {
      const parsedManifest = JSON.parse(manifestMatch[1]);
      if (Array.isArray(parsedManifest?.activeAddons)) {
        manifestAddons = parsedManifest.activeAddons;
      }
    } catch (_) {}
  }

  const activeAddonKeys = manifestAddons
    ? detectAddons("", [...manifestAddons, ...explicitAddons], { autoDetect: false })
    : detectAddons(source, explicitAddons, { autoDetect });

  for (const key of activeAddonKeys) {
    const addon = ADDON_REGISTRY[key];
    if (!addon?.head) continue;
    for (const asset of parseHeadAssetTags(addon.head, key)) {
      const norm = normalizeCdnUrl(asset.url);
      if (!byNormalizedUrl.has(norm)) {
        byNormalizedUrl.set(norm, asset);
      }
    }
  }

  for (const explicitAsset of parseHeadAssetTags(source, "explicit")) {
    const norm = normalizeCdnUrl(explicitAsset.url);
    if (!byNormalizedUrl.has(norm)) {
      byNormalizedUrl.set(norm, explicitAsset);
    }
  }

  return Array.from(byNormalizedUrl.values());
}

/**
 * Returns the exact list of CDN URLs (`Core 4` + active addons) used by `html`.
 */
export function extractUsedCdnUrls(html = "", options = {}) {
  return extractUsedCdnAssets(html, options).map((asset) => asset.url);
}

/**
 * Checks whether all CDN packages used by `html` (or an array of URLs) are already cached on disk.
 */
export function areUsedVendorsCached(input = "", { cacheDir = null, verifyIntegrity = false } = {}) {
  const resolvedDir = resolveCdnCacheDir(cacheDir);
  const urls = typeof input === "string"
    ? extractUsedCdnUrls(input)
    : (Array.isArray(input) ? input.map((item) => (typeof item === "string" ? item : item.url)) : []);
  if (urls.length === 0) return false;
  return urls.every((url) => Boolean(readCachedVendorAsset(url, { cacheDir: resolvedDir, verifyIntegrity })));
}

/**
 * Reads a cached vendor package from `<cacheDir>/<sha256>.body` + `<sha256>.meta.json`.
 * Returns `{ key, body, meta, bodyPath, metaPath }` or `null` on cache miss.
 */
export function readCachedVendorAsset(rawUrl, { cacheDir = null, verifyIntegrity = false } = {}) {
  const { key, bodyPath, metaPath } = getCdnCachePaths(rawUrl, cacheDir);
  if (!fs.existsSync(bodyPath) || !fs.existsSync(metaPath)) {
    return null;
  }
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    const body = fs.readFileSync(bodyPath);
    if (verifyIntegrity) {
      const expectedIntegrity = meta.integrity || getKnownCdnAssetMeta(rawUrl)?.integrity || null;
      if (expectedIntegrity) {
        const check = verifySriIntegrity(body, expectedIntegrity);
        if (!check.valid) return null;
      }
    }
    return { key, body, meta, bodyPath, metaPath };
  } catch (_) {
    return null;
  }
}

/**
 * Atomically writes `<sha256>.body` and `<sha256>.meta.json` to disk using temp files + rename.
 * If `integrity` is provided (or known in `ADDON_REGISTRY` / `CORE_CDN_ASSETS`), validates SRI before persisting.
 */
export function writeCachedVendorAsset(
  rawUrl,
  rawBody,
  {
    cacheDir = null,
    contentType = null,
    status = 200,
    headers = {},
    integrity = undefined,
    verifyIntegrity = true
  } = {}
) {
  const { cacheDir: resolvedDir, key, bodyPath, metaPath } = getCdnCachePaths(rawUrl, cacheDir);
  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody ?? "");
  const knownMeta = getKnownCdnAssetMeta(rawUrl);
  const effectiveIntegrity = integrity !== undefined ? integrity : (knownMeta?.integrity || null);

  if (verifyIntegrity && effectiveIntegrity) {
    const sriCheck = verifySriIntegrity(bodyBuffer, effectiveIntegrity);
    if (!sriCheck.valid) {
      throw new Error(
        `SRI integrity mismatch for ${rawUrl}: expected ${sriCheck.expected}, got ${sriCheck.actual}`
      );
    }
  }

  const resolvedContentType = inferCdnContentType(rawUrl, contentType || headers["content-type"] || knownMeta?.contentType);
  const sanitizedHeaders = {};
  for (const [k, v] of Object.entries(headers || {})) {
    const lower = k.toLowerCase();
    if (lower === "content-encoding" || lower === "transfer-encoding" || lower === "content-length") {
      continue;
    }
    sanitizedHeaders[lower] = String(v);
  }
  sanitizedHeaders["content-type"] = resolvedContentType;

  const meta = {
    url: String(rawUrl),
    normalizedUrl: normalizeCdnUrl(rawUrl),
    sha256: key,
    status: Number(status) || 200,
    contentType: resolvedContentType,
    headers: sanitizedHeaders,
    integrity: effectiveIntegrity,
    size: bodyBuffer.length,
    cachedAt: new Date().toISOString()
  };

  const uniqueSuffix = `${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString("hex")}`;
  const tmpBodyPath = path.join(resolvedDir, `${key}.body.tmp.${uniqueSuffix}`);
  const tmpMetaPath = path.join(resolvedDir, `${key}.meta.json.tmp.${uniqueSuffix}`);

  fs.writeFileSync(tmpBodyPath, bodyBuffer);
  fs.renameSync(tmpBodyPath, bodyPath);

  fs.writeFileSync(tmpMetaPath, JSON.stringify(meta, null, 2), "utf-8");
  fs.renameSync(tmpMetaPath, metaPath);

  return { key, bodyPath, metaPath, meta, body: bodyBuffer };
}

/**
 * Ensures only the used CDN packages (from an HTML string, URL list, or asset descriptor list)
 * are present in `.cache/html-report-cdn/`, lazily downloading any missing package once.
 */
export async function ensureUsedVendorsCached(
  input,
  {
    cacheDir = null,
    fetchImpl = globalThis.fetch,
    verifyIntegrity = true,
    timeoutMs = 15000,
    explicitAddons = [],
    autoDetect = true
  } = {}
) {
  const resolvedDir = resolveCdnCacheDir(cacheDir);
  let assets = [];

  if (typeof input === "string") {
    assets = extractUsedCdnAssets(input, { explicitAddons, autoDetect });
  } else if (Array.isArray(input)) {
    assets = input.map((item) => {
      if (typeof item === "string") {
        const known = getKnownCdnAssetMeta(item);
        return known || {
          url: item,
          addonKey: "custom",
          integrity: null,
          crossOrigin: null,
          contentType: inferCdnContentType(item)
        };
      }
      return item;
    });
  }

  const hits = [];
  const downloaded = [];
  const errors = [];

  for (const asset of assets) {
    const url = asset.url;
    const existing = readCachedVendorAsset(url, { cacheDir: resolvedDir, verifyIntegrity });
    if (existing) {
      hits.push(url);
      continue;
    }

    if (typeof fetchImpl !== "function") {
      errors.push({ url, error: "No fetch implementation available" });
      continue;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${url}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const bodyBuffer = Buffer.from(arrayBuffer);
      const responseContentType = typeof response.headers?.get === "function"
        ? response.headers.get("content-type")
        : response.headers?.["content-type"];

      writeCachedVendorAsset(url, bodyBuffer, {
        cacheDir: resolvedDir,
        contentType: responseContentType || asset.contentType,
        status: response.status || 200,
        integrity: asset.integrity,
        verifyIntegrity
      });
      downloaded.push(url);
    } catch (err) {
      errors.push({ url, error: err.message || String(err) });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    cacheDir: resolvedDir,
    urls: assets.map((a) => a.url),
    hits,
    downloaded,
    errors
  };
}
