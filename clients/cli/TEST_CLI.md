# 🧪 CLI Client Testing Guide

Step-by-step guide to test the CLI client.

---

## ✅ Pre-requisites

Make sure all services are running:

```bash
# Check services
curl http://localhost:3001/health  # User Service
curl http://localhost:3002/health  # Dictionary Service
curl http://localhost:3003/health  # Game Rules Service
curl http://localhost:3004/health  # Room Service
```

All should return `{"status": "ok", ...}`

---

## 🚀 Setup CLI Client

```bash
cd clients/cli
npm install
npm run dev
```

---

## 🎮 Test Scenario 1: Single Player Flow

### Step 1: Register
```
Choice: 1
Enter username: testplayer1
```

**Expected:**
- ✅ Registered successfully
- Auto-login
- Connected to game server

### Step 2: Create Room
```
Choice: 1
Enter room name: Test Room 1
```

**Expected:**
- ✅ Room created
- Shows room ID
- "Waiting for another player..."

### Step 3: List Rooms (in another terminal)
```
Choice: 2
```

**Expected:**
- Shows "Test Room 1" with 1/2 players

---

## 🎮 Test Scenario 2: Two Player Game

### Terminal 1 - Player 1 (Tom)

```bash
cd clients/cli
npm run dev
```

**Steps:**
1. Register → username: `Tom`
2. Create Room → name: `Tom's Game`
3. Wait for player 2...

### Terminal 2 - Player 2 (Bob)

```bash
cd clients/cli
npm run dev
```

**Steps:**
1. Register → username: `bob`
2. List Rooms
3. Join Room → enter the room ID from Tom
4. Wait for Tom to start...

### Back to Terminal 1 (Tom)

**Steps:**
5. Start Game (option 1)
6. Show Board (option 2) - should see empty 7×7 board
7. Show Rack (option 3) - should see 5 tiles
8. Make Move (option 4)
   - Word: `CAT`
   - Start Row: `3`
   - Start Col: `2`
   - Direction: `H`

**Expected:**
- ✅ Valid move! You scored X points!
- Board updates with CAT placed
- Turn switches to Bob

### Terminal 2 (Bob)

**Steps:**
9. Show Board - should see CAT on the board
10. Show Rack - should see your 5 tiles
11. Make Move (option 4)
    - Word: `ATE` (if you have A, T, E)
    - Start Row: `3`
    - Start Col: `3`
    - Direction: `V` (vertical)

**Expected:**
- ✅ Valid move! You scored X points!
- Board shows both words
- Turn switches back to Tom

---

## 🎯 Test Scenario 3: Invalid Moves

### Test Invalid Word
```
Make Move:
Word: XYZ
Start Row: 0
Start Col: 0
Direction: H
```

**Expected:**
- ❌ Invalid move: Word 'XYZ' not found in dictionary

### Test Out of Bounds
```
Make Move:
Word: CAT
Start Row: 6
Start Col: 6
Direction: H
```

**Expected:**
- ❌ Invalid move: Word extends beyond board

### Test Wrong Turn
**When it's not your turn, try to make a move:**

**Expected:**
- ❌ Invalid move: It's not your turn

---

## 💬 Test Scenario 4: Chat

**In either terminal:**
```
Choice: 7
Message: Good game!
```

**Expected:**
- Message appears in both terminals
- Your message: "💬 You: Good game!"
- Opponent sees: "💬 Tom: Good game!"

---

## ⏭️ Test Scenario 5: Pass Turn

**When it's your turn:**
```
Choice: 5
```

**Expected:**
- ⏭️ [Your name] passed their turn
- Turn switches to opponent
- Pass count increments

---

## 📊 Test Scenario 6: View Scores

**At any time during game:**
```
Choice: 6
```

**Expected:**
- Shows both players' scores
- Current player marked with ►
- Your name in bold cyan

---

## 🏁 Test Scenario 7: Game End

**Simulate game end by passing 6 times in a row:**

**Tom:** Pass → **Bob:** Pass → **Tom:** Pass (repeat 3 times)

**Expected after 6th pass:**
- 🏁 GAME OVER!
- Winner announced
- Final scores displayed

---

## 🐛 Common Issues & Solutions

### "Connection timeout"
```bash
# Check Room Service is running
curl http://localhost:3004/health

# Restart Room Service
cd services/room
npm run dev
```

### "Authentication failed"
```bash
# Check User Service
curl http://localhost:3001/health

# Try registering a new user
```

### "Invalid move" but word should be valid
```bash
# Check Dictionary Service
curl -X POST http://localhost:3002/validate \
  -H "Content-Type: application/json" \
  -d '{"word": "cat"}'

# Should return: {"word": "cat", "valid": true}
```

### Board not updating
```
# Try these commands:
- Show Board (option 2)
- Show Rack (option 3)
- Show Scores (option 6)
```

### Can't make a move
```
# Check:
1. Is it your turn? (look for 🟢 IT'S YOUR TURN!)
2. Do you have the tiles in your rack?
3. Is the word in the dictionary?
4. Are coordinates valid (0-6)?
```

---

## ✅ Success Criteria

All of these should work:

- [ ] User registration
- [ ] User login
- [ ] Create room
- [ ] List rooms
- [ ] Join room
- [ ] Start game (host)
- [ ] Display board
- [ ] Display rack
- [ ] Make valid move
- [ ] Reject invalid move
- [ ] Turn switching
- [ ] Score updates
- [ ] Pass turn
- [ ] Chat messages
- [ ] Game end detection

---

## 📸 Screenshot of Successful Game

You should see:

```
╔════════════════════════════════════════╗
║     SCRABBLE-LITE CLI CLIENT        ║
║     7×7 Board • 5-Letter Racks       ║
╚════════════════════════════════════════╝

🔌 WebSocket connected
✅ Authenticated: Tom (usr_abc123...)
✅ Connected to game server!

✅ Room created: Tom's Game
Room ID: room_def456...
⏳ Waiting for another player to join...

✅ bob joined the room!
Players: 2/2

🎮 Room is ready! Host can start the game.

🎮 Game Started!

╔═══════════════════════════════════╗
║         GAME BOARD (7×7)         ║
╠═══════════════════════════════════╣
║     0   1   2   3   4   5   6  ║
╠═══════════════════════════════════╣
║ 0 ║ · │ · │ · │ · │ · │ · │ · │
║ 1 ║ · │ · │ · │ · │ · │ · │ · │
║ 2 ║ · │ · │ · │ · │ · │ · │ · │
║ 3 ║ · │ · │ C │ A │ T │ · │ · │
║ 4 ║ · │ · │ · │ · │ · │ · │ · │
║ 5 ║ · │ · │ · │ · │ · │ · │ · │
║ 6 ║ · │ · │ · │ · │ · │ · │ · │
╚═══════════════════════════════════╝

Your Rack:
╔═════════════════════════════╗
║   D   O   G   E   R     ║
╚═════════════════════════════╝

📊 Scores:
  ► You: 5 points
    bob: 0 points

🟢 IT'S YOUR TURN!
Turn: 2 | Tiles left: 88
```

---

## 🎬 Record Your Demo

Once everything works, you can record your demo:

1. Start all 4 services in separate terminals
2. Start 2 CLI clients
3. Play through a complete game
4. Save terminal output for presentation

---

## 🚀 Next Steps

Once CLI testing is complete:
- ✅ Phase 6 Complete!
- ➡️ Phase 7: Build Web Client
- ➡️ Phase 8: Build Mobile Client
- ➡️ Phase 9-12: Testing, Docs, Demo
