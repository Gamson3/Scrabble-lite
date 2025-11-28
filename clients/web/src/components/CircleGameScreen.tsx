import React, { useState, useEffect, useRef } from 'react';
import { Clock, Trophy, Zap, Send, AlertCircle } from 'lucide-react';
import GameResultsModal from './GameResultsModal';
import ScreenContainer from './ScreenContainer';
import './CircleGameScreen.css';

export interface CircleGameScreenProps {
  gameState: {
    roomId: string;
    roundNumber: number;
    totalRounds: number;
    currentRound: {
      circleLetters: string[];
      playerWords: Record<string, Array<{ word: string; score: number }>>;
    };
    players: Record<
      string,
      {
        userId: string;
        username: string;
        totalScore: number;
        roundsWon: number;
        currentRoundWords: Array<{ word: string; score: number }>;
      }
    >;
    playerIds: string[];
    isGameActive: boolean;
  };
  userId: string;
  onSubmitWord: (word: string) => void;
  onEndRound: () => void;
  onRequestRematch?: () => void;
  onBackToLobby?: () => void;
  isSubmitting: boolean;
  wordConfirmation?: { word: string; isValid: boolean; score: number; message: string } | null;
}

const CircleGameScreen: React.FC<CircleGameScreenProps> = ({
  gameState,
  userId,
  onSubmitWord,
  onEndRound,
  onRequestRematch,
  onBackToLobby,
  isSubmitting,
  wordConfirmation,
}) => {
  const [word, setWord] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [rematchStatus, setRematchStatus] = useState<'requesting' | 'accepted' | 'declined' | null>(null);
  const [isAwaitingRematchResponse, setIsAwaitingRematchResponse] = useState(false);
  const [roundCountdown, setRoundCountdown] = useState<number | null>(null);
  const [isRoundTransitioning, setIsRoundTransitioning] = useState(false);
  const [wordError, setWordError] = useState<string | null>(null);
  const [showGameCountdown, setShowGameCountdown] = useState(false);
  const [gameCountdown, setGameCountdown] = useState<number | null>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);
  const gameStartedRef = useRef(false);

  const currentPlayer = gameState.players[userId];
  const opponentId = gameState.playerIds.find((id) => id !== userId);
  const opponent = opponentId ? gameState.players[opponentId] : null;

  const playerWords = gameState.currentRound.playerWords[userId] || [];
  const opponentWords = opponentId ? gameState.currentRound.playerWords[opponentId] || [] : [];

  const playerRoundScore = playerWords.reduce((sum, w) => sum + w.score, 0);
  const opponentRoundScore = opponentWords.reduce((sum, w) => sum + w.score, 0);

  // Keep focus on input during game
  useEffect(() => {
    if (gameState.isGameActive && wordInputRef.current) {
      // Focus immediately when game becomes active
      wordInputRef.current.focus();
      
      // Set up interval to check focus every 100ms
      const interval = setInterval(() => {
        if (wordInputRef.current && document.activeElement !== wordInputRef.current) {
          wordInputRef.current.focus();
        }
      }, 100);
      
      return () => clearInterval(interval);
    }
  }, [gameState.isGameActive, word]);

  // Handle word confirmation (validation response from server)
  useEffect(() => {
    if (wordConfirmation) {
      if (!wordConfirmation.isValid) {
        setWordError(wordConfirmation.message || 'Word not valid');
        // Keep the word in the input so user can edit it
        // Auto-clear error after 3 seconds
        const timer = setTimeout(() => {
          setWordError(null);
        }, 3000);
        return () => clearTimeout(timer);
      } else {
        // Word was valid - clear the input and error
        setWord('');
        setWordError(null);
        // Refocus the input after clearing
        setTimeout(() => wordInputRef.current?.focus(), 0);
      }
    }
  }, [wordConfirmation]);

  // Timer countdown
  useEffect(() => {
    if (!gameState.isGameActive) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Only HOST (first player) should end the round to prevent double calls
          const isHost = gameState.playerIds[0] === userId;
          if (isHost) {
            onEndRound();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.isGameActive, gameState.playerIds, userId, onEndRound]);

  // Reset timer when round changes
  useEffect(() => {
    setTimeRemaining(60);
    setWordError(null);
    setWord('');
  }, [gameState.roundNumber]);

  // Trigger countdown when round ends (roundNumber advances)
  useEffect(() => {
    if (!gameState.isGameActive && gameState.roundNumber < gameState.totalRounds && !isRoundTransitioning) {
      setIsRoundTransitioning(true);
      setRoundCountdown(3);
    }
  }, [gameState.roundNumber, gameState.isGameActive, gameState.totalRounds, isRoundTransitioning]);

  // Show results modal when game ends
  useEffect(() => {
    if (gameState.roundNumber === gameState.totalRounds && !gameState.isGameActive) {
      setShowResultsModal(true);
    }
  }, [gameState.roundNumber, gameState.totalRounds, gameState.isGameActive]);

  // Game start countdown (triggered once when game first becomes active)
  useEffect(() => {
    // Only show countdown once when game first becomes active (round 1)
    if (gameState.roundNumber === 1 && gameState.isGameActive && !gameStartedRef.current) {
      gameStartedRef.current = true;
      setShowGameCountdown(true);
      setGameCountdown(3);
    }
  }, [gameState.roundNumber, gameState.isGameActive]);

  // Game countdown timer
  useEffect(() => {
    if (!showGameCountdown || gameCountdown === null || gameCountdown <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setGameCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setShowGameCountdown(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGameCountdown]);

  // Between-round countdown
  useEffect(() => {
    if (isRoundTransitioning && roundCountdown !== null) {
      const interval = setInterval(() => {
        setRoundCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            setIsRoundTransitioning(false);
            setRoundCountdown(null);
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isRoundTransitioning, roundCountdown]);

  // Calculate letter positions in circle
  const angleStep = 360 / gameState.currentRound.circleLetters.length;
  const radius = 140;

  const getTimerColor = () => {
    if (timeRemaining < 10) return 'from-red-500 to-rose-600';
    if (timeRemaining < 30) return 'from-amber-500 to-orange-600';
    return 'from-emerald-500 to-teal-600';
  };

  const getProgressWidth = () => {
    return (timeRemaining / 60) * 100;
  };

  const handleSubmit = () => {
    if (!word.trim()) return;
    setWordError(null);
    onSubmitWord(word);
    // Don't clear the word here - let the server response guide clearing
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && word.trim() && gameState.isGameActive) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Determine winner
  const determineWinner = () => {
    if (!currentPlayer || !opponent) {
      return {
        winnerId: userId,
        winnerName: currentPlayer?.username || 'Player',
        isCurrentPlayerWinner: true,
        isDraw: false,
      };
    }

    // Check for draw
    if (currentPlayer.totalScore === opponent.totalScore) {
      return {
        winnerId: userId,
        winnerName: 'Draw',
        isCurrentPlayerWinner: false,
        isDraw: true,
      };
    }

    const isCurrentPlayerWinner = currentPlayer.totalScore > opponent.totalScore;
    return {
      winnerId: isCurrentPlayerWinner ? userId : (opponentId || ''),
      winnerName: isCurrentPlayerWinner ? currentPlayer.username : opponent.username,
      isCurrentPlayerWinner,
      isDraw: false,
    };
  };

  const handlePlayAgain = () => {
    setRematchStatus('requesting');
    setIsAwaitingRematchResponse(true);
    onRequestRematch?.();
  };

  const handleBackToLobby = () => {
    setShowResultsModal(false);
    setRematchStatus(null);
    setIsAwaitingRematchResponse(false);
    onBackToLobby?.();
  };

  const handleCloseModal = () => {
    setShowResultsModal(false);
    setRematchStatus(null);
    setIsAwaitingRematchResponse(false);
  };

  const handleQuitGame = () => {
    if (confirm('Are you sure you want to quit the game? This will end the game for both players.')) {
      onBackToLobby?.();
    }
  };

  return (
    <ScreenContainer className="circle-game-wrapper">
      {/* Header */}
      <div className="mb-2">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-1">
              Word Rush ⚡
            </h1>
            <p className="text-sm text-slate-400">Form words, score points, win rounds!</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="px-5 py-2.5 rounded-full bg-linear-to-r from-blue-600 to-purple-600 font-semibold text-sm shadow-lg">
              Round {gameState.roundNumber}/{gameState.totalRounds}
            </div>
          </div>
        </div>

        {/* Score Overview Bar */}
        <div className="relative">
          <div className="absolute -inset-0.5 bg-linear-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-20"></div>
          <div className="relative bg-linear-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-4 border border-slate-700/50 shadow-xl">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Your Total</p>
                <p className="text-2xl font-bold text-blue-400">{currentPlayer?.totalScore || 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Rounds Won</p>
                <p className="text-2xl font-bold text-purple-400">
                  {currentPlayer?.roundsWon || 0} - {opponent?.roundsWon || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Opponent Total</p>
                <p className="text-2xl font-bold text-orange-400">{opponent?.totalScore || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-2 md:gap-3">
        {/* Your Panel */}
        <div className="relative order-2 lg:order-1">
          <div className="absolute -inset-0.5 bg-linear-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-20"></div>
          <div className="relative bg-linear-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-5 border border-blue-500/30 shadow-xl h-full">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-700/50">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
                <Trophy className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">{currentPlayer?.username || 'You'}</h3>
                <p className="text-xs text-slate-400">Your Performance</p>
              </div>
            </div>

            <div className="relative mb-5">
              <div className="absolute inset-0 bg-linear-to-r from-blue-500/10 to-purple-500/10 rounded-xl blur-xl"></div>
              <div className="relative bg-linear-to-br from-blue-600/20 to-purple-600/20 rounded-xl p-4 border border-blue-400/30 text-center">
                <div className="text-4xl font-bold bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-1">
                  {playerRoundScore}
                </div>
                <div className="text-xs text-slate-300 uppercase tracking-wider">Round Score</div>
              </div>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 sticky top-0 bg-slate-900/80 py-2">
                Your Words ({playerWords.length})
              </h4>
              {playerWords.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Submit your first word!
                </div>
              ) : (
                playerWords.map((wordData, idx) => (
                  <div
                    key={idx}
                    className="bg-linear-to-r from-blue-600/20 to-purple-600/20 rounded-lg p-3 border border-blue-500/30 hover:border-blue-400/50 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-base group-hover:text-blue-300 transition-colors">
                        {wordData.word}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-sm border border-emerald-500/30">
                        +{wordData.score}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center - Circle & Controls */}
        <div className="space-y-4 order-1 lg:order-2">
          {/* Circle */}
          <div className="relative">
            <div className="absolute -inset-0.5 bg-linear-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-3xl blur opacity-20"></div>
            <div className="relative bg-linear-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-slate-700/50 shadow-2xl">
              <div className="relative w-full max-w-md mx-auto aspect-square">
                {/* Background effects */}
                <div className="absolute inset-0 bg-linear-to-r from-blue-500/5 to-purple-500/5 rounded-full blur-3xl"></div>
                
                {/* SVG Circle guides */}
                <div className="relative w-full h-full">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400">
                    <defs>
                      <linearGradient id="circleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
                      </linearGradient>
                    </defs>
                    <circle cx="200" cy="200" r="180" fill="none" stroke="url(#circleGrad)" strokeWidth="2" />
                    <circle cx="200" cy="200" r="150" fill="none" stroke="rgba(59,130,246,0.2)" strokeWidth="1" strokeDasharray="4 4" />
                    <circle cx="200" cy="200" r="20" fill="rgba(59,130,246,0.3)" />
                  </svg>

                  {/* Letters */}
                  {gameState.currentRound.circleLetters.map((letter, idx) => {
                    const angle = angleStep * idx - 90;
                    const radian = (angle * Math.PI) / 180;
                    const x = 200 + Math.cos(radian) * radius;
                    const y = 200 + Math.sin(radian) * radius;

                    return (
                      <div
                        key={idx}
                        className="absolute w-14 h-14 md:w-16 md:h-16 -ml-7 -mt-7 md:-ml-8 md:-mt-8 cursor-default group"
                        style={{ left: `${(x / 400) * 100}%`, top: `${(y / 400) * 100}%` }}
                      >
                        <div className="relative w-full h-full">
                          <div className="absolute inset-0 bg-linear-to-br from-blue-500 to-purple-600 rounded-2xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity"></div>
                          <div className="relative w-full h-full bg-linear-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center border-2 border-white/20 shadow-xl group-hover:scale-110 group-hover:border-white/40 transition-all">
                            <span className="text-xl md:text-2xl font-bold">{letter}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Timer */}
          <div className="relative">
            <div className="absolute -inset-0.5 bg-linear-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-20"></div>
            <div className="relative bg-linear-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-5 border border-slate-700/50 shadow-xl">
              <div className="flex items-center justify-center gap-3 mb-3">
                <Clock className="w-5 h-5 text-blue-400" />
                <span className={`text-5xl font-bold font-mono bg-linear-to-r ${getTimerColor()} bg-clip-text text-transparent`}>
                  {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="relative h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 bg-linear-to-r ${getTimerColor()} rounded-full transition-all duration-1000 ease-linear`}
                  style={{ width: `${getProgressWidth()}%` }}
                ></div>
              </div>
              <button
                onClick={handleQuitGame}
                className="mt-4 w-full px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 hover:border-red-500/70 text-red-400 hover:text-red-300 font-semibold text-sm transition-all"
              >
                Quit Game
              </button>
            </div>
          </div>

          {/* Word Input */}
          <div className="relative">
            <div className="absolute -inset-0.5 bg-linear-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-20"></div>
            <div className="relative bg-linear-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-5 border border-slate-700/50 shadow-xl">
              <div className="flex gap-3">
                <input
                  ref={wordInputRef}
                  type="text"
                  value={word}
                  onChange={(e) => setWord(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  placeholder="TYPE YOUR WORD..."
                  className="flex-1 bg-slate-900/80 border-2 border-blue-500/30 rounded-xl px-4 py-3 md:py-4 text-base md:text-lg font-mono font-bold uppercase focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-slate-600 transition-all"
                  disabled={!gameState.isGameActive || isSubmitting}
                  maxLength={15}
                />
                <button
                  onClick={handleSubmit}
                  disabled={!gameState.isGameActive || !word.trim() || isSubmitting}
                  className="px-5 md:px-8 py-3 md:py-4 rounded-xl bg-linear-to-r from-blue-600 to-purple-600 font-bold text-sm md:text-base shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all flex items-center gap-2"
                >
                  <Send className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="hidden md:inline">Submit</span>
                </button>
              </div>
              
              {/* Word Error Display */}
              {wordError && (
                <div className="mt-3 p-3 bg-red-600/20 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium">{wordError}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Opponent Panel */}
        {opponent && (
          <div className="relative order-3">
            <div className="absolute -inset-0.5 bg-linear-to-r from-orange-600 to-rose-600 rounded-2xl blur opacity-20"></div>
            <div className="relative bg-linear-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-5 border border-orange-500/30 shadow-xl h-full">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-700/50">
                <div className="w-12 h-12 rounded-xl bg-linear-to-br from-orange-600 to-rose-600 flex items-center justify-center shadow-lg">
                  <Zap className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{opponent.username}</h3>
                  <p className="text-xs text-slate-400">Opponent</p>
                </div>
              </div>

              <div className="relative mb-5">
                <div className="absolute inset-0 bg-linear-to-r from-orange-500/10 to-rose-500/10 rounded-xl blur-xl"></div>
                <div className="relative bg-linear-to-br from-orange-600/20 to-rose-600/20 rounded-xl p-4 border border-orange-400/30 text-center">
                  <div className="text-4xl font-bold bg-linear-to-r from-orange-400 to-rose-400 bg-clip-text text-transparent mb-1">
                    {opponentRoundScore}
                  </div>
                  <div className="text-xs text-slate-300 uppercase tracking-wider">Round Score</div>
                </div>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 sticky top-0 bg-slate-900/80 py-2">
                  Their Words ({opponentWords.length})
                </h4>
                {opponentWords.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50 animate-pulse" />
                    Waiting...
                  </div>
                ) : (
                  opponentWords.map((wordData, idx) => (
                    <div
                      key={idx}
                      className="bg-linear-to-r from-orange-600/20 to-rose-600/20 rounded-lg p-3 border border-orange-500/30 hover:border-orange-400/50 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-base group-hover:text-orange-300 transition-colors">
                          {wordData.word}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-sm border border-emerald-500/30">
                          +{wordData.score}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Game Results Modal */}
      {showResultsModal && currentPlayer && opponent && (() => {
        const winner = determineWinner();
        return (
          <GameResultsModal
            winner={winner.winnerId}
            winnerName={winner.winnerName}
            playerName={currentPlayer.username}
            playerScore={currentPlayer.totalScore}
            opponentName={opponent.username}
            opponentScore={opponent.totalScore}
            roundsWon={currentPlayer.roundsWon}
            totalRounds={gameState.totalRounds}
            isCurrentPlayerWinner={winner.isCurrentPlayerWinner}
            isDraw={winner.isDraw}
            onPlayAgain={handlePlayAgain}
            onBackToLobby={handleBackToLobby}
            onClose={handleCloseModal}
            isAwaitingResponse={isAwaitingRematchResponse}
            rematchStatus={rematchStatus}
          />
        );
      })()}

      {/* Game Start Countdown Overlay */}
      {showGameCountdown && gameCountdown !== null && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">Game starts in</h2>
            <div className="text-8xl md:text-9xl font-bold bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent animate-bounce">
              {gameCountdown}
            </div>
            <p className="text-slate-300 text-lg mt-6">Get ready!</p>
          </div>
        </div>
      )}

      {/* Between-Round Countdown Overlay */}
      {isRoundTransitioning && roundCountdown !== null && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-40">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">Round {gameState.roundNumber + 1} starts in</h2>
            <div className="text-8xl md:text-9xl font-bold bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent animate-bounce">
              {roundCountdown}
            </div>
            <p className="text-slate-300 text-lg mt-6">Get ready to form words!</p>
          </div>
        </div>
      )}
    </ScreenContainer>
  );
};

export default CircleGameScreen;
