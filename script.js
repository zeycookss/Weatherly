/* =====================================================================
   WEATHERLY — script.js
   -----------------------------------------------------------------------
   Table of contents (Ctrl+F these headers if you get lost):
     1.  Config + API key
     2.  DOM references
     3.  App state
     4.  Weather condition helpers (mapping API data -> our own labels)
     5.  Background + orb color data
     6.  Init
     7.  Event listeners
     8.  Core fetch logic
     9.  UI update functions
     10. Background system
     11. Weather animation system (rain/snow/clouds/fog/lightning)
     12. Forecast rendering (hourly + 5-day)
     13. Air Quality + UV Index
     14. Sun path
     15. Favorites + search history (localStorage)
     16. Small utility helpers
   ===================================================================== */


/* ---------------------------------------------------------------------
   1. CONFIG + API KEY
   Get a free key at https://openweathermap.org/api — see the README
   for the full walkthrough. New keys can take a little while to
   activate after you sign up, so don't panic if it doesn't work
   right away.
   --------------------------------------------------------------------- */
const API_KEY = "0790f9b97c91472c5ee928af62e68d46";

const BASE_URL = "https://api.openweathermap.org/data/2.5";
const AIR_POLLUTION_URL = "https://api.openweathermap.org/data/2.5/air_pollution";
const ONE_CALL_URL = "https://api.openweathermap.org/data/3.0/onecall"; // used for UV Index


/* ---------------------------------------------------------------------
   2. DOM REFERENCES
   Script tag is at the bottom of the page, so the HTML above it is
   already parsed by the time this runs — no need to wait for
   DOMContentLoaded just to grab elements.
   --------------------------------------------------------------------- */
const searchFormEl = document.getElementById("searchForm");
const cityInputEl = document.getElementById("cityInput");
const locationBtnEl = document.getElementById("locationBtn");
const unitToggleEl = document.getElementById("unitToggle");
const themeToggleEl = document.getElementById("themeToggle");

const errorBannerEl = document.getElementById("errorBanner");
const errorTextEl = document.getElementById("errorText");
const errorCloseBtnEl = document.getElementById("errorCloseBtn");

const loadingOverlayEl = document.getElementById("loadingOverlay");

const bgLayerAEl = document.getElementById("bgLayerA");
const bgLayerBEl = document.getElementById("bgLayerB");
const nightOverlayEl = document.getElementById("nightOverlay");
const starsLayerEl = document.getElementById("starsLayer");
const weatherAnimLayerEl = document.getElementById("weatherAnimLayer");

const skyOrbEl = document.getElementById("skyOrb");
const orbStopAEl = document.getElementById("orbStopA");
const orbStopBEl = document.getElementById("orbStopB");
const orbStopCEl = document.getElementById("orbStopC");
const orbRaysEl = document.getElementById("orbRays");
const orbCratersEl = document.getElementById("orbCraters");
const orbParticlesEl = document.getElementById("orbParticles");
const orbCloudsEl = document.getElementById("orbClouds");
const orbRainEl = document.getElementById("orbRain");
const orbSnowEl = document.getElementById("orbSnow");
const orbBoltEl = document.getElementById("orbBolt");
const orbFogEl = document.getElementById("orbFog");
const favoriteBtnEl = document.getElementById("favoriteBtn");

const conditionLabelEl = document.getElementById("conditionLabel");
const cityNameEl = document.getElementById("cityName");
const cityDateEl = document.getElementById("cityDate");
const currentTempEl = document.getElementById("currentTemp");
const tempUnitEl = document.getElementById("tempUnit");
const weatherDescEl = document.getElementById("weatherDesc");
const feelsLikeChipEl = document.getElementById("feelsLikeChip");
const tempHighLowEl = document.getElementById("tempHighLow");

const feelsLikeValueEl = document.getElementById("feelsLikeValue");
const humidityValueEl = document.getElementById("humidityValue");
const windValueEl = document.getElementById("windValue");
const pressureValueEl = document.getElementById("pressureValue");
const visibilityValueEl = document.getElementById("visibilityValue");
const uvValueEl = document.getElementById("uvValue");
const aqiValueEl = document.getElementById("aqiValue");
const rainChanceValueEl = document.getElementById("rainChanceValue");

const sunArcPathEl = document.getElementById("sunArcPath");
const sunDotEl = document.getElementById("sunDot");
const sunriseTimeEl = document.getElementById("sunriseTime");
const sunsetTimeEl = document.getElementById("sunsetTime");

const hourlyContainerEl = document.getElementById("hourlyContainer");
const dailyContainerEl = document.getElementById("dailyContainer");

