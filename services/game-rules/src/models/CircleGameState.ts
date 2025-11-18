/**
 * Circle Word Game - State Models and Constants
 * 
 * Defines the data structures for the Circle Word Game where players
 * have 60 seconds to form valid words from a circle of 9 letters.
 * Scoring is based on letter values (Scrabble-style).
 */

/**
 * Letter value mapping - Scrabble-style scoring
 * Maps each letter A-Z to its point value
 */
export const LETTER_VALUES: Record<string, number> = {
  A: 1,
  B: 3,
  C: 3,
  D: 2,
  E: 1,
  F: 4,
  G: 2,
  H: 4,
  I: 1,
  J: 8,
  K: 5,
  L: 1,
  M: 3,
  N: 1,
  O: 1,
  P: 3,
  Q: 10,
  R: 1,
  S: 1,
  T: 1,
  U: 1,
  V: 4,
  W: 4,
  X: 8,
  Y: 4,
  Z: 10,
};

/**
 * Interface for a single player's word submission
 */
export interface PlayerWordData {
  word: string;
  submittedAt: number; // Timestamp in milliseconds
  score: number; // Letter value sum
}

/**
 * Interface for a single player in the game
 */
export interface CirclePlayer {
  userId: string;
  username: string;
  totalScore: number; // Across all rounds
  roundsWon: number; // Count of rounds won
  currentRoundWords: PlayerWordData[]; // Words submitted in current round
}

/**
 * Interface for a single round of the game
 */
export interface CircleRound {
  roundNumber: number; // 1, 2, or 3
  circleLetters: string[]; // 9 letters in the circle
  startTime: number; // Timestamp when round started
  durationSeconds: number; // Always 60 for standard game
  playerWords: Record<string, PlayerWordData[]>; // userId -> array of words
  roundWinner?: string; // userId of round winner
  roundScores?: Record<string, number>; // userId -> round score
}

/**
 * Interface for game winner information
 */
export interface CircleGameWinner {
  userId: string;
  username: string;
  totalScore: number;
  roundsWon: number;
}

/**
 * Main interface for the entire Circle Game state
 * Managed by CircleGameService and stored in a Map by roomId
 */
export interface CircleGameState {
  // Game identifiers
  gameId: string; // Unique game ID
  roomId: string; // Associated room ID

  // Game status
  gameStatus: 'pending' | 'active' | 'round_ended' | 'finished'; // Current game state
  isGameActive: boolean; // True while game is running

  // Round information
  roundNumber: number; // Current round (1, 2, or 3)
  totalRounds: number; // Always 3 for best-of-3
  currentRound: CircleRound; // Current round state
  roundHistory: CircleRound[]; // Previous rounds

  // Player information
  playerIds: string[]; // List of player user IDs
  players: Record<string, CirclePlayer>; // userId -> player data

  // Game outcome
  gameWinner?: CircleGameWinner; // Set when game is finished
  finalScores?: Record<string, number>; // userId -> total score at end
  isDraw?: boolean; // True if game ended in a draw (equal scores)

  // Timestamps
  createdAt: number; // When game was created
  startedAt?: number; // When first round started
  finishedAt?: number; // When game completed

  // Game configuration
  lettersPerRound: number; // Always 9
  timePerRound: number; // Always 60 seconds
  totalRoundsToPlay: number; // Always 3
}

/**
 * Request/Response types for HTTP endpoints
 */
export interface StartGameRequest {
  roomId: string;
  playerIds: string[];
  usernames: Record<string, string>; // userId -> username
  totalRounds?: number; // Optional: 1 for CLI, 3 for web (default)
}

export interface StartGameResponse {
  success: boolean;
  gameState: CircleGameState;
  message: string;
}

export interface SubmitWordRequest {
  roomId: string;
  userId: string;
  word: string;
}

export interface SubmitWordResponse {
  success: boolean;
  word: string;
  isValid: boolean;
  score: number;
  message: string;
  gameState?: CircleGameState;
}

export interface GetGameStateResponse {
  gameState: CircleGameState | null;
  message: string;
}

export interface EndRoundRequest {
  roomId: string;
}

export interface EndRoundResponse {
  success: boolean;
  roundWinner: CircleGameWinner;
  message: string;
  gameState: CircleGameState;
  isGameFinished: boolean;
}

/**
 * WebSocket message payloads
 */
export interface CircleStartGamePayload {
  roomId: string;
  gameState: CircleGameState;
}

export interface CircleWordSubmittedPayload {
  roomId: string;
  userId: string;
  word: string;
  score: number;
  gameState: CircleGameState;
}

export interface CircleRoundEndedPayload {
  roomId: string;
  roundWinner: CircleGameWinner;
  gameState: CircleGameState;
}

export interface CircleGameOverPayload {
  roomId: string;
  gameWinner: CircleGameWinner;
  finalScores: Record<string, number>;
  gameState: CircleGameState;
}
