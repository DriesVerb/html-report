import { VerificationCheck } from "../../registry.mjs";

export class KatexCheck extends VerificationCheck {
  constructor() {
    super({
      id: "cdn:katex",
      name: "KaTeX Math Formatting Styleguide",
      category: "cdn",
      cliFlags: ["--check-math", "--check-katex", "--cdn-katex"],
      styleguideRules: ["math-rendered", "zero-unrendered-latex-tokens"]
    });
  }

  async shouldRun({ options, detectedFeatures, page }) {
    if (options.allCdns || options.checkMath || options.checkKatex || options.cdnKatex) return true;
    if (options.cdns?.includes("katex") || options.cdns?.includes("math")) return true;
    if (detectedFeatures) return Boolean(detectedFeatures.hasKaTeX);
    return await page.evaluate(() => Boolean(document.querySelector(".katex, #katex-math-block, [data-katex]")));
  }

  async run({ page }) {
    const errors = [];
    const check = await page.evaluate(() => {
      const container = document.querySelector(".katex, #katex-math-block, [data-katex]");
      if (!container) return { hasKaTeX: false };

      const katexNodeCount = document.querySelectorAll(".katex").length;

      // Check for unparsed raw LaTeX tokens leaking into non-code DOM text
      const bodyText = document.body ? document.body.innerText || "" : "";
      const rawLatexRegex = /(\$\$|\\[a-zA-Z]+{[^}]+})/g;
      const leaks = [];
      let m;
      while ((m = rawLatexRegex.exec(bodyText)) !== null) {
        leaks.push(m[0]);
        if (leaks.length >= 3) break;
      }

      return { hasKaTeX: true, katexNodeCount, leaks };
    });

    if (!check.hasKaTeX) {
      errors.push("Target CDN check math requested, but no KaTeX element found.");
    } else if (check.katexNodeCount === 0) {
      errors.push("KaTeX equations detected but failed to render formatted math.");
    } else if (check.leaks.length > 0) {
      errors.push(`Unrendered raw LaTeX syntax tokens leaking into DOM text: ${check.leaks.join(", ")}`);
    }

    return {
      id: this.id,
      name: this.name,
      status: errors.length > 0 ? "failed" : "passed",
      errors,
      styleguide: { compliant: errors.length === 0, rulesChecked: this.styleguideRules },
      messages: errors.length === 0 ? [`KaTeX: ${check.katexNodeCount} equation(s) rendered with 0 syntax leaks.`] : []
    };
  }
}
