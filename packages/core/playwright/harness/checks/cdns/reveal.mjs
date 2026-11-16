import { VerificationCheck } from "../../registry.mjs";

export class RevealCheck extends VerificationCheck {
  constructor() {
    super({
      id: "cdn:reveal",
      name: "Reveal.js Presentation Spacing, Fullscreen & Notes",
      category: "cdn",
      cliFlags: ["--check-reveal", "--cdn-reveal", "--check-presentation"],
      styleguideRules: [
        "slide-horizontal-padding",
        "slide-bottom-safe-zone",
        "no-slide-overflow",
        "controls-no-overlap",
        "fullscreen-reflow",
        "modeless-notes-sync"
      ]
    });
  }

  async shouldRun({ options, detectedFeatures, page }) {
    if (options.allCdns || options.checkReveal || options.cdnReveal || options.checkPresentation) {
      return true;
    }
    if (options.cdns?.includes("reveal") || options.cdns?.includes("presentation")) {
      return true;
    }
    if (detectedFeatures && typeof detectedFeatures.hasReveal === "boolean") {
      return detectedFeatures.hasReveal;
    }
    return await page.evaluate(() => Boolean(document.querySelector(".reveal .slides section, #presentation-deck")));
  }

  async run({ page }) {
    const errors = [];
    const messages = [];
    const originalViewport = page.viewportSize();

    try {
      if (!originalViewport || originalViewport.width < 1280) {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.waitForTimeout(150);
      }

      await page.waitForFunction(
        () => Boolean(document.querySelector(".reveal .slides section.present")),
        null,
        { timeout: 5000 }
      ).catch(() => {});

      const layoutReport = await page.evaluate(() => {
        const deck = document.querySelector(".reveal");
        if (!deck) return { found: false };

        const allPresent = Array.from(deck.querySelectorAll(".slides section.present"));
        const leafSlide = allPresent.find((s) => !s.querySelector("section")) || deck.querySelector(".slides > section");
        if (!leafSlide) return { found: true, hasSlide: false };

        const cs = getComputedStyle(leafSlide);
        const padLeft = parseFloat(cs.paddingLeft) || 0;
        const padRight = parseFloat(cs.paddingRight) || 0;
        const padBottom = parseFloat(cs.paddingBottom) || 0;
        const scrollHeight = leafSlide.scrollHeight;
        const clientHeight = leafSlide.clientHeight;

        const overlapTargets = [];
        for (const sel of [".reveal .controls", ".reveal .slide-number"]) {
          const ctrl = deck.querySelector(sel.replace(".reveal ", ""));
          if (ctrl && getComputedStyle(ctrl).display !== "none" && ctrl.offsetParent !== null) {
            const r = ctrl.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              overlapTargets.push({ selector: sel, rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } });
            }
          }
        }

        const body = leafSlide.querySelector(".slide-body");
        const contentEls = body
          ? Array.from(body.children)
          : Array.from(leafSlide.children).filter((el) => !el.matches("aside.notes"));

        const overlaps = [];
        for (const el of contentEls) {
          const er = el.getBoundingClientRect();
          if (er.width === 0 || er.height === 0) continue;
          for (const target of overlapTargets) {
            const tr = target.rect;
            const ix = Math.max(0, Math.min(er.right, tr.right) - Math.max(er.left, tr.left));
            const iy = Math.max(0, Math.min(er.bottom, tr.bottom) - Math.max(er.top, tr.top));
            if (ix > 4 && iy > 4) {
              overlaps.push(`${el.tagName.toLowerCase()} overlaps ${target.selector} (${Math.round(ix)}x${Math.round(iy)}px)`);
            }
          }
        }

        return {
          found: true,
          hasSlide: true,
          padLeft,
          padRight,
          padBottom,
          scrollHeight,
          clientHeight,
          overlaps
        };
      });

      if (!layoutReport.found || !layoutReport.hasSlide) {
        errors.push("Reveal.js deck detected or requested, but no active <section> slide rendered.");
      } else {
        if (layoutReport.padLeft < 24 || layoutReport.padRight < 24) {
          errors.push(`Reveal slide horizontal padding too tight: left=${layoutReport.padLeft}px, right=${layoutReport.padRight}px (expected >= 24px).`);
        }
        if (layoutReport.padBottom < 52) {
          errors.push(`Reveal slide bottom safe-zone padding too small: ${layoutReport.padBottom}px (expected >= 52px).`);
        }
        if (layoutReport.scrollHeight > layoutReport.clientHeight + 2) {
          errors.push(`Reveal active slide overflows vertically: scrollHeight=${layoutReport.scrollHeight}px > clientHeight=${layoutReport.clientHeight}px.`);
        }
        if (layoutReport.overlaps.length > 0) {
          errors.push(`Reveal slide content overlaps navigation chrome: ${layoutReport.overlaps.join("; ")}`);
        }
        messages.push(`Reveal slide padding L/R=${Math.round(layoutReport.padLeft)}/${Math.round(layoutReport.padRight)}px, bottom=${Math.round(layoutReport.padBottom)}px, height=${layoutReport.scrollHeight}/${layoutReport.clientHeight}px.`);
      }

