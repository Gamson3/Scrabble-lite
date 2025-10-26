import { Router, Request, Response } from 'express';
import { roomService } from '../services/roomService';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const rooms = roomService.listRooms().map(r => ({
    roomId: r.roomId,
    roomName: r.roomName,
    playerCount: r.players.length,
    status: r.status,
  }));
  res.json({ rooms });
});

router.get('/stats', (req: Request, res: Response) => {
  res.json(roomService.getStats());
});

export default router;
