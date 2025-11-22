import { CircleGameWebSocketClient } from './websocket-client';

export interface Room {
  roomId: string;
  roomName: string;
  hostId: string;
  playerCount: number;
  status: 'waiting' | 'active' | 'finished';
  players: Array<{ userId: string; username: string }>;
}

export interface RoomUpdateCallback {
  (room: Room): void;
}

/**
 * Manages room operations via WebSocket
 * Handles room creation, joining, listing, and leaving
 */
export class RoomManager {
  private ws: CircleGameWebSocketClient;
  private currentRoom: Room | null = null;
  private roomsList: Room[] = [];
  private roomUpdateCallbacks: RoomUpdateCallback[] = [];
  private playerJoinedCallbacks: Array<(player: any) => void> = [];
  private playerLeftCallbacks: Array<(player: any) => void> = [];

  constructor(ws: CircleGameWebSocketClient) {
    this.ws = ws;
    this.setupMessageHandlers();
  }

  /**
   * List all available rooms
   */
  listRooms(): Promise<Room[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for rooms list'));
      }, 5000);

      const handler = (payload: any) => {
        clearTimeout(timeout);
        this.ws.off('rooms_list', handler);
        const rooms = (payload.rooms || []).map((room: any) => this.normalizeRoom(room));
        this.roomsList = rooms;
        resolve(rooms);
      };

      this.ws.on('rooms_list', handler);
      this.ws.send('list_rooms', {});
    });
  }

  /**
   * Create a new game room
   */
  createRoom(roomName: string): Promise<Room> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for room creation'));
      }, 5000);

      const handler = (payload: any) => {
        clearTimeout(timeout);
        this.ws.off('room_created', handler);
        this.currentRoom = this.normalizeRoom(payload);
        this.notifyRoomUpdate();
        resolve(this.currentRoom!);
      };

      this.ws.on('room_created', handler);
      this.ws.send('create_room', { roomName });
    });
  }

  /**
   * Join an existing room
   */
  joinRoom(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ws.off('player_joined', handler);
        this.ws.off('room_updated', handler);
        reject(new Error('Timeout waiting to join room'));
      }, 5000);

      const handler = (payload: any) => {
        clearTimeout(timeout);
        this.ws.off('player_joined', handler);
        this.ws.off('room_updated', handler);
        
        // The server broadcasts 'player_joined' which contains players array
        if (payload.players) {
          // We received full room state from player_joined broadcast
          const roomData = {
            roomId: payload.roomId,
            roomName: payload.roomName,
            host: payload.host,
            hostId: payload.host,
            players: payload.players,
            playerCount: payload.playerCount || payload.players?.length || 0,
            status: payload.status
          };
          this.currentRoom = this.normalizeRoom(roomData);
        } else {
          // Fallback to other payload structures
          const roomData = payload.room || payload;
          this.currentRoom = this.normalizeRoom(roomData);
        }
        this.notifyRoomUpdate();
        resolve();
      };

      // Listen for player_joined event which is broadcasted when we join
      this.ws.on('player_joined', handler);
      // Also listen for room_updated as fallback
      this.ws.on('room_updated', handler);
      this.ws.send('join_room', { roomId });
    });
  }

  /**
   * Leave the current room
   */
  leaveRoom(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting to leave room'));
      }, 5000);

      const handler = () => {
        clearTimeout(timeout);
        this.ws.off('left_room', handler);
        this.currentRoom = null;
        resolve();
      };

      this.ws.on('left_room', handler);
      this.ws.send('leave_room', {});
    });
  }

  /**
   * Get current room
   */
  getCurrentRoom(): Room | null {
    return this.currentRoom;
  }

  /**
   * Get rooms list
   */
  getRoomsList(): Room[] {
    return this.roomsList;
  }

  /**
   * Check if user is in a room
   */
  isInRoom(): boolean {
    return this.currentRoom !== null;
  }

  /**
   * Get player count in current room
   */
  getPlayerCount(): number {
    return this.currentRoom?.playerCount || 0;
  }

  /**
   * Get list of players in current room
   */
  getPlayers(): Array<{ userId: string; username: string }> {
    return this.currentRoom?.players || [];
  }

  /**
   * Register callback for room updates
   */
  onRoomUpdated(callback: RoomUpdateCallback): void {
    this.roomUpdateCallbacks.push(callback);
  }

  /**
   * Register callback for player joined
   */
  onPlayerJoined(callback: (player: any) => void): void {
    this.playerJoinedCallbacks.push(callback);
  }

  /**
   * Register callback for player left
   */
  onPlayerLeft(callback: (player: any) => void): void {
    this.playerLeftCallbacks.push(callback);
  }

  /**
   * Private methods
   */

  private setupMessageHandlers(): void {
    this.ws.on('room_updated', (payload) => {
      this.currentRoom = this.normalizeRoom(payload);
      this.notifyRoomUpdate();
    });

    this.ws.on('player_joined', (payload) => {
      // IMPORTANT: player_joined broadcast from backend contains:
      // - roomId, player (the new player), players (array), status
      // BUT it does NOT include roomName or host
      // So we must preserve existing room data
      
      if (!this.currentRoom) {
        // This shouldn't happen, but handle it
        return;
      }

      // Only update if this is for our current room
      if (payload.roomId !== this.currentRoom.roomId) {
        return;
      }

      // Update room with new players, but preserve name and host
      const roomData = {
        roomId: this.currentRoom.roomId,
        roomName: this.currentRoom.roomName, // PRESERVE from cached data
        host: this.currentRoom.hostId, // PRESERVE from cached data
        hostId: this.currentRoom.hostId, // PRESERVE from cached data
        players: payload.players || [], // UPDATE with new player list
        playerCount: payload.playerCount || payload.players?.length || 0,
        status: payload.status || this.currentRoom.status
      };
      
      this.currentRoom = this.normalizeRoom(roomData);
      this.notifyRoomUpdate();

      // Trigger player joined callbacks
      if (payload.player) {
        this.playerJoinedCallbacks.forEach((cb) => cb(payload.player));
      }
    });

    this.ws.on('player_left', (payload) => {
      if (!this.currentRoom) {
        return;
      }

      // Only update if this is for our current room
      if (payload.roomId !== this.currentRoom.roomId) {
        return;
      }

      // Update room with new player list, but preserve name and host
      const roomData = {
        roomId: this.currentRoom.roomId,
        roomName: this.currentRoom.roomName, // PRESERVE
        host: this.currentRoom.hostId, // PRESERVE
        hostId: this.currentRoom.hostId, // PRESERVE
        players: payload.players || [], // UPDATE with new player list
        playerCount: payload.playerCount || payload.players?.length || 0,
        status: payload.status || this.currentRoom.status
      };

      this.currentRoom = this.normalizeRoom(roomData);
      this.notifyRoomUpdate();

      if (payload.player) {
        this.playerLeftCallbacks.forEach((cb) => cb(payload.player));
      }
    });
  }

  private notifyRoomUpdate(): void {
    if (this.currentRoom) {
      this.roomUpdateCallbacks.forEach((cb) => cb(this.currentRoom!));
    }
  }

  /**
   * Normalize room data from server to match Room interface
   * Handles different possible field names and structures from backend
   */
  private normalizeRoom(rawRoom: any): Room {
    if (!rawRoom) {
      throw new Error('Invalid room data');
    }

    // Extract and normalize fields - handle both camelCase and snake_case
    const roomId = rawRoom.roomId || rawRoom.id || '';
    const roomName = rawRoom.roomName || rawRoom.name || '';
    
    // The backend sends 'host' field which is the userId of the host
    // It might also send 'hostId' or 'host_id'
    const hostId = rawRoom.hostId || rawRoom.host_id || rawRoom.host || '';
    const status = rawRoom.status || 'waiting';
    
    // Handle different player structures
    let players = rawRoom.players || [];
    if (!Array.isArray(players)) {
      players = [];
    }
    
    // Normalize player objects to have userId and username
    const normalizedPlayers = players.map((p: any) => ({
      userId: p.userId || p.id || p.user_id || '',
      username: p.username || p.name || ''
    }));

    // Calculate player count from players array or use provided count
    const playerCount = rawRoom.playerCount || rawRoom.player_count || normalizedPlayers.length;

    return {
      roomId,
      roomName,
      hostId,
      playerCount: normalizedPlayers.length > 0 ? normalizedPlayers.length : playerCount,
      status: status as 'waiting' | 'active' | 'finished',
      players: normalizedPlayers
    };
  }
}
