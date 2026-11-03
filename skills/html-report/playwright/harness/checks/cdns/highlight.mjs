import { VerificationCheck } from "../../registry.mjs";

export class HighlightCheck extends VerificationCheck {
  constructor() {
    super({
      id: "cdn:highlight",
      name: "Highlight.js Code Syntax Styleguide",
      category: "cdn",
      cliFlags: ["--check-code", "--check-highlight", "--cdn-highlight"],
      styleguideRules: ["code-blocks-highlighted", "keywords-styled", "contrast-styled"]
    });
  }

  async shouldRun({ options, detectedFeatures, page }) {
    if (options.allCdns || options.checkCode || options.checkHighlight || options.cdnHighlight) return true;
    if (options.cdns?.includes("highlight") || options.cdns?.includes("code") || options.cdns?.includes("hljs")) return true;
    if (detectedFeatures) return Boolean(detectedFeatures.hasCode);
    return await page.evaluate(() => Boolean(document.querySelector("pre code, .hljs, code[class*='language-']")));
  }

  async run({ page }) {
    const errors = [];
    const check = await page.evaluate(() => {
      const codeBlocks = Array.from(document.querySelectorAll("pre code, .hljs, code[class*='language-']"));
      if (codeBlocks.length === 0) return { hasCode: false };

      const tsCode = document.getElementById("frontend-ts-code") || document.querySelector("code.language-typescript");
      const ktCode = document.getElementById("backend-kotlin-code") || document.querySelector("code.language-kotlin");

      const tsHighlighted = Boolean(tsCode && tsCode.querySelectorAll(".hljs-keyword").length >= 1);
      const ktHighlighted = Boolean(ktCode && ktCode.querySelectorAll(".hljs-keyword").length >= 1);
      const totalKeywordCount = document.querySelectorAll(".hljs-keyword").length;

      return {
        hasCode: true,
        codeBlockCount: codeBlocks.length,
        hasTsCode: Boolean(tsCode),
        tsHighlighted,
        hasKtCode: Boolean(ktCode),
        ktHighlighted,
        totalKeywordCount
      };
    });

    if (!check.hasCode) {
      errors.push("Target CDN check code requested, but no syntax-highlighted code block found.");
    } else {
      if (check.hasTsCode && !check.tsHighlighted) {
        errors.push("TypeScript code block detected but Highlight.js failed to highlight keywords.");
      }
      if (check.hasKtCode && !check.ktHighlighted) {
        errors.push("Kotlin code block detected but Highlight.js failed to highlight keywords.");
      }
      if (!check.hasTsCode && !check.hasKtCode && check.totalKeywordCount === 0) {
        errors.push("Code blocks present but Highlight.js failed to format syntax keywords.");
      }
    }

    return {
      id: this.id,
      name: this.name,
      status: errors.length > 0 ? "failed" : "passed",
      errors,
      styleguide: { compliant: errors.length === 0, rulesChecked: this.styleguideRules },
      messages: errors.length === 0 ? [`Highlight.js: ${check.codeBlockCount} code block(s) styled with ${check.totalKeywordCount} keywords.`] : []
    };
  }
}
