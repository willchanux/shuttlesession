/**
 * Pure helpers for working out how often players have shared a game.
 *
 * A game "includes" a set of players when every one of them is in that game's
 * playerIds. This matters for pairs: a recorded game has four players, so
 * looking up a pair must match any game containing both, not only games that
 * contain exactly two players.
 */

export interface HistoryGame {
  playerIds?: number[];
  timestamp?: number;
}

/** Weight applied per time the exact same group has played together. */
export const REPEAT_GROUP_WEIGHT = 10;
/** Weight applied per time any two members of the group have shared a game. */
export const REPEAT_PAIR_WEIGHT = 2;

/** True when every id in `playerIds` took part in `game`. */
export function gameIncludesAllPlayers(game: HistoryGame, playerIds: number[]): boolean {
  if (playerIds.length === 0 || !Array.isArray(game.playerIds)) return false;
  const inGame = game.playerIds;
  return playerIds.every(id => inGame.includes(id));
}

/**
 * Counts games that include all of `playerIds`, ignoring games recorded
 * before `since` (a timestamp in ms; 0 means no limit).
 */
export function countGamesTogether(games: HistoryGame[], playerIds: number[], since = 0): number {
  let count = 0;
  for (const game of games) {
    if ((game.timestamp ?? 0) < since) continue;
    if (gameIncludesAllPlayers(game, playerIds)) count++;
  }
  return count;
}

/**
 * Penalty for how often this group, and each pair inside it, has already
 * played together. Higher means more repeated company.
 */
export function computeRepeatPenalty(playerIds: number[], games: HistoryGame[], since = 0): number {
  const fullGroupCount = countGamesTogether(games, playerIds, since);

  let pairCount = 0;
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      pairCount += countGamesTogether(games, [playerIds[i], playerIds[j]], since);
    }
  }

  return fullGroupCount * REPEAT_GROUP_WEIGHT + pairCount * REPEAT_PAIR_WEIGHT;
}
