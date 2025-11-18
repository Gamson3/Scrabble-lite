/**
 * Circle Word Game Service
 * 
 * Manages all game logic for the Circle Word Game including:
 * - Circle letter generation
 * - Word validation and scoring
 * - Round management
 * - Game state tracking
 */

import axios from 'axios';
import {
  CircleGameState,
  CircleRound,
  CirclePlayer,
  CircleGameWinner,
  PlayerWordData,
  LETTER_VALUES,
} from '../models/CircleGameState';

// In-memory storage of active games (in production, use a database)
const activeGames = new Map<string, CircleGameState>();

// Configuration
const DICTIONARY_SERVICE_URL = process.env.DICTIONARY_SERVICE_URL || 'http://localhost:3002';
const GAME_CONFIG = {
  LETTERS_PER_ROUND: 9,
  TIME_PER_ROUND: 60, // seconds
  TOTAL_ROUNDS: 3, // Default for web client (CLI sends totalRounds: 1)
  VOWELS: ['A', 'E', 'I', 'O', 'U'],
  ALL_CONSONANTS: ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'X', 'Y', 'Z'],
};

export class CircleGameService {
  /**
   * Generate a random circle of 9 letters
   * Weighted to include 3-4 vowels and 5-6 consonants for better gameplay
   */
  static generateCircle(): string[] {
    const vowelsToUse = 3 + Math.floor(Math.random() * 2); // 3 or 4 vowels
    const consonantsToUse = GAME_CONFIG.LETTERS_PER_ROUND - vowelsToUse;

    const letters: string[] = [];

    // Add random vowels
    for (let i = 0; i < vowelsToUse; i++) {
      const randomVowel = GAME_CONFIG.VOWELS[Math.floor(Math.random() * GAME_CONFIG.VOWELS.length)];
      letters.push(randomVowel);
    }

    // Add random consonants
    for (let i = 0; i < consonantsToUse; i++) {
      const randomConsonant = GAME_CONFIG.ALL_CONSONANTS[Math.floor(Math.random() * GAME_CONFIG.ALL_CONSONANTS.length)];
      letters.push(randomConsonant);
    }

    // Shuffle the letters
    return letters.sort(() => Math.random() - 0.5);
  }

  /**
   * Calculate the score for a word based on letter values
   * @param word The word to score (case-insensitive)
   * @returns Total points for the word
   */
  static calculateWordScore(word: string): number {
    return word
      .toUpperCase()
      .split('')
      .reduce((score, letter) => score + (LETTER_VALUES[letter] || 0), 0);
  }

  /**
   * Check if a word can be formed from the available circle letters
   * Each letter can only be used once
   * @param word The word to check
   * @param circleLetters The available letters in the circle
   * @returns true if word can be formed, false otherwise
   */
  static canFormWord(word: string, circleLetters: string[]): boolean {
    const availableLetters = [...circleLetters];
    const wordLetters = word.toUpperCase().split('');

    for (const letter of wordLetters) {
      const index = availableLetters.indexOf(letter);
      if (index === -1) {
        return false; // Letter not available
      }
      availableLetters.splice(index, 1); // Remove used letter
    }

    return true;
  }

  /**
   * Validate a word against the dictionary service and circle letters
   * @param word The word to validate
   * @param circleLetters The available letters in the circle
   * @returns Object with validation result
   */
  static async validateWord(
    word: string,
    circleLetters: string[]
  ): Promise<{ valid: boolean; canForm: boolean; inDictionary: boolean }> {
    // Check if word can be formed from circle letters
    const canForm = this.canFormWord(word, circleLetters);

    if (!canForm) {
      return { valid: false, canForm: false, inDictionary: false };
    }

    // Check if word is in dictionary
    try {
      const response = await axios.post(`${DICTIONARY_SERVICE_URL}/validate`, {
        word: word.toUpperCase(),
      });
      const inDictionary = response.data.valid === true;
      return {
        valid: inDictionary,
        canForm: true,
        inDictionary,
      };
    } catch (error) {
      console.error('Dictionary validation error:', error);
      return { valid: false, canForm: true, inDictionary: false };
    }
  }

