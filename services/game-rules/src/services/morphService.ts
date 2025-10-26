import axios from 'axios';
import {
  MorphGameState,
  MorphMove,
  MorphMoveResult,
  MorphError,
  ColorFeedback,
  TransformationStep,
  PlayerProgress,
  WordInsight,
  HintSuggestion,
  HintBudget,
  BranchingLevel,
  MORPH_CONFIG,
} from '../models/MorphGameState';

interface DictionaryWordsResponse {
  words: string[];
}

interface DictionaryValidateResponse {
  valid: boolean;
}

interface DictionaryRandomWordResponse {
  word: string;
  degree?: number;
  branchLevel?: BranchingLevel;
}

interface DictionaryWordAnalysisResponse {
  word: string;
  valid: boolean;
  neighborCount: number;
  neighbors: string[];
  branchLevel: BranchingLevel;
}

const DICTIONARY_SERVICE_URL = process.env.DICTIONARY_SERVICE_URL || 'http://localhost:3002';

class MorphService {
  private games: Map<string, MorphGameState> = new Map();
  private wordAnalysisCache: Map<string, DictionaryWordAnalysisResponse> = new Map();

  private async getRandomWord(minDegree = MORPH_CONFIG.MIN_START_DEGREE): Promise<string> {
    try {
      const response = await axios.get<DictionaryRandomWordResponse>(`${DICTIONARY_SERVICE_URL}/words/random`, {
        params: { minDegree },
      });

      if (response.data?.word) {
        return response.data.word.toUpperCase();
      }
    } catch (error) {
      console.error('Error fetching guarded random word:', error);
    }

    try {
      const fallbackResponse = await axios.get<DictionaryWordsResponse>(`${DICTIONARY_SERVICE_URL}/words`);
      const words = fallbackResponse.data.words.filter(w => w.length === MORPH_CONFIG.WORD_LENGTH);

      if (words.length > 0) {
        return words[Math.floor(Math.random() * words.length)].toUpperCase();
      }
    } catch (error) {
      console.error('Error fetching fallback words:', error);
    }

    const fallbacks = ['SLATE', 'CRANE', 'ADIEU', 'ARISE', 'AUDIO'];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  async startGame(roomId: string, playerIds: string[], usernames: string[]): Promise<MorphGameState> {
    if (playerIds.length !== 2) {
      throw new Error('Game requires exactly 2 players');
    }

    const startWord = await this.getRandomWord();
    let targetWord = await this.getRandomWord();

    while (targetWord === startWord) {
      targetWord = await this.getRandomWord();
    }

    const startInsight = await this.buildWordInsight(startWord, targetWord);
    const targetInsight = await this.buildWordInsight(targetWord, targetWord);

    const players: { [userId: string]: PlayerProgress } = {};

    for (let i = 0; i < playerIds.length; i++) {
      const initialFeedback = this.getColorFeedback(startWord, targetWord);

      players[playerIds[i]] = {
        userId: playerIds[i],
        username: usernames[i],
        currentWord: startWord,
        path: [
          {
            word: startWord,
            feedback: initialFeedback,
            timestamp: new Date().toISOString(),
            branchLevel: startInsight.branchLevel,
            neighborCount: startInsight.neighborCount,
            distanceToTarget: startInsight.distanceToTarget,
          },
        ],
        completed: false,
        transformationCount: 0,
        hintsUsed: 0,
        lastInsight: startInsight,
      };
    }

    const gameState: MorphGameState = {
      startWord,
      targetWord,
      players,
      currentPlayer: playerIds[0],
      turnCount: 0,
      gameStatus: 'active',
      startedAt: new Date().toISOString(),
      startWordMeta: startInsight,
      targetWordMeta: targetInsight,
      insightByPlayer: {},
    };

    gameState.insightByPlayer[playerIds[0]] = startInsight;
    gameState.insightByPlayer[playerIds[1]] = startInsight;

    this.games.set(roomId, gameState);
    console.log(`✅ Word Morph Duel started: ${startWord} → ${targetWord}`);

    return gameState;
  }

  async makeMove(roomId: string, move: MorphMove): Promise<MorphMoveResult> {
    const gameState = this.games.get(roomId);

    if (!gameState) {
      return {
        valid: false,
        errors: [{ code: 'GAME_NOT_FOUND', message: 'Game not found' }],
      };
    }

    if (gameState.currentPlayer !== move.userId) {
      return {
        valid: false,
        errors: [{ code: 'NOT_YOUR_TURN', message: "It's not your turn" }],
      };
    }

    const player = gameState.players[move.userId];
    if (!player) {
      return {
        valid: false,
        errors: [{ code: 'PLAYER_NOT_FOUND', message: 'Player not found' }],
      };
    }

    if (player.completed) {
      return {
        valid: false,
        errors: [{ code: 'ALREADY_COMPLETED', message: 'You have already reached the target' }],
      };
    }

    const errors = await this.validateMove(player.currentWord, move.newWord, gameState.targetWord);
    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const insight = await this.buildWordInsight(move.newWord, gameState.targetWord);
    const warnings = this.buildWarnings(insight);
    const feedback = this.getColorFeedback(move.newWord, gameState.targetWord);
    const completed = move.newWord.toUpperCase() === gameState.targetWord.toUpperCase();

    const step: TransformationStep = {
      word: move.newWord.toUpperCase(),
      feedback,
      timestamp: new Date().toISOString(),
      branchLevel: insight.branchLevel,
      neighborCount: insight.neighborCount,
      distanceToTarget: insight.distanceToTarget,
    };

    player.currentWord = move.newWord.toUpperCase();
    player.path.push(step);
    player.transformationCount++;
    player.completed = completed;
    player.lastInsight = insight;
    gameState.insightByPlayer[move.userId] = insight;

    let winner = false;
    if (completed && !gameState.winner) {
      gameState.winner = move.userId;
      gameState.gameStatus = 'finished';
      winner = true;
      console.log(`🏆 ${player.username} won! Reached ${gameState.targetWord} in ${player.transformationCount} steps`);
    }

    if (!winner) {
      const playerIds = Object.keys(gameState.players);
      const currentIndex = playerIds.indexOf(gameState.currentPlayer);
      gameState.currentPlayer = playerIds[(currentIndex + 1) % playerIds.length];
    }

    gameState.turnCount++;

    if (gameState.turnCount >= MORPH_CONFIG.MAX_TURNS && !gameState.winner) {
      this.endGameByTurns(gameState);
    }

    return {
      valid: true,
      feedback,
      transformationCount: player.transformationCount,
      completed,
      winner,
      insight,
      warnings,
      hintBudget: this.getHintBudget(player),
      gameState: this.sanitizeGameState(gameState, move.userId),
    };
  }

  private async validateMove(currentWord: string, newWord: string, targetWord: string): Promise<MorphError[]> {
    const errors: MorphError[] = [];

    const current = currentWord.toUpperCase();
    const next = newWord.toUpperCase();

    if (next.length !== MORPH_CONFIG.WORD_LENGTH) {
      errors.push({
        code: 'INVALID_LENGTH',
        message: `Word must be exactly ${MORPH_CONFIG.WORD_LENGTH} letters`,
      });
      return errors;
    }

    let differences = 0;
    for (let i = 0; i < MORPH_CONFIG.WORD_LENGTH; i++) {
      if (current[i] !== next[i]) {
        differences++;
      }
    }

    if (differences !== 1) {
      errors.push({
        code: 'INVALID_TRANSFORMATION',
        message: `You must change exactly 1 letter (changed ${differences})`,
      });
      return errors;
    }

    try {
      const response = await axios.post<DictionaryValidateResponse>(`${DICTIONARY_SERVICE_URL}/validate`, {
        word: next.toLowerCase(),
      });

      if (!response.data.valid) {
        errors.push({
          code: 'INVALID_WORD',
          message: `"${next}" is not a valid word`,
        });
      }
    } catch (error) {
      console.error('Dictionary service error:', error);
      errors.push({
        code: 'DICTIONARY_ERROR',
        message: 'Could not validate word with dictionary',
      });
    }

    return errors;
  }

  private getColorFeedback(word: string, target: string): ColorFeedback[] {
    const wordUpper = word.toUpperCase();
    const targetUpper = target.toUpperCase();
    const result: ColorFeedback[] = Array(MORPH_CONFIG.WORD_LENGTH).fill('gray');
    const targetLetters = targetUpper.split('');

    for (let i = 0; i < MORPH_CONFIG.WORD_LENGTH; i++) {
      if (wordUpper[i] === targetUpper[i]) {
        result[i] = 'green';
        targetLetters[i] = '';
      }
    }

    for (let i = 0; i < MORPH_CONFIG.WORD_LENGTH; i++) {
      if (result[i] !== 'green') {
        const idx = targetLetters.indexOf(wordUpper[i]);
        if (idx !== -1) {
          result[i] = 'yellow';
          targetLetters[idx] = '';
        }
      }
    }

    return result;
  }

  private endGameByTurns(gameState: MorphGameState) {
    gameState.gameStatus = 'finished';

    let bestPlayer: string | null = null;
    let bestScore = -1;

    for (const [userId, player] of Object.entries(gameState.players)) {
      const lastFeedback = player.path[player.path.length - 1].feedback;
      const greenCount = lastFeedback.filter(c => c === 'green').length;

      if (greenCount > bestScore) {
        bestScore = greenCount;
        bestPlayer = userId;
      }
    }

    if (bestPlayer) {
      gameState.winner = bestPlayer;
    }

    console.log(`⏱️ Game ended by turn limit. Winner: ${bestPlayer || 'none'}`);
  }

  calculateScore(player: PlayerProgress, isWinner: boolean): number {
    let score = MORPH_CONFIG.POINTS_BASE;

    score -= player.transformationCount * MORPH_CONFIG.POINTS_PER_STEP_PENALTY;

    if (isWinner) {
      score += MORPH_CONFIG.FIRST_TO_FINISH_BONUS;
    }

    return Math.max(0, score);
  }

  getGameState(roomId: string): MorphGameState | undefined {
    return this.games.get(roomId);
  }

  private sanitizeGameState(gameState: MorphGameState, userId: string): MorphGameState {
    return { ...gameState };
  }

  async getHints(roomId: string, userId: string, limit = MORPH_CONFIG.HINTS_PER_REQUEST) {
    const gameState = this.games.get(roomId);

    if (!gameState) {
      throw new Error('Game not found');
    }

    const player = gameState.players[userId];

    if (!player) {
      throw new Error('Player not found');
    }

    if (player.hintsUsed >= MORPH_CONFIG.MAX_HINTS_PER_PLAYER) {
      return {
        suggestions: [] as HintSuggestion[],
        hintBudget: this.getHintBudget(player),
      };
    }

    const analysis = await this.fetchWordAnalysis(player.currentWord);
    const currentDistance = this.calculateDistance(player.currentWord, gameState.targetWord);

    if (!analysis.neighbors.length) {
      return {
        suggestions: [] as HintSuggestion[],
        hintBudget: this.getHintBudget(player),
      };
    }

    const neighborInsights = await Promise.all(
      analysis.neighbors.map(neighbor => this.buildWordInsight(neighbor, gameState.targetWord))
    );

    const prioritize = (level: BranchingLevel) => (level === 'high' ? 2 : level === 'medium' ? 1 : 0);

    const scored = neighborInsights
      .map(insight => {
        const distance = insight.distanceToTarget ?? currentDistance;
        const distanceDelta = currentDistance - distance;
        const category = this.categorizeHint(insight, distanceDelta);
        return {
          ...insight,
          category,
          distanceDelta,
        } as HintSuggestion;
      })
      .filter(item => item.distanceDelta >= 0 || item.branchLevel === 'high')
      .sort((a, b) => {
        if (b.distanceDelta !== a.distanceDelta) {
          return b.distanceDelta - a.distanceDelta;
        }
        return prioritize(b.branchLevel) - prioritize(a.branchLevel);
      })
      .slice(0, limit);

    player.hintsUsed = Math.min(player.hintsUsed + 1, MORPH_CONFIG.MAX_HINTS_PER_PLAYER);

    return {
      suggestions: scored,
      hintBudget: this.getHintBudget(player),
    };
  }

  private categorizeHint(insight: WordInsight, distanceDelta: number): HintSuggestion['category'] {
    if (distanceDelta > 0) {
      return 'distance';
    }
    if (insight.branchLevel === 'high') {
      return 'safe';
    }
    return 'structure';
  }

  private async buildWordInsight(word: string, targetWord: string): Promise<WordInsight> {
    const analysis = await this.fetchWordAnalysis(word);
    const distanceToTarget = this.calculateDistance(word, targetWord);

    return {
      word: analysis.word.toUpperCase(),
      neighborCount: analysis.neighborCount,
      branchLevel: analysis.branchLevel || this.categorizeBranchingFromDegree(analysis.neighborCount),
      neighborSample: analysis.neighbors.slice(0, MORPH_CONFIG.NEIGHBOR_SAMPLE),
      distanceToTarget,
    };
  }

  private async fetchWordAnalysis(word: string): Promise<DictionaryWordAnalysisResponse> {
    const normalized = word.toUpperCase();
    const cached = this.wordAnalysisCache.get(normalized);
    if (cached) {
      return cached;
    }

    try {
      const response = await axios.post<DictionaryWordAnalysisResponse>(
        `${DICTIONARY_SERVICE_URL}/analysis/word`,
        {
          word: normalized,
          neighborLimit: 40,
        }
      );

      const data = response.data;
      const result: DictionaryWordAnalysisResponse = {
        word: (data.word || normalized).toUpperCase(),
        valid: data.valid,
        neighborCount: data.neighborCount ?? data.neighbors?.length ?? 0,
        neighbors: (data.neighbors || []).map(n => n.toUpperCase()),
        branchLevel: data.branchLevel || this.categorizeBranchingFromDegree(data.neighborCount ?? 0),
      };

      this.wordAnalysisCache.set(normalized, result);
      return result;
    } catch (error) {
      console.error('Failed to fetch word analysis', error);
      return {
        word: normalized,
        valid: false,
        neighborCount: 0,
        neighbors: [],
        branchLevel: 'low',
      };
    }
  }

  private categorizeBranchingFromDegree(degree: number): BranchingLevel {
    if (degree >= MORPH_CONFIG.BRANCHING_THRESHOLDS.high) {
      return 'high';
    }
    if (degree <= MORPH_CONFIG.BRANCHING_THRESHOLDS.low) {
      return 'low';
    }
    return 'medium';
  }

  private calculateDistance(current: string, target: string): number {
    const currentUpper = current.toUpperCase();
    const targetUpper = target.toUpperCase();
    let differences = 0;

    for (let i = 0; i < MORPH_CONFIG.WORD_LENGTH; i++) {
      if (currentUpper[i] !== targetUpper[i]) {
        differences++;
      }
    }

    return differences;
  }

  private buildWarnings(insight: WordInsight): string[] {
    const warnings: string[] = [];

    if (insight.branchLevel === 'low') {
      warnings.push('This move leads to a near dead-end. Choose carefully.');
    } else if (insight.branchLevel === 'medium' && insight.neighborCount <= MORPH_CONFIG.BRANCHING_THRESHOLDS.low + 1) {
      warnings.push('Limited onward moves remain from this word.');
    }

    return warnings;
  }

  private getHintBudget(player: PlayerProgress): HintBudget {
    const remaining = Math.max(MORPH_CONFIG.MAX_HINTS_PER_PLAYER - player.hintsUsed, 0);
    return {
      used: player.hintsUsed,
      remaining,
      limit: MORPH_CONFIG.MAX_HINTS_PER_PLAYER,
    };
  }

  getStats() {
    return {
      activeGames: this.games.size,
    };
  }

  deleteGame(roomId: string): void {
    this.games.delete(roomId);
  }
}

export const morphService = new MorphService();
