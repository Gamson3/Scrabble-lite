import { morphService } from '../services/morphService';
import { MorphMove } from '../models/MorphGameState';

jest.mock('axios');
import axios from 'axios';
import type { AxiosResponse } from 'axios/index.d.ts';
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockAxiosResponse = <T = unknown>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {} as any,
  config: {
    url: '',
    method: 'get',
    headers: {} as any,
  } as any,
} as AxiosResponse<T>);

const mockWordsResponse = (words: string[]) =>
  mockedAxios.get.mockResolvedValue(mockAxiosResponse({ words }) as never);

const mockValidationResponse = (valid: boolean) =>
  mockedAxios.post.mockResolvedValue(mockAxiosResponse({ valid }) as never);

describe.skip('MorphService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startGame', () => {
    it('should create a new game with 2 players', async () => {
      mockWordsResponse(['slate', 'crane', 'adieu', 'arose', 'brake']);

      const gameState = await morphService.startGame(
        'room_test',
        ['user1', 'user2'],
        ['Alice', 'Bob']
      );

      expect(gameState.startWord).toHaveLength(5);
      expect(gameState.targetWord).toHaveLength(5);
      expect(gameState.startWord).not.toBe(gameState.targetWord);
      expect(Object.keys(gameState.players)).toHaveLength(2);
      expect(gameState.gameStatus).toBe('active');
    });

    it('should initialize player paths with start word', async () => {
      mockWordsResponse(['slate', 'crane']);

      const gameState = await morphService.startGame(
        'room_test2',
        ['user1', 'user2'],
        ['Alice', 'Bob']
      );

      const player1 = gameState.players['user1'];
      expect(player1.currentWord).toBe(gameState.startWord);
      expect(player1.path).toHaveLength(1);
      expect(player1.path[0].word).toBe(gameState.startWord);
      expect(player1.path[0].feedback).toHaveLength(5);
    });
  });

  describe('makeMove', () => {
    it('should accept valid one-letter transformation', async () => {
      mockWordsResponse(['slate', 'plate']);

      const gameState = await morphService.startGame(
        'room_move_test',
        ['user1', 'user2'],
        ['Alice', 'Bob']
      );

      gameState.startWord = 'SLATE';
      gameState.players['user1'].currentWord = 'SLATE';

      mockValidationResponse(true);

      const move: MorphMove = {
        userId: 'user1',
        newWord: 'PLATE',
      };

      const result = await morphService.makeMove('room_move_test', move);

      expect(result.valid).toBe(true);
      expect(result.feedback).toHaveLength(5);
      expect(result.transformationCount).toBe(1);
    });

    it('should reject move with more than one letter changed', async () => {
      mockWordsResponse(['slate', 'crane']);

      const gameState = await morphService.startGame(
        'room_invalid_test',
        ['user1', 'user2'],
        ['Alice', 'Bob']
      );

      gameState.startWord = 'SLATE';
      gameState.players['user1'].currentWord = 'SLATE';

      const move: MorphMove = {
        userId: 'user1',
        newWord: 'CRANE',
      };

      const result = await morphService.makeMove('room_invalid_test', move);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].code).toBe('INVALID_TRANSFORMATION');
    });

    it('should reject invalid dictionary word', async () => {
      mockWordsResponse(['slate']);

      const gameState = await morphService.startGame(
        'room_dict_test',
        ['user1', 'user2'],
        ['Alice', 'Bob']
      );

      gameState.startWord = 'SLATE';
      gameState.players['user1'].currentWord = 'SLATE';

      mockValidationResponse(false);

      const move: MorphMove = {
        userId: 'user1',
        newWord: 'XLATE',
      };

      const result = await morphService.makeMove('room_dict_test', move);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].code).toBe('INVALID_WORD');
    });

    it('should detect winner when target reached', async () => {
      mockWordsResponse(['slate', 'plate']);

      const gameState = await morphService.startGame(
        'room_winner_test',
        ['user1', 'user2'],
        ['Alice', 'Bob']
      );

      gameState.targetWord = 'PLATE';
      gameState.players['user1'].currentWord = 'SLATE';

      mockValidationResponse(true);

      const move: MorphMove = {
        userId: 'user1',
        newWord: 'PLATE',
      };

      const result = await morphService.makeMove('room_winner_test', move);

      expect(result.valid).toBe(true);
      expect(result.completed).toBe(true);
      expect(result.winner).toBe(true);
      expect(result.gameState!.gameStatus).toBe('finished');
      expect(result.gameState!.winner).toBe('user1');
    });

    it("should reject move when not player's turn", async () => {
      mockWordsResponse(['slate']);

      await morphService.startGame(
        'room_turn_test',
        ['user1', 'user2'],
        ['Alice', 'Bob']
      );

      const move: MorphMove = {
        userId: 'user2',
        newWord: 'PLATE',
      };

      const result = await morphService.makeMove('room_turn_test', move);

      expect(result.valid).toBe(false);
      expect(result.errors![0].code).toBe('NOT_YOUR_TURN');
    });
  });

  describe('Color Feedback', () => {
    it('should give all green for exact match', async () => {
      mockWordsResponse(['slate']);

      const gameState = await morphService.startGame(
        'room_color_test',
        ['user1', 'user2'],
        ['Alice', 'Bob']
      );

      gameState.targetWord = 'SLATE';
      gameState.players['user1'].currentWord = 'PLATE';

      mockValidationResponse(true);

      const move: MorphMove = {
        userId: 'user1',
        newWord: 'SLATE',
      };

      const result = await morphService.makeMove('room_color_test', move);

      expect(result.feedback).toEqual(['green', 'green', 'green', 'green', 'green']);
    });
  });

  describe('Score Calculation', () => {
    it('should calculate score with penalties', () => {
      const player = {
        userId: 'user1',
        username: 'Alice',
        currentWord: 'CRANE',
        path: [],
        completed: true,
        transformationCount: 5,
        hintsUsed: 0,
      };

      const score = morphService.calculateScore(player, true);
      expect(score).toBe(125);
    });

    it('should not give bonus to loser', () => {
      const player = {
        userId: 'user1',
        username: 'Alice',
        currentWord: 'CRANE',
        path: [],
        completed: true,
        transformationCount: 3,
        hintsUsed: 0,
      };

      const score = morphService.calculateScore(player, false);
      expect(score).toBe(85);
    });
  });
});
