export function formatDistance(distance?: number | null) {
  if (distance === undefined || distance === null) return 'unknown distance';
  if (distance === 0) return 'aligned';
  return `${distance} away`;
}
