/**
 * @file lib/mcp/security-and-schemas.mjs
 * MCP protocol metadata, canonical NATIVE_MCP_TOOLS schemas, ephemeral CSRF
 * token management, and MCP allowlist boundary enforcement.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const MCP_SERVER_INFO = {
  name: "html-report-mcp-server",
  version: "0.0.0-beta.1"
};

export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603
};

export const NATIVE_MCP_TOOLS = [
  {
    name: "report_get_state",
    description: "Returns the current state of the Server-Connected Output Deliverable, including active DaisyUI theme, Semantic Fragment DOM summary, and active client tabs.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "report_update_fragment",
    description: "Updates a Target Element in the Semantic Fragment DOM by CSS selector via Server-Connected Datastar SSE fragment morphing.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector identifying the Target Element (e.g. '#kpi-card-revenue', '#agent-reaction-bubble')"
        },
        html: {
          type: "string",
          description: "New Semantic Fragment HTML to merge into the Target Element"
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
    description: "Switches the active DaisyUI theme across all open Server-Connected Output Deliverable tabs in real-time.",
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
    description: "Injects a dismissible DaisyUI alert banner (toast or notification) at the top of the Semantic Fragment (#report-main).",
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
    description: "Triggers headless PDF export of the Published Document and returns the output file path.",
    inputSchema: {
      type: "object",
      properties: {
        outputPath: {
          type: "string",
          description: "Optional custom output path for the exported PDF file"
        }
      }
    }
  },
  {
    name: "report_build",
    description: "Validates a Semantic Fragment with lintFragment() and compiles it into a workspace-contained Output Deliverable (<100ms), refreshing connected Target Element tabs.",
    inputSchema: {
      type: "object",
      properties: {
        fragmentHtml: {
          type: "string",
          description: "Semantic Fragment HTML markup to validate and assemble into the Output Deliverable"
        },
        title: {
          type: "string",
          description: "Document title for the assembled Output Deliverable"
        },
        outputPath: {
          type: "string",
          description: "Workspace-relative path for the Output Deliverable (defaults to the currently served Output Deliverable)"
        },
        mode: {
          type: "string",
          enum: ["report", "dashboard", "presentation", "print", "slides", "working-report", "live-report"],
          description: "Delivery archetype mode (default: 'report')"
        },
        theme: {
          type: "string",
          description: "DaisyUI theme name (default: 'light')"
        },
        addons: {
          type: "array",
          items: { type: "string" },
          description: "Optional addon keys (e.g. 'charts', 'mermaid', 'gridjs')"
        },
        published: {
          type: "boolean",
          description: "Compile as a static Published Document with authoring chrome stripped (default: false)"
        },
        saveFragment: {
          type: "boolean",
          description: "Persist the Semantic Fragment alongside the Output Deliverable when true"
        }
      },
      required: ["fragmentHtml"]
    }
  }
];

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
    const lower = hostHeader.trim().toLowerCase();
    const clean = lower.startsWith("[")
      ? lower.replace(/^(\[[^\]]+\])(?::\d+)?$/, "$1")
      : lower.split(":")[0];
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

export class AllowlistManager {
  constructor(allowlistPath) {
    this.allowlistPath = allowlistPath || path.resolve(__dirname, "../../../assets/mcp_allowlist.json");
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
        "report_build",
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
