import { WebSocket } from 'ws';

export type GameType = 'scrabble' | 'morph';

export interface Room {
  roomId: string;
  roomName: string;
  host: string;
  players: Player[];
  status: 'waiting' | 'ready' | 'playing' | 'finished';
  createdAt: string;
  gameType: GameType;
}

export interface Player {
  userId: string;
  username: string;
  socket?: WebSocket;
}

export interface WSMessage {
  type: string;
  payload: any;
}

export interface AuthPayload {
  token: string;
  userId: string;
}

export interface CreateRoomPayload {
  roomName: string;
}

export interface JoinRoomPayload {
  roomId: string;
}

export interface MakeMovePayload {
  roomId: string;
  word: string;
  startRow: number;
  startCol: number;
  direction: 'horizontal' | 'vertical';
  tiles: string[];
}

export interface PassTurnPayload {
  roomId: string;
}

export interface ExchangeTilesPayload {
  roomId: string;
  tiles: string[];
}

export interface ChatMessagePayload {
  roomId: string;
  message: string;
}
