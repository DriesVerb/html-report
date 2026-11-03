import { VerificationCheck } from "../../registry.mjs";

export class LeafletCheck extends VerificationCheck {
  constructor() {
    super({
      id: "cdn:leaflet",
      name: "Leaflet Panes & Tile Provider Styleguide",
      category: "cdn",
      cliFlags: ["--check-maps", "--check-leaflet", "--cdn-leaflet"],
      styleguideRules: ["map-panes-loaded", "tiles-loaded", "no-403-errors"]
    });
  }

  async shouldRun({ options, detectedFeatures, page }) {
    if (options.allCdns || options.checkMaps || options.checkLeaflet || options.cdnLeaflet) return true;
    if (options.cdns?.includes("leaflet") || options.cdns?.includes("maps")) return true;
    if (detectedFeatures) return Boolean(detectedFeatures.hasLeaflet);
    return await page.evaluate(() => Boolean(document.querySelector("#datacenterMap, #map, .leaflet-container")));
  }

  async run({ page, sharedState }) {
    const errors = [];
    const check = await page.evaluate(() => {
      const container = document.querySelector("#datacenterMap, #map, .leaflet-container");
      if (!container) return { hasLeaflet: false };

      const paneCount = document.querySelectorAll(".leaflet-pane").length;
      const tiles = Array.from(document.querySelectorAll(".leaflet-tile"));
      const tileUrls = tiles.map((img) => img.src);
      const loadedTileCount = tiles.filter((img) => img.complete && img.naturalWidth > 0).length;
      const usesBlockedTileServer = tileUrls.some(
        (u) => u.includes("tile.openstreetmap.org") || u.includes("basemaps.cartocdn.com")
      );

      return { hasLeaflet: true, paneCount, loadedTileCount, usesBlockedTileServer };
    });

    if (!check.hasLeaflet) {
      errors.push("Target CDN check maps requested, but no Leaflet container found.");
    } else {
      if (check.paneCount < 1 || check.loadedTileCount < 1) {
        errors.push("Leaflet map detected but failed to load map tiles.");
      }
      const failedResponses = sharedState?.failedTileResponses || [];
      if (check.usesBlockedTileServer || failedResponses.length > 0) {
        errors.push(`Leaflet map had 403 tile responses: ${failedResponses.join(", ")}`);
      }
    }

    return {
      id: this.id,
      name: this.name,
      status: errors.length > 0 ? "failed" : "passed",
      errors,
      styleguide: { compliant: errors.length === 0, rulesChecked: this.styleguideRules },
      messages: errors.length === 0 ? [`Leaflet: Map loaded with ${check.loadedTileCount} tile(s) and 0 403 errors.`] : []
    };
  }
}
