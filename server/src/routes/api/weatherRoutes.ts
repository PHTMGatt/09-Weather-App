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

router.post('/', async (req: Request, res: Response) => {
  try {
    const cityName = req.body.cityName;
    const weatherData = await WeatherService.getWeatherForCity(cityName);
    await HistoryService.addCity(cityName);
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