      const shellState = await page.evaluate(() => ({
        hasShell: Boolean(document.getElementById("presentation-shell")),
        hasFullscreenBtn: Boolean(document.getElementById("presentation-fullscreen-btn")),
        hasNotesBtn: Boolean(document.getElementById("presentation-notes-btn")),
        hasNotesModal: Boolean(document.getElementById("presentation-notes-modal")),
        totalSlides: document.querySelectorAll(".reveal .slides section").length
      }));

      if (shellState.hasShell && shellState.hasFullscreenBtn) {
        await page.click("#presentation-fullscreen-btn");
        await page.waitForTimeout(200);
        const fsCheck = await page.evaluate(() => {
          const shell = document.getElementById("presentation-shell");
          const hud = document.getElementById("presentation-fullscreen-hud");
          const active = Boolean(document.fullscreenElement === shell || shell?.classList.contains("is-fullscreen"));
          const hudVisible = hud ? getComputedStyle(hud).display !== "none" : false;
          return { active, hudVisible };
        });
        if (!fsCheck.active) {
          errors.push("Clicking #presentation-fullscreen-btn failed to activate Fullscreen mode on #presentation-shell.");
        } else if (!fsCheck.hudVisible) {
          errors.push("Fullscreen HUD (#presentation-fullscreen-hud) is not visible in Fullscreen mode.");
        } else {
          messages.push("Reveal fullscreen mode and HUD activated cleanly.");
        }
        await page.keyboard.press("Escape");
        await page.evaluate(() => {
          if (document.fullscreenElement && document.exitFullscreen) {
            return document.exitFullscreen().catch(() => {});
          }
          const shell = document.getElementById("presentation-shell");
          if (shell && shell.classList.contains("is-fullscreen")) {
            document.getElementById("presentation-fullscreen-btn")?.click();
          }
        });
        await page.waitForTimeout(150);
      }

      if (shellState.hasShell && shellState.hasNotesBtn && shellState.hasNotesModal) {
        await page.click("#presentation-notes-btn");
        await page.waitForTimeout(150);
        const notesOpen = await page.evaluate(() => {
          const modal = document.getElementById("presentation-notes-modal");
          const badge = document.getElementById("presentation-notes-badge")?.textContent?.trim() || "";
          const title = document.getElementById("presentation-notes-title")?.textContent?.trim() || "";
          const body = document.getElementById("presentation-notes-body")?.textContent?.trim() || "";
          const ariaModal = modal?.getAttribute("aria-modal");
          return { visible: Boolean(modal && !modal.classList.contains("hidden")), ariaModal, counter: `${badge}:${title}`, body };
        });

        if (!notesOpen.visible) {
          errors.push("Clicking #presentation-notes-btn did not open #presentation-notes-modal.");
        } else if (notesOpen.ariaModal !== "false") {
          errors.push(`Speaker notes modal must be modeless (aria-modal="false"), found "${notesOpen.ariaModal}".`);
        }

        if (shellState.totalSlides > 1 && notesOpen.visible) {
          await page.evaluate(() => {
            const inst = window.revealInstance || window.Reveal;
            if (inst && typeof inst.next === "function") {
              inst.next();
            }
          });
          await page.waitForTimeout(150);
          const notesAfterNav = await page.evaluate(() => {
            const modal = document.getElementById("presentation-notes-modal");
            const badge = document.getElementById("presentation-notes-badge")?.textContent?.trim() || "";
            const title = document.getElementById("presentation-notes-title")?.textContent?.trim() || "";
            const body = document.getElementById("presentation-notes-body")?.textContent?.trim() || "";
            return { visible: Boolean(modal && !modal.classList.contains("hidden")), counter: `${badge}:${title}`, body };
          });
          if (!notesAfterNav.visible) {
            errors.push("Speaker notes modal closed unexpectedly after slide navigation.");
          } else if (notesAfterNav.counter === notesOpen.counter) {
            errors.push(`Speaker notes slide indicator did not update on slide change (remained "${notesAfterNav.counter}").`);
          } else {
            messages.push(`Modeless speaker notes remained open and synced (${notesOpen.counter} -> ${notesAfterNav.counter}).`);
          }
          await page.evaluate(() => {
            const inst = window.revealInstance || window.Reveal;
            if (inst && typeof inst.slide === "function") {
              inst.slide(0, 0);
            }
          });
        }

        await page.evaluate(() => {
          const modal = document.getElementById("presentation-notes-modal");
          if (modal && !modal.classList.contains("hidden")) {
            document.getElementById("presentation-notes-close-btn")?.click();
          }
        });
      }
    } finally {
      if (originalViewport) {
        await page.setViewportSize(originalViewport).catch(() => {});
      }
    }

    return {
      id: this.id,
      name: this.name,
      status: errors.length > 0 ? "failed" : "passed",
      errors,
      styleguide: { compliant: errors.length === 0, rulesChecked: this.styleguideRules },
      messages
    };
  }
}
