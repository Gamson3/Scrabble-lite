import React from 'react';
import { Trophy, X } from 'lucide-react';

export interface GameResultsModalProps {
  winner: string;
  winnerName: string;
  playerName: string;
  playerScore: number;
  opponentName: string;
  opponentScore: number;
  roundsWon: number;
  totalRounds: number;
  isCurrentPlayerWinner: boolean;
  isDraw?: boolean;
  onPlayAgain?: () => void;
  onBackToLobby: () => void;
  onClose: () => void;
  isAwaitingResponse?: boolean;
  rematchStatus?: 'requesting' | 'accepted' | 'declined' | null;
}

const GameResultsModal: React.FC<GameResultsModalProps> = ({
  winner,
  winnerName,
  playerName,
  playerScore,
  opponentName,
  opponentScore,
  roundsWon,
  totalRounds,
  isCurrentPlayerWinner,
  isDraw = false,
  onBackToLobby,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
      <div className="relative bg-linear-to-br from-slate-50 to-slate-100 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 border border-slate-200 animate-fadeInScale">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-slate-200 rounded-lg transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5 text-slate-600" />
        </button>

        {/* Winner Section */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className={`p-4 rounded-full ${
                isDraw ? 'bg-amber-100' : isCurrentPlayerWinner ? 'bg-emerald-100' : 'bg-slate-200'
              }`}>
              <Trophy
                className={`w-12 h-12 ${
                  isDraw ? 'text-amber-600' : isCurrentPlayerWinner ? 'text-emerald-600' : 'text-slate-500'
                }`}
              />
            </div>
          </div>
          <h2 className={`text-3xl font-bold mb-2 ${
            isDraw ? 'text-amber-700' : isCurrentPlayerWinner ? 'text-emerald-700' : 'text-slate-700'
          }`}>
            {isDraw ? '🤝 It\'s a Draw!' : isCurrentPlayerWinner ? '🎉 You Won!' : 'Game Over'}
          </h2>
          <p className="text-base text-slate-600">
            {isDraw ? (
              <span>Both players tied with equal scores!</span>
            ) : (
              <>
                <span className="font-semibold text-slate-800">{winnerName}</span> wins the match!
              </>
            )}
          </p>
        </div>

        {/* Score Comparison */}
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm border border-slate-200">
          <div className="grid grid-cols-2 gap-4">
            {/* Player Score */}
            <div className={`text-center p-4 rounded-lg ${
              isCurrentPlayerWinner ? 'bg-emerald-50 border-2 border-emerald-300' : 'bg-slate-50 border border-slate-200'
            }`}>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Your Score</p>
              <p className={`text-3xl font-bold ${isCurrentPlayerWinner ? 'text-emerald-600' : 'text-slate-700'}`}>
                {playerScore}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-medium">{playerName}</p>
            </div>

            {/* Opponent Score */}
            <div className={`text-center p-4 rounded-lg ${
              !isCurrentPlayerWinner && !isDraw ? 'bg-rose-50 border-2 border-rose-300' : 'bg-slate-50 border border-slate-200'
            }`}>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Opponent</p>
              <p className={`text-3xl font-bold ${
                !isCurrentPlayerWinner && !isDraw ? 'text-rose-600' : 'text-slate-700'
              }`}>
                {opponentScore}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-medium">{opponentName}</p>
            </div>
          </div>

          {/* Rounds Summary */}
          <div className="mt-5 pt-5 border-t border-slate-200 text-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {isDraw ? 'Final Score' : 'Rounds Won'}
            </p>
            <p className="text-2xl font-bold text-slate-800">
              {isDraw ? `${playerScore} - ${opponentScore}` : `${roundsWon} / ${totalRounds}`}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={onBackToLobby}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-md hover:shadow-lg"
          >
            Return to Lobby
          </button>
          <button
            onClick={onClose}
            className="w-full bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-500 font-semibold py-3 px-4 rounded-lg transition-all"
          >
            Stay in Room
          </button>
        </div>

        {/* Stats Footer */}
        <div className="mt-5 pt-5 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-500">
            Game ID: <span className="font-mono text-slate-700 font-semibold">{winner.slice(0, 8)}</span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fadeInScale {
          animation: fadeInScale 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default GameResultsModal;
