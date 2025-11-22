/**
 * Circle Word Game - CLI Client v2
 * A complete rewrite with proper architecture and state management
 */

import axios from 'axios';
import readlineSync from 'readline-sync';
import chalk from 'chalk';
import { WebSocket } from 'ws';

// ===== TYPES =====
interface UserSession {
  userId: string;
  username: string;
  token: string;
}

interface Room {
  roomId: string;
  roomName: string;
  hostId: string;
  status: 'waiting' | 'active' | 'finished';
  players: Array<{ userId: string; username: string }>;
}

interface GameState {
  roomId: string;
  gameStatus: 'starting' | 'active' | 'ended';
  totalRounds: number;
  currentRound: {
    roundNumber: number;
    circleLetters: string[];
    durationSeconds: number;
    startTime: number;
  };
  players: Record<string, {
    userId: string;
    username: string;
    totalScore: number;
    currentRoundWords: Array<{ word: string; score: number }>;
  }>;
}

type AppState = 'auth' | 'menu' | 'rooms-list' | 'room-waiting' | 'game-active' | 'game-over';

// ===== CONFIG =====
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const ROOM_SERVICE_WS = process.env.ROOM_SERVICE_WS || 'ws://localhost:3004';

// ===== MAIN APPLICATION =====
class CircleGameCLI {
  private session: UserSession | null = null;
  private ws: WebSocket | null = null;
  private currentRoom: Room | null = null;
  private gameState: GameState | null = null;
  private currentState: AppState = 'auth';
  private isRunning = true;
  private roomsList: Room[] = [];  // Store list of available rooms
  private joinAttemptTime = 0;  // Track when we attempt to join
  private chatMessages: Array<{username: string, message: string, isMe: boolean}> = []; // Store recent chat messages

  // Message handlers map
  private handlers: Map<string, (payload: any) => void> = new Map();

