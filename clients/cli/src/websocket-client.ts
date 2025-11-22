import { WebSocket } from 'ws';

export interface WSMessage {
  type: string;
  payload?: any;
}

export interface MessageHandler {
  (payload: any): void;
}

/**
 * WebSocket client for Circle Word Game
 * Handles connection, disconnection, message sending/receiving, and auto-reconnect
 */
export class CircleGameWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private isAuthenticated: boolean = false;
  private messageQueue: WSMessage[] = [];
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private isConnecting: boolean = false;

  /**
   * Connect to WebSocket server
   */
  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting) {
        reject(new Error('Connection already in progress'));
        return;
      }

      this.isConnecting = true;
      this.url = url;

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('✅ Connected to game server');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.flushMessageQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data.toString());
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('❌ Disconnected from game server');
          this.isAuthenticated = false;
          this.isConnecting = false;
          this.attemptReconnect();
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.onclose = () => {
          resolve();
        };
        this.ws.close();
        this.ws = null;
      } else {
        resolve();
      }
    });
  }

  /**
   * Send a message to the server
   */
  send(type: string, payload?: any): void {
    const message: WSMessage = { type, payload };

    if (!this.isConnected()) {
      this.messageQueue.push(message);
      return;
    }

    try {
      this.ws!.send(JSON.stringify(message));
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      this.messageQueue.push(message);
    }
  }

  /**
   * Register handler for message type
   */
  on(type: string, callback: MessageHandler): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(callback);
  }

  /**
   * Remove handler for message type
   */
  off(type: string, callback: MessageHandler): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(callback);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Authenticate with token
   */
  authenticate(userId: string, username: string, token: string): void {
    this.send('auth', { userId, username, token });
  }

  /**
   * Check if connected and authenticated
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  isAuth(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Private methods
   */

  private handleMessage(message: WSMessage): void {
    const { type, payload } = message;

    if (type === 'auth_success') {
      this.isAuthenticated = true;
    } else if (type === 'auth_error') {
      this.isAuthenticated = false;
    }

    const handlers = this.messageHandlers.get(type) || [];
    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Error handling ${type}:`, error);
      }
    });
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message.type, message.payload);
      }
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(chalk.red(`❌ Failed to reconnect after ${this.maxReconnectAttempts} attempts`));
      console.log(chalk.yellow('Please restart the CLI client'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(chalk.yellow(`⏳ Reconnecting in ${Math.round(delay / 1000)} seconds...`));

    setTimeout(() => {
      console.log(chalk.gray(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`));
      this.connect(this.url).catch((error) => {
        console.error('Reconnection failed:', error.message);
      });
    }, delay);
  }
}

// Import chalk for colors in auto-reconnect messages
import chalk from 'chalk';
