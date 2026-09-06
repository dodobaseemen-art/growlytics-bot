export function calculateEngagement(
  messages: number,
  activeUsers: number
): number {
  if (activeUsers <= 0 || messages <= 0) return 0;
  return Number((messages / activeUsers).toFixed(2));
}

export function calculatePeakHour(hours: number[]): number | null {
  if (hours.length === 0) return null;

  const counts = new Map<number, number>();
  for (const hour of hours) {
    if (hour < 0 || hour > 23 || !Number.isInteger(hour)) continue;
    counts.set(hour, (counts.get(hour) || 0) + 1);
  }

  if (counts.size === 0) return null;

  return [...counts.entries()].sort(
    ([hourA, countA], [hourB, countB]) =>
      countB - countA || hourA - hourB
  )[0][0];
}

export function countUniqueActiveUsers(userIds: Array<number | null>): number {
  return new Set(userIds.filter((userId): userId is number => userId !== null)).size;
}
