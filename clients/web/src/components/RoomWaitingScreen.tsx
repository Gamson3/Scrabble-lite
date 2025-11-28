import React, { useState, useEffect } from 'react';
import { Users, Copy, Check, Play, LogOut, Crown, Clock } from 'lucide-react';
import ScreenContainer from './ScreenContainer';
import type { RoomSummary } from '../types';

interface RoomWaitingScreenProps {
  room: RoomSummary;
  currentUserId: string;
  isHost: boolean;
  onStartGame?: () => void;
  onLeaveRoom: () => void;
  onCopyRoomCode: () => void;
  copied: boolean;
}

const RoomWaitingScreen: React.FC<RoomWaitingScreenProps> = ({
  room,
  currentUserId,
  isHost,
  onStartGame,
  onLeaveRoom,
  onCopyRoomCode,
  copied,
}) => {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const canStartGame = room.players.length === 2 && isHost;
  const waitingForPlayers = room.players.length < 2;

  // Auto-start countdown when host clicks start game
  useEffect(() => {
    if (!isStarting || countdown === null) return;
    
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setIsStarting(false);
          onStartGame?.();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isStarting, countdown, onStartGame]);

  const handleStartGameClick = () => {
    setIsStarting(true);
    setCountdown(3);
  };

  return (
    <ScreenContainer className="room-waiting-wrapper">
      {/* Header */}
      <div className="flex items-start justify-between mb-2 gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold mb-1 bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent truncate">
            {room.roomName}
          </h1>
          <p className="text-slate-400 text-sm md:text-base">Preparing for an epic word battle</p>
        </div>
        
        <button
          onClick={onLeaveRoom}
          className="shrink-0 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/50 hover:border-slate-600 text-slate-300 hover:text-white font-medium transition-all flex items-center gap-1.5 text-sm"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>

      {/* Status Banner */}
      <div className="relative mb-6">
        <div className="absolute -inset-0.5 bg-linear-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl blur opacity-20"></div>
        <div className="relative bg-linear-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-4 md:p-6 border border-slate-700/50 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
            {/* Icon */}
            <div className="shrink-0">
              <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center shadow-2xl ${
                waitingForPlayers 
                  ? 'bg-linear-to-br from-amber-600 to-orange-600 shadow-amber-500/30' 
                  : 'bg-linear-to-br from-emerald-600 to-teal-600 shadow-emerald-500/30'
              }`}>
                {waitingForPlayers ? (
                  <Clock className="w-8 h-8 md:w-10 md:h-10 animate-pulse" />
                ) : (
                  <Play className="w-8 h-8 md:w-10 md:h-10" />
                )}
              </div>
            </div>

            {/* Status Text */}
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-lg md:text-xl font-bold mb-1">
                {waitingForPlayers ? 'Waiting for Opponent...' : 'Ready to Start!'}
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                {waitingForPlayers 
                  ? 'Share the room ID with a friend or wait for someone to join. The game will start once both players are ready.'
                  : 'Both players are here! The host can now start the game and begin the epic word circle challenge.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Room Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Room ID */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-linear-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-30 transition"></div>
          <div className="relative bg-linear-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-xl p-4 border border-slate-700/50 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <Copy className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="text-xs md:text-sm font-semibold text-slate-400 uppercase tracking-wide">Room ID</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <code className="text-sm md:text-base font-mono font-bold text-white truncate">
                {room.roomId}
              </code>
              <button
                onClick={onCopyRoomCode}
                className="shrink-0 p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 hover:border-blue-500/50 transition-all"
                title="Copy room ID"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-blue-400" />
                )}
              </button>
            </div>

            {copied && (
              <p className="mt-2 text-xs text-emerald-400 animate-fade-in">
                ✓ Copied!
              </p>
            )}
          </div>
        </div>

        {/* Player Count */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-linear-to-r from-purple-600 to-indigo-600 rounded-xl blur opacity-20 group-hover:opacity-30 transition"></div>
          <div className="relative bg-linear-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-xl p-4 border border-slate-700/50 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-purple-600/20 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <span className="text-xs md:text-sm font-semibold text-slate-400 uppercase tracking-wide">Players</span>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-2xl md:text-3xl font-bold text-white">{room.players.length}</span>
              <span className="text-lg text-slate-400">/ 2</span>
            </div>

            <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-linear-to-r from-purple-600 to-indigo-600 transition-all duration-500"
                style={{ width: `${(room.players.length / 2) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="relative group sm:col-span-2 lg:col-span-1">
          <div className="absolute -inset-0.5 bg-linear-to-r from-indigo-600 to-blue-600 rounded-xl blur opacity-20 group-hover:opacity-30 transition"></div>
          <div className="relative bg-linear-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-xl p-4 border border-slate-700/50 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/20 flex items-center justify-center">
                <Play className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <span className="text-xs md:text-sm font-semibold text-slate-400 uppercase tracking-wide">Status</span>
            </div>

            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-sm ${
              room.status === 'waiting'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
              <span className="capitalize">{room.status}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Players List */}
      <div className="relative mb-6">
        <div className="absolute -inset-0.5 bg-linear-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-10"></div>
        <div className="relative bg-linear-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-4 md:p-5 border border-slate-700/50 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-lg md:text-xl font-bold">Players in Room</h3>
          </div>

          <div className="space-y-2">
            {room.players.map((player) => (
              <div
                key={player.userId}
                className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:bg-slate-800/80 hover:border-slate-600 transition-all"
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  player.userId === room.host
                    ? 'bg-linear-to-br from-amber-600 to-orange-600 shadow-lg shadow-amber-500/20'
                    : 'bg-linear-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/20'
                }`}>
                  {player.userId === room.host ? (
                    <Crown className="w-5 h-5" />
                  ) : (
                    <Users className="w-5 h-5" />
                  )}
                </div>

                {/* Player Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base truncate">{player.username}</span>
                    {player.userId === currentUserId && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold border border-blue-500/30 whitespace-nowrap">
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-xs md:text-sm text-slate-400">
                    {player.userId === room.host ? '👑 Room Host' : '🎮 Player'}
                  </p>
                </div>

                {/* Status */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span className="text-xs font-semibold text-emerald-400">Ready</span>
                </div>
              </div>
            ))}

            {/* Empty slot */}
            {room.players.length < 2 && (
              <div className="flex items-center gap-3 p-3 bg-slate-800/30 border-2 border-dashed border-slate-700/50 rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-slate-800/50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-sm text-slate-500">Waiting for player...</span>
                  <p className="text-xs text-slate-600">Empty slot</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {canStartGame && (
          <button
            onClick={handleStartGameClick}
            disabled={isStarting}
            className="w-full py-3 px-4 md:py-4 md:px-6 bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-500 disabled:from-slate-600 disabled:via-slate-600 disabled:to-slate-600 text-white font-bold text-sm md:text-base rounded-xl md:rounded-2xl shadow-2xl shadow-emerald-500/30 hover:shadow-3xl hover:shadow-emerald-500/40 disabled:shadow-none transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:scale-100"
          >
            <span className="flex items-center justify-center gap-2">
              <Play className="w-5 h-5" />
              Start Game
              <Play className="w-5 h-5" />
            </span>
          </button>
        )}

        {!canStartGame && waitingForPlayers && (
          <div className="text-center p-4 md:p-5 bg-slate-800/50 border border-slate-700/50 rounded-xl">
            <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2 animate-pulse" />
            <p className="text-slate-400 text-sm">
              {isHost 
                ? '⏳ Waiting for an opponent to join. Share the room ID above!'
                : '⏳ Waiting for the host to start the game...'}
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </ScreenContainer>
  );
};

export default RoomWaitingScreen;