  async start() {
    console.clear();
    this.printHeader();

    while (this.isRunning) {
      try {
        switch (this.currentState) {
          case 'auth':
            await this.handleAuthFlow();
            break;
          case 'menu':
            await this.handleMainMenu();
            break;
          case 'rooms-list':
            await this.handleRoomsList();
            break;
          case 'room-waiting':
            await this.handleRoomWaiting();
            break;
          case 'game-active':
            await this.handleGameActive();
            break;
          case 'game-over':
            await this.handleGameOver();
            break;
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        await this.waitForInput('Press ENTER to continue...');
      }
    }
  }

  // ===== AUTH FLOW =====
  private async handleAuthFlow() {
    console.clear();
    this.printHeader();
    console.log(chalk.yellow('\n🔐 Authentication\n'));
    console.log('1. Register');
    console.log('2. Login');
    console.log('3. Exit');

    const choice = readlineSync.question(chalk.cyan('\nChoice: '));

    switch (choice) {
      case '1':
        await this.handleRegister();
        break;
      case '2':
        await this.handleLogin();
        break;
      case '3':
        console.log(chalk.green('\n👋 Goodbye!\n'));
        this.isRunning = false;
        process.exit(0);
      default:
        console.log(chalk.red('❌ Invalid choice'));
    }
  }

  private async handleRegister() {
    const username = readlineSync.question(chalk.cyan('\nEnter username: ')).trim();
    if (!username) {
      console.log(chalk.red('❌ Username cannot be empty'));
      return;
    }

    try {
      console.log(chalk.gray('\n⏳ Registering...\n'));
      const response = await axios.post(`${USER_SERVICE_URL}/users/register`, { username });
      console.log(chalk.green(`✅ Registered successfully!`));
      console.log(chalk.gray(`User ID: ${response.data.userId}\n`));
      await this.handleLogin(username);
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || 'Registration failed';
      console.log(chalk.red(`❌ ${msg}\n`));
    }
  }

  private async handleLogin(prefilledUsername?: string) {
    const username = prefilledUsername || readlineSync.question(chalk.cyan('\nEnter username: ')).trim();
    if (!username) {
      console.log(chalk.red('❌ Username cannot be empty'));
      return;
    }

    try {
      console.log(chalk.gray('\n⏳ Logging in...\n'));
      const response = await axios.post(`${USER_SERVICE_URL}/users/login`, { username });

      this.session = {
        userId: response.data.userId,
        username: response.data.username,
        token: response.data.token,
      };

      console.log(chalk.green(`✅ Logged in as ${username}!\n`));
      await this.connectWebSocket();
      this.currentState = 'menu';
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || 'Login failed';
      console.log(chalk.red(`❌ ${msg}\n`));
    }
  }

  // ===== WEBSOCKET MANAGEMENT =====
  private async connectWebSocket() {
    if (!this.session) return;

    return new Promise<void>((resolve, reject) => {
      try {
        console.log(chalk.gray('🔌 Connecting to game server...'));
        this.ws = new WebSocket(ROOM_SERVICE_WS);

        this.ws.onopen = () => {
          console.log(chalk.green('✅ Connected to game server!\n'));
          
          // Authenticate immediately
          this.sendMessage('auth', {
            userId: this.session!.userId,
            username: this.session!.username,
            token: this.session!.token,
          });

          // Setup message handlers
          this.setupMessageHandlers();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = typeof event.data === 'string' ? event.data : event.data.toString();
            const msg = JSON.parse(data);
            const { type, payload } = msg;
            
            // Debug: Log message type
            if (type !== 'auth_ok') {
              console.log(chalk.gray(`  📨 ${type}`));
            }
            
            const handler = this.handlers.get(type);
            if (handler) {
              handler(payload);
            } else {
              console.log(chalk.yellow(`  ⚠️  No handler for message type: ${type}`));
            }
          } catch (error) {
            console.error(chalk.red('Failed to parse message'), error);
          }
        };

        this.ws.onerror = (error) => {
          console.error(chalk.red('❌ WebSocket error'), error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log(chalk.red('❌ Disconnected from server'));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private sendMessage(type: string, payload?: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log(chalk.red('❌ Not connected to server'));
      return;
    }
    this.ws.send(JSON.stringify({ type, payload: payload || {} }));
  }

  private setupMessageHandlers() {
    // Auth
    this.handlers.set('auth_ok', () => {
      console.log(chalk.green('✅ Authenticated\n'));
    });

    this.handlers.set('auth_error', (payload) => {
      console.log(chalk.red(`❌ Auth error: ${payload.message}`));
    });

    // Room events
    this.handlers.set('room_created', (payload) => {
      this.currentRoom = this.normalizeRoom(payload);
    });

    this.handlers.set('rooms_list', (payload) => {
      // Store rooms list from server
      this.roomsList = (payload.rooms || []).map((room: any) => this.normalizeRoom(room));
      console.log(chalk.gray(`📨 Received ${this.roomsList.length} rooms from server`));
    });

    this.handlers.set('player_joined', (payload) => {
      // Update room data with new player list
      // This handler is called for both the existing players AND the joining player
      if (this.currentRoom && payload.roomId === this.currentRoom.roomId) {
        // Already in a room, preserve name and host
        this.currentRoom = this.normalizeRoom({
          roomId: this.currentRoom.roomId,
          roomName: this.currentRoom.roomName,
          host: this.currentRoom.hostId,
          players: payload.players || [],
          status: payload.status || 'waiting',
        });
      } else if (!this.currentRoom) {
        // Just joined a room, create new room object
        // player_joined doesn't include roomName, so try to find it from roomsList
        const roomFromList = this.roomsList.find(r => r.roomId === payload.roomId);
        this.currentRoom = this.normalizeRoom({
          ...payload,
          roomName: roomFromList?.roomName || payload.roomName || 'Unknown Room',
          host: roomFromList?.hostId || payload.host,
        });
      }
      console.log(chalk.gray(`📨 Player joined: ${payload.players.length} players in room ${payload.roomId}`));
    });

    this.handlers.set('player_left', (payload) => {
      if (!this.currentRoom) return;
      if (payload.roomId !== this.currentRoom.roomId) return;

      this.currentRoom = this.normalizeRoom({
        roomId: this.currentRoom.roomId,
        roomName: this.currentRoom.roomName,
        host: this.currentRoom.hostId,
        players: payload.players || [],
        status: payload.status || 'waiting',
      });
    });

    // Game events
    this.handlers.set('circle_game_started', (payload) => {
      console.log(chalk.gray('📨 Received circle_game_started event'));
      console.log(chalk.gray('Payload:', JSON.stringify(payload, null, 2)));
      this.gameState = payload.gameState;
      this.currentState = 'game-active';
      console.log(chalk.green('✅ Game state updated, transitioning to game-active'));
    });

    this.handlers.set('circle_word_submitted', (payload) => {
      // Update game state with latest data
      if (payload.gameState) {
        this.gameState = payload.gameState;
      }
      
      if (payload.isValid) {
        console.log(chalk.green(`\n✅ Word accepted: ${payload.word} - ${payload.score} points`));
      } else {
        console.log(chalk.yellow(`\n⚠️  Word rejected: ${payload.word} (not valid)`));
      }
    });

    this.handlers.set('circle_word_confirmed', (payload) => {
      // Direct feedback from server to submitting player
      if (payload.isValid) {
        console.log(chalk.green(`\n✅ ${payload.message}`));
      } else {
        console.log(chalk.yellow(`\n❌ ${payload.message}`));
      }
    });

    this.handlers.set('circle_round_ended', (payload) => {
      console.log(chalk.green('\n✅ Round ended!'));
      if (payload.gameState) {
        this.gameState = payload.gameState;
      }
      // Stay in game-active state for next round or transition to game-over
    });

    this.handlers.set('circle_game_over', (payload) => {
      console.log(chalk.green('\n🏆 Game Over!'));
      if (payload.gameState) {
        this.gameState = payload.gameState;
      }
      this.currentState = 'game-over';
    });

    this.handlers.set('circle_game_ended', (payload) => {
      // Fallback handler
      this.gameState = null;
      this.currentState = 'game-over';
    });

    this.handlers.set('chat_broadcast', (payload) => {
      const isMe = payload.userId === this.session!.userId;
      // Store chat message
      this.chatMessages.push({
        username: payload.username,
        message: payload.message,
        isMe: isMe
      });
      // Keep only last 5 messages
      if (this.chatMessages.length > 5) {
        this.chatMessages.shift();
      }
    });

    this.handlers.set('error', (payload) => {
      console.log(chalk.red(`❌ Error: ${payload.message}`));
    });
  }

  // ===== MAIN MENU =====
  private async handleMainMenu() {
    console.clear();
    this.printHeader();
    console.log(chalk.cyan(`\n👤 ${this.session!.username}\n`));
    console.log('1. Create New Game Room');
    console.log('2. Join Existing Room');
    console.log('3. View Profile');
    console.log('4. Logout');
    console.log('5. Exit');

    const choice = readlineSync.question(chalk.cyan('\nChoice: '));

    switch (choice) {
      case '1':
        await this.handleCreateRoom();
        break;
      case '2':
        this.currentState = 'rooms-list';
        break;
      case '3':
        this.showProfile();
        break;
      case '4':
        await this.handleLogout();
        break;
      case '5':
        console.log(chalk.green('\n👋 Goodbye!\n'));
        this.isRunning = false;
        process.exit(0);
      default:
        console.log(chalk.red('❌ Invalid choice'));
    }
  }

  private async handleCreateRoom() {
    const roomName = readlineSync.question(chalk.cyan('\nEnter room name: ')).trim();
    if (!roomName) {
      console.log(chalk.red('❌ Room name cannot be empty'));
      return;
    }

    console.log(chalk.gray('\n⏳ Creating room...\n'));
    this.chatMessages = []; // Clear chat history for new room
    this.joinAttemptTime = Date.now();
    this.sendMessage('create_room', { roomName });

    // Wait for room creation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.currentState = 'room-waiting';
  }

  // ===== ROOMS LIST =====
  private async handleRoomsList() {
    console.clear();
    this.printHeader();
    console.log(chalk.gray('\n⏳ Loading rooms...\n'));

    // Clear previous rooms list
    this.roomsList = [];
    
    // Request rooms list
    this.sendMessage('list_rooms', {});

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Use the stored rooms list from message handler
    const rooms: Room[] = this.roomsList;

    if (rooms.length === 0) {
      console.log(chalk.yellow('📭 No available rooms\n'));
      console.log('1. Create New Room');
      console.log('2. Back to Menu');

      const choice = readlineSync.question(chalk.cyan('\nChoice: '));
      if (choice === '1') {
        await this.handleCreateRoom();
      } else {
        this.currentState = 'menu';
      }
      return;
    }

    console.log(chalk.cyan('\n🎮 Available Rooms\n'));
    rooms.forEach((room, idx) => {
      const status = room.status === 'waiting' ? chalk.yellow('🟡 WAITING') : chalk.green('🟢 ACTIVE');
      console.log(`${idx + 1}. ${room.roomName} (${room.players.length}/2) ${status}`);
    });

    console.log(`\n${rooms.length + 1}. Back to Menu`);

    const choice = readlineSync.question(chalk.cyan('\nSelect room: '));
    const selected = parseInt(choice) - 1;

    if (selected === rooms.length) {
      this.currentState = 'menu';
    } else if (selected >= 0 && selected < rooms.length) {
      console.log(chalk.gray('\n⏳ Joining room...\n'));
      this.chatMessages = []; // Clear chat history for new room
      this.joinAttemptTime = Date.now();
      this.sendMessage('join_room', { roomId: rooms[selected].roomId });
      // Wait up to 3 seconds for player_joined event to set currentRoom
      await new Promise(resolve => setTimeout(resolve, 3000));
      this.currentState = 'room-waiting';
    }
  }

  // ===== ROOM WAITING SCREEN =====
  private async handleRoomWaiting() {
    // If we just tried to join (within last 3 seconds) but currentRoom isn't set yet,
    // wait a bit longer instead of immediately going back to menu
    if (!this.currentRoom) {
      const timeSinceJoin = Date.now() - this.joinAttemptTime;
      if (timeSinceJoin < 3500) {
        console.log(chalk.yellow('⏳ Setting up room connection...\n'));
        await new Promise(resolve => setTimeout(resolve, 500));
        // Loop will call handleRoomWaiting again
        return;
      }
      // If more than 3.5 seconds and still no room, go back to menu
      this.currentState = 'menu';
      return;
    }

    console.clear();
    this.printHeader();

    console.log(chalk.cyan(`\n🎮 Room: ${this.currentRoom.roomName}\n`));
    console.log(chalk.gray(`Room ID: ${this.currentRoom.roomId}`));

    const hostPlayer = this.currentRoom.players.find(p => p.userId === this.currentRoom!.hostId);
    const hostName = hostPlayer?.username || 'Unknown';
    console.log(chalk.gray(`Host: ${hostName}\n`));

    const playerCount = this.currentRoom.players.length;
    console.log(chalk.cyan(`Players (${playerCount}/2):\n`));
    this.currentRoom.players.forEach(player => {
      const you = player.userId === this.session!.userId ? ' (YOU)' : '';
      const isHost = player.userId === this.currentRoom!.hostId ? ' 👑 Host' : '';
      console.log(chalk.green(`✅ ${player.username}${you}${isHost}`));
    });

    // Show waiting message if not full
    if (playerCount < 2) {
      console.log(chalk.yellow(`\n⏳ Waiting for opponent...\n`));
      console.log(chalk.gray(`Share Room ID: ${chalk.bold(this.currentRoom.roomId)}\n`));
    } else {
      console.log(chalk.green(`\n✅ All players joined!\n`));
    }

    // Display recent chat messages
    if (this.chatMessages.length > 0) {
      console.log(chalk.cyan('💬 Recent Chat:\n'));
      this.chatMessages.forEach(msg => {
        const prefix = msg.isMe ? chalk.cyan('(You)') : chalk.yellow(msg.username);
        console.log(chalk.blue(`   ${prefix}: ${msg.message}`));
      });
      console.log();
    }

    // Unified menu for all players
    const isHost = this.currentRoom.hostId === this.session!.userId;
    
    // Show menu options
    if (playerCount < 2) {
      console.log(chalk.gray('1. Start Game (waiting for 2nd player...)'));
    } else {
      console.log('1. Start Game');
    }
    console.log('2. Leave Room');
    console.log('3. Refresh');
    console.log('4. Send Chat Message');
    console.log();

    const choice = readlineSync.question(chalk.cyan('Choice: '));

    switch (choice) {
      case '1':
        if (playerCount < 2) {
          console.log(chalk.red('\n❌ Cannot start game - need 2 players!\n'));
          await new Promise(resolve => setTimeout(resolve, 1500));
        } else if (!isHost) {
          console.log(chalk.red('\n❌ Only the host can start the game!\n'));
          await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
          await this.startGame();
        }
        break;
      case '2':
        await this.leaveRoom();
        this.currentState = 'menu';
        break;
      case '3':
        // Refresh - request fresh room list from server
        console.log(chalk.gray('\n🔄 Refreshing room data...\n'));
        this.sendMessage('list_rooms', {});
        await new Promise(resolve => setTimeout(resolve, 500));
        break;
      case '4':
        // Send chat message
        const message = readlineSync.question(chalk.cyan('\n💬 Message: '));
        if (message.trim()) {
          this.sendChatMessage(message.trim());
          console.log(chalk.gray('✓ Message sent\n'));
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        // Find our room in the refreshed list and update currentRoom
        const refreshedRoom = this.roomsList.find(r => r.roomId === this.currentRoom!.roomId);
        if (refreshedRoom) {
          this.currentRoom = refreshedRoom;
        }
        break;
      default:
        console.log(chalk.red('❌ Invalid choice'));
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // ===== GAME ACTIVE =====
  private async handleGameActive() {
    if (!this.gameState) {
      this.currentState = 'room-waiting';
      return;
    }

    // Check if round has ended
    const timeElapsed = Math.floor((Date.now() - this.gameState.currentRound.startTime) / 1000);
    const timeRemaining = Math.max(0, this.gameState.currentRound.durationSeconds - timeElapsed);

    // Redraw screen
    console.clear();
    this.printHeader();

    console.log(chalk.cyan(`\n🎮 ROUND ${this.gameState.currentRound.roundNumber}/${this.gameState.totalRounds}\n`));

    // Draw circle
    this.drawCircle(this.gameState.currentRound.circleLetters);

    // Show timer
    console.log(chalk.cyan(`⏱️  ${timeRemaining}s remaining\n`));

    // Show scores
    console.log(chalk.cyan('📊 Scores:\n'));
    Object.values(this.gameState.players).forEach(player => {
      const you = player.userId === this.session!.userId ? ' (YOU)' : '';
      console.log(chalk.yellow(`${player.username}${you}: ${player.totalScore} points`));
    });

    // Show my words
    const myPlayer = this.gameState.players[this.session!.userId];
    console.log(chalk.cyan('\n📝 Your Words:\n'));
    if (myPlayer && myPlayer.currentRoundWords.length > 0) {
      myPlayer.currentRoundWords.forEach(w => {
        console.log(chalk.green(`✅ ${w.word} (${w.score} pts)`));
      });
    } else {
      console.log(chalk.gray('(none yet)'));
    }

    // If time is up, end the round
    if (timeRemaining === 0) {
      const isHost = this.currentRoom?.hostId === this.session!.userId;
      
      // Only host sends end_round to avoid duplicate requests
      if (isHost) {
        console.log(chalk.yellow('\n⏳ Round ending... calculating results...\n'));
        this.sendMessage('circle_end_round', { 
          roomId: this.currentRoom!.roomId 
        });
      } else {
        console.log(chalk.yellow('\n⏳ Round ending... waiting for host to end round...\n'));
      }
      
      // Wait for circle_round_ended or circle_game_over event
      await new Promise(resolve => setTimeout(resolve, 3000));
      return;
    }

    // Take word input with timeout
    console.log();
    console.log(chalk.gray('Type a word and press ENTER (or just press ENTER to wait)'));
    
    const word = readlineSync.question(chalk.cyan('Word: '), {
      limit: /^[a-zA-Z]*$/,
      limitMessage: 'Letters only please'
    }).trim().toUpperCase();

    if (word && word.length >= 2) {
      console.log(chalk.gray(`\n⏳ Submitting "${word}"...\n`));
      this.sendMessage('circle_submit_word', { 
        roomId: this.currentRoom!.roomId,
        word 
      });
      await new Promise(resolve => setTimeout(resolve, 800)); // Wait for server response
    }
  }

  private drawCircle(letters: string[]) {
    if (letters.length < 9) return;

    console.log(chalk.cyan('      '));
    console.log(chalk.cyan(`    ${chalk.yellow(letters[0])}   ${chalk.yellow(letters[1])}`));
    console.log(chalk.cyan(`   ${chalk.yellow(letters[8])}     ${chalk.yellow(letters[2])}`));
    console.log(chalk.cyan(`  ${chalk.yellow(letters[7])}   ${chalk.yellow(letters[3])}   ${chalk.yellow(letters[4])}`));
    console.log(chalk.cyan(`   ${chalk.yellow(letters[6])}     ${chalk.yellow(letters[5])}`));
    console.log();
  }

  // ===== GAME OVER =====
  private async handleGameOver() {
    console.clear();
    this.printHeader();
    console.log(chalk.cyan('\n🏆 GAME FINISHED!\n'));

    if (this.gameState) {
      // Show final scores
      console.log(chalk.cyan('📊 Final Scores:\n'));
      const players = Object.values(this.gameState.players);
      players.sort((a, b) => b.totalScore - a.totalScore);

      // Check for draw (equal scores)
      const isDraw = players.length >= 2 && players[0].totalScore === players[1].totalScore;

      players.forEach((player, index) => {
        const you = player.userId === this.session!.userId ? ' (YOU)' : '';
        const medal = isDraw ? '🏅' : (index === 0 ? '🥇' : '🥈');
        console.log(chalk.yellow(`${medal} ${player.username}${you}: ${player.totalScore} points`));
        
        // Show their words
        if (player.currentRoundWords.length > 0) {
          player.currentRoundWords.forEach(w => {
            console.log(chalk.gray(`   • ${w.word} (${w.score} pts)`));
          });
        }
        console.log();
      });

      // Announce winner or draw
      if (isDraw) {
        console.log(chalk.cyan.bold('\n🤝 IT\'S A DRAW!\n'));
        console.log(chalk.gray('Both players scored equal points!\n'));
      } else {
        const winner = players[0];
        if (winner.userId === this.session!.userId) {
          console.log(chalk.green.bold('\n🎉 YOU WON! Congratulations!\n'));
        } else {
          console.log(chalk.yellow(`\n${winner.username} won the game!\n`));
        }
      }
    }

    await this.waitForInput(chalk.gray('Press ENTER to return to menu...'));
    this.currentRoom = null;
    this.gameState = null;
    this.chatMessages = []; // Clear chat when game ends
    this.currentState = 'menu';
  }

  // ===== HELPERS =====
  private async startGame() {
    if (!this.currentRoom) return;
    console.log(chalk.gray('\n⏳ Starting game...\n'));

    // Send circle_start_game with required payload
    const playerIds = this.currentRoom.players.map(p => p.userId);
    const usernames = this.currentRoom.players.map(p => p.username);

    console.log(chalk.gray(`📤 Sending circle_start_game: roomId=${this.currentRoom.roomId}, playerIds=${playerIds.join(',')}`));
    this.sendMessage('circle_start_game', {
      roomId: this.currentRoom.roomId,
      playerIds,
      usernames,
      totalRounds: 1, // CLI uses 1 round for simplicity
    });

    // Give server time to process
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async sendChatMessage(message?: string) {
    const chatMessage = message || readlineSync.question(chalk.cyan('\nMessage: ')).trim();
    if (chatMessage) {
      this.sendMessage('chat_message', {
        roomId: this.currentRoom?.roomId,
        message: chatMessage,
      });
      if (!message) {
        console.log(chalk.green('✅ Sent'));
      }
    }
  }

  private async leaveRoom() {
    this.sendMessage('leave_room', {});
    this.currentRoom = null;
    this.chatMessages = []; // Clear chat when leaving room
  }

  private async handleLogout() {
    if (this.ws) {
      this.ws.close();
    }
    this.session = null;
    this.currentRoom = null;
    this.gameState = null;
    console.log(chalk.green('\n✅ Logged out\n'));
    this.currentState = 'auth';
  }

  private showProfile() {
    if (!this.session) return;
    console.clear();
    this.printHeader();
    console.log(chalk.cyan('\n👤 Profile\n'));
    console.log(chalk.gray(`Username: ${chalk.bold(this.session.username)}`));
    console.log(chalk.gray(`User ID: ${this.session.userId}\n`));
    readlineSync.question(chalk.gray('Press ENTER to continue...'));
  }

  private printHeader() {
    console.log(chalk.cyan('╔════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.bold.yellow(' WORD RUSH ⚡ - CLI CLIENT            ') + chalk.cyan('║'));
    console.log(chalk.cyan('║') + chalk.gray(' Fast Words. Faster Wins.             ') + chalk.cyan('║'));
    console.log(chalk.cyan('╚════════════════════════════════════════╝'));
  }

  private normalizeRoom(rawRoom: any): Room {
    return {
      roomId: rawRoom.roomId || '',
      roomName: rawRoom.roomName || rawRoom.name || '',
      hostId: rawRoom.hostId || rawRoom.host_id || rawRoom.host || '',
      status: rawRoom.status || 'waiting',
      players: (rawRoom.players || []).map((p: any) => ({
        userId: p.userId || p.id || p.user_id || '',
        username: p.username || p.name || '',
      })),
    };
  }

  private async waitForInput(prompt: string) {
    readlineSync.question(chalk.gray(`${prompt}`));
  }
}

// ===== START APPLICATION =====
const cli = new CircleGameCLI();
cli.start().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
