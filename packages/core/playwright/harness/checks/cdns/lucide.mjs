import { VerificationCheck } from "../../registry.mjs";

export class LucideCheck extends VerificationCheck {
  constructor() {
    super({
      id: "cdn:lucide",
      name: "Lucide Icons Styleguide",
      category: "cdn",
      cliFlags: ["--check-icons", "--check-lucide", "--cdn-lucide"],
      styleguideRules: ["icons-replaced", "no-empty-placeholders"]
    });
  }

  async shouldRun({ options, detectedFeatures, page }) {
    if (options.allCdns || options.checkIcons || options.checkLucide || options.cdnLucide) return true;
    if (options.cdns?.includes("lucide") || options.cdns?.includes("icons")) return true;
    if (detectedFeatures) return Boolean(detectedFeatures.hasLucide);
    return await page.evaluate(() => Boolean(document.querySelector("[data-lucide], svg.lucide")));
  }

  async run({ page }) {
    const errors = [];
    const check = await page.evaluate(() => {
      const hasMarkup = Boolean(document.querySelector("[data-lucide], svg.lucide"));
      if (!hasMarkup) return { hasMarkup: false };

      const lucideSvgCount = document.querySelectorAll("svg.lucide").length;
      const unrenderedPlaceholders = Array.from(document.querySelectorAll("[data-lucide]"))
        .filter((el) => el.tagName.toLowerCase() !== "svg" && !el.querySelector("svg"))
        .map((el) => el.getAttribute("data-lucide"));

      return { hasMarkup: true, lucideSvgCount, unrenderedPlaceholders };
    });

    if (!check.hasMarkup) {
      errors.push("Target CDN check icons requested, but no Lucide icon elements found.");
    } else if (check.lucideSvgCount === 0) {
      errors.push("Lucide Icons did not render SVG icons.");
    } else if (check.unrenderedPlaceholders.length > 0) {
      errors.push(`Unrendered [data-lucide] placeholders remaining: ${check.unrenderedPlaceholders.join(", ")}`);
    }

    return {
      id: this.id,
      name: this.name,
      status: errors.length > 0 ? "failed" : "passed",
      errors,
      styleguide: { compliant: errors.length === 0, rulesChecked: this.styleguideRules },
      messages: errors.length === 0 ? [`Lucide: ${check.lucideSvgCount} icon(s) mounted as SVG.`] : []
    };
  }
}
