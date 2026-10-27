import { Player } from "../../types/player";
import { Candidate, CostContext, DEFAULT_WEIGHTS, MixerWeights, pairsIn, STANDARD_TERMS } from "./costs";
import { canPlayBothFamilies, familyOf, feasibleFormats, FormatOptions, preferenceRank } from "./formats";
import { MixTrackerReader } from "./mixTracker";
import { GameType, Pair } from "./types";

/** The pool setting goes up to 12; this just keeps the search bounded. */
export const MAX_POOL_SIZE = 14;
/** Groups costing more than this many "temperatures" above the best are never picked. */
const CUTOFF_TEMPERATURES = 6;

export interface SelectGameInput {
  /** Active (not resting) players, longest waiting first. */
  queue: Player[];
  poolSize: number;
  tracker: MixTrackerReader;
  /** The app's "player preferences" setting. */
  preferencesEnabled: boolean;
  piggybackPairs?: Pair[];
  weights?: Partial<MixerWeights>;
  /** Source of randomness; defaults to Math.random. */
  random?: () => number;
  /**
   * When each player joined the queue, in any consistent unit. With
   * `waveWindow`, players who joined within that long of each other count as
   * having waited equally: choosing one over another is not passing anyone over.
   * Without them, queue position alone decides.
   */
  queuedAt?: (id: number) => number | undefined;
  waveWindow?: number;
}

/** Why this group was chosen, for showing the host. */
export interface SelectionReasons {
  longestWaiterId: number;
  /** Players who had to be in the game (longest waiter, anyone at the skip cap). */
  forcedIds: number[];
  /** Pool players passed over by this pick, and how many times in a row that now is. */
  skipped: { id: number; timesSkipped: number }[];
  /** Pairs in the group who have not shared a game this session. */
  freshPairs: number;
  repeatedPairs: { ids: [number, number]; times: number }[];
  /** What each cost term came to for the chosen group. */
  costs: Record<string, number>;
}

export interface SelectGameResult {
  /** The four players, in queue order. */
  players: Player[];
  gameType: GameType | null;
  reasons: SelectionReasons;
}

/**
 * Picks the next game from the front of the queue.
 *
 * Every possible group in the pool is considered. The longest waiter always
 * plays, as does anyone who has already been passed over as often as allowed.
 * The rest of the group is chosen to keep people mixing: fresh company, a change
 * of format, and an even number of games. Among groups close to the best, one
 * is picked at random, so the same situation does not always give the same game.
 *
 * Returns null when the pool cannot make a valid game.
 */
