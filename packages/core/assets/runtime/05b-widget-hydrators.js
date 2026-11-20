/**
 * Declarative Widget Auto-Hydrators (05b-widget-hydrators.js)
 * Zero-JS declarative hydration for Chart.js (data-chart), Grid.js (data-gridjs),
 * and Leaflet (data-leaflet) with Esri ArcGIS file://-safe tiles and DaisyUI 32-theme sync.
 */

const ESRI_WORLD_STREET_MAP_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

/**
 * Parses JSON configuration from an inline data-* attribute or a referenced <script type="application/json"> element.
 */
function _parseDeclarativeWidgetConfig(el, inlineAttr, sourceAttr) {
  if (!el || typeof el.getAttribute !== "function") return null;
  let raw = "";
  const srcSelector = el.getAttribute(sourceAttr);
  if (srcSelector && typeof document !== "undefined") {
    let srcEl = typeof document.querySelector === "function" ? document.querySelector(srcSelector) : null;
    if (!srcEl && srcSelector.startsWith("#") && typeof document.getElementById === "function") {
      srcEl = document.getElementById(srcSelector.slice(1));
    }
    if (srcEl) {
      raw = srcEl.value !== undefined ? String(srcEl.value) : String(srcEl.textContent || "");
    }
  }
  if (!raw) {
    raw = String(el.getAttribute(inlineAttr) || "");
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (err) {
    console.warn(`[html-report] Invalid JSON in ${inlineAttr || sourceAttr}:`, err);
    return null;
  }
}

/**
 * Declarative Chart.js auto-hydrator for <canvas data-chart='{...}'> and <canvas data-chart-source="#...">.
 * Automatically applies active DaisyUI theme palette colors when omitted and registers charts in window.reportCharts.
 */
function initDeclarativeCharts(retries = 25) {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return [];
  }
  const canvases = document.querySelectorAll("canvas[data-chart], canvas[data-chart-source]");
  if (!canvases || !canvases.length) return [];

  if (!window.Chart) {
    if (retries > 0) {
      setTimeout(() => initDeclarativeCharts(retries - 1), 100);
    }
    return [];
  }

  window.reportCharts = Array.isArray(window.reportCharts) ? window.reportCharts : [];
  const palette = typeof resolveDaisyUIThemePalette === "function" ? resolveDaisyUIThemePalette() : {};
  const paletteSequence = ["primary", "secondary", "accent", "info", "success", "warning", "error", "neutral"];
  const fallbackColor = {
    hex: "#3b82f6",
    rgba: (a = 1) => `rgba(59, 130, 246, ${a})`
  };

  const created = [];

  canvases.forEach((canvas) => {
    if (!canvas) return;
    if (!canvas.dataset) canvas.dataset = {};
    if (canvas.dataset.chartInitialized === "true" || canvas.__initialized) return;
    if (typeof window.Chart.getChart === "function" && window.Chart.getChart(canvas)) {
      canvas.dataset.chartInitialized = "true";
      return;
    }

    const parsedConfig = _parseDeclarativeWidgetConfig(canvas, "data-chart", "data-chart-source");
    if (!parsedConfig) return;

    const config = {
      type: parsedConfig.type || "bar",
      data: parsedConfig.data && typeof parsedConfig.data === "object"
        ? parsedConfig.data
        : { labels: [], datasets: [] },
      options: parsedConfig.options && typeof parsedConfig.options === "object"
        ? parsedConfig.options
        : {}
    };
    if (parsedConfig.plugins) {
      config.plugins = parsedConfig.plugins;
    }

    if (Array.isArray(config.data.datasets)) {
      config.data.datasets.forEach((ds, dsIdx) => {
        if (!ds || typeof ds !== "object") return;
        const colorKey = paletteSequence[dsIdx % paletteSequence.length];
        const chosenEntry = palette[colorKey] || palette.primary || fallbackColor;
        const chartType = String(ds.type || config.type || "bar").toLowerCase();
        const isMultiSlice = chartType === "pie" || chartType === "doughnut" || chartType === "polararea";

        if (!ds.borderColor) {
          if (isMultiSlice && Array.isArray(ds.data)) {
            ds.borderColor = ds.data.map((_, i) => {
              const entry = palette[paletteSequence[i % paletteSequence.length]] || chosenEntry;
              return entry.hex || fallbackColor.hex;
            });
          } else {
            ds.borderColor = chosenEntry.hex || fallbackColor.hex;
          }
        }

        if (!ds.backgroundColor) {
          if (isMultiSlice && Array.isArray(ds.data)) {
            ds.backgroundColor = ds.data.map((_, i) => {
              const entry = palette[paletteSequence[i % paletteSequence.length]] || chosenEntry;
              return typeof entry.rgba === "function" ? entry.rgba(0.78) : (entry.hex || fallbackColor.hex);
            });
          } else if (chartType === "line" || chartType === "radar") {
            ds.backgroundColor = typeof chosenEntry.rgba === "function"
              ? chosenEntry.rgba(0.2)
              : fallbackColor.rgba(0.2);
          } else {
            ds.backgroundColor = typeof chosenEntry.rgba === "function"
              ? chosenEntry.rgba(0.78)
              : (chosenEntry.hex || fallbackColor.hex);
          }
        }

        if (ds.borderWidth === undefined) {
          ds.borderWidth = chartType === "line" ? 2 : 1.5;
        }
        if (chartType === "bar" && ds.borderRadius === undefined) {
          ds.borderRadius = 6;
        }
      });
    }

    if (config.options.responsive === undefined) {
      config.options.responsive = true;
    }
    if (config.options.maintainAspectRatio === undefined) {
      config.options.maintainAspectRatio = false;
    }

    const baseChartType = String(config.type || "bar").toLowerCase();
    const isRadialOrPie =
      baseChartType === "pie" ||
      baseChartType === "doughnut" ||
      baseChartType === "polararea" ||
      baseChartType === "radar";

    const textHex = palette.content && palette.content.hex ? palette.content.hex : "#64748b";
    const gridColor = palette.content && typeof palette.content.rgba === "function"
      ? palette.content.rgba(0.15)
      : "rgba(148, 163, 184, 0.2)";

    if (!isRadialOrPie && !config.options.scales) {
      config.options.scales = {
        x: { ticks: { color: textHex }, grid: { color: gridColor } },
        y: { beginAtZero: true, ticks: { color: textHex }, grid: { color: gridColor } }
      };
    } else if (config.options.scales && typeof config.options.scales === "object") {
      for (const scale of Object.values(config.options.scales)) {
        if (!scale || typeof scale !== "object") continue;
        scale.ticks = scale.ticks && typeof scale.ticks === "object" ? scale.ticks : {};
        if (!scale.ticks.color) scale.ticks.color = textHex;
        scale.grid = scale.grid && typeof scale.grid === "object" ? scale.grid : {};
        if (!scale.grid.color) scale.grid.color = gridColor;
      }
    }

    config.options.plugins = config.options.plugins && typeof config.options.plugins === "object"
      ? config.options.plugins
      : {};
    config.options.plugins.legend = config.options.plugins.legend && typeof config.options.plugins.legend === "object"
      ? config.options.plugins.legend
      : {};
    const isPieOrDoughnut = baseChartType === "pie" || baseChartType === "doughnut" || baseChartType === "polararea";
    const labelCount = Array.isArray(config.data.labels) ? config.data.labels.length : 0;
    if (isPieOrDoughnut && labelCount > 4 && config.options.plugins.legend.position === undefined) {
      config.options.plugins.legend.position = "bottom";
    }
    config.options.plugins.legend.labels =
      config.options.plugins.legend.labels && typeof config.options.plugins.legend.labels === "object"
        ? config.options.plugins.legend.labels
        : {};
    if (!config.options.plugins.legend.labels.color) {
      config.options.plugins.legend.labels.color = textHex;
    }
    if (isPieOrDoughnut && labelCount > 4) {
      if (config.options.plugins.legend.labels.boxWidth === undefined) {
        config.options.plugins.legend.labels.boxWidth = 10;
      }
      if (config.options.plugins.legend.labels.padding === undefined) {
        config.options.plugins.legend.labels.padding = 8;
      }
    }

    try {
      const ctxOrCanvas = typeof canvas.getContext === "function" ? (canvas.getContext("2d") || canvas) : canvas;
      const chart = new window.Chart(ctxOrCanvas, config);
      canvas.dataset.chartInitialized = "true";
      canvas.__initialized = true;
      if (!window.reportCharts.includes(chart)) {
        window.reportCharts.push(chart);
      }
      created.push(chart);
    } catch (err) {
      console.warn("[html-report] Declarative Chart.js initialization notice:", err);
    }
  });

  return created;
}

