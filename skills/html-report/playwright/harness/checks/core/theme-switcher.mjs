import { VerificationCheck } from "../../registry.mjs";

export class ThemeSwitcherCheck extends VerificationCheck {
  constructor() {
    super({
      id: "core:theme-switcher",
      name: "DaisyUI 32-Theme Dropdown Swatches & Palette Switching",
      category: "themes",
      cliFlags: ["--themes"],
      styleguideRules: ["all-32-themes-rendered", "swatch-4-colors", "reactive-palette-sync"]
    });
  }

  async run({ page, options }) {
    const errors = [];
    const messages = [];

    const targetThemes = options.themes
      ? (Array.isArray(options.themes) ? options.themes : String(options.themes).split(","))
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : null;

    const themeCheck = await page.evaluate(async (explicitThemes) => {
      const swatchItems = Array.from(document.querySelectorAll("#theme-swatch-list .theme-swatch-item"));
      const swatchCount = swatchItems.length;

      const allHaveDataThemeAnd4Swatches =
        swatchItems.length >= 32 &&
        swatchItems.every((item) => {
          const themeAttr = item.getAttribute("data-theme");
          const swatches = item.querySelectorAll(
            ".bg-primary, .bg-secondary, .bg-accent, .bg-neutral"
          );
          return Boolean(themeAttr) && swatches.length === 4;
        });

      const initialDocTheme = document.documentElement.getAttribute("data-theme") || "light";

      const resolveActiveCharts = () => {
        if (window.reportCharts && Array.isArray(window.reportCharts) && window.reportCharts.length > 0) {
          return window.reportCharts;
        }
        if (typeof Chart !== "undefined" && typeof Chart.getChart === "function") {
          return Array.from(document.querySelectorAll("canvas"))
            .map((c) => Chart.getChart(c))
            .filter(Boolean);
        }
        return [];
      };

      const getChartsPaletteSignature = () => {
        const activeCharts = resolveActiveCharts();
        if (activeCharts.length === 0) {
          return null;
        }
        return JSON.stringify(
          activeCharts.map((chart) => {
            const datasets = Array.isArray(chart?.data?.datasets)
              ? chart.data.datasets.map((ds) => ({
                  borderColor: ds?.borderColor ?? null,
                  backgroundColor: ds?.backgroundColor ?? null,
                  pointBackgroundColor: ds?.pointBackgroundColor ?? null,
                  pointBorderColor: ds?.pointBorderColor ?? null
                }))
              : [];
            const scales = chart?.options?.scales
              ? Object.entries(chart.options.scales).map(([k, s]) => ({
                  key: k,
                  tickColor: s?.ticks?.color ?? null,
                  gridColor: s?.grid?.color ?? null,
                  pointLabelsColor: s?.pointLabels?.color ?? null,
                  angleLinesColor: s?.angleLines?.color ?? null
                }))
              : [];
            const legendColor = chart?.options?.plugins?.legend?.labels?.color ?? null;
            return { datasets, scales, legendColor };
          })
        );
      };

      const hasCharts = resolveActiveCharts().length > 0;
      const initialChartSignature = getChartsPaletteSignature();

      const defaultSwitchTarget = initialDocTheme === "dark" ? ["light"] : ["dark"];
      const themesToTest = explicitThemes && explicitThemes.length > 0 ? explicitThemes : defaultSwitchTarget;
      let allSwitchedCorrectly = true;
      let lastTheme = initialDocTheme;

      for (const t of themesToTest) {
        if (typeof window.setReportTheme === "function") {
          await window.setReportTheme(t);
        }
        const current = document.documentElement.getAttribute("data-theme");
        if (current !== t) {
          allSwitchedCorrectly = false;
        }
        lastTheme = current;
      }

      const updatedChartSignature = getChartsPaletteSignature();
      const chartColorChanged = hasCharts
        ? Boolean(initialChartSignature && updatedChartSignature && initialChartSignature !== updatedChartSignature)
        : true;

      // Restore initial startup theme
      if (typeof window.setReportTheme === "function") {
        await window.setReportTheme(initialDocTheme);
      }

      return {
        swatchCount,
        allHaveDataThemeAnd4Swatches,
        allSwitchedCorrectly,
        lastTheme,
        hasCharts,
        chartColorChanged
      };
    }, targetThemes);

    if (!targetThemes && !themeCheck.allHaveDataThemeAnd4Swatches) {
      errors.push(
        `Theme dropdown must render all 32 DaisyUI themes with 4 color swatches each (found ${themeCheck.swatchCount}).`
      );
    }

    if (!themeCheck.allSwitchedCorrectly || !themeCheck.chartColorChanged) {
      errors.push("Theme switching did not dynamically update <html data-theme> or Chart.js colors.");
    }

    if (errors.length === 0) {
      messages.push(
        `DaisyUI ${targetThemes ? targetThemes.join(", ") : "32-theme"} dropdown verified (${themeCheck.swatchCount} themes, charts reactive=${themeCheck.chartColorChanged}).`
      );
    }

    return {
      id: this.id,
      name: this.name,
      status: errors.length > 0 ? "failed" : "passed",
      errors,
      messages
    };
  }
}
