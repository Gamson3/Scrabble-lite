import wordsData from '../data/words.json';

export type BranchingLevel = 'high' | 'medium' | 'low';

export interface WordAnalysis {
  word: string;
  neighbors: string[];
  neighborCount: number;
  branchLevel: BranchingLevel;
  valid: boolean;
}

class DictionaryService {
  private words: Set<string>;
  private wordList: string[];
  private fiveLetterWords: string[];
  private cache: Map<string, boolean> = new Map();
  private adjacency: Map<string, string[]> = new Map();
  private analysisCache: Map<string, WordAnalysis> = new Map();

  private readonly BRANCHING_THRESHOLDS = {
    high: 12,
    low: 4,
  };

  constructor() {
    this.wordList = wordsData.words.map(w => w.toLowerCase());
    this.words = new Set(this.wordList);
    this.fiveLetterWords = this.wordList
      .map(word => word.toUpperCase())
      .filter(word => word.length === 5);

    this.buildWordGraph();

    console.log(`📖 Dictionary loaded: ${this.words.size} words (${this.fiveLetterWords.length} morphable)`);
  }

  private buildWordGraph() {
    const wildcardBuckets: Map<string, string[]> = new Map();

    for (const word of this.fiveLetterWords) {
      for (let i = 0; i < word.length; i++) {
        const pattern = word.slice(0, i) + '*' + word.slice(i + 1);
        if (!wildcardBuckets.has(pattern)) {
          wildcardBuckets.set(pattern, []);
        }
        wildcardBuckets.get(pattern)!.push(word);
      }
    }

    for (const word of this.fiveLetterWords) {
      const neighbors = new Set<string>();

      for (let i = 0; i < word.length; i++) {
        const pattern = word.slice(0, i) + '*' + word.slice(i + 1);
        const bucket = wildcardBuckets.get(pattern);
        if (!bucket) continue;

        for (const candidate of bucket) {
          if (candidate !== word) {
            neighbors.add(candidate);
          }
        }
      }

      this.adjacency.set(word, Array.from(neighbors));
    }

    console.log(`🌐 Morph graph built: ${this.adjacency.size} nodes`);
  }

  /**
   * Check if a word is valid
   */
  isValidWord(word: string): boolean {
    if (!word || typeof word !== 'string') return false;

    const normalized = word.toLowerCase().trim();
    
    // Check cache first
    if (this.cache.has(normalized)) {
      return this.cache.get(normalized)!;
    }

    // Check dictionary
    const isValid = this.words.has(normalized);
    
    // Cache result
    this.cache.set(normalized, isValid);
    
    return isValid;
  }

  /**
   * Validate multiple words
   */
  validateWords(words: string[]): { word: string; valid: boolean }[] {
    return words.map(word => ({
      word: word,
      valid: this.isValidWord(word),
    }));
  }

  /**
   * Get suggestions for invalid words (simple Levenshtein distance)
   */
  getSuggestions(word: string, maxSuggestions: number = 3): string[] {
    const normalized = word.toLowerCase().trim();
    const suggestions: { word: string; distance: number }[] = [];

    // Only suggest for words of similar length
    const minLength = Math.max(2, normalized.length - 2);
    const maxLength = normalized.length + 2;

    for (const dictWord of this.wordList) {
      if (dictWord.length >= minLength && dictWord.length <= maxLength) {
        const distance = this.levenshteinDistance(normalized, dictWord);
        if (distance <= 2 && distance > 0) {
          suggestions.push({ word: dictWord, distance });
        }
      }
    }

    // Sort by distance and return top suggestions
    return suggestions
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxSuggestions)
      .map(s => s.word);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Get all words (for debugging)
   */
  getAllWords(): string[] {
    return this.wordList;
  }

  /**
   * Get dictionary stats
   */
  getStats() {
    return {
      totalWords: this.words.size,
      cacheSize: this.cache.size,
      graphNodes: this.adjacency.size,
    };
  }

  getNeighbors(word: string): string[] {
    return this.adjacency.get(word.toUpperCase()) ?? [];
  }

  getDegree(word: string): number {
    return this.getNeighbors(word).length;
  }

  getBranchingLevelFromDegree(degree: number): BranchingLevel {
    if (degree >= this.BRANCHING_THRESHOLDS.high) {
      return 'high';
    }
    if (degree <= this.BRANCHING_THRESHOLDS.low) {
      return 'low';
    }
    return 'medium';
  }

  getBranchingLevel(word: string): BranchingLevel {
    return this.getBranchingLevelFromDegree(this.getDegree(word));
  }

  getWordAnalysis(word: string, neighborLimit = 20): WordAnalysis {
    const normalized = word.toUpperCase();

    if (!normalized || normalized.length !== 5) {
      return {
        word: normalized,
        neighbors: [],
        neighborCount: 0,
        branchLevel: 'low',
        valid: false,
      };
    }

    const cached = this.analysisCache.get(normalized);
    if (cached) {
      return {
        ...cached,
        neighbors: cached.neighbors.slice(0, neighborLimit),
      };
    }

    const neighbors = this.getNeighbors(normalized);
    const analysis: WordAnalysis = {
      word: normalized,
      neighbors,
      neighborCount: neighbors.length,
      branchLevel: this.getBranchingLevelFromDegree(neighbors.length),
      valid: this.words.has(normalized.toLowerCase()),
    };

    this.analysisCache.set(normalized, analysis);

    return {
      ...analysis,
      neighbors: neighbors.slice(0, neighborLimit),
    };
  }

  getRandomWord(minDegree = 0): string | null {
    const eligible = this.fiveLetterWords.filter(word => this.getDegree(word) >= minDegree);
    const pool = eligible.length > 0 ? eligible : this.fiveLetterWords;

    if (pool.length === 0) {
      return null;
    }

    return pool[Math.floor(Math.random() * pool.length)];
  }
}

// Singleton instance
export const dictionaryService = new DictionaryService();