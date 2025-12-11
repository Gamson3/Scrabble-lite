import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import './styles/auth-lobby.css';
import type { /*FormEvent*/ } from 'react';
import type {
  ChatBroadcast,
  RoomSummary,
  // RoomsListItem,
  Session,
  CircleGameState,
} from './types';

import LobbyWithChat from './components/LobbyWithChat';
import AppHeader from './components/AppHeader';
// import ChatPanel from './components/ChatPanel';
import CircleGameScreen from './components/CircleGameScreen';
import AuthScreen from './components/AuthScreen';
import GameResultsModal from './components/GameResultsModal';

const USER_SERVICE_URL = import.meta.env.VITE_USER_SERVICE_URL ?? 'http://localhost:3001';
const ROOM_SERVICE_WS = import.meta.env.VITE_ROOM_SERVICE_WS ?? 'ws://localhost:3004';
const STORAGE_KEY = 'circle-word-game-session';

// Screen states for better flow
type AppScreen = 'auth' | 'lobby' | 'room-waiting' | 'game-active';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await extractError(response);
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

async function extractError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data?.error?.message) return data.error.message;
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      return data.errors.map((err: { message: string }) => err.message).join(' • ');
    }
    if (data?.message) return data.message;
  } catch (error) {
    console.error('Failed to parse error payload', error);
  }
  return `${response.status} ${response.statusText}`;
}

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch (error) {
      console.error('Unable to restore session', error);
      return null;
    }
  });

  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [gameOver, setGameOver] = useState<{ winner?: string; winnerName?: string; isDraw?: boolean; opponentLeft?: boolean } | null>(null);
  const [roomNameInput, setRoomNameInput] = useState('Word Rush Room');
  const [joinInput, setJoinInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatBroadcast[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [circleGameState, setCircleGameState] = useState<CircleGameState | null>(null);
  const [isCircleSubmitting, setIsCircleSubmitting] = useState(false);
  const [wordConfirmation, setWordConfirmation] = useState<{ word: string; isValid: boolean; score: number; message: string } | null>(null);

  // Determine current screen based on state
  const currentScreen: AppScreen = useMemo(() => {
    if (!session) return 'auth';
    if (!room) return 'lobby';
    if (circleGameState && circleGameState.isGameActive) return 'game-active';
    return 'room-waiting';
  }, [session, room, circleGameState]);

  const sendMessage = useCallback((type: string, payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const handleSocketMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const { type, payload } = JSON.parse(event.data);
        switch (type) {
          case 'auth_ok':
            setWsStatus('connected');
            sendMessage('list_rooms', {});
            break;
          case 'rooms_list':
            setRooms(Array.isArray(payload?.rooms) ? payload.rooms : []);
            break;
          case 'room_created':
            setRoom(payload as RoomSummary);
            setGameOver(null);
            setChatMessages([]);
            setCircleGameState(null);
            sendMessage('list_rooms', {});
            break;
          case 'player_joined':
            setRoom(prev => {
              if (prev && prev.roomId !== payload.roomId) {
                return prev;
              }
              const base = prev ?? {
                roomId: payload.roomId,
                roomName: `Room ${payload.roomId.slice(0, 5)}`,
                host: '',
                players: [],
                status: 'waiting',
                gameType: 'circle',
              };
              return {
                ...base,
                players: payload.players ?? base.players,
                status: payload.status ?? base.status,
                gameType: base.gameType,
              };
            });
            sendMessage('list_rooms', {});
            break;
            // Morph game messages ignored - Circle Game only
            break;
          case 'chat_broadcast':
            setChatMessages(prev => [...prev.slice(-40), payload as ChatBroadcast]);
            break;
          case 'left_room':
            setRoom(null);
            setCircleGameState(null);
            setChatMessages([]);
            setGameOver(null);
            sendMessage('list_rooms', {});
            break;
          case 'error':
            setGlobalError(payload?.message ?? 'Something went wrong.');
            break;
          case 'circle_game_started':
            setCircleGameState(payload?.gameState ?? null);
            break;
          case 'circle_word_submitted':
            // Only update game state if valid AND gameState exists
            // Invalid words should not modify game state to prevent kicking players out
            if (payload?.isValid && payload?.gameState) {
              setCircleGameState(payload.gameState);
            }
            break;
          case 'circle_word_confirmed':
            setWordConfirmation({
              word: payload?.word ?? '',
              isValid: payload?.isValid ?? false,
              score: payload?.score ?? 0,
              message: payload?.message ?? '',
            });
            break;
          case 'circle_round_ended':
            setCircleGameState(payload?.gameState ?? null);
            break;
          case 'circle_game_over':
            setCircleGameState(payload?.gameState ?? null);
            setGameOver({
              winner: payload?.gameWinner?.userId,
              winnerName: payload?.gameWinner?.username,
              isDraw: payload?.isDraw ?? false,
            });
            break;
          case 'player_disconnected':
            // Handle opponent disconnection during active game
            if (circleGameState && circleGameState.isGameActive && session) {
              setCircleGameState(null);
              setGameOver({
                winner: session.userId,
                winnerName: session.username || 'You',
                isDraw: false,
                opponentLeft: true,
              });
            }
            break;
          default:
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message', error);
      }
    },
    [sendMessage]
  );

  useEffect(() => {
    if (!session) {
      wsRef.current?.close();
      wsRef.current = null;
      setWsStatus('disconnected');
      setRoom(null);
      setCircleGameState(null);
      return;
    }

    // Don't reconnect if already connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setWsStatus('connecting');
    const socket = new WebSocket(ROOM_SERVICE_WS);
    wsRef.current = socket;

    socket.onopen = () => {
      setGlobalError(null);
      socket.send(
        JSON.stringify({
          type: 'auth',
          payload: { token: session.token, userId: session.userId },
        })
      );
    };

    socket.onmessage = handleSocketMessage;

    socket.onerror = () => {
      setGlobalError('WebSocket connection issue. Retrying...');
    };

    socket.onclose = () => {
      setWsStatus('disconnected');
      wsRef.current = null;
    };

    return () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
  }, [handleSocketMessage, session]);

  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  useEffect(() => {
    if (wsStatus === 'connected') {
      sendMessage('list_rooms', {});
    }
  }, [sendMessage, wsStatus]);

  const submitAuth = async (username: string) => {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setAuthError('Pick a username first.');
      return;
    }

    setAuthBusy(true);
    setAuthError(null);

    try {
      // Try register first (doesn't matter if user exists)
      try {
        await postJson(`${USER_SERVICE_URL}/users/register`, { username: cleanUsername });
      } catch {
        // User might already exist, that's fine
      }
      // Now login
      const loginData = await postJson<Session>(`${USER_SERVICE_URL}/users/login`, { username: cleanUsername });
      setSession(loginData);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCreateRoom = () => {
    if (!roomNameInput.trim()) return;
    setGlobalError(null);
    sendMessage('create_room', { roomName: roomNameInput.trim(), gameType: 'circle' });
    setRoomNameInput('Word Rush Room');
    setGameOver(null);
  };

  const handleJoinRoom = (roomId?: string) => {
    const target = (roomId || joinInput).trim();
    if (!target) return;
    setGlobalError(null);
    sendMessage('join_room', { roomId: target });
    setJoinInput('');
  };
  // const handleSendChat = (event: FormEvent) => {
  //   event.preventDefault();
  //   if (!room || !chatInput.trim()) return;
  //   const message = chatInput.trim();
  //   sendMessage('chat_message', { roomId: room.roomId, message });
  //   setChatInput('');
  // };

  const handleLeaveRoom = () => {
    sendMessage('leave_room', {});
    setRoom(null);
    setChatMessages([]);
    setGameOver(null);
    setCircleGameState(null);
  };

  const handleSendChat = (message: string) => {
    if (!room || !message.trim()) return;
    sendMessage('chat_message', { roomId: room.roomId, message });
  };

  const handleCircleGameStart = () => {
    if (!room) return;
    const usernames: Record<string, string> = {};
    room.players.forEach((player) => {
      usernames[player.userId] = player.username;
    });
    sendMessage('circle_start_game', {
      roomId: room.roomId,
      playerIds: room.players.map((p) => p.userId),
      usernames,
    });
  };

  const handleCircleSubmitWord = (word: string) => {
    if (!room || !word.trim()) return;
    setIsCircleSubmitting(true);
    sendMessage('circle_submit_word', {
      roomId: room.roomId,
      word: word.toUpperCase(),
    });
    // Reset submitting flag after a brief delay
    setTimeout(() => setIsCircleSubmitting(false), 500);
  };

  const handleCircleEndRound = () => {
    if (!room) return;
    sendMessage('circle_end_round', { roomId: room.roomId });
  };

  const handleRequestRematch = () => {
    if (!room) return;
    sendMessage('rematch_request', { roomId: room.roomId });
  };

  const handleLogout = () => {
    handleLeaveRoom();
    setSession(null);
    setGlobalError(null);
  };

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => (b.players?.length || 0) - (a.players?.length || 0));
  }, [rooms]);

  return (
    <>
      {/* SCREEN 1: AUTHENTICATION - Full screen, no header */}
      {currentScreen === 'auth' && (
        <AuthScreen
          onAuth={submitAuth}
          isLoading={authBusy}
          error={authError || ''}
        />
      )}

      {/* SCREENS 2-4: AUTHENTICATED SCREENS - With consistent header and layout */}
      {currentScreen !== 'auth' && (
        <div className="app-layout">
          {/* Header - Consistent across all authenticated screens */}
          <header className="app-header-fixed">
            <AppHeader session={session} wsStatus={wsStatus} onLogout={handleLogout} />
          </header>

          {/* Main content area - Consistent centering for all authenticated screens */}
          <main className="app-main-content">
            {globalError && <div className="alert">{globalError}</div>}

            {/* SCREEN 2: LOBBY WITH CHAT - Browse and Join Rooms */}
            {currentScreen === 'lobby' && (
              <LobbyWithChat
                room={room}
                rooms={sortedRooms}
                currentUserId={session?.userId || ''}
                chatMessages={chatMessages}
                roomNameInput={roomNameInput}
                joinInput={joinInput}
                wsStatus={wsStatus}
                onCreateRoom={handleCreateRoom}
                onJoinRoom={handleJoinRoom}
                onLeaveRoom={handleLeaveRoom}
                onRefreshRooms={() => sendMessage('list_rooms', {})}
                onRoomNameChange={(value: string) => setRoomNameInput(value)}
                onJoinInputChange={(value: string) => setJoinInput(value)}
                onSendMessage={handleSendChat}
                onStartGame={handleCircleGameStart}
              />
            )}

            {/* SCREEN 3: ROOM WAITING - Waiting for Opponent (with chat sidebar) */}
            {currentScreen === 'room-waiting' && (
              <LobbyWithChat
                room={room}
                rooms={sortedRooms}
                currentUserId={session?.userId || ''}
                chatMessages={chatMessages}
                roomNameInput={roomNameInput}
                joinInput={joinInput}
                wsStatus={wsStatus}
                onCreateRoom={handleCreateRoom}
                onJoinRoom={handleJoinRoom}
                onLeaveRoom={handleLeaveRoom}
                onRefreshRooms={() => sendMessage('list_rooms', {})}
                onRoomNameChange={(value: string) => setRoomNameInput(value)}
                onJoinInputChange={(value: string) => setJoinInput(value)}
                onSendMessage={handleSendChat}
                onStartGame={handleCircleGameStart}
              />
            )}

            {/* SCREEN 4: GAME ACTIVE - Full Game Interface */}
            {currentScreen === 'game-active' && room && circleGameState && session && (
              <CircleGameScreen
                gameState={circleGameState}
                userId={session.userId}
                onSubmitWord={handleCircleSubmitWord}
                onEndRound={handleCircleEndRound}
                onRequestRematch={handleRequestRematch}
                onBackToLobby={handleLeaveRoom}
                isSubmitting={isCircleSubmitting}
                wordConfirmation={wordConfirmation}
              />
            )}
          </main>
        </div>
      )}

      {/* GAME OVER MODAL - Using GameResultsModal component */}
      {gameOver && session && circleGameState && (
        <GameResultsModal
          winner={gameOver.winner || session.userId}
          winnerName={gameOver.winnerName || 'Unknown'}
          playerName={session.username}
          playerScore={circleGameState.players[session.userId]?.totalScore || 0}
          opponentName={Object.keys(circleGameState.players).find(id => id !== session.userId) ? circleGameState.players[Object.keys(circleGameState.players).find(id => id !== session.userId)!].username : 'Opponent'}
          opponentScore={Object.keys(circleGameState.players).find(id => id !== session.userId) ? circleGameState.players[Object.keys(circleGameState.players).find(id => id !== session.userId)!].totalScore : 0}
          roundsWon={circleGameState.players[session.userId]?.roundsWon || 0}
          totalRounds={circleGameState.totalRounds}
          isCurrentPlayerWinner={gameOver.winner === session.userId}
          isDraw={gameOver.isDraw || false}
          onBackToLobby={() => {
            setGameOver(null);
            handleLeaveRoom();
          }}
          onClose={() => setGameOver(null)}
        />
      )}
    </>
  );
}

export default App;