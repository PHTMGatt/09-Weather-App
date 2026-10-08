import './styles/jass.css';
import './styles/autocomplete.css';

interface WeatherRecord {
  city: string;
  date: string;
  icon: string;
  iconDescription: string;
  tempF: number;
  windSpeed: number;
  humidity: number;
}

interface HistoryCity {
  id: string;
  name: string;
}

interface LocationSuggestion {
  name: string;
  state?: string;
  country: string;
  lat: number;
  lon: number;
  label: string;
}

const searchForm = document.getElementById('search-form') as HTMLFormElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const searchButton = document.getElementById('search-button') as HTMLButtonElement;
const feedbackEl = document.getElementById('search-feedback') as HTMLParagraphElement;
const suggestionsContainer = document.getElementById(
  'location-suggestions'
) as HTMLDivElement;
const todayContainer = document.querySelector('#today') as HTMLDivElement;
const forecastContainer = document.querySelector('#forecast') as HTMLDivElement;
const searchHistoryContainer = document.getElementById('history') as HTMLDivElement;
const heading = document.getElementById('search-title') as HTMLHeadingElement;
const weatherIcon = document.getElementById('weather-img') as HTMLImageElement;
const tempEl = document.getElementById('temp') as HTMLParagraphElement;
const windEl = document.getElementById('wind') as HTMLParagraphElement;
const humidityEl = document.getElementById('humidity') as HTMLParagraphElement;

let suggestions: LocationSuggestion[] = [];
let activeSuggestionIndex = -1;
let suggestionTimer: number | undefined;
let suggestionController: AbortController | null = null;

const setFeedback = (
  message = '',
  state: 'info' | 'error' | 'success' = 'info'
): void => {
  feedbackEl.textContent = message;
  feedbackEl.dataset.state = state;
};

const setLoading = (loading: boolean): void => {
  searchButton.disabled = loading;
  searchButton.textContent = loading ? 'Searching…' : 'Search';
  searchInput.setAttribute('aria-busy', String(loading));
};

const requestJson = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload.message === 'string'
        ? payload.message
        : 'The weather service could not complete that request.';
    throw new Error(message);
  }

  return payload as T;
};

const fetchWeather = async (
  cityName: string,
  location?: Pick<LocationSuggestion, 'lat' | 'lon'>
): Promise<void> => {
  const weatherData = await requestJson<WeatherRecord[]>('/api/weather/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cityName,
      ...(location ? { lat: location.lat, lon: location.lon } : {}),
    }),
  });

  if (!Array.isArray(weatherData) || weatherData.length === 0) {
    throw new Error('No weather data was returned for that city.');
  }

  renderCurrentWeather(weatherData[0]);
  renderForecast(weatherData.slice(1, 6));
};

const fetchSearchHistory = async (): Promise<HistoryCity[]> =>
  requestJson<HistoryCity[]>('/api/weather/history');

const fetchLocationSuggestions = async (
  query: string,
  signal: AbortSignal
): Promise<LocationSuggestion[]> =>
  requestJson<LocationSuggestion[]>(
    `/api/weather/locations?q=${encodeURIComponent(query)}`,
    { signal }
  );

