import type { PlayerProgress } from '../../types';
import { formatDistance } from './formatDistance';

export default function PlayerColumn({
  player,
  label,
  highlight,
  isMe,
}: {
  player: PlayerProgress;
  label: string;
  highlight?: boolean;
  isMe?: boolean;
}) {
  const recentPath = player.path.slice(-8);
  const insight = player.lastInsight;
  return (
    <div className={`player-column ${highlight ? 'player-highlight' : ''}`}>
      <div className="player-column-header">
        <div>
          <small>{label}</small>
          <strong>{player.currentWord}</strong>
        </div>
        <div className="player-stats">
          <span>{player.transformationCount} steps</span>
          {player.completed && <span className="badge">finished</span>}
          {!player.completed && !isMe && <span className="badge badge-dark">in progress</span>}
        </div>
      </div>
      {insight && (
        <div className="player-insight">
          <span className={`chip insight-${insight.branchLevel}`}>{insight.branchLevel}</span>
          <span>{insight.neighborCount} exits</span>
          <span>{formatDistance(insight.distanceToTarget)}</span>
        </div>
      )}
      <div className="word-grid">
        {recentPath.map(step => (
          <div className="word-row" key={`${step.timestamp}-${step.word}`}>
            {step.word.split('').map((letter, index) => (
              <span key={`${step.word}-${index}`} className={`tile tile-${step.feedback?.[index] || 'gray'}`}>
                {letter}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
