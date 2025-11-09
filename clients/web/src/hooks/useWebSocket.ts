import { useEffect, useRef, useState } from 'react'

type Handlers = {
  onRoomCreated?: (room: any) => void
  onPlayerJoined?: (room: any) => void
  onGameStarted?: (data: any) => void
  onGameStateUpdate?: (data: any) => void
  onMoveResult?: (data: any) => void
  onHintResult?: (data: any) => void
  onGameOver?: (data: any) => void
  onRoomsList?: (list: any[]) => void
}

export function useWebSocket(session: any, handlers: Handlers = {}) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // auto-connect when session becomes available
    if (session && !wsRef.current) {
      connect()
    }
    return () => {
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  function connect() {
    if (!session) return
    try {
      const ws = new WebSocket('ws://localhost:3004')
      wsRef.current = ws
      ws.addEventListener('open', () => setConnected(true))
      ws.addEventListener('close', () => setConnected(false))
      ws.addEventListener('message', (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          handleMessage(msg)
        } catch (e) {
          console.warn('ws parse error', e)
        }
      })
    } catch (e) {
      console.warn('ws connect error', e)
    }
  }

  function disconnect() {
    try {
      wsRef.current?.close()
    } catch (e) {
      /* ignore */
    }
    wsRef.current = null
    setConnected(false)
  }

  function send(obj: any) {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(obj))
  }

  function handleMessage(msg: any) {
    const { type, payload } = msg || {}
    switch (type) {
      case 'room_created':
        handlers.onRoomCreated?.(payload)
        break
      case 'player_joined':
        handlers.onPlayerJoined?.(payload)
        break
      case 'morph_game_started':
        handlers.onGameStarted?.(payload)
        break
      case 'morph_game_state':
        handlers.onGameStateUpdate?.(payload)
        break
      case 'morph_move_result':
        handlers.onMoveResult?.(payload)
        break
      case 'morph_hint_result':
        handlers.onHintResult?.(payload)
        break
      case 'morph_game_over':
        handlers.onGameOver?.(payload)
        break
      case 'rooms_list':
        handlers.onRoomsList?.(payload || [])
        break
      default:
        // ignore other messages
        break
    }
  }

  // API methods used by the app
  function createRoom(roomName: string) {
    send({ type: 'create_room', payload: { roomName, gameType: 'morph' } })
  }

  function listRooms() {
    send({ type: 'list_rooms', payload: {} })
  }

  function joinRoom(roomId: string) {
    send({ type: 'join_room', payload: { roomId } })
  }

  function startGame(roomId: string) {
    send({ type: 'start_game', payload: { roomId } })
  }

  function makeMove(roomId: string, move: any) {
    send({ type: 'morph_move', payload: { roomId, move } })
  }

  function sendChat(roomId: string, text: string) {
    send({ type: 'chat', payload: { roomId, text } })
  }

  function requestHint(roomId: string, limit = 1) {
    send({ type: 'morph_hint_request', payload: { roomId, limit } })
  }

  return {
    connected,
    connect,
    disconnect,
    createRoom,
    listRooms,
    joinRoom,
    startGame,
    makeMove,
    sendChat,
    requestHint,
  }
}

export default useWebSocket