const deleteCityFromHistory = async (id: string): Promise<void> => {
  const response = await fetch(`/api/weather/history/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Could not remove that city from search history.');
  }
};

const renderCurrentWeather = (currentWeather: WeatherRecord): void => {
  const { city, date, icon, iconDescription, tempF, windSpeed, humidity } =
    currentWeather;

  heading.textContent = `${city} · ${date}`;
  weatherIcon.src = `https://openweathermap.org/img/wn/${icon}@2x.png`;
  weatherIcon.alt = iconDescription;
  weatherIcon.hidden = false;
  heading.append(weatherIcon);

  tempEl.textContent = `Temperature  ${Math.round(tempF)}°F`;
  windEl.textContent = `Wind  ${Math.round(windSpeed)} mph`;
  humidityEl.textContent = `Humidity  ${humidity}%`;

  todayContainer.replaceChildren(heading, tempEl, windEl, humidityEl);
};

const renderForecast = (forecast: WeatherRecord[]): void => {
  forecastContainer.replaceChildren();

  if (!forecast.length) {
    return;
  }

  const headingCol = document.createElement('div');
  const forecastHeading = document.createElement('h4');
  headingCol.className = 'col-12';
  forecastHeading.textContent = '5-Day Forecast';
  headingCol.append(forecastHeading);
  forecastContainer.append(headingCol);

  forecast.forEach(renderForecastCard);
};

const renderForecastCard = (forecast: WeatherRecord): void => {
  const { date, icon, iconDescription, tempF, windSpeed, humidity } = forecast;
  const { col, cardTitle, iconEl, temp, wind, humidityText } =
    createForecastCard();

  cardTitle.textContent = date;
  iconEl.src = `https://openweathermap.org/img/wn/${icon}@2x.png`;
  iconEl.alt = iconDescription;
  temp.textContent = `Temperature  ${Math.round(tempF)}°F`;
  wind.textContent = `Wind  ${Math.round(windSpeed)} mph`;
  humidityText.textContent = `Humidity  ${humidity}%`;

  forecastContainer.append(col);
};

const renderSearchHistory = (historyList: HistoryCity[]): void => {
  searchHistoryContainer.replaceChildren();

  if (!historyList.length) {
    const emptyState = document.createElement('p');
    emptyState.className = 'text-center';
    emptyState.textContent = 'Your recent searches will appear here.';
    searchHistoryContainer.append(emptyState);
    return;
  }

  [...historyList].reverse().forEach((city) => {
    searchHistoryContainer.append(buildHistoryListItem(city));
  });
};

const hideSuggestions = (): void => {
  suggestionsContainer.hidden = true;
  searchInput.setAttribute('aria-expanded', 'false');
  searchInput.removeAttribute('aria-activedescendant');
  activeSuggestionIndex = -1;
};

const updateActiveSuggestion = (nextIndex: number): void => {
  const buttons = Array.from(
    suggestionsContainer.querySelectorAll<HTMLButtonElement>('.location-suggestion')
  );

  if (!buttons.length) return;

  activeSuggestionIndex = Math.max(0, Math.min(nextIndex, buttons.length - 1));

  buttons.forEach((button, index) => {
    const isActive = index === activeSuggestionIndex;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  const activeButton = buttons[activeSuggestionIndex];
  searchInput.setAttribute('aria-activedescendant', activeButton.id);
  activeButton.scrollIntoView({ block: 'nearest' });
};

const renderLocationSuggestions = (locations: LocationSuggestion[]): void => {
  suggestions = locations;
  suggestionsContainer.replaceChildren();
  activeSuggestionIndex = -1;

  if (!locations.length) {
    hideSuggestions();
    return;
  }

  locations.forEach((location, index) => {
    const button = document.createElement('button');
    const copy = document.createElement('span');
    const name = document.createElement('span');
    const meta = document.createElement('span');

    button.type = 'button';
    button.id = `location-suggestion-${index}`;
    button.className = 'location-suggestion';
    button.dataset.index = String(index);
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', 'false');

    copy.className = 'location-suggestion__copy';
    name.className = 'location-suggestion__name';
    meta.className = 'location-suggestion__meta';

    name.textContent = location.name;
    meta.textContent = [location.state, location.country].filter(Boolean).join(', ');

    copy.append(name, meta);
    button.append(copy);
    suggestionsContainer.append(button);
  });

  suggestionsContainer.hidden = false;
  searchInput.setAttribute('aria-expanded', 'true');
};

const queueLocationSuggestions = (): void => {
  const query = searchInput.value.trim();

  window.clearTimeout(suggestionTimer);
  suggestionController?.abort();

  if (query.length < 2) {
    suggestions = [];
    hideSuggestions();
    return;
  }

  suggestionTimer = window.setTimeout(async () => {
    suggestionController = new AbortController();

    try {
      const locations = await fetchLocationSuggestions(
        query,
        suggestionController.signal
      );

      if (searchInput.value.trim() === query) {
        renderLocationSuggestions(locations);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      hideSuggestions();
    }
  }, 250);
};

const runWeatherSearch = async (
  cityName: string,
  location?: LocationSuggestion
): Promise<void> => {
  const cleanCity = cityName.trim();

  if (!cleanCity) {
    setFeedback('Enter a city name to search.', 'error');
    searchInput.focus();
    return;
  }

  hideSuggestions();
  setLoading(true);
  setFeedback(`Loading weather for ${cleanCity}…`);

  try {
    await fetchWeather(cleanCity, location);
    await getAndRenderHistory();
    setFeedback(`Weather updated for ${cleanCity}.`, 'success');
    searchInput.value = cleanCity;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load weather right now.';
    setFeedback(message, 'error');
  } finally {
    setLoading(false);
  }
};

const selectLocationSuggestion = async (index: number): Promise<void> => {
  const location = suggestions[index];
  if (!location) return;

  searchInput.value = location.label;
  await runWeatherSearch(location.label, location);
};

const createForecastCard = () => {
  const col = document.createElement('div');
  const card = document.createElement('article');
  const cardBody = document.createElement('div');
  const cardTitle = document.createElement('h5');
  const iconEl = document.createElement('img');
  const temp = document.createElement('p');
  const wind = document.createElement('p');
  const humidityText = document.createElement('p');

  col.className = 'col-auto';
  card.className = 'forecast-card card';
  cardBody.className = 'card-body';
  cardTitle.className = 'card-title';
  temp.className = 'card-text';
  wind.className = 'card-text';
  humidityText.className = 'card-text';

  cardBody.append(cardTitle, iconEl, temp, wind, humidityText);
  card.append(cardBody);
  col.append(card);

  return { col, cardTitle, iconEl, temp, wind, humidityText };
};

const createHistoryButton = (city: HistoryCity): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'history-btn btn col-10';
  button.dataset.cityName = city.name;
  button.textContent = city.name;
  return button;
};

const createDeleteButton = (city: HistoryCity): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fas fa-trash-alt delete-city btn col-2';
  button.dataset.cityId = city.id;
  button.setAttribute('aria-label', `Remove ${city.name} from search history`);
  return button;
};

const buildHistoryListItem = (city: HistoryCity): HTMLDivElement => {
  const historyDiv = document.createElement('div');
  historyDiv.className = 'display-flex gap-2 m-1';
  historyDiv.append(createHistoryButton(city), createDeleteButton(city));
  return historyDiv;
};

const getAndRenderHistory = async (): Promise<void> => {
  try {
    renderSearchHistory(await fetchSearchHistory());
  } catch {
    setFeedback('Search history is temporarily unavailable.', 'error');
  }
};

const handleSearchFormSubmit = async (event: SubmitEvent): Promise<void> => {
  event.preventDefault();
  await runWeatherSearch(searchInput.value);
};

const handleSearchHistoryClick = async (event: MouseEvent): Promise<void> => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const historyButton = target.closest<HTMLButtonElement>('.history-btn');
  if (!historyButton) return;

  const city = historyButton.dataset.cityName;
  if (!city) return;

  searchInput.value = city;
  await runWeatherSearch(city);
};

const handleDeleteHistoryClick = async (event: MouseEvent): Promise<void> => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const deleteButton = target.closest<HTMLButtonElement>('.delete-city');
  if (!deleteButton) return;

  event.stopPropagation();
  const cityId = deleteButton.dataset.cityId;
  if (!cityId) return;

  try {
    await deleteCityFromHistory(cityId);
    await getAndRenderHistory();
    setFeedback('Search removed.', 'success');
  } catch (error) {
    setFeedback(
      error instanceof Error ? error.message : 'Unable to update search history.',
      'error'
    );
  }
};

