import WebSocket from 'ws';
import chalk from 'chalk';

interface GameState {
  board: (string | null)[][];
  racks: Record<string, string[]>;
  scores: Record<string, number>;
  tileBag: { remaining: number };
  currentPlayer: string;
  turnCount: number;
  passCount: number;
  gameStatus: 'active' | 'finished';
  players: string[];
  winner?: string;
}

interface Room {
  roomId: string;
  roomName: string;
  host: string;
  players: { userId: string; username: string }[];
  status: string;
}

export class GameClient {
  private ws: WebSocket | null = null;
  private roomId: string | null = null;
  private room: Room | null = null;
  private gameState: GameState | null = null;
  private connected: boolean = false;

  constructor(
    private wsUrl: string,
    private userId: string,
    private username: string,
    private token: string
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log(chalk.gray('🔌 WebSocket connected'));
        this.authenticate();
      });

      this.ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);

        if (message.type === 'auth_ok') {
          this.connected = true;
          resolve();
        }
      });

      this.ws.on('error', (error) => {
        console.error(chalk.red('WebSocket error:'), error.message);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log(chalk.gray('📤 WebSocket disconnected'));
        this.connected = false;
      });

      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  }

  private authenticate() {
    this.send('auth', {
      token: this.token,
      userId: this.userId,
    });
  }

  private send(type: string, payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  private handleMessage(message: any) {
    const { type, payload } = message;

    switch (type) {
      case 'auth_ok':
        // Handled in connect()
        break;

      case 'room_created':
        this.roomId = payload.roomId;
        this.room = payload;
        console.log(chalk.green(`\n✅ Room created: ${payload.roomName}`));
        console.log(chalk.gray(`Room ID: ${payload.roomId}`));
        console.log(chalk.yellow('⏳ Waiting for another player to join...\n'));
        break;

      case 'rooms_list':
        this.displayRoomsList(payload.rooms);
        break;

      case 'player_joined':
        this.room = payload;
        console.log(chalk.green(`\n✅ ${payload.player.username} joined the room!`));
        console.log(chalk.gray(`Players: ${payload.players.length}/2`));
        
        if (payload.status === 'ready') {
          console.log(chalk.yellow('\n🎮 Room is ready! Host can start the game.\n'));
        }
        break;

      case 'game_started':
        this.gameState = payload.gameState;
        console.log(chalk.green('\n🎮 Game Started!\n'));
        this.displayBoard();
        this.displayRack();
        this.displayTurnInfo();
        break;

      case 'game_state':
        this.gameState = payload.gameState;
        console.log(chalk.green('\n📊 Game State Updated\n'));
        
        if (payload.lastMove) {
          const playerName = this.getPlayerName(payload.lastMove.player);
          console.log(chalk.yellow(`Last move: ${playerName} played "${payload.lastMove.word}" for ${payload.lastMove.score} points`));
        }
        
        this.displayBoard();
        this.displayRack();
        this.displayScores();
        this.displayTurnInfo();
        break;

      case 'move_result':
        if (payload.valid) {
          console.log(chalk.green(`\n✅ Valid move! You scored ${payload.score} points!\n`));
        } else {
          console.log(chalk.red('\n❌ Invalid move:'));
          if (payload.errors) {
            payload.errors.forEach((error: any) => {
              console.log(chalk.red(`   - ${error.message}`));
            });
          }
          console.log();
        }
        break;

      case 'turn_passed':
        const playerName = this.getPlayerName(payload.player);
        console.log(chalk.yellow(`\n⏭️  ${playerName} passed their turn`));
        console.log(chalk.gray(`Pass count: ${payload.passCount}/6\n`));
        break;

      case 'game_over':
        console.log(chalk.green.bold('\n🏁 GAME OVER!\n'));
        if (payload && payload.winner) {
          const winner = this.getPlayerName(payload.winner);
          console.log(chalk.yellow(`Winner: ${winner}`));
        }
        if (payload && payload.finalScores) {
          console.log(chalk.cyan('\nFinal Scores:'));
          Object.entries(payload.finalScores).forEach(([userId, score]) => {
            const name = this.getPlayerName(userId);
            console.log(chalk.gray(`  ${name}: ${score} points`));
          });
        }
        this.roomId = null;
        this.room = null;
        this.gameState = null;
        console.log(chalk.yellow('\nReturning to main menu...'));
        break;

      case 'chat_broadcast':
        if (payload.userId !== this.userId) {
          console.log(chalk.blue(`\n💬 ${payload.username}: ${payload.message}\n`));
        }
        break;

      case 'error':
        console.log(chalk.red(`\n❌ Error: ${payload.message}\n`));
        break;

      case 'pong':
        // Keep-alive response
        break;

      default:
        console.log(chalk.gray(`Received: ${type}`));
    }
  }

  createRoom(roomName: string) {
    this.send('create_room', { roomName });
  }

  listRooms() {
    this.send('list_rooms', {});
  }

  joinRoom(roomId: string) {
    this.roomId = roomId;
    this.send('join_room', { roomId });
  }

  startGame() {
    if (!this.roomId) return;
    this.send('start_game', { roomId: this.roomId });
  }

  makeMove(word: string, startRow: number, startCol: number, direction: 'horizontal' | 'vertical', tiles: string[]) {
    if (!this.roomId) return;
    this.send('make_move', {
      roomId: this.roomId,
      word,
      startRow,
      startCol,
      direction,
      tiles,
    });
  }

  passTurn() {
    if (!this.roomId) return;
    this.send('pass_turn', { roomId: this.roomId });
  }

  sendChat(message: string) {
    if (!this.roomId) return;
    this.send('chat_message', {
      roomId: this.roomId,
      message,
    });
    console.log(chalk.blue(`\n💬 You: ${message}\n`));
  }

  leaveRoom() {
    this.roomId = null;
    this.room = null;
    this.gameState = null;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }

  isInRoom(): boolean {
    return this.roomId !== null;
  }

  isHost(): boolean {
    return this.room?.host === this.userId;
  }

  isGameStarted(): boolean {
    return this.gameState !== null;
  }

  displayBoard() {
    if (!this.gameState) return;

    console.log(chalk.cyan('\n╔═══════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.bold('         GAME BOARD (7×7)         ') + chalk.cyan('║'));
    console.log(chalk.cyan('╠═══════════════════════════════════╣'));

    // Column headers
    console.log(chalk.cyan('║   ') + chalk.gray('  0   1   2   3   4   5   6  ') + chalk.cyan('║'));
    console.log(chalk.cyan('╠═══════════════════════════════════╣'));

    const board = this.gameState.board;
    for (let row = 0; row < 7; row++) {
      let line = chalk.cyan('║ ') + chalk.gray(row) + chalk.cyan(' ║');
      
      for (let col = 0; col < 7; col++) {
        const cell = board[row][col];
        
        // Check if this is a double word cell
        const isDoubleWord = row === 3 && col === 3;
        
        if (cell) {
          line += chalk.bold.green(` ${cell} `);
        } else if (isDoubleWord) {
          line += chalk.bgYellow.black(' D ');
        } else {
          line += chalk.gray(' · ');
        }
        
        line += chalk.cyan('│');
      }
      
      console.log(line);
    }

    console.log(chalk.cyan('╚═══════════════════════════════════╝'));
    console.log(chalk.gray('Legend: D = Double Word Score\n'));
  }

  displayRack() {
    if (!this.gameState) return;

    const rack = this.gameState.racks[this.userId];
    if (!rack) return;

    console.log(chalk.yellow('Your Rack:'));
    console.log(chalk.cyan('╔═════════════════════════════╗'));
    
    let rackLine = chalk.cyan('║  ');
    rack.forEach(tile => {
      rackLine += chalk.bold.white(` ${tile} `);
    });
    
    // Fill empty spaces
    for (let i = rack.length; i < 5; i++) {
      rackLine += '   ';
    }
    
    rackLine += ' ' + chalk.cyan('║');
    console.log(rackLine);
    console.log(chalk.cyan('╚═════════════════════════════╝\n'));
  }

  displayScores() {
    if (!this.gameState) return;

    console.log(chalk.yellow('📊 Scores:'));
    Object.entries(this.gameState.scores).forEach(([userId, score]) => {
      const name = this.getPlayerName(userId);
      const isCurrentPlayer = userId === this.gameState!.currentPlayer;
      const indicator = isCurrentPlayer ? chalk.green('►') : ' ';
      const color = userId === this.userId ? chalk.bold.cyan : chalk.white;
      
      console.log(`  ${indicator} ${color(name)}: ${chalk.yellow(score)} points`);
    });
    console.log();
  }

  displayTurnInfo() {
    if (!this.gameState) return;

    const isMyTurn = this.gameState.currentPlayer === this.userId;
    const currentPlayerName = this.getPlayerName(this.gameState.currentPlayer);

    if (isMyTurn) {
      console.log(chalk.green.bold('🟢 IT\'S YOUR TURN!'));
    } else {
      console.log(chalk.gray(`⏳ Waiting for ${currentPlayerName}...`));
    }

    const tilesLeft = this.gameState.tileBag && typeof this.gameState.tileBag.remaining === 'number'
      ? this.gameState.tileBag.remaining
      : 'unknown';

    console.log(chalk.gray(`Turn: ${this.gameState.turnCount + 1} | Tiles left: ${tilesLeft}\n`));
  }

  private displayRoomsList(rooms: any[]) {
    console.log(chalk.yellow('\n📋 Available Rooms:\n'));

    if (rooms.length === 0) {
      console.log(chalk.gray('  No rooms available. Create one!\n'));
      return;
    }

    rooms.forEach(room => {
      const status = room.status === 'waiting' ? chalk.yellow('Waiting') : chalk.green('Playing');
      console.log(`  ${chalk.cyan(room.roomId)} - ${room.roomName}`);
      console.log(`    Players: ${room.playerCount}/2 | Status: ${status}`);
      console.log();
    });
  }

  private getPlayerName(userId: string): string {
    if (userId === this.userId) {
      return 'You';
    }

    if (this.room) {
      const player = this.room.players.find(p => p.userId === userId);
      if (player) {
        return player.username;
      }
    }

    return 'Unknown';
  }
}
