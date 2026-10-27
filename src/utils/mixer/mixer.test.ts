import { describe, it, expect, beforeEach } from "vitest";
import { Player } from "../../types/player";
import { PlayPreference } from "../../types/member";
import { endMixerSession, explainSuggestion, onGameAssigned, playsNext, reasonsFor, rememberSuggestion } from "./suggestion";
import { mixTracker } from "./mixTracker";
import { MixTracker, StorageLike, MIX_TRACKER_KEY } from "./mixTracker";
import { selectGame } from "./selectGame";
import { feasibleFormats, familyOf, canPlayBothFamilies } from "./formats";
import { planFormat, getPlannedFormat, clearPlannedFormats } from "./plannedFormats";
import { determineBestGameType } from "../gameValidation";
import { createRng as mulberry32 } from "../../simulation/random";

let nextId = 1;
const man = (prefs: PlayPreference[] = [], id = nextId++): Player => ({
  id, name: `M${id}`, gender: "male", waitingTime: 0, playPreferences: prefs,
});
const lady = (prefs: PlayPreference[] = [], id = nextId++): Player => ({
  id, name: `L${id}`, gender: "female", waitingTime: 0, playPreferences: prefs,
});
const memoryStorage = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: k => void data.delete(k),
  };
};

beforeEach(() => {
  localStorage.setItem("enablePlayerPreferences", "true");
  nextId = 1;
  clearPlannedFormats();
});

describe("formats", () => {
  it("allows Mixed only with two men and two ladies who all accept it", () => {
    const four = [man(), man(), lady(), lady()];
    expect(feasibleFormats(four, { preferencesEnabled: true })).toEqual(["Mixed", "Open"]);
    const noMixed = [man(["Open"]), man(), lady(), lady()];
    expect(feasibleFormats(noMixed, { preferencesEnabled: true })).toEqual(["Open"]);
  });

  it("allows Ladies only with four ladies", () => {
    expect(feasibleFormats([lady(), lady(), lady(), lady()], { preferencesEnabled: true })).toEqual(["Ladies", "Open"]);
  });

  it("is just Open when preferences are off", () => {
    expect(feasibleFormats([man(), man(), man(), lady(["Ladies"])], { preferencesEnabled: false })).toEqual(["Open"]);
  });

  it("treats Ladies and Open as one family", () => {
    expect(familyOf("Ladies")).toBe("level");
    expect(familyOf("Open")).toBe("level");
    expect(familyOf("Mixed")).toBe("mixed");
  });

  it("knows who can rotate", () => {
    expect(canPlayBothFamilies(man())).toBe(true);
    expect(canPlayBothFamilies(man(["Open"]))).toBe(false);
    expect(canPlayBothFamilies(lady(["Mixed", "Ladies"]))).toBe(true);
    expect(canPlayBothFamilies(lady(["Ladies"]))).toBe(false);
  });
});

