# WebSocket Message Specification

Real-time communication protocol between clients and Room Service.

**WebSocket URL:** `ws://localhost:3004`

---

## 📡 Connection Flow

```
Client                          Room Service
  |                                  |
  |-------- WS Connect ------------->|
  |                                  |
  |-------- auth message ----------->|
  |                                  |
  |<------- auth_ok/error -----------|
  |                                  |
  |  Now ready for game messages     |
```

---

## 🔐 Authentication Messages

### Client → Server: `auth`

Authenticate the WebSocket connection.

```json
{
  "type": "auth",
  "payload": {
    "token": "tok_xyz789_session",
    "userId": "usr_abc123"
  }
}
```

---

### Server → Client: `auth_ok`

Authentication successful.

```json
{
  "type": "auth_ok",
  "payload": {
    "userId": "usr_abc123",
    "username": "player1"
  }
}
```

---

### Server → Client: `error`

Generic error message.

```json
{
  "type": "error",
  "payload": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

---

## 🏠 Room Management Messages

### Client → Server: `create_room`

Create a new game room.

```json
{
  "type": "create_room",
  "payload": {
    "roomName": "Player1's Game"
  }
}
```

---

### Server → Client: `room_created`

Room successfully created.

```json
{
  "type": "room_created",
  "payload": {
    "roomId": "room_123",
    "roomName": "Player1's Game",
    "host": "usr_abc123",
    "players": [
      {
        "userId": "usr_abc123",
        "username": "player1"
      }
    ],
    "status": "waiting"
  }
}
```

---

### Client → Server: `list_rooms`

Request list of available rooms.

```json
{
  "type": "list_rooms",
  "payload": {}
}
```

---

### Server → Client: `rooms_list`

Available rooms response.

```json
{
  "type": "rooms_list",
  "payload": {
    "rooms": [
      {
        "roomId": "room_123",
        "roomName": "Player1's Game",
        "playerCount": 1,
        "maxPlayers": 2,
        "status": "waiting"
      },
      {
        "roomId": "room_456",
        "roomName": "Quick Match",
        "playerCount": 2,
        "maxPlayers": 2,
        "status": "playing"
      }
    ]
  }
}
```

---

### Client → Server: `join_room`

Join an existing room.

```json
{
  "type": "join_room",
  "payload": {
    "roomId": "room_123"
  }
}
```

---

### Server → Client: `player_joined`

Broadcast to all players in room when someone joins.

```json
{
  "type": "player_joined",
  "payload": {
    "roomId": "room_123",
    "player": {
      "userId": "usr_def456",
      "username": "player2"
    },
    "players": [
      {
        "userId": "usr_abc123",
        "username": "player1"
      },
      {
        "userId": "usr_def456",
        "username": "player2"
      }
    ],
    "status": "ready"
  }
}
```

---

### Client → Server: `start_game`

Request to start the game (host only).

```json
{
  "type": "start_game",
  "payload": {
    "roomId": "room_123"
  }
}
```

---

### Server → Client: `game_started`

Broadcast when game begins.

```json
{
  "type": "game_started",
  "payload": {
    "roomId": "room_123",
    "gameState": {
      "board": [
        [null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
        [null, null, null, "DW", null, null, null],
        [null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null]
      ],
      "racks": {
        "usr_abc123": ["A", "T", "C", "E", "R"]
      },
      "scores": {
        "usr_abc123": 0,
        "usr_def456": 0
      },
      "tileBag": {
        "remaining": 88
      },
      "currentPlayer": "usr_abc123",
      "turnCount": 0,
      "gameStatus": "active"
    }
  }
}
```

---

## 🎮 Gameplay Messages

### Client → Server: `make_move`

Submit a word placement.

```json
{
  "type": "make_move",
  "payload": {
    "roomId": "room_123",
    "word": "CAT",
    "startRow": 3,
    "startCol": 2,
    "direction": "horizontal",
    "tiles": ["C", "A", "T"]
  }
}
```

---

### Server → Client: `move_result`

Result of move validation.

```json
{
  "type": "move_result",
  "payload": {
    "valid": true,
    "score": 5,
    "wordsFormed": ["CAT"],
    "player": "usr_abc123"
  }
}
```

**Invalid move example:**
```json
{
  "type": "move_result",
  "payload": {
    "valid": false,
    "player": "usr_abc123",
    "errors": [
      {
        "code": "INVALID_WORD",
        "message": "Word 'XYZ' not found in dictionary"
      }
    ]
  }
}
```

---

### Server → Client: `game_state`

Broadcast updated game state after valid move.

```json
{
  "type": "game_state",
  "payload": {
    "roomId": "room_123",
    "gameState": {
      "board": [
        [null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
        [null, null, "C", "A", "T", null, null],
        [null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null]
      ],
      "racks": {
        "usr_abc123": ["E", "R", "O", "N", "S"]
      },
      "scores": {
        "usr_abc123": 5,
        "usr_def456": 0
      },
      "tileBag": {
        "remaining": 85
      },
      "currentPlayer": "usr_def456",
      "turnCount": 1,
      "passCount": 0,
      "gameStatus": "active"
    },
    "lastMove": {
      "player": "usr_abc123",
      "word": "CAT",
      "score": 5
    }
  }
}
```

---

### Client → Server: `pass_turn`

Skip turn without playing.

```json
{
  "type": "pass_turn",
  "payload": {
    "roomId": "room_123"
  }
}
```

---

### Server → Client: `turn_passed`

Broadcast pass notification.

```json
{
  "type": "turn_passed",
  "payload": {
    "player": "usr_abc123",
    "currentPlayer": "usr_def456",
    "passCount": 1
  }
}
```

---

### Client → Server: `exchange_tiles`

Exchange tiles from rack.

```json
{
  "type": "exchange_tiles",
  "payload": {
    "roomId": "room_123",
    "tiles": ["X", "Z"]
  }
}
```

---

### Server → Client: `tiles_exchanged`

Confirmation of tile exchange.

```json
{
  "type": "tiles_exchanged",
  "payload": {
    "player": "usr_abc123",
    "newTilesCount": 2,
    "currentPlayer": "usr_def456"
  }
}
```

---

### Server → Client: `game_over`

Game ended notification.

```json
{
  "type": "game_over",
  "payload": {
    "roomId": "room_123",
    "winner": "usr_abc123",
    "finalScores": {
      "usr_abc123": 47,
      "usr_def456": 32
    },
    "reason": "opponent_passed_limit",
    "gameState": {...}
  }
}
```

---

## 💬 Chat Messages (Optional)

### Client → Server: `chat_message`

Send chat message to room.

```json
{
  "type": "chat_message",
  "payload": {
    "roomId": "room_123",
    "message": "Good game!"
  }
}
```

---

### Server → Client: `chat_broadcast`

Broadcast chat to all players.

```json
{
  "type": "chat_broadcast",
  "payload": {
    "roomId": "room_123",
    "userId": "usr_abc123",
    "username": "player1",
    "message": "Good game!",
    "timestamp": "2025-01-15T10:35:00Z"
  }
}
```

---

## 🔤 Word Morph Duel Messages

Lightweight protocol that powers the Morph Duel helper features (insights, warnings, guardrails, and hints). Unless stated otherwise, all payloads include the usual `roomId` and follow the same error semantics described earlier.

### Client → Server: `start_game`

Start Morph Duel by sending `"gameMode": "morph"` in the payload. The room service replies with `morph_game_started`.

```json
{
  "type": "start_game",
  "payload": {
    "roomId": "room_123",
    "gameMode": "morph"
  }
}
```

### Server → Client: `morph_game_started`

Initial state snapshot plus insight metadata for the start/target words.

```json
{
  "type": "morph_game_started",
  "payload": {
    "roomId": "room_123",
    "gameState": {
      "startWord": "SLATE",
      "targetWord": "CRANE",
      "startWordMeta": {
        "neighborCount": 24,
        "branchLevel": "high"
      },
      "targetWordMeta": {
        "neighborCount": 11,
        "branchLevel": "medium"
      },
      "players": {
        "usr_a": {
          "currentWord": "SLATE",
          "lastInsight": {
            "word": "SLATE",
            "neighborCount": 24,
            "branchLevel": "high",
            "distanceToTarget": 3
          }
        }
      },
      "currentPlayer": "usr_a",
      "turnCount": 0
    }
  }
}
```

### Client → Server: `morph_move`

Submit a one-letter morph attempt.

```json
{
  "type": "morph_move",
  "payload": {
    "roomId": "room_123",
    "newWord": "PLATE"
  }
}
```

### Server → Client: `morph_move_result`

Move validation outcome for the requesting player. Includes helper data for the word they just played.

```json
{
  "type": "morph_move_result",
  "payload": {
    "valid": true,
    "feedback": ["gray", "yellow", "gray", "gray", "green"],
    "transformationCount": 1,
    "completed": false,
    "insight": {
      "word": "PLATE",
      "neighborCount": 15,
      "branchLevel": "high",
      "distanceToTarget": 2,
      "neighborPreview": ["SLATE", "PLAIN", "PLATE", "PLAZA"]
    },
    "warnings": [
      {
        "code": "LOW_BRANCHING",
        "message": "Only 2 safe neighbors"
      }
    ],
    "hintBudget": {
      "used": 1,
      "remaining": 4,
      "limit": 5
    }
  }
}
```

Invalid attempts include `errors` the same way core Scrabble moves do.

### Server → Client: `morph_game_state`

Room-wide broadcast after every valid morph move. Structure matches `morph_game_started`, with per-player `lastInsight`, `warnings`, `hintBudget`, and `turnHistory` arrays so spectators can visualize progress.

### Server → Client: `morph_game_over`

Emitted when someone reaches the target word (or the game forcibly ends). Contains the final `gameState`, `winner`, and `winningPath` summary.

### Client → Server: `morph_hint_request`

Ask for smart suggestions based on the caller's current word. Optional `limit` (default `3`, max `5`). This request is rejected if the player's hint budget is exhausted.

```json
{
  "type": "morph_hint_request",
  "payload": {
    "roomId": "room_123",
    "limit": 3
  }
}
```

### Server → Client: `morph_hint_result`

Deliver suggestions plus the updated hint counters.

```json
{
  "type": "morph_hint_result",
  "payload": {
    "roomId": "room_123",
    "suggestions": [
      {
        "word": "CRATE",
        "category": "distance",
        "distanceDelta": 2,
        "branchLevel": "high",
        "neighborCount": 17,
        "distanceToTarget": 1
      },
      {
        "word": "PRATE",
        "category": "safe",
        "distanceDelta": 1,
        "branchLevel": "high",
        "neighborCount": 22
      }
    ],
    "hintBudget": {
      "used": 2,
      "remaining": 3,
      "limit": 5
    }
  }
}
```

Clients must handle empty `suggestions` arrays (no smart hints available) and surface `warnings`/`insight` metadata in their UI to keep players informed about potential dead ends.

---

## 📊 Status Messages

### Client → Server: `ping`

Keep-alive ping.

```json
{
  "type": "ping",
  "payload": {}
}
```

---

### Server → Client: `pong`

Keep-alive response.

```json
{
  "type": "pong",
  "payload": {
    "timestamp": "2025-01-15T10:35:00Z"
  }
}
```

---

## 🚨 Error Codes Reference

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Invalid or missing token |
| `ROOM_NOT_FOUND` | Room does not exist |
| `ROOM_FULL` | Room already has 2 players |
| `NOT_YOUR_TURN` | It's not your turn |
| `GAME_NOT_STARTED` | Game hasn't started yet |
| `INVALID_MOVE` | Move validation failed |
| `INVALID_WORD` | Word not in dictionary |
| `INVALID_POSITION` | Position out of bounds |
| `NOT_ENOUGH_TILES` | Not enough tiles in tile bag |
| `PLAYER_NOT_IN_ROOM` | Player is not in this room |

---

## 🔄 Message Flow Examples

### Complete Game Flow

```
1. Client A: auth → Server: auth_ok
2. Client B: auth → Server: auth_ok

3. Client A: create_room → Server: room_created (to A)
4. Client B: list_rooms → Server: rooms_list (to B)
5. Client B: join_room → Server: player_joined (broadcast to A & B)

6. Client A: start_game → Server: game_started (broadcast to A & B)

7. Client A: make_move → Server: move_result (to A)
                      → Server: game_state (broadcast to A & B)

8. Client B: make_move → Server: move_result (to B)
                      → Server: game_state (broadcast to A & B)

9. ... (continue playing)

10. Server: game_over (broadcast to A & B)
```

---

## 📝 Implementation Notes

- All messages must be valid JSON
- `type` field is mandatory in all messages
- `payload` field contains message-specific data
- Server broadcasts game state after every valid move
- Clients should handle reconnection logic
- Keep-alive pings recommended every 30 seconds
- Error messages always include `code` and `message`