import WebSocket from 'ws';
import chalk from 'chalk';

type BranchingLevel = 'high' | 'medium' | 'low';

interface WordInsight {
  word: string;
  neighborCount: number;
  branchLevel: BranchingLevel;
  neighborSample: string[];
  distanceToTarget?: number;
}

interface HintSuggestion extends WordInsight {
  category: 'distance' | 'safe' | 'structure';
  distanceDelta: number;
}

interface HintBudget {
  used: number;
  remaining: number;
  limit: number;
}

interface TransformationStep {
  word: string;
  feedback: string[];
  timestamp: string;
  branchLevel?: BranchingLevel;
  neighborCount?: number;
  distanceToTarget?: number;
}

interface PlayerProgress {
  userId: string;
  username: string;
  currentWord: string;
  path: TransformationStep[];
  completed: boolean;
  transformationCount: number;
  lastInsight?: WordInsight;
  hintsUsed?: number;
}

interface MorphGameState {
  startWord: string;
  targetWord: string;
  startWordMeta?: WordInsight;
  targetWordMeta?: WordInsight;
  players: Record<string, PlayerProgress>;
  currentPlayer: string;
  turnCount: number;
  gameStatus: 'active' | 'finished';
  winner?: string;
  insightByPlayer?: Record<string, WordInsight | undefined>;
}

interface RoomPlayer {
  userId: string;
  username: string;
}

interface Room {
  roomId: string;
  roomName: string;
  host: string;
  players: RoomPlayer[];
  status: string;
}

interface RoomsListItem {
  roomId: string;
  roomName: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
}

export class MorphGameClient {
  private ws: WebSocket | null = null;
  private roomId: string | null = null;
  private room: Room | null = null;
  private gameState: MorphGameState | null = null;
  private connected = false;
  private gameMode: 'morph' | 'scrabble' = 'morph';
  private lastHintBudget: HintBudget | null = null;
  private readonly hintLimitFallback = 5;

  constructor(
    private readonly wsUrl: string,
    private readonly userId: string,
    private readonly username: string,
    private readonly token: string
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log(chalk.gray('🔌 WebSocket connected'));
        this.authenticate();
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);