/**
 * Declarative Grid.js auto-hydrator for [data-gridjs] and [data-gridjs-source].
 * Defaults to { search: true, sort: true, pagination: { limit: 10 } } when omitted.
 */
function initDeclarativeGridjs(retries = 25) {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return [];
  }
  const gridEls = document.querySelectorAll("[data-gridjs], [data-gridjs-source]");
  if (!gridEls || !gridEls.length) return [];

  if (!window.gridjs || typeof window.gridjs.Grid !== "function") {
    if (retries > 0) {
      setTimeout(() => initDeclarativeGridjs(retries - 1), 100);
    }
    return [];
  }

  window.reportGrids = Array.isArray(window.reportGrids) ? window.reportGrids : [];
  const created = [];

  gridEls.forEach((el) => {
    if (!el || el.tagName === "STYLE" || (typeof el.closest === "function" && el.closest("head"))) return;
    if (!el.dataset) el.dataset = {};
    if (el.dataset.gridjsInitialized === "true") return;
    if (typeof el.querySelector === "function" && el.querySelector(".gridjs-container")) {
      el.dataset.gridjsInitialized = "true";
      return;
    }

    const parsedConfig = _parseDeclarativeWidgetConfig(el, "data-gridjs", "data-gridjs-source");
    if (!parsedConfig) return;

    const paginationConfig =
      parsedConfig.pagination === undefined
        ? { limit: 10 }
        : (parsedConfig.pagination && typeof parsedConfig.pagination === "object"
            ? { limit: 10, ...parsedConfig.pagination }
            : parsedConfig.pagination);

    const gridConfig = {
      search: true,
      sort: true,
      ...parsedConfig,
      pagination: paginationConfig
    };

    try {
      if (el.innerHTML !== undefined) el.innerHTML = "";
      const grid = new window.gridjs.Grid(gridConfig);
      grid.render(el);
      el.dataset.gridjsInitialized = "true";
      window.reportGrids.push(grid);
      created.push(grid);
    } catch (err) {
      console.warn("[html-report] Declarative Grid.js initialization notice:", err);
    }
  });

  return created;
}

