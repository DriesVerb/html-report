import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const runtimePath = path.resolve(__dirname, "../skills/html-report/assets/report-runtime.js");

const runtime = await import(runtimePath);
const {
  DAISYUI_THEMES,
  STANDARD_DAISYUI_THEMES,
  registerCustomTheme,
  setReportTheme,
  resolveDaisyUIThemePalette,
  renderMermaidWithTheme,
  compileTheme
} = runtime;

describe("Phase 4: Runtime Dynamic Palette Resolution & Custom Theme Switching", () => {
  it("should compile a custom theme and register it in DAISYUI_THEMES", () => {
    const custom = compileTheme({
      "neon-cyber": {
        extends: "dark",
        primary: "#06b6d4",
        secondary: "#ec4899",
        accent: "#10b981"
      }
    });

    assert.equal(custom.themeName, "neon-cyber");
    assert.ok(custom.css.includes('[data-theme="neon-cyber"]'));

    registerCustomTheme(custom.themeName, custom.css);
    assert.ok(DAISYUI_THEMES.includes("neon-cyber"), "Custom theme must be present in DAISYUI_THEMES");
  });

  it("should dynamically resolve custom theme palette and update Chart.js datasets", async () => {
    // Setup Mock DOM
    const originalDoc = globalThis.document;
    const originalWin = globalThis.window;

    const mockChart = {
      data: {
        datasets: [
          { label: "Primary Metric", borderColor: "#000", backgroundColor: "rgba(0,0,0,0.2)" },
          { label: "Secondary Metric", borderColor: "#000", backgroundColor: "rgba(0,0,0,0.2)" }
        ]
      },
      updateCalls: 0,
      update() { this.updateCalls++; }
    };

    let mermaidThemeConfig = null;
    const mockMermaid = {
      initialize(cfg) { mermaidThemeConfig = cfg; },
      async run() {}
    };

    globalThis.window = {
      mermaid: mockMermaid,
      reportCharts: [mockChart],
      getComputedStyle: (el) => {
        if (el.className.includes("bg-primary")) return { backgroundColor: "rgb(6, 182, 212)", color: "#fff" };
        if (el.className.includes("bg-secondary")) return { backgroundColor: "rgb(236, 72, 153)", color: "#fff" };
        if (el.className.includes("bg-accent")) return { backgroundColor: "rgb(16, 185, 129)", color: "#fff" };
        if (el.className.includes("bg-neutral")) return { backgroundColor: "rgb(31, 41, 55)", color: "#fff" };
        if (el.className.includes("bg-base-100")) return { backgroundColor: "rgb(15, 23, 42)", color: "#fff" };
        if (el.className.includes("bg-base-200")) return { backgroundColor: "rgb(30, 41, 59)", color: "#fff" };
        if (el.className.includes("bg-base-300")) return { backgroundColor: "rgb(51, 65, 85)", color: "#fff" };
        if (el.className.includes("text-base-content")) return { backgroundColor: "transparent", color: "rgb(248, 250, 252)" };
        return { backgroundColor: "rgb(6, 182, 212)", color: "rgb(248, 250, 252)" };
      }
    };

    const mockBody = {
      appendChild() {},
      removeChild() {}
    };

    let canvasFillStyle = "";
    globalThis.document = {
      body: mockBody,
      head: { appendChild() {} },
      documentElement: {
        getAttribute: () => "neon-cyber",
        setAttribute(k, v) { this[k] = v; }
      },
      createElement: (tag) => {
        if (tag === "canvas") {
          return {
            getContext: () => ({
              set fillStyle(val) { canvasFillStyle = val; },
              get fillStyle() { return canvasFillStyle; },
              fillRect() {},
              getImageData: () => {
                const match = canvasFillStyle.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
                if (match) {
                  return { data: [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), 255] };
                }
                return { data: [6, 182, 212, 255] };
              }
            })
          };
        }
        return {
          style: {},
          className: "",
          appendChild() {},
          remove() {}
        };
      },
      querySelectorAll: (sel) => (sel === ".mermaid" ? [{ dataset: {}, textContent: "graph TD\nA-->B", removeAttribute() {} }] : []),
      getElementById: () => null
    };

    try {
      await setReportTheme("neon-cyber");

      // Verify Chart.js updated with resolved hex colors from getComputedStyle
      assert.equal(mockChart.updateCalls, 1, "Chart.js must be updated on theme change");
      assert.equal(mockChart.data.datasets[0].borderColor, "#06b6d4");
      assert.equal(mockChart.data.datasets[1].borderColor, "#ec4899");

      // Verify Mermaid initialized with resolved custom colors
      assert.ok(mermaidThemeConfig, "Mermaid must be initialized with custom theme palette");
      assert.equal(mermaidThemeConfig.themeVariables.primaryBorderColor, "#06b6d4");
      assert.equal(mermaidThemeConfig.themeVariables.secondaryBorderColor, "#ec4899");
      assert.equal(mermaidThemeConfig.themeVariables.tertiaryBorderColor, "#10b981");
    } finally {
      globalThis.document = originalDoc;
      globalThis.window = originalWin;
    }
  });
});
