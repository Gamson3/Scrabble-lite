# 💻 Code Snippets for Presentation

**Files to have open in VS Code during presentation**

---

## 📂 FILE 1: Service-to-Service HTTP Communication

**Path:** `services/room/src/websocket/websocketHandler.ts`

**Lines to show:** ~179-210 (handleCircleSubmitWord function)

```typescript
// ============================================================
// SERVICE-TO-SERVICE: Room Service → Game Rules Service
// ============================================================

async function handleCircleSubmitWord(ws: WebSocket, payload: any) {
  const client = clients.get(ws);
  if (!client) return;

  const { roomId, word } = payload;
  const room = rooms.get(roomId);
  if (!room) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Room not found' }
    }));
    return;
  }

  try {
    console.log(`📤 [Room Service] Forwarding word "${word}" to Game Rules Service`);
    
    // ✅ STEP 1: HTTP POST to Game Rules Service
    const gameRulesResponse = await axios.post(
      `${GAME_SERVICE_URL}/circle/${roomId}/word`,
      {
        userId: client.userId,
        word: word.toUpperCase(),
      },
      { timeout: 5000 }
    );

    // ✅ STEP 2: Extract validation result
    const { isValid, score, gameState } = gameRulesResponse.data;

    console.log(`📥 [Room Service] Game Rules response: valid=${isValid}, score=${score}`);

    // ✅ STEP 3: Broadcast to all players via WebSocket
    broadcastToRoom(roomId, 'circle_word_submitted', {
      userId: client.userId,
      username: client.username,
      word: word.toUpperCase(),
      isValid,
      score: isValid ? score : 0,
      gameState,
    });

  } catch (error) {
    console.error('❌ [Room Service] Error submitting word:', error);
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Failed to submit word' }
    }));
  }
}

// ============================================================
// Broadcasting function
// ============================================================
function broadcastToRoom(roomId: string, type: string, payload: any) {
  const room = rooms.get(roomId);
  if (!room) return;

  const message = JSON.stringify({ type, payload });
  
  room.players.forEach(playerId => {
    // Find WebSocket connection for this player
    for (const [ws, client] of clients.entries()) {
      if (client.userId === playerId && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  });
}
```

**What to say:**
> "Here you can see the Room Service acting as a gateway. It receives the word submission from the client via WebSocket, forwards it to the Game Rules Service using HTTP POST, and then broadcasts the validation result back to all players in the room. This demonstrates the gateway pattern and service orchestration."

---

## 📂 FILE 2: Game Rules → Dictionary Service

**Path:** `services/game-rules/src/services/circleGameService.ts`

**Lines to show:** ~203-240 (submitWord function with Dictionary call)

```typescript
// ============================================================
// SERVICE-TO-SERVICE: Game Rules → Dictionary Service
// ============================================================

export async function submitWord(
  roomId: string,
  userId: string,
  submittedWord: string
): Promise<WordSubmissionResult> {
  const gameState = activeGames.get(roomId);
  if (!gameState) {
    return {
      isValid: false,
      score: 0,
      error: { code: 'GAME_NOT_FOUND', message: 'Game not found' }
    };
  }

  const word = submittedWord.toUpperCase();
  const player = gameState.players[userId];

  // Check if already submitted
  const alreadySubmitted = player.currentRoundWords.some(w => w.word === word);
  if (alreadySubmitted) {
    return {
      isValid: false,
      score: 0,
      error: { code: 'DUPLICATE', message: 'Word already submitted' }
    };
  }

  console.log(`🔍 [Game Rules] Validating word "${word}" with Dictionary Service`);

  // ✅ STEP 1: Call Dictionary Service via HTTP
  const dictionaryResponse = await axios.post(
    `${DICTIONARY_SERVICE_URL}/validate`,
    { word },
    { timeout: 5000 }
  );

  // ✅ STEP 2: Check if word is valid
  const isValidWord = dictionaryResponse.data.valid;
  if (!isValidWord) {
    console.log(`❌ [Game Rules] Word "${word}" not in dictionary`);
    return {
      isValid: false,
      score: 0,
      error: { code: 'INVALID_WORD', message: 'Word not in dictionary' }
    };
  }

  console.log(`✅ [Game Rules] Word "${word}" is valid`);

  // ✅ STEP 3: Validate word can be formed from circle letters
  const canFormWord = validateWordFromCircle(
    word,
    gameState.currentRound.circleLetters
  );

  if (!canFormWord) {
    console.log(`❌ [Game Rules] Word "${word}" cannot be formed from circle`);
    return {
      isValid: false,
      score: 0,
      error: { code: 'NON_ADJACENT', message: 'Letters must be adjacent in circle' }
    };
  }

  // ✅ STEP 4: Calculate Scrabble-style score
  const score = calculateScore(word);
  console.log(`💯 [Game Rules] Word "${word}" scored ${score} points`);

  // ✅ STEP 5: Update game state
  player.currentRoundWords.push({ word, score });
  player.totalScore += score;

  return {
    isValid: true,
    score,
    gameState
  };
}
```

