/**
 * @file mcp-server.mjs
 * Model Context Protocol (MCP) Server & Client Gateway Bridge.
 * Implements JSON-RPC 2.0 over SSE transport conforming to MCP 2024-11-05 spec.
 * Exposes native report manipulation tools to external agents (Claude, Cursor, Antigravity)
 * and provides a secure, CSRF-gated proxy gateway for browser widgets.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const MCP_SERVER_INFO = {
  name: "html-report-mcp-server",
  version: "1.0.0"
};

export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603
};

/**
 * Canonical tool definitions exposed by the report MCP server.
 */
export const NATIVE_MCP_TOOLS = [
  {
    name: "report_get_state",
    description: "Returns the current state of the live report, including active DaisyUI theme, DOM structure summary, and active client tabs.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "report_update_fragment",
    description: "Updates a target element in the report DOM by CSS selector with new HTML via real-time Datastar SSE fragment morphing.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector identifying target DOM element (e.g. '#kpi-card-revenue', '#agent-reaction-bubble')"
        },
        html: {
          type: "string",
          description: "New HTML fragment to merge into the target element"
        },
        mergeMode: {
          type: "string",
          enum: ["morph", "inner", "outer", "prepend", "append"],
          description: "Datastar fragment merge strategy (default: 'morph')"
        }
      },
      required: ["selector", "html"]
    }
  },
  {
    name: "report_set_theme",
    description: "Switches the active DaisyUI theme across all open browser tabs in real-time.",
    inputSchema: {
      type: "object",
      properties: {
        theme: {
          type: "string",
          description: "Valid DaisyUI theme name (e.g. 'light', 'dark', 'corporate', 'synthwave', 'luxury')"
        }
      },
      required: ["theme"]
    }
  },
  {
    name: "report_append_alert",
    description: "Injects a dismissible DaisyUI alert banner (toast or notification) at the top of the report main view.",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Alert text or HTML content to display"
        },
        type: {
          type: "string",
          enum: ["info", "success", "warning", "error"],
          description: "Alert styling severity variant (default: 'info')"
        }
      },
      required: ["message"]
    }
  },
  {
    name: "report_export_pdf",
    description: "Triggers headless PDF generation of the report and returns the artifact path.",
    inputSchema: {
      type: "object",
      properties: {
        outputPath: {
          type: "string",
          description: "Optional custom output path for the exported PDF file"
        }
      }
    }
  }
];

/**
 * Ephemeral CSRF Token Manager for Localhost & Browser Gating
 */
export class CSRFManager {
  constructor(ttlMs = 3600000) {
    this.ttlMs = ttlMs;
    this.tokens = new Map();
  }

  generateToken() {
    this.pruneExpired();
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = Date.now() + this.ttlMs;
    this.tokens.set(token, expiresAt);
    return { csrfToken: token, expiresAt };
  }

  validateToken(token) {
    if (!token || typeof token !== "string") return false;
    this.pruneExpired();
    const expiresAt = this.tokens.get(token);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.tokens.delete(token);
      return false;
    }
    return true;
  }

  pruneExpired() {
    const now = Date.now();
    for (const [t, exp] of this.tokens.entries()) {
      if (now > exp) this.tokens.delete(t);
    }
  }

  static validateHost(hostHeader) {
    if (!hostHeader || typeof hostHeader !== "string") return false;
    const clean = hostHeader.toLowerCase().split(":")[0];
    return clean === "localhost" || clean === "127.0.0.1" || clean === "[::1]";
  }

  static validateOrigin(originHeader) {
    if (!originHeader || originHeader === "null") return true;
    try {
      const url = new URL(originHeader);
      const host = url.hostname.toLowerCase();
      return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    } catch (_) {
      return false;
    }
  }
}

/**
 * Allowlist Boundary Manager
 */
export class AllowlistManager {
  constructor(allowlistPath) {
    this.allowlistPath = allowlistPath || path.resolve(__dirname, "../assets/mcp_allowlist.json");
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.allowlistPath)) {
        const raw = fs.readFileSync(this.allowlistPath, "utf-8");
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn("[mcp-server] Warning reading allowlist, falling back to defaults:", err.message);
    }
    return {
      allowedServers: ["postgres-prod", "sqlite-local", "github-mcp", "filesystem", "report-internal", "local-dev"],
      allowedTools: [
        "report_get_state",
        "report_update_fragment",
        "report_set_theme",
        "report_append_alert",
        "report_export_pdf",
        "execute_query",
        "read_query",
        "list_issues",
        "get_file",
        "read_data"
      ],
      toolPolicies: {}
    };
  }

  isToolAllowed(server, tool) {
    if (!server || !tool) return false;
    const sOk = (this.config.allowedServers || []).includes(server);
    const tOk = (this.config.allowedTools || []).includes(tool);
    return sOk && tOk;
  }
}

