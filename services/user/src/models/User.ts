export interface User {
  userId: string;
  username: string;
  createdAt: string;
}

export interface Session {
  userId: string;
  token: string;
  expiresAt: string | null;
}