  /**
   * Initialize a new circle game
   * @param roomId The room ID
   * @param playerIds Array of exactly 2 player IDs
   * @param usernames Map of user ID to username
   * @param totalRounds Optional: Number of rounds (default: 3 for web, 1 for CLI)
   * @returns The initialized game state
   */
  static startGame(
    roomId: string,
    playerIds: string[],
    usernames: Record<string, string>,
    totalRounds?: number
  ): CircleGameState {
    if (playerIds.length !== 2) {
      throw new Error('Circle game requires exactly 2 players');
    }

    // Use provided totalRounds or default to config value
    const roundsToPlay = totalRounds ?? GAME_CONFIG.TOTAL_ROUNDS;

    const gameId = `circle_${roomId}_${Date.now()}`;
    const currentTime = Date.now();
    const circleLetters = this.generateCircle();

    // Initialize player data
    const players: Record<string, CirclePlayer> = {};
    playerIds.forEach((userId) => {
      players[userId] = {
        userId,
        username: usernames[userId] || `Player ${userId.substring(0, 4)}`,
        totalScore: 0,
        roundsWon: 0,
        currentRoundWords: [],
      };
    });

    // Initialize first round
    const firstRound: CircleRound = {
      roundNumber: 1,
      circleLetters,
      startTime: currentTime,
      durationSeconds: GAME_CONFIG.TIME_PER_ROUND,
      playerWords: {
        [playerIds[0]]: [],
        [playerIds[1]]: [],
      },
    };

    const gameState: CircleGameState = {
      gameId,
      roomId,
      gameStatus: 'active',
      isGameActive: true,
      roundNumber: 1,
      totalRounds: roundsToPlay,
      currentRound: firstRound,
      roundHistory: [],
      playerIds,
      players,
      createdAt: currentTime,
      startedAt: currentTime,
      lettersPerRound: GAME_CONFIG.LETTERS_PER_ROUND,
      timePerRound: GAME_CONFIG.TIME_PER_ROUND,
      totalRoundsToPlay: roundsToPlay,
    };

    activeGames.set(roomId, gameState);
    return gameState;
  }

  /**
   * Submit a word from a player
   * @param roomId The room ID
   * @param userId The player's user ID
   * @param word The word to submit
   * @returns Updated game state or null if game not found
   */
  static async submitWord(
    roomId: string,
    userId: string,
    word: string
  ): Promise<{ isValid: boolean; score: number; gameState: CircleGameState | null }> {
    const gameState = activeGames.get(roomId);

    if (!gameState) {
      return { isValid: false, score: 0, gameState: null };
    }

    // Check if round time has expired
    const timeElapsed = Date.now() - gameState.currentRound.startTime;
    const timeRemaining = gameState.currentRound.durationSeconds * 1000 - timeElapsed;
    
    if (timeRemaining <= 0) {
      // Timer expired - reject the word
      return { isValid: false, score: 0, gameState };
    }

    // Validate the word
    const validation = await this.validateWord(word, gameState.currentRound.circleLetters);

    if (!validation.valid) {
      return { isValid: false, score: 0, gameState };
    }

    // Check for duplicates (word already submitted in this round)
    const playerWords = gameState.currentRound.playerWords[userId] || [];
    const isDuplicate = playerWords.some((w) => w.word.toUpperCase() === word.toUpperCase());

    if (isDuplicate) {
      return { isValid: false, score: 0, gameState };
    }

    // Calculate score
    const score = this.calculateWordScore(word);

    // Add word to game state
    if (!gameState.currentRound.playerWords[userId]) {
      gameState.currentRound.playerWords[userId] = [];
    }

    const wordData: PlayerWordData = {
      word: word.toUpperCase(),
      submittedAt: Date.now(),
      score,
    };

    gameState.currentRound.playerWords[userId].push(wordData);
    gameState.players[userId].currentRoundWords.push(wordData);

    return { isValid: true, score, gameState };
  }

