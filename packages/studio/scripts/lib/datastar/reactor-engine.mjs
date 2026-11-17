/**
 * Multimodal TelemetryReactorSchema, AnomalyTriggerEngine, and AgentReactorBridge.
 */
import { EventEmitter } from "node:events";
import { escapeHtml } from "./sse-primitives.mjs";
import { DatastarBridge } from "./datastar-bridge.mjs";

export const TelemetryReactorSchema = {
  modalities: ["time-series", "environmental-api", "visual-image"],
  sentiments: ["bullish", "bearish", "neutral", "alert", "favorable", "warning", "critical", "identified"],

  isValidModality(m) {
    return this.modalities.includes(m);
  },

  isValidSentiment(s) {
    return this.sentiments.includes(String(s).toLowerCase());
  },

  validateEvent(event) {
    if (!event || typeof event !== "object") throw new Error("Event must be an object");
    if (!event.modality || !this.isValidModality(event.modality)) {
      throw new Error(`Invalid or missing event modality: ${event?.modality}. Must be one of: ${this.modalities.join(", ")}`);
    }
    if (!event.id) {
      event.id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    }
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }

    if (event.modality === "time-series") {
      if (typeof event.value !== "number" && typeof event.price !== "number") {
        throw new Error("time-series event requires numeric 'value' or 'price'");
      }
    } else if (event.modality === "environmental-api") {
      if (!event.endpoint && !event.payload && typeof event.temperature !== "number" && !event.conditions) {
        throw new Error("environmental-api event requires 'endpoint', 'payload', 'temperature', or 'conditions'");
      }
    } else if (event.modality === "visual-image") {
      if (!event.imageUrl && !event.imageBase64 && !event.svg && !event.entityId) {
        throw new Error("visual-image event requires 'imageUrl', 'imageBase64', 'svg', or 'entityId'");
      }
    }
    return true;
  }
};

export class AnomalyTriggerEngine {
  constructor({
    windowSize = 20,
    thresholdStdDev = 2.0,
    thresholdDeltaPct = 3.0,
    minCooldownMs = 3000
  } = {}) {
    this.windowSize = windowSize;
    this.thresholdStdDev = thresholdStdDev;
    this.thresholdDeltaPct = thresholdDeltaPct;
    this.minCooldownMs = minCooldownMs;
    this.history = new Map();
    this.lastTriggerTime = new Map();
    this.suppressedCount = 0;
    this.triggeredCount = 0;
  }

  evaluate(event) {
    TelemetryReactorSchema.validateEvent(event);
    const key = event.key || event.metric || event.entityId || event.modality;
    const now = event.timestamp || Date.now();

    const lastTime = this.lastTriggerTime.get(key) || 0;
    const elapsed = now - lastTime;
    const inCooldown = elapsed < this.minCooldownMs;

    if (event.modality === "visual-image") {
      const lastEntity = this.history.get(key);
      const isNew = lastEntity !== (event.entityId || event.imageUrl || event.svg);
      if (isNew || event.forceTrigger) {
        if (!inCooldown || event.forceTrigger) {
          this.history.set(key, event.entityId || event.imageUrl || event.svg);
          this.lastTriggerTime.set(key, now);
          this.triggeredCount++;
          return { triggered: true, reason: "new-visual-target", event };
        }
      }
      this.suppressedCount++;
      return { triggered: false, reason: "cooldown-or-duplicate-visual", event };
    }

    if (event.modality === "environmental-api") {
      if (event.alert || event.severe || (event.precipitationPct && event.precipitationPct > 80)) {
        if (!inCooldown || event.forceTrigger) {
          this.lastTriggerTime.set(key, now);
          this.triggeredCount++;
          return { triggered: true, reason: "severe-weather-alert", event };
        }
      }
      const val = typeof event.temperature === "number" ? event.temperature : event.value;
      if (typeof val === "number") {
        return this._evaluateNumericWindow(key, val, now, inCooldown, event);
      }
      this.suppressedCount++;
      return { triggered: false, reason: "steady-environmental-state", event };
    }

    const numericVal = typeof event.value === "number" ? event.value : event.price;
    if (typeof numericVal === "number") {
      return this._evaluateNumericWindow(key, numericVal, now, inCooldown, event);
    }

    this.suppressedCount++;
    return { triggered: false, reason: "unrecognized-metric", event };
  }

