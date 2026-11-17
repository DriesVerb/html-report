/**
 * datastar-sse.mjs - Real-Time Datastar.js SSE Telemetry Engine (Barrel)
 * Re-exports modular SSE primitives, SessionState, DatastarBridge, adapters, and reactor engine.
 */

export {
  escapeHtml,
  sendSSE,
  buildFragmentEvents,
  sendFragment,
  sendSignals,
  removeFragment,
  executeScript
} from "./lib/datastar/sse-primitives.mjs";

export {
  TaskTelemetrySchema,
  ToolInvocationRecord,
  SessionState,
  TaskTelemetrySession
} from "./lib/datastar/session-state.mjs";

export { DatastarBridge } from "./lib/datastar/datastar-bridge.mjs";

export {
  AgyTelemetryAdapter,
  CodexTelemetryAdapter
} from "./lib/datastar/telemetry-adapters.mjs";

export {
  TelemetryReactorSchema,
  AnomalyTriggerEngine,
  AgentReactorBridge
} from "./lib/datastar/reactor-engine.mjs";
