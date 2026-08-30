import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// Set the base URL for Cesium (relative so it works under a GitHub Pages subpath too)
window.CESIUM_BASE_URL = './Cesium';

// Fill in once you've created a Sentinel Hub / Copernicus Data Space configuration:
// - instanceId: the configuration ID from your Sentinel Hub dashboard
// - layerName: the Layer ID you set up inside that configuration (e.g. "TRUE-COLOR")
// Until instanceId is set, the Sentinel Hub option is disabled in the source pickers.
const SENTINEL_HUB_CONFIG = {
  instanceId: '',
  layerName: '1281609a-89fc-4e57-9d32-dd574090c591'
};

// Every source shares the same {Time}/{TileMatrix}/{TileRow}/{TileCol} URL-template
// shape, so a side just needs to know which endpoint/layer/zoom range to plug in.
const IMAGERY_SOURCES = {
  viirs: {
    label: 'VIIRS (NASA, daily)',
    minDate: '2016-01-01',
    build(dateStr) {
      return buildGibsProvider('VIIRS_SNPP_CorrectedReflectance_TrueColor', dateStr, 9, 'NASA GIBS / VIIRS');
    }
  },
  modisTerra: {
    label: 'MODIS Terra (NASA, daily)',
    minDate: '2000-03-01',
    build(dateStr) {
      return buildGibsProvider('MODIS_Terra_CorrectedReflectance_TrueColor', dateStr, 9, 'NASA GIBS / MODIS Terra');
    }
  },
  modisAqua: {
    label: 'MODIS Aqua (NASA, daily)',
    minDate: '2002-07-01',
    build(dateStr) {
      return buildGibsProvider('MODIS_Aqua_CorrectedReflectance_TrueColor', dateStr, 9, 'NASA GIBS / MODIS Aqua');
    }
  },
  sentinel2: {
    label: SENTINEL_HUB_CONFIG.instanceId
      ? 'Sentinel-2 L2A (Sentinel Hub, ~10m)'
      : 'Sentinel-2 L2A (needs setup, see code)',
    minDate: '2015-06-23',
    disabled: !SENTINEL_HUB_CONFIG.instanceId,
    build(dateStr) {
      return buildSentinelHubProvider(dateStr);
    }
  }
};

function formatDateISO(date) {
  return date.toISOString().split('T')[0];
}

// GIBS imagery lags behind real time, so "today" usually has no data yet.
function latestAllowedDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function buildGibsProvider(layerName, dateStr, maxLevel, creditText) {
  return new Cesium.UrlTemplateImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?' +
      'SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
      '&LAYER=' + layerName +
      '&STYLE=default' +
      '&TIME=' + dateStr +
      '&TILEMATRIXSET=GoogleMapsCompatible_Level' + maxLevel +
      '&TILEMATRIX={TileMatrix}' +
      '&TILEROW={TileRow}' +
      '&TILECOL={TileCol}' +
      '&FORMAT=image%2Fjpeg',
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    minimumLevel: 0,
    maximumLevel: maxLevel,
    tileWidth: 256,
    tileHeight: 256,
    customTags: {
      TileMatrix: (provider, x, y, level) => level,
      TileRow: (provider, x, y, level) => y,
      TileCol: (provider, x, y, level) => x
    },
    credit: new Cesium.Credit(creditText)
  });
}

// Best-effort: Sentinel Hub / Copernicus Data Space WMTS. Exact tile matrix set name
// depends on your configuration -- check the GetCapabilities response for your
// instance (https://sh.dataspace.copernicus.eu/ogc/wmts/<instanceId>?SERVICE=WMTS&REQUEST=GetCapabilities)
// and adjust TILEMATRIXSET below if tiles don't load.
function buildSentinelHubProvider(dateStr) {
  const { instanceId, layerName } = SENTINEL_HUB_CONFIG;
  return new Cesium.UrlTemplateImageryProvider({
    url: `https://sh.dataspace.copernicus.eu/ogc/wmts/${instanceId}?` +
      'SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
      '&LAYER=' + layerName +
      '&STYLE=default' +
      '&TIME=' + dateStr +
      '&TILEMATRIXSET=PopularWebMercator256' +
      '&TILEMATRIX={TileMatrix}' +
      '&TILEROW={TileRow}' +
      '&TILECOL={TileCol}' +
      '&FORMAT=image%2Fpng',
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    minimumLevel: 0,
    maximumLevel: 16,
    tileWidth: 256,
    tileHeight: 256,
    customTags: {
      TileMatrix: (provider, x, y, level) => level,
      TileRow: (provider, x, y, level) => y,
      TileCol: (provider, x, y, level) => x
    },
    credit: new Cesium.Credit('Copernicus Sentinel data / Sentinel Hub')
  });
}

