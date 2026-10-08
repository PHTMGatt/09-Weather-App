import dotenv from 'dotenv';
dotenv.config();

interface Coordinates {
  lat: number;
  lon: number;
}

interface GeocodeLocation extends Coordinates {
  name: string;
  country: string;
  state?: string;
}

export interface LocationSuggestion extends Coordinates {
  name: string;
  country: string;
  state?: string;
  label: string;
}

interface OpenWeatherForecastItem {
  dt_txt: string;
  main: {
    temp: number;
    humidity: number;
  };
  weather: Array<{
    icon: string;
    description: string;
  }>;
  wind: {
    speed: number;
  };
}

interface OpenWeatherForecastResponse {
  city: {
    name: string;
  };
  list: OpenWeatherForecastItem[];
}

interface OpenWeatherCurrentResponse {
  name: string;
  dt: number;
  timezone: number;
  main: {
    temp: number;
    humidity: number;
  };
  weather: Array<{
    icon: string;
    description: string;
  }>;
  wind: {
    speed: number;
  };
}

class Weather {
  city: string;
  date: string;
  icon: string;
  iconDescription: string;
  tempF: number;
  windSpeed: number;
  humidity: number;

  constructor(
    city: string,
    date: string,
    icon: string,
    iconDescription: string,
    tempF: number,
    windSpeed: number,
    humidity: number
  ) {
    this.city = city;
    this.date = date;
    this.icon = icon;
    this.iconDescription = iconDescription;
    this.tempF = tempF;
    this.windSpeed = windSpeed;
    this.humidity = humidity;
  }
}

class WeatherService {
  private readonly baseURL = 'https://api.openweathermap.org';
  private readonly usStateCodes = new Set([
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    'DC',
  ]);
  private apiKey: string;
  private cityName = '';

  constructor() {
    this.apiKey = process.env.API_KEY || '';
  }

  private ensureConfigured(): void {
    if (!this.apiKey) {
      throw new Error('Weather API key is not configured.');
    }
  }

  private async fetchJson<T>(query: string): Promise<T> {
    const response = await fetch(query);
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const providerMessage =
        payload && typeof payload.message === 'string'
          ? payload.message
          : `HTTP ${response.status}`;

      throw new Error(
        `Weather provider request failed (${response.status}): ${providerMessage}`
      );
    }

    return payload as T;
  }

  private normalizeGeocodeLocation(cityName: string): string {
    const parts = cityName
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 2) {
      const stateCode = parts[1].toUpperCase();
      if (this.usStateCodes.has(stateCode)) {
        return `${parts[0]},${stateCode},US`;
      }
    }

    return cityName;
  }

  private buildGeocodeQuery(cityName = this.cityName, limit = 1): string {
    const location = this.normalizeGeocodeLocation(cityName);

    return `${this.baseURL}/geo/1.0/direct?q=${encodeURIComponent(
      location
    )}&limit=${limit}&appid=${this.apiKey}`;
  }

  private buildForecastQuery(coordinates: Coordinates): string {
    return `${this.baseURL}/data/2.5/forecast?lat=${coordinates.lat}&lon=${coordinates.lon}&units=imperial&appid=${this.apiKey}`;
  }

  private buildCurrentWeatherQuery(coordinates: Coordinates): string {
    return `${this.baseURL}/data/2.5/weather?lat=${coordinates.lat}&lon=${coordinates.lon}&units=imperial&appid=${this.apiKey}`;
  }

  private async fetchLocationData(query: string): Promise<GeocodeLocation> {
    const data = await this.fetchJson<GeocodeLocation[]>(query);

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`No location found for \"${this.cityName}\".`);
    }

    return data[0];
  }

  private async fetchAndDestructureLocationData(): Promise<Coordinates> {
    const locationData = await this.fetchLocationData(this.buildGeocodeQuery());
    return {
      lat: locationData.lat,
      lon: locationData.lon,
    };
  }

  private async fetchWeatherData(
    coordinates: Coordinates
  ): Promise<Weather[]> {
    const [currentData, forecastData] = await Promise.all([
      this.fetchJson<OpenWeatherCurrentResponse>(
        this.buildCurrentWeatherQuery(coordinates)
      ),
      this.fetchJson<OpenWeatherForecastResponse>(
        this.buildForecastQuery(coordinates)
      ),
    ]);

    if (!currentData.name || !currentData.main || !currentData.weather?.length) {
      throw new Error('Weather provider returned incomplete current conditions.');
    }

    if (!forecastData.list?.length || !forecastData.city?.name) {
      throw new Error('Weather provider returned incomplete forecast data.');
    }

    const currentWeather = this.parseCurrentWeather(currentData);
    return this.buildForecastArray(currentWeather, forecastData.list);
  }

  private formatDate(value: string): string {
    const date = new Date(value.replace(' ', 'T') + 'Z');

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
  }

  private formatLocalCurrentDate(timestamp: number, timezoneOffset: number): string {
    const localDate = new Date((timestamp + timezoneOffset) * 1000);

    return localDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }

  private parseCurrentWeather(response: OpenWeatherCurrentResponse): Weather {
    return new Weather(
      response.name,
      this.formatLocalCurrentDate(response.dt, response.timezone),
      response.weather[0]?.icon || '01d',
      response.weather[0]?.description || 'Weather conditions',
      response.main.temp,
      response.wind.speed,
      response.main.humidity
    );
  }

  private buildForecastArray(
    currentWeather: Weather,
    weatherData: OpenWeatherForecastItem[]
  ): Weather[] {
    const forecastArray = [currentWeather];

    weatherData
      .filter((data) => data.dt_txt.includes('12:00:00'))
      .slice(0, 5)
      .forEach((data) => {
        forecastArray.push(
          new Weather(
            currentWeather.city,
            this.formatDate(data.dt_txt),
            data.weather[0]?.icon || '01d',
            data.weather[0]?.description || 'Weather conditions',
            data.main.temp,
            data.wind.speed,
            data.main.humidity
          )
        );
      });

    return forecastArray;
  }

  async searchLocations(query: string): Promise<LocationSuggestion[]> {
    this.ensureConfigured();

    const cleanQuery = query?.trim();
    if (!cleanQuery || cleanQuery.length < 2) {
      return [];
    }

    const locations = await this.fetchJson<GeocodeLocation[]>(
      this.buildGeocodeQuery(cleanQuery, 5)
    );

    const seen = new Set<string>();

    return locations
      .map((location) => {
        const details = [location.name, location.state, location.country].filter(
          Boolean
        ) as string[];
        const label = details.join(', ');

        const suggestion: LocationSuggestion = {
          name: location.name,
          country: location.country,
          lat: location.lat,
          lon: location.lon,
          label,
        };

        if (location.state) {
          suggestion.state = location.state;
        }

        return suggestion;
      })
      .filter((location) => {
        const key = `${location.label}|${location.lat.toFixed(3)}|${location.lon.toFixed(3)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  async getWeatherForCoordinates(
    lat: number,
    lon: number
  ): Promise<Weather[]> {
    this.ensureConfigured();

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error('Valid coordinates are required.');
    }

    return this.fetchWeatherData({ lat, lon });
  }

  async getWeatherForCity(city: string): Promise<Weather[]> {
    this.ensureConfigured();

    const cleanCity = city?.trim();
    if (!cleanCity) {
      throw new Error('City name is required.');
    }

    this.cityName = cleanCity;
    const coordinates = await this.fetchAndDestructureLocationData();
    return this.fetchWeatherData(coordinates);
  }
}

export default new WeatherService();