**What to say:**
> "The Game Rules Service validates each word by calling the Dictionary Service via HTTP. It checks if the word is valid, verifies it can be formed from adjacent circle letters, calculates Scrabble-style points, and updates the game state. All game logic is server-authoritative to prevent cheating."

---

## 📂 FILE 3: Client WebSocket Communication

**Path:** `clients/cli/src/index.ts`

**Lines to show:** ~250-280 (WebSocket setup and message handling)

```typescript
// ============================================================
// CLIENT: WebSocket Connection Setup
// ============================================================

private setupWebSocket(token: string) {
  console.log('🔌 Connecting to game server...');
  this.ws = new WebSocket(ROOM_SERVICE_WS);

  // ✅ Connection opened
  this.ws.on('open', () => {
    console.log(chalk.green('✅ Connected to game server!'));
    
    // Authenticate immediately after connection
    this.sendMessage('auth', {
      token,
      userId: this.session!.userId,
    });
  });

  // ✅ Handle incoming messages
  this.ws.on('message', (data: WebSocket.Data) => {
    const message = JSON.parse(data.toString());
    const handler = this.handlers.get(message.type);
    
    if (handler) {
      handler(message.payload);
    } else {
      console.log(chalk.gray(`⚠️ Unhandled message: ${message.type}`));
    }
  });

  // Connection closed
  this.ws.on('close', () => {
    console.log(chalk.yellow('🔌 Disconnected from game server'));
  });

  // Connection error
  this.ws.on('error', (error) => {
    console.error(chalk.red('❌ WebSocket error:'), error.message);
  });
}

// ============================================================
// CLIENT: Sending Messages
// ============================================================

private sendMessage(type: string, payload: any) {
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
    console.log(chalk.red('❌ Not connected to server'));
    return;
  }

  this.ws.send(JSON.stringify({ type, payload }));
}

// ✅ Example: Submit word
private async submitWord() {
  const word = readlineSync.question('\nEnter word: ').trim().toUpperCase();
  
  if (!word) return;

  console.log(chalk.gray(`📤 Submitting word: ${word}`));
  
  this.sendMessage('circle_submit_word', {
    roomId: this.currentRoom!.roomId,
    word,
  });
}

// ============================================================
// CLIENT: Receiving Real-Time Updates
// ============================================================

// Handler setup
private setupHandlers() {
  // ✅ Word submission result
  this.handlers.set('circle_word_submitted', (payload) => {
    if (payload.isValid) {
      console.log(chalk.green(
        `✅ ${payload.username}: ${payload.word} (+${payload.score} points)`
      ));
    } else {
      console.log(chalk.red(
        `❌ ${payload.username}: ${payload.word} (invalid)`
      ));
    }
    
    // Update local game state
    this.gameState = payload.gameState;
    this.displayScores();
  });

  // ✅ Round ended
  this.handlers.set('circle_round_ended', (payload) => {
    console.log(chalk.cyan('\n⏰ TIME\'S UP!\n'));
    console.log(chalk.yellow(`🏆 Round Winner: ${payload.roundWinner}`));
    this.gameState = payload.gameState;
  });

  // ✅ Game over
  this.handlers.set('circle_game_over', (payload) => {
    console.log(chalk.green('\n🏆 GAME OVER!\n'));
    this.gameState = payload.gameState;
    this.currentState = 'game-over';
  });
}
```

**What to say:**
> "On the client side, we establish a WebSocket connection using the ws library. The client sends JSON messages to the server and receives real-time updates. When a word is submitted, both players instantly see the result and updated scores. This bidirectional communication is essential for multiplayer games where timing and real-time feedback matter."

---

## 📂 FILE 4: Letter Circle Generation

**Path:** `services/game-rules/src/services/circleGameService.ts`

**Lines to show:** ~88-128 (generateCircleLetters function)