document.addEventListener('DOMContentLoaded', function() {
  const viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: null,
    infoBox: false,
    selectionIndicator: false,
    sceneMode: Cesium.SceneMode.SCENE3D,
    // Without an explicit base layer, Cesium falls back to its default Bing/Ion
    // "World Imagery", which needs an Ion access token and rides on a shared,
    // heavily rate-limited demo token if you don't set one -- tiles start failing
    // as soon as you zoom in and the globe goes solid blue. OpenStreetMap tiles
    // need no token and aren't subject to that shared quota.
    baseLayer: new Cesium.ImageryLayer(new Cesium.OpenStreetMapImageryProvider({
      url: 'https://tile.openstreetmap.org/'
    })),
    // This is a focused comparison tool, not a general GIS app -- strip every
    // default Cesium widget so the small custom UI has the screen to itself.
    baseLayerPicker: false,
    animation: false,
    timeline: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false
  });

  // Remove the Cesium ion logo if it exists
  if (viewer.cesiumWidget.creditContainer.lastChild) {
    try {
      viewer.cesiumWidget.creditContainer.removeChild(viewer.cesiumWidget.creditContainer.lastChild);
    } catch (e) {
      console.warn('Failed to remove Cesium ion logo:', e);
    }
  }

  // Keep the credit container visible (but styled out of the way): both NASA GIBS
  // and OpenStreetMap require attribution to stay on screen, so it can't be hidden.
  viewer.cesiumWidget.creditContainer.style.fontSize = '10px';
  viewer.cesiumWidget.creditContainer.style.opacity = '0.7';

  viewer.scene.globe.enableLighting = true;
  viewer.scene.globe.showGroundAtmosphere = true;
  viewer.scene.skyAtmosphere.show = true;

  const maxDateStr = formatDateISO(latestAllowedDate());

  const sideEls = {
    a: {
      select: document.getElementById('sourceA'),
      date: document.getElementById('dateA'),
      label: document.getElementById('sideLabelA'),
      splitDirection: Cesium.SplitDirection.LEFT,
      layer: null
    },
    b: {
      select: document.getElementById('sourceB'),
      date: document.getElementById('dateB'),
      label: document.getElementById('sideLabelB'),
      splitDirection: Cesium.SplitDirection.RIGHT,
      layer: null
    }
  };

  // Populate both source pickers from the shared catalog
  Object.values(sideEls).forEach(({ select }) => {
    Object.entries(IMAGERY_SOURCES).forEach(([id, source]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = source.label;
      option.disabled = !!source.disabled;
      select.appendChild(option);
    });
  });

  function rebuildSide(side) {
    const { select, date, label, splitDirection } = sideEls[side];
    const source = IMAGERY_SOURCES[select.value];
    date.min = source.minDate;
    date.max = maxDateStr;
    if (!date.value || date.value < date.min || date.value > date.max) {
      date.value = date.max;
    }

    const oldLayer = sideEls[side].layer;
    const newLayer = new Cesium.ImageryLayer(source.build(date.value));
    newLayer.splitDirection = splitDirection;
    viewer.imageryLayers.add(newLayer);
    sideEls[side].layer = newLayer;
    if (oldLayer) {
      viewer.imageryLayers.remove(oldLayer);
    }

    label.textContent = `${side.toUpperCase()} · ${source.label.split(' (')[0]} · ${date.value}`;
  }

  // Default comparison: yesterday vs. the same date one year earlier
  const defaultDateB = new Date(latestAllowedDate());
  defaultDateB.setUTCFullYear(defaultDateB.getUTCFullYear() - 1);

  sideEls.a.select.value = 'viirs';
  sideEls.a.date.value = maxDateStr;
  sideEls.b.select.value = 'viirs';
  sideEls.b.date.value = formatDateISO(defaultDateB);

  rebuildSide('a');
  rebuildSide('b');

  Object.entries(sideEls).forEach(([side, { select, date }]) => {
    select.addEventListener('change', () => rebuildSide(side));
    date.addEventListener('change', () => rebuildSide(side));
  });

  // --- Split-screen compare: drag the handle to swipe, tap Flick to snap A/B ---
  viewer.scene.splitPosition = 0.5;

  const splitHandle = document.getElementById('splitHandle');
  const flickButton = document.getElementById('flickButton');
  let flickTarget = 0; // next full-reveal target when Flick is tapped

  function setSplitPosition(fraction) {
    const clamped = Cesium.Math.clamp(fraction, 0, 1);
    viewer.scene.splitPosition = clamped;
    splitHandle.style.left = `${clamped * 100}%`;
  }

  setSplitPosition(0.5);

  let dragging = false;
  splitHandle.addEventListener('pointerdown', (event) => {
    dragging = true;
    splitHandle.setPointerCapture(event.pointerId);
  });
  splitHandle.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const rect = viewer.container.getBoundingClientRect();
    setSplitPosition((event.clientX - rect.left) / rect.width);
  });
  splitHandle.addEventListener('pointerup', () => {
    dragging = false;
  });
  splitHandle.addEventListener('pointercancel', () => {
    dragging = false;
  });

  function animateSplitTo(target, durationMs = 350) {
    const start = viewer.scene.splitPosition;
    const startTime = performance.now();
    function step(now) {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setSplitPosition(start + (target - start) * eased);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  flickButton.addEventListener('click', () => {
    animateSplitTo(flickTarget);
    flickTarget = flickTarget === 0 ? 1 : 0;
  });
});
