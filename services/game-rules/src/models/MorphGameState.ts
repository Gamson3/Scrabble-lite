export type ColorFeedback = 'green' | 'yellow' | 'gray';
export type BranchingLevel = 'high' | 'medium' | 'low';

export interface WordInsight {
  word: string;
  neighborCount: number;
  branchLevel: BranchingLevel;
  neighborSample: string[];
  distanceToTarget?: number;
}

export interface HintSuggestion extends WordInsight {
  category: 'distance' | 'safe' | 'structure';
  distanceDelta: number;
}

export interface HintBudget {
  used: number;
  remaining: number;
  limit: number;
}

export interface TransformationStep {
  word: string;
  feedback: ColorFeedback[];
  timestamp: string;
  branchLevel?: BranchingLevel;
  neighborCount?: number;
  distanceToTarget?: number;
}

export interface PlayerProgress {
  userId: string;
  username: string;
  currentWord: string;
  path: TransformationStep[];
  completed: boolean;
  transformationCount: number;
  hintsUsed: number;
  lastInsight?: WordInsight;
}

export interface MorphGameState {
  startWord: string;
  targetWord: string;
  players: {
    [userId: string]: PlayerProgress;
  };
  currentPlayer: string;
  turnCount: number;
  gameStatus: 'active' | 'finished';
  winner?: string;
  startedAt: string;
  startWordMeta: WordInsight;
  targetWordMeta: WordInsight;
  insightByPlayer: {
    [userId: string]: WordInsight | undefined;
  };
}

export interface MorphMove {
  userId: string;
  newWord: string;
}

export interface MorphMoveResult {
  valid: boolean;
  feedback?: ColorFeedback[];
  transformationCount?: number;
  completed?: boolean;
  winner?: boolean;
  gameState?: MorphGameState;
  errors?: MorphError[];
  insight?: WordInsight;
  hintBudget?: HintBudget;
  warnings?: string[];
}

export interface MorphError {
  code: string;
  message: string;
}

export const MORPH_CONFIG = {
  WORD_LENGTH: 5,
  MAX_TURNS: 50,
  POINTS_BASE: 100,
  POINTS_PER_STEP_PENALTY: 5,
  FIRST_TO_FINISH_BONUS: 50,
  MIN_START_DEGREE: 6,
  BRANCHING_THRESHOLDS: {
    high: 12,
    low: 3,
  },
  MAX_HINTS_PER_PLAYER: 5,
  HINTS_PER_REQUEST: 3,
  NEIGHBOR_SAMPLE: 8,
};
