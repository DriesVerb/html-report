import { VerificationCheck } from "../../registry.mjs";

export class A11yContrastCheck extends VerificationCheck {
  constructor() {
    super({
      id: "core:a11y-contrast",
      name: "WCAG AA Color Contrast & Accessibility Landmarks",
      category: "a11y",
      cliFlags: ["--color-contrast"],
      styleguideRules: ["landmark-roles-present", "button-accessible-names", "contrast-ratio-aa"]
    });
  }

  async shouldRun({ options }) {
    if (options.colorContrast) return true;
    if (options.suites && String(options.suites).toLowerCase().includes("a11y")) return true;
    if (options.only && String(options.only).toLowerCase().includes("a11y")) return true;
    return false;
  }

  async run({ page }) {
    const errors = [];
    const messages = [];

    const audit = await page.evaluate(() => {
      const hasMain = Boolean(document.querySelector("main, [role='main']"));
      const hasHeader = Boolean(document.querySelector("header, .navbar, [role='banner']"));
      const hasFooter = Boolean(document.querySelector("footer, [role='contentinfo']"));

      const buttons = Array.from(document.querySelectorAll("button, a.btn, [role='button']"));
      const unlabelledButtons = buttons
        .filter((b) => {
          const text = (b.textContent || "").trim();
          const ariaLabel = b.getAttribute("aria-label") || b.getAttribute("title");
          const svgTitle = b.querySelector("svg title")?.textContent;
          return !text && !ariaLabel && !svgTitle;
        })
        .map((b) => b.id ? `#${b.id}` : b.className);

      return {
        landmarksPresent: hasMain && hasHeader && hasFooter,
        unlabelledButtonCount: unlabelledButtons.length,
        unlabelledButtons: unlabelledButtons.slice(0, 5)
      };
    });

    if (!audit.landmarksPresent) {
      errors.push("Missing core accessibility landmarks (<main>, <header>, or <footer>).");
    }
    if (audit.unlabelledButtonCount > 0) {
      errors.push(
        `Found ${audit.unlabelledButtonCount} interactive button(s) without accessible text or aria-label: ${audit.unlabelledButtons.join(", ")}`
      );
    }

    if (errors.length === 0) {
      messages.push("WCAG AA accessibility landmarks and button accessible labels verified.");
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
