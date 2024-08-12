import * as Cesium from 'cesium';
import * as Astronomy from 'astronomy-engine';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// Set the base URL for Cesium
window.CESIUM_BASE_URL = '/Cesium';

document.addEventListener('DOMContentLoaded', async function() {
  const viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: null,
    infoBox: false,
    sceneMode: Cesium.SceneMode.SCENE3D,
    shadows: true,
    shouldAnimate: true
  });

  // Remove the Cesium ion logo if it exists
  if (viewer.cesiumWidget.creditContainer.lastChild) {
    try {
      viewer.cesiumWidget.creditContainer.removeChild(viewer.cesiumWidget.creditContainer.lastChild);
    } catch (e) {
      console.warn("Failed to remove Cesium ion logo:", e);
    }
  }

  // Initialize the LayerManager
  class LayerManager {
    constructor(viewer) {
      this.viewer = viewer;
      this.layers = new Map();
    }

    addLayer(name, imageryProvider, alpha = 1.0) {
      if (this.layers.has(name)) {
        console.warn(`Layer "${name}" already exists. Use updateLayer to modify it.`);
        return;
      }
      const layer = this.viewer.imageryLayers.addImageryProvider(imageryProvider);
      layer.alpha = alpha;
      this.layers.set(name, layer);
      return layer;
    }

    removeLayer(name) {
      const layer = this.layers.get(name);
      if (layer) {
        this.viewer.imageryLayers.remove(layer);
        this.layers.delete(name);
      }
    }

    updateLayerAlpha(name, alpha) {
      const layer = this.layers.get(name);
      if (layer) {
        layer.alpha = alpha;
      }
    }

    toggleLayer(name, visible) {
      const layer = this.layers.get(name);
      if (layer) {
        layer.show = visible;
      }
    }
  }

  const layerManager = new LayerManager(viewer);

   // Function to format date for GIBS URL
   function formatDateForGIBS(date) {
    if (!(date instanceof Date)) {
        console.error('Invalid date:', date);
        return '';
    }
    return date.toISOString().split('T')[0];
}

async function getMostRecentDate(layerName) {
  const baseUrl = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml';

  let now = new Date();
  let maxRetries = 48; // Retry for up to 48 hours back

  if (layerName === 'VIIRS_SNPP_CorrectedReflectance_TrueColor') {
      // Set date to 1 day ago
      now.setUTCDate(now.getUTCDate() - 1);
      now.setUTCHours(0, 0, 0, 0);
      return now;
  }

  while (maxRetries > 0) {
      try {
          const response = await fetch(baseUrl);
          const text = await response.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, "text/xml");
          const layers = xmlDoc.getElementsByTagName("Layer");
          for (let layer of layers) {
              if (layer.getElementsByTagName("ows:Identifier")[0].textContent === layerName) {
                  const dimension = layer.getElementsByTagName("Dimension")[0];
                  const values = dimension.textContent.split('/');
                  const endTime = values[1];
                  const recentDate = new Date(endTime.split('T')[0]);
                  if (recentDate <= now) {
                      return recentDate;
                  }
              }
          }
      } catch (error) {
          console.error('Error fetching most recent date:', error);
      }

      // Step back an hour and retry
      now.setHours(now.getHours() - 1);
      maxRetries--;
  }

  // Fallback to 2 days ago if the query fails completely
  now = new Date();
  now.setUTCDate(now.getUTCDate() - 2);
  now.setUTCHours(0, 0, 0, 0);
  return now;
}


function createCloudProvider(date, layerName = 'VIIRS_SNPP_CorrectedReflectance_TrueColor') {
    return new Cesium.UrlTemplateImageryProvider({
        url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?' +
             'SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
             '&LAYER=' + layerName +
             '&STYLE=default' +
             '&TIME={Time}' +
             '&TILEMATRIXSET=GoogleMapsCompatible_Level9' +
             '&TILEMATRIX={TileMatrix}' +
             '&TILEROW={TileRow}' +
             '&TILECOL={TileCol}' +
             '&FORMAT=image%2Fjpeg',
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        minimumLevel: 0,
        maximumLevel: 9,
        tileWidth: 256,
        tileHeight: 256,
        customTags: {
            Time: function() {
                return formatDateForGIBS(date);
            },
            TileMatrix: function(imageryProvider, x, y, level) {
                return level;
            },
            TileRow: function(imageryProvider, x, y, level) {
                return y;
            },
            TileCol: function(imageryProvider, x, y, level) {
                return x;
            }
        },
        credit: new Cesium.Credit('NASA Global Imagery Browse Services for EOSDIS')
    });
}