describe("MixTracker", () => {
  it("counts pairs, games and format streaks", () => {
    const t = new MixTracker({ storage: null });
    t.recordGame([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], "Mixed");
    t.recordGame([{ id: 1 }, { id: 2 }, { id: 5 }, { id: 6 }], "Mixed");
    expect(t.pairCount(1, 2)).toBe(2);
    expect(t.pairCount(2, 1)).toBe(2);
    expect(t.pairCount(1, 3)).toBe(1);
    expect(t.pairCount(3, 5)).toBe(0);
    expect(t.gamesPlayed(1)).toBe(2);
    expect(t.familyStreak(1, "mixed")).toBe(2);
    expect(t.familyStreak(1, "level")).toBe(0);
    t.recordGame([{ id: 1 }, { id: 7 }, { id: 8 }, { id: 9 }], "Open");
    expect(t.familyStreak(1, "mixed")).toBe(0);
    expect(t.familyStreak(1, "level")).toBe(1);
  });

  it("measures how recently a pair shared a game", () => {
    const t = new MixTracker({ storage: null });
    t.recordGame([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], "Open");
    expect(t.minGapSince(1, 2)).toBe(0);
    expect(t.minGapSince(1, 9)).toBeNull();
    t.recordGame([{ id: 1 }, { id: 5 }, { id: 6 }, { id: 7 }], "Open");
    expect(t.minGapSince(1, 2)).toBe(0); // 2 has not played since
  });

  it("tracks skips, resets them when chosen or played, and can undo", () => {
    const t = new MixTracker({ storage: null });
    t.commitSelection([1, 2, 3, 4], [5]);
    expect(t.skipCount(5)).toBe(1);
    t.commitSelection([6, 7, 8, 9], [5]);
    expect(t.skipCount(5)).toBe(2);
    t.undoSelection();
    expect(t.skipCount(5)).toBe(1);
    t.commitSelection([5, 6, 7, 8], []);
    expect(t.skipCount(5)).toBe(0);
  });

  it("survives a refresh through storage", () => {
    const storage = memoryStorage();
    const a = new MixTracker({ storage });
    a.recordGame([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], "Mixed");
    a.commitSelection([5, 6, 7, 8], [9]);
    const b = new MixTracker({ storage });
    expect(b.pairCount(1, 2)).toBe(1);
    expect(b.familyStreak(1, "mixed")).toBe(1);
    expect(b.skipCount(9)).toBe(1);
  });

  it("starts afresh when saved state is from an earlier night", () => {
    const storage = memoryStorage();
    const a = new MixTracker({ storage });
    a.recordGame([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], "Mixed");
    const saved = JSON.parse(storage.data.get(MIX_TRACKER_KEY)!);
    saved.lastActivity = Date.now() - 9 * 60 * 60 * 1000;
    storage.setItem(MIX_TRACKER_KEY, JSON.stringify(saved));
    expect(new MixTracker({ storage }).pairCount(1, 2)).toBe(0);
  });

  it("reset forgets everything", () => {
    const storage = memoryStorage();
    const t = new MixTracker({ storage });
    t.recordGame([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], "Mixed");
    t.reset();
    expect(t.pairCount(1, 2)).toBe(0);
    expect(storage.data.has(MIX_TRACKER_KEY)).toBe(false);
  });
});

