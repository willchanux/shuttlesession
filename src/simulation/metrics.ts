import { Player } from "../types/player";
import { canPlayBothFamilies, familyOf } from "../utils/mixer/formats";
import { Family, GameLogEntry, SessionLog } from "./types";

// The rules for what counts as the same format, and who can be rotated, are the
// engine's own, so the measurements cannot drift from what the engine aims at.
export { canPlayBothFamilies, familyOf };

/** Raw numbers measured from one simulated session. */
export interface SessionMetrics {
  games: number;
  selections: number;
  failedSelections: number;

  // Who shared a court with whom
  pairs: number;
  maxPairCount: number;
  pairsMetThreePlus: number;
  pairsNeverMet: number;
  /** Counts of how many of a player's three co-players were also in their previous game: [0, 1, 2, 3]. */
  consecutiveOverlap: [number, number, number, number];
  distinctCoPlayersMean: number;

  // Format
  labelledGames: number;
  mixedGames: number;
  familyTransitions: number;
  sameFamilyAgain: number;
  longestFamilyStreak: number;
  playersWithStreakOfThree: number;

  // Fairness
  minGamesPlayed: number;
  maxGamesPlayed: number;
  womenGamesMean: number;
  menGamesMean: number;
  meanWait: number;
  maxWait: number;

  // Being passed over
  skipRunsOne: number;
  skipRunsTwo: number;
  skipRunsThreePlus: number;
  maxSkips: number;
}

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