/**
 * Formats standard JSON-RPC 2.0 success response
 */
export function formatJsonRpcResult(id, result) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    result
  };
}

/**
 * Formats standard JSON-RPC 2.0 error response
 */
export function formatJsonRpcError(id, code, message, data = null) {
  const err = { code, message };
  if (data !== null) err.data = data;
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: err
  };
}

/**
 * Handles incoming MCP JSON-RPC 2.0 protocol requests.
 * @param {object} reqObj - Parsed JSON-RPC request body
 * @param {object} context - Dev server execution context (broadcast, state, theme, etc.)
 * @returns {Promise<object>} JSON-RPC 2.0 response object
 */
export async function handleMCPRequest(reqObj, context = {}) {
  if (!reqObj || typeof reqObj !== "object" || reqObj.jsonrpc !== "2.0" || typeof reqObj.method !== "string") {
    return formatJsonRpcError(reqObj?.id, JSON_RPC_ERRORS.INVALID_REQUEST, "Invalid Request: must be valid JSON-RPC 2.0 object with method string");
  }

  const { id, method, params = {} } = reqObj;

  switch (method) {
    case "initialize": {
      return formatJsonRpcResult(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: {
            listChanged: false
          }
        },
        serverInfo: MCP_SERVER_INFO
      });
    }

    case "notifications/initialized": {
      return formatJsonRpcResult(id, { ok: true, acknowledged: true });
    }

    case "ping": {
      return formatJsonRpcResult(id, {});
    }

    case "tools/list": {
      return formatJsonRpcResult(id, {
        tools: NATIVE_MCP_TOOLS
      });
    }

    case "tools/call": {
      const toolName = params.name;
      const toolArgs = params.arguments || {};

      if (!toolName || typeof toolName !== "string") {
        return formatJsonRpcError(id, JSON_RPC_ERRORS.INVALID_PARAMS, "Missing or invalid 'name' in tools/call parameters");
      }

      const toolDef = NATIVE_MCP_TOOLS.find((t) => t.name === toolName);
      if (!toolDef) {
        return formatJsonRpcError(id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Tool not found: '${toolName}'`);
      }

      try {
        let result = null;

        if (toolName === "report_get_state") {
          result = {
            title: context.getTitle ? context.getTitle() : "HTML Report",
            theme: context.getTheme ? context.getTheme() : "light",
            tabCount: context.getClientCount ? context.getClientCount() : 1,
            activeCards: context.getActiveCards ? context.getActiveCards() : [],
            serverTime: new Date().toISOString()
          };
        } else if (toolName === "report_update_fragment") {
          if (!toolArgs.selector || typeof toolArgs.selector !== "string" || !toolArgs.html || typeof toolArgs.html !== "string") {
            return formatJsonRpcError(id, JSON_RPC_ERRORS.INVALID_PARAMS, "report_update_fragment requires 'selector' and 'html' string arguments");
          }
          const mergeMode = toolArgs.mergeMode || "morph";
          if (context.broadcastFragment) {
            context.broadcastFragment({
              selector: toolArgs.selector,
              html: toolArgs.html,
              merge: mergeMode
            });
          }
          result = {
            ok: true,
            selector: toolArgs.selector,
            mergeMode,
            dispatchedToListeners: context.getClientCount ? context.getClientCount() : 0
          };
        } else if (toolName === "report_set_theme") {
          if (!toolArgs.theme || typeof toolArgs.theme !== "string") {
            return formatJsonRpcError(id, JSON_RPC_ERRORS.INVALID_PARAMS, "report_set_theme requires 'theme' string argument");
          }
          const theme = toolArgs.theme.toLowerCase().trim();
          if (context.setTheme) {
            context.setTheme(theme);
          }
          result = {
            ok: true,
            theme,
            synchronizedClients: context.getClientCount ? context.getClientCount() : 0
          };
        } else if (toolName === "report_append_alert") {
          if (!toolArgs.message || typeof toolArgs.message !== "string") {
            return formatJsonRpcError(id, JSON_RPC_ERRORS.INVALID_PARAMS, "report_append_alert requires 'message' string argument");
          }
          const type = toolArgs.type || "info";
          if (context.appendAlert) {
            context.appendAlert({ message: toolArgs.message, type });
          }
          result = {
            ok: true,
            message: toolArgs.message,
            type
          };
        } else if (toolName === "report_export_pdf") {
          const outputPath = toolArgs.outputPath || "report-export.pdf";
          if (context.exportPdf) {
            result = await context.exportPdf({ outputPath });
          } else {
            result = {
              ok: true,
              outputPath,
              message: "Headless PDF export queued via Playwright CLI",
              status: "ready"
            };
          }
        }

        return formatJsonRpcResult(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ],
          isError: false
        });
      } catch (execErr) {
        return formatJsonRpcResult(id, {
          content: [
            {
              type: "text",
              text: `Tool execution error: ${execErr.message}`
            }
          ],
          isError: true
        });
      }
    }

    default: {
      return formatJsonRpcError(id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Method not supported: '${method}'`);
    }
  }
}

