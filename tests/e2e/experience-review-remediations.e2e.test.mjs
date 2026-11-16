import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { buildReport } from "../../skills/html-report/scripts/build-report.mjs";
import { runHarness } from "../../packages/core/playwright/harness/runner.mjs";

describe("Experience Review Remediations — CDN Playwright E2E", () => {
  it("3.3 & 3.4 verifier respects --theme dracula in #agent-manifest and detects composite chart palette changes without borderColor", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "html-report-dracula-verify-"));
    try {
      const frag = `<main id="stone-board" class="space-y-6">
        <section id="overview">
          <h1 id="main-heading">Stone / Form</h1>
          <h2 id="stats-heading">Rock Stats</h2>
          <div class="relative h-72 w-full min-w-0">
            <canvas id="rock-chart"></canvas>
          </div>
        </section>
        <script>
          window.addEventListener("load", () => {
            const ctx = document.getElementById("rock-chart");
            if (ctx && typeof Chart !== "undefined") {
              const pal = typeof resolveDaisyUIThemePalette === "function" ? resolveDaisyUIThemePalette() : null;
              const c1 = pal && pal.primary ? pal.primary.hex : "#ff79c6";
              const c2 = pal && pal.secondary ? pal.secondary.hex : "#bd93f9";
              new Chart(ctx, {
                type: "bar",
                data: {
                  labels: ["Geodude", "Onix"],
                  datasets: [{
                    label: "Defense",
                    data: [100, 160],
                    backgroundColor: [c1, c2]
                  }]
                },
                options: { responsive: true, maintainAspectRatio: false }
              });
            }
          });
        </script>
      </main>`;
      const outPath = path.join(tmpDir, "dracula-board.html");
      const { html } = await buildReport({
        title: "Stone / Form",
        content: frag,
        theme: "dracula"
      });
      fs.writeFileSync(outPath, html, "utf8");

      const result = await runHarness(outPath, {
        quick: true
      });
      assert.equal(result.success, true, `Expected dracula report with array backgroundColor chart to pass verification, failures: ${JSON.stringify(result.failures || [])}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
