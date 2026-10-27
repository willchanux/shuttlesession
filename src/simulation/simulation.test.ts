import { describe, it, expect } from "vitest";
import { Player } from "../types/player";
import { createRng } from "./random";
import { allocate, makeRoster } from "./roster";
import { canPlayBothFamilies, computeMetrics, familyOf, summarise } from "./metrics";
import { simulateSession } from "./simulateSession";
import { currentEngine, queueOrderEngine } from "./engines";
import { DEFAULT_SIM_CONFIG, GameLogEntry, SessionLog } from "./types";

describe("createRng", () => {
  it("repeats exactly for the same seed and differs for another", () => {
    const a = createRng(7);
    const b = createRng(7);
    const c = createRng(8);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
  });

  it("stays within 0 (inclusive) and 1 (exclusive)", () => {
    const rng = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("roster", () => {
  it("allocates counts that add up to the total", () => {
    expect(allocate(12, [0.6, 0.25, 0.15])).toEqual([7, 3, 2]);
    expect(allocate(10, [0.55, 0.2, 0.15, 0.1])).toEqual([6, 2, 1, 1]);
    expect(allocate(0, [0.5, 0.5])).toEqual([0, 0]);
  });

  it("builds the requested players with unique ids and the right genders", () => {
    const roster = makeRoster(22, 10);
    expect(roster).toHaveLength(22);
    expect(new Set(roster.map(p => p.id)).size).toBe(22);
    expect(roster.filter(p => p.gender === "female")).toHaveLength(10);
    expect(roster.filter(p => p.gender === "male")).toHaveLength(12);
  });
});

describe("familyOf and canPlayBothFamilies", () => {
  it("treats Ladies and Open as one family and Mixed as the other", () => {
    expect(familyOf("Mixed")).toBe("mixed");
    expect(familyOf("Ladies")).toBe("level");
    expect(familyOf("Open")).toBe("level");
    expect(familyOf(null)).toBeNull();
  });

  const player = (gender: "male" | "female", playPreferences: Player["playPreferences"]): Player => ({
    id: 1,
    name: "P",
    gender,
    waitingTime: 0,
    playPreferences,
  });

  it("only counts players who can be given both kinds of game", () => {
    expect(canPlayBothFamilies(player("male", ["Mixed", "Open"]))).toBe(true);
    expect(canPlayBothFamilies(player("male", []))).toBe(true);
    expect(canPlayBothFamilies(player("male", ["Open"]))).toBe(false);
    expect(canPlayBothFamilies(player("female", ["Mixed", "Ladies"]))).toBe(true);
    expect(canPlayBothFamilies(player("female", ["Open", "Mixed"]))).toBe(true);
    expect(canPlayBothFamilies(player("female", ["Ladies"]))).toBe(false);
    expect(canPlayBothFamilies(player("female", ["Mixed"]))).toBe(false);
  });
});

/** A small hand-built night whose measurements can be worked out by hand. */
function handBuiltLog(overrides: Partial<SessionLog> = {}): SessionLog {
  const players: Player[] = [1, 2, 3, 4, 5, 6, 7, 8].map(id => ({
    id,
    name: `P${id}`,
    gender: id <= 4 ? "male" : "female",
    waitingTime: 0,
    playPreferences: [],
  }));

  const game = (index: number, playerIds: number[], gameType: GameLogEntry["gameType"]): GameLogEntry => ({
    index,
    startMinute: index * 15,
    endMinute: index * 15 + 15,
    playerIds,
    gameType,
    forced: false,
  });

  return {
    config: DEFAULT_SIM_CONFIG,
    players,
    games: [game(0, [1, 2, 3, 4], "Mixed"), game(1, [1, 2, 5, 6], "Open"), game(2, [1, 2, 3, 4], "Mixed")],
    waits: { 1: [0, 20], 2: [10], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] },
    skipEpisodes: [1, 1, 2, 4],
    selections: 4,
    failedSelections: 1,
    ...overrides,
  };
}

describe("computeMetrics", () => {
  const metrics = computeMetrics(handBuiltLog());

  it("counts who shared a court", () => {
    expect(metrics.maxPairCount).toBe(3); // players 1 and 2 played together every game
    expect(metrics.pairsMetThreePlus).toBe(1);
    expect(metrics.pairs).toBe(28);
    expect(metrics.pairsNeverMet).toBe(17); // 11 of the 28 pairs met at least once
    expect(metrics.distinctCoPlayersMean).toBeCloseTo(22 / 6, 5); // the six who played: 5,5,3,3,3,3
  });

  it("measures how much company carries over between a player's games", () => {
    // players 1 and 2 kept one co-player twice each; players 3 and 4 had the identical four again
    expect(metrics.consecutiveOverlap).toEqual([0, 4, 0, 2]);
  });

  it("measures format repeats only over the games that can be labelled", () => {
    expect(metrics.labelledGames).toBe(3);
    expect(metrics.mixedGames).toBe(2);
    expect(metrics.familyTransitions).toBe(6);
    expect(metrics.sameFamilyAgain).toBe(2); // players 3 and 4: Mixed then Mixed
    expect(metrics.longestFamilyStreak).toBe(2);
    expect(metrics.playersWithStreakOfThree).toBe(0);
  });

  it("measures fairness", () => {
    expect(metrics.minGamesPlayed).toBe(0);
    expect(metrics.maxGamesPlayed).toBe(3);
    expect(metrics.menGamesMean).toBeCloseTo(2.5, 5);
    expect(metrics.womenGamesMean).toBeCloseTo(0.5, 5);
    expect(metrics.meanWait).toBeCloseTo(10, 5);
    expect(metrics.maxWait).toBe(20);
  });

  it("counts skip runs by length", () => {
    expect(metrics.skipRunsOne).toBe(2);
    expect(metrics.skipRunsTwo).toBe(1);
    expect(metrics.skipRunsThreePlus).toBe(1);
    expect(metrics.maxSkips).toBe(4);
    expect(metrics.failedSelections).toBe(1);
  });

  it("ignores invalid games and players with nothing to rotate between when measuring format", () => {
    const log = handBuiltLog();
    log.games[1] = { ...log.games[1], gameType: null };
    const withInvalid = computeMetrics(log);
    expect(withInvalid.labelledGames).toBe(2);

    // Everyone Open-only: nobody can be rotated, so no format repeats are measured
    const openOnly = handBuiltLog();
    openOnly.players = openOnly.players.map(p => ({ ...p, playPreferences: ["Open"] }));
    expect(computeMetrics(openOnly).familyTransitions).toBe(0);
  });
});

describe("summarise", () => {
  it("pools shares across nights instead of averaging each night's share", () => {
    const first = computeMetrics(handBuiltLog()); // 2 of 4 skip runs were single
    const second = computeMetrics(handBuiltLog({ skipEpisodes: [1, 1, 1, 1] }));

    const summary = summarise([first, second]);

    expect(summary.sessions).toBe(2);
    expect(summary.singleSkipShare).toBeCloseTo(6 / 8, 5);
    expect(summary.overlapTwoPlusShare).toBeCloseTo(2 / 6, 5);
    expect(summary.identicalFourShare).toBeCloseTo(2 / 6, 5);
    expect(summary.maxSkipsWorst).toBe(4);
  });

  it("copes with no data", () => {
    expect(summarise([]).singleSkipShare).toBe(0);
  });
});

describe("simulateSession", () => {
  const config = DEFAULT_SIM_CONFIG;

  it("always puts four different players on a court, never one player on two courts at once", async () => {
    const log = await simulateSession(queueOrderEngine, config, 3);

    for (const game of log.games) {
      expect(new Set(game.playerIds).size).toBe(4);
    }
    for (const a of log.games) {
      for (const b of log.games) {
        if (a.index >= b.index) continue;
        const overlapInTime = a.startMinute < b.endMinute && b.startMinute < a.endMinute;
        if (overlapInTime) {
          expect(a.playerIds.some(id => b.playerIds.includes(id))).toBe(false);
        }
      }
    }
  });

  it("keeps every court busy for the length of the night", async () => {
    const log = await simulateSession(queueOrderEngine, config, 3);
    // about 12 games per court in 180 minutes of 12-18 minute games
    expect(log.games.length).toBeGreaterThanOrEqual(28);
    expect(log.games.length).toBeLessThanOrEqual(45);
    expect(Math.max(...log.games.map(g => g.startMinute))).toBeLessThan(config.sessionMinutes);
  });

  it("records a wait for every game each player starts", async () => {
    const log = await simulateSession(queueOrderEngine, config, 3);
    const waits = Object.values(log.waits).flat().length;
    expect(waits).toBe(log.games.length * 4);
  });

  it("repeats exactly for the same seed", async () => {
    const a = await simulateSession(queueOrderEngine, config, 11);
    const b = await simulateSession(queueOrderEngine, config, 11);
    const c = await simulateSession(queueOrderEngine, config, 12);
    expect(b.games).toEqual(a.games);
    expect(c.games).not.toEqual(a.games);
  });

  it("puts back the clock, Math.random, console and settings it took over", async () => {
    const { random, now } = { random: Math.random, now: Date.now };
    const consoleLog = console.log;
    localStorage.setItem("enablePlayerPreferences", "false");
    localStorage.removeItem("playerPoolSize");

    await simulateSession(queueOrderEngine, config, 5);

    expect(Math.random).toBe(random);
    expect(Date.now).toBe(now);
    expect(console.log).toBe(consoleLog);
    expect(localStorage.getItem("enablePlayerPreferences")).toBe("false");
    expect(localStorage.getItem("playerPoolSize")).toBeNull();
  });

  it("puts back the settings even when the engine fails", async () => {
    const random = Math.random;
    const broken = { ...queueOrderEngine, select: async () => { throw new Error("boom"); } };
    await expect(simulateSession(broken, config, 5)).rejects.toThrow("boom");
    expect(Math.random).toBe(random);
  });
});

describe("the current engine in the simulator", () => {
  it("only offers groups that respect everyone's preferences", async () => {
    const log = await simulateSession(currentEngine, DEFAULT_SIM_CONFIG, 2);
    const byId = new Map(log.players.map(p => [p.id, p]));

    expect(log.games.length).toBeGreaterThan(20);
    for (const game of log.games.filter(g => !g.forced)) {
      expect(game.gameType).not.toBeNull();
      for (const id of game.playerIds) {
        const prefs = byId.get(id)!.playPreferences ?? [];
        expect(prefs.length === 0 || prefs.includes(game.gameType!)).toBe(true);
      }
    }
  });
});
