# 🎓 Circle Word Game - Project Presentation

**Student:** Gideon Gamson  
**Course:** Programming 5 - PTE MIK  
**Project:** Distributed Two-Person Game System  
**Date:** December 2025

---

## 📊 Presentation Structure (5-7 minutes)

1. **Architecture Overview** (90 seconds)
2. **Service-to-Service Communication** (90 seconds)
3. **WebSocket Real-Time Communication** (60 seconds)
4. **Technology Choices & Rationale** (90 seconds)
5. **Q&A Preparation** (30-60 seconds)

---

## 1️⃣ ARCHITECTURE OVERVIEW (90 seconds)

### **System Architecture Diagram**

```
┌─────────────────────────────────────────────────────────────────┐
│                       CLIENT LAYER                              │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐      │
│  │   CLI Client │   │  Web Client  │   │Mobile Client │      │
│  │  (Node.js +  │   │  (React +    │   │ (Capacitor + │      │
│  │  TypeScript) │   │   Vite)      │   │  React)      │      │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘      │
│         │                   │                   │              │
└─────────┼───────────────────┼───────────────────┼──────────────┘
          │                   │                   │
          │        WebSocket (ws://localhost:3004)│
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                              ▼
          ┌───────────────────────────────────────┐
          │    ROOM SERVICE (Gateway)             │
          │    Port: 3004                         │
          │    • WebSocket Server                 │
          │    • Room Management                  │
          │    • Real-time Message Broadcasting   │
          │    • Player Connection Management     │
          └───────────┬───────────────────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
    HTTP │       HTTP │       HTTP │
         │            │            │
         ▼            ▼            ▼
┌────────────┐ ┌─────────────┐ ┌──────────────┐
│USER SERVICE│ │GAME RULES   │ │DICTIONARY    │
│Port: 3001  │ │SERVICE      │ │SERVICE       │
│            │ │Port: 3003   │ │Port: 3002    │
│• Register  │ │             │ │              │
│• Login     │ │• Circle     │ │• Validate    │
│• Auth      │ │  Letter Gen │ │  Words       │
│• Sessions  │ │• Word       │ │• Spell Check │
│            │ │  Validation │ │              │
│            │ │• Scrabble   │ │              │
│            │ │  Scoring    │ │              │
│            │ │• Round/Game │ │              │
│            │ │  Management │ │              │
└────────────┘ └──────┬──────┘ └──────────────┘
                      │
                 HTTP │
                      │
                      ▼
               ┌──────────────┐
               │ DICTIONARY   │
               │   SERVICE    │
               │              │
               └──────────────┘
```

### **Key Architecture Points**

**Microservices Architecture:**
- ✅ 4 independent services, each with single responsibility
- ✅ HTTP REST APIs for service-to-service communication
- ✅ WebSocket for real-time client-server communication
- ✅ In-memory data storage (focus on architecture, not persistence)

**Client Platforms:**
- ✅ CLI Client - Text-based terminal interface
- ✅ Web Client - React single-page application
- ✅ Mobile Client - Capacitor-wrapped native app

**Communication Patterns:**
- Room Service acts as **API Gateway** and **WebSocket Hub**
- All clients connect through single entry point (Room Service)
- Services communicate via standard HTTP POST/GET
- Real-time updates broadcast via WebSocket

### **Talking Points**

> "Our system implements a distributed microservices architecture with four independent services. The Room Service acts as a WebSocket gateway, enabling real-time bidirectional communication between clients. Each service has a single responsibility: User Service handles authentication, Dictionary Service validates words, Game Rules Service implements Circle Word Game logic with letter generation and Scrabble-style scoring, and Room Service manages connections and game rooms."

> "We've implemented three different client platforms: a CLI for quick testing and demonstrations, a React web app for visual appeal and ease of use, and a Capacitor-wrapped mobile app demonstrating cross-platform deployment from a single codebase."

---

## 2️⃣ SERVICE-TO-SERVICE COMMUNICATION (90 seconds)

### **Code Example 1: HTTP Call - Room Service → Game Rules Service**

**File:** `services/room/src/websocket/websocketHandler.ts`

```typescript
// Room Service receives word submission from client via WebSocket
async function handleCircleSubmitWord(ws: WebSocket, payload: any) {
  const client = clients.get(ws);
  const { roomId, word } = payload;

  try {
    // Step 1: Forward to Game Rules Service via HTTP POST
    const gameRulesResponse = await axios.post(
      `${GAME_SERVICE_URL}/circle/${roomId}/word`,
      {
        userId: client.userId,
        word: word.toUpperCase(),
      },
      { timeout: 5000 }
    );

    // Step 2: Extract validation result
    const { isValid, score, gameState } = gameRulesResponse.data;

    // Step 3: Broadcast result to all players in room via WebSocket
    broadcastToRoom(roomId, 'circle_word_submitted', {
      userId: client.userId,
      username: client.username,
      word: word.toUpperCase(),
      isValid,
      score: isValid ? score : 0,
      gameState,
    });

  } catch (error) {
    // Error handling
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Failed to submit word' }
    }));
  }
}
```