  _evaluateNumericWindow(key, val, now, inCooldown, event) {
    let window = this.history.get(key);
    if (!window) {
      window = [];
      this.history.set(key, window);
    }
    window.push(val);
    if (window.length > this.windowSize) {
      window.shift();
    }

    if (window.length < 3) {
      this.suppressedCount++;
      return { triggered: false, reason: "insufficient-history", event };
    }

    const mean = window.reduce((acc, v) => acc + v, 0) / window.length;
    const variance = window.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / window.length;
    const stdDev = Math.sqrt(variance);

    const prev = window[window.length - 2];
    const deltaPct = prev !== 0 ? Math.abs((val - prev) / prev) * 100 : 0;
    const zScore = stdDev > 0 ? Math.abs(val - mean) / stdDev : 0;

    const isAnomaly = zScore >= this.thresholdStdDev || deltaPct >= this.thresholdDeltaPct || event.forceTrigger;

    if (isAnomaly && (!inCooldown || event.forceTrigger)) {
      this.lastTriggerTime.set(key, now);
      this.triggeredCount++;
      return {
        triggered: true,
        reason: zScore >= this.thresholdStdDev ? "std-dev-breach" : "delta-pct-spike",
        stats: { zScore, deltaPct, mean, stdDev },
        event
      };
    }

    this.suppressedCount++;
    return {
      triggered: false,
      reason: inCooldown ? "cooldown-suppressed" : "sub-threshold-jitter",
      stats: { zScore, deltaPct, mean, stdDev },
      event
    };
  }
}

export class AgentReactorBridge extends EventEmitter {
  constructor({
    bridge = null,
    agentType = "agy",
    anomalyEngine = null,
    sentimentSelector = "#sentiment-badge",
    thoughtSelector = "#agent-thought-stream"
  } = {}) {
    super();
    this.bridge = bridge;
    this.agentType = agentType;
    this.anomalyEngine = anomalyEngine || new AnomalyTriggerEngine();
    this.sentimentSelector = sentimentSelector;
    this.thoughtSelector = thoughtSelector;
    this.evaluationCount = 0;
  }

  evaluateTelemetry(event) {
    TelemetryReactorSchema.validateEvent(event);
    const result = this.anomalyEngine.evaluate(event);
    this.emit("telemetry.evaluated", result);

    if (result.triggered) {
      this.emit("anomaly.triggered", result);
    } else {
      this.emit("telemetry.suppressed", result);
    }
    return result;
  }

  async *streamReaction(event, { customContext = "" } = {}) {
    TelemetryReactorSchema.validateEvent(event);
    this.evaluationCount++;
    this.emit("reaction.start", { event, count: this.evaluationCount });

    const chunks = this._generateReactionChunks(event, customContext);
    let fullText = "";

    for (const chunk of chunks) {
      fullText += chunk;
      this.emit("reaction.delta", { delta: chunk, fullText });
      yield chunk;
    }

    const sentiment = this._determineSentiment(event);
    this.emit("reaction.complete", { fullText, sentiment, event });

    if (this.bridge) {
      this.dispatchReactionToBridge(fullText, sentiment, event);
    }
  }

  _determineSentiment(event) {
    if (event.sentiment) return event.sentiment;
    if (event.modality === "time-series") {
      const delta = event.deltaPct || event.changePct || 0;
      if (delta >= 2.0) return "bullish";
      if (delta <= -2.0) return "bearish";
      return "neutral";
    }
    if (event.modality === "environmental-api") {
      if (event.severe || event.alert) return "warning";
      if (event.precipitationPct && event.precipitationPct > 70) return "warning";
      return "favorable";
    }
    if (event.modality === "visual-image") {
      return "identified";
    }
    return "neutral";
  }