export function computeMetrics(log: SessionLog): SessionMetrics {
  const { games, players } = log;

  // Each player's games, in order
  const gamesByPlayer = new Map<number, GameLogEntry[]>(players.map(p => [p.id, []]));
  const pairCounts = new Map<string, number>();

  for (const game of games) {
    const ids = game.playerIds;
    for (const id of ids) gamesByPlayer.get(id)!.push(game);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = pairKey(ids[i], ids[j]);
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const totalPairs = (players.length * (players.length - 1)) / 2;
  const counts = Array.from(pairCounts.values());

  // How much of a player's company carries over from one game to the next
  const consecutiveOverlap: [number, number, number, number] = [0, 0, 0, 0];
  const distinctCoPlayers: number[] = [];

  for (const player of players) {
    const played = gamesByPlayer.get(player.id)!;
    const coPlayers = (g: GameLogEntry) => g.playerIds.filter(id => id !== player.id);

    const everMet = new Set<number>();
    played.forEach(g => coPlayers(g).forEach(id => everMet.add(id)));
    if (played.length > 0) distinctCoPlayers.push(everMet.size);

    for (let k = 1; k < played.length; k++) {
      const before = new Set(coPlayers(played[k - 1]));
      const overlap = coPlayers(played[k]).filter(id => before.has(id)).length;
      consecutiveOverlap[Math.min(overlap, 3)]++;
    }
  }

  // Format: only games that are valid, and only players who could be rotated
  const labelled = games.filter(g => familyOf(g.gameType) !== null);
  let familyTransitions = 0;
  let sameFamilyAgain = 0;
  let longestFamilyStreak = 0;
  let playersWithStreakOfThree = 0;

  for (const player of players.filter(canPlayBothFamilies)) {
    const families = gamesByPlayer
      .get(player.id)!
      .map(g => familyOf(g.gameType))
      .filter((f): f is Family => f !== null);

    let streak = 0;
    let longest = 0;
    families.forEach((family, i) => {
      if (i > 0) {
        familyTransitions++;
        if (family === families[i - 1]) sameFamilyAgain++;
      }
      streak = i > 0 && family === families[i - 1] ? streak + 1 : 1;
      longest = Math.max(longest, streak);
    });

    longestFamilyStreak = Math.max(longestFamilyStreak, longest);
    if (longest >= 3) playersWithStreakOfThree++;
  }

  // Fairness
  const gamesPlayed = (p: Player) => gamesByPlayer.get(p.id)!.length;
  const waits = Object.values(log.waits).flat();

  return {
    games: games.length,
    selections: log.selections,
    failedSelections: log.failedSelections,

    pairs: totalPairs,
    maxPairCount: counts.length ? Math.max(...counts) : 0,
    pairsMetThreePlus: counts.filter(c => c >= 3).length,
    pairsNeverMet: totalPairs - counts.length,
    consecutiveOverlap,
    distinctCoPlayersMean: mean(distinctCoPlayers),

    labelledGames: labelled.length,
    mixedGames: labelled.filter(g => g.gameType === "Mixed").length,
    familyTransitions,
    sameFamilyAgain,
    longestFamilyStreak,
    playersWithStreakOfThree,

    minGamesPlayed: players.length ? Math.min(...players.map(gamesPlayed)) : 0,
    maxGamesPlayed: players.length ? Math.max(...players.map(gamesPlayed)) : 0,
    womenGamesMean: mean(players.filter(p => p.gender === "female").map(gamesPlayed)),
    menGamesMean: mean(players.filter(p => p.gender === "male").map(gamesPlayed)),
    meanWait: mean(waits),
    maxWait: waits.length ? Math.max(...waits) : 0,

    skipRunsOne: log.skipEpisodes.filter(n => n === 1).length,
    skipRunsTwo: log.skipEpisodes.filter(n => n === 2).length,
    skipRunsThreePlus: log.skipEpisodes.filter(n => n >= 3).length,
    maxSkips: log.skipEpisodes.length ? Math.max(...log.skipEpisodes) : 0,
  };
}

const share = (part: number, whole: number) => (whole === 0 ? 0 : part / whole);

/** Results over many sessions, in the form they are reported. */
export interface Summary {
  sessions: number;
  gamesPerSession: number;
  failedSelectionsPerSession: number;

  maxPairCount: number;
  maxPairCountWorst: number;
  pairsMetThreePlus: number;
  pairsNeverMet: number;
  /** Of a player's back-to-back games, how often 2 or more co-players were the same. */
  overlapTwoPlusShare: number;
  /** ...and how often it was the identical four. */
  identicalFourShare: number;
  distinctCoPlayers: number;

  mixedShare: number;
  sameFamilyAgainShare: number;
  longestFamilyStreak: number;
  longestFamilyStreakWorst: number;
  playersWithStreakOfThree: number;

  minGamesPlayed: number;
  maxGamesPlayed: number;
  womenGames: number;
  menGames: number;
  meanWait: number;
  maxWait: number;
  maxWaitWorst: number;

  skipRunsPerSession: number;
  singleSkipShare: number;
  maxSkipsWorst: number;
}

export function summarise(runs: SessionMetrics[]): Summary {
  const sum = (pick: (m: SessionMetrics) => number) => runs.reduce((a, m) => a + pick(m), 0);
  const avg = (pick: (m: SessionMetrics) => number) => mean(runs.map(pick));
  const worst = (pick: (m: SessionMetrics) => number) =>
    runs.length ? Math.max(...runs.map(pick)) : 0;

  const overlap = (k: 0 | 1 | 2 | 3) => sum(m => m.consecutiveOverlap[k]);
  const overlapTotal = overlap(0) + overlap(1) + overlap(2) + overlap(3);
  const skipRuns = sum(m => m.skipRunsOne + m.skipRunsTwo + m.skipRunsThreePlus);

  return {
    sessions: runs.length,
    gamesPerSession: avg(m => m.games),
    failedSelectionsPerSession: avg(m => m.failedSelections),

    maxPairCount: avg(m => m.maxPairCount),
    maxPairCountWorst: worst(m => m.maxPairCount),
    pairsMetThreePlus: avg(m => m.pairsMetThreePlus),
    pairsNeverMet: avg(m => m.pairsNeverMet),
    overlapTwoPlusShare: share(overlap(2) + overlap(3), overlapTotal),
    identicalFourShare: share(overlap(3), overlapTotal),
    distinctCoPlayers: avg(m => m.distinctCoPlayersMean),

    mixedShare: share(sum(m => m.mixedGames), sum(m => m.labelledGames)),
    sameFamilyAgainShare: share(sum(m => m.sameFamilyAgain), sum(m => m.familyTransitions)),
    longestFamilyStreak: avg(m => m.longestFamilyStreak),
    longestFamilyStreakWorst: worst(m => m.longestFamilyStreak),
    playersWithStreakOfThree: avg(m => m.playersWithStreakOfThree),

    minGamesPlayed: avg(m => m.minGamesPlayed),
    maxGamesPlayed: avg(m => m.maxGamesPlayed),
    womenGames: avg(m => m.womenGamesMean),
    menGames: avg(m => m.menGamesMean),
    meanWait: avg(m => m.meanWait),
    maxWait: avg(m => m.maxWait),
    maxWaitWorst: worst(m => m.maxWait),

    skipRunsPerSession: skipRuns / Math.max(runs.length, 1),
    singleSkipShare: share(sum(m => m.skipRunsOne), skipRuns),
    maxSkipsWorst: worst(m => m.maxSkips),
  };
}