searchForm.addEventListener('submit', (event) => {
  void handleSearchFormSubmit(event);
});

searchInput.addEventListener('input', queueLocationSuggestions);

searchInput.addEventListener('keydown', (event) => {
  if (suggestionsContainer.hidden || !suggestions.length) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    updateActiveSuggestion(
      activeSuggestionIndex < 0 ? 0 : activeSuggestionIndex + 1
    );
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    updateActiveSuggestion(
      activeSuggestionIndex < 0
        ? suggestions.length - 1
        : activeSuggestionIndex - 1
    );
  } else if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
    event.preventDefault();
    void selectLocationSuggestion(activeSuggestionIndex);
  } else if (event.key === 'Escape') {
    hideSuggestions();
  }
});

suggestionsContainer.addEventListener('mousedown', (event) => {
  event.preventDefault();
});

suggestionsContainer.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const button = target.closest<HTMLButtonElement>('.location-suggestion');
  if (!button) return;

  const index = Number(button.dataset.index);
  if (!Number.isInteger(index)) return;

  void selectLocationSuggestion(index);
});

searchHistoryContainer.addEventListener('click', (event) => {
  void handleSearchHistoryClick(event);
  void handleDeleteHistoryClick(event);
});

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Node)) return;

  if (!searchForm.contains(target)) {
    hideSuggestions();
  }
});

void getAndRenderHistory();
