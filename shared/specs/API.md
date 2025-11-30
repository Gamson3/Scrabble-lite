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
	- Request: `{ "username": "Tom" }`
	- Response: `{ "userId": "u_123", "username": "Tom", "token": "<jwt>" }`

- POST `/users/login`
	- Request: `{ "username": "Tom" }`
	- Response: `{ "userId": "u_123", "username": "Tom", "token": "<jwt>" }`

- GET `/users/:id`
	- Requires Authorization
	- Response: `{ "userId": "u_123", "username": "Tom" }`

Dictionary Service
- POST `/validate`
	- Request: `{ "word": "crate" }`
	- Response (valid): `{ "word": "crate", "valid": true }`
	- Response (invalid): `{ "word": "xyzzy", "valid": false }`

- GET `/words?length=5`
	- Returns the list of known words for tooling and offline checks.

Game Rules Service (Circle Word Game)
- POST `/circle/:roomId/start`
	- Request: `{ "playerIds": ["u_123", "u_456"], "usernames": {"u_123": "Tom", "u_456": "bob"} }`
	- Response: initial `CircleGameState` JSON snapshot with 9 circle letters (see `CircleGameState.ts` types).

- POST `/circle/:roomId/word`
	- Request: `{ "userId": "u_123", "word": "stream" }`
	- Response (success):
		`{ "isValid": true, "score": 8, "gameState": { /* updated state */ } }`
	- Response (error): `{ "isValid": false, "error": { "code": "NON_ADJACENT", "message": "Letters must be adjacent in circle" } }`

- GET `/circle/:roomId`
	- Returns the latest `CircleGameState` for the room.

- POST `/circle/:roomId/end-round`
	- Request: `{}`
	- Response: `{ "roundWinner": "u_123", "scores": {...}, "gameState": {...} }`

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

Submit word in Circle game (curl):
```bash
curl -s -X POST http://localhost:3003/circle/r_456/word -H 'Content-Type: application/json' -d '{"userId":"u_123","word":"stream"}'
```

See also: `WEBSOCKET.md` for the real-time message shapes (chat_broadcast, morph_move, morph_game_state, morph_move_result, etc.).

