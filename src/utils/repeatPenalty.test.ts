import { describe, it, expect } from "vitest";
import {
  computeRepeatPenalty,
  countGamesTogether,
  gameIncludesAllPlayers,
  REPEAT_GROUP_WEIGHT,
  REPEAT_PAIR_WEIGHT,
} from "./repeatPenalty";

const game = (playerIds: number[], timestamp = 1000) => ({ playerIds, timestamp });

describe("gameIncludesAllPlayers", () => {
  it("matches a pair that both played in a four-player game", () => {
    expect(gameIncludesAllPlayers(game([1, 2, 3, 4]), [1, 2])).toBe(true);
  });

  it("does not match when one of the players was not in the game", () => {
    expect(gameIncludesAllPlayers(game([1, 2, 3, 4]), [1, 9])).toBe(false);
  });

  it("matches the full group", () => {
    expect(gameIncludesAllPlayers(game([1, 2, 3, 4]), [4, 3, 2, 1])).toBe(true);
  });

  it("ignores legacy records without playerIds and empty queries", () => {
    expect(gameIncludesAllPlayers({ timestamp: 1 }, [1, 2])).toBe(false);
    expect(gameIncludesAllPlayers(game([1, 2, 3, 4]), [])).toBe(false);
  });
});

describe("countGamesTogether", () => {
  const games = [
    game([1, 2, 3, 4], 3000),
    game([1, 2, 5, 6], 2000),
    game([1, 7, 8, 9], 1000),
  ];

  it("counts every game a pair shared, not only games with exactly two players", () => {
    expect(countGamesTogether(games, [1, 2])).toBe(2);
  });

  it("counts a single-game pair once", () => {
    expect(countGamesTogether(games, [3, 4])).toBe(1);
  });

  it("only counts games at or after `since`", () => {
    expect(countGamesTogether(games, [1, 2], 2500)).toBe(1);
    expect(countGamesTogether(games, [1, 2], 3001)).toBe(0);
  });
});

describe("computeRepeatPenalty", () => {
  it("is zero when nobody in the group has played together", () => {
    expect(computeRepeatPenalty([1, 2, 3, 4], [game([5, 6, 7, 8])])).toBe(0);
  });

  it("penalises a pair who have shared a game even if the full group is new", () => {
    // Players 1 and 2 played together once; the group 1,2,3,4 never has.
    const penalty = computeRepeatPenalty([1, 2, 3, 4], [game([1, 2, 5, 6])]);
    expect(penalty).toBe(REPEAT_PAIR_WEIGHT);
  });

  it("grows each time the same pair meets again", () => {
    const once = computeRepeatPenalty([1, 2, 3, 4], [game([1, 2, 5, 6])]);
    const twice = computeRepeatPenalty([1, 2, 3, 4], [game([1, 2, 5, 6]), game([1, 2, 7, 8])]);
    expect(twice).toBeGreaterThan(once);
  });

  it("penalises repeating the exact same four most heavily", () => {
    const penalty = computeRepeatPenalty([1, 2, 3, 4], [game([1, 2, 3, 4])]);
    // 1 repeat of the whole group plus all 6 pairs inside it
    expect(penalty).toBe(REPEAT_GROUP_WEIGHT + 6 * REPEAT_PAIR_WEIGHT);
  });

  it("ignores games from before the session started", () => {
    const old = [game([1, 2, 3, 4], 500)];
    expect(computeRepeatPenalty([1, 2, 3, 4], old, 1000)).toBe(0);
    expect(computeRepeatPenalty([1, 2, 3, 4], old, 0)).toBeGreaterThan(0);
  });
});
