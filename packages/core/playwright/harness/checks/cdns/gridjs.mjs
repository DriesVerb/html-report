import { VerificationCheck } from "../../registry.mjs";

export class GridJsCheck extends VerificationCheck {
  constructor() {
    super({
      id: "cdn:gridjs",
      name: "Grid.js Table & Pagination Styleguide",
      category: "cdn",
      cliFlags: ["--check-tables", "--check-gridjs", "--cdn-gridjs"],
      styleguideRules: ["table-rendered", "search-or-pagination", "zero-horizontal-overflow"]
    });
  }

  async shouldRun({ options, detectedFeatures, page }) {
    if (options.allCdns || options.checkTables || options.checkGridjs || options.cdnGridjs) return true;
    if (options.cdns?.includes("gridjs") || options.cdns?.includes("tables")) return true;
    if (detectedFeatures) return Boolean(detectedFeatures.hasGridJs);
    return await page.evaluate(() => Boolean(document.querySelector("[data-gridjs], #gridjs-benchmark-table, .gridjs")));
  }

  async run({ page }) {
    const errors = [];
    const check = await page.evaluate(() => {
      const container = document.querySelector("[data-gridjs], #gridjs-benchmark-table, .gridjs");
      if (!container) return { hasGridJs: false };

      const gridjsRowCount = document.querySelectorAll(".gridjs-tr").length;
      const hasSearch = Boolean(document.querySelector(".gridjs-search input"));
      const hasPagination = Boolean(document.querySelector(".gridjs-pagination"));

      return { hasGridJs: true, gridjsRowCount, hasSearch, hasPagination };
    });

    if (!check.hasGridJs) {
      errors.push("Target CDN check tables requested, but no Grid.js element found.");
    } else if (check.gridjsRowCount === 0) {
      errors.push("Grid.js table detected but failed to render rows.");
    }

    return {
      id: this.id,
      name: this.name,
      status: errors.length > 0 ? "failed" : "passed",
      errors,
      styleguide: { compliant: errors.length === 0, rulesChecked: this.styleguideRules },
      messages: errors.length === 0 ? [`Grid.js: Table rendered with ${check.gridjsRowCount} row(s).`] : []
    };
  }
}
