import './styles/jass.css';

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

const searchForm = document.getElementById('search-form') as HTMLFormElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const searchButton = document.getElementById('search-button') as HTMLButtonElement;
const feedbackEl = document.getElementById('search-feedback') as HTMLParagraphElement;
const todayContainer = document.querySelector('#today') as HTMLDivElement;
const forecastContainer = document.querySelector('#forecast') as HTMLDivElement;
const searchHistoryContainer = document.getElementById('history') as HTMLDivElement;
const heading = document.getElementById('search-title') as HTMLHeadingElement;
const weatherIcon = document.getElementById('weather-img') as HTMLImageElement;
const tempEl = document.getElementById('temp') as HTMLParagraphElement;
const windEl = document.getElementById('wind') as HTMLParagraphElement;
const humidityEl = document.getElementById('humidity') as HTMLParagraphElement;

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

const fetchWeather = async (cityName: string): Promise<void> => {
  const weatherData = await requestJson<WeatherRecord[]>('/api/weather/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cityName }),
  });

  if (!Array.isArray(weatherData) || weatherData.length === 0) {
    throw new Error('No weather data was returned for that city.');
  }

  renderCurrentWeather(weatherData[0]);
  renderForecast(weatherData.slice(1, 6));
};

const fetchSearchHistory = async (): Promise<HistoryCity[]> =>
  requestJson<HistoryCity[]>('/api/weather/history');

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
  const search = searchInput.value.trim();

  if (!search) {
    setFeedback('Enter a city name to search.', 'error');
    searchInput.focus();
    return;
  }

  setLoading(true);
  setFeedback(`Loading weather for ${search}…`);

  try {
    await fetchWeather(search);
    await getAndRenderHistory();
    setFeedback(`Weather updated for ${search}.`, 'success');
    searchInput.value = '';
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load weather right now.';
    setFeedback(message, 'error');
  } finally {
    setLoading(false);
  }
};

const handleSearchHistoryClick = async (event: MouseEvent): Promise<void> => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const historyButton = target.closest<HTMLButtonElement>('.history-btn');
  if (!historyButton) return;

  const city = historyButton.dataset.cityName;
  if (!city) return;

  setLoading(true);
  setFeedback(`Loading weather for ${city}…`);

  try {
    await fetchWeather(city);
    setFeedback(`Weather updated for ${city}.`, 'success');
  } catch (error) {
    setFeedback(
      error instanceof Error ? error.message : 'Unable to load weather right now.',
      'error'
    );
  } finally {
    setLoading(false);
  }
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

searchForm.addEventListener('submit', handleSearchFormSubmit);
searchHistoryContainer.addEventListener('click', (event) => {
  void handleSearchHistoryClick(event);
  void handleDeleteHistoryClick(event);
});

void getAndRenderHistory();
