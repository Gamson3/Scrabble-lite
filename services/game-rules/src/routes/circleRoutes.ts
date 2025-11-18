/**
 * Circle Game Routes
 * 
 * HTTP endpoints for the Circle Word Game
 */

import { Router, Request, Response } from 'express';
import CircleGameService from '../services/circleGameService';
import {
  StartGameRequest,
  StartGameResponse,
  SubmitWordRequest,
  SubmitWordResponse,
  GetGameStateResponse,
  EndRoundRequest,
  EndRoundResponse,
} from '../models/CircleGameState';

const router = Router();

/**
 * POST /:roomId/start
 * Start a new circle game
 * 
 * Body: { roomId, playerIds: string[], usernames: Record<string, string> }
 * Response: { success, gameState, message }
 */
router.post('/:roomId/start', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { playerIds, usernames, totalRounds }: StartGameRequest = req.body;

    // Validate input
    if (!playerIds || playerIds.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Circle game requires exactly 2 players',
      });
    }

    if (!usernames) {
      return res.status(400).json({
        success: false,
        message: 'Usernames required for all players',
      });
    }

    // Start the game with optional totalRounds (defaults to 3 if not provided)
    const gameState = CircleGameService.startGame(roomId, playerIds, usernames, totalRounds);

    const response: StartGameResponse = {
      success: true,
      gameState,
      message: 'Circle game started successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error starting circle game:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /:roomId/word
 * Submit a word for validation and scoring
 * 
 * Body: { userId, word }
 * Response: { success, word, isValid, score, message, gameState }
 */
router.post('/:roomId/word', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { userId, word }: SubmitWordRequest = req.body;

    // Validate input
    if (!userId || !word) {
      return res.status(400).json({
        success: false,
        word: word || '',
        isValid: false,
        score: 0,
        message: 'User ID and word are required',
      });
    }

    if (word.trim().length === 0) {
      return res.status(400).json({
        success: false,
        word: '',
        isValid: false,
        score: 0,
        message: 'Word cannot be empty',
      });
    }

    // Get current game state
    const currentGameState = CircleGameService.getGameState(roomId);
    if (!currentGameState || !currentGameState.isGameActive) {
      return res.status(404).json({
        success: false,
        word: word.toUpperCase(),
        isValid: false,
        score: 0,
        message: 'Game not active or not found',
      });
    }

    // Submit the word
    const { isValid, score, gameState } = await CircleGameService.submitWord(
      roomId,
      userId,
      word
    );

    const response: SubmitWordResponse = {
      success: isValid,
      word: word.toUpperCase(),
      isValid,
      score,
      message: isValid ? `Word accepted! +${score} points` : 'Word not valid or already submitted',
      gameState: isValid && gameState ? gameState : undefined,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error submitting word:', error);
    res.status(500).json({
      success: false,
      word: req.body.word || '',
      isValid: false,
      score: 0,
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /:roomId/state
 * Get the current game state
 * 
 * Response: { gameState, message }
 */
router.get('/:roomId/state', (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const gameState = CircleGameService.getGameState(roomId);

    const response: GetGameStateResponse = {
      gameState,
      message: gameState ? 'Game state retrieved' : 'Game not found',
    };

    res.status(gameState ? 200 : 404).json(response);
  } catch (error) {
    console.error('Error getting game state:', error);
    res.status(500).json({
      gameState: null,
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /:roomId/end-round
 * End the current round and calculate round winner
 * 
 * Response: { success, roundWinner, message, gameState, isGameFinished }
 */
router.post('/:roomId/end-round', (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const currentGameState = CircleGameService.getGameState(roomId);
    if (!currentGameState) {
      return res.status(404).json({
        success: false,
        message: 'Game not found',
      });
    }

    // End the round
    const { roundWinner, gameState, isGameFinished } = CircleGameService.endRound(roomId);

    if (!roundWinner || !gameState) {
      return res.status(500).json({
        success: false,
        message: 'Failed to end round',
      });
    }

    const response: EndRoundResponse = {
      success: true,
      roundWinner,
      message: `Round won by ${roundWinner.username}!`,
      gameState,
      isGameFinished,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error ending round:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
