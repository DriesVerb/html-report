import { VerificationCheck } from "../../registry.mjs";

const STANDARD_BREAKPOINTS = {
  sm: { name: "sm", width: 640, height: 800 },
  md: { name: "md", width: 768, height: 900 },
  lg: { name: "lg", width: 1024, height: 900 },
  xl: { name: "xl", width: 1280, height: 900 },
  "2xl": { name: "2xl", width: 1536, height: 900 }
};

export function parseViewports(input, isQuick = false) {
  if (!input) {
    return isQuick
      ? [STANDARD_BREAKPOINTS.sm, STANDARD_BREAKPOINTS.lg]
      : Object.values(STANDARD_BREAKPOINTS);
  }

  const items = Array.isArray(input) ? input : String(input).split(",");
  const result = [];

  for (const item of items) {
    const trimmed = item.trim().toLowerCase();
    if (STANDARD_BREAKPOINTS[trimmed]) {
      result.push(STANDARD_BREAKPOINTS[trimmed]);
    } else if (/^\d+x\d+$/.test(trimmed)) {
      const [w, h] = trimmed.split("x").map(Number);
      result.push({ name: `${w}x${h}`, width: w, height: h });
    }
  }

  return result.length > 0 ? result : [STANDARD_BREAKPOINTS.sm, STANDARD_BREAKPOINTS.lg];
}

export class ResponsiveCheck extends VerificationCheck {
  constructor() {
    super({
      id: "core:responsive",
      name: "Responsive Breakpoints & Space Detector",
      category: "responsive",
      cliFlags: ["--viewports"],
      styleguideRules: ["no-page-overflow", "no-badge-wrapping", "no-horizontal-scrollbar-elements"]
    });
  }

  async run({ page, options }) {
    const errors = [];
    const messages = [];
    const targetBreakpoints = parseViewports(options.viewports, options.quick);

    for (const bp of targetBreakpoints) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(options.quick ? 40 : 150);

      const bpMetrics = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth;
        const winWidth = window.innerWidth;
        const insufficientElements =
          typeof window.checkInsufficientHorizontalSpace === "function"
            ? window.checkInsufficientHorizontalSpace()
            : [];

        const badges = Array.from(document.querySelectorAll(".badge"));
        const overflowingBadges = badges
          .filter((b) => b.scrollHeight > b.clientHeight + 2)
          .map((b) => b.textContent.trim().replace(/\s+/g, " ").slice(0, 40));

        return {
          docWidth,
          winWidth,
          overflowPx: Math.max(0, docWidth - winWidth),
          insufficientElements,
          overflowingBadges
        };
      });

      if (bpMetrics.overflowPx > 2) {
        errors.push(
          `Breakpoint ${bp.name} (${bp.width}px) has page horizontal overflow: scrollWidth=${bpMetrics.docWidth}px > innerWidth=${bpMetrics.winWidth}px`
        );
      }
      if (bpMetrics.overflowingBadges.length > 0) {
        errors.push(
          `Breakpoint ${bp.name} (${bp.width}px) badges overflowing pill boundaries: ${bpMetrics.overflowingBadges.join(", ")}`
        );
      }
      if (bpMetrics.insufficientElements.length > 0) {
        const details = bpMetrics.insufficientElements
          .map((item) => `<${item.tag}${item.id ? "#" + item.id : ""}> (${item.scrollWidth}px > ${item.clientWidth}px: ${item.message})`)
          .join("; ");
        errors.push(`Breakpoint ${bp.name} (${bp.width}px) elements without enough space: ${details}`);
      } else {
        messages.push(`${bp.name} (${bp.width}x${bp.height}): 0px page overflow & 0 elements with horizontal scrollbar.`);
      }
    }

    await page.setViewportSize({ width: 1280, height: 900 });

    return {
      id: this.id,
      name: this.name,
      status: errors.length > 0 ? "failed" : "passed",
      errors,
      messages
    };
  }
}