// Get the initial date and create the initial cloud provider
let currentDate = new Date(await getMostRecentDate());
let currentLayer = 'VIIRS_SNPP_CorrectedReflectance_TrueColor';
let cloudProvider = createCloudProvider(currentDate, currentLayer);

// Add the cloud layer to the layer manager
let cloudLayer = layerManager.addLayer('clouds', cloudProvider, 1.0);

// Function to update the cloud layer
async function updateCloudLayer(layer) {
    currentDate = new Date(await getMostRecentDate());
    console.log('Updating cloud layer to:', layer, 'with date:', formatDateForGIBS(currentDate));

    // Create a new cloud provider with the updated layer and date
    const newCloudProvider = createCloudProvider(currentDate, layer);

    // Remove the old layer and add the new one
    layerManager.removeLayer('clouds');
    cloudLayer = layerManager.addLayer('clouds', newCloudProvider, 1.0);

    // Update the cloudProvider reference
    cloudProvider = newCloudProvider;
}

// Event listener for cloud layer picker
document.getElementById('cloudLayers').addEventListener('change', function() {
    currentLayer = this.value;
    updateCloudLayer(currentLayer);
});

// Update the cloud layer every 30 minutes
setInterval(() => updateCloudLayer(currentLayer), 30 * 60 * 1000);

