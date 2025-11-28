export type ColorFeedback = 'green' | 'yellow' | 'gray';
export type BranchingLevel = 'high' | 'medium' | 'low';

// Minimal room and session types
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

// ==================== WORD RUSH ⚡ GAME TYPES ====================

export interface PlayerWordData {
  word: string;
  submittedAt: number;
  score: number;
}

export interface CirclePlayer {
  userId: string;
  username: string;
  totalScore: number;
  roundsWon: number;
  currentRoundWords: PlayerWordData[];
}

export interface CircleRound {
  roundNumber: number;
  circleLetters: string[];
  startTime: number;
  durationSeconds: number;
  playerWords: Record<string, PlayerWordData[]>;
  roundWinner?: string;
  roundScores?: Record<string, number>;
}

export interface CircleGameWinner {
  userId: string;
  username: string;
  totalScore: number;
  roundsWon: number;
}

export interface CircleGameState {
  gameId: string;
  roomId: string;
  gameStatus: 'pending' | 'active' | 'round_ended' | 'finished';
  isGameActive: boolean;
  roundNumber: number;
  totalRounds: number;
  currentRound: CircleRound;
  roundHistory: CircleRound[];
  playerIds: string[];
  players: Record<string, CirclePlayer>;
  gameWinner?: CircleGameWinner;
  finalScores?: Record<string, number>;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  lettersPerRound: number;
  timePerRound: number;
  totalRoundsToPlay: number;
}

// Backwards-compatible aliases expected by App.tsx
export type UserSession = Session

export type Room = RoomSummary