### **Code Example 2: HTTP Call - Game Rules Service → Dictionary Service**

**File:** `services/game-rules/src/services/circleGameService.ts`

```typescript
// Game Rules Service validates word with Dictionary Service
export async function submitWord(
  roomId: string,
  userId: string,
  submittedWord: string
): Promise<WordSubmissionResult> {
  const gameState = activeGames.get(roomId);
  const word = submittedWord.toUpperCase();

  // Step 1: Call Dictionary Service via HTTP
  const dictionaryResponse = await axios.post(
    `${DICTIONARY_SERVICE_URL}/validate`,
    { word },
    { timeout: 5000 }
  );

  // Step 2: Check if word is valid
  const isValidWord = dictionaryResponse.data.valid;
  if (!isValidWord) {
    return {
      isValid: false,
      score: 0,
      error: { code: 'INVALID_WORD', message: 'Word not in dictionary' }
    };
  }

  // Step 3: Validate word can be formed from circle letters
  const canFormWord = validateWordFromCircle(
    word,
    gameState.currentRound.circleLetters
  );

  if (!canFormWord) {
    return {
      isValid: false,
      score: 0,
      error: { code: 'NON_ADJACENT', message: 'Letters must be adjacent' }
    };
  }

  // Step 4: Calculate Scrabble-style score
  const score = calculateScore(word);

  // Step 5: Update game state
  gameState.players[userId].currentRoundWords.push({ word, score });
  gameState.players[userId].totalScore += score;

  return { isValid: true, score, gameState };
}
```

### **Talking Points**

> "Here's a service-to-service interaction. When a player submits a word, the Room Service receives it via WebSocket, forwards it to the Game Rules Service via HTTP POST for validation and scoring. The Game Rules Service then calls the Dictionary Service to verify the word exists. After validation, scores are calculated using Scrabble letter values, and the Room Service broadcasts updated game state back to all connected clients in real-time."

> "This demonstrates the gateway pattern where Room Service orchestrates communication between services and clients. Each service remains independent and focused on its single responsibility. Services can be scaled horizontally, and failures are isolated."

---

## 3️⃣ WEBSOCKET REAL-TIME COMMUNICATION (60 seconds)

### **Code Example: Client-Side WebSocket**

**File:** `clients/cli/src/index.ts`

```typescript
// Client establishes WebSocket connection
private setupWebSocket(token: string) {
  this.ws = new WebSocket(ROOM_SERVICE_WS);

  this.ws.on('open', () => {
    console.log('✅ Connected to game server!');
    
    // Authenticate immediately after connection
    this.sendMessage('auth', {
      token,
      userId: this.session!.userId,
    });
  });

  // Handle incoming messages
  this.ws.on('message', (data: WebSocket.Data) => {
    const message = JSON.parse(data.toString());
    const handler = this.handlers.get(message.type);
    
    if (handler) {
      handler(message.payload);
    }
  });
}

// Client sends word submission
private async submitWord() {
  const word = readlineSync.question('\nEnter word: ').trim().toUpperCase();
  
  this.sendMessage('circle_submit_word', {
    roomId: this.currentRoom!.roomId,
    word,
  });
}

// Client receives real-time updates
this.handlers.set('circle_word_submitted', (payload) => {
  if (payload.isValid) {
    console.log(chalk.green(`✅ ${payload.username}: ${payload.word} (+${payload.score} points)`));
  } else {
    console.log(chalk.red(`❌ ${payload.username}: ${payload.word} (invalid)`));
  }
  
  // Update local game state
  this.gameState = payload.gameState;
  this.displayScores();
});
```

### **Talking Points**

> "On the client side, we establish a WebSocket connection and send structured JSON messages. The server validates the word through the Dictionary Service, calculates Scrabble-style points, and broadcasts results to both players instantly. This real-time communication is essential for multiplayer games where players need immediate feedback on their submissions and see opponent scores update live during the 60-second countdown."

---

## 4️⃣ TECHNOLOGY CHOICES & RATIONALE (90 seconds)

### **Backend Technologies**

| Technology | Reason |
|-----------|--------|
| **Node.js** | Asynchronous I/O perfect for real-time games, single-threaded event loop handles WebSocket connections efficiently |
| **TypeScript** | Type safety prevents runtime errors, excellent IDE support, interfaces ensure consistency across services |
| **Express.js** | Minimal yet complete HTTP framework, easy to create REST endpoints, large ecosystem |
| **ws Library** | Lightweight WebSocket implementation, standards-compliant, low overhead |
| **In-Memory Storage** | Focus on architecture over persistence, sufficient for 2-player games, enables rapid development |

### **Frontend Technologies**

| Technology | Reason |
|-----------|--------|
| **React** | Component-based architecture, virtual DOM for performance, industry standard |
| **Vite** | Lightning-fast hot module replacement (<100ms), modern build tool, TypeScript support |
| **Capacitor** | Wraps web app into native mobile, access to device APIs, code reuse from web client |
| **Native WebSocket API** | Browser built-in, no external dependencies, standardized protocol |