        if (message.type === 'auth_ok') {
          this.connected = true;
          resolve();
        }
      });

      this.ws.on('error', (error) => {
        console.error(chalk.red('WebSocket error:'), (error as Error).message);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log(chalk.gray('📤 WebSocket disconnected'));
        this.connected = false;
      });

      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 5000);
    });
  }

  private authenticate() {
    this.send('auth', {
      token: this.token,
      userId: this.userId,
    });
  }

  private send(type: string, payload: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  private handleMessage(message: any) {
    const { type, payload } = message;

    switch (type) {
      case 'auth_ok':
        break;
      case 'room_created':
        this.roomId = payload.roomId;
        this.room = payload;
        console.log(chalk.green(`\n✅ Room created: ${payload.roomName}`));
        console.log(chalk.gray(`Room ID: ${payload.roomId}`));
        console.log(chalk.yellow('⏳ Waiting for another player to join...\n'));
        break;
      case 'rooms_list':
        this.displayRoomsList(payload.rooms as RoomsListItem[]);
        break;
      case 'player_joined':
        this.room = payload;
        console.log(chalk.green(`\n✅ ${payload.player.username} joined the room!`));
        console.log(chalk.gray(`Players: ${payload.players.length}/2`));
        if (payload.status === 'ready') {
          console.log(chalk.yellow('\n🎮 Room is ready! Host can start the game.\n'));
        }
        break;
      case 'morph_game_started':
        this.gameState = payload.gameState as MorphGameState;
        this.lastHintBudget = null;
        console.log(chalk.green.bold('\n🎮 WORD MORPH DUEL STARTED!\n'));
        this.displayMorphGameInfo();
        this.displayPlayerProgress();
        this.displayTurnInfo();
        break;
      case 'morph_game_state':
        this.gameState = payload.gameState as MorphGameState;
        console.log(chalk.cyan('\n📊 Game State Updated\n'));
        this.displayPlayerProgress();
        this.displayTurnInfo();
        break;
      case 'morph_move_result':
        this.handleMoveResult(payload);
        break;
      case 'morph_hint_result':
        this.lastHintBudget = payload.hintBudget ?? null;
        this.displayHintResult(payload.suggestions as HintSuggestion[], this.lastHintBudget);
        break;
      case 'morph_game_over':
        this.handleGameOver(payload);
        break;
      case 'chat_broadcast':
        if (payload.userId !== this.userId) {
          console.log(chalk.blue(`\n💬 ${payload.username}: ${payload.message}\n`));
        }
        break;
      case 'error':
        console.log(chalk.red(`\n❌ Error: ${payload.message}\n`));
        break;
      default:
        break;
    }
  }

  private handleMoveResult(payload: any) {
    if (payload.valid) {
      console.log(chalk.green(`\n✅ Valid transformation!`));
      this.displayColorFeedback(payload.feedback as string[]);

       if (payload.insight) {
        this.displayInsight(payload.insight as WordInsight, payload.warnings as string[] | undefined, payload.hintBudget as HintBudget | undefined);
      }

      if (payload.hintBudget) {
        this.lastHintBudget = payload.hintBudget as HintBudget;
      }

      if (payload.completed) {
        console.log(chalk.green.bold(`\n🎯 You reached the target word!`));
      }

      if (payload.winner) {
        console.log(chalk.yellow.bold(`\n🏆 YOU WON THE GAME!\n`));
      }
    } else {
      console.log(chalk.red('\n❌ Invalid move:'));
      if (payload.errors) {
        (payload.errors as { message: string }[]).forEach(error => {
          console.log(chalk.red(`   - ${error.message}`));
        });
      }
      console.log();
    }
  }

  private handleGameOver(payload: any) {
    console.log(chalk.green.bold('\n╔═══════════════════════════════════╗'));
    console.log(chalk.green.bold('║       🏁 GAME OVER! 🏁          ║'));
    console.log(chalk.green.bold('╚═══════════════════════════════════╝\n'));

    const winnerName = payload.winnerName || 'Unknown';
    const isWinner = payload.winner === this.userId;

    if (isWinner) {
      console.log(chalk.yellow.bold('🏆 YOU WON! 🏆\n'));
    } else {
      console.log(chalk.gray(`Winner: ${winnerName}\n`));
    }

    if (payload.gameState) {
      this.displayFinalStats(payload.gameState as MorphGameState);
    }
  }

  private displayFinalStats(gameState: MorphGameState) {
    console.log(chalk.cyan('Final Statistics:\n'));

    for (const [userId, player] of Object.entries(gameState.players)) {
      const isYou = userId === this.userId;
      const name = isYou ? chalk.bold.cyan('You') : chalk.white(player.username);
      const status = player.completed ? chalk.green('✓ Completed') : chalk.gray('✗ Incomplete');

      console.log(`${name}: ${player.transformationCount} transformations ${status}`);
      console.log(chalk.gray(`  Path: ${player.path.map(step => step.word).join(' → ')}`));
      console.log();
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

  startGame(mode: 'morph' | 'scrabble' = 'morph') {
    if (!this.roomId) return;
    this.gameMode = mode;
    this.send('start_game', { roomId: this.roomId, gameMode: mode });
  }

  makeMorphMove(newWord: string) {
    if (!this.roomId) return;
    this.send('morph_move', {
      roomId: this.roomId,
      newWord: newWord.toUpperCase(),
    });
  }

  requestHint(limit = 3) {
    if (!this.roomId) return;
    this.send('morph_hint_request', {
      roomId: this.roomId,
      limit,
    });
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
    if (!this.room) return false;
    return this.room.host === this.userId;
  }

  isGameStarted(): boolean {
    return this.gameState !== null;
  }

  getGameMode(): 'morph' | 'scrabble' {
    return this.gameMode;
  }

  displayHelp() {
    console.log(chalk.yellow('\n📖 WORD MORPH DUEL - How to Play\n'));
    console.log(chalk.white('Goal: ') + chalk.gray('Transform the start word into the target word'));
    console.log(chalk.white('Rules: ') + chalk.gray('Change exactly ONE letter per turn'));
    console.log(chalk.white('       ') + chalk.gray('Each new word must be valid (in dictionary)'));
    console.log(chalk.white('Hints: ') + chalk.gray('Use Smart Hint (limited) to surface safe moves'));
    console.log(chalk.white('Win: ') + chalk.gray('First player to reach target word wins!'));
    console.log();
    console.log(chalk.cyan('Color Feedback:'));
    console.log(chalk.bgGreen.black(' ● ') + chalk.gray(' Green = Letter in correct position'));
    console.log(chalk.bgYellow.black(' ● ') + chalk.gray(' Yellow = Letter in word, wrong position'));
    console.log(chalk.bgGray.white(' ● ') + chalk.gray(' Gray = Letter not in target word'));
    console.log();
  }

  private displayMorphGameInfo() {
    if (!this.gameState) return;

    console.log(chalk.cyan('╔═══════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.bold.yellow('      WORD MORPH DUEL - CHALLENGE        ') + chalk.cyan('║'));
    console.log(chalk.cyan('╠═══════════════════════════════════════════╣'));
    console.log(chalk.cyan('║                                           ║'));
    console.log(chalk.cyan('║  ') + chalk.white('Start Word:  ') + chalk.bold.green(this.gameState.startWord.padEnd(23)) + chalk.cyan('    ║'));
    console.log(chalk.cyan('║  ') + chalk.white('Target Word: ') + chalk.bold.magenta(this.gameState.targetWord.padEnd(23)) + chalk.cyan('    ║'));
    console.log(chalk.cyan('║                                           ║'));
    console.log(chalk.cyan('║  ') + chalk.gray('Transform start → target               ') + chalk.cyan('║'));
    console.log(chalk.cyan('║  ') + chalk.gray('Change ONE letter per turn             ') + chalk.cyan('║'));
    console.log(chalk.cyan('║  ') + chalk.gray('First to reach target wins!            ') + chalk.cyan('║'));
    console.log(chalk.cyan('║                                           ║'));
    console.log(chalk.cyan('╚═══════════════════════════════════════════╝\n'));

    if (this.gameState.startWordMeta) {
      console.log(chalk.gray('Start strength: ') + this.describeInsight(this.gameState.startWordMeta));
    }
    if (this.gameState.targetWordMeta) {
      console.log(chalk.gray('Target proximity: ') + this.describeInsight(this.gameState.targetWordMeta));
    }
    console.log();
  }

  private displayPlayerProgress() {
    if (!this.gameState) return;

    console.log(chalk.yellow('📊 Player Progress:\n'));

    for (const [userId, player] of Object.entries(this.gameState.players)) {
      const isYou = userId === this.userId;
      const isCurrent = userId === this.gameState.currentPlayer;
      const name = isYou ? chalk.bold.cyan('You') : chalk.white(player.username);
      const indicator = isCurrent ? chalk.green('►') : ' ';
      const status = player.completed ? chalk.green('✓') : chalk.gray('○');

      console.log(`${indicator} ${name} ${status}`);
      console.log(`  Current: ${chalk.bold(player.currentWord)}`);
      console.log(`  Steps: ${player.transformationCount}`);

      if (player.lastInsight) {
        console.log(`  Distance: ${this.renderDistance(player.lastInsight.distanceToTarget)}`);
        console.log(`  Potential: ${this.describeBranching(player.lastInsight)}`);
      }

      if (typeof player.hintsUsed === 'number') {
        console.log(`  Hints used: ${player.hintsUsed}/${this.lastHintBudget?.limit ?? this.hintLimitFallback}`);
      }

      const recentPath = player.path.slice(-3);
      if (recentPath.length > 0) {
        const pathStr = recentPath.map(step => step.word).join(' → ');
        console.log(`  Path: ${chalk.gray(pathStr)}`);
      }
      console.log();
    }
  }

  private displayTurnInfo() {
    if (!this.gameState) return;

    const isMyTurn = this.gameState.currentPlayer === this.userId;
    const currentPlayer = this.gameState.players[this.gameState.currentPlayer];

    if (isMyTurn) {
      console.log(chalk.green.bold("🟢 IT'S YOUR TURN!"));
      console.log(chalk.gray(`Your current word: ${chalk.white(currentPlayer.currentWord)}`));
      console.log(chalk.gray(`Target: ${chalk.magenta(this.gameState.targetWord)}`));
      console.log(chalk.gray(`Hints remaining: ${this.formatHintBudgetDisplay(currentPlayer.hintsUsed)}`));
    } else {
      const opponentName = currentPlayer?.username || 'Opponent';
      console.log(chalk.gray(`⏳ Waiting for ${opponentName}...`));
    }
    console.log();
  }

  private displayColorFeedback(feedback: string[]) {
    if (!feedback) return;

    console.log(chalk.white('Color Feedback: '));

    const coloredSquares = feedback.map(color => {
      switch (color) {
        case 'green':
          return chalk.bgGreen.black(' ● ');
        case 'yellow':
          return chalk.bgYellow.black(' ● ');
        default:
          return chalk.bgGray.white(' ● ');
      }
    }).join('');

    console.log(coloredSquares);
    console.log(chalk.gray('(Green = correct position, Yellow = in word, Gray = not in word)\n'));
  }

  private displayInsight(insight: WordInsight, warnings?: string[], hintBudget?: HintBudget) {
    console.log(chalk.gray(`Next word potential: ${this.describeBranching(insight)}`));
    console.log(chalk.gray(`Distance to target: ${this.renderDistance(insight.distanceToTarget)}`));

    if (warnings && warnings.length) {
      warnings.forEach(warning => console.log(chalk.red(`⚠ ${warning}`)));
    }

    if (hintBudget) {
      console.log(chalk.gray(`Hint tokens remaining: ${hintBudget.remaining}/${hintBudget.limit}`));
    }
  }

  private displayHintResult(suggestions: HintSuggestion[] = [], hintBudget?: HintBudget | null) {
    console.log(chalk.yellow('\n💡 Smart Suggestions'));

    if (!suggestions || suggestions.length === 0) {
      console.log(chalk.gray('No safe hints available right now. Try exploring!\n'));
    } else {
      suggestions.forEach((hint, index) => {
        const label = this.formatHintCategory(hint.category);
        const delta = hint.distanceDelta > 0 ? `-${hint.distanceDelta}` : '0';
        console.log(
          `${index + 1}. ${chalk.bold(hint.word)} ${label} • Δ ${delta} • ${this.describeBranching(hint)} • ${
            this.renderDistance(hint.distanceToTarget)
          }`
        );
      });
      console.log();
    }

    if (hintBudget) {
      console.log(chalk.gray(`Hints remaining: ${hintBudget.remaining}/${hintBudget.limit}\n`));
    }
  }

  private describeInsight(insight: WordInsight): string {
    return `${this.describeBranching(insight)} • ${this.renderDistance(insight.distanceToTarget)}`;
  }

  private describeBranching(insight: WordInsight): string {
    return `${this.formatBranchLevel(insight.branchLevel)} (${insight.neighborCount} exits)`;
  }

  private renderDistance(distance?: number): string {
    if (distance === undefined || Number.isNaN(distance)) {
      return 'unknown distance';
    }
    if (distance === 0) {
      return chalk.green('aligned');
    }
    return `${distance} away`;
  }

  private formatBranchLevel(level: BranchingLevel): string {
    switch (level) {
      case 'high':
        return chalk.green('high potential');
      case 'medium':
        return chalk.yellow('steady');
      default:
        return chalk.red('low');
    }
  }

  private formatHintCategory(category: HintSuggestion['category']): string {
    switch (category) {
      case 'distance':
        return chalk.green('[closer]');
      case 'safe':
        return chalk.cyan('[safe]');
      default:
        return chalk.yellow('[structure]');
    }
  }

  private formatHintBudgetDisplay(hintsUsed?: number): string {
    if (this.lastHintBudget) {
      return `${this.lastHintBudget.remaining}/${this.lastHintBudget.limit}`;
    }
    const used = hintsUsed ?? 0;
    const remaining = Math.max(this.hintLimitFallback - used, 0);
    return `${remaining}/${this.hintLimitFallback}`;
  }

  private displayRoomsList(rooms: RoomsListItem[]) {
    console.log(chalk.yellow('\n📋 Available Rooms:\n'));

    if (!rooms || rooms.length === 0) {
      console.log(chalk.gray('  No rooms available. Create one!\n'));
      return;
    }

    rooms.forEach(room => {
      const statusText = room.status === 'waiting' ? chalk.yellow('Waiting') : chalk.green('Playing');
      console.log(`  ${chalk.cyan(room.roomId)} - ${room.roomName}`);
      console.log(`    Players: ${room.playerCount}/2 | Status: ${statusText}`);
      console.log();
    });
  }
}
