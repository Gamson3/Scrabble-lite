import axios from 'axios';
import { GameState, BoardCell } from '../models/GameState';
import { createTileBag, drawTiles } from '../utils/tiles';

const DICTIONARY_SERVICE_URL = process.env.DICTIONARY_SERVICE_URL || 'http://localhost:3002';

interface DictionaryValidateResponse {
  word: string;
  valid: boolean;
  suggestions?: string[];
}

interface DictionaryValidationResult {
  ok: boolean;
  valid: boolean;
  errorMessage?: string;
}

async function isWordValid(word: string): Promise<DictionaryValidationResult> {
  try {
    const response = await axios.post<DictionaryValidateResponse>(
      `${DICTIONARY_SERVICE_URL}/validate`,
      { word }
    );
    return { ok: true, valid: !!response.data.valid };
  } catch (error: any) {
    const message = error?.response?.data?.error?.message || error?.message || 'Dictionary service unavailable';
    console.error('Dictionary validation failed:', message);
    return { ok: false, valid: false, errorMessage: message };
  }
}

function getWordleFeedback(word: string, target: string): string[] {
  const feedback = Array(word.length).fill('gray');
  const targetLetters = target.split('');
  const used = Array(target.length).fill(false);

  for (let i = 0; i < word.length; i++) {
    if (word[i] === targetLetters[i]) {
      feedback[i] = 'green';
      used[i] = true;
      targetLetters[i] = '_';
    }
  }

  for (let i = 0; i < word.length; i++) {
    if (feedback[i] === 'green') continue;
    const idx = targetLetters.indexOf(word[i]);
    if (idx !== -1 && !used[idx]) {
      feedback[i] = 'yellow';
      used[idx] = true;
      targetLetters[idx] = '_';
    }
  }

  return feedback;
}

class GameService {
  private games: Map<string, GameState & { bag: string[] }> = new Map();

  startGame(roomId: string, playerIds: string[]): GameState {
    const size = 7;
    const board: BoardCell[][] = Array.from({ length: size }, () => Array(size).fill(null));

    let bag = createTileBag();
    const racks: Record<string, string[]> = {};
    for (const pid of playerIds) {
      const { drawn, remaining } = drawTiles(bag, 5);
      racks[pid] = drawn;
      bag = remaining;
    }

    const scores: Record<string, number> = {};
    for (const pid of playerIds) {
      scores[pid] = 0;
    }

    const game: GameState & { bag: string[] } = {
      roomId,
      board,
      racks,
      scores,
      currentPlayer: playerIds[0],
      turnCount: 0,
      gameStatus: 'active',
      passCount: 0,
      bag,
    };

    this.games.set(roomId, game);
    return this.getState(roomId)!;
  }

  getState(roomId: string): GameState | undefined {
    const game = this.games.get(roomId);
    if (!game) return undefined;
    const { bag, ...rest } = game;
    return rest;
  }

  passTurn(roomId: string, userId: string): GameState {
    const game = this.games.get(roomId);
    if (!game) {
      const err: any = new Error('No game found for this room. The game may not have started yet.');
      err.code = 'GAME_NOT_FOUND';
      throw err;
    }
    if (game.currentPlayer !== userId) {
      const err: any = new Error('It is not your turn. Please wait for your turn.');
      err.code = 'NOT_YOUR_TURN';
      throw err;
    }

    const rack = game.racks[userId];
    if (rack.length > 0) {
      game.bag.push(...rack);
      const { drawn, remaining } = drawTiles(game.bag, rack.length);
      game.racks[userId] = drawn;
      game.bag = remaining;
    }

    const players = Object.keys(game.racks);
    const nextIdx = (players.indexOf(userId) + 1) % players.length;
    game.currentPlayer = players[nextIdx];
    game.turnCount += 1;
    game.passCount += 1;

    return this.getState(roomId)!;
  }