### **Game Design Choice**

**Circle Word Game (Word Rush):**
- ✅ **Simpler than Scrabble** - No tile bag, no board placement, just word formation
- ✅ **Perfect for microservices** - Clear separation: Dictionary validates, Game Rules scores, Room broadcasts
- ✅ **Fast-paced** - 60-second rounds create excitement
- ✅ **Simultaneous play** - Both players compete at same time (not turn-based)
- ✅ **Scrabble scoring** - Familiar point system (A=1, Z=10)
- ✅ **3-round format** - Best-of-three determines winner

### **Talking Points**

> "We chose Node.js and TypeScript for rapid development with type safety across all services. The WebSocket library provides efficient real-time communication. For clients, we implemented three platforms: a CLI for testing, a React web app for visual appeal, and a Capacitor-wrapped mobile app demonstrating cross-platform capabilities. In-memory storage keeps the focus on architecture rather than database complexity."

> "We implemented Circle Word Game where players race against a 60-second timer to form words from a circle of 9 letters. This showcases our architecture perfectly: Game Rules generates balanced letter circles, validates adjacency, and calculates Scrabble-style points. Dictionary validates words, and Room Service broadcasts real-time updates. The simultaneous play and time pressure create engaging competitive gameplay."

---

## 5️⃣ Q&A PREPARATION (30-60 seconds)

### **Anticipated Questions**

**Q: "Why not use a database?"**
> **A:** "We prioritized architecture over persistence. In-memory storage keeps the codebase clean and demonstrates service separation without database complexity. For production, we'd add a persistence layer as a separate service, possibly using Redis for shared state and PostgreSQL for user data."

**Q: "How do you handle service failures?"**
> **A:** "Currently, services fail fast with error messages to clients. For production, we'd implement retry logic with exponential backoff, circuit breakers to prevent cascade failures, and health monitoring with automatic service restarts. The microservices architecture makes it easy to add resilience patterns independently to each service."

**Q: "Could you support more than 2 players?"**
> **A:** "Yes! The Room Service already supports n-player rooms. Since Circle Word Game has simultaneous play rather than turn-based, adding more players is straightforward—we just broadcast all word submissions to everyone in the room. The WebSocket broadcast mechanism scales naturally. We'd need to adjust the Game Rules scoring to handle more competitors."

**Q: "How would you scale this system?"**
> **A:** "Each service can scale independently. We'd add a load balancer for Room Service WebSocket connections, use Redis for shared state across Room Service instances, and potentially shard User and Dictionary services by user ID ranges or word prefix. The stateless HTTP endpoints make horizontal scaling straightforward."

**Q: "How do you prevent cheating?"**
> **A:** "All game logic runs server-side. Clients only send word submissions—they can't modify scores or game state directly. The Game Rules Service validates every word against the Dictionary Service and checks letter adjacency. The server controls the timer and automatically ends rounds. This server-authoritative architecture prevents client-side manipulation."

**Q: "What about network latency?"**
> **A:** "WebSocket provides low-latency bidirectional communication. For a word game, 100-500ms latency is acceptable since it's not twitch-based. We could add client-side prediction for optimistic UI updates, server-side timestamp validation to prevent timing exploits, and connection quality indicators to inform players of lag."

---

## 🎯 SUCCESS CHECKLIST

Before presentation:
- [ ] All 4 services start without errors
- [ ] Video recorded (1-2 min, unedited, showing services + gameplay)
- [ ] Architecture diagram printed/ready to show
- [ ] Code examples highlighted in IDE
- [ ] Rehearsed presentation (timing: 5-7 minutes)
- [ ] Confident explanations for technology choices
- [ ] Ready to answer common questions

---

## 📝 PRESENTATION TIPS

1. **Start strong** - Show the architecture diagram immediately
2. **Live code** - Have services running in terminals, ready to demo
3. **Tell a story** - Follow data flow from client → Room → Game Rules → Dictionary → back
4. **Emphasize architecture** - This is about microservices, not game complexity
5. **Be confident** - You built a complex distributed system from scratch!
6. **Speak clearly** - Technical terms should be pronounced correctly
7. **Eye contact** - Look at evaluators, not just screen
8. **Time management** - Practice to stay within 5-7 minutes

---

## 🚀 DEMO SEQUENCE (If Live Demo)

1. **Show Architecture** (30 sec)
2. **Show Services Running** (30 sec)
   - 4 terminals with services
   - Health check endpoints
3. **Quick Gameplay** (60 sec)
   - CLI client connects
   - Submits 2-3 words
   - Show real-time score updates
4. **Code Walkthrough** (90 sec)
   - Service-to-service HTTP call
   - WebSocket message handling
5. **Wrap Up** (30 sec)
   - Summary of achievements
   - Open for questions

**Total: ~4-5 minutes + Q&A**

---

**Good luck with your presentation! 🎓**
