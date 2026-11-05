// podmienic
const API_KEY = "96c92166aeb306ed041cd54c029e2647";

/* MICROSOFT COPILOT BEGIN */
const form = document.querySelector("#weather-form");
const locationInput = document.querySelector("#location");
const statusMessage = document.querySelector("#status");
const currentSection = document.querySelector("#current-section");
const currentWeather = document.querySelector("#current-weather");
const forecastSection = document.querySelector("#forecast-section");
const forecastContainer = document.querySelector("#forecast");

let activeRequest = 0;

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const location = locationInput.value.trim();

  if (!location) {
    statusMessage.textContent = "Wpisz nazwę miejscowości.";
    locationInput.focus();
    return;
  }

  const requestId = ++activeRequest;
  const query = new URLSearchParams({
    q: location,
    appid: API_KEY,
    units: "metric",
    lang: "pl",
  });
  const currentUrl = `https://api.openweathermap.org/data/2.5/weather?${query}`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?${query}`;

  statusMessage.textContent = "Pobieranie prognozy…";
  currentSection.hidden = true;
  forecastSection.hidden = true;
  currentWeather.replaceChildren();
  forecastContainer.replaceChildren();

  const currentRequest = getCurrentWeather(currentUrl);
  const forecastRequest = getForecast(forecastUrl);

  currentRequest
    .then((data) => {
      if (requestId !== activeRequest) return;
      renderCurrentWeather(data);
      currentSection.hidden = false;
    })
    .catch((error) => {
      if (requestId === activeRequest) {
        statusMessage.textContent = error.message;
      }
    });

  forecastRequest
    .then((data) => {
      if (requestId !== activeRequest) return;
      renderForecast(data);
      forecastSection.hidden = false;
    })
    .catch((error) => {
      if (requestId === activeRequest) {
        statusMessage.textContent = error.message;
      }
    });

  Promise.allSettled([currentRequest, forecastRequest]).then((results) => {
    if (requestId !== activeRequest) return;
    if (results.every((result) => result.status === "fulfilled")) {
      statusMessage.textContent = "";
    }
  });
});

function getCurrentWeather(url) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", url);
    request.responseType = "json";

    request.addEventListener("load", () => {
      console.log(request.response);
      if (request.status >= 200 && request.status < 300) {
        resolve(request.response);
        return;
      }
      reject(new Error(getApiError(request.response)));
    });
    request.addEventListener("error", () => {
      reject(new Error("Nie udało się połączyć z serwisem pogodowym."));
    });
    request.addEventListener("timeout", () => {
      reject(new Error("Serwis pogodowy nie odpowiedział na czas."));
    });
    request.timeout = 10000;
    request.send();
  });
}

async function getForecast(url) {
  const response = await fetch(url);
  const data = await response.json();
  console.log(response);

  if (!response.ok) {
    throw new Error(getApiError(data));
  }
  return data;
}

function getApiError(data) {
  if (data?.cod === "401" || data?.cod === 401) {
    return "Klucz API jest nieprawidłowy. Sprawdź własny klucz w pliku scripts.js.";
  }
  if (data?.cod === "404" || data?.cod === 404) {
    return "Nie znaleziono takiej miejscowości. Sprawdź pisownię i spróbuj ponownie.";
  }
  return data?.message
    ? `Nie udało się pobrać pogody: ${data.message}.`
    : "Nie udało się pobrać danych pogodowych. Spróbuj ponownie.";
}

function renderCurrentWeather(data) {
  const weather = data.weather[0];
  const card = document.createElement("article");
  card.className = "current-card";

  const place = document.createElement("div");
  place.className = "current-place";
  place.textContent = [data.name, data.sys.country].filter(Boolean).join(", ");

  const summary = document.createElement("div");
  summary.className = "current-summary";

  const icon = createWeatherIcon(weather.icon, weather.description);
  icon.classList.add("current-icon");

  const temperature = document.createElement("p");
  temperature.className = "current-temperature";
  temperature.textContent = `${Math.round(data.main.temp)}°`;

  const details = document.createElement("div");
  details.className = "current-details";
  const description = document.createElement("p");
  description.className = "weather-description";
  description.textContent = capitalize(weather.description);
  const feelsLike = document.createElement("p");
  feelsLike.textContent = `Odczuwalna ${Math.round(data.main.feels_like)}°C`;
  const humidity = document.createElement("p");
  humidity.textContent = `Wilgotność ${data.main.humidity}%`;

  details.append(description, feelsLike, humidity);
  summary.append(icon, temperature, details);
  card.append(place, summary);
  currentWeather.replaceChildren(card);
}

function renderForecast(data) {
  const dailyForecasts = groupForecastByDay(data.list, data.city.timezone);
  const cards = dailyForecasts.map((day) => {
    const card = document.createElement("article");
    card.className = "forecast-card";

    const date = document.createElement("h3");
    date.textContent = new Intl.DateTimeFormat("pl-PL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(day.date);

    const icon = createWeatherIcon(day.representative.weather[0].icon, day.representative.weather[0].description);
    icon.classList.add("forecast-icon");

    const description = document.createElement("p");
    description.className = "weather-description";
    description.textContent = capitalize(day.representative.weather[0].description);

    const temperatures = document.createElement("p");
    temperatures.className = "forecast-temperatures";
    const high = document.createElement("strong");
    high.textContent = `${Math.round(day.max)}°`;
    const low = document.createElement("span");
    low.textContent = `${Math.round(day.min)}°`;
    temperatures.append(high, low);

    card.append(date, icon, description, temperatures);
    return card;
  });

  forecastContainer.replaceChildren(...cards);
}

function groupForecastByDay(entries, timezoneOffset) {
  const days = new Map();

  entries.forEach((entry) => {
    const localDate = new Date((entry.dt + timezoneOffset) * 1000);
    const key = localDate.toISOString().slice(0, 10);

    if (!days.has(key)) {
      days.set(key, {
        date: new Date(`${key}T12:00:00Z`),
        min: entry.main.temp_min,
        max: entry.main.temp_max,
        representative: entry,
      });
    }

    const day = days.get(key);
    day.min = Math.min(day.min, entry.main.temp_min);
    day.max = Math.max(day.max, entry.main.temp_max);
    const representativeTime = new Date((day.representative.dt + timezoneOffset) * 1000);
    if (Math.abs(localDate.getUTCHours() - 12) < Math.abs(representativeTime.getUTCHours() - 12)) {
      day.representative = entry;
    }
  });

  return [...days.values()].slice(0, 5);
}

function createWeatherIcon(iconCode, description) {
  const icon = document.createElement("img");
  icon.src = `https://openweathermap.org/img/wn/${encodeURIComponent(iconCode)}@2x.png`;
  icon.alt = description;
  icon.width = 80;
  icon.height = 80;
  return icon;
}

function capitalize(text) {
  return text.charAt(0).toLocaleUpperCase("pl-PL") + text.slice(1);
}

/* MICROSOFT COPILOT END */
