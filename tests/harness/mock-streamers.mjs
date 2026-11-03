/**
 * @fileoverview mock-streamers.mjs
 * Synthetic simulation streamers for Google Antigravity (AGY) and OpenAI Codex.
 * Used by the test harness to simulate realistic and burst-mode agent telemetry
 * without requiring live model provider connections.
 */

export class MockAgyStreamer {
  /**
   * @param {import('../../skills/html-report/scripts/datastar-sse.mjs').AgyTelemetryAdapter} adapter
   */
  constructor(adapter) {
    this.adapter = adapter;
    this.session = adapter.sessionState || adapter.session;
  }

  generateSampleTranscript(count = 50) {
    const steps = [];
    steps.push({
      step_index: 0,
      source: "USER_INPUT",
      type: "USER_INPUT",
      content: "Build live dashboard for html-report",
      status: "DONE"
    });

    for (let i = 1; i <= count; i++) {
      steps.push({
        step_index: i * 2 - 1,
        source: "MODEL",
        type: "PLANNER_RESPONSE",
        thinking: `Analyzing task requirement step ${i}: optimizing DOM morphing parameters.`,
        content: `Executing step ${i} of ${count}.`,
        tool_calls: [
          {
            id: `call_${i}_read`,
            name: "read_file",
            args: { Path: `src/module_${i}.js` }
          }
        ],
        status: "DONE"
      });

      steps.push({
        step_index: i * 2,
        source: "TOOL_OUTPUT",
        type: "TOOL_RESPONSE",
        tool_call_id: `call_${i}_read`,
        content: `File content for module_${i}: export const version = ${i};`,
        status: "DONE"
      });
    }

    return steps;
  }

  replayBurst(count = 100) {
    const numSteps = Math.max(50, Math.floor(count / 2));
    const steps = this.generateSampleTranscript(numSteps);
    for (const step of steps) {
      this.adapter.processStep(step);
    }
    return steps.length;
  }

  async replayWithDelay(count = 10, delayMs = 10) {
    const steps = this.generateSampleTranscript(count);
    for (const step of steps) {
      this.adapter.processStep(step);
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    return steps.length;
  }
}

export class MockCodexStreamer {
  /**
   * @param {import('../../skills/html-report/scripts/datastar-sse.mjs').CodexTelemetryAdapter} adapter
   */
  constructor(adapter) {
    this.adapter = adapter;
    this.session = adapter.sessionState || adapter.session;
  }

  generateSampleChunks(count = 50) {
    const chunks = [];

    for (let i = 1; i <= count; i++) {
      // 1. Reasoning chunk
      chunks.push({
        id: `chatcmpl-${i}`,
        choices: [
          {
            index: 0,
            delta: {
              reasoning_content: `Codex reasoning token chunk ${i}: validating schema. `
            }
          }
        ]
      });

      // 2. Tool call initiation chunk with finish_reason
      chunks.push({
        id: `chatcmpl-${i}`,
        choices: [
          {
            index: 0,
            finish_reason: "tool_calls",
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: `codex_call_${i}`,
                  function: {
                    name: "run_command",
                    arguments: JSON.stringify({ CommandLine: `npm test -- test_${i}` })
                  }
                }
              ]
            }
          }
        ]
      });
    }

    return chunks;
  }

  replayBurst(count = 100) {
    const numPairs = Math.max(50, Math.floor(count / 2));
    const chunks = this.generateSampleChunks(numPairs);
    for (const chunk of chunks) {
      this.adapter.processChunk(chunk);
    }
    return chunks.length;
  }

  async replayWithDelay(count = 10, delayMs = 10) {
    const chunks = this.generateSampleChunks(count);
    for (const chunk of chunks) {
      this.adapter.processChunk(chunk);
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    return chunks.length;
  }
}