describe("selectGame", () => {
  const tracker = () => new MixTracker({ storage: null });
  const eight = () => [man(), man(), man(), man(), lady(), lady(), lady(), lady()];

  it("returns null with fewer than four players or no valid group", () => {
    expect(selectGame({ queue: [man(), man(), man()], poolSize: 8, tracker: tracker(), preferencesEnabled: true })).toBeNull();
    const ladiesOnly = [lady(["Ladies"]), man(["Open"]), man(["Open"]), lady(["Ladies"])];
    expect(selectGame({ queue: ladiesOnly, poolSize: 8, tracker: tracker(), preferencesEnabled: true })).toBeNull();
  });

  it("always includes the longest waiter", () => {
    const queue = eight();
    for (let seed = 1; seed <= 30; seed++) {
      const r = selectGame({ queue, poolSize: 8, tracker: tracker(), preferencesEnabled: true, random: mulberry32(seed) })!;
      expect(r.players.map(p => p.id)).toContain(queue[0].id);
      expect(r.reasons.longestWaiterId).toBe(queue[0].id);
    }
  });

  it("returns players in queue order", () => {
    const queue = eight();
    const r = selectGame({ queue, poolSize: 8, tracker: tracker(), preferencesEnabled: true, random: mulberry32(3) })!;
    const ids = r.players.map(p => p.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it("forces in anyone already skipped the maximum number of times", () => {
    const queue = eight();
    const t = tracker();
    t.commitSelection([], [queue[7].id]);
    t.commitSelection([], [queue[7].id]);
    for (let seed = 1; seed <= 20; seed++) {
      const r = selectGame({ queue, poolSize: 8, tracker: t, preferencesEnabled: true, random: mulberry32(seed) })!;
      expect(r.players.map(p => p.id)).toContain(queue[7].id);
    }
  });

  it("prefers company a player has not had, and reports skips", () => {
    const queue = eight();
    const t = tracker();
    // the first four just played together
    t.recordGame(queue.slice(0, 4), "Mixed");
    const r = selectGame({ queue, poolSize: 8, tracker: t, preferencesEnabled: true, random: mulberry32(5), weights: { temperature: 0.01 } })!;
    expect(r.players.map(p => p.id)).not.toEqual(queue.slice(0, 4).map(p => p.id));
    expect(r.reasons.freshPairs).toBeGreaterThan(0);
  });

  it("respects preferences", () => {
    const queue = [man(["Open"]), man(["Open"]), man(["Open"]), lady(["Mixed"]), lady(["Mixed"]), man(["Mixed"]), man(["Mixed"])];
    for (let seed = 1; seed <= 20; seed++) {
      const r = selectGame({ queue, poolSize: 8, tracker: tracker(), preferencesEnabled: true, random: mulberry32(seed) })!;
      const ids = r.players.map(p => p.id);
      if (r.gameType === "Mixed") {
        expect(r.players.filter(p => p.gender === "female")).toHaveLength(2);
        expect(r.players.every(p => (p.playPreferences ?? []).includes("Mixed"))).toBe(true);
      }
      // a Mixed-only lady never ends up in an Open game
      expect(r.gameType === "Open" && ids.some(id => id === queue[3].id || id === queue[4].id)).toBe(false);
    }
  });

  it("keeps piggyback pairs together", () => {
    const queue = eight();
    const pair = { master: queue[1].id, partner: queue[6].id };
    for (let seed = 1; seed <= 30; seed++) {
      const r = selectGame({ queue, poolSize: 8, tracker: tracker(), preferencesEnabled: true, piggybackPairs: [pair], random: mulberry32(seed) })!;
      const ids = r.players.map(p => p.id);
      expect(ids.includes(pair.master)).toBe(ids.includes(pair.partner));
    }
  });

  it("swaps format for someone who has had several Mixed in a row", () => {
    const queue = [man(), man(), lady(), lady(), man(), man(), lady(), lady()];
    const t = tracker();
    const first4 = queue.slice(0, 4);
    for (let i = 0; i < 4; i++) t.recordGame(first4, "Mixed");
    const r = selectGame({ queue, poolSize: 8, tracker: t, preferencesEnabled: true, random: mulberry32(2), weights: { temperature: 0.01 } })!;
    // the longest waiter has had four Mixed in a row, so the engine should give a level game
    expect(r.gameType).toBe("Open");
  });

  it("is deterministic for a given seed", () => {
    const queue = eight();
    const run = () => selectGame({ queue, poolSize: 8, tracker: tracker(), preferencesEnabled: true, random: mulberry32(9) })!.players.map(p => p.id);
    expect(run()).toEqual(run());
  });

  it("calls everything Open when preferences are off", () => {
    const r = selectGame({ queue: eight(), poolSize: 8, tracker: tracker(), preferencesEnabled: false, random: mulberry32(1) })!;
    expect(r.gameType).toBe("Open");
  });

  it("does not count players who joined together as passed over", () => {
    const queue = eight();
    const joined = new Map(queue.map((p, i) => [p.id, 0 + i * 0.1])); // all within a minute
    const t = tracker();
    const r = selectGame({
      queue, poolSize: 8, tracker: t, preferencesEnabled: true, random: mulberry32(4),
      queuedAt: id => joined.get(id), waveWindow: 3,
    })!;
    expect(r.reasons.skipped).toEqual([]);
  });
});

describe("planned formats", () => {
  it("makes the game type agree with the engine's choice", () => {
    const four = [man(), man(), lady(), lady()];
    expect(determineBestGameType(four)).toBe("Mixed");
    planFormat(four, "Open");
    expect(getPlannedFormat(four)).toBe("Open");
    expect(determineBestGameType(four)).toBe("Open");
    clearPlannedFormats();
    expect(determineBestGameType(four)).toBe("Mixed");
  });
});

describe("suggestions and the tracker", () => {
  const four = () => [man(), man(), lady(), lady()];
  const result = (players: Player[], skipped: number[]) => ({
    players,
    gameType: "Mixed" as const,
    reasons: {
      longestWaiterId: players[0].id, forcedIds: [], skipped: skipped.map(id => ({ id, timesSkipped: 1 })),
      freshPairs: 6, repeatedPairs: [], costs: {},
    },
  });

  beforeEach(() => endMixerSession());

  it("counts skips only when the game is played as suggested", () => {
    const players = four();
    rememberSuggestion(result(players, [99]));
    expect(reasonsFor(players)).not.toBeNull();
    onGameAssigned(players, "Mixed");
    expect(mixTracker.skipCount(99)).toBe(1);
    expect(mixTracker.pairCount(players[0].id, players[1].id)).toBe(1);
  });

  it("counts nobody as skipped when the host picks different players", () => {
    const suggested = four();
    rememberSuggestion(result(suggested, [98]));
    const picked = four();
    expect(reasonsFor(picked)).toBeNull();
    onGameAssigned(picked, "Open");
    expect(mixTracker.skipCount(98)).toBe(0);
    expect(mixTracker.gamesPlayed(picked[0].id)).toBe(1); // but the game still counts
  });

  it("forgets everything when the session ends", () => {
    const players = four();
    onGameAssigned(players, "Mixed");
    endMixerSession();
    expect(mixTracker.pairCount(players[0].id, players[1].id)).toBe(0);
  });
});

describe("explaining a suggestion", () => {
  beforeEach(() => {
    endMixerSession();
    localStorage.setItem("selectionEngine", "mixer");
  });

  it("explains the suggested group in plain words", () => {
    const players = [man(), man(), lady(), lady()];
    const pool = [...players, man(), man()];
    rememberSuggestion(
      {
        players, gameType: "Mixed",
        reasons: {
          longestWaiterId: players[0].id, forcedIds: [players[0].id, pool[4].id],
          skipped: [{ id: pool[5].id, timesSkipped: 1 }], freshPairs: 4,
          repeatedPairs: [{ ids: [players[0].id, players[1].id], times: 3 }], costs: {},
        },
      },
      pool,
      [{ master: players[2].id, partner: players[3].id }]
    );
    const lines = explainSuggestion(players)!;
    expect(lines[0]).toBe(`${players[0].name} has been waiting longest.`);
    expect(lines.join(" ")).toContain("4 of the 6 pairings are new tonight.");
    expect(lines.join(" ")).not.toContain("shared");
    expect(lines.join(" ")).not.toMatch(/format|Open|Mixed/);
    expect(lines.join(" ")).toContain(`${players[2].name} and ${players[3].name} are piggybacked, so they play together.`);
    expect(lines.join(" ")).toContain(`Passed over this time: ${pool[5].name}.`);
  });

  it("gives nothing for a game the host picked by hand", () => {
    expect(explainSuggestion([man(), man(), lady(), lady()])).toBeNull();
  });

  it("says who plays next once they have been passed over twice, only with the mixer on", () => {
    mixTracker.commitSelection([], [77]);
    expect(playsNext(77)).toBe(false);
    mixTracker.commitSelection([], [77]);
    expect(playsNext(77)).toBe(true);
    localStorage.removeItem("selectionEngine");
    expect(playsNext(77)).toBe(false);
  });
});

describe("voiding a game", () => {
  const p = (...ids: number[]) => ids.map(id => ({ id }));

  it("takes back games played, pairings, format and skips", () => {
    const t = new MixTracker({ storage: null });
    t.assignGame(p(1, 2, 3, 4), "Mixed", [9]);
    expect(t.gamesPlayed(1)).toBe(1);
    expect(t.skipCount(9)).toBe(1);

    expect(t.voidGame(p(4, 3, 2, 1))).toBe(true);

    expect(t.gamesPlayed(1)).toBe(0);
    expect(t.pairCount(1, 2)).toBe(0);
    expect(t.minGapSince(1, 2)).toBeNull();
    expect(t.familyStreak(1, "mixed")).toBe(0);
    expect(t.skipCount(9)).toBe(0);
  });

  it("restores a player's earlier skips and keeps later games intact", () => {
    const t = new MixTracker({ storage: null });
    t.commitSelection([], [1]); // player 1 passed over once before
    t.assignGame(p(1, 2, 3, 4), "Mixed", []);
    t.assignGame(p(1, 5, 6, 7), "Open", []); // a later game with player 1
    expect(t.skipCount(1)).toBe(0);

    t.voidGame(p(1, 2, 3, 4));

    expect(t.gamesPlayed(1)).toBe(1); // only the later game remains
    expect(t.pairCount(1, 5)).toBe(1);
    expect(t.pairCount(1, 2)).toBe(0);
    expect(t.familyStreak(1, "level")).toBe(1);
    expect(t.familyStreak(1, "mixed")).toBe(0);
  });

  it("returns false for a game it never recorded, and takes back only once", () => {
    const t = new MixTracker({ storage: null });
    expect(t.voidGame(p(1, 2, 3, 4))).toBe(false);
    t.assignGame(p(1, 2, 3, 4), "Open", null);
    expect(t.voidGame(p(1, 2, 3, 4))).toBe(true);
    expect(t.voidGame(p(1, 2, 3, 4))).toBe(false);
    expect(t.gamesPlayed(1)).toBe(0);
  });

  it("counts a replayed game once after a void", () => {
    const t = new MixTracker({ storage: null });
    t.assignGame(p(1, 2, 3, 4), "Mixed", []);
    t.voidGame(p(1, 2, 3, 4));
    t.assignGame(p(1, 2, 3, 4), "Mixed", null);
    expect(t.gamesPlayed(1)).toBe(1);
    expect(t.pairCount(1, 2)).toBe(1);
  });
});