const favoritesContainerEl = document.getElementById("favoritesContainer");
const favoritesEmptyEl = document.getElementById("favoritesEmpty");
const historyContainerEl = document.getElementById("historyContainer");
const historyEmptyEl = document.getElementById("historyEmpty");
const clearHistoryBtnEl = document.getElementById("clearHistoryBtn");

const currentYearEl = document.getElementById("currentYear");

// The lightning flash is just a full-screen white div. It only ever needs
// to exist once, so we create it here instead of hardcoding it in the HTML.
const lightningFlashEl = document.createElement("div");
lightningFlashEl.className = "lightning-flash";
weatherAnimLayerEl.appendChild(lightningFlashEl);


/* ---------------------------------------------------------------------
   3. APP STATE
   --------------------------------------------------------------------- */
let currentUnit = "C";          // "C" or "F"
let currentWeatherData = null;  // last successful /weather response
let forecastCache = null;       // last successful /forecast response
let layerAVisible = true;       // which background layer is currently on top
let lightningInterval = null;   // setInterval id for the storm flashes
let errorTimeout = null;        // setTimeout id for auto-hiding the error banner

const FAVORITES_KEY = "weatherly_favorites";
const HISTORY_KEY = "weatherly_history";
const THEME_KEY = "weatherly_theme";
const UNIT_KEY = "weatherly_unit";
const LAST_CITY_KEY = "weatherly_last_city";


/* ---------------------------------------------------------------------
   4. WEATHER CONDITION HELPERS
   OpenWeather sends back dozens of specific condition names (Rain,
   Drizzle, Thunderstorm, Mist, Haze, Fog...). We don't need a unique
   background/animation for every single one, so we sort them into
   7 "buckets" that match the moods described in the design brief.
   --------------------------------------------------------------------- */
function mapCondition(weatherMain, iconCode) {
  const isNight = typeof iconCode === "string" && iconCode.endsWith("n");
  const main = (weatherMain || "").toLowerCase();

  if (main === "clear") return isNight ? "clear-night" : "clear-day";
  if (main === "clouds") return "clouds";
  if (main === "rain" || main === "drizzle") return "rain";
  if (main === "thunderstorm") return "thunderstorm";
  if (main === "snow") return "snow";
  if (["mist", "fog", "haze", "smoke", "dust", "sand", "ash", "squall", "tornado"].includes(main)) {
    return "mist";
  }
  // fallback, just in case OpenWeather ever adds a new condition type
  return isNight ? "clear-night" : "clear-day";
}

const weatherEmojis = {
  "clear-day": "☀️",
  "clear-night": "🌙",
  clouds: "☁️",
  rain: "🌧️",
  snow: "❄️",
  thunderstorm: "⛈️",
  mist: "🌫️",
};

function conditionKeyToLabel(key) {
  const labels = {
    "clear-day": "Clear Skies",
    "clear-night": "Clear Night",
    clouds: "Cloudy",
    rain: "Rainy",
    snow: "Snowy",
    thunderstorm: "Thunderstorm",
    mist: "Misty",
  };
  return labels[key] || "Current Weather";
}


/* ---------------------------------------------------------------------
   5. BACKGROUND + ORB COLOR DATA
   Every gradient here is built from the same palette described in the
   design brief (midnight/navy/indigo/purple/cyan/frost) — they're just
   mixed in different proportions depending on the mood we're going for.
   --------------------------------------------------------------------- */
const weatherGradients = {
  dark: {
    "clear-day": "linear-gradient(160deg, #16213e 0%, #3a4a8f 32%, #8a5fae 58%, #e8935f 82%, #ffcf86 100%)",
    "clear-night": "linear-gradient(160deg, #05070f 0%, #0a0e2a 40%, #131a3d 70%, #1c2452 100%)",
    clouds: "linear-gradient(160deg, #232a4d 0%, #38446f 45%, #5c6b95 100%)",
    rain: "linear-gradient(160deg, #0d1230 0%, #1b2450 40%, #2b3868 70%, #1a2340 100%)",
    snow: "linear-gradient(160deg, #1b2340 0%, #3f5470 45%, #a9c6d9 100%)",
    thunderstorm: "linear-gradient(160deg, #05060d 0%, #10142c 40%, #241b3d 70%, #3a1f4d 100%)",
    mist: "linear-gradient(160deg, #232945 0%, #3d4560 50%, #6b7390 100%)",
  },
  light: {
    "clear-day": "linear-gradient(160deg, #dceeff 0%, #bcd9f5 32%, #f7c98a 70%, #ffe3b0 100%)",
    "clear-night": "linear-gradient(160deg, #cfd6ea 0%, #a9b3d6 40%, #7b7fae 70%, #5b5a8c 100%)",
    clouds: "linear-gradient(160deg, #e4e9f5 0%, #c3cbe0 50%, #a6b0cf 100%)",
    rain: "linear-gradient(160deg, #cfd8ea 0%, #aab8d6 50%, #8493bd 100%)",
    snow: "linear-gradient(160deg, #eef4fa 0%, #d7e6f0 50%, #bcd8e8 100%)",
    thunderstorm: "linear-gradient(160deg, #97a0c2 0%, #6c74a0 50%, #4a4f7d 100%)",
    mist: "linear-gradient(160deg, #eef1f8 0%, #dbe1ee 50%, #c3cbe0 100%)",
  },
};

