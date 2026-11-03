import { VerificationCheck } from "../../registry.mjs";

export class MermaidCheck extends VerificationCheck {
  constructor() {
    super({
      id: "cdn:mermaid",
      name: "Mermaid Diagrams & Styleguide",
      category: "cdn",
      cliFlags: ["--check-mermaid", "--cdn-mermaid"],
      styleguideRules: ["svg-rendered", "theme-sync", "no-syntax-errors"]
    });
  }

  async shouldRun({ options, detectedFeatures, page }) {
    if (options.allCdns || options.checkMermaid || options.cdnMermaid) return true;
    if (options.cdns?.includes("mermaid")) return true;
    if (detectedFeatures) return Boolean(detectedFeatures.hasMermaid);
    return await page.evaluate(() => Boolean(document.querySelector(".mermaid")));
  }

  async run({ page }) {
    const errors = [];
    const check = await page.evaluate(() => {
      const mermaidEls = document.querySelectorAll(".mermaid");
      if (mermaidEls.length === 0) return { hasMermaid: false };

      const svgCount = document.querySelectorAll(".mermaid svg").length;
      const errorElements = Array.from(
        document.querySelectorAll(".mermaid svg, svg[aria-roledescription='error'], .error-text, svg text")
      ).filter((el) => {
        const text = (el.textContent || "").trim();
        return /syntax error in text/i.test(text) || el.getAttribute("aria-roledescription") === "error";
      });

      const bodyText = document.body ? document.body.innerText || "" : "";
      const hasVisibleSyntaxErrorInText = /syntax error in text/i.test(bodyText) || errorElements.length > 0;

      return {
        hasMermaid: true,
        svgCount,
        hasVisibleSyntaxErrorInText,
        errorCount: errorElements.length
      };
    });

    if (!check.hasMermaid) {
      errors.push("Target CDN check mermaid requested, but no .mermaid element found.");
    } else if (check.svgCount === 0) {
      errors.push("Mermaid diagram element detected but SVG diagram failed to render.");
    }

    if (check.hasVisibleSyntaxErrorInText || check.errorCount > 0) {
      errors.push('Visible "Syntax error in text" detected in report (Mermaid diagram syntax error).');
    }

    return {
      id: this.id,
      name: this.name,
      status: errors.length > 0 ? "failed" : "passed",
      errors,
      styleguide: { compliant: errors.length === 0, rulesChecked: this.styleguideRules },
      messages: errors.length === 0 ? [`Mermaid: ${check.svgCount} diagram(s) rendered with 0 syntax errors.`] : []
    };
  }
}
