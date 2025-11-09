import type { FormEvent } from 'react';
import type {
  ColorFeedback,
  MorphGameState,
  PlayerProgress,
  RoomSummary,
  HintSuggestion,
  HintBudget,
  WordInsight,
} from '../types';

import PlayerColumn from './ui/PlayerColumn';
import ColorDots from './ui/ColorDots';
import InsightChip from './ui/InsightChip';
import InsightSummary from './ui/InsightSummary';
import HintPanel from './HintPanel';

export default function GameScreen({
  room,
  gameState,
  myPlayer,
  opponent,
  isMyTurn,
  canSubmitMove,
  moveInput,
  onMoveInputChange,
  moveError,
  lastFeedback,
  onMakeMove,
  onRequestHint,
  hintOptions,
  hintBudget,
  latestInsight,
  moveWarnings,
}: {
  room: RoomSummary | null;
  gameState: MorphGameState | null;
  myPlayer: PlayerProgress | null;
  opponent: PlayerProgress | null;
  isMyTurn: boolean;
  canSubmitMove: boolean;
  moveInput: string;
  onMoveInputChange: (s: string) => void;
  moveError: string | null;
  lastFeedback: ColorFeedback[] | null;
  onMakeMove: (e: FormEvent) => void;
  onRequestHint: () => void;
  hintOptions: HintSuggestion[];
  hintBudget: HintBudget | null;
  latestInsight: WordInsight | null;
  moveWarnings: string[];
}) {
  return (
    <>
      <div className="challenge-bar">
        <div>
          <small>Start word</small>
          <strong>{gameState?.startWord}</strong>
          {gameState?.startWordMeta && <InsightChip insight={gameState.startWordMeta} />}
        </div>
        <div>
          <small>Target word</small>
          <strong>{gameState?.targetWord}</strong>
          {gameState?.targetWordMeta && <InsightChip insight={gameState.targetWordMeta} />}
        </div>
        <div>
          <small>Turn</small>
          <strong>
            {gameState ? gameState.turnCount + 1 : '—'} ·{' '}
            {isMyTurn ? 'Your move' : `${gameState ? gameState.players[gameState.currentPlayer]?.username ?? 'Opponent' : 'Opponent'}`}
          </strong>
        </div>
        <div>
          <small>Hints</small>
          <strong>{hintBudget ? `${hintBudget.remaining}/${hintBudget.limit}` : '—'}</strong>
        </div>
      </div>

      {(latestInsight || moveWarnings.length > 0) && (
        <div className="insight-panel">
          {latestInsight && (
            <div>
              <small>Current word health</small>
              <InsightSummary insight={latestInsight} />
            </div>
          )}
          {moveWarnings.length > 0 && (
            <div className="warning-banner">
              {moveWarnings.map(warning => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="players-grid">
        {myPlayer && <PlayerColumn player={myPlayer} label="You" highlight isMe />}
        {opponent && <PlayerColumn player={opponent} label={opponent.username} />}
      </div>

      <form className="move-form" onSubmit={onMakeMove}>
        <label>
          Enter your next morph
          <input
            value={moveInput}
            onChange={event => {
              const value = (event.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z]/g, '');
              if (value.length <= 5) onMoveInputChange(value);
            }}
            placeholder="PLATE"
            maxLength={5}
            disabled={!canSubmitMove}
          />
        </label>
        {moveError && <p className="error-text">{moveError}</p>}
        {lastFeedback && (
          <div className="feedback-row">
            <span>Last feedback</span>
            <ColorDots feedback={lastFeedback} />
          </div>
        )}
        <div className="move-actions">
          <button className="btn btn-primary" type="submit" disabled={!canSubmitMove}>
            {canSubmitMove ? 'Submit move' : 'Waiting for opponent'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onRequestHint} disabled={!room}>
            Smart hint {hintBudget ? `(${hintBudget.remaining}/${hintBudget.limit})` : ''}
          </button>
        </div>
      </form>

      {hintOptions.length > 0 && <HintPanel hints={hintOptions} budget={hintBudget} />}

      <div className="legend">
        <span>Legend:</span>
        <span className="legend-item">
          <span className="tile tile-green" /> Green = perfect match
        </span>
        <span className="legend-item">
          <span className="tile tile-yellow" /> Yellow = right letter, wrong spot
        </span>
        <span className="legend-item">
          <span className="tile tile-gray" /> Gray = not in target word
        </span>
      </div>
    </>
  );
}
