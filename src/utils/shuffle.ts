/**
 * Returns a new array with the items in uniformly random order (Fisher-Yates).
 *
 * Prefer this over `[...items].sort(() => Math.random() - 0.5)`, which is not a
 * fair shuffle: items tend to stay near their original position, so players at
 * the front of the queue get picked more often than chance would give them.
 */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
