# HTTP API Reference

This file documents the primary HTTP endpoints used by the microservices. For WebSocket message schemas see `WEBSOCKET.md`.

Authentication
- Header: `Authorization: Bearer <token>`
- Error format (JSON): `{ "code": "<code>", "message": "<human message>" }`

Health
- GET `/health`
	- Response: `{ "status": "ok", "service": "<name>", "uptime": <seconds> }`

User Service
- POST `/users/register`
	- Request: `{ "username": "alice" }`
	- Response: `{ "userId": "u_123", "username": "alice", "token": "<jwt>" }`

- POST `/users/login`
	- Request: `{ "username": "alice" }`
	- Response: `{ "userId": "u_123", "username": "alice", "token": "<jwt>" }`

- GET `/users/:id`
	- Requires Authorization
	- Response: `{ "userId": "u_123", "username": "alice" }`

Dictionary Service
- POST `/validate`
	- Request: `{ "word": "crate" }`
	- Response (valid): `{ "word": "crate", "valid": true }`
	- Response (invalid): `{ "word": "xyzzy", "valid": false }`

- GET `/words?length=5`
	- Returns the list of known words for tooling and offline checks.

Game Rules Service (Morph)
- POST `/morph/:roomId/start`
	- Request: `{ "gameMode": "morph", "options": { /* optional */ } }`
	- Response: initial `MorphGameState` JSON snapshot (see `MorphGameState.ts` types).

- POST `/morph/:roomId/move`
	- Request: `{ "userId": "u_123", "newWord": "plate" }`
	- Response (success):
		`{ "valid": true, "feedback": ["gray","yellow","green"], "gameState": { /* updated state */ } }`
	- Response (error): `{ "valid": false, "errors": [{ "code": "INVALID_MOVE", "message": "Must change exactly one letter" }] }`

- GET `/morph/:roomId/state`
	- Returns the latest `MorphGameState` for the room.

- POST `/morph/:roomId/hint`
	- Request: `{ "userId": "u_123", "hintType": "safe" }`
	- Response: `{ "hints": ["PLATE -> PLACE"], "hintBudget": { "used": 1, "remaining": 4 } }`

Room Service (HTTP helpers)
- POST `/rooms`
	- Create a new room. Request: `{ "name": "Fun Match", "hostId": "u_123" }`.
	- Response: `{ "roomId": "r_456", "name": "Fun Match", "players": [ "u_123" ] }`

- GET `/rooms`
	- Returns list of active rooms.

- POST `/rooms/:id/join`
	- Request: `{ "userId": "u_789" }` — joins the room and returns room metadata.

Notes & Conventions
- All endpoints return `200` on success, `4xx` for client errors and `5xx` for server errors.
- Error body always contains `{ "code": "<code>", "message": "<human message>" }`.
- WebSocket real-time actions (gameplay, chat, room joins) are defined in `shared/specs/WEBSOCKET.md` and are the preferred real-time channel; HTTP endpoints exist for convenience and tooling.

Examples

Validate word (curl):
```bash
curl -s -X POST http://localhost:3002/validate -H 'Content-Type: application/json' -d '{"word":"crate"}'
```

Make morph move (curl):
```bash
curl -s -X POST http://localhost:3003/morph/r_456/move -H 'Content-Type: application/json' -H 'Authorization: Bearer <token>' -d '{"userId":"u_123","newWord":"plate"}'
```

See also: `WEBSOCKET.md` for the real-time message shapes (chat_broadcast, morph_move, morph_game_state, morph_move_result, etc.).

