import express, { Request, Response, Router } from 'express';
import { morphService } from '../services/morphService';
import { MorphMove } from '../models/MorphGameState';

const router: Router = express.Router();

router.post('/:roomId/start', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { playerIds, usernames } = req.body;

    if (!playerIds || !Array.isArray(playerIds) || playerIds.length !== 2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PLAYERS',
          message: 'Exactly 2 player IDs required',
        },
      });
    }

    if (!usernames || !Array.isArray(usernames) || usernames.length !== 2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USERNAMES',
          message: 'Exactly 2 usernames required',
        },
      });
    }

    const gameState = await morphService.startGame(roomId, playerIds, usernames);

    res.status(201).json({
      roomId,
      gameState,
    });
  } catch (error: any) {
    console.error('[Start Morph Game Error]', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'START_GAME_ERROR',
        message: error.message || 'Failed to start game',
      },
    });
  }
});

router.post('/:roomId/move', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const move: MorphMove = req.body;

    if (!move.userId || !move.newWord) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MOVE_DATA',
          message: 'Missing required fields: userId, newWord',
        },
      });
    }

    const result = await morphService.makeMove(roomId, move);

    res.status(200).json(result);
  } catch (error: any) {
    console.error('[Morph Move Error]', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MOVE_ERROR',
        message: error.message || 'Failed to process move',
      },
    });
  }
});

router.post('/:roomId/hints', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { userId, limit } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_HINT_REQUEST',
          message: 'userId is required to request hints',
        },
      });
    }

    const result = await morphService.getHints(roomId, userId, limit);

    res.status(200).json({
      roomId,
      userId,
      suggestions: result.suggestions,
      hintBudget: result.hintBudget,
    });
  } catch (error: any) {
    console.error('[Morph Hint Error]', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HINT_ERROR',
        message: error.message || 'Failed to generate hints',
      },
    });
  }
});

router.get('/:roomId/state', (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const gameState = morphService.getGameState(roomId);

    if (!gameState) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'GAME_NOT_FOUND',
          message: 'Game not found',
        },
      });
    }

    res.status(200).json({
      roomId,
      gameState,
    });
  } catch (error) {
    console.error('[Get Morph State Error]', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_STATE_ERROR',
        message: 'Failed to get game state',
      },
    });
  }
});

router.delete('/:roomId', (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    morphService.deleteGame(roomId);

    res.status(200).json({
      success: true,
      message: 'Game deleted',
    });
  } catch (error) {
    console.error('[Delete Morph Game Error]', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_ERROR',
        message: 'Failed to delete game',
      },
    });
  }
});

export default router;
