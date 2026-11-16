import {
  CSRFManager,
  handleMCPRequest,
  handleMCPHttpPayload,
  handleGatewayCallTool,
  formatJsonRpcError,
  formatJsonRpcResult,
  JSON_RPC_ERRORS
} from "../mcp-server.mjs";
import { isLoopbackAddress } from "../server-utils.mjs";

export function handleMcpRoutes(req, res, parsedUrl, pathname, ctx) {
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

    // 1b-MCP-0. Streamable HTTP MCP Endpoint (POST /mcp, DELETE /mcp, OPTIONS /mcp)
    if (pathname === "/mcp") {
      const remoteAddr = req.socket?.remoteAddress || "";
      if (!isLoopbackAddress(remoteAddr)) {
        res.writeHead(403, { "Content-Type": "application/json", "Cache-Control": "no-cache, no-store" });
        res.end(JSON.stringify({ ok: false, error: "Forbidden: MCP endpoint is restricted to localhost loopback." }));
        return true;
      }
      const hostHeader = String(req.headers.host || "");
      if (!CSRFManager.validateHost(hostHeader)) {
        res.writeHead(403, { "Content-Type": "application/json", "Cache-Control": "no-cache, no-store" });
        res.end(JSON.stringify({ ok: false, error: "Forbidden: Host must be localhost, 127.0.0.1, or [::1]." }));
        return true;
      }
      const originHeader = req.headers.origin;
      if (originHeader !== undefined && !isValidLocalOrigin(originHeader)) {
        res.writeHead(403, { "Content-Type": "application/json", "Cache-Control": "no-cache, no-store" });
        res.end(JSON.stringify({ ok: false, error: "Forbidden: Cross-origin MCP request rejected." }));
        return true;
      }

      if (req.method === "OPTIONS") {
        res.writeHead(204, applyLocalCorsHeaders(req, {
          "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id",
          "Cache-Control": "no-cache, no-store"
        }));
        res.end();
        return true;
      }

      if (req.method === "DELETE") {
        res.writeHead(204, applyLocalCorsHeaders(req, { "Cache-Control": "no-cache, no-store" }));
        res.end();
        return true;
      }

      if (req.method === "POST") {
        const MAX_MCP_BODY_BYTES = 4 * 1024 * 1024;
        let totalBytes = 0;
        let aborted = false;
        const chunks = [];
        req.on("data", (chunk) => {
          if (aborted) return;
          totalBytes += chunk.length;
          if (totalBytes > MAX_MCP_BODY_BYTES) {
            aborted = true;
            res.writeHead(413, applyLocalCorsHeaders(req, {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache, no-store"
            }));
            res.end(JSON.stringify(formatJsonRpcError(null, JSON_RPC_ERRORS.INVALID_REQUEST, "Payload too large")));
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        req.on("end", async () => {
          if (aborted) return;
          try {
            const rawBody = Buffer.concat(chunks).toString("utf-8");
            const rawPayload = JSON.parse(rawBody);
            const mcpResult = await handleMCPHttpPayload(rawPayload, mcpContext);
            if (mcpResult.statusCode === 202) {
              res.writeHead(202, applyLocalCorsHeaders(req, { "Cache-Control": "no-cache, no-store" }));
              res.end();
              return;
            }
            res.writeHead(mcpResult.statusCode, applyLocalCorsHeaders(req, {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache, no-store"
            }));
            res.end(JSON.stringify(mcpResult.body));
          } catch (err) {
            res.writeHead(400, applyLocalCorsHeaders(req, {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache, no-store"
            }));
            res.end(JSON.stringify(formatJsonRpcError(null, JSON_RPC_ERRORS.PARSE_ERROR, `Parse error: ${err.message}`)));
          }
        });
        return true;
      }

      res.writeHead(405, applyLocalCorsHeaders(req, {
        Allow: "POST, DELETE, OPTIONS",
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store"
      }));
      res.end(JSON.stringify({ ok: false, error: `Method ${req.method} not allowed on /mcp. Use POST.` }));
      return true;
    }

    // 1b-MCP-1. MCP SSE Transport (GET /mcp/sse)
    if (pathname === "/mcp/sse" || pathname === "/__mcp_sse__") {
      const sessionId = crypto.randomUUID();
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      });
      res.write(`event: endpoint\ndata: /mcp/messages?sessionId=${sessionId}\n\n`);
      mcpSseClients.set(sessionId, res);

      req.on("close", () => {
        mcpSseClients.delete(sessionId);
      });
      return true;
    }

    // 1b-MCP-2. MCP JSON-RPC 2.0 Message Dispatcher (POST /mcp/messages)
    if (pathname === "/mcp/messages" || pathname === "/__mcp_messages__") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        });
        res.end();
        return true;
      }
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", async () => {
          try {
            const reqObj = JSON.parse(body);
            const mcpResponse = await handleMCPRequest(reqObj, mcpContext);
            const sessionId = parsedUrl.searchParams.get("sessionId");
            if (sessionId && mcpSseClients.has(sessionId)) {
              const sseClient = mcpSseClients.get(sessionId);
              try {
                sseClient.write(`event: message\ndata: ${JSON.stringify(mcpResponse)}\n\n`);
              } catch (_) {
                mcpSseClients.delete(sessionId);
              }
            }
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify(mcpResponse));
          } catch (err) {
            res.writeHead(400, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify(formatJsonRpcError(null, JSON_RPC_ERRORS.PARSE_ERROR, `Parse error: ${err.message}`)));
          }
        });
        return true;
      }
      return true;
    }

    // 1b-MCP-3. MCP CSRF Token Generator (GET /api/mcp/csrf-token)
    if (pathname === "/api/mcp/csrf-token") {
      const host = req.headers.host;
      if (!CSRFManager.validateHost(host)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Forbidden: Host must be localhost or 127.0.0.1" }));
        return true;
      }
      const tokenData = csrfManager.generateToken();
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(JSON.stringify({ ok: true, ...tokenData }));
      return true;
    }

    // 1b-MCP-4. MCP Client Gateway Proxy (POST /api/mcp/call-tool)
    if (pathname === "/api/mcp/call-tool") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token"
        });
        res.end();
        return true;
      }
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", async () => {
          try {
            const payload = JSON.parse(body);
            if (!payload.csrfToken && req.headers["x-csrf-token"]) {
              payload.csrfToken = req.headers["x-csrf-token"];
            }
            const gatewayResult = await handleGatewayCallTool(payload, {
              host: req.headers.host,
              origin: req.headers.origin,
              csrfManager,
              allowlistManager,
              timeoutMs: 15000,
              context: mcpContext
            });
            res.writeHead(gatewayResult.statusCode, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify(gatewayResult.body));
          } catch (err) {
            res.writeHead(400, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify({ ok: false, error: `Invalid JSON payload: ${err.message}` }));
          }
        });
        return true;
      }
      return true;
    }

    // 1b-1. Persona Discovery & Registration Endpoints
  return false;
}