  _generateReactionChunks(event, customContext = "") {
    let narrative = "";
    if (event.modality === "time-series") {
      const delta = event.deltaPct || event.changePct || 0;
      const price = event.price || event.value;
      if (delta <= -2.0) {
        narrative = `Sudden liquidity contraction detected on ${event.metric || "metric"}. Value dropped to $${price} (${delta.toFixed(1)}%). Elevated sell volume observed; monitoring immediate support shelf.`;
      } else if (delta >= 2.0) {
        narrative = `Bullish momentum surge on ${event.metric || "metric"}! Price broke out to $${price} (+${delta.toFixed(1)}%). Moving average expansion confirms upward volume flow.`;
      } else {
        narrative = `Consolidation detected on ${event.metric || "metric"}. Price trades steadily at $${price} with low volatility.`;
      }
    } else if (event.modality === "environmental-api") {
      if (event.severe || event.alert) {
        narrative = `SEVERE WEATHER WARNING: Extreme atmospheric transition detected (${event.conditions || "Severe Alert"}). Barometric drop and elevated precipitation risk require immediate precautionary steps.`;
      } else {
        narrative = `Weather telemetry normal: Current reading ${event.temperature || event.value}°C with ${event.conditions || "mild conditions"}. Environmental baselines steady.`;
      }
    } else if (event.modality === "visual-image") {
      const entity = event.entityName || event.entityId || "Target Entity";
      narrative = `Visual identification confirmed: ${entity}. Elemental analysis and strategic tactical counters mapped successfully.`;
    }

    if (customContext) {
      narrative += ` Context: ${customContext}`;
    }

    const words = narrative.split(" ");
    return words.map((w, idx) => (idx === 0 ? w : " " + w));
  }

  dispatchReactionToBridge(fullText, sentiment, event = {}) {
    if (!this.bridge) return;

    const timeStr = new Date().toTimeString().split(" ")[0];
    const sentimentHtml = this.renderSentimentBadge(sentiment);
    const bubbleHtml = `
<div class="chat chat-start transition-all duration-300">
  <div class="chat-header text-3xs font-mono opacity-70 mb-0.5">${escapeHtml(event.entityName || event.metric || "Co-Pilot")} · ${timeStr}</div>
  <div class="chat-bubble chat-bubble-primary text-xs leading-relaxed font-sans shadow-sm">${escapeHtml(fullText)}</div>
</div>`.trim();

    this.bridge.broadcast(DatastarBridge.formatFragment({
      selector: this.thoughtSelector,
      mergeMode: "append",
      html: bubbleHtml
    }));

    this.bridge.broadcast(DatastarBridge.formatFragment({
      selector: this.sentimentSelector,
      mergeMode: "outer",
      html: sentimentHtml
    }));

    this.bridge.broadcast(DatastarBridge.formatSignals({
      copilot: {
        sentiment,
        lastUpdate: timeStr,
        modality: event.modality || "general",
        evaluationCount: this.evaluationCount
      }
    }));
  }

  renderSentimentBadge(sentiment) {
    const s = String(sentiment).toLowerCase();
    if (s === "bullish") {
      return `<span id="sentiment-badge" class="badge badge-success badge-sm font-semibold gap-1"><i data-lucide="trending-up" class="w-3 h-3"></i> Bullish (Momentum)</span>`;
    }
    if (s === "bearish") {
      return `<span id="sentiment-badge" class="badge badge-error badge-sm font-semibold gap-1"><i data-lucide="alert-triangle" class="w-3 h-3"></i> Bearish (Dip)</span>`;
    }
    if (s === "warning" || s === "alert") {
      return `<span id="sentiment-badge" class="badge badge-error badge-sm font-semibold gap-1"><i data-lucide="alert-circle" class="w-3 h-3"></i> Severe Warning</span>`;
    }
    if (s === "favorable") {
      return `<span id="sentiment-badge" class="badge badge-info badge-sm font-semibold gap-1"><i data-lucide="sun" class="w-3 h-3"></i> Favorable</span>`;
    }
    if (s === "identified") {
      return `<span id="sentiment-badge" class="badge badge-accent badge-sm font-semibold gap-1"><i data-lucide="sparkles" class="w-3 h-3"></i> Entity Identified</span>`;
    }
    return `<span id="sentiment-badge" class="badge badge-ghost badge-sm text-base-content/70">Neutral</span>`;
  }
}
