import axios from 'axios';
import readlineSync from 'readline-sync';
import chalk from 'chalk';
import { MorphGameClient } from './morph-game-client';

const USER_SERVICE_URL = 'http://localhost:3001';
const ROOM_SERVICE_WS = 'ws://localhost:3004';

interface AuthResponse {
  userId: string;
  username: string;
  token: string;
}

interface UserSession {
  userId: string;
  username: string;
  token: string;
}

class WordMorphCLI {
  private session: UserSession | null = null;
  private gameClient: MorphGameClient | null = null;

  async start() {
    console.clear();
    this.printHeader();

    while (true) {
      if (!this.session) {
        await this.handleAuth();
      } else {
        await this.handleMainMenu();
      }
    }
  }

  private printHeader() {
    console.log(chalk.cyan('╔════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.bold.yellow('      WORD MORPH DUEL - CLI           ') + chalk.cyan('║'));
    console.log(chalk.cyan('║') + chalk.gray('  Transform Words • Race Your Opponent ') + chalk.cyan('║'));
    console.log(chalk.cyan('╚════════════════════════════════════════╝'));
    console.log();
  }

  private async handleAuth() {
    console.log(chalk.yellow('\n🔐 Authentication Required\n'));
    console.log('1. Register');
    console.log('2. Login');
    console.log('3. Exit');

    const choice = readlineSync.question(chalk.cyan('\nChoice: '));

    switch (choice) {
      case '1':
        await this.register();
        break;
      case '2':
        await this.login();
        break;
      case '3':
        console.log(chalk.green('\n👋 Goodbye!\n'));
        process.exit(0);
      default:
        console.log(chalk.red('Invalid choice'));
    }
  }

  private async register() {
    const username = readlineSync.question(chalk.cyan('Enter username: '));

    try {
      const response = await axios.post<AuthResponse>(`${USER_SERVICE_URL}/users/register`, {
        username,
      });

      console.log(chalk.green(`\n✅ Registered successfully as ${username}!`));
      console.log(chalk.gray(`User ID: ${response.data.userId}\n`));

      await this.login(username);
    } catch (error: any) {
      if (error.response?.data?.error?.message) {
        console.log(chalk.red(`\n❌ ${error.response.data.error.message}\n`));
      } else {
        console.log(chalk.red('\n❌ Registration failed. Is the User Service running?\n'));
      }
    }
  }

  private async login(prefilledUsername?: string) {
    const username = prefilledUsername || readlineSync.question(chalk.cyan('Enter username: '));

    try {
      const response = await axios.post<AuthResponse>(`${USER_SERVICE_URL}/users/login`, {
        username,
      });

      this.session = {
        userId: response.data.userId,
        username: response.data.username,
        token: response.data.token,
      };

      console.log(chalk.green(`\n✅ Logged in as ${username}!\n`));
      await this.connectWebSocket();
    } catch (error: any) {
      if (error.response?.data?.error?.message) {
        console.log(chalk.red(`\n❌ ${error.response.data.error.message}\n`));
      } else {
        console.log(chalk.red('\n❌ Login failed. Is the User Service running?\n'));
      }
    }
  }

  private async connectWebSocket() {
    if (!this.session) return;

    console.log(chalk.gray('🔌 Connecting to game server...'));

    this.gameClient = new MorphGameClient(
      ROOM_SERVICE_WS,
      this.session.userId,
      this.session.username,
      this.session.token
    );

    await this.gameClient.connect();
    console.log(chalk.green('✅ Connected to game server!\n'));
  }

  private async handleMainMenu() {
    console.log(chalk.yellow(`\n👤 Logged in as: ${chalk.bold(this.session!.username)}\n`));
    console.log('1. Create Room');
    console.log('2. List Rooms');
    console.log('3. Join Room');
    console.log('4. Logout');
    console.log('5. Exit');

    const choice = readlineSync.question(chalk.cyan('\nChoice: '));

    switch (choice) {
      case '1':
        await this.createRoom();
        break;
      case '2':
        await this.listRooms();
        break;
      case '3':
        await this.joinRoom();
        break;
      case '4':
        this.logout();
        break;
      case '5':
        console.log(chalk.green('\n👋 Goodbye!\n'));
        process.exit(0);
      default:
        console.log(chalk.red('Invalid choice'));
    }
  }

  private async createRoom() {
    const roomName = readlineSync.question(chalk.cyan('Enter room name: '));

    if (!this.gameClient) {
      console.log(chalk.red('Not connected to server'));
      return;
    }

    this.gameClient.createRoom(roomName);
    console.log(chalk.gray('\n⏳ Creating room...\n'));

    await this.sleep(1000);
    await this.gameLoop();
  }

  private async listRooms() {
    if (!this.gameClient) {
      console.log(chalk.red('Not connected to server'));
      return;
    }

    this.gameClient.listRooms();
    console.log(chalk.gray('\n⏳ Fetching rooms...\n'));
    await this.sleep(1000);
  }

  private async joinRoom() {
    const roomId = readlineSync.question(chalk.cyan('Enter room ID: '));

    if (!this.gameClient) {
      console.log(chalk.red('Not connected to server'));
      return;
    }

    this.gameClient.joinRoom(roomId);
    console.log(chalk.gray('\n⏳ Joining room...\n'));

    await this.sleep(1000);
    await this.gameLoop();
  }

  private async gameLoop() {
    if (!this.gameClient) return;

    while (this.gameClient.isInRoom()) {
      console.log(chalk.yellow('\n🎮 Game Menu\n'));

      if (this.gameClient.isHost() && !this.gameClient.isGameStarted()) {
        console.log('1. Start Game (Word Morph Duel)');
      }

      if (this.gameClient.isGameStarted()) {
        console.log('2. Make Move (Transform Word)');
        console.log('3. Request Smart Hint');
        console.log('4. Show Help');
      }

      console.log('5. Send Chat Message');
      console.log('6. Leave Room');

      const choice = readlineSync.question(chalk.cyan('\nChoice: '));

      switch (choice) {
        case '1':
          if (this.gameClient.isHost() && !this.gameClient.isGameStarted()) {
            this.gameClient.startGame('morph');
            console.log(chalk.gray('\n⏳ Starting game...\n'));
            await this.sleep(1500);
          }
          break;
        case '2':
          if (this.gameClient.isGameStarted()) {
            await this.makeMorphMove();
          }
          break;
        case '3':
          if (this.gameClient.isGameStarted()) {
            await this.requestHint();
          }
          break;
        case '4':
          if (this.gameClient.isGameStarted()) {
            this.gameClient.displayHelp();
          }
          break;
        case '5':
          await this.sendChat();
          break;
        case '6':
          this.gameClient.leaveRoom();
          return;
        default:
          console.log(chalk.red('Invalid choice'));
      }

      await this.sleep(500);
    }
  }

  private async makeMorphMove() {
    if (!this.gameClient) return;

    console.log(chalk.yellow('\n📝 Transform Word\n'));
    console.log(chalk.gray('Enter your new word (change exactly 1 letter):\n'));

    const newWord = readlineSync.question(chalk.cyan('New word: ')).toUpperCase();

    if (newWord.length !== 5) {
      console.log(chalk.red('Word must be exactly 5 letters!'));
      return;
    }

    this.gameClient.makeMorphMove(newWord);
    console.log(chalk.gray('\n⏳ Validating transformation...\n'));
    await this.sleep(1000);
  }

  private async requestHint() {
    if (!this.gameClient) return;

    console.log(chalk.yellow('\n🔍 Requesting Smart Suggestions...\n'));
    this.gameClient.requestHint();
    await this.sleep(800);
  }

  private async sendChat() {
    const message = readlineSync.question(chalk.cyan('Message: '));

    if (this.gameClient) {
      this.gameClient.sendChat(message);
    }
  }

  private logout() {
    if (this.gameClient) {
      this.gameClient.disconnect();
    }
    this.session = null;
    this.gameClient = null;
    console.log(chalk.green('\n✅ Logged out successfully!\n'));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const cli = new WordMorphCLI();
cli.start().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
