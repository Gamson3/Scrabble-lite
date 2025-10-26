import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import dictionaryRoutes from './routes/dictionaryRoutes';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.use((req: Request, res: Response, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

app.use('/', dictionaryRoutes);

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'dictionary-service',
    timestamp: new Date().toISOString(),
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('[ERROR]', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  });
});

app.listen(PORT, () => {
  console.log(`✅ Dictionary Service running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;