// The 3 stop colors used to paint the sky orb's core gradient
const orbPalettes = {
  "clear-day": ["#ffe9b8", "#ffb347", "#c96b1f"],
  "clear-night": ["#dfe6ff", "#9aa5d6", "#4b4f8c"],
  clouds: ["#e7ebf5", "#aab2cf", "#6b7396"],
  rain: ["#c9d6e8", "#7a8bb0", "#3d4a72"],
  snow: ["#ffffff", "#cfe4f0", "#8fb4cc"],
  thunderstorm: ["#cfd0e8", "#6b5f95", "#332b52"],
  mist: ["#eef0f5", "#c3c9d6", "#8a90a3"],
};


/* ---------------------------------------------------------------------
   6. INIT
   --------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", init);

function init() {
  applySavedTheme();
  applySavedUnit();
  createStars(90);
  displayFavorites();
  displaySearchHistory();
  setupEventListeners();
  currentYearEl.textContent = new Date().getFullYear();
  loadInitialCity();
}

function loadInitialCity() {
  const savedRaw = localStorage.getItem(LAST_CITY_KEY);
  if (savedRaw) {
    try {
      const { lat, lon } = JSON.parse(savedRaw);
      fetchWeather({ lat, lon });
      return;
    } catch (err) {
      // saved data was corrupted somehow, just fall through to the default
    }
  }
  // Nothing saved yet (first visit) — load a friendly default city.
  // Change this to whatever makes sense for you!
  fetchWeather({ city: "London" });
}


/* ---------------------------------------------------------------------
   7. EVENT LISTENERS
   --------------------------------------------------------------------- */
function setupEventListeners() {
  // Submitting the form (either clicking Search OR pressing Enter in the
  // input, forms handle that automatically) triggers a new search.
  searchFormEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const city = cityInputEl.value.trim();
    if (!city) {
      showError("Type a city name first.");
      return;
    }
    fetchWeather({ city });
    cityInputEl.value = "";
    cityInputEl.blur();
  });

  locationBtnEl.addEventListener("click", handleUseLocation);

  unitToggleEl.addEventListener("click", () => {
    currentUnit = currentUnit === "C" ? "F" : "C";
    localStorage.setItem(UNIT_KEY, currentUnit);
    updateUnitToggleUI();
    renderUnitDependentValues();
  });

  themeToggleEl.addEventListener("click", () => {
    const newTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
    document.body.dataset.theme = newTheme;
    localStorage.setItem(THEME_KEY, newTheme);
    // the gradients are different per theme, so re-run the background
    // logic with whatever weather we're already showing
    if (currentWeatherData) updateBackground(currentWeatherData);
  });

  favoriteBtnEl.addEventListener("click", toggleFavoriteCurrentCity);

  clearHistoryBtnEl.addEventListener("click", () => {
    saveHistory([]);
    displaySearchHistory();
  });

  errorCloseBtnEl.addEventListener("click", clearError);
}

function handleUseLocation() {
  if (!navigator.geolocation) {
    showError("Your browser doesn't support location detection.");
    return;
  }
  locationBtnEl.classList.add("locating");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locationBtnEl.classList.remove("locating");
      fetchWeather({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    },
    () => {
      locationBtnEl.classList.remove("locating");
      showError("Couldn't access your location. Try searching for a city instead.");
    },
    { timeout: 8000 }
  );
}


/* ---------------------------------------------------------------------
   8. CORE FETCH LOGIC
   --------------------------------------------------------------------- */

// query is either { city: "Tokyo" } or { lat, lon }
function buildWeatherURL(query) {
  const params = new URLSearchParams({ appid: API_KEY, units: "metric" });
  if (query.city) {
    params.set("q", query.city);
  } else {
    params.set("lat", query.lat);
    params.set("lon", query.lon);
  }
  return `${BASE_URL}/weather?${params.toString()}`;
}

function buildForecastURL(lat, lon) {
  const params = new URLSearchParams({ appid: API_KEY, units: "metric", lat, lon });
  return `${BASE_URL}/forecast?${params.toString()}`;
}