  async makeMove(
    roomId: string,
    userId: string,
    word: string,
    startRow: number,
    startCol: number,
    direction: 'horizontal' | 'vertical',
    tiles: string[]
  ): Promise<any> {
    const game = this.games.get(roomId);
    if (!game) {
      const err: any = new Error('No game found for this room. The game may not have started yet.');
      err.code = 'GAME_NOT_FOUND';
      throw err;
    }
    if (game.gameStatus !== 'active') {
      const err: any = new Error('The game is not active.');
      err.code = 'GAME_NOT_ACTIVE';
      throw err;
    }
    if (game.currentPlayer !== userId) {
      const err: any = new Error('It is not your turn. Please wait for your turn.');
      err.code = 'NOT_YOUR_TURN';
      throw err;
    }

    if (direction !== 'horizontal' && direction !== 'vertical') {
      throw new Error('Invalid direction');
    }

    const upperWord = word.toUpperCase();
    const validation = await isWordValid(word);
    if (!validation.ok) {
      const err: any = new Error(
        `Dictionary service error: ${validation.errorMessage || 'Unable to validate word right now.'}`
      );
      err.code = 'DICTIONARY_SERVICE_ERROR';
      throw err;
    }
    if (!validation.valid) {
      return { valid: false, errors: [{ message: 'Word not in dictionary' }] };
    }

    const size = 7;
    if (
      startRow < 0 || startRow >= size ||
      startCol < 0 || startCol >= size ||
      (direction === 'horizontal' && startCol + upperWord.length > size) ||
      (direction === 'vertical' && startRow + upperWord.length > size)
    ) {
      return { valid: false, errors: [{ message: 'Word out of bounds' }] };
    }

    const rack = game.racks[userId].slice();
    const board = game.board;
    let canPlace = true;
    const usedTiles: string[] = [];
    for (let i = 0; i < upperWord.length; i++) {
      const r = direction === 'horizontal' ? startRow : startRow + i;
      const c = direction === 'horizontal' ? startCol + i : startCol;
      const boardCell = board[r][c];
      const letter = upperWord[i];
      if (boardCell) {
        if (boardCell !== letter) {
          canPlace = false;
          break;
        }
      } else {
        const rackIdx = rack.indexOf(letter);
        if (rackIdx === -1) {
          canPlace = false;
          break;
        }
        usedTiles.push(letter);
        rack.splice(rackIdx, 1);
      }
    }
    if (!canPlace) {
      return { valid: false, errors: [{ message: 'Tiles not available in rack or board conflict' }] };
    }

    for (let i = 0; i < upperWord.length; i++) {
      const r = direction === 'horizontal' ? startRow : startRow + i;
      const c = direction === 'horizontal' ? startCol + i : startCol;
      board[r][c] = upperWord[i];
    }

    const { drawn, remaining } = drawTiles(game.bag, usedTiles.length);
    game.racks[userId] = rack.concat(drawn);
    game.bag = remaining;

    let score = 0;
    let doubleWord = false;
    for (let i = 0; i < upperWord.length; i++) {
      const r = direction === 'horizontal' ? startRow : startRow + i;
      const c = direction === 'horizontal' ? startCol + i : startCol;
      score += 1; // Simplified scoring
      if (r === 3 && c === 3) doubleWord = true;
    }
    if (doubleWord) score *= 2;
    game.scores[userId] += score;

    const players = Object.keys(game.racks);
    const nextIdx = (players.indexOf(userId) + 1) % players.length;
    game.currentPlayer = players[nextIdx];
    game.turnCount += 1;
    game.passCount = 0;

    const allRacksEmpty = players.every(pid => game.racks[pid].length === 0);
    if (game.bag.length === 0 && allRacksEmpty) {
      game.gameStatus = 'finished';
    }

    return {
      valid: true,
      score,
      wordsFormed: [upperWord],
      gameState: this.getState(roomId),
    };
  }
}

export const gameService = new GameService();