```typescript
// ============================================================
// GAME LOGIC: Circle Letter Generation
// ============================================================

function generateCircleLetters(): string[] {
  // Balanced distribution: 3-4 vowels, 5-6 consonants
  const vowels = ['A', 'E', 'I', 'O', 'U'];
  const commonConsonants = ['T', 'N', 'S', 'R', 'L', 'D'];
  const lessCommonConsonants = ['C', 'M', 'P', 'B', 'F', 'G', 'H', 'W', 'Y'];

  const letters: string[] = [];

  // ✅ Add 3-4 vowels
  const vowelCount = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < vowelCount; i++) {
    const vowel = vowels[Math.floor(Math.random() * vowels.length)];
    letters.push(vowel);
  }

  // ✅ Add common consonants
  const commonCount = Math.min(3, 9 - letters.length);
  for (let i = 0; i < commonCount; i++) {
    const consonant = commonConsonants[Math.floor(Math.random() * commonConsonants.length)];
    letters.push(consonant);
  }

  // ✅ Fill remaining with less common consonants
  while (letters.length < 9) {
    const consonant = lessCommonConsonants[Math.floor(Math.random() * lessCommonConsonants.length)];
    letters.push(consonant);
  }

  // ✅ Shuffle for random arrangement
  return shuffleArray(letters);
}

// ============================================================
// GAME LOGIC: Scrabble Scoring
// ============================================================

function calculateScore(word: string): number {
  const letterValues: Record<string, number> = {
    'A': 1, 'E': 1, 'I': 1, 'O': 1, 'U': 1, 'L': 1, 'N': 1, 'S': 1, 'T': 1, 'R': 1,
    'D': 2, 'G': 2,
    'B': 3, 'C': 3, 'M': 3, 'P': 3,
    'F': 4, 'H': 4, 'V': 4, 'W': 4, 'Y': 4,
    'K': 5,
    'J': 8, 'X': 8,
    'Q': 10, 'Z': 10
  };

  return word
    .toUpperCase()
    .split('')
    .reduce((sum, letter) => sum + (letterValues[letter] || 0), 0);
}

// ============================================================
// GAME LOGIC: Adjacency Validation
// ============================================================

function validateWordFromCircle(word: string, circleLetters: string[]): boolean {
  if (word.length < 3) return false;

  const letters = word.split('');
  const used = new Set<number>();

  // Try to find path through circle
  function findPath(letterIndex: number, circleIndex: number): boolean {
    if (letterIndex === letters.length) return true; // All letters found!
    
    used.add(circleIndex);
    
    // Check adjacent positions (wrap around circle)
    const nextCircleIndex = (circleIndex + 1) % circleLetters.length;
    const prevCircleIndex = (circleIndex - 1 + circleLetters.length) % circleLetters.length;
    
    // Try next letter in circle (clockwise)
    if (!used.has(nextCircleIndex) && 
        circleLetters[nextCircleIndex] === letters[letterIndex]) {
      if (findPath(letterIndex + 1, nextCircleIndex)) return true;
    }
    
    // Try previous letter in circle (counter-clockwise)
    if (!used.has(prevCircleIndex) && 
        circleLetters[prevCircleIndex] === letters[letterIndex]) {
      if (findPath(letterIndex + 1, prevCircleIndex)) return true;
    }
    
    used.delete(circleIndex);
    return false;
  }

  // Try starting from each position in circle
  for (let i = 0; i < circleLetters.length; i++) {
    if (circleLetters[i] === letters[0]) {
      used.clear();
      if (findPath(1, i)) return true;
    }
  }

  return false;
}
```

**What to say:**
> "The Game Rules Service generates balanced circle letters with 3-4 vowels and 5-6 consonants. It validates that words can be formed from adjacent letters using a path-finding algorithm that checks clockwise and counter-clockwise adjacency. Scores are calculated using standard Scrabble letter values."

---

## 🎯 Presentation Flow

1. **Show Architecture Diagram** (90 sec)
   - Point out 4 services, 3 clients, 2 protocols

2. **Show FILE 1 + FILE 2** (90 sec)
   - Service-to-service HTTP communication
   - Gateway pattern

3. **Show FILE 3** (60 sec)
   - WebSocket client-server communication
   - Real-time updates

4. **Show FILE 4** (optional, if time permits)
   - Game logic details
   - Letter generation, scoring, validation

5. **Wrap up** (30 sec)
   - Summary of architecture
   - Open for questions

---

## 💡 Tips

- **Zoom in** on code (Ctrl/Cmd + +) so it's readable
- **Highlight** the important lines as you talk
- **Run the code** if possible (live demo)
- **Keep it moving** - Don't get stuck on one section
- **Practice** explaining each code block in 30-60 seconds

---

**These code snippets demonstrate everything needed for the presentation! 🚀**
