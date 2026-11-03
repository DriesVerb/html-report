import fs from "node:fs";
import path from "node:path";
import { VerificationCheck } from "../../registry.mjs";

export class PrintPdfCheck extends VerificationCheck {
  constructor() {
    super({
      id: "core:print-pdf",
      name: "Print Media (@media print) & On-Demand PDF Export",
      category: "print",
      cliFlags: ["--pdf"],
      styleguideRules: ["media-print-navbar-hidden", "cover-page-present", "pdf-export-valid"]
    });
  }

  async run({ page, options }) {
    const errors = [];
    const messages = [];
    const effectiveMode = (options.mode || options.detectedMode || "interactive").toLowerCase();

    if (effectiveMode === "interactive") {
      messages.push("Interactive Mode: Skipping @media print checks (web-first report).");
      if (options.pdfPath || options.pdf) {
        const targetPdfPath = path.resolve(process.cwd(), options.pdfPath || options.pdf);
        fs.mkdirSync(path.dirname(targetPdfPath), { recursive: true });
        const pdfBuffer = await page.pdf({
          path: targetPdfPath,
          format: "A4",
          printBackground: true,
          margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" }
        });
        messages.push(`Single target PDF generated on demand: ${targetPdfPath} (${Math.round(pdfBuffer.length / 1024)} KB)`);
      } else {
        messages.push("On-Demand PDF export skipped: No --pdf flag provided (0 PDFs generated).");
      }
    } else {
      await page.emulateMedia({ media: "print" });
      await page.waitForTimeout(options.quick ? 50 : 200);

      const printCheck = await page.evaluate(() => {
        const headerEl = document.querySelector("header");
        const navbarEl = document.querySelector(".navbar");
        const coverPage = document.getElementById("print-cover-page");
        const headerHidden = headerEl ? getComputedStyle(headerEl).display === "none" : true;
        const navbarHidden = navbarEl ? getComputedStyle(navbarEl).display === "none" : true;
        const hasCover = Boolean(coverPage);
        const coverVisible = hasCover ? getComputedStyle(coverPage).display === "flex" : true;

        return { headerHidden, navbarHidden, coverVisible };
      });

      if (!printCheck.headerHidden || !printCheck.navbarHidden) {
        errors.push("In @media print, header and .navbar must be hidden (display: none).");
      } else {
        messages.push("@media print verified: navbar hidden (display:none).");
      }

      if (options.pdfPath || options.pdf) {
        const targetPdfPath = path.resolve(process.cwd(), options.pdfPath || options.pdf);
        fs.mkdirSync(path.dirname(targetPdfPath), { recursive: true });
        const pdfBuffer = await page.pdf({
          path: targetPdfPath,
          format: "A4",
          printBackground: true,
          margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" }
        });
        messages.push(`Single target PDF generated on demand: ${targetPdfPath} (${Math.round(pdfBuffer.length / 1024)} KB)`);
      } else {
        messages.push("On-Demand PDF export skipped: No --pdf flag provided (0 PDFs generated).");
      }

      await page.emulateMedia({ media: "screen" });
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
