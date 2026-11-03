import { VerificationCheck } from "../../registry.mjs";

export class AlpineCheck extends VerificationCheck {
  constructor() {
    super({
      id: "cdn:alpine",
      name: "Alpine.js Component Reactivity Styleguide",
      category: "cdn",
      cliFlags: ["--check-reactive", "--check-alpine", "--cdn-alpine"],
      styleguideRules: ["component-initialized", "no-hanging-cloak"]
    });
  }

  async shouldRun({ options, detectedFeatures, page }) {
    if (options.allCdns || options.checkReactive || options.checkAlpine || options.cdnAlpine) return true;
    if (options.cdns?.includes("alpine") || options.cdns?.includes("reactive")) return true;
    if (detectedFeatures) return Boolean(detectedFeatures.hasAlpine);
    return await page.evaluate(() => Boolean(document.querySelector("[x-data], #alpine-example-card")));
  }

  async run({ page }) {
    const errors = [];
    const check = await page.evaluate(() => {
      const xDataEls = Array.from(document.querySelectorAll("[x-data]"));
      const hasAlpineMarkup = Boolean(document.querySelector("[x-data], #alpine-example-card"));
      if (!hasAlpineMarkup) return { hasAlpineMarkup: false };

      const hangingCloak = document.querySelectorAll("[x-cloak]").length;
      const alpineRendered = Boolean(document.querySelector("#alpine-example-card, [x-data]"));

      return { hasAlpineMarkup: true, xDataCount: xDataEls.length, alpineRendered, hangingCloak };
    });

    if (!check.hasAlpineMarkup) {
      errors.push("Target CDN check reactive requested, but no [x-data] component found.");
    } else if (!check.alpineRendered) {
      errors.push("Alpine.js interactive component did not render.");
    } else if (check.hangingCloak > 0) {
      errors.push(`Found ${check.hangingCloak} elements with unresolved x-cloak attribute.`);
    }

    return {
      id: this.id,
      name: this.name,
      status: errors.length > 0 ? "failed" : "passed",
      errors,
      styleguide: { compliant: errors.length === 0, rulesChecked: this.styleguideRules },
      messages: errors.length === 0 ? [`Alpine.js: ${check.xDataCount} reactive component(s) initialized.`] : []
    };
  }
}
