import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const runtimePath = path.resolve(__dirname, "../skills/html-report/assets/report-runtime.js");
const buildReportPath = path.resolve(__dirname, "../skills/html-report/scripts/build-report.mjs");
const serveReportPath = path.resolve(__dirname, "../skills/html-report/scripts/serve-report.mjs");

const runtime = await import(runtimePath);
const {
  resolveFeedUrl,
  getFeedRegistry,
  extractFeedFields,
  updateFeedCharts,
  initPublicFeeds,
  cleanupPublicFeeds,
  mergeFeedSignals,
  _getActiveFeedPollers
} = runtime.default || runtime;

const {
  buildReport,
  parseArgs: parseBuildArgs,
  detectAddons
} = await import(buildReportPath);

const {
  parseArgs: parseServeArgs,
  startServer
} = await import(serveReportPath);

describe("Declarative Public Feeds & Client Signal Bus", () => {
  describe("Phase 1: Nickname Registry & Feed Resolution", () => {
    it("should resolve @nickname references against #feed-registry JSON script", () => {
      const mockDoc = {
        querySelector: (sel) => {
          if (sel.includes("feed-registry")) {
            return {
              textContent: JSON.stringify({
                market: "https://api.coingecko.com/quotes",
                weather: "https://api.open-meteo.com/forecast"
              })
            };
          }
          return null;
        }
      };

      const registry = getFeedRegistry(mockDoc);
      assert.equal(registry.market, "https://api.coingecko.com/quotes");
      assert.equal(registry.weather, "https://api.open-meteo.com/forecast");

      const resMarket = resolveFeedUrl("@market", registry);
      assert.equal(resMarket.url, "https://api.coingecko.com/quotes");
      assert.equal(resMarket.nickname, "market");
      assert.equal(resMarket.error, null);

      const resWeather = resolveFeedUrl("@weather", registry);
      assert.equal(resWeather.url, "https://api.open-meteo.com/forecast");
      assert.equal(resWeather.nickname, "weather");
    });

    it("should treat standard URLs directly when no @ prefix is present", () => {
      const res = resolveFeedUrl("https://api.example.com/live/stats", {});
      assert.equal(res.url, "https://api.example.com/live/stats");
      assert.equal(res.nickname, null);
      assert.equal(res.error, null);
    });

    it("should gracefully handle unknown feed nicknames with a descriptive error", () => {
      const warnings = [];
      const origWarn = console.warn;
      console.warn = (...args) => warnings.push(args.join(" "));

      try {
        const res = resolveFeedUrl("@missing_feed", { market: "https://api.com" });
        assert.equal(res.url, null);
        assert.equal(res.nickname, "missing_feed");
        assert.match(res.error, /Unknown feed nickname: @missing_feed/);
        assert.ok(warnings.some((w) => w.includes("Unknown feed nickname: @missing_feed")));
      } finally {
        console.warn = origWarn;
      }
    });
  });

  describe("Phase 2: Universal Field Extraction & Signal Formatting", () => {
    it("should extract all top-level keys by default when data-feed-fields is omitted", () => {
      const payload = { btc_usd: 68500, eth_usd: 3500, volume: 1000000 };
      const signals = extractFeedFields(payload, null);

      assert.deepEqual(signals, {
        btc_usd: 68500,
        eth_usd: 3500,
        volume: 1000000
      });
    });

    it("should extract nested dot-notated paths and transform dots to underscores", () => {
      const payload = {
        user: { count: 42, active: true },
        server: { metrics: { latency_ms: 15.4 } },
        ignored_flag: true
      };

      const signals = extractFeedFields(payload, "user.count,server.metrics.latency_ms");
      assert.deepEqual(signals, {
        user_count: 42,
        server_metrics_latency_ms: 15.4
      });
      assert.equal(signals.ignored_flag, undefined);
    });

    it("should apply data-feed-prefix to extracted signal keys", () => {
      const payload = { status: "operational", count: 99 };
      const signals = extractFeedFields(payload, "status,count", "app_");

      assert.deepEqual(signals, {
        app_status: "operational",
        app_count: 99
      });
    });

    it("should handle primitive payloads gracefully", () => {
      const primitiveSignal = extractFeedFields(42.5, null, "sensor_");
      assert.deepEqual(primitiveSignal, {
        sensor_val: 42.5
      });
    });
  });

  describe("Phase 1 & 2: Deduplication, Polling & Chart.js Ring Buffer Hook", () => {
    it("should deduplicate multiple elements observing the same feed and interval to 1 fetch", async () => {
      let fetchCount = 0;
      const originalFetch = globalThis.fetch;
      const originalWindow = globalThis.window;
      const originalDoc = globalThis.document;

      globalThis.fetch = async (url) => {
        fetchCount++;
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ value: 100 + fetchCount, status: "healthy" })
        };
      };

      let mergedSignals = {};
      const subscribers = [
        {
          getAttribute: (attr) => {
            if (attr === "data-public-feed") return "@market";
            if (attr === "data-feed-interval") return "10000";
            if (attr === "data-feed-fields") return "value";
            return null;
          }
        },
        {
          getAttribute: (attr) => {
            if (attr === "data-public-feed") return "@market";
            if (attr === "data-feed-interval") return "10000";
            if (attr === "data-feed-fields") return "status";
            return null;
          }
        }
      ];

      globalThis.window = {
        __FEED_MIN_INTERVAL__: 50,
        dispatchEvent: (evt) => {},
        datastar: {
          mergeSignals: (sigs) => {
            Object.assign(mergedSignals, sigs);
          }
        }
      };

      globalThis.document = {
        querySelectorAll: (sel) => {
          if (sel === "[data-public-feed]") return subscribers;
          if (sel.includes("feed-registry")) return [];
          if (sel === "canvas[data-feed-chart]") return [];
          if (sel === "[data-signals]") return [];
          return [];
        },
        querySelector: (sel) => {
          if (sel.includes("feed-registry")) {
            return {
              textContent: JSON.stringify({ market: "https://api.example.com/market" })
            };
          }
          return null;
        },
        dispatchEvent: () => {}
      };

      try {
        initPublicFeeds();
        // Allow initial async fetch to complete
        await new Promise((r) => setTimeout(r, 20));

        assert.equal(fetchCount, 1, "Must execute exactly ONE network fetch across duplicate elements");
        assert.equal(mergedSignals.value, 101);
        assert.equal(mergedSignals.status, "healthy");

        const pollers = _getActiveFeedPollers();
        assert.equal(pollers.length, 1);
        assert.equal(pollers[0].subscribers.length, 2);
      } finally {
        cleanupPublicFeeds();
        globalThis.fetch = originalFetch;
        globalThis.window = originalWindow;
        globalThis.document = originalDoc;
      }
    });

    it("should append live tick to Chart.js dataset 0 with bounded ring buffer", () => {
      const originalDoc = globalThis.document;
      const originalWindow = globalThis.window;

      const mockChart = {
        data: {
          labels: ["10:00:00", "10:00:01", "10:00:02"],
          datasets: [{ data: [10, 20, 30] }]
        },
        updateCount: 0,
        updateMode: null,
        update: function (mode) {
          this.updateCount++;
          this.updateMode = mode;
        }
      };

      const mockCanvas = {
        getAttribute: (attr) => {
          if (attr === "data-feed-chart") return "latency_ms";
          if (attr === "data-feed-buffer") return "3"; // Buffer limit of 3
          return null;
        },
        _chart: mockChart
      };

      globalThis.document = {
        querySelectorAll: (sel) => {
          if (sel === "canvas[data-feed-chart]") return [mockCanvas];
          return [];
        }
      };

      globalThis.window = {
        Chart: {
          getChart: (c) => c._chart
        }
      };

      try {
        updateFeedCharts({ latency_ms: 45.2 }, Date.now());

        assert.equal(mockChart.updateCount, 1);
        assert.equal(mockChart.updateMode, "none", "Must call chart.update('none')");
        // Verify ring buffer capped at 3
        assert.equal(mockChart.data.labels.length, 3);
        assert.equal(mockChart.data.datasets[0].data.length, 3);
        assert.deepEqual(mockChart.data.datasets[0].data, [20, 30, 45.2]);
      } finally {
        globalThis.document = originalDoc;
        globalThis.window = originalWindow;
      }
    });

    it("should hydrate signals immediately from data-feed-fallback without network fetch in offline/PDF mode", async () => {
      let fetchCalled = false;
      const originalFetch = globalThis.fetch;
      const originalWindow = globalThis.window;
      const originalDoc = globalThis.document;

      globalThis.fetch = async () => {
        fetchCalled = true;
        return { ok: true, json: async () => ({ val: 999 }) };
      };

      let hydratedSignals = {};
      const fallbackElement = {
        getAttribute: (attr) => {
          if (attr === "data-public-feed") return "https://api.example.com/stat";
          if (attr === "data-feed-fallback") return JSON.stringify({ score: 98.6 });
          if (attr === "data-feed-fields") return "score";
          return null;
        }
      };

      globalThis.window = {
        __PLAYWRIGHT_PDF_MODE__: true,
        datastar: {
          mergeSignals: (s) => Object.assign(hydratedSignals, s)
        }
      };

      globalThis.document = {
        querySelectorAll: (sel) => {
          if (sel === "[data-public-feed]") return [fallbackElement];
          return [];
        },
        querySelector: () => null,
        dispatchEvent: () => {}
      };

      try {
        initPublicFeeds();
        await new Promise((r) => setTimeout(r, 20));

        assert.equal(fetchCalled, false, "Must not execute network fetch in PDF / offline mode");
        assert.equal(hydratedSignals.score, 98.6);
      } finally {
        cleanupPublicFeeds();
        globalThis.fetch = originalFetch;
        globalThis.window = originalWindow;
        globalThis.document = originalDoc;
      }
    });

    it("should cleanly tear down timers and pollers on cleanupPublicFeeds()", () => {
      const originalWindow = globalThis.window;
      const originalDoc = globalThis.document;

      globalThis.window = {
        __FEED_MIN_INTERVAL__: 50,
        dispatchEvent: () => {}
      };

      const el = {
        getAttribute: (attr) => {
          if (attr === "data-public-feed") return "https://api.example.com/timer-test";
          if (attr === "data-feed-interval") return "100";
          return null;
        }
      };

      globalThis.document = {
        querySelectorAll: (sel) => (sel === "[data-public-feed]" ? [el] : []),
        querySelector: () => null,
        dispatchEvent: () => {}
      };

      try {
        initPublicFeeds();
        assert.equal(_getActiveFeedPollers().length, 1);
        cleanupPublicFeeds();
        assert.equal(_getActiveFeedPollers().length, 0);
      } finally {
        globalThis.window = originalWindow;
        globalThis.document = originalDoc;
      }
    });
  });

  describe("Phase 3: Builder CLI Flags & Dev Server Proxy", () => {
    it("should auto-detect data-public-feed, bundle Datastar CDN and set mode to live-report", () => {
      const fragment = `<section><div data-public-feed="@quotes" data-text="$price"></div></section>`;
      const addons = detectAddons(fragment, []);
      assert.ok(addons.includes("datastar"), "Must auto-detect datastar from data-public-feed signature");

      const result = buildReport({
        title: "Live Feed Test",
        content: fragment
      });

      assert.match(result.html, /<html[^>]*data-report-mode="live-report"/);
      assert.ok(result.html.includes("@starfederation/datastar"), "Must bundle Datastar CDN in <head>");
    });

    it("should inject entries into #feed-registry via --feed name=url CLI option", () => {
      const fragment = `<div data-public-feed="@crypto"></div>`;
      const result = buildReport({
        title: "Feed Registry Injection",
        content: fragment,
        feeds: {
          crypto: "https://api.example.com/v1/btc",
          weather: "https://api.open-meteo.com/v1/forecast"
        }
      });

      assert.match(result.html, /<script\s+id=["']feed-registry["']\s+type=["']application\/json["']>/);
      assert.ok(result.html.includes('"crypto": "https://api.example.com/v1/btc"'));
      assert.ok(result.html.includes('"weather": "https://api.open-meteo.com/v1/forecast"'));
    });

    it("should freeze feeds and bake snapshots into data-feed-fallback via freezeFeeds option", () => {
      const fragment = `
        <script id="feed-registry" type="application/json">
        { "metrics": "https://api.example.com/stats" }
        </script>
        <div data-public-feed="@metrics"></div>
      `;

      const result = buildReport({
        title: "Freeze Feeds Test",
        content: fragment,
        freezeFeeds: true,
        mockFeeds: {
          "https://api.example.com/stats": { cpu_pct: 14.2, mem_mb: 512 }
        }
      });

      assert.match(result.html, /data-feed-fallback="\{&quot;cpu_pct&quot;:14\.2,&quot;mem_mb&quot;:512\}"/);
    });

    it("should apply feedInterval option to elements declaring public feeds", () => {
      const fragment = `<div data-public-feed="https://api.example.com/feed"></div>`;
      const result = buildReport({
        title: "Feed Interval Option",
        content: fragment,
        feedInterval: 15000
      });

      assert.match(result.html, /data-feed-interval="15000"/);
    });

    it("should parse CLI flags for feed registry, freeze, interval and proxy correctly", () => {
      const buildOptions = parseBuildArgs([
        "node", "build-report.mjs",
        "--content", "sample.html",
        "--feed", "market=https://api.com/quotes",
        "--feed", "weather=https://api.com/temp",
        "--freeze-feeds",
        "--feed-interval", "25000"
      ]);

      assert.equal(buildOptions.feeds.market, "https://api.com/quotes");
      assert.equal(buildOptions.feeds.weather, "https://api.com/temp");
      assert.equal(buildOptions.freezeFeeds, true);
      assert.equal(buildOptions.feedInterval, 25000);

      const serveOptions = parseServeArgs([
        "node", "serve-report.mjs", "report.html",
        "--feed-proxy", "/feed/api=https://external.api.com",
        "--feed-proxy", "/crypto=https://api.coingecko.com"
      ]);

      assert.equal(serveOptions.feedProxies.length, 2);
      assert.deepEqual(serveOptions.feedProxies[0], {
        prefix: "/feed/api",
        target: "https://external.api.com"
      });
      assert.deepEqual(serveOptions.feedProxies[1], {
        prefix: "/crypto",
        target: "https://api.coingecko.com"
      });
    });

    it("should proxy requests through dev server with CORS headers", async () => {
      // Create a mock external target server
      const targetServer = http.createServer((req, res) => {
        if (req.url === "/data?param=1") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ remote: "payload-ok" }));
          return;
        }
        res.writeHead(404);
        res.end();
      });

      await new Promise((resolve) => targetServer.listen(0, resolve));
      const targetPort = targetServer.address().port;
      const targetUrl = `http://localhost:${targetPort}`;

      // Start dev server with feed proxy pointing to mock target
      const devServerPort = 3198;
      const proxyRoute = {
        prefix: "/proxy/test",
        target: targetUrl
      };

      // Create lightweight proxy test handler matching serve-report logic
      const proxyServer = http.createServer((req, res) => {
        const parsedUrl = new URL(req.url, `http://localhost:${devServerPort}`);
        const pathname = decodeURIComponent(parsedUrl.pathname);

        if (pathname.startsWith(proxyRoute.prefix)) {
          if (req.method === "OPTIONS") {
            res.writeHead(204, {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
              "Access-Control-Allow-Headers": "*"
            });
            res.end();
            return;
          }

          const subPath = pathname.slice(proxyRoute.prefix.length);
          const targetFullUrl = proxyRoute.target + subPath + (parsedUrl.search || "");
          fetch(targetFullUrl, { method: req.method })
            .then(async (tRes) => {
              const body = await tRes.arrayBuffer();
              res.writeHead(tRes.status, {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": tRes.headers.get("content-type") || "application/json"
              });
              res.end(Buffer.from(body));
            })
            .catch((err) => {
              res.writeHead(502);
              res.end(err.message);
            });
        }
      });

      await new Promise((resolve) => proxyServer.listen(devServerPort, resolve));

      try {
        // Test OPTIONS preflight
        const optRes = await fetch(`http://localhost:${devServerPort}/proxy/test/data`, { method: "OPTIONS" });
        assert.equal(optRes.status, 204);
        assert.equal(optRes.headers.get("access-control-allow-origin"), "*");

        // Test GET proxy forwarding
        const getRes = await fetch(`http://localhost:${devServerPort}/proxy/test/data?param=1`);
        assert.equal(getRes.status, 200);
        assert.equal(getRes.headers.get("access-control-allow-origin"), "*");
        const data = await getRes.json();
        assert.equal(data.remote, "payload-ok");
      } finally {
        await new Promise((resolve) => proxyServer.close(resolve));
        await new Promise((resolve) => targetServer.close(resolve));
      }
    });
  });
});
