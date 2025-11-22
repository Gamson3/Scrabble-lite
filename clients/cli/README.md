# 🖥️ Scrabble-Lite CLI Client

Command-line interface for playing Scrabble-lite.

---

## 📋 Prerequisites

Make sure all backend services are running:
- User Service (port 3001)
- Dictionary Service (port 3002)
- Game Rules Service (port 3003)
- Room Service (port 3004)

---

## 🚀 Installation

```bash
cd clients/cli
npm install
```

---

## ▶️ Running the Client

```bash
npm run dev
```

Or build and run:
```bash
npm run build
npm start
```

---

## 🎮 How to Play

### 1. Authentication

**Register a new user:**
- Choose option `1` from the main menu
- Enter a unique username (3-20 characters, alphanumeric)

**Login:**
- Choose option `2`
- Enter your existing username

### 2. Create or Join a Room

**Create a room:**
- Choose option `1` from the game menu
- Enter a room name
- Wait for another player to join

**Join a room:**
- Choose option `3` from the game menu
- Get the room ID from another player or use option `2` to list rooms
- Enter the room ID

### 3. Start the Game

- Once 2 players are in the room, the host can start the game
- Choose option `1` in the game menu (only available for host)

### 4. Playing

**View the board:**
- Choose option `2` to display the 7×7 board
- `·` = empty cell
- `D` = Double Word Score (center at 3,3)
- Letters = placed tiles

**View your rack:**
- Choose option `3` to see your 5 tiles

**Make a move:**
- Choose option `4`
- Enter the word (e.g., `CAT`)
- Enter starting row (0-6)
- Enter starting column (0-6)
- Enter direction: `H` for horizontal, `V` for vertical

**Pass turn:**
- Choose option `5` to skip your turn
- Warning: Game ends after 6 consecutive passes

**View scores:**
- Choose option `6` to see current scores

### 5. Chat

- Choose option `7` to send a message to your opponent

---

## 🎯 Example Game Flow

**Terminal 1 - Player 1:**
```
1. Register → username: Tom
2. Create Room → name: My Game
3. Wait for player 2...
4. Start Game (as host)
5. Make Move → CAT at (3,2) horizontal
```

**Terminal 2 - Player 2:**
```
1. Register → username: bob
2. List Rooms → see "My Game"
3. Join Room → enter room ID
4. Wait for host to start...
5. Make Move → DOG at (3,3) vertical
```

---

## 📊 Game Rules

- **Board:** 7×7 grid
- **Rack Size:** 5 tiles per player
- **Words:** Must be 2+ letters and in the dictionary
- **Placement:** Horizontal or vertical only
- **Scoring:** Sum of letter values
  - A=1, B=3, C=3, D=2, E=1, F=4, G=2, H=4, I=1, J=8, K=5, L=1, M=3
  - N=1, O=1, P=3, Q=10, R=1, S=1, T=1, U=1, V=4, W=4, X=8, Y=4, Z=10
- **Double Word:** Center cell (3,3) doubles word score
- **Win Condition:** Highest score when game ends

---

## 🎨 CLI Features

### Visual Elements
- Color-coded messages (errors, success, info)
- ASCII board with row/column numbers
- Turn indicator (🟢 for your turn)
- Real-time score updates
- Chat messages

### Keyboard Commands
- Clear menus with numbered options
- Simple input prompts
- Type `rs` in nodemon to restart

---

## 🐛 Troubleshooting

### "Connection timeout"
- Make sure Room Service is running on port 3004
- Check that WebSocket server is initialized

### "Not connected to server"
- Restart the CLI client
- Check that you're logged in

### "Invalid move"
- Ensure word is in dictionary (87 words available)
- Check that tiles are in your rack
- Verify position is within board bounds (0-6)
- Make sure it's your turn

### Services not responding
```bash
# Check if services are running
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
```

---

## 🔧 Development

### Project Structure
```
clients/cli/
├── src/
│   ├── index.ts          # Main CLI entry point
│   └── game-client.ts    # WebSocket client & game logic
├── package.json
├── tsconfig.json
└── README.md
```

### Dependencies
- **ws** - WebSocket client
- **axios** - HTTP requests to services
- **readline-sync** - Interactive prompts
- **chalk** - Terminal colors

---

## 📝 Available Commands

### Authentication Menu
- `1` - Register new user
- `2` - Login existing user
- `3` - Exit

### Main Menu (After Login)
- `1` - Create Room
- `2` - List Rooms
- `3` - Join Room
- `4` - Logout
- `5` - Exit

### Game Menu (In Room)
- `1` - Start Game (host only, before game starts)
- `2` - Show Board
- `3` - Show Rack
- `4` - Make Move
- `5` - Pass Turn
- `6` - Show Scores
- `7` - Send Chat Message
- `8` - Leave Room

---

## 🎬 Demo Script

Two players on the same machine:

**Terminal 1:**
```bash
cd clients/cli
npm run dev
# Register as "Tom"
# Create room "Quick Game"
# Start game when bob joins
# Place "CAT" at row 3, col 2, horizontal
```

**Terminal 2:**
```bash
cd clients/cli
npm run dev
# Register as "bob"
# Join Tom's room
# Place "ATE" at row 3, col 3, vertical
```

---

## ✅ Testing Checklist

- [ ] Can register and login
- [ ] Can create and join rooms
- [ ] Can see board and rack
- [ ] Can make valid moves
- [ ] Can see score updates
- [ ] Invalid moves show errors
- [ ] Turn switching works
- [ ] Chat messages appear
- [ ] Game ends correctly

---

## 🚀 Next Steps

Once CLI is working:
- Build Web Client (React + Vite)
- Build Mobile Client (Capacitor)
- Add features (tile exchange, game history)
