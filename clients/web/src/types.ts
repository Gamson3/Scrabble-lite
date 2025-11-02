export type ColorFeedback = 'green' | 'yellow' | 'gray';
export type BranchingLevel = 'high' | 'medium' | 'low';

export interface WordInsight {
  word: string;
  neighborCount: number;
  branchLevel: BranchingLevel;
  neighborSample: string[];
  distanceToTarget?: number;
}

export interface HintSuggestion extends WordInsight {
  category: 'distance' | 'safe' | 'structure';
  distanceDelta: number;
}

export interface HintBudget {
  used: number;
  remaining: number;
  limit: number;
}

export interface TransformationStep {
  word: string;
  feedback?: ColorFeedback[];
  timestamp: string;
  branchLevel?: BranchingLevel;
  neighborCount?: number;
  distanceToTarget?: number;
}

export interface PlayerProgress {
  userId: string;
  username: string;
  currentWord: string;
  path: TransformationStep[];
  completed: boolean;
  transformationCount: number;
  lastInsight?: WordInsight;
  hintsUsed?: number;
}

export interface MorphGameState {
  startWord: string;
  targetWord: string;
  startWordMeta?: WordInsight;
  targetWordMeta?: WordInsight;
  players: Record<string, PlayerProgress>;
  currentPlayer: string;
  turnCount: number;
  gameStatus: 'active' | 'finished';
  winner?: string;
  insightByPlayer?: Record<string, WordInsight | undefined>;
}

export interface RoomsListItem {
  roomId: string;
  roomName: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
}

export interface RoomSummary {
  roomId: string;
  roomName: string;
  host: string;
  players: Array<{ userId: string; username: string }>;
  status: string;
  gameType?: string;
}

export interface ChatBroadcast {
  roomId: string;
  userId: string;
  username: string;
  message: string;
  timestamp: string;
}

export interface Session {
  userId: string;
  username: string;
  token: string;
}

// Backwards-compatible aliases expected by App.tsx
export type UserSession = Session

export type Room = RoomSummary
