/**
 * Unified Agent Tracker Facade: maintains canonical state and pushes
 * Core Observer HTML updates to the live-reload dev server.
 */
import http from "node:http";
import { EventEmitter } from "node:events";
import { CanonicalAgentStates } from "./canonical-schema.mjs";
import {
  AgentTelemetryStrategy,
  AgyTelemetryStrategy,
  ClaudeCodeTelemetryStrategy,
  CodexSwarmTelemetryStrategy,
  GenericTelemetryStrategy
} from "./telemetry-strategies.mjs";
import { renderCoreObserverHtml } from "./observer-renderer.mjs";

export class AgentTrackerFacade extends EventEmitter {
  constructor({ defaultStrategy = "agy" } = {}) {
    super();
    this.strategies = new Map();
    this.registerStrategy(new AgyTelemetryStrategy());
    this.registerStrategy(new ClaudeCodeTelemetryStrategy());
    this.registerStrategy(new CodexSwarmTelemetryStrategy());
    this.registerStrategy(new GenericTelemetryStrategy());

    this.currentStrategy = this.strategies.get(defaultStrategy) || this.strategies.get("agy");
    this.subagents = new Map();

    this.state = {
      providerId: this.currentStrategy.providerId,
      providerName: this.currentStrategy.displayName,
      state: "thinking",
      activeTool: null,
      thought: "Core Observer initialized. Standing by for telemetry stream...",
      recentHistory: [],
      telemetry: {
        contextTokens: 14200,
        contextWindowLimit: 200000,
        saturationPct: 7.1,
        promptTokens: 11400,
        reasoningTokens: 1800,
        completionTokens: 1000,
        tokensPerSecond: 124
      },
      timestamp: Date.now(),
      stateStartedAt: Date.now()
    };

    this.maxHistory = 10;
  }

  registerStrategy(strategy) {
    if (!(strategy instanceof AgentTelemetryStrategy)) {
      throw new TypeError("Strategy must extend AgentTelemetryStrategy");
    }
    this.strategies.set(strategy.providerId, strategy);
  }

  setStrategy(providerId) {
    const strat = this.strategies.get(providerId);
    if (!strat) {
      throw new Error(`Strategy '${providerId}' is not registered.`);
    }
    this.currentStrategy = strat;
    this.state.providerId = strat.providerId;
    this.state.providerName = strat.displayName;
    this.emit("strategyChanged", strat);
    return strat;
  }

  getActiveStrategy() {
    return this.currentStrategy;
  }

  autoDetectStrategy(rawPayload) {
    for (const [id, strat] of this.strategies.entries()) {
      if (id !== "generic" && strat.canHandle(rawPayload)) {
        return strat;
      }
    }
    return this.strategies.get("generic");
  }

  ingest(rawPayload, { provider = null, recordHistory = true } = {}) {
    const t0 = performance.now();
    let strategy = this.currentStrategy;

    if (provider && this.strategies.has(provider)) {
      strategy = this.strategies.get(provider);
    } else if (!strategy.canHandle(rawPayload)) {
      strategy = this.autoDetectStrategy(rawPayload);
    }

    const normalized = strategy.normalize(rawPayload);
    const elapsedMs = Number((performance.now() - t0).toFixed(2));

    if (recordHistory && this.state.activeTool && (!normalized.activeTool || normalized.activeTool.id !== this.state.activeTool.id)) {
      const prevTool = this.state.activeTool;
      const durationMs = Math.max(12, Math.round(Date.now() - prevTool.startTime));
      this.pushRecentActivity({
        id: prevTool.id,
        name: prevTool.name,
        target: prevTool.target,
        durationMs,
        status: normalized.state === "error" ? "failed" : "ok",
        timestamp: Date.now()
      });
    }

    if (normalized.state !== this.state.state) {
      this.state.stateStartedAt = Date.now();
    }

    this.state.providerId = normalized.providerId;
    this.state.providerName = normalized.providerName;
    this.state.state = normalized.state;
    this.state.activeTool = normalized.activeTool;
    this.state.thought = normalized.thought;
    this.state.timestamp = normalized.timestamp;
    if (normalized.telemetry) {
      this.state.telemetry = { ...normalized.telemetry };
    }

    if (normalized.activeTool?.name === "invoke_subagent" && normalized.activeTool.args) {
      const args = normalized.activeTool.args;
      const subId = String(args.conversationId || args.subagentId || `sub-${Date.now()}`);
      this.subagents.set(subId, {
        id: subId,
        typeName: String(args.TypeName || args.typeName || "subagent"),
        role: String(args.Role || args.role || "Delegated Subagent"),
        state: "running_tool",
        activeTool: {
          name: "evaluating_task",
          target: String(args.Prompt || "").slice(0, 60)
        },
        thought: String(args.Prompt || "Executing delegated subagent assignment..."),
        startedAt: Date.now(),
        durationMs: 0,
        status: "active"
      });
    } else if (rawPayload.subagents && Array.isArray(rawPayload.subagents)) {
      for (const sub of rawPayload.subagents) {
        if (sub && sub.id) this.subagents.set(sub.id, sub);
      }
    } else if (rawPayload.subagent && typeof rawPayload.subagent === "object") {
      const sub = rawPayload.subagent;
      if (sub.id) this.subagents.set(sub.id, sub);
    }

    const result = {
      raw: rawPayload,
      normalized: this.getCanonicalState(),
      elapsedMs,
      strategy: strategy.providerId
    };

    this.emit("ingest", result);
    return result;
  }

