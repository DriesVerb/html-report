/**
 * Playwright Local Disk CDN Route Interceptor (`cdn-cache.mjs`)
 *
 * Intercepts requests to supported CDN origins (`cdn.tailwindcss.com`,
 * `cdn.jsdelivr.net`, `unpkg.com`, `cdnjs.cloudflare.com`, `server.arcgisonline.com`).
 * Serves cached packages directly from `.cache/html-report-cdn/` on disk in `<1ms`,
 * or lazily downloads and persists cache misses on demand.
 */
import {
  getCdnCacheKey,
  inferCdnContentType,
  isSupportedCdnUrl,
  readCachedVendorAsset,
  resolveCdnCacheDir,
  writeCachedVendorAsset
} from "../../scripts/lib/build/vendor-disk-cache.mjs";

export const CDN_ROUTE_PATTERNS = [
  "https://cdn.tailwindcss.com/**",
  "https://cdn.jsdelivr.net/**",
  "https://unpkg.com/**",
  "https://cdnjs.cloudflare.com/**",
  "https://server.arcgisonline.com/**"
];

/**
 * Builds response headers for Playwright `route.fulfill()`, preserving:
 * - Tailwind Play CDN no-CORS rule: omit `Access-Control-Allow-Origin` when
 *   `cdn.tailwindcss.com` is requested without an `Origin` request header.
 * - Cross-Origin SRI compatibility: include `Access-Control-Allow-Origin: *`
 *   for `jsdelivr`, `unpkg`, `cdnjs`, `arcgisonline`, or when `Origin` is present.
 */
export function buildFulfillHeaders(rawUrl, metaHeaders = {}, requestHeaders = {}) {
  const headers = {};
  for (const [k, v] of Object.entries(metaHeaders || {})) {
    const lower = k.toLowerCase();
    if (
      lower === "content-encoding" ||
      lower === "transfer-encoding" ||
      lower === "content-length" ||
      lower === "access-control-allow-origin"
    ) {
      continue;
    }
    headers[lower] = String(v);
  }

  let hostname = "";
  try {
    hostname = new URL(String(rawUrl)).hostname.toLowerCase();
  } catch (_) {}

  const hasOriginHeader = Boolean(
    requestHeaders?.origin || requestHeaders?.Origin
  );
  const isTailwindPlayCdn = hostname === "cdn.tailwindcss.com";

  if (!isTailwindPlayCdn || hasOriginHeader) {
    headers["access-control-allow-origin"] = "*";
    headers["timing-allow-origin"] = "*";
  }

  headers["cache-control"] = headers["cache-control"] || "public, max-age=31536000, immutable";
  return headers;
}

/**
 * Attaches the on-demand disk CDN cache route interceptor to a Playwright BrowserContext or Page.
 */
export async function attachCdnDiskCache(
  target,
  {
    cacheDir = null,
    enabled = true,
    verifyIntegrity = false,
    fetchFallback = null
  } = {}
) {
  const stats = {
    hits: 0,
    misses: 0,
    errors: 0,
    hitUrls: [],
    missUrls: []
  };

  if (!enabled || !target || typeof target.route !== "function") {
    return {
      enabled: false,
      cacheDir: null,
      stats
    };
  }

  const resolvedDir = resolveCdnCacheDir(cacheDir);
  const inFlight = new Map();

  const urlMatcher = (url) => {
    const urlStr = typeof url === "string" ? url : (url && typeof url.toString === "function" ? url.toString() : "");
    return isSupportedCdnUrl(urlStr);
  };

  const routeHandler = async (route, request) => {
    const req = request || (typeof route.request === "function" ? route.request() : null);
    const requestUrl = req && typeof req.url === "function" ? req.url() : "";
    const reqHeaders = req && typeof req.headers === "function" ? req.headers() : {};

    if (!requestUrl || !isSupportedCdnUrl(requestUrl)) {
      return route.continue();
    }

    const cached = readCachedVendorAsset(requestUrl, {
      cacheDir: resolvedDir,
      verifyIntegrity
    });

    if (cached) {
      stats.hits += 1;
      stats.hitUrls.push(requestUrl);
      const contentType = inferCdnContentType(requestUrl, cached.meta?.contentType);
      const headers = buildFulfillHeaders(requestUrl, cached.meta?.headers, reqHeaders);
      return route.fulfill({
        status: cached.meta?.status || 200,
        contentType,
        headers,
        body: cached.body
      });
    }

    const cacheKey = getCdnCacheKey(requestUrl);
    let downloadPromise = inFlight.get(cacheKey);

    if (!downloadPromise) {
      downloadPromise = (async () => {
        if (typeof route.fetch === "function" && !fetchFallback) {
          const response = await route.fetch();
          const status = typeof response.status === "function" ? response.status() : 200;
          const respHeaders = typeof response.headers === "function" ? response.headers() : {};
          const bodyBuffer = Buffer.from(await response.body());
          return { status, headers: respHeaders, body: bodyBuffer };
        }
        const fetcher = fetchFallback || globalThis.fetch;
        const response = await fetcher(requestUrl);
        const status = response.status || 200;
        const respHeaders = {};
        if (response.headers && typeof response.headers.forEach === "function") {
          response.headers.forEach((value, key) => {
            respHeaders[key.toLowerCase()] = value;
          });
        } else if (response.headers && typeof response.headers === "object") {
          Object.assign(respHeaders, response.headers);
        }
        const bodyBuffer = Buffer.from(await response.arrayBuffer());
        return { status, headers: respHeaders, body: bodyBuffer };
      })();
      inFlight.set(cacheKey, downloadPromise);
    }

    try {
      const { status, headers: respHeaders, body: bodyBuffer } = await downloadPromise;
      const contentType = inferCdnContentType(requestUrl, respHeaders["content-type"]);

      if (status >= 200 && status < 300 && bodyBuffer.length > 0) {
        try {
          writeCachedVendorAsset(requestUrl, bodyBuffer, {
            cacheDir: resolvedDir,
            contentType,
            status,
            headers: respHeaders,
            verifyIntegrity: false
          });
        } catch (_) {}
      }

      stats.misses += 1;
      stats.missUrls.push(requestUrl);

      const fulfillHeaders = buildFulfillHeaders(requestUrl, respHeaders, reqHeaders);
      return route.fulfill({
        status,
        contentType,
        headers: fulfillHeaders,
        body: bodyBuffer
      });
    } catch (_) {
      stats.errors += 1;
      if (typeof route.continue === "function") {
        return route.continue();
      }
    } finally {
      inFlight.delete(cacheKey);
    }
  };

  await target.route(urlMatcher, routeHandler);

  return {
    enabled: true,
    cacheDir: resolvedDir,
    stats,
    handler: routeHandler
  };
}
