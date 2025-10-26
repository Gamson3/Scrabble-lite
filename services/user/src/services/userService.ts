import crypto from 'crypto';
import { User, Session } from '../models/User';

class UserService {
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();

  register(username: string): User {
    const existing = Array.from(this.users.values()).find(u => u.username === username);
    if (existing) {
      return existing;
    }

    const userId = `usr_${crypto.randomBytes(6).toString('hex')}`;
    const user: User = {
      userId,
      username,
      createdAt: new Date().toISOString(),
    };

    this.users.set(userId, user);
    return user;
  }

  login(username: string): { user: User; session: Session } {
    const user = Array.from(this.users.values()).find(u => u.username === username) ||
      this.register(username);

    const token = `tok_${crypto.randomBytes(16).toString('hex')}`;
    const session: Session = {
      userId: user.userId,
      token,
      expiresAt: null,
    };

    this.sessions.set(token, session);
    return { user, session };
  }

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  validateToken(token: string): Session | undefined {
    return this.sessions.get(token);
  }
}

export const userService = new UserService();
