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

      const hasCharts = Boolean(window.reportCharts && window.reportCharts.length > 0);
      const initialChartColor = hasCharts ? (window.reportCharts[0]?.data?.datasets?.[0]?.borderColor || null) : null;

      const themesToTest = explicitThemes && explicitThemes.length > 0 ? explicitThemes : ["dark"];
      let allSwitchedCorrectly = true;
      let lastTheme = "light";

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

      const updatedChartColor = hasCharts ? (window.reportCharts[0]?.data?.datasets?.[0]?.borderColor || null) : null;
      const chartColorChanged = hasCharts
        ? Boolean(initialChartColor && updatedChartColor && initialChartColor !== updatedChartColor)
        : true;

      // Restore light theme
      if (typeof window.setReportTheme === "function") {
        await window.setReportTheme("light");
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
