import * as Cesium from 'cesium';
import * as Astronomy from 'astronomy-engine';

// Import Cesium CSS globally
import 'cesium/Build/Cesium/Widgets/widgets.css';

// Set the base URL for Cesium
window.CESIUM_BASE_URL = '/Cesium';

// Wait for the DOM to be fully loaded before running our script
document.addEventListener('DOMContentLoaded', function() {
  // Initialize Cesium Viewer
  const viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: null,
    infoBox: false, // Disable the default InfoBox
    sceneMode: Cesium.SceneMode.SCENE3D,
    shadows: true,
    shouldAnimate: true
  });

    // Remove the Cesium ion logo
    viewer.cesiumWidget.creditContainer.removeChild(
    viewer.cesiumWidget.creditContainer.lastChild
  );
  
  // LAYERS CODE
  // Add this to your existing code, after initializing the viewer

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
  
  // Initialize the LayerManager
  const layerManager = new LayerManager(viewer);
  
//   // Example usage:
//   // Add a cloud layer (static example)
//   const cloudProvider = new Cesium.UrlTemplateImageryProvider({
//     url: 'https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=YOUR_API_KEY',
//     minimumLevel: 0,
//     maximumLevel: 18
//   });
//   layerManager.addLayer('clouds', cloudProvider, 0.5);
  
  // Toggle cloud layer visibility
  // layerManager.toggleLayer('clouds', false);
  
  // Update cloud layer opacity
  // layerManager.updateLayerAlpha('clouds', 0.7);

  // END OF LAYERS CODE
// Function to format date for GIBS URL
// Function to format date for GIBS URL
function formatDateForGIBS(date) {
    return date.toISOString().split('T')[0];  // Returns YYYY-MM-DD
  }
  
  // Function to get the most recent date (yesterday, as MODIS data might not be available for today yet)
  function getMostRecentDate() {
    const now = new Date();
    now.setDate(now.getDate() - 1);  // Use yesterday's date
    now.setUTCHours(0, 0, 0, 0);  // Set time to 00:00:00 UTC
    return formatDateForGIBS(now);
  }
  
  // Get the initial date
  const initialDate = getMostRecentDate();
  
  // Create a custom time-varying provider
  const customProvider = new Cesium.UrlTemplateImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{Time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    minimumLevel: 0,
    maximumLevel: 9,
    tileWidth: 256,
    tileHeight: 256,
    customTags: {
      Time: function() {
        return initialDate;
      }
    },
    credit: new Cesium.Credit('NASA Global Imagery Browse Services for EOSDIS')
  });
  
  // Log the date being sent to GIBS
  console.log('Initial date being sent to GIBS:', initialDate);
  
  // Add the cloud layer to the layer manager
  layerManager.addLayer('clouds', customProvider, 0.7);
  
  // Function to update the cloud layer time
  function updateCloudLayer() {
    const newDate = getMostRecentDate();
    console.log('Updating cloud layer time to:', newDate);
    customProvider.customTags.Time = function() {
      return newDate;
    };
    layerManager.layers.get('clouds').imageryProvider.reload();
  }
  
  // Update the cloud layer every 30 minutes
  setInterval(updateCloudLayer, 30 * 60 * 1000);
  
  // Optional: Add a button to toggle the cloud layer
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
//   // Optional: Add time-based layer visibility
//   viewer.scene.postUpdate.addEventListener(function() {
//     const currentTime = Cesium.JulianDate.toDate(viewer.clock.currentTime);
//     const localTime = new Date(currentTime.getTime() + currentTime.getTimezoneOffset() * 60000);
//     const hours = localTime.getHours();
    
