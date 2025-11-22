import { WebSocket, WebSocketServer } from 'ws';
import axios from 'axios';
import { roomService } from '../services/roomService';
import { WSMessage } from '../models/Room';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const GAME_SERVICE_URL = process.env.GAME_SERVICE_URL || 'http://localhost:3003';

interface AuthenticatedClient {
  ws: WebSocket;
  userId: string;
  username: string;
}

const clients = new Map<WebSocket, AuthenticatedClient>();

export function setupWebSocket(wss: WebSocketServer) {
  console.log('🔌 WebSocket server initialized');

  wss.on('connection', (ws: WebSocket) => {
    console.log('📥 New WebSocket connection');

    ws.on('message', async (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        console.log(`📨 Received: ${message.type}`, message.payload);

        await handleMessage(ws, message);
      } catch (error) {
        console.error('❌ Message handling error:', error);
        sendError(ws, 'INVALID_MESSAGE', 'Failed to process message');
      }
    });

    ws.on('close', () => {
      const client = clients.get(ws);
      if (client) {
        console.log(`📤 Client disconnected: ${client.username}`);
        roomService.removePlayerFromAllRooms(client.userId);
        clients.delete(ws);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
}

async function handleMessage(ws: WebSocket, message: WSMessage) {
  const { type, payload } = message;

  switch (type) {
    case 'auth':
      await handleAuth(ws, payload);
      break;
    case 'create_room':
      await handleCreateRoom(ws, payload);
      break;
    case 'list_rooms':
      await handleListRooms(ws);
      break;
    case 'leave_room': {
      const client = clients.get(ws);
      if (client) {
        // Remove player from all rooms; roomService will delete empty rooms.
        roomService.removePlayerFromAllRooms(client.userId);
        send(ws, 'left_room', { success: true });
      }
      break;
    }
    case 'join_room':
      await handleJoinRoom(ws, payload);
      break;
    case 'start_game':
      await handleStartGame(ws, payload);
      break;
    case 'make_move':
      await handleMakeMove(ws, payload);
      break;
    case 'pass_turn':
      await handlePassTurn(ws, payload);
      break;
    case 'exchange_tiles':
      await handleExchangeTiles(ws, payload);
      break;
    case 'chat_message':
      await handleChatMessage(ws, payload);
      break;
    case 'circle_start_game':
      await handleCircleStartGame(ws, payload);
      break;
    case 'circle_submit_word':
      await handleCircleSubmitWord(ws, payload);
      break;
    case 'circle_end_round':
      await handleCircleEndRound(ws, payload);
      break;
    case 'ping':
      send(ws, 'pong', { timestamp: new Date().toISOString() });
      break;
    default:
      sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${type}`);
  }
}

async function handleAuth(ws: WebSocket, payload: any) {
  try {
    const { token, userId } = payload;

    if (!token || !userId) {
      return sendError(ws, 'INVALID_AUTH', 'Token and userId required');
    }

    // Validate token with User Service
    const response = await axios.get(`${USER_SERVICE_URL}/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const user = response.data as { userId: string; username: string; createdAt: string };

    // Store authenticated client
    clients.set(ws, {
      ws,
      userId: user.userId,
      username: user.username,
    });

    console.log(`✅ Authenticated: ${user.username} (${user.userId})`);

    send(ws, 'auth_ok', {
      userId: user.userId,
      username: user.username,
    });
  } catch (error: any) {
    console.error('Auth error:', error.message);
    sendError(ws, 'UNAUTHORIZED', 'Invalid or expired token');
  }
}

async function handleCreateRoom(ws: WebSocket, payload: any) {
  const client = clients.get(ws);
  if (!client) {
    return sendError(ws, 'UNAUTHORIZED', 'Not authenticated');
  }

  try {
    const { roomName, gameType } = payload;

    if (!roomName) {
      return sendError(ws, 'INVALID_INPUT', 'Room name required');
    }
    const type = gameType === 'morph' ? 'morph' : 'scrabble';
    const room = roomService.createRoom(roomName, client.userId, client.username, ws, type);

    send(ws, 'room_created', {
      roomId: room.roomId,
      roomName: room.roomName,
      host: room.host,
      players: room.players.map(p => ({ userId: p.userId, username: p.username })),
      status: room.status,
      gameType: room.gameType,
    });
  } catch (error: any) {
    sendError(ws, 'CREATE_ROOM_ERROR', error.message);
  }
}

async function handleListRooms(ws: WebSocket) {
  const client = clients.get(ws);
  if (!client) {
    return sendError(ws, 'UNAUTHORIZED', 'Not authenticated');
  }

  try {
    const rooms = roomService.listRooms();

    send(ws, 'rooms_list', {
      rooms: rooms.map(r => ({
        roomId: r.roomId,
        roomName: r.roomName,
        host: r.host,
        players: r.players.map(p => ({ userId: p.userId, username: p.username })),
        status: r.status,
        gameType: r.gameType,
      })),
    });
  } catch (error: any) {
    sendError(ws, 'LIST_ROOMS_ERROR', error.message);
  }
}

async function handleJoinRoom(ws: WebSocket, payload: any) {
  const client = clients.get(ws);
  if (!client) {
    return sendError(ws, 'UNAUTHORIZED', 'Not authenticated');
  }

  try {
    const { roomId } = payload;

    if (!roomId) {
      return sendError(ws, 'INVALID_INPUT', 'Room ID required');
    }

    const room = roomService.joinRoom(roomId, client.userId, client.username, ws);

    // Broadcast to all players in the room
    broadcastToRoom(room.roomId, 'player_joined', {
      roomId: room.roomId,
      player: { userId: client.userId, username: client.username },
      players: room.players.map(p => ({ userId: p.userId, username: p.username })),
      status: room.status,
    });
  } catch (error: any) {
    sendError(ws, 'JOIN_ROOM_ERROR', error.message);
  }
}

async function handleStartGame(ws: WebSocket, payload: any) {
  const client = clients.get(ws);
  if (!client) {
    return sendError(ws, 'UNAUTHORIZED', 'Not authenticated');
  }

  try {
    const { roomId, gameMode } = payload;
    const room = roomService.getRoom(roomId);

    if (!room) {
      return sendError(ws, 'ROOM_NOT_FOUND', 'Room not found');
    }

    if (room.host !== client.userId) {
      return sendError(ws, 'NOT_HOST', 'Only host can start the game');
    }

    if (room.players.length !== 2) {
      return sendError(ws, 'NOT_ENOUGH_PLAYERS', 'Need 2 players to start');
    }

    const playerIds = room.players.map(p => p.userId);
    const usernames = room.players.map(p => p.username);
    const mode = gameMode || 'morph';

    if (mode === 'morph') {
      const response = await axios.post(`${GAME_SERVICE_URL}/morph/${roomId}/start`, {
        playerIds,
        usernames,
      });

      const gameData = response.data as { roomId: string; gameState: any };

      room.status = 'playing';

      broadcastToRoom(roomId, 'morph_game_started', {
        roomId,
        gameState: gameData.gameState,
      });
    } else {
      const response = await axios.post(`${GAME_SERVICE_URL}/games/${roomId}/start`, {
        playerIds,
      });

      const gameData = response.data as { roomId: string; gameState: any };

      room.status = 'playing';

      broadcastToRoom(roomId, 'game_started', {
        roomId,
        gameState: gameData.gameState,
      });
    }
  } catch (error: any) {
    console.error('Start game error:', error.message);
    sendError(ws, 'START_GAME_ERROR', error.message);
  }
}

async function handleMakeMove(ws: WebSocket, payload: any) {
  const client = clients.get(ws);
  if (!client) {
    return sendError(ws, 'UNAUTHORIZED', 'Not authenticated');
  }

  try {
    const { roomId, word, startRow, startCol, direction, tiles } = payload;

    if (!roomId || !word || startRow === undefined || startCol === undefined || !direction || !tiles) {
      return sendError(ws, 'INVALID_MOVE', 'Missing move data');
    }

    // Call Game Rules Service
    const response = await axios.post(`${GAME_SERVICE_URL}/games/${roomId}/move`, {
      userId: client.userId,
      word,
      startRow,
      startCol,
      direction,
      tiles,
    });

    const moveData = response.data as {
      valid: boolean;
      score?: number;
      wordsFormed?: string[];
      gameState?: any;
      errors?: any[];
    };

    // Send move result to player
    send(ws, 'move_result', {
      valid: moveData.valid,
      score: moveData.score,
      wordsFormed: moveData.wordsFormed,
      player: client.userId,
      errors: moveData.errors,
    });

    // Only broadcast game state if move was valid
    if (moveData.valid && moveData.gameState) {
      broadcastToRoom(roomId, 'game_state', {
        roomId,
        gameState: moveData.gameState,
        lastMove: {
          player: client.userId,
          word,
          score: moveData.score,
        },
      });
    }
  } catch (error: any) {
    console.error('Make move error:', error);
    // Try to extract a user-friendly error message from backend response
    let message = error.message;
    if (error.response && error.response.data) {
      const errData = error.response.data;
      if (errData.errors && Array.isArray(errData.errors) && errData.errors.length > 0) {
        message = errData.errors.map((e: any) => e.message).join(' | ');
      } else if (errData.error && errData.error.message) {
        message = errData.error.message;
      } else if (errData.message) {
        message = errData.message;
      }
    }
    sendError(ws, 'MAKE_MOVE_ERROR', message);
  }
}

async function handlePassTurn(ws: WebSocket, payload: any) {
  const client = clients.get(ws);
  if (!client) {
    return sendError(ws, 'UNAUTHORIZED', 'Not authenticated');
  }

  try {
    const { roomId } = payload;

    const response = await axios.post(`${GAME_SERVICE_URL}/games/${roomId}/pass`, {
      userId: client.userId,
    });

    const passData = response.data as {
      success: boolean;
      gameState: {
        currentPlayer: string;
        passCount: number;
      };
    };

    broadcastToRoom(roomId, 'turn_passed', {
      player: client.userId,
      currentPlayer: passData.gameState.currentPlayer,
      passCount: passData.gameState.passCount,
    });
    // Also broadcast the updated game state after a pass
    broadcastToRoom(roomId, 'game_state', {
      roomId,
      gameState: passData.gameState,
      lastMove: {
        player: client.userId,
        word: null,
        score: null,
      },
    });
  } catch (error: any) {
    // Try to extract a user-friendly error message from backend response
    let message = error.message;
    if (error.response && error.response.data) {
      const errData = error.response.data;
      if (errData.error && errData.error.message) {
        message = errData.error.message;
      } else if (errData.message) {
        message = errData.message;
      }
    }
    sendError(ws, 'PASS_TURN_ERROR', message);
  }
}

async function handleExchangeTiles(ws: WebSocket, payload: any) {
  const client = clients.get(ws);
  if (!client) {
    return sendError(ws, 'UNAUTHORIZED', 'Not authenticated');
  }

  try {
    const { roomId, tiles } = payload;

    const response = await axios.post(`${GAME_SERVICE_URL}/games/${roomId}/exchange`, {
      userId: client.userId,
      tiles,
    });

    const exchangeData = response.data as {
      success: boolean;
      newTiles: string[];
      gameState: {
        currentPlayer: string;
      };
    };

    send(ws, 'tiles_exchanged', {
      player: client.userId,
      newTilesCount: exchangeData.newTiles.length,
      currentPlayer: exchangeData.gameState.currentPlayer,
    });
  } catch (error: any) {
    sendError(ws, 'EXCHANGE_TILES_ERROR', error.message);
  }
}

async function handleChatMessage(ws: WebSocket, payload: any) {
  const client = clients.get(ws);
  if (!client) {
    return sendError(ws, 'UNAUTHORIZED', 'Not authenticated');
  }

  try {
    const { roomId, message } = payload;

    if (!roomId || !message) {
      return sendError(ws, 'INVALID_CHAT', 'Room ID and message required');
    }

    broadcastToRoom(roomId, 'chat_broadcast', {
      roomId,
      userId: client.userId,
      username: client.username,
      message,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    sendError(ws, 'CHAT_ERROR', error.message);
  }
}

async function handleCircleStartGame(ws: WebSocket, payload: any) {
  const client = clients.get(ws);
  if (!client) {
    return sendError(ws, 'UNAUTHORIZED', 'Not authenticated');
  }

  try {
    const { roomId, playerIds, usernames, totalRounds } = payload;

    if (!roomId || !playerIds || !usernames) {
      return sendError(ws, 'INVALID_INPUT', 'Missing required fields');
    }

    // Call Game Rules Service to start the game
    const response = await axios.post(`${GAME_SERVICE_URL}/circle/${roomId}/start`, {
      roomId,
      playerIds,
      usernames,
      totalRounds, // Pass through totalRounds (1 for CLI, default 3 for web)
    });

    const { gameState } = response.data;

    // Broadcast to all players in the room
    broadcastToRoom(roomId, 'circle_game_started', {
      roomId,
      gameState,
    });
  } catch (error: any) {
    console.error('Circle start game error:', error);
    sendError(ws, 'CIRCLE_START_ERROR', error.message);
  }
}

async function handleCircleSubmitWord(ws: WebSocket, payload: any) {
  const client = clients.get(ws);
  if (!client) {
    return sendError(ws, 'UNAUTHORIZED', 'Not authenticated');
  }

  try {
    const { roomId, word } = payload;

    if (!roomId || !word) {
      return sendError(ws, 'INVALID_INPUT', 'Missing room ID or word');
    }

    // Call Game Rules Service to submit the word
    const response = await axios.post(`${GAME_SERVICE_URL}/circle/${roomId}/word`, {
      userId: client.userId,
      word,
    });

    const { isValid, score, gameState } = response.data;

    // Broadcast the word submission to all players in the room
    broadcastToRoom(roomId, 'circle_word_submitted', {
      roomId,
      userId: client.userId,
      username: client.username,
      word: word.toUpperCase(),
      isValid,
      score,
      gameState,
    });

    // Also send confirmation to the submitting player
    send(ws, 'circle_word_confirmed', {
      word: word.toUpperCase(),
      isValid,
      score,
      message: isValid ? `+${score} points!` : 'Word not valid',
    });
  } catch (error: any) {
    console.error('Circle submit word error:', error);
    sendError(ws, 'CIRCLE_SUBMIT_ERROR', error.message);
  }
}

// Track last processed round per room to prevent duplicate end-round calls
const lastProcessedRound = new Map<string, number>();

async function handleCircleEndRound(ws: WebSocket, payload: any) {
  const client = clients.get(ws);
  if (!client) {
    return sendError(ws, 'UNAUTHORIZED', 'Not authenticated');
  }

  try {
    const { roomId } = payload;

    if (!roomId) {
      return sendError(ws, 'INVALID_INPUT', 'Missing room ID');
    }

    // Get current game state to check round number
    const stateResponse = await axios.get(`${GAME_SERVICE_URL}/circle/${roomId}/state`);
    const currentRoundNumber = stateResponse.data.gameState.roundNumber;

    // Check if this round has already been processed
    const lastProcessed = lastProcessedRound.get(roomId);
    if (lastProcessed && lastProcessed === currentRoundNumber) {
      console.log(`⚠️ Round ${currentRoundNumber} already processed for room ${roomId}, ignoring duplicate call`);
      return; // Silently ignore duplicate
    }

    // Mark this round as being processed
    lastProcessedRound.set(roomId, currentRoundNumber);

    console.log(`🎯 Processing end-round for room ${roomId}, round ${currentRoundNumber}`);

    // Call Game Rules Service to end the round
    const response = await axios.post(`${GAME_SERVICE_URL}/circle/${roomId}/end-round`);

    const { roundWinner, gameState, isGameFinished } = response.data;

    if (isGameFinished) {
      // Game is finished, broadcast game over
      broadcastToRoom(roomId, 'circle_game_over', {
        roomId,
        gameWinner: gameState.gameWinner,
        finalScores: gameState.finalScores,
        gameState,
        isDraw: gameState.isDraw || false,
      });
    } else {
      // Next round starting, broadcast round ended
      broadcastToRoom(roomId, 'circle_round_ended', {
        roomId,
        roundWinner,
        gameState,
      });
    }
  } catch (error: any) {
    console.error('Circle end round error:', error);
    sendError(ws, 'CIRCLE_END_ROUND_ERROR', error.message);
  }
}

function send(ws: WebSocket, type: string, payload: any) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function sendError(ws: WebSocket, code: string, message: string) {
  send(ws, 'error', { code, message });
}

function broadcastToRoom(roomId: string, type: string, payload: any) {
  const room = roomService.getRoom(roomId);
  if (!room) return;

  const message = JSON.stringify({ type, payload });

  for (const player of room.players) {
    if (player.socket && player.socket.readyState === WebSocket.OPEN) {
      player.socket.send(message);
    }
  }

  console.log(`📢 Broadcast to room ${roomId}: ${type}`);
}