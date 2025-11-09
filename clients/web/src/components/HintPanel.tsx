import { formatDistance } from './ui/formatDistance';
import type { HintSuggestion, HintBudget } from '../types';

export default function HintPanel({ hints, budget }: { hints: HintSuggestion[]; budget: HintBudget | null }) {
  return (
    <div className="hint-panel">
      <div className="hint-panel-header">
        <strong>Smart suggestions</strong>
        <span className="muted">{budget ? `${budget.remaining}/${budget.limit} hints left` : 'Limited uses'}</span>
      </div>
      <ul>
        {hints.map(hint => (
          <li key={hint.word}>
            <div className="hint-line">
              <strong>{hint.word}</strong>
              <span className={`chip hint-${hint.category}`}>{hint.category}</span>
            </div>
            <small>
              {hint.neighborCount} exits • Δ {hint.distanceDelta > 0 ? `-${hint.distanceDelta}` : '0'} •{' '}
              {formatDistance(hint.distanceToTarget)}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
}
