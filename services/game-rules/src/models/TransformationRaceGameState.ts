// TransformationRaceGameState.ts
// Strictly matches the GDD for Transformation Race

export interface MoveHistoryEntry {
  player: string; // userId
  word: string;
  feedback: string[]; // e.g. ["gray","green",...]
  timestamp: string;
}

export interface TransformationRaceGameState {
  gameId: string;
  players: string[]; // [p1, p2]
  targetWord: string;
  currentWord: string;
  turn: string; // userId
  round: number;
  history: MoveHistoryEntry[];
  status: 'ongoing' | 'ended';
  winner: string | null;
  usedWords: string[];
  startWord: string;
  timerExpiresAt?: number;
}
