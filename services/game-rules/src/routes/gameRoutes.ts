
import { Router, Request, Response } from 'express';
import { gameService } from '../services/gameService';

const router = Router();

// Move validation and placement
router.post('/:roomId/move', async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { userId, word, startRow, startCol, direction, tiles } = req.body;

  if (!userId || !word || startRow === undefined || startCol === undefined || !direction || !tiles) {
    return res.status(400).json({
      valid: false,
      errors: [{
        code: 'MISSING_MOVE_DATA',
        message: 'Missing required move data: userId, word, startRow, startCol, direction, or tiles.'
      }],
      help: 'Please provide all required fields to make a move.'
    });
  }

  try {
    const result = await gameService.makeMove(roomId, userId, word, startRow, startCol, direction, tiles);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({
      valid: false,
      errors: [{
        code: err.code || 'MOVE_ERROR',
        message: err.message || 'Move could not be processed. Please check your input and try again.'
      }],
      help: 'Check that it is your turn, the word is valid, and your rack contains the required tiles.'
    });
  }
});

router.post('/:roomId/start', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { playerIds } = req.body;

  if (!Array.isArray(playerIds) || playerIds.length < 2) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'PLAYER_IDS_REQUIRED',
        message: 'At least two playerIds are required to start a game.'
      },
      help: 'Provide an array of at least two player IDs.'
    });
  }

  const gameState = gameService.startGame(roomId, playerIds);
  res.json({ roomId, gameState });
});

router.get('/:roomId/state', (req: Request, res: Response) => {
  const state = gameService.getState(req.params.roomId);
  if (!state) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'GAME_NOT_FOUND',
        message: 'No game found for this room. The game may not have started yet.'
      },
      help: 'Start a game first or check the room ID.'
    });
  }
  res.json(state);
});

router.post('/:roomId/pass', (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'USER_ID_REQUIRED',
        message: 'userId is required to pass turn.'
      },
      help: 'Include your userId in the request body.'
    });
  }

  try {
    const gameState = gameService.passTurn(req.params.roomId, userId);
    res.json({ gameState });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: {
        code: err.code || 'PASS_TURN_ERROR',
        message: err.message || 'Failed to pass turn. It may not be your turn or the game is not active.'
      },
      help: 'Check that it is your turn and the game is active.'
    });
  }
});

export default router;
