import dotenv from 'dotenv';
dotenv.config();

// TODO: Define an interface for the Coordinates object

interface Coordinates {
  lat: number;
  lon: number;
}

// TODO: Define a class for the Weather object

class Weather {
  city: string;
  date: string;
  icon: string;
  iconDescription: string;
  tempF: number;
  windSpeed: number;
  humidity: number;

constructor(city: string, date: string, icon: string, iconDescription: string, tempF: number, windSpeed: number, humidity: number) {
  this.city = city;
  this.date = date;
  this.icon = icon;
  this.iconDescription = iconDescription;
  this.tempF = tempF;
  this.windSpeed = windSpeed;
  this.humidity = humidity;
}
}


// TODO: Complete the WeatherService class
class WeatherService {
  // TODO: Define the baseURL, API key, and city name properties

  private baseURL?: string;
  private apiKey?: string;
  private cityName = '';

  constructor() {
    this.baseURL = process.env.API_BASE_URL || '';
    this.apiKey = process.env.API_KEY || '';
  }

  // TODO: Create fetchLocationData method
   private async fetchLocationData(query: string) {
    const response = await fetch(query);
    let data = await response.json();
    return data[0];
   }
  // TODO: Create destructureLocationData method
   private destructureLocationData(locationData: Coordinates): Coordinates {
    let coordinates: Coordinates = {
      lat: locationData.lat,
      lon: locationData.lon,
    };
    return coordinates;
   }
  // TODO: Create buildGeocodeQuery method
   private buildGeocodeQuery(): string {
    return `${this.baseURL}/geo/1.0/direct?q=${this.cityName}&limit=1&appid=${this.apiKey}`;
   }
  // TODO: Create buildWeatherQuery method
   private buildWeatherQuery(coordinates: Coordinates): string {
    return `${this.baseURL}/data/2.5/forecast?lat=${coordinates.lat}&lon=${coordinates.lon}&appid=${this.apiKey}`;
   }
  // TODO: Create fetchAndDestructureLocationData method
   private async fetchAndDestructureLocationData() {
     const locationData = await this.fetchLocationData(this.buildGeocodeQuery());
     return this.destructureLocationData(locationData);
   }
  // TODO: Create fetchWeatherData method
   private async fetchWeatherData(coordinates: Coordinates) {
    const response = await fetch(this.buildWeatherQuery(coordinates));
    let weatherData = await response.json();
    let currentWeather = this.parseCurrentWeather(weatherData);
    let forecastArray = this.buildForecastArray(currentWeather, weatherData.list);
    return forecastArray;
   }
  // TODO: Build parseCurrentWeather method
   private parseCurrentWeather(response: any) {
    let currentWeather = response.list[0];
    let city = response.city.name;
    let date = currentWeather.dt_txt;
    let icon = currentWeather.weather[0].icon;
    let iconDescription = currentWeather.weather[0].description;
    let tempF = currentWeather.main.temp;
    let windSpeed = currentWeather.wind.speed;
    let humidity = currentWeather.main.humidity;
    return new Weather(city, date, icon, iconDescription, tempF, windSpeed, humidity);
   }
  // TODO: Complete buildForecastArray method
   private buildForecastArray(currentWeather: Weather, weatherData: any[]) {
    let forecastArray = [currentWeather];
    let filteredData = weatherData.filter((data) => data.dt_txt.includes('12:00:00'));
    filteredData.forEach((data) => {
      let date = data.dt_txt;
      let icon = data.weather[0].icon;
      let iconDescription = data.weather[0].description;
      let tempF = data.main.temp;
      let windSpeed = data.wind.speed;
      let humidity = data.main.humidity;
      forecastArray.push(new Weather(currentWeather.city, date, icon, iconDescription, tempF, windSpeed, humidity));
    });
    return forecastArray;
   }
  // TODO: Complete getWeatherForCity method
   async getWeatherForCity(city: string) {
    this.cityName = city;
    let coordinates = await this.fetchAndDestructureLocationData();
    let weatherData = await this.fetchWeatherData(coordinates);
    return weatherData;
   }
}

export default new WeatherService();