  registerSubagent(subData) {
    const id = String(subData.id || `sub-${Date.now()}`);
    const sub = {
      id,
      typeName: String(subData.typeName || "subagent"),
      role: String(subData.role || "Worker"),
      state: CanonicalAgentStates.includes(subData.state) ? subData.state : "running_tool",
      activeTool: subData.activeTool || null,
      thought: String(subData.thought || ""),
      startedAt: Number(subData.startedAt) || Date.now(),
      durationMs: Number(subData.durationMs) || 0,
      status: subData.status || "active"
    };
    this.subagents.set(id, sub);
    this.emit("subagentRegistered", sub);
    return sub;
  }

  updateSubagent(subId, patch = {}) {
    if (this.subagents.has(subId)) {
      const existing = this.subagents.get(subId);
      const updated = { ...existing, ...patch };
      this.subagents.set(subId, updated);
      this.emit("subagentUpdated", updated);
      return updated;
    }
    return null;
  }

  clearSubagents() {
    this.subagents.clear();
    this.emit("subagentsCleared");
  }

  pushRecentActivity(record) {
    this.state.recentHistory.unshift({
      id: record.id || `hist-${Date.now()}`,
      name: record.name || "tool",
      target: record.target || "",
      durationMs: record.durationMs || 25,
      status: record.status === "failed" ? "failed" : "ok",
      timestamp: Date.now()
    });

    if (this.state.recentHistory.length > this.maxHistory) {
      this.state.recentHistory.pop();
    }
  }

  updateTelemetry(patch = {}) {
    this.state.telemetry = { ...this.state.telemetry, ...patch };
    const total = this.state.telemetry.contextTokens;
    const limit = this.state.telemetry.contextWindowLimit || 200000;
    this.state.telemetry.saturationPct = Number(((total / limit) * 100).toFixed(1));
    this.emit("telemetryUpdated", this.state.telemetry);
    return this.state.telemetry;
  }

  getCanonicalState() {
    return {
      providerId: this.state.providerId,
      providerName: this.state.providerName,
      state: this.state.state,
      activeTool: this.state.activeTool ? { ...this.state.activeTool } : null,
      thought: this.state.thought,
      recentHistory: [...this.state.recentHistory],
      subagents: Array.from(this.subagents.values()),
      telemetry: { ...this.state.telemetry },
      timestamp: this.state.timestamp,
      stateStartedAt: this.state.stateStartedAt
    };
  }

  renderCoreObserverHtml() {
    return renderCoreObserverHtml(this.getCanonicalState());
  }

  async pushToDevServer({ port = 3000, host = "127.0.0.1", selector = "#live-feature-observer" } = {}) {
    const html = this.renderCoreObserverHtml();
    const payload = JSON.stringify({ selector, mergeMode: "outer", html });

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: host,
          port,
          path: "/__datastar_stream__",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload)
          }
        },
        (res) => {
          let resp = "";
          res.on("data", (c) => { resp += c; });
          res.on("end", () => {
            try {
              resolve(JSON.parse(resp));
            } catch (_) {
              resolve({ ok: res.statusCode === 200, raw: resp });
            }
          });
        }
      );

      req.on("error", (err) => reject(err));
      req.write(payload);
      req.end();
    });
  }
}
