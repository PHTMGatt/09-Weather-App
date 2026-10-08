import { Router, type Request, type Response } from 'express';
import HistoryService from '../../service/historyService.js';
import WeatherService from '../../service/weatherService.js';

const router = Router();

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected server error occurred.';
};

router.get('/locations', async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const locations = await WeatherService.searchLocations(query);
    res.status(200).json(locations);
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('Location autocomplete failed:', message);
    res.status(502).json({ message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const cityName = typeof req.body.cityName === 'string' ? req.body.cityName : '';
    const lat = Number(req.body.lat);
    const lon = Number(req.body.lon);
    const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lon);

    const weatherData = hasCoordinates
      ? await WeatherService.getWeatherForCoordinates(lat, lon)
      : await WeatherService.getWeatherForCity(cityName);

    if (cityName.trim()) {
      await HistoryService.addCity(cityName.trim());
    }

    res.status(200).json(weatherData);
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('Weather lookup failed:', message);
    res.status(502).json({ message });
  }
});

router.get('/history', async (_req: Request, res: Response) => {
  try {
    const history = await HistoryService.getCities();
    res.status(200).json(history);
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('Search history lookup failed:', message);
    res.status(500).json({ message });
  }
});

router.delete('/history/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    await HistoryService.removeCity(id);
    res.status(204).send();
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('Search history delete failed:', message);
    res.status(500).json({ message });
  }
});

export default router;