/**
 * Declarative Leaflet auto-hydrator for [data-leaflet] and [data-leaflet-source].
 * Automatically binds Esri ArcGIS World Street Map tiles (file:// safe, zero 403 errors).
 */
function initDeclarativeLeaflet(retries = 25) {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return [];
  }
  const mapEls = document.querySelectorAll("[data-leaflet], [data-leaflet-source]");
  if (!mapEls || !mapEls.length) return [];

  if (!window.L || typeof window.L.map !== "function") {
    if (retries > 0) {
      setTimeout(() => initDeclarativeLeaflet(retries - 1), 100);
    }
    return [];
  }

  window.reportMaps = Array.isArray(window.reportMaps) ? window.reportMaps : [];
  const created = [];

  mapEls.forEach((el) => {
    if (!el || el.tagName === "STYLE" || (typeof el.closest === "function" && el.closest("head"))) return;
    if (!el.dataset) el.dataset = {};
    if (el.dataset.leafletInitialized === "true" || el._leaflet_id) {
      el.dataset.leafletInitialized = "true";
      return;
    }

    const parsedConfig = _parseDeclarativeWidgetConfig(el, "data-leaflet", "data-leaflet-source");
    if (!parsedConfig) return;

    const center = Array.isArray(parsedConfig.center) && parsedConfig.center.length >= 2
      ? [Number(parsedConfig.center[0]), Number(parsedConfig.center[1])]
      : [51.505, -0.09];
    const zoom = Number.isFinite(Number(parsedConfig.zoom)) ? Number(parsedConfig.zoom) : 12;
    const tileUrl = parsedConfig.tileUrl || ESRI_WORLD_STREET_MAP_TILES;
    const attribution = parsedConfig.attribution !== undefined ? parsedConfig.attribution : "Tiles &copy; Esri";

    try {
      const mapInstance = window.L.map(el, parsedConfig.mapOptions || {});
      const map = (mapInstance && typeof mapInstance.setView === "function")
        ? (mapInstance.setView(center, zoom) || mapInstance)
        : mapInstance;

      if (typeof window.L.tileLayer === "function") {
        const layer = window.L.tileLayer(tileUrl, {
          attribution,
          maxZoom: parsedConfig.maxZoom || 19
        });
        if (layer && typeof layer.addTo === "function") {
          layer.addTo(map);
        }
      }

      if (Array.isArray(parsedConfig.markers) && typeof window.L.marker === "function") {
        parsedConfig.markers.forEach((m) => {
          if (!m) return;
          const lat = Array.isArray(m) ? m[0] : m.lat;
          const lng = Array.isArray(m) ? m[1] : (m.lng !== undefined ? m.lng : m.lon);
          const popupText = Array.isArray(m) ? m[2] : (m.popup ?? m.label ?? m.title);
          if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return;
          let marker = window.L.marker([Number(lat), Number(lng)]);
          if (marker && typeof marker.addTo === "function") {
            marker = marker.addTo(map) || marker;
          }
          if (popupText && marker && typeof marker.bindPopup === "function") {
            marker.bindPopup(String(popupText));
          }
        });
      }

      el.dataset.leafletInitialized = "true";
      window.reportMaps.push(map);
      created.push(map);

      if (map && typeof map.invalidateSize === "function") {
        setTimeout(() => {
          try { map.invalidateSize(); } catch (_) {}
        }, 100);
      }
    } catch (err) {
      console.warn("[html-report] Declarative Leaflet initialization notice:", err);
    }
  });

  return created;
}
