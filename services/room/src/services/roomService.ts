import { WebSocket } from 'ws';
import crypto from 'crypto';
import { Room, Player, GameType } from '../models/Room';

class RoomService {
  private rooms: Map<string, Room> = new Map();

  private generateRoomId(): string {
    return `room_${crypto.randomBytes(6).toString('hex')}`;
  }

  createRoom(roomName: string, hostId: string, hostUsername: string, hostSocket: WebSocket, gameType: GameType = 'scrabble'): Room {
    const roomId = this.generateRoomId();

    const room: Room = {
      roomId,
      roomName,
      host: hostId,
      players: [
        {
          userId: hostId,
          username: hostUsername,
          socket: hostSocket,
        },
      ],
      status: 'waiting',
      createdAt: new Date().toISOString(),
      gameType,
    };

    this.rooms.set(roomId, room);
    console.log(`✅ Room created: ${roomName} (${roomId}) by ${hostUsername} [${gameType}]`);

    return room;
  }

  joinRoom(roomId: string, userId: string, username: string, socket: WebSocket): Room {
    const room = this.rooms.get(roomId);

    if (!room) {
      throw new Error('Room not found');
    }

    if (room.players.length >= 2) {
      throw new Error('Room is full');
    }

    if (room.players.some(p => p.userId === userId)) {
      throw new Error('Already in room');
    }

    room.players.push({
      userId,
      username,
      socket,
    });

    if (room.players.length === 2) {
      room.status = 'ready';
    }

    console.log(`✅ ${username} joined room ${roomId}`);

    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  listRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(r => r.status !== 'finished');
  }

  removePlayerFromRoom(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter(p => p.userId !== userId);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      console.log(`🗑️ Room ${roomId} deleted (empty)`);
    } else {
      if (room.host === userId && room.players.length > 0) {
        room.host = room.players[0].userId;
      }
      room.status = 'waiting';
    }
  }

  removePlayerFromAllRooms(userId: string): void {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.players.some(p => p.userId === userId)) {
        this.removePlayerFromRoom(roomId, userId);
      }
    }
  }

  getStats() {
    return {
      totalRooms: this.rooms.size,
      activeRooms: Array.from(this.rooms.values()).filter(r => r.status === 'playing').length,
    };
  }
}

export const roomService = new RoomService();
