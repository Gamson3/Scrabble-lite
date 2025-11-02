import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import type { FormEvent } from 'react';
import type {
  ColorFeedback,
  ChatBroadcast,
  MorphGameState,
  PlayerProgress,
  RoomSummary,
  RoomsListItem,
  Session,
  HintSuggestion,
  HintBudget,
  WordInsight,
} from './types';

// UI subcomponents are used inside extracted child components (GameScreen, etc.)
import LobbyScreen from './components/LobbyScreen';
import AppHeader from './components/AppHeader';
import GameScreen from './components/GameScreen';
import ChatPanel from './components/ChatPanel';

const USER_SERVICE_URL = import.meta.env.VITE_USER_SERVICE_URL ?? 'http://localhost:3001';
const ROOM_SERVICE_WS = import.meta.env.VITE_ROOM_SERVICE_WS ?? 'ws://localhost:3004';
const STORAGE_KEY = 'word-morph-session';

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

  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [usernameInput, setUsernameInput] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [rooms, setRooms] = useState<RoomsListItem[]>([]);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [gameState, setGameState] = useState<MorphGameState | null>(null);
  const [gameOver, setGameOver] = useState<{ winner?: string; winnerName?: string } | null>(null);
  const [moveInput, setMoveInput] = useState('');
  const [moveError, setMoveError] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<ColorFeedback[] | null>(null);
  const [roomNameInput, setRoomNameInput] = useState('Word Morph Duel');
  const [joinInput, setJoinInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatBroadcast[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [hintOptions, setHintOptions] = useState<HintSuggestion[]>([]);
  const [hintBudget, setHintBudget] = useState<HintBudget | null>(null);
  const [moveWarnings, setMoveWarnings] = useState<string[]>([]);
  const [latestInsight, setLatestInsight] = useState<WordInsight | null>(null);

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
            setGameState(null);
            setGameOver(null);
            setChatMessages([]);
            setHintOptions([]);
            setHintBudget(null);
            setMoveWarnings([]);
            setLatestInsight(null);
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
                gameType: 'morph',
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
          case 'morph_game_started':
            setGameState(payload.gameState as MorphGameState);
            setRoom(prev => (prev ? { ...prev, status: 'playing' } : prev));
            setGameOver(null);
            setLastFeedback(null);
             setHintOptions([]);
             setHintBudget(null);
             setMoveWarnings([]);
             setLatestInsight(null);
            break;
          case 'morph_game_state':
            if (payload?.gameState) {
              setGameState(payload.gameState as MorphGameState);
            }
            break;
          case 'morph_move_result':
            if (payload?.valid) {
              setMoveError(null);
              setLastFeedback((payload.feedback ?? null) as ColorFeedback[] | null);
              setMoveInput('');
              setMoveWarnings(Array.isArray(payload?.warnings) ? payload.warnings : []);
              setHintBudget(prev => payload?.hintBudget ?? prev);
              setLatestInsight((payload?.insight as WordInsight) ?? null);
              setHintOptions([]);
            } else {
              const message = Array.isArray(payload?.errors)
                ? payload.errors.map((err: { message: string }) => err.message).join(' • ')
                : 'Invalid move';
              setMoveError(message);
              setLastFeedback(null);
              setMoveWarnings([]);
            }
            break;
          case 'morph_hint_result':
            setHintOptions(Array.isArray(payload?.suggestions) ? (payload.suggestions as HintSuggestion[]) : []);
            setHintBudget(payload?.hintBudget ?? null);
            break;
          case 'morph_game_over':
            setGameState(payload?.gameState as MorphGameState);
            setGameOver({ winner: payload?.winner, winnerName: payload?.winnerName });
            break;
          case 'chat_broadcast':
            setChatMessages(prev => [...prev.slice(-40), payload as ChatBroadcast]);
            break;
          case 'left_room':
            setRoom(null);
            setGameState(null);
            setChatMessages([]);
            setGameOver(null);
            sendMessage('list_rooms', {});
            setHintOptions([]);
            setHintBudget(null);
            setMoveWarnings([]);
            setLatestInsight(null);
            break;
          case 'error':
            setGlobalError(payload?.message ?? 'Something went wrong.');
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
      setGameState(null);
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
      socket.close();
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

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const username = usernameInput.trim().toLowerCase();
    if (!username) {
      setAuthError('Pick a username first.');
      return;
    }

    setAuthBusy(true);
    setAuthError(null);

    try {
      if (authMode === 'register') {
        await postJson(`${USER_SERVICE_URL}/users/register`, { username });
      }
      const loginData = await postJson<Session>(`${USER_SERVICE_URL}/users/login`, { username });
      setSession(loginData);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCreateRoom = () => {
    if (!roomNameInput.trim()) return;
    sendMessage('create_room', { roomName: roomNameInput.trim(), gameType: 'morph' });
    setRoomNameInput('Word Morph Duel');
    setGameState(null);
    setGameOver(null);
  };

  const handleJoinRoom = (roomId?: string) => {
    const target = (roomId || joinInput).trim();
    if (!target) return;
    sendMessage('join_room', { roomId: target });
    setJoinInput('');
  };

  const handleStartGame = () => {
    if (!room) return;
    sendMessage('start_game', { roomId: room.roomId, gameMode: 'morph' });
  };

  const handleMakeMove = (event: FormEvent) => {
    event.preventDefault();
    if (!room || !moveInput || moveInput.length !== 5) {
      setMoveError('Enter a 5-letter word.');
      return;
    }
    sendMessage('morph_move', { roomId: room.roomId, newWord: moveInput.toUpperCase() });
  };

  const handleRequestHint = () => {
    if (!room) return;
    sendMessage('morph_hint_request', { roomId: room.roomId, limit: 3 });
  };

  const handleSendChat = (event: FormEvent) => {
    event.preventDefault();
    if (!room || !chatInput.trim()) return;
    const message = chatInput.trim();
    // Send message via WebSocket; server will broadcast back to all clients
    sendMessage('chat_message', { roomId: room.roomId, message });
    setChatInput('');
  };

  const handleLeaveRoom = () => {
    sendMessage('leave_room', {});
    setRoom(null);
    setGameState(null);
    setChatMessages([]);
    setGameOver(null);
    setLastFeedback(null);
    setMoveInput('');
    setMoveError(null);
    setHintOptions([]);
    setHintBudget(null);
    setMoveWarnings([]);
    setLatestInsight(null);
  };

  const handleLogout = () => {
    handleLeaveRoom();
    setSession(null);
    setGlobalError(null);
  };

  const myPlayer: PlayerProgress | null = useMemo(() => {
    if (!gameState || !session) return null;
    return gameState.players[session.userId] ?? null;
  }, [gameState, session]);

  const opponent: PlayerProgress | null = useMemo(() => {
    if (!gameState || !session) return null;
    const entry = Object.entries(gameState.players).find(([userId]) => userId !== session.userId);
    return entry ? entry[1] : null;
  }, [gameState, session]);

  const isMyTurn = Boolean(gameState && session && gameState.currentPlayer === session.userId && gameState.gameStatus === 'active');
  const canStartGame = Boolean(room && room.status === 'ready' && room.host === session?.userId);
  const canSubmitMove = isMyTurn && Boolean(room);
  // connectionChip is now computed inside `AppHeader` so the local variable is unused

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => b.playerCount - a.playerCount);
  }, [rooms]);

  return (
    <div className="app-shell">
          <AppHeader session={session} wsStatus={wsStatus} onLogout={handleLogout} />

      {!session ? (
        <section className="card auth-card">
          <h2>{authMode === 'register' ? 'Create your player' : 'Welcome back'}</h2>
          <p>Pick a username to register or log back in. Tokens are issued by the User Service.</p>
          <form className="auth-form" onSubmit={submitAuth}>
            <label>
              Username
              <input
                value={usernameInput}
                onChange={event => setUsernameInput(event.target.value.replace(/\s+/g, '').toLowerCase())}
                placeholder="e.g. morphmaster"
                maxLength={24}
                disabled={authBusy}
              />
            </label>
            {authError && <p className="error-text">{authError}</p>}
            <div className="auth-actions">
              <button type="submit" className="btn btn-primary" disabled={authBusy}>
                {authBusy ? 'Working...' : authMode === 'register' ? 'Register & Sign in' : 'Sign in'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setAuthMode(mode => (mode === 'register' ? 'login' : 'register'))}
              >
                {authMode === 'register' ? 'Already registered? Log in' : 'Need an account? Register'}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <>
          {globalError && <div className="alert">{globalError}</div>}

          <section className="grid-two">
              <LobbyScreen
                rooms={sortedRooms}
                roomName={roomNameInput}
                onRoomNameChange={value => setRoomNameInput(value)}
                onCreateRoom={handleCreateRoom}
                joinInput={joinInput}
                onJoinInputChange={value => setJoinInput(value)}
                onJoinRoom={handleJoinRoom}
                onRefreshRooms={() => sendMessage('list_rooms', {})}
                wsStatus={wsStatus}
              />

            <article className="card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">Current room</p>
                  <h2>{room ? room.roomName : 'No room selected'}</h2>
                </div>
                {room && (
                  <button className="btn btn-ghost" onClick={handleLeaveRoom}>
                    Leave room
                  </button>
                )}
              </div>
              {!room ? (
                <p className="muted">Join or create a room to start a duel.</p>
              ) : (
                <div className="room-details">
                  <div>
                    <small>Room ID</small>
                    <code>{room.roomId}</code>
                  </div>
                  <div>
                    <small>Status</small>
                    <span className={`chip ${room.status === 'playing' ? 'chip-warning' : 'chip-online'}`}>
                      {room.status}
                    </span>
                  </div>
                  <div>
                    <small>Players</small>
                    <ul>
                      {room.players.map(player => (
                        <li key={player.userId}>
                          {player.username}
                          {player.userId === room.host && <span className="badge">host</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {canStartGame && (
                    <button className="btn btn-primary" onClick={handleStartGame}>
                      Start Word Morph Duel
                    </button>
                  )}
                  {!canStartGame && room.status !== 'playing' && (
                    <p className="muted">Waiting for both players to join before starting.</p>
                  )}
                </div>
              )}
            </article>
          </section>

          <section className="main-grid">
            <article className="card game-card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">Duel state</p>
                  <h2>{gameState ? 'Morph the start word into the target' : 'Game dashboard'}</h2>
                </div>
                {gameState && (
                  <span className={`chip ${gameState.gameStatus === 'active' ? 'chip-online' : 'chip-warning'}`}>
                    {gameState.gameStatus}
                  </span>
                )}
              </div>

              {!room && <p className="muted">Join a room to see live game data.</p>}

              {room && !gameState && (
                <div className="empty-state">
                  <h3>Waiting for the host</h3>
                  <p>The room is ready. Once the host taps "Start Word Morph Duel" both players receive a challenge.</p>
                </div>
              )}

              {room && gameState && (
                <GameScreen
                  room={room}
                  gameState={gameState}
                  myPlayer={myPlayer}
                  opponent={opponent}
                  isMyTurn={isMyTurn}
                  canSubmitMove={canSubmitMove}
                  moveInput={moveInput}
                  onMoveInputChange={v => setMoveInput(v)}
                  moveError={moveError}
                  lastFeedback={lastFeedback}
                  onMakeMove={handleMakeMove}
                  onRequestHint={handleRequestHint}
                  hintOptions={hintOptions}
                  hintBudget={hintBudget}
                  latestInsight={latestInsight}
                  moveWarnings={moveWarnings}
                />
              )}
            </article>

            <ChatPanel
              room={room}
              chatMessages={chatMessages}
              chatInput={chatInput}
              onChatInputChange={v => setChatInput(v)}
              onSendChat={handleSendChat}
              session={session}
            />
          </section>

          {gameOver && session && (
            <div className="overlay">
              <div className="overlay-card">
                <h3>Game over</h3>
                <p>
                  Winner:{' '}
                  <strong>
                    {gameOver.winner === session.userId ? 'You' : gameOver.winnerName || 'Unknown player'}
                  </strong>
                </p>
                <button className="btn" onClick={() => setGameOver(null)}>
                  Close
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}




// HintPanel moved to `components/HintPanel.tsx`

// `formatDistance` is imported from `components/ui/formatDistance`

export default App;
