import express, { Request, Response, Router } from 'express';
import { dictionaryService } from '../services/dictionaryService';

const router: Router = express.Router();

/**
 * POST /validate
 * Validate a single word
 */
router.post('/validate', (req: Request, res: Response) => {
  try {
    const { word } = req.body;

    if (!word) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_WORD',
          message: 'Word is required',
        },
      });
    }

    const isValid = dictionaryService.isValidWord(word);
    const response: any = {
      word: word,
      valid: isValid,
    };

    // Add suggestions if word is invalid
    if (!isValid) {
      response.suggestions = dictionaryService.getSuggestions(word);
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('[Validate Error]', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to validate word',
      },
    });
  }
});

/**
 * POST /validate/batch
 * Validate multiple words
 */
router.post('/validate/batch', (req: Request, res: Response) => {
  try {
    const { words } = req.body;

    if (!words || !Array.isArray(words)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Words array is required',
        },
      });
    }

    const results = dictionaryService.validateWords(words);

    res.status(200).json({
      results: results,
      allValid: results.every(r => r.valid),
    });
  } catch (error) {
    console.error('[Batch Validate Error]', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to validate words',
      },
    });
  }
});

/**
 * GET /words
 * Get all words (debug endpoint)
 */
router.get('/words', (req: Request, res: Response) => {
  try {
    const words = dictionaryService.getAllWords();
    res.status(200).json({
      words: words,
      total: words.length,
    });
  } catch (error) {
    console.error('[Get Words Error]', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get words',
      },
    });
  }
});

router.get('/words/random', (req: Request, res: Response) => {
  try {
    const minDegreeParam = req.query.minDegree as string | undefined;
    const minDegree = minDegreeParam ? parseInt(minDegreeParam, 10) : 0;

    const word = dictionaryService.getRandomWord(Number.isNaN(minDegree) ? 0 : minDegree);

    if (!word) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'NO_WORD_AVAILABLE',
          message: 'Unable to select a random word',
        },
      });
    }

    res.status(200).json({
      word,
      degree: dictionaryService.getDegree(word),
      branchLevel: dictionaryService.getBranchingLevel(word),
    });
  } catch (error) {
    console.error('[Random Word Error]', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get random word',
      },
    });
  }
});

router.post('/analysis/word', (req: Request, res: Response) => {
  try {
    const { word, neighborLimit } = req.body;

    if (!word) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_WORD',
          message: 'Word is required',
        },
      });
    }

    const analysis = dictionaryService.getWordAnalysis(word, neighborLimit ?? 20);

    res.status(200).json({
      word: analysis.word,
      valid: analysis.valid,
      neighborCount: analysis.neighborCount,
      neighbors: analysis.neighbors,
      branchLevel: analysis.branchLevel,
    });
  } catch (error) {
    console.error('[Word Analysis Error]', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to analyze word',
      },
    });
  }
});

/**
 * GET /health
 * Enhanced health check with stats
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const stats = dictionaryService.getStats();
    res.status(200).json({
      status: 'ok',
      service: 'dictionary-service',
      wordCount: stats.totalWords,
      cacheSize: stats.cacheSize,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      service: 'dictionary-service',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;