import { VerificationCheck } from "../../registry.mjs";

export class MarkedCheck extends VerificationCheck {
  constructor() {
    super({
      id: "cdn:marked",
      name: "Marked Markdown Output Styleguide",
      category: "cdn",
      cliFlags: ["--check-markdown", "--check-marked", "--cdn-marked"],
      styleguideRules: ["html-rendered", "zero-raw-markdown-tokens"]
    });
  }

  async shouldRun({ options, detectedFeatures, page }) {
    if (options.allCdns || options.checkMarkdown || options.checkMarked || options.cdnMarked) return true;
    if (options.cdns?.includes("marked") || options.cdns?.includes("markdown")) return true;
    if (detectedFeatures) return Boolean(detectedFeatures.hasMarkdown);
    return await page.evaluate(() => Boolean(document.querySelector("#markdown-output, [data-markdown]")));
  }

  async run({ page }) {
    const errors = [];
    const check = await page.evaluate(() => {
      const container = document.querySelector("#markdown-output, [data-markdown]");
      if (!container) return { hasMarkdown: false };

      const markdownRendered = Boolean(
        container.querySelector("h1, h2, h3, h4, ul, ol, p, table, blockquote")
      );
      const text = container.textContent || "";
      const hasRawTokens = /###\s+|`{3}[a-z]*/i.test(text);

      return { hasMarkdown: true, markdownRendered, hasRawTokens };
    });

    if (!check.hasMarkdown) {
      errors.push("Target CDN check markdown requested, but no markdown container found.");
    } else if (!check.markdownRendered) {
      errors.push("Marked markdown block detected but failed to render HTML.");
    } else if (check.hasRawTokens) {
      errors.push("Markdown output contains raw unparsed markdown symbols.");
    }

    return {
      id: this.id,
      name: this.name,
      status: errors.length > 0 ? "failed" : "passed",
      errors,
      styleguide: { compliant: errors.length === 0, rulesChecked: this.styleguideRules },
      messages: errors.length === 0 ? ["Marked: Markdown content parsed into semantic HTML elements."] : []
    };
  }
}