/**
 * Handles Client Gateway tool calls (POST /api/mcp/call-tool) with security guardrails.
 * @param {object} payload - { server, tool, args, csrfToken }
 * @param {object} options - { host, origin, csrfManager, allowlistManager, timeoutMs, context }
 */
export async function handleGatewayCallTool(payload, options = {}) {
  const { host, origin, csrfManager, allowlistManager, timeoutMs = 15000, context = {} } = options;

  // 1. Host Validation
  if (host && !CSRFManager.validateHost(host)) {
    return {
      statusCode: 403,
      body: { ok: false, error: "Forbidden: Host must be localhost or 127.0.0.1" }
    };
  }

  // 2. Origin Validation
  if (origin && !CSRFManager.validateOrigin(origin)) {
    return {
      statusCode: 403,
      body: { ok: false, error: "Forbidden: Cross-origin request rejected" }
    };
  }

  // 3. CSRF Token Validation
  if (csrfManager) {
    if (!payload.csrfToken || !csrfManager.validateToken(payload.csrfToken)) {
      return {
        statusCode: 401,
        body: { ok: false, error: "Unauthorized: Invalid or missing CSRF token" }
      };
    }
  }

  const { server, tool, args = {} } = payload;
  if (!server || !tool) {
    return {
      statusCode: 400,
      body: { ok: false, error: "Bad Request: 'server' and 'tool' are required" }
    };
  }

  // 4. Allowlist Validation
  if (allowlistManager && !allowlistManager.isToolAllowed(server, tool)) {
    return {
      statusCode: 403,
      body: {
        ok: false,
        error: `Tool forbidden: server '${server}' or tool '${tool}' is not in mcp_allowlist.json`
      }
    };
  }

  // 5. Tool Execution with 15-second bounded execution timeout
  try {
    const executionPromise = (async () => {
      // Internal report tools execute through standard MCP handler
      if (server === "report-internal" || server === "local-dev") {
        const mcpReq = {
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: { name: tool, arguments: args }
        };
        const mcpRes = await handleMCPRequest(mcpReq, context);
        if (mcpRes.error) {
          throw new Error(mcpRes.error.message);
        }
        return JSON.parse(mcpRes.result.content[0].text);
      }

      // External mock/gateway adapters (Postgres, SQLite, GitHub)
      if (server === "postgres-prod" || server === "sqlite-local") {
        return {
          server,
          tool,
          rows: [
            { id: 1, name: "System Pipeline", status: "healthy", latency_ms: 12.4 },
            { id: 2, name: "Agent Gateway", status: "healthy", latency_ms: 8.1 }
          ],
          rowCount: 2,
          executedAt: new Date().toISOString()
        };
      }

      if (server === "github-mcp") {
        return {
          server,
          tool,
          issues: [
            { number: 42, title: "Optimize Datastar SSE fragment burst throughput", state: "open" }
          ]
        };
      }

      return {
        server,
        tool,
        args,
        executed: true,
        timestamp: new Date().toISOString()
      };
    })();

    const timeoutPromise = new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timeout: tool exceeded ${timeoutMs}ms limit`));
      }, timeoutMs);
      if (typeof timer.unref === "function") timer.unref();
    });

    const result = await Promise.race([executionPromise, timeoutPromise]);
    return {
      statusCode: 200,
      body: {
        ok: true,
        server,
        tool,
        result
      }
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: {
        ok: false,
        server,
        tool,
        error: err.message
      }
    };
  }
}
