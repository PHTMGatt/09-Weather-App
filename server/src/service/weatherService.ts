import dotenv from 'dotenv';
dotenv.config();

interface Coordinates {
  lat: number;
  lon: number;
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
  private baseURL: string;
  private apiKey: string;
  private cityName = '';

  constructor() {
    this.baseURL =
      process.env.API_BASE_URL?.replace(/\/$/, '') ||
      'https://api.openweathermap.org';
    this.apiKey = process.env.API_KEY || '';
  }

  private ensureConfigured(): void {
    if (!this.apiKey) {
      throw new Error('Weather API key is not configured.');
    }
  }

  private async fetchJson<T>(query: string): Promise<T> {
    const response = await fetch(query);

    if (!response.ok) {
      throw new Error(
        `Weather provider request failed with status ${response.status}.`
      );
    }

    return (await response.json()) as T;
  }

  private async fetchLocationData(query: string) {
    const data = await this.fetchJson<Coordinates[]>(query);

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`No location found for "${this.cityName}".`);
    }

    return data[0];
  }

  private destructureLocationData(locationData: Coordinates): Coordinates {
    return {
      lat: locationData.lat,
      lon: locationData.lon,
    };
  }

  private buildGeocodeQuery(): string {
    return `${this.baseURL}/geo/1.0/direct?q=${encodeURIComponent(
      this.cityName
    )}&limit=1&appid=${this.apiKey}`;
  }

  private buildWeatherQuery(coordinates: Coordinates): string {
    return `${this.baseURL}/data/2.5/forecast?lat=${coordinates.lat}&lon=${coordinates.lon}&units=imperial&appid=${this.apiKey}`;
  }

  private async fetchAndDestructureLocationData(): Promise<Coordinates> {
    const locationData = await this.fetchLocationData(this.buildGeocodeQuery());
    return this.destructureLocationData(locationData);
  }

  private async fetchWeatherData(
    coordinates: Coordinates
  ): Promise<Weather[]> {
    const weatherData = await this.fetchJson<OpenWeatherForecastResponse>(
      this.buildWeatherQuery(coordinates)
    );

    if (!weatherData.list?.length || !weatherData.city?.name) {
      throw new Error('Weather provider returned incomplete forecast data.');
    }

    const currentWeather = this.parseCurrentWeather(weatherData);
    return this.buildForecastArray(currentWeather, weatherData.list);
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

  private parseCurrentWeather(response: OpenWeatherForecastResponse): Weather {
    const currentWeather = response.list[0];

    return new Weather(
      response.city.name,
      this.formatDate(currentWeather.dt_txt),
      currentWeather.weather[0]?.icon || '01d',
      currentWeather.weather[0]?.description || 'Weather conditions',
      currentWeather.main.temp,
      currentWeather.wind.speed,
      currentWeather.main.humidity
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
