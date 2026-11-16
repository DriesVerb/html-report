import fs from "node:fs";
import path from "node:path";
import { DatastarBridge, escapeHtml } from "../datastar-sse.mjs";

export function handleSseRoutes(req, res, parsedUrl, pathname, ctx) {
  const {
    resolvedPath,
    rootDir,
    targetFileName,
    feedProxies,
    sseClients,
    datastarClients,
    mcpSseClients,
    personaRegistry,
    sessionStore,
    csrfManager,
    allowlistManager,
    workspaceRootForState,
    shouldPersistBoardStateToDisk,
    saveBoardState,
    isValidLocalOrigin,
    applyLocalCorsHeaders,
    enforceLocalBridgeSecurity,
    isSameOriginOrLocalRequest,
    broadcastDatastarFragment,
    broadcastLiveReloadEvent,
    broadcastProjectsChanged,
    broadcastReload,
    markProjectScaffolded,
    resolveInferenceStatus,
    inspectServedReport,
    mcpContext,
    editable
  } = ctx;
  const serverPort = ctx.getServerPort();
  const requestedPort = ctx.getRequestedPort();
  const boardState = ctx.getBoardState();
  let activeReportTheme = ctx.getActiveReportTheme();
  const projectsCache = ctx.getProjectsCache();
  const setProjectsCache = ctx.setProjectsCache;

    // 0. Feed Proxy route for local CORS proxying
    if (feedProxies && feedProxies.length > 0) {
      for (const proxy of feedProxies) {
        if (pathname === proxy.prefix || pathname.startsWith(proxy.prefix + "/") || pathname.startsWith(proxy.prefix + "?")) {
          if (req.method === "OPTIONS") {
            res.writeHead(204, {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
              "Access-Control-Allow-Headers": "*"
            });
            res.end();
            return true;
          }

          const subPath = pathname.slice(proxy.prefix.length);
          const targetFullUrl = proxy.target + subPath + (parsedUrl.search || "");
          fetch(targetFullUrl, { method: req.method })
            .then(async (targetRes) => {
              const body = await targetRes.arrayBuffer();
              const headers = {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": targetRes.headers.get("content-type") || "application/json"
              };
              res.writeHead(targetRes.status, headers);
              res.end(Buffer.from(body));
            })
            .catch((err) => {
              res.writeHead(502, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              });
              res.end(JSON.stringify({ error: "Proxy target unreachable", message: err.message }));
            });
          return true;
        }
      }
      return true;
    }

    // 1a. Datastar Real-Time SSE Stream Endpoint (/events, /api/events, /__datastar_stream__)
    if (pathname === "/__datastar_stream__" || pathname === "/events" || pathname === "/api/events") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, datastar-request, Cache-Control"
        });
        res.end();
        return true;
      }

      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          let ssePayload = body;
          try {
            const parsed = JSON.parse(body);
            if (parsed.selector && parsed.html) {
              ssePayload = DatastarBridge.formatFragment(parsed);
            } else if (parsed.signals) {
              ssePayload = DatastarBridge.formatSignals(parsed.signals);
            }
          } catch (_) {}

          for (const client of datastarClients) {
            try { client.write(ssePayload); } catch (_) { datastarClients.delete(client); }
          }
          res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          res.end(JSON.stringify({ ok: true, listeners: datastarClients.size }));
        });
        return true;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });
      const initialStatusHtml = `<div id="live-board-status" data-board-updated="${boardState.updatedAt || "initial"}">Live stream connected</div>`;
      res.write(
        `: connected\n\nevent: connected\ndata: {"ok":true}\n\nevent: board-state\ndata: ${JSON.stringify(boardState)}\n\nevent: datastar-merge-fragments\ndata: fragments ${initialStatusHtml}\n\n`
      );

      datastarClients.add(res);
      if (process.env.NODE_ENV !== "test") {
        console.log(`[html-report] Datastar SSE stream connected on ${pathname} (active listeners: ${datastarClients.size})`);
      }

      req.on("close", () => {
        datastarClients.delete(res);
        if (process.env.NODE_ENV !== "test") {
          console.log(`[html-report] Datastar SSE stream disconnected (remaining listeners: ${datastarClients.size})`);
        }
      });
      return true;
    }

    // 1a-2. Turnkey Board State Persistence & SSE Broadcast (GET/POST /api/board/state)
    if (pathname === "/api/board/state") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": `http://localhost:${serverPort}`,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, datastar-request"
        });
        res.end();
        return true;
      }

      if (req.method === "GET") {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store"
        });
        res.end(JSON.stringify({
          ok: true,
          state: boardState,
          updatedAt: boardState.updatedAt
        }));
        return true;
      }

      if (req.method === "POST") {
        if (!isSameOriginOrLocalRequest(req)) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            ok: false,
            error: "Forbidden: Cross-origin board state mutation rejected."
          }));
          return true;
        }

        let body = "";
        let tooLarge = false;
        req.on("data", (chunk) => {
          body += chunk;
          if (body.length > 1024 * 1024) {
            tooLarge = true;
            req.destroy();
          }
        });
        req.on("end", () => {
          if (tooLarge) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "Payload too large (1MB limit)." }));
            return;
          }

          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch (_) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "Invalid JSON payload: expected a JSON object." }));
            return;
          }

          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "Invalid board state: JSON object required." }));
            return;
          }

          const updated = saveBoardState(parsed);
          const stateEventPayload = `event: board-state\ndata: ${JSON.stringify(updated)}\n\n`;
          for (const client of datastarClients) {
            try { client.write(stateEventPayload); } catch (_) { datastarClients.delete(client); }
          }
          const statusHtml = `<div id="live-board-status" data-board-updated="${escapeHtml(updated.updatedAt)}" class="text-xs font-mono text-success">Saved ${escapeHtml(new Date(updated.updatedAt).toLocaleTimeString())}</div>`;
          broadcastDatastarFragment({
            selector: "#live-board-status",
            html: statusHtml,
            merge: "morph"
          });

          const isDatastarReq =
            req.headers["datastar-request"] === "true" ||
            (req.headers.accept || "").includes("text/event-stream");

          if (isDatastarReq) {
            res.writeHead(200, {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform"
            });
            res.write(DatastarBridge.formatFragment({ selector: "#live-board-status", html: statusHtml, merge: "morph" }));
            res.end();
            return;
          }

          res.writeHead(200, {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store"
          });
          res.end(JSON.stringify({
            ok: true,
            state: updated,
            updatedAt: updated.updatedAt,
            listeners: datastarClients.size
          }));
        });
        return true;
      }
      return true;
    }

    // 1a-2a. Asset-Aware Publish Endpoint (GET/POST /api/publish)
  return false;
}
