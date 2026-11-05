import test from "node:test";
import assert from "node:assert/strict";
import {
  TelemetryReactorSchema,
  AnomalyTriggerEngine,
  AgentReactorBridge,
  DatastarBridge
} from "../skills/html-report/scripts/datastar-sse.mjs";

test("TelemetryReactorSchema validation", async (t) => {
  await t.test("accepts valid time-series event", () => {
    const event = {
      modality: "time-series",
      metric: "AAPL",
      price: 182.4,
      deltaPct: -2.4
    };
    assert.equal(TelemetryReactorSchema.validateEvent(event), true);
    assert.ok(event.id.startsWith("evt-"));
    assert.ok(typeof event.timestamp === "number");
  });

  await t.test("accepts valid environmental-api event", () => {
    const event = {
      modality: "environmental-api",
      endpoint: "https://api.weather.test/current",
      temperature: 24,
      conditions: "Sunny"
    };
    assert.equal(TelemetryReactorSchema.validateEvent(event), true);
  });

  await t.test("accepts valid visual-image event", () => {
    const event = {
      modality: "visual-image",
      entityId: "pikachu",
      svg: "<svg></svg>"
    };
    assert.equal(TelemetryReactorSchema.validateEvent(event), true);
  });

  await t.test("rejects invalid modality", () => {
    assert.throws(
      () => TelemetryReactorSchema.validateEvent({ modality: "invalid-modality" }),
      /Invalid or missing event modality/
    );
  });

  await t.test("rejects missing payload fields for time-series", () => {
    assert.throws(
      () => TelemetryReactorSchema.validateEvent({ modality: "time-series" }),
      /requires numeric 'value' or 'price'/
    );
  });
});

test("AnomalyTriggerEngine filter & trigger evaluation", async (t) => {
  await t.test("suppresses sub-threshold time-series jitter", () => {
    const engine = new AnomalyTriggerEngine({ thresholdDeltaPct: 3.0, thresholdStdDev: 2.0, minCooldownMs: 1000 });
    const baseline = 100;

    // Seed history with routine steady values
    engine.evaluate({ modality: "time-series", metric: "CPU", value: 100.1, timestamp: 1000 });
    engine.evaluate({ modality: "time-series", metric: "CPU", value: 100.2, timestamp: 1100 });
    engine.evaluate({ modality: "time-series", metric: "CPU", value: 100.1, timestamp: 1200 });

    const jitterResult = engine.evaluate({ modality: "time-series", metric: "CPU", value: 100.3, timestamp: 1300 });
    assert.equal(jitterResult.triggered, false);
    assert.equal(jitterResult.reason, "sub-threshold-jitter");
  });

  await t.test("triggers anomaly on sudden spike", () => {
    const engine = new AnomalyTriggerEngine({ thresholdDeltaPct: 3.0, thresholdStdDev: 2.0, minCooldownMs: 1000 });

    engine.evaluate({ modality: "time-series", metric: "AAPL", value: 100, timestamp: 1000 });
    engine.evaluate({ modality: "time-series", metric: "AAPL", value: 100.5, timestamp: 1100 });
    engine.evaluate({ modality: "time-series", metric: "AAPL", value: 100.2, timestamp: 1200 });

    // Flash dip: 100 -> 94 (-6%)
    const spikeResult = engine.evaluate({ modality: "time-series", metric: "AAPL", value: 94, timestamp: 2500 });
    assert.equal(spikeResult.triggered, true);
    assert.ok(spikeResult.reason === "delta-pct-spike" || spikeResult.reason === "std-dev-breach");
  });

  await t.test("triggers on visual target change and suppresses duplicates", () => {
    const engine = new AnomalyTriggerEngine({ minCooldownMs: 500 });

    const res1 = engine.evaluate({ modality: "visual-image", entityId: "pikachu", svg: "<svg>pika</svg>", timestamp: 1000 });
    assert.equal(res1.triggered, true);
    assert.equal(res1.reason, "new-visual-target");

    // Same entity within cooldown -> suppressed
    const res2 = engine.evaluate({ modality: "visual-image", entityId: "pikachu", svg: "<svg>pika</svg>", timestamp: 1100 });
    assert.equal(res2.triggered, false);

    // New entity after cooldown -> triggered
    const res3 = engine.evaluate({ modality: "visual-image", entityId: "charizard", svg: "<svg>chari</svg>", timestamp: 2000 });
    assert.equal(res3.triggered, true);
    assert.equal(res3.reason, "new-visual-target");
  });

  await t.test("triggers on severe weather alert", () => {
    const engine = new AnomalyTriggerEngine({ minCooldownMs: 500 });

    const normal = engine.evaluate({ modality: "environmental-api", endpoint: "@weather", temperature: 22, timestamp: 1000 });
    assert.equal(normal.triggered, false);

    const alert = engine.evaluate({ modality: "environmental-api", endpoint: "@weather", temperature: 14, alert: true, conditions: "Severe Storm", timestamp: 2000 });
    assert.equal(alert.triggered, true);
    assert.equal(alert.reason, "severe-weather-alert");
  });
});

test("AgentReactorBridge streaming reaction", async (t) => {
  await t.test("streams token deltas for time-series event", async () => {
    const bridge = new AgentReactorBridge();
    const event = {
      modality: "time-series",
      metric: "TECH",
      price: 175.4,
      deltaPct: -3.8
    };

    const deltas = [];
    for await (const chunk of bridge.streamReaction(event)) {
      deltas.push(chunk);
    }

    assert.ok(deltas.length > 3);
    const fullText = deltas.join("");
    assert.ok(fullText.includes("Sudden liquidity contraction"));
    assert.ok(fullText.includes("$175.4"));
  });

  await t.test("dispatches formatted fragments to attached DatastarBridge", async () => {
    const datastarBridge = new DatastarBridge();
    const broadcasted = [];
    datastarBridge.on("sse", (sse) => broadcasted.push(sse));

    const reactorBridge = new AgentReactorBridge({ bridge: datastarBridge });
    const event = {
      modality: "visual-image",
      entityName: "Gengar #094",
      entityId: "gengar",
      svg: "<svg></svg>"
    };

    for await (const _ of reactorBridge.streamReaction(event)) {}

    assert.ok(broadcasted.length >= 3);
    assert.ok(broadcasted.some((s) => s.includes("Gengar #094")));
    assert.ok(broadcasted.some((s) => s.includes("badge-accent")));
    assert.ok(broadcasted.some((s) => s.includes("datastar-merge-signals")));
  });
});
