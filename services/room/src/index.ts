import express, { Express, Request, Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { setupWebSocket } from './websocket/websocketHandler';
import roomRoutes from './routes/roomRoutes';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

app.use((req: Request, res: Response, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

app.use('/rooms', roomRoutes);

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'room-service',
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

const server = createServer(app);

const wss = new WebSocketServer({ server });
setupWebSocket(wss);

server.listen(PORT, () => {
  console.log(`✅ Room Service (HTTP) running on http://localhost:${PORT}`);
  console.log(`🔌 Room Service (WebSocket) running on ws://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;
