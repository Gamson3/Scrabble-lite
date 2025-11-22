import { CircleGameWebSocketClient } from './websocket-client';

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

export type GameEventCallback = (payload: any) => void;

/**
 * Manages Circle Word Game operations via WebSocket
 * Handles game start, word submission, round management, and game completion
 */
export class CircleGameHandler {
  private ws: CircleGameWebSocketClient;
  private gameState: CircleGameState | null = null;
  private roundTimer: NodeJS.Timeout | null = null;
  private timeRemaining: number = 60;
  private onGameStartedCallbacks: GameEventCallback[] = [];
  private onWordSubmittedCallbacks: GameEventCallback[] = [];
  private onRoundEndedCallbacks: GameEventCallback[] = [];
  private onGameEndedCallbacks: GameEventCallback[] = [];
  private onTimerTickCallbacks: Array<(remaining: number) => void> = [];

  constructor(ws: CircleGameWebSocketClient) {
    this.ws = ws;
    this.setupMessageHandlers();
  }

  /**
   * Start a circle game (requires 2 players in room)
   */
  startGame(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for game start'));
      }, 5000);

      const handler = (payload: any) => {
        clearTimeout(timeout);
        this.ws.off('circle_game_started', handler);
        this.gameState = payload.gameState;
        this.timeRemaining = 60;
        this.startTimer();
        this.notifyGameStarted();
        resolve();
      };

      this.ws.on('circle_game_started', handler);
      this.ws.send('circle_start_game', { roomId });
    });
  }

  /**
   * Submit a word during an active game
   */
  submitWord(word: string): Promise<WordSubmissionResult> {
    return new Promise((resolve, reject) => {
      if (!this.gameState) {
        reject(new Error('Game not active'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for word validation'));
      }, 3000);

      const handler = (payload: any) => {
        clearTimeout(timeout);
        this.ws.off('circle_word_submitted', handler);

        if (payload.gameState) {
          this.gameState = payload.gameState;
        }

        const result: WordSubmissionResult = {
          isValid: payload.isValid,
          word: payload.word,
          score: payload.score,
          message: payload.message,
          gameState: payload.gameState,
        };

        this.notifyWordSubmitted(result);
        resolve(result);
      };

      this.ws.on('circle_word_submitted', handler);
      this.ws.send('circle_submit_word', {
        roomId: this.gameState.roomId,
        word: word.toUpperCase(),
      });
    });
  }

  /**
   * End the current round
   */
  endRound(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.gameState) {
        reject(new Error('Game not active'));
        return;
      }

      this.stopTimer();

      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for round end'));
      }, 3000);

      const handler = (payload: any) => {
        clearTimeout(timeout);
        this.ws.off('circle_round_ended', handler);

        if (payload.gameState) {
          this.gameState = payload.gameState;
        }

        this.notifyRoundEnded(payload);
        resolve();
      };

      this.ws.on('circle_round_ended', handler);
      this.ws.send('circle_end_round', {
        roomId: this.gameState.roomId,
      });
    });
  }

  /**
   * Get current game state
   */
  getGameState(): CircleGameState | null {
    return this.gameState;
  }

  /**
   * Get circle letters
   */
  getCircleLetters(): string[] {
    return this.gameState?.currentRound?.circleLetters || [];
  }

  /**
   * Get player scores
   */
  getPlayerScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    if (this.gameState?.players) {
      Object.values(this.gameState.players).forEach((player) => {
        scores[player.username] = player.totalScore;
      });
    }
    return scores;
  }

  /**
   * Get current round words
   */
  getCurrentRoundWords(userId: string): Array<{ word: string; score: number }> {
    return this.gameState?.players[userId]?.currentRoundWords || [];
  }

  /**
   * Get time remaining in round
   */
  getTimeRemaining(): number {
    return this.timeRemaining;
  }

  /**
   * Check if game is active
   */
  isGameActive(): boolean {
    return this.gameState?.gameStatus === 'active';
  }

  /**
   * Register callbacks
   */

  onGameStarted(callback: GameEventCallback): void {
    this.onGameStartedCallbacks.push(callback);
  }

  onWordSubmitted(callback: GameEventCallback): void {
    this.onWordSubmittedCallbacks.push(callback);
  }

  onRoundEnded(callback: GameEventCallback): void {
    this.onRoundEndedCallbacks.push(callback);
  }

  onGameEnded(callback: GameEventCallback): void {
    this.onGameEndedCallbacks.push(callback);
  }

  onTimerTick(callback: (remaining: number) => void): void {
    this.onTimerTickCallbacks.push(callback);
  }

  /**
   * Private methods
   */

  private setupMessageHandlers(): void {
    this.ws.on('circle_game_started', (payload) => {
      this.gameState = payload.gameState;
      this.timeRemaining = 60;
      this.startTimer();
      this.notifyGameStarted();
    });

    this.ws.on('circle_word_submitted', (payload) => {
      if (payload.gameState) {
        this.gameState = payload.gameState;
      }

      const result: WordSubmissionResult = {
        isValid: payload.isValid,
        word: payload.word,
        score: payload.score,
        message: payload.message,
        gameState: payload.gameState,
      };

      this.notifyWordSubmitted(result);
    });

    this.ws.on('circle_round_ended', (payload) => {
      this.stopTimer();
      if (payload.gameState) {
        this.gameState = payload.gameState;
      }
      this.notifyRoundEnded(payload);
    });

    this.ws.on('circle_game_ended', (payload) => {
      this.stopTimer();
      this.gameState = null;
      this.notifyGameEnded(payload);
    });
  }

  private startTimer(): void {
    this.stopTimer();
    this.timeRemaining = 60;

    this.roundTimer = setInterval(() => {
      this.timeRemaining--;
      this.onTimerTickCallbacks.forEach((cb) => cb(this.timeRemaining));

      if (this.timeRemaining <= 0) {
        this.stopTimer();
        // Auto-end round when timer reaches 0
        this.endRound().catch((error) => {
          console.error('Error ending round:', error);
        });
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
  }

  private notifyGameStarted(): void {
    this.onGameStartedCallbacks.forEach((cb) => cb(this.gameState));
  }

  private notifyWordSubmitted(result: WordSubmissionResult): void {
    this.onWordSubmittedCallbacks.forEach((cb) => cb(result));
  }

  private notifyRoundEnded(payload: any): void {
    this.onRoundEndedCallbacks.forEach((cb) => cb(payload));
  }

  private notifyGameEnded(payload: any): void {
    this.onGameEndedCallbacks.forEach((cb) => cb(payload));
  }
}