async function fetchWeather(query) {
  if (!API_KEY || API_KEY === "YOUR_OPENWEATHER_API_KEY") {
    showError("Add your free OpenWeather API key at the top of script.js to load real weather data.");
    return;
  }

  showLoading();
  clearError();

  try {
    const weatherRes = await fetch(buildWeatherURL(query));
    if (!weatherRes.ok) {
      if (weatherRes.status === 404) {
        throw new Error("City not found. Double-check the spelling and try again.");
      }
      if (weatherRes.status === 401) {
        throw new Error("That API key isn't active yet — OpenWeather keys can take a few minutes after sign-up.");
      }
      throw new Error("Something went wrong while fetching the weather. Please try again.");
    }
    const data = await weatherRes.json();
    currentWeatherData = data;
    localStorage.setItem(LAST_CITY_KEY, JSON.stringify({ lat: data.coord.lat, lon: data.coord.lon }));

    const forecastRes = await fetch(buildForecastURL(data.coord.lat, data.coord.lon));
    if (!forecastRes.ok) throw new Error("Couldn't load the forecast right now.");
    const forecastData = await forecastRes.json();
    forecastCache = forecastData;

    // update every part of the page
    updateUI(data);
    updateBackground(data);
    updateAnimations(data);
    displayForecast(forecastData, data.timezone);
    displayHourlyForecast(forecastData, data.timezone);
    displaySunTimes(data);

    // these two are "best effort" — the free API tier doesn't always
    // include them, so they fail quietly and just show "N/A" if needed
    displayAQI(data.coord.lat, data.coord.lon);
    displayUVIndex(data.coord.lat, data.coord.lon);

    addToSearchHistory({ name: data.name, country: data.sys.country, lat: data.coord.lat, lon: data.coord.lon });
    displaySearchHistory();
  } catch (err) {
    console.error(err);
    showError(err.message || "Couldn't load weather data. Please try again.");
  } finally {
    hideLoading();
  }
}


/* ---------------------------------------------------------------------
   9. UI UPDATE FUNCTIONS
   --------------------------------------------------------------------- */
function updateUI(data) {
  const conditionKey = mapCondition(data.weather[0].main, data.weather[0].icon);

  conditionLabelEl.textContent = conditionKeyToLabel(conditionKey);
  cityNameEl.textContent = data.sys && data.sys.country ? `${data.name}, ${data.sys.country}` : data.name;
  cityDateEl.textContent = formatCityDateTime(data.timezone);
  weatherDescEl.textContent = capitalize(data.weather[0].description);

  // these two don't change with the C/F toggle, so they're set once here
  humidityValueEl.textContent = `${data.main.humidity}%`;
  pressureValueEl.textContent = `${data.main.pressure} hPa`;

  renderUnitDependentValues();
  updateFavoriteButtonState(data.name, data.sys.country);
}

// Anything that depends on °C vs °F lives in here, so toggling the unit
// can just call this again instead of re-fetching from the API.
function renderUnitDependentValues() {
  if (!currentWeatherData) return;
  const data = currentWeatherData;

  const temp = convertTemp(data.main.temp);
  const feels = convertTemp(data.main.feels_like);
  const min = convertTemp(data.main.temp_min);
  const max = convertTemp(data.main.temp_max);

  const windSpeed = currentUnit === "C" ? data.wind.speed * 3.6 : data.wind.speed * 2.23694;
  const windUnit = currentUnit === "C" ? "km/h" : "mph";

  const visibility = currentUnit === "C" ? data.visibility / 1000 : data.visibility / 1609.34;
  const visUnit = currentUnit === "C" ? "km" : "mi";

  currentTempEl.textContent = Math.round(temp);
  tempUnitEl.textContent = `°${currentUnit}`;
  feelsLikeChipEl.textContent = `Feels like ${Math.round(feels)}°`;
  tempHighLowEl.textContent = `H: ${Math.round(max)}°  L: ${Math.round(min)}°`;
  feelsLikeValueEl.textContent = `${Math.round(feels)}°`;
  windValueEl.textContent = `${Math.round(windSpeed)} ${windUnit}`;
  visibilityValueEl.textContent = `${visibility.toFixed(1)} ${visUnit}`;

  // the hourly/daily cards show temperatures too, so refresh those as well
  if (forecastCache) {
    displayHourlyForecast(forecastCache, data.timezone);
    displayForecast(forecastCache, data.timezone);
  }
}

function updateUnitToggleUI() {
  document.querySelectorAll(".pill-option").forEach((el) => {
    el.classList.toggle("active", el.dataset.unit === currentUnit);
  });
}


/* ---------------------------------------------------------------------
   10. BACKGROUND SYSTEM
   Two full-screen layers so the gradient can crossfade instead of
   snapping instantly when the weather condition changes.
   --------------------------------------------------------------------- */