//     const cloudLayer = layerManager.layers.get('clouds');
//     if (cloudLayer) {
//       // Show cloud layer only during night hours (7 PM to 7 AM) if it's not manually hidden
//       cloudLayer.show = cloudLayer.show && (hours >= 19 || hours < 7);
//     }
//   });
  
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
  let previousTime = new Date();

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
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(Cesium.Math.toRadians(lat1)) * Math.cos(Cesium.Math.toRadians(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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
    
    // Adjust these values to fine-tune the transition
    const sunsetStart = 0.1;  // Start fading in night at this dot product
    const sunsetEnd = -0.3;   // Fully night at this dot product
  
    if (dot > sunsetStart) {
      return 0.0;  // Full day
    } else if (dot < sunsetEnd) {
      return 0.7;  // Night, but not fully opaque to allow cloud visibility
    } else {
      // Smooth transition
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
    const alpha = calculateTransparency(cameraPosition, sunCartesian);
    nightLayer.alpha = alpha;
    
    // Ensure the cloud layer remains visible
    const cloudLayer = layerManager.layers.get('clouds');
    if (cloudLayer) {
      cloudLayer.alpha = 0.7; // Adjust this value as needed
    }
  };

    // Call immediately
    updateNightLayerAlpha();

    // Set up a camera changed event listener
    if (!viewer.camera.changed.numberOfListeners) {
      viewer.camera.changed.addEventListener(updateNightLayerAlpha);
    }

    // Update or create markers
    if (!viewer.entities.getById('sun')) {
      viewer.entities.add(new Cesium.Entity({
        id: 'sun',
        position: sunCartesian,
        point: { pixelSize: 20, color: Cesium.Color.YELLOW },
        label: {
          text: 'Sun',
          font: '14pt sans-serif',
          fillColor: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -30)
        }
      }));
    } else {
      viewer.entities.getById('sun').position = sunCartesian;
    }

    if (!viewer.entities.getById('moon')) {
      viewer.entities.add(new Cesium.Entity({
        id: 'moon',
        position: moonCartesian,
        point: { pixelSize: 20, color: Cesium.Color.WHITE },
        label: {
          text: 'Moon',
          font: '14pt sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -30)
        }
      }));
    } else {
      viewer.entities.getById('moon').position = moonCartesian;
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

    // Update user location periodically
    if (currentUser) {
      updateUserLocation();
    }
  }

  // Custom layer for night side of the Earth
  const nightLayer = viewer.imageryLayers.addImageryProvider(new Cesium.SingleTileImageryProvider({
    url: '/assets/night.jpg', // Replace with the path to your night texture image
    tileWidth: 256,
    tileHeight: 256
  }));


  // Add custom night layer to the scene
  viewer.scene.imageryLayers.add(nightLayer);

  // User login and location marking
  let currentUser = null;
  const userMarkers = new Map();

  // Create login modal
  const loginModal = document.createElement('div');
  loginModal.innerHTML = `
    <div id="loginModalContent" style="background: white; padding: 20px; border-radius: 5px; text-align: center;">
      <h2>Login</h2>
      <input type="text" id="usernameInput" placeholder="Enter your name" style="margin: 10px; padding: 5px;">
      <br>
      <button id="submitLogin" style="padding: 5px 10px;">Login</button>
    </div>
  `;
  loginModal.style.cssText = `
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.4);
    display: flex;
    justify-content: center;
    align-items: center;
  `;
  document.body.appendChild(loginModal);

  function showLoginModal() {
    loginModal.style.display = 'flex';
  }

  function hideLoginModal() {
    loginModal.style.display = 'none';
  }

  function login() {
    const username = document.getElementById('usernameInput').value.trim();
    if (username) {
      currentUser = username;
      updateUserLocation();
      hideLoginModal();
      document.getElementById('loginButton').style.display = 'none';
      document.getElementById('logoutButton').style.display = 'inline-block';
    }
  }

  function logout() {
    if (currentUser) {
      userMarkers.get(currentUser).show = false;
      userMarkers.delete(currentUser);
      currentUser = null;
      document.getElementById('loginButton').style.display = 'inline-block';
      document.getElementById('logoutButton').style.display = 'none';
    }
  }

  function updateUserLocation() {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        addOrUpdateUserMarker(currentUser, latitude, longitude);
      }, (error) => {
        console.error("Error getting location:", error);
        alert("Unable to get your location. Please check your browser settings.");
      });
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  }

  function addOrUpdateUserMarker(username, latitude, longitude) {
    const position = Cesium.Cartesian3.fromDegrees(longitude, latitude);
    
    if (userMarkers.has(username)) {
      userMarkers.get(username).position = position;
    } else {
      const userEntity = viewer.entities.add({
        name: username,
        position: position,
        point: {
          pixelSize: 10,
          color: Cesium.Color.BLUE
        },
        label: {
          text: username,
          font: '14pt sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10)
        }
      });
      userMarkers.set(username, userEntity);
    }
  }

  // Add event listeners for login and logout buttons
  const loginButton = document.getElementById('loginButton');
  const logoutButton = document.getElementById('logoutButton');
  const submitLoginButton = document.getElementById('submitLogin');

  if (loginButton) {
    loginButton.addEventListener('click', showLoginModal);
  } else {
    console.error("Login button not found");
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', logout);
  } else {
    console.error("Logout button not found");
  }

  if (submitLoginButton) {
    submitLoginButton.addEventListener('click', login);
  } else {
    console.error("Submit login button not found");
  }

  // Hide logout button initially
  if (logoutButton) {
    logoutButton.style.display = 'none';
  }

  // Initial call to update positions
  updateSunMoonPositions();

  // Update Sun and Moon positions more frequently for smoother animation
  setInterval(updateSunMoonPositions, 16); // Approximately 60 fps

  // Enable real-time clock mode
  viewer.clock.shouldAnimate = true;
});