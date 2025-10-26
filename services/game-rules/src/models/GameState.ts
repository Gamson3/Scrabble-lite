// Add method signature for makeMove for clarity (not required for runtime, but helps with types)
// interface GameService {
//   makeMove(roomId: string, userId: string, word: string, startRow: number, startCol: number, direction: string, tiles: string[]): any;
// }
export type BoardCell = string | null;

export interface GameState {
  roomId: string;
  board: BoardCell[][];
  racks: Record<string, string[]>;
  scores: Record<string, number>;
  currentPlayer: string;
  turnCount: number;
  gameStatus: 'active' | 'finished';
  passCount: number;
}
