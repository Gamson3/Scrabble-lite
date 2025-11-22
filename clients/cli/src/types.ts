/**
 * Shared TypeScript types for CLI client
 */

export interface UserSession {
  userId: string;
  username: string;
  token: string;
}

export interface AuthResponse {
  userId: string;
  username: string;
  token: string;
  expiresAt?: string | null;
}

export interface Room {
  roomId: string;
  roomName: string;
  hostId: string;
  playerCount: number;
  status: 'waiting' | 'active' | 'finished';
  players: Array<{ userId: string; username: string }>;
}

export interface CircleGameState {
  roomId: string;
  gameStatus: 'waiting' | 'active' | 'finished';
  roundNumber: number;
  totalRounds: number;
  currentRound: {
    circleLetters: string[];
    playerWords: Record<string, Array<{ word: string; score: number }>>;
    roundStartTime: string;
    roundEndTime: string;
  };
  players: Record<
    string,
    {
      userId: string;
      username: string;
      totalScore: number;
      roundsWon: number;
      currentRoundWords: Array<{ word: string; score: number }>;
    }
  >;
}

export interface WordSubmissionResult {
  isValid: boolean;
  word: string;
  score?: number;
  message: string;
  gameState?: CircleGameState;
}
