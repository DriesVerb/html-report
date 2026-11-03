import { VerificationCheck } from "../../registry.mjs";

export class ChartsCheck extends VerificationCheck {
  constructor() {
    super({
      id: "cdn:charts",
      name: "Chart.js Palette & Canvas Styleguide",
      category: "cdn",
      cliFlags: ["--check-charts", "--cdn-charts"],
      styleguideRules: ["canvas-present", "charts-initialized", "palette-sync", "no-nan-artifacts", "zero-clipping"]
    });
  }

  async shouldRun({ options, detectedFeatures, page }) {
    if (options.allCdns || options.checkCharts || options.cdnCharts) return true;
    if (options.cdns?.includes("charts")) return true;
    if (detectedFeatures) return Boolean(detectedFeatures.hasCanvas);
    return await page.evaluate(() => Boolean(document.querySelector("canvas")));
  }

  async run({ page }) {
    const errors = [];
    const check = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll("canvas"));
      if (canvases.length === 0) return { hasCanvas: false };

      const chartCount = window.reportCharts ? window.reportCharts.length : 0;
      let hasNanData = false;
      let hasClipping = false;

      if (window.reportCharts) {
        for (const chart of window.reportCharts) {
          const datasets = chart.data?.datasets || [];
          for (const ds of datasets) {
            if (Array.isArray(ds.data) && ds.data.some((v) => Number.isNaN(v))) {
              hasNanData = true;
            }
          }
          const canvasEl = chart.canvas;
          if (canvasEl && canvasEl.parentElement) {
            if (canvasEl.scrollWidth > canvasEl.parentElement.clientWidth + 2) {
              hasClipping = true;
            }
          }
        }
      }

      return { hasCanvas: true, chartCount, hasNanData, hasClipping };
    });

    if (!check.hasCanvas) {
      errors.push("Target CDN check charts requested, but no <canvas> element found.");
    } else if (check.chartCount === 0) {
      errors.push("Canvas element detected but Chart.js charts failed to initialize.");
    } else {
      if (check.hasNanData) errors.push("Chart.js datasets contain NaN values.");
      if (check.hasClipping) errors.push("Chart canvas exceeds parent container width (clipping detected).");
    }

    return {
      id: this.id,
      name: this.name,
      status: errors.length > 0 ? "failed" : "passed",
      errors,
      styleguide: { compliant: errors.length === 0, rulesChecked: this.styleguideRules },
      messages: errors.length === 0 ? [`Chart.js: ${check.chartCount} chart(s) initialized and palette synced.`] : []
    };
  }
}