export function selectGame(input: SelectGameInput): SelectGameResult | null {
  const weights: MixerWeights = { ...DEFAULT_WEIGHTS, ...input.weights };
  const random = input.random ?? Math.random;
  const { tracker, preferencesEnabled } = input;

  const pool = input.queue.slice(0, Math.min(input.poolSize, MAX_POOL_SIZE));
  if (pool.length < 4) return null;

  const indexOf = new Map(pool.map((p, i) => [p.id, i]));

  // Piggyback pairs play together or not at all. If only one of a pair is in
  // the pool, that player cannot be chosen.
  const partnerOf = new Map<number, number>();
  const unusable = new Set<number>();
  for (const pair of input.piggybackPairs ?? []) {
    const master = indexOf.get(pair.master);
    const partner = indexOf.get(pair.partner);
    if (master !== undefined && partner !== undefined) {
      partnerOf.set(pair.master, pair.partner);
      partnerOf.set(pair.partner, pair.master);
    } else if (master !== undefined) {
      unusable.add(master);
    } else if (partner !== undefined) {
      unusable.add(partner);
    }
  }
  const usable = pool.map((_, i) => i).filter(i => !unusable.has(i));

  // Who counts as having waited longer than whom. By default every position in
  // the queue is its own step; with a wave window, players who joined close
  // together share one.
  const waveOf = pool.map((_, i) => i);
  if (input.queuedAt && input.waveWindow !== undefined) {
    let wave = 0;
    let waveStart = input.queuedAt(pool[0].id) ?? 0;
    pool.forEach((p, i) => {
      const joined = input.queuedAt!(p.id);
      if (i > 0 && joined !== undefined && joined - waveStart > input.waveWindow!) {
        wave++;
        waveStart = joined;
      }
      waveOf[i] = wave;
    });
  }

  const context: CostContext = { tracker, weights, partnerOf };
  const terms = [...STANDARD_TERMS, ...weights.extraTerms];
  const formatOptions: FormatOptions = { preferencesEnabled, piggybackPairs: input.piggybackPairs };

  // ---- who must play -------------------------------------------------------

  /** A player and the partner they must be with, as pool positions. */
  const unitOf = (i: number): number[] => {
    const partnerId = partnerOf.get(pool[i].id);
    return partnerId === undefined ? [i] : [i, indexOf.get(partnerId)!];
  };

  /** Whoever fits in a group of four, in the order given; a pair goes in whole or not at all. */
  const mustPlay = (wanted: number[]): number[] => {
    const forced = new Set<number>();
    for (const i of wanted) {
      if (forced.has(i)) continue;
      const unit = unitOf(i).filter(u => !forced.has(u));
      if (forced.size + unit.length <= 4) unit.forEach(u => forced.add(u));
    }
    return Array.from(forced);
  };

  const longestWaiter = usable.includes(0) ? [0] : [];
  const atSkipCap = usable.filter(i => tracker.skipCount(pool[i].id) >= weights.maxSkips);

  // Prefer to honour everything; if no valid group exists that way, ease off
  const attempts = [
    mustPlay([...new Set([...longestWaiter, ...atSkipCap])].sort((a, b) => a - b)),
    mustPlay(longestWaiter),
    [] as number[],
  ];

  // ---- every possible group ------------------------------------------------

  /** The best format for this group, and what giving each player it costs. */
  const chooseFormat = (players: Player[]): { gameType: GameType | null; cost: number } | null => {
    const formats = feasibleFormats(players, formatOptions);
    if (formats.length === 0) return null;
    if (!preferencesEnabled) return { gameType: "Open", cost: 0 };

    let best: { gameType: GameType; cost: number } | null = null;
    for (const format of formats) {
      const family = familyOf(format)!;
      let cost = 0;
      for (const p of players) {
        cost += weights.preferenceRank * preferenceRank(p, format);
        if (canPlayBothFamilies(p)) {
          const streak = tracker.familyStreak(p.id, family);
          cost += weights.formatStreak * streak * streak;
        }
      }
      if (!best || cost < best.cost) best = { gameType: format, cost };
    }
    return best;
  };

  const score = (positions: number[]): { candidate: Candidate; cost: number } | null => {
    const players = positions.map(i => pool[i]);

    for (const p of players) {
      const partner = partnerOf.get(p.id);
      if (partner !== undefined && !players.some(q => q.id === partner)) return null;
    }

    const format = chooseFormat(players);
    if (!format) return null;

    // Passed over: not chosen, yet someone who waited less than them was
    const chosen = new Set(positions);
    const latestWave = Math.max(...positions.map(i => waveOf[i]));
    const skipped: Player[] = [];
    for (let i = 0; i < pool.length; i++) {
      if (!chosen.has(i) && !unusable.has(i) && waveOf[i] < latestWave) skipped.push(pool[i]);
    }

    const candidate: Candidate = { players, gameType: format.gameType, formatCost: format.cost, skipped };
    return { candidate, cost: terms.reduce((sum, term) => sum + term.cost(candidate, context), 0) };
  };

  const search = (forced: number[]) => {
    const rest = usable.filter(i => !forced.includes(i));
    const need = 4 - forced.length;
    const scored: { candidate: Candidate; cost: number }[] = [];

    const choose = (from: number, picked: number[]) => {
      if (picked.length === need) {
        const result = score([...forced, ...picked].sort((a, b) => a - b));
        if (result) scored.push(result);
        return;
      }
      for (let i = from; i <= rest.length - (need - picked.length); i++) {
        choose(i + 1, [...picked, rest[i]]);
      }
    };
    choose(0, []);
    return scored;
  };

  let scored: { candidate: Candidate; cost: number }[] = [];
  let forcedUsed: number[] = [];
  for (const forced of attempts) {
    scored = search(forced);
    if (scored.length > 0) {
      forcedUsed = forced;
      break;
    }
  }
  if (scored.length === 0) return null;

  // ---- pick one, favouring the better ----------------------------------------

  const best = Math.min(...scored.map(s => s.cost));
  const temperature = Math.max(weights.temperature, 1e-6);
  const near = scored.filter(s => s.cost <= best + CUTOFF_TEMPERATURES * temperature);
  const likelihood = near.map(s => Math.exp(-(s.cost - best) / temperature));

  let remaining = random() * likelihood.reduce((a, b) => a + b, 0);
  let chosen = near[near.length - 1];
  for (let i = 0; i < near.length; i++) {
    remaining -= likelihood[i];
    if (remaining <= 0) {
      chosen = near[i];
      break;
    }
  }

  // ---- explain it ------------------------------------------------------------

  const { candidate } = chosen;
  const pairs = pairsIn(candidate, context);

  return {
    players: candidate.players,
    gameType: candidate.gameType,
    reasons: {
      longestWaiterId: pool[0].id,
      forcedIds: forcedUsed.map(i => pool[i].id),
      skipped: candidate.skipped.map(p => ({ id: p.id, timesSkipped: tracker.skipCount(p.id) + 1 })),
      freshPairs: pairs.filter(([a, b]) => tracker.pairCount(a.id, b.id) === 0).length,
      repeatedPairs: pairs
        .filter(([a, b]) => tracker.pairCount(a.id, b.id) > 0)
        .map(([a, b]) => ({ ids: [a.id, b.id] as [number, number], times: tracker.pairCount(a.id, b.id) })),
      costs: Object.fromEntries(terms.map(term => [term.name, term.cost(candidate, context)])),
    },
  };
}
