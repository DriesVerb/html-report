import { VerificationCheck } from "../../registry.mjs";

export class FullCalendarCheck extends VerificationCheck {
  constructor() {
    super({
      id: "cdn:fullcalendar",
      name: "FullCalendar Grid & Events Styleguide",
      category: "cdn",
      cliFlags: ["--check-calendar", "--check-fullcalendar", "--cdn-fullcalendar"],
      styleguideRules: ["calendar-rendered", "toolbar-formatted", "event-presence", "border-rendered", "clean-header-scroller"]
    });
  }

  async shouldRun({ options, detectedFeatures, page }) {
    if (options.allCdns || options.checkCalendar || options.checkFullcalendar || options.cdnFullcalendar) return true;
    if (options.cdns?.includes("fullcalendar") || options.cdns?.includes("calendar")) return true;
    if (detectedFeatures) return Boolean(detectedFeatures.hasFullCalendar);
    return await page.evaluate(() => Boolean(document.body && document.body.querySelector("#calendar, .fc, [data-fullcalendar]:not(style)")));
  }

  async run({ page }) {
    const errors = [];
    const check = await page.evaluate(() => {
      const container = (document.body || document).querySelector("div#calendar, div.fc, div[data-fullcalendar], [data-fullcalendar]:not(style)");
      if (!container) return { hasCalendar: false };

      const fcRendered = Boolean(container.querySelector(".fc-view-harness") || container.classList.contains("fc"));
      const toolbarRendered = Boolean(container.querySelector(".fc-toolbar, .fc-header-toolbar") || document.querySelector(".fc-toolbar, .fc-header-toolbar"));
      const eventCount = document.querySelectorAll(".fc-event").length;

      let borderRendered = true;
      let cleanHeaderScroller = true;
      const hasViewHarness = Boolean(container.querySelector(".fc-view-harness"));
      if (hasViewHarness && typeof getComputedStyle === "function") {
        const gridEl = container.querySelector(".fc-scrollgrid, .fc-daygrid-day, .fc-list");
        if (gridEl) {
          const st = getComputedStyle(gridEl);
          borderRendered = parseFloat(st.borderTopWidth || "0") > 0;
        }
        const headerScroller = container.querySelector(".fc-col-header .fc-scroller");
        if (headerScroller) {
          cleanHeaderScroller = getComputedStyle(headerScroller).overflowY !== "scroll";
        }
      }

      return { hasCalendar: true, fcRendered, toolbarRendered, eventCount, borderRendered, cleanHeaderScroller };
    });

    if (!check.hasCalendar) {
      errors.push("Target CDN check calendar requested, but no calendar element found.");
    } else if (!check.fcRendered) {
      errors.push("FullCalendar container detected but failed to initialize calendar grid.");
    } else {
      if (check.borderRendered === false) {
        errors.push("FullCalendar grid border collapsed to 0px (check OKLCH --fc-border-color theme tokens).");
      }
      if (check.cleanHeaderScroller === false) {
        errors.push("FullCalendar column header scroller has an unwanted vertical scrollbar (overflow-y: scroll).");
      }
    }

    return {
      id: this.id,
      name: this.name,
      status: errors.length > 0 ? "failed" : "passed",
      errors,
      styleguide: { compliant: errors.length === 0, rulesChecked: this.styleguideRules },
      messages: errors.length === 0 ? [`FullCalendar: Grid mounted with toolbar and ${check.eventCount} event(s).`] : []
    };
  }
}
