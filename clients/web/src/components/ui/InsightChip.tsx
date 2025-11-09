import type { WordInsight } from '../../types';

export default function InsightChip({ insight }: { insight: WordInsight }) {
  return <span className={`insight-chip insight-${insight.branchLevel}`}>{insight.branchLevel}</span>;
}