  /**
   * End the current round and determine the winner
   * @param roomId The room ID
   * @returns Object with round winner and updated game state
   */
  static endRound(roomId: string): {
    roundWinner: CircleGameWinner | null;
    gameState: CircleGameState | null;
    isGameFinished: boolean;
  } {
    const gameState = activeGames.get(roomId);

    if (!gameState) {
      return { roundWinner: null, gameState: null, isGameFinished: false };
    }

    // Calculate round scores for each player
    const roundScores: Record<string, number> = {};

    gameState.playerIds.forEach((userId) => {
      const playerWords = gameState.currentRound.playerWords[userId] || [];
      const roundScore = playerWords.reduce((total, word) => total + word.score, 0);
      roundScores[userId] = roundScore;
      gameState.players[userId].totalScore += roundScore;
    });

    // Determine round winner (highest score)
    let roundWinnerId = gameState.playerIds[0];
    let highestScore = roundScores[roundWinnerId];
    let isTie = false;

    for (const userId of gameState.playerIds) {
      if (roundScores[userId] > highestScore) {
        highestScore = roundScores[userId];
        roundWinnerId = userId;
        isTie = false;
      } else if (roundScores[userId] === highestScore && userId !== roundWinnerId) {
        isTie = true;
      }
    }

    // Update round state
    gameState.currentRound.roundWinner = roundWinnerId;
    gameState.currentRound.roundScores = roundScores;
    // Only increment roundsWon if there's a clear winner (not a tie)
    if (!isTie && highestScore > 0) {
      gameState.players[roundWinnerId].roundsWon += 1;
    }

    // Move to next round or finish game
    let isGameFinished = false;
    if (gameState.roundNumber < gameState.totalRoundsToPlay) {
      // Start next round
      gameState.roundNumber += 1;
      gameState.roundHistory.push(gameState.currentRound);

      const nextRound: CircleRound = {
        roundNumber: gameState.roundNumber,
        circleLetters: this.generateCircle(),
        startTime: Date.now(),
        durationSeconds: GAME_CONFIG.TIME_PER_ROUND,
        playerWords: {
          [gameState.playerIds[0]]: [],
          [gameState.playerIds[1]]: [],
        },
      };

      gameState.currentRound = nextRound;
      gameState.gameStatus = 'active';
    } else {
      // Game finished
      isGameFinished = true;
      gameState.roundHistory.push(gameState.currentRound);
      gameState.gameStatus = 'finished';
      gameState.isGameActive = false;
      gameState.finishedAt = Date.now();

      // Check for draw based on total scores
      const player1 = gameState.players[gameState.playerIds[0]];
      const player2 = gameState.players[gameState.playerIds[1]];
      const isDraw = player1.totalScore === player2.totalScore;

      // Determine overall winner (most rounds won, or total score if tied)
      let overallWinnerId: string;
      if (isDraw) {
        // It's a draw, pick first player as nominal winner for data structure
        overallWinnerId = gameState.playerIds[0];
      } else {
        overallWinnerId = player1.totalScore > player2.totalScore ? player1.userId : player2.userId;
      }

      const winnerData = gameState.players[overallWinnerId];
      gameState.gameWinner = {
        userId: winnerData.userId,
        username: winnerData.username,
        totalScore: winnerData.totalScore,
        roundsWon: winnerData.roundsWon,
      };
      gameState.isDraw = isDraw;

      gameState.finalScores = {};
      gameState.playerIds.forEach((userId) => {
        gameState.finalScores![userId] = gameState.players[userId].totalScore;
      });
    }

    const roundWinner: CircleGameWinner = {
      userId: roundWinnerId,
      username: gameState.players[roundWinnerId].username,
      totalScore: gameState.players[roundWinnerId].totalScore,
      roundsWon: gameState.players[roundWinnerId].roundsWon,
    };

    return { roundWinner, gameState, isGameFinished };
  }

  /**
   * Get the current game state for a room
   * @param roomId The room ID
   * @returns The game state or null if game doesn't exist
   */
  static getGameState(roomId: string): CircleGameState | null {
    return activeGames.get(roomId) || null;
  }

  /**
   * Remove a game from active games (called when game finishes)
   * @param roomId The room ID
   */
  static deleteGame(roomId: string): void {
    activeGames.delete(roomId);
  }

  /**
   * Get all active games (for debugging/monitoring)
   */
  static getAllGames(): CircleGameState[] {
    return Array.from(activeGames.values());
  }

  /**
   * Clear all games (for testing/reset)
   */
  static clearAllGames(): void {
    activeGames.clear();
  }
}

export default CircleGameService;
