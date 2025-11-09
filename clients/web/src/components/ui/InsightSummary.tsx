import type { WordInsight } from '../../types';
import { formatDistance } from './formatDistance';

export default function InsightSummary({ insight }: { insight: WordInsight }) {
  return (
    <div className="insight-summary">
      <span className={`chip insight-${insight.branchLevel}`}>{insight.branchLevel}</span>
      <span>{insight.neighborCount} exits</span>
      <span>{formatDistance(insight.distanceToTarget)}</span>
    </div>
  );
}
