import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  CORE_CDN_ASSETS,
  areUsedVendorsCached,
  ensureUsedVendorsCached,
  extractUsedCdnAssets,
  extractUsedCdnUrls,
  getCdnCacheKey,
  getCdnCachePaths,
  readCachedVendorAsset,
  verifySriIntegrity,
  writeCachedVendorAsset
} from "../scripts/lib/build/vendor-disk-cache.mjs";
import { buildReport } from "../scripts/build-report.mjs";
import {
  attachCdnDiskCache,
  buildFulfillHeaders
} from "../playwright/harness/cdn-cache.mjs";
import { parseArgs } from "../playwright/verify-report.mjs";
import { runHarness } from "../playwright/harness/runner.mjs";

describe("On-Demand Disk Vendor Cache & Playwright Local CDN Interceptor", () => {
  let tmpCacheDir;

  beforeEach(() => {
    tmpCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "html-report-cdn-cache-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpCacheDir, { recursive: true, force: true });
  });

  describe("1. Used-Only CDN Package Resolution (extractUsedCdnUrls)", () => {
    it("resolves only Core 4 + Chart.js for a Chart.js report and excludes unused heavy addons", () => {
      const fragment = `
        <section>
          <h1>Revenue Summary</h1>
          <canvas id="revenueChart"></canvas>
          <script>new Chart(document.getElementById("revenueChart"), { type: "bar", data: {} });</script>
        </section>
      `;
      const urls = extractUsedCdnUrls(fragment);

      assert.equal(urls.length, 5, "Expected Core 4 + Chart.js (5 URLs total)");
      assert.ok(urls.some((u) => u.includes("daisyui@4.12.14")));
      assert.ok(urls.some((u) => u.includes("cdn.tailwindcss.com")));
      assert.ok(urls.some((u) => u.includes("lucide@0.460.0")));
      assert.ok(urls.some((u) => u.includes("alpinejs@3.14.3")));
      assert.ok(urls.some((u) => u.includes("chart.js@4.4.6")));

      // Verify unused heavy addons are never included
      assert.ok(!urls.some((u) => u.includes("fullcalendar")), "FullCalendar must not be included");
      assert.ok(!urls.some((u) => u.includes("katex")), "KaTeX must not be included");
      assert.ok(!urls.some((u) => u.includes("leaflet")), "Leaflet must not be included");
      assert.ok(!urls.some((u) => u.includes("reveal.js")), "Reveal.js must not be included");
    });

    it("normalizes bare origin URLs so https://cdn.tailwindcss.com and https://cdn.tailwindcss.com/ share the same SHA-256 key", () => {
      const keyNoSlash = getCdnCacheKey("https://cdn.tailwindcss.com");
      const keyWithSlash = getCdnCacheKey("https://cdn.tailwindcss.com/");
      assert.equal(keyNoSlash, keyWithSlash);
    });
  });

  describe("2. Atomic Disk Persistence & SRI Integrity Verification", () => {
    it("atomically writes and reads <sha256>.body and <sha256>.meta.json with matching SRI", () => {
      const url = "https://cdn.jsdelivr.net/npm/test-pkg@1.0.0/dist/index.min.js";
      const payload = Buffer.from("window.__TEST_PKG__ = true;\n", "utf-8");
      const sha384 = crypto.createHash("sha384").update(payload).digest("base64");
      const integrity = `sha384-${sha384}`;

      const written = writeCachedVendorAsset(url, payload, {
        cacheDir: tmpCacheDir,
        contentType: "application/javascript; charset=utf-8",
        integrity,
        verifyIntegrity: true
      });

      assert.ok(fs.existsSync(written.bodyPath));
      assert.ok(fs.existsSync(written.metaPath));

      // Ensure no leftover .tmp files exist
      const files = fs.readdirSync(tmpCacheDir);
      assert.ok(!files.some((f) => f.includes(".tmp.")), "No temporary files should remain after atomic rename");

      const cached = readCachedVendorAsset(url, {
        cacheDir: tmpCacheDir,
        verifyIntegrity: true
      });
      assert.ok(cached);
      assert.equal(cached.body.toString("utf-8"), payload.toString("utf-8"));
      assert.equal(cached.meta.integrity, integrity);
      assert.equal(cached.meta.contentType, "application/javascript; charset=utf-8");
    });

    it("rejects corrupted payloads when SRI integrity fails and leaves no partial cache files", () => {
      const url = "https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js";
      const tamperedBody = Buffer.from("console.log('tampered');", "utf-8");

      assert.throws(
        () =>
          writeCachedVendorAsset(url, tamperedBody, {
            cacheDir: tmpCacheDir,
            verifyIntegrity: true
          }),
        /SRI integrity mismatch/
      );

      const { bodyPath, metaPath } = getCdnCachePaths(url, tmpCacheDir);
      assert.equal(fs.existsSync(bodyPath), false);
      assert.equal(fs.existsSync(metaPath), false);
    });

    it("lazily downloads only used packages on first call and makes 0 network fetches on second call", async () => {
      const fragment = `<section><canvas id="c1"></canvas></section>`;
      const assets = extractUsedCdnAssets(fragment);
      let networkCalls = 0;

      const mockFetch = async (url) => {
        networkCalls += 1;
        const body = Buffer.from(`/* mock bundle for ${url} */`, "utf-8");
        return {
          ok: true,
          status: 200,
          headers: new Map([["content-type", url.endsWith(".css") ? "text/css" : "application/javascript"]]),
          arrayBuffer: async () => body
        };
      };

      // First run: all 5 used packages are downloaded and saved to disk
      const firstRun = await ensureUsedVendorsCached(assets, {
        cacheDir: tmpCacheDir,
        fetchImpl: mockFetch,
        verifyIntegrity: false
      });

      assert.equal(firstRun.urls.length, 5);
      assert.equal(firstRun.downloaded.length, 5);
      assert.equal(firstRun.hits.length, 0);
      assert.equal(networkCalls, 5);
      assert.equal(areUsedVendorsCached(fragment, { cacheDir: tmpCacheDir }), true);

      // Second run: all 5 used packages are served from disk with 0 network calls
      const secondRun = await ensureUsedVendorsCached(assets, {
        cacheDir: tmpCacheDir,
        fetchImpl: mockFetch,
        verifyIntegrity: false
      });

      assert.equal(secondRun.downloaded.length, 0);
      assert.equal(secondRun.hits.length, 5);
      assert.equal(networkCalls, 5, "Second run must make 0 additional network fetches");
    });
  });

  describe("3. Playwright Route Interceptor (attachCdnDiskCache) & CLI Flags", () => {
    it("parses --no-cdn-cache and --cache-dir in verify-report.mjs", () => {
      const defaultParsed = parseArgs(["node", "verify-report.mjs", "report.html"]);
      assert.equal(defaultParsed.cdnCache, true);
      assert.equal(defaultParsed.cacheDir, null);

      const disabledParsed = parseArgs([
        "node",
        "verify-report.mjs",
        "report.html",
        "--no-cdn-cache",
        "--cache-dir",
        "/tmp/custom-cdn-cache"
      ]);
      assert.equal(disabledParsed.cdnCache, false);
      assert.equal(disabledParsed.cacheDir, "/tmp/custom-cdn-cache");
    });

    it("enforces Tailwind Play CDN no-CORS rule and SRI CORS headers", () => {
      const twNoOrigin = buildFulfillHeaders("https://cdn.tailwindcss.com/", {}, {});
      assert.equal(twNoOrigin["access-control-allow-origin"], undefined);

      const twWithOrigin = buildFulfillHeaders("https://cdn.tailwindcss.com/", {}, { origin: "http://localhost:3031" });
      assert.equal(twWithOrigin["access-control-allow-origin"], "*");

      const jsdelivrHeaders = buildFulfillHeaders(
        "https://cdn.jsdelivr.net/npm/daisyui@4.12.14/dist/full.min.css",
        {},
        {}
      );
      assert.equal(jsdelivrHeaders["access-control-allow-origin"], "*");
    });

    it("lazily caches on first route miss and fulfills subsequent route hits from disk in <1ms with 0 fetches", async () => {
      let registeredHandler = null;
      const mockContext = {
        route: async (_matcher, handler) => {
          registeredHandler = handler;
        }
      };

      let remoteFetchCount = 0;
      const chartUrl = "https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js";
      const session = await attachCdnDiskCache(mockContext, {
        cacheDir: tmpCacheDir,
        enabled: true
      });

      assert.equal(session.enabled, true);
      assert.ok(typeof registeredHandler === "function");

      // 1st request: Cache miss -> calls route.fetch() and persists to disk
      let firstFulfilled = null;
      await registeredHandler({
        request: () => ({
          url: () => chartUrl,
          headers: () => ({})
        }),
        fetch: async () => {
          remoteFetchCount += 1;
          return {
            status: () => 200,
            headers: () => ({ "content-type": "application/javascript; charset=utf-8" }),
            body: async () => Buffer.from("window.Chart = function(){};", "utf-8")
          };
        },
        fulfill: async (res) => {
          firstFulfilled = res;
        }
      });

      assert.equal(remoteFetchCount, 1);
      assert.equal(session.stats.misses, 1);
      assert.equal(session.stats.hits, 0);
      assert.equal(firstFulfilled.status, 200);
      assert.equal(firstFulfilled.headers["access-control-allow-origin"], "*");

      // 2nd request: Cache hit -> served from disk in <1ms without calling route.fetch()
      let secondFulfilled = null;
      const t0 = performance.now();
      await registeredHandler({
        request: () => ({
          url: () => chartUrl,
          headers: () => ({})
        }),
        fetch: async () => {
          remoteFetchCount += 1;
          throw new Error("route.fetch() should not be called on a disk cache hit");
        },
        fulfill: async (res) => {
          secondFulfilled = res;
        }
      });
      const elapsedMs = performance.now() - t0;

      assert.equal(remoteFetchCount, 1, "Zero remote fetches on second run");
      assert.equal(session.stats.hits, 1);
      assert.equal(session.stats.misses, 1);
      assert.equal(secondFulfilled.body.toString("utf-8"), "window.Chart = function(){};");
      assert.ok(elapsedMs < 25, `Expected sub-millisecond disk read fulfillment, took ${elapsedMs.toFixed(2)}ms`);
    });

    it("downloads Core 4 on first Playwright run and fulfills 100% from disk cache with 0 remote misses on second run", async () => {
      const { html } = buildReport({
        title: "Cached Verification Test",
        content: `<section class="p-4"><h1 id="cached-heading">Disk Cache Verified</h1><p>Zero remote CDN downloads.</p></section>`,
        published: true
      });
      const reportPath = path.join(tmpCacheDir, "cached-report.html");
      fs.writeFileSync(reportPath, html, "utf-8");

      // First run against empty tmpCacheDir: downloads Core 4 on demand and saves to disk
      const firstResult = await runHarness(reportPath, {
        quick: true,
        only: "core:console",
        cacheDir: tmpCacheDir,
        cdnCache: true
      });

      assert.equal(firstResult.success, true);
      assert.equal(firstResult.cdnCache.enabled, true);
      assert.ok(firstResult.cdnCache.misses >= 4, "First run should lazily download the 4 Core CDN assets");
      assert.equal(areUsedVendorsCached(html, { cacheDir: tmpCacheDir }), true);

      // Second run against populated tmpCacheDir: 100% disk cache hits, 0 remote CDN downloads
      const secondResult = await runHarness(reportPath, {
        quick: true,
        only: "core:structure",
        cacheDir: tmpCacheDir,
        cdnCache: true
      });

      assert.equal(secondResult.success, true);
      assert.equal(secondResult.cdnCache.enabled, true);
      assert.ok(secondResult.cdnCache.hits >= 4, "All Core CDN requests must be served from disk cache");
      assert.equal(secondResult.cdnCache.misses, 0, "Second/cached run must perform 0 external CDN downloads");

      // Verify --no-cdn-cache opt-out disables disk interception
      const uncachedResult = await runHarness(reportPath, {
        quick: true,
        only: "core:console",
        cacheDir: tmpCacheDir,
        cdnCache: false
      });
      assert.equal(uncachedResult.cdnCache.enabled, false);
      assert.equal(uncachedResult.cdnCache.hits, 0);
    });
  });
});