function updateBackground(data) {
  const conditionKey = mapCondition(data.weather[0].main, data.weather[0].icon);
  const isDay = data.weather[0].icon.endsWith("d");
  const theme = document.body.dataset.theme === "light" ? "light" : "dark";
  const gradient = weatherGradients[theme][conditionKey];

  const hiddenLayer = layerAVisible ? bgLayerBEl : bgLayerAEl;
  const visibleLayer = layerAVisible ? bgLayerAEl : bgLayerBEl;

  hiddenLayer.style.background = gradient;
  // wait one frame so the browser registers the new background before we
  // animate its opacity — otherwise the fade doesn't play
  requestAnimationFrame(() => {
    hiddenLayer.style.opacity = "1";
    visibleLayer.style.opacity = "0";
  });
  layerAVisible = !layerAVisible;

  document.body.dataset.weather = conditionKey;

  // stars only make sense once the sun's down
  starsLayerEl.style.opacity = isDay ? "0" : "1";

  // clear-night already has its own dark gradient, everything else gets a
  // subtle extra darkening once the sun sets
  const needsNightOverlay = !isDay && conditionKey !== "clear-night";
  nightOverlayEl.style.opacity = needsNightOverlay ? "0.4" : "0";
}

function createStars(count) {
  for (let i = 0; i < count; i++) {
    const star = document.createElement("div");
    star.className = "star";
    const size = 1 + Math.random() * 2;
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 70}%`; // keep them off the horizon glow
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.animationDuration = `${2 + Math.random() * 3}s`;
    star.style.animationDelay = `${Math.random() * 4}s`;
    starsLayerEl.appendChild(star);
  }
}


/* ---------------------------------------------------------------------
   11. WEATHER ANIMATION SYSTEM
   Updates both the full-page particle layer AND the little icons
   inside the sky orb, based on the current condition.
   --------------------------------------------------------------------- */
function updateAnimations(data) {
  const conditionKey = mapCondition(data.weather[0].main, data.weather[0].icon);

  updateOrbColors(conditionKey);
  resetOrbLayers();
  clearWeatherAnimLayer();

  switch (conditionKey) {
    case "clear-day":
      orbRaysEl.classList.add("show");
      generateOrbParticles(6);
      generateParticles(14);
      break;

    case "clear-night":
      orbCratersEl.classList.add("show");
      break;

    case "clouds":
      orbCloudsEl.classList.add("show");
      generateClouds(4);
      break;

    case "rain":
      skyOrbEl.classList.add("rain-mode");
      orbCloudsEl.classList.add("show");
      orbRainEl.classList.add("show");
      generateClouds(3);
      generateRain(70);
      break;

    case "snow":
      orbCloudsEl.classList.add("show");
      orbSnowEl.classList.add("show");
      generateClouds(2);
      generateSnow(55);
      break;

    case "thunderstorm":
      skyOrbEl.classList.add("storm-mode");
      orbCloudsEl.classList.add("show");
      orbBoltEl.classList.add("show");
      generateClouds(4);
      generateRain(55);
      startLightning();
      break;

    case "mist":
      orbFogEl.classList.add("show");
      generateFog(5);
      break;
  }
}

function updateOrbColors(conditionKey) {
  const [a, b, c] = orbPalettes[conditionKey] || orbPalettes["clear-day"];
  orbStopAEl.setAttribute("stop-color", a);
  orbStopBEl.setAttribute("stop-color", b);
  orbStopCEl.setAttribute("stop-color", c);
}

function resetOrbLayers() {
  [orbRaysEl, orbCratersEl, orbCloudsEl, orbRainEl, orbSnowEl, orbBoltEl, orbFogEl, orbParticlesEl].forEach((el) =>
    el.classList.remove("show")
  );
  skyOrbEl.classList.remove("storm-mode", "rain-mode");
  orbParticlesEl.innerHTML = "";
}

function generateOrbParticles(count) {
  const svgNS = "http://www.w3.org/2000/svg";
  for (let i = 0; i < count; i++) {
    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", 90 + Math.random() * 120);
    dot.setAttribute("cy", 85 + Math.random() * 80);
    dot.setAttribute("r", 2 + Math.random() * 2.5);
    dot.style.animationDelay = `${Math.random() * 3}s`;
    orbParticlesEl.appendChild(dot);
  }
  orbParticlesEl.classList.add("show");
}

function clearWeatherAnimLayer() {
  // remove every generated element except the reusable lightning flash div
  Array.from(weatherAnimLayerEl.children).forEach((child) => {
    if (!child.classList.contains("lightning-flash")) child.remove();
  });
  stopLightning();
}

function generateRain(count) {
  for (let i = 0; i < count; i++) {
    const drop = document.createElement("div");
    drop.className = "raindrop";
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.height = `${14 + Math.random() * 18}px`;
    drop.style.animationDuration = `${0.5 + Math.random() * 0.6}s`;
    drop.style.animationDelay = `${Math.random() * 2}s`;
    weatherAnimLayerEl.appendChild(drop);
  }
}

function generateSnow(count) {
  for (let i = 0; i < count; i++) {
    const flake = document.createElement("div");
    flake.className = "snowflake";
    const size = 3 + Math.random() * 4;
    flake.style.left = `${Math.random() * 100}%`;
    flake.style.width = `${size}px`;
    flake.style.height = `${size}px`;
    flake.style.animationDuration = `${6 + Math.random() * 8}s`;
    flake.style.animationDelay = `${Math.random() * 6}s`;
    flake.style.setProperty("--drift", `${Math.random() * 60 - 30}px`);
    weatherAnimLayerEl.appendChild(flake);
  }
}

function generateClouds(count) {
  for (let i = 0; i < count; i++) {
    const cloud = document.createElement("div");
    cloud.className = "cloud-shape";
    const size = 140 + Math.random() * 160;
    cloud.style.top = `${5 + Math.random() * 30}%`;
    cloud.style.width = `${size}px`;
    cloud.style.height = `${size * 0.5}px`;
    cloud.style.animationDuration = `${40 + Math.random() * 40}s`;
    cloud.style.animationDelay = `${Math.random() * -40}s`; // negative = starts mid-animation
    weatherAnimLayerEl.appendChild(cloud);
  }
}

function generateFog(count) {
  for (let i = 0; i < count; i++) {
    const band = document.createElement("div");
    band.className = "fog-band";
    band.style.top = `${10 + i * (80 / count) + Math.random() * 6}%`;
    band.style.animationDuration = `${6 + Math.random() * 4}s`;
    band.style.animationDelay = `${Math.random() * 3}s`;
    weatherAnimLayerEl.appendChild(band);
  }
}

function generateParticles(count) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "light-particle";
    const size = 4 + Math.random() * 6;
    p.style.left = `${Math.random() * 100}%`;
    p.style.top = `${10 + Math.random() * 60}%`;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.animationDuration = `${3 + Math.random() * 3}s`;
    p.style.animationDelay = `${Math.random() * 4}s`;
    weatherAnimLayerEl.appendChild(p);
  }
}

function startLightning() {
  lightningInterval = setInterval(() => {
    if (Math.random() < 0.4) {
      lightningFlashEl.classList.remove("flash");
      void lightningFlashEl.offsetWidth; // forces the browser to restart the animation
      lightningFlashEl.classList.add("flash");
    }
  }, 3500);
}

function stopLightning() {
  if (lightningInterval) {
    clearInterval(lightningInterval);
    lightningInterval = null;
  }
  lightningFlashEl.classList.remove("flash");
}


/* ---------------------------------------------------------------------
   12. FORECAST RENDERING
   The free /forecast endpoint gives us weather in 3-hour steps for the
   next 5 days (40 entries total) — no true "hourly" or single daily
   summary, so we build both views ourselves from that same list.
   --------------------------------------------------------------------- */
function displayHourlyForecast(forecastData, tzOffset) {
  hourlyContainerEl.innerHTML = "";

  const entries = forecastData.list.slice(0, 8); // next 24 hours, 3-hour steps
  entries.forEach((entry) => {
    const localDate = toCityDate(entry.dt, tzOffset);
    const hourLabel = localDate.toLocaleTimeString("en-US", { hour: "numeric", hour12: true, timeZone: "UTC" });
    const temp = convertTemp(entry.main.temp);
    const conditionKey = mapCondition(entry.weather[0].main, entry.weather[0].icon);

    const card = document.createElement("div");
    card.className = "hour-card";
    card.innerHTML = `
      <span class="hour-time">${hourLabel}</span>
      <span class="hour-icon" aria-hidden="true">${weatherEmojis[conditionKey]}</span>
      <span class="hour-temp">${Math.round(temp)}°</span>
    `;
    hourlyContainerEl.appendChild(card);
  });

  // "chance of rain" stat card uses the very next forecast slot
  if (entries[0]) {
    const pop = entries[0].pop !== undefined ? Math.round(entries[0].pop * 100) : 0;
    rainChanceValueEl.textContent = `${pop}%`;
  }
}

function displayForecast(forecastData, tzOffset) {
  const groupedByDay = groupForecastByDay(forecastData.list, tzOffset);
  const dayKeys = Object.keys(groupedByDay).slice(0, 5);

  dailyContainerEl.innerHTML = "";

  dayKeys.forEach((key) => {
    const entries = groupedByDay[key];
    const temps = entries.map((e) => e.main.temp);
    const minC = Math.min(...temps);
    const maxC = Math.max(...temps);
    const representative = pickRepresentativeEntry(entries, tzOffset);
    const conditionKey = mapCondition(representative.weather[0].main, representative.weather[0].icon);
    const dateObj = toCityDate(representative.dt, tzOffset);

    const min = convertTemp(minC);
    const max = convertTemp(maxC);

    const card = document.createElement("div");
    card.className = "day-card";
    card.innerHTML = `
      <span class="day-name">${dateObj.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</span>
      <span class="day-date">${dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span>
      <span class="day-icon" aria-hidden="true">${weatherEmojis[conditionKey]}</span>
      <span class="day-condition">${capitalize(representative.weather[0].description)}</span>
      <span class="day-temps">
        <span class="day-temp-max">${Math.round(max)}°</span>
        <span class="day-temp-min">${Math.round(min)}°</span>
      </span>
    `;
    dailyContainerEl.appendChild(card);
  });
}

// Groups the 3-hour forecast entries into buckets by local calendar date
function groupForecastByDay(list, tzOffset) {
  const groups = {};
  list.forEach((entry) => {
    const localDate = toCityDate(entry.dt, tzOffset);
    const key = localDate.toISOString().slice(0, 10); // "YYYY-MM-DD"
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  });
  return groups;
}

// Picks the entry closest to 1PM local time to represent the whole day's
// icon/condition — midday is usually the most "typical" reading
function pickRepresentativeEntry(entries, tzOffset) {
  let best = entries[0];
  let smallestDiff = Infinity;
  entries.forEach((entry) => {
    const localHour = toCityDate(entry.dt, tzOffset).getUTCHours();
    const diff = Math.abs(localHour - 13);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      best = entry;
    }
  });
  return best;
}


/* ---------------------------------------------------------------------
   13. AIR QUALITY + UV INDEX
   Both fail quietly and fall back to "N/A" — some free-tier API keys
   don't include UV data (it lives behind the One Call 3.0 endpoint),
   so the app should never break just because one extra stat is missing.
   --------------------------------------------------------------------- */
async function displayAQI(lat, lon) {
  try {
    const params = new URLSearchParams({ lat, lon, appid: API_KEY });
    const res = await fetch(`${AIR_POLLUTION_URL}?${params.toString()}`);
    if (!res.ok) throw new Error("AQI request failed");
    const data = await res.json();
    const aqi = data.list[0].main.aqi; // 1 (Good) through 5 (Very Poor)
    const labels = { 1: "Good", 2: "Fair", 3: "Moderate", 4: "Poor", 5: "Very Poor" };
    aqiValueEl.textContent = labels[aqi] || "N/A";
  } catch (err) {
    console.warn("Couldn't load air quality data:", err);
    aqiValueEl.textContent = "N/A";
  }
}

async function displayUVIndex(lat, lon) {
  try {
    const params = new URLSearchParams({
      lat,
      lon,
      appid: API_KEY,
      units: "metric",
      exclude: "minutely,hourly,daily,alerts",
    });
    const res = await fetch(`${ONE_CALL_URL}?${params.toString()}`);
    if (!res.ok) throw new Error("UV request failed");
    const data = await res.json();
    uvValueEl.textContent = Math.round(data.current.uvi);
  } catch (err) {
    console.warn("UV Index isn't available on this API plan:", err);
    uvValueEl.textContent = "N/A";
  }
}


/* ---------------------------------------------------------------------
   14. SUN PATH
   --------------------------------------------------------------------- */
function displaySunTimes(data) {
  const sunrise = toCityDate(data.sys.sunrise, data.timezone);
  const sunset = toCityDate(data.sys.sunset, data.timezone);

  sunriseTimeEl.textContent = sunrise.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  sunsetTimeEl.textContent = sunset.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

  // 0 = sunrise, 1 = sunset — clamp so the dot doesn't fly off the arc
  // before sunrise or after sunset
  const nowUnix = Math.floor(Date.now() / 1000);
  let progress = (nowUnix - data.sys.sunrise) / (data.sys.sunset - data.sys.sunrise);
  progress = Math.max(0, Math.min(1, progress));

  // Walking along the actual SVG path (instead of doing our own trig)
  // guarantees the dot always sits exactly on the curve, even if the
  // arc's shape changes later.
  const pathLength = sunArcPathEl.getTotalLength();
  const point = sunArcPathEl.getPointAtLength(pathLength * progress);
  sunDotEl.setAttribute("cx", point.x);
  sunDotEl.setAttribute("cy", point.y);
}


/* ---------------------------------------------------------------------
   15. FAVORITES + SEARCH HISTORY
   Both are just small arrays of { name, country, lat, lon } saved to
   localStorage, so everything persists between visits.
   --------------------------------------------------------------------- */
function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
  } catch {
    return [];
  }
}
function saveFavorites(list) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
}
function isFavorite(name, country) {
  return getFavorites().some((f) => f.name === name && f.country === country);
}
function addFavorite(favorite) {
  const list = getFavorites();
  if (!isFavorite(favorite.name, favorite.country)) {
    list.unshift(favorite);
    saveFavorites(list);
  }
}
function removeFavorite(name, country) {
  saveFavorites(getFavorites().filter((f) => !(f.name === name && f.country === country)));
}

function toggleFavoriteCurrentCity() {
  if (!currentWeatherData) return;
  const { name } = currentWeatherData;
  const country = currentWeatherData.sys.country;
  const { lat, lon } = currentWeatherData.coord;

  if (isFavorite(name, country)) {
    removeFavorite(name, country);
  } else {
    addFavorite({ name, country, lat, lon });
  }
  updateFavoriteButtonState(name, country);
  displayFavorites();
}

function updateFavoriteButtonState(name, country) {
  const active = isFavorite(name, country);
  favoriteBtnEl.classList.toggle("active", active);
  favoriteBtnEl.setAttribute("aria-pressed", active ? "true" : "false");
}

function displayFavorites() {
  const favorites = getFavorites();
  // only clear the chips we generated, keep the "empty state" message in the DOM
  favoritesContainerEl.querySelectorAll(".favorite-chip").forEach((el) => el.remove());

  favoritesEmptyEl.hidden = favorites.length > 0;

  favorites.forEach((fav) => {
    const chip = document.createElement("div");
    chip.className = "favorite-chip";
    chip.innerHTML = `
      <span class="chip-label">❤️ ${fav.name}</span>
      <button class="chip-remove" type="button" aria-label="Remove ${fav.name} from favorites">&times;</button>
    `;
    chip.querySelector(".chip-label").addEventListener("click", () => fetchWeather({ lat: fav.lat, lon: fav.lon }));
    chip.querySelector(".chip-remove").addEventListener("click", (e) => {
      e.stopPropagation();
      removeFavorite(fav.name, fav.country);
      displayFavorites();
      if (currentWeatherData) updateFavoriteButtonState(currentWeatherData.name, currentWeatherData.sys.country);
    });
    favoritesContainerEl.appendChild(chip);
  });
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}
function saveHistory(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}
function addToSearchHistory(entry) {
  let history = getHistory().filter((h) => !(h.name === entry.name && h.country === entry.country));
  history.unshift(entry);
  history = history.slice(0, 8); // keep the list from growing forever
  saveHistory(history);
}

function displaySearchHistory() {
  const history = getHistory();
  historyContainerEl.querySelectorAll(".history-chip").forEach((el) => el.remove());

  historyEmptyEl.hidden = history.length > 0;

  history.forEach((item) => {
    const chip = document.createElement("div");
    chip.className = "history-chip";
    chip.innerHTML = `<span>🕓 ${item.name}${item.country ? ", " + item.country : ""}</span>`;
    chip.addEventListener("click", () => fetchWeather({ lat: item.lat, lon: item.lon }));
    historyContainerEl.appendChild(chip);
  });
}


/* ---------------------------------------------------------------------
   16. SMALL UTILITY HELPERS
   --------------------------------------------------------------------- */
function convertTemp(celsius) {
  return currentUnit === "C" ? celsius : celsius * 9 / 5 + 32;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Turns a UTC unix timestamp + a timezone offset (seconds) into a Date
// object that reads correctly as long as you use the UTC getters/
// timeZone:"UTC" option afterwards. This sidesteps the visitor's own
// timezone entirely, which is exactly what we want since we're always
// showing time for the *searched* city, not the person viewing the page.
function toCityDate(unixSeconds, tzOffsetSeconds) {
  return new Date((unixSeconds + tzOffsetSeconds) * 1000);
}

function formatCityDateTime(tzOffsetSeconds) {
  const nowUnix = Math.floor(Date.now() / 1000);
  const cityDate = toCityDate(nowUnix, tzOffsetSeconds);
  return cityDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function showLoading() {
  loadingOverlayEl.classList.add("active");
}
function hideLoading() {
  loadingOverlayEl.classList.remove("active");
}

function showError(message) {
  errorTextEl.textContent = message;
  errorBannerEl.hidden = false;
  clearTimeout(errorTimeout);
  errorTimeout = setTimeout(clearError, 5000);
}
function clearError() {
  errorBannerEl.hidden = true;
}

function applySavedTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) document.body.dataset.theme = saved;
}

function applySavedUnit() {
  const saved = localStorage.getItem(UNIT_KEY);
  if (saved) {
    currentUnit = saved;
    updateUnitToggleUI();
  }
}