// Immediately call updateCloudLayer to ensure we have a valid date
updateCloudLayer(currentLayer);

  // Universal layer fading function
  function calculateLayerOpacity(cameraHeight, fadeStartHeight, fadeEndHeight, baseOpacity = 1) {
    if (cameraHeight >= fadeStartHeight) return baseOpacity;
    if (cameraHeight <= fadeEndHeight) return 0.0;
    return baseOpacity * (cameraHeight - fadeEndHeight) / (fadeStartHeight - fadeEndHeight);
  }

  // Layer configurations
  const layerConfigs = {
    clouds: { fadeStartHeight: 1000000, fadeEndHeight: 0 },
    night: { fadeStartHeight: 500000, fadeEndHeight: 50000 }
  };

  // Custom layer for night side of the Earth
  const nightLayer = layerManager.addLayer('night', new Cesium.SingleTileImageryProvider({
    url: '/assets/night.jpg',
    tileWidth: 256,
    tileHeight: 256
  }), 0.0);

  // Function to calculate night layer opacity
  function calculateNightLayerOpacity(cameraPosition, sunPosition) {
    if (!cameraPosition || !sunPosition) return 0.0;

    const cameraVector = Cesium.Cartesian3.normalize(cameraPosition, new Cesium.Cartesian3());
    const sunVector = Cesium.Cartesian3.normalize(sunPosition, new Cesium.Cartesian3());
    const dot = Cesium.Cartesian3.dot(cameraVector, sunVector);

    const sunsetStart = 0.1;
    const sunsetEnd = -0.3;

    if (dot > sunsetStart) return 0.0;
    if (dot < sunsetEnd) return 0.7;
    return Cesium.Math.clamp((sunsetStart - dot) / (sunsetStart - sunsetEnd), 0.0, 0.5);
  }

  // Update layer opacities
  viewer.scene.preRender.addEventListener(() => {
    const cameraHeight = viewer.camera.positionCartographic.height;
    const cameraPosition = viewer.camera.positionWC;
    const sunPosition = viewer.scene.sun.position;

    Object.entries(layerConfigs).forEach(([layerName, config]) => {
      let baseOpacity = 1;
      if (layerName === 'night') {
        baseOpacity = calculateNightLayerOpacity(cameraPosition, sunPosition);
      }
      const opacity = calculateLayerOpacity(cameraHeight, config.fadeStartHeight, config.fadeEndHeight, baseOpacity);
      layerManager.updateLayerAlpha(layerName, opacity);
    });
  });

  // Add UI elements for adjusting fade heights
  const uiContainer = document.createElement('div');
  uiContainer.style.position = 'absolute';
  uiContainer.style.top = '50px';
  uiContainer.style.left = '10px';
  uiContainer.style.background = 'rgba(255, 255, 255, 0.8)';
  uiContainer.style.padding = '10px';
  uiContainer.style.borderRadius = '5px';

  Object.entries(layerConfigs).forEach(([layerName, config]) => {
    uiContainer.innerHTML += `
      <div>
        <h3>${layerName.charAt(0).toUpperCase() + layerName.slice(1)} Layer</h3>
        <label for="${layerName}FadeStart">Fade Start Height (km): </label>
        <input type="number" id="${layerName}FadeStart" value="${config.fadeStartHeight / 1000}" min="0" step="1000">
      </div>
      <div>
        <label for="${layerName}FadeEnd">Fade End Height (km): </label>
        <input type="number" id="${layerName}FadeEnd" value="${config.fadeEndHeight / 1000}" min="0" step="100">
      </div>
    `;
  });

  document.body.appendChild(uiContainer);

  // Add event listeners for the input fields
  Object.keys(layerConfigs).forEach(layerName => {
    document.getElementById(`${layerName}FadeStart`).addEventListener('change', (e) => {
      layerConfigs[layerName].fadeStartHeight = parseFloat(e.target.value) * 1000;
      viewer.scene.requestRender();
    });

    document.getElementById(`${layerName}FadeEnd`).addEventListener('change', (e) => {
      layerConfigs[layerName].fadeEndHeight = parseFloat(e.target.value) * 1000;
      viewer.scene.requestRender();
    });
  });

  // Toggle cloud layer visibility button
  const toggleCloudButton = document.createElement('button');
  toggleCloudButton.textContent = 'Toggle Cloud Layer';
  toggleCloudButton.style.position = 'absolute';
  toggleCloudButton.style.top = '10px';
  toggleCloudButton.style.left = '10px';
  document.body.appendChild(toggleCloudButton);

  toggleCloudButton.addEventListener('click', () => {
    const cloudLayer = layerManager.layers.get('clouds');
    if (cloudLayer) {
      cloudLayer.show = !cloudLayer.show;
      console.log('Cloud layer visibility:', cloudLayer.show);
    } else {
      console.error('Cloud layer not found');
    }
  });



  // If you want to remove all credits
  viewer.cesiumWidget.creditContainer.style.display = "none";

  // Enable the sun and sky atmosphere
  viewer.scene.globe.enableLighting = true;
  viewer.scene.globe.showGroundAtmosphere = true;
  viewer.scene.skyAtmosphere.show = true;

  // Create a custom InfoBox
  const infoBoxContainer = document.createElement('div');
  infoBoxContainer.className = 'cesium-infoBox';
  infoBoxContainer.style.display = 'none';
  viewer.container.appendChild(infoBoxContainer);

  const infoBoxContent = document.createElement('div');
  infoBoxContent.className = 'cesium-infoBox-content';
  infoBoxContainer.appendChild(infoBoxContent);

  // Custom function to show InfoBox
  function showInfoBox(content) {
    infoBoxContent.innerHTML = content;
    infoBoxContainer.style.display = 'block';
  }

  // Custom function to hide InfoBox
  function hideInfoBox() {
    infoBoxContainer.style.display = 'none';
  }

  let previousSunCartographic, previousMoonCartographic;
  let previousTime = new Date(); // Initialize previousTime

  // Function to convert celestial coordinates to geographic coordinates
  function celestialToGeographic(ra, dec, gmst) {
    const lat = Cesium.Math.toRadians(dec);
    const lon = Cesium.Math.toRadians((ra * 15) - (gmst * 15));
    return new Cesium.Cartographic(lon, lat);
  }

  // Haversine formula to calculate great-circle distance
  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = Cesium.Math.toRadians(lat2 - lat1);
    const dLon = Cesium.Math.toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(Cesium.Math.toRadians(lat1)) * Math.cos(Cesium.Math.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Function to calculate speed
  function calculateSpeed(prev, current, timeDiff) {
    const distance = haversineDistance(
      Cesium.Math.toDegrees(prev.latitude),
      Cesium.Math.toDegrees(prev.longitude),
      Cesium.Math.toDegrees(current.latitude),
      Cesium.Math.toDegrees(current.longitude)
    );
    return distance / timeDiff * 3600; // Convert to km/h
  }

  // Update the calculateTransparency function
  function calculateTransparency(cameraPosition, sunPosition) {
    const cameraVector = Cesium.Cartesian3.normalize(cameraPosition, new Cesium.Cartesian3());
    const sunVector = Cesium.Cartesian3.normalize(sunPosition, new Cesium.Cartesian3());
    const dot = Cesium.Cartesian3.dot(cameraVector, sunVector);

    const sunsetStart = 0.1;
    const sunsetEnd = -0.3;

    if (dot > sunsetStart) {
      return 0.0;
    } else if (dot < sunsetEnd) {
      return 0.5;
    } else {
      return Cesium.Math.clamp((sunsetStart - dot) / (sunsetStart - sunsetEnd), 0.0, 0.7);
    }
  }

  // Function to update Sun and Moon positions
  function updateSunMoonPositions() {
    const currentTime = new Date();
    const timeDiff = (currentTime - previousTime) / 3600000; // Time difference in hours
    const date = Cesium.JulianDate.toDate(viewer.clock.currentTime);
    const observer = new Astronomy.Observer(0, 0, 0);
    const gmst = Astronomy.SiderealTime(date);

    // Sun position
    const sunEquatorial = Astronomy.Equator(Astronomy.Body.Sun, date, observer, true, true);
    const sunCartographic = celestialToGeographic(sunEquatorial.ra, sunEquatorial.dec, gmst);
    const sunCartesian = Cesium.Ellipsoid.WGS84.cartographicToCartesian(sunCartographic);

    // Update the sun's position for lighting
    viewer.scene.sun.position = sunCartesian;

    // Moon position
    const moonEquatorial = Astronomy.Equator(Astronomy.Body.Moon, date, observer, true, true);
    const moonCartographic = celestialToGeographic(moonEquatorial.ra, moonEquatorial.dec, gmst);
    const moonCartesian = Cesium.Ellipsoid.WGS84.cartographicToCartesian(moonCartographic);

    // Calculate speeds
    let sunSpeed = 0, moonSpeed = 0;
    if (previousSunCartographic && previousMoonCartographic) {
      sunSpeed = calculateSpeed(previousSunCartographic, sunCartographic, timeDiff);
      moonSpeed = calculateSpeed(previousMoonCartographic, moonCartographic, timeDiff);
    }

    // Update the night layer's alpha based on sun position
    const updateNightLayerAlpha = () => {
      const cameraPosition = viewer.camera.positionWC;
      if (cameraPosition) {
        const alpha = calculateTransparency(cameraPosition, sunCartesian);
        nightLayer.alpha = alpha;
      }

      // Ensure the cloud layer remains visible
      const cloudLayer = layerManager.layers.get('clouds');
      if (cloudLayer) {
        cloudLayer.alpha = 1;
      }
    };

    // Call immediately
    updateNightLayerAlpha();

    // Set up a camera changed event listener
    if (!viewer.camera.changed.numberOfListeners) {
      viewer.camera.changed.addEventListener(updateNightLayerAlpha);
    }

    // Store current positions and time for next update
    previousSunCartographic = sunCartographic;
    previousMoonCartographic = moonCartographic;
    previousTime = currentTime;

    // Update InfoBox content when clicking on entities
    viewer.selectedEntityChanged.addEventListener((selectedEntity) => {
      if (selectedEntity) {
        if (selectedEntity.id === 'sun') {
          showInfoBox(`
            <h2>Sun</h2>
            <p>Latitude: ${Cesium.Math.toDegrees(sunCartographic.latitude).toFixed(2)}°</p>
            <p>Longitude: ${Cesium.Math.toDegrees(sunCartographic.longitude).toFixed(2)}°</p>
            <p>Speed: ${sunSpeed.toFixed(2)} km/h</p>
          `);
        } else if (selectedEntity.id === 'moon') {
          showInfoBox(`
            <h2>Moon</h2>
            <p>Latitude: ${Cesium.Math.toDegrees(moonCartographic.latitude).toFixed(2)}°</p>
            <p>Longitude: ${Cesium.Math.toDegrees(moonCartographic.longitude).toFixed(2)}°</p>
            <p>Speed: ${moonSpeed.toFixed(2)} km/h</p>
          `);
        }
      } else {
        hideInfoBox();
      }
    });
  }

  // Initial call to update positions
  updateSunMoonPositions();

  // Update Sun and Moon positions more frequently for smoother animation
  setInterval(updateSunMoonPositions, 16); // Approximately 60 fps

  // Enable real-time clock mode
  viewer.clock.shouldAnimate = true;

  // Function to add a marker
  function addMarker(lat, lon, label) {
    const marker = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: { pixelSize: 10, color: Cesium.Color.RED },
      label: {
        text: label,
        font: '14pt sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -20)
      }
    });
    return marker;
  }

  // Add markers from saved data
  function loadMarkers(markersData) {
    markersData.forEach(markerData => {
      addMarker(markerData.lat, markerData.lon, markerData.label);
    });
  }

  // Save markers to a file
  function saveMarkers(markersData) {
    const blob = new Blob([JSON.stringify(markersData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'markers.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Right-click to add marker
  viewer.screenSpaceEventHandler.setInputAction((click) => {
    const earthPosition = viewer.scene.pickPosition(click.position);
    if (Cesium.defined(earthPosition)) {
      const cartographic = Cesium.Cartographic.fromCartesian(earthPosition);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);
      const label = prompt('Enter label for marker:');
      if (label) {
        addMarker(lat, lon, label);
      }
    }
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

  // Toggle markers visibility button
  const toggleMarkersButton = document.createElement('button');
  toggleMarkersButton.textContent = 'Toggle Markers';
  toggleMarkersButton.style.position = 'absolute';
  toggleMarkersButton.style.top = '10px';
  toggleMarkersButton.style.left = '120px';
  document.body.appendChild(toggleMarkersButton);

  toggleMarkersButton.addEventListener('click', () => {
    viewer.entities.values.forEach(entity => {
      entity.show = !entity.show;
    });
  });

  // Save markers button
  const saveMarkersButton = document.createElement('button');
  saveMarkersButton.textContent = 'Save Markers';
  saveMarkersButton.style.position = 'absolute';
  saveMarkersButton.style.top = '10px';
  saveMarkersButton.style.left = '220px';
  document.body.appendChild(saveMarkersButton);

  saveMarkersButton.addEventListener('click', () => {
    const markersData = viewer.entities.values.map(entity => ({
      lat: Cesium.Cartographic.fromCartesian(entity.position.getValue(Cesium.JulianDate.now())).latitude * (180 / Math.PI),
      lon: Cesium.Cartographic.fromCartesian(entity.position.getValue(Cesium.JulianDate.now())).longitude * (180 / Math.PI),
      label: entity.label.text.getValue(Cesium.JulianDate.now())
    }));
    saveMarkers(markersData);
  });

  // Load markers from file
  const loadMarkersButton = document.createElement('input');
  loadMarkersButton.type = 'file';
  loadMarkersButton.style.position = 'absolute';
  loadMarkersButton.style.top = '10px';
  loadMarkersButton.style.left = '320px';
  document.body.appendChild(loadMarkersButton);

  loadMarkersButton.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const markersData = JSON.parse(e.target.result);
        loadMarkers(markersData);
      };
      reader.readAsText(file);
    }
  });
});
