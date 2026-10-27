import { Player } from "../../types/player";
import { MixTrackerReader } from "./mixTracker";
import { GameType } from "./types";

/** A possible next game, as the cost terms see it. */
export interface Candidate {
  /** The four players, in queue order. */
  players: Player[];
  /** The format the game would be played as. */
  gameType: GameType | null;
  /** What it costs to give each player that format (see chooseFormat). */
  formatCost: number;
  /** Players in the pool who would be passed over: ahead of the last one chosen, but not chosen. */
  skipped: Player[];
}

export interface CostContext {
  tracker: MixTrackerReader;
  weights: MixerWeights;
  /** Players who must always be together, in both directions. */
  partnerOf: Map<number, number>;
}

/** One reason a group is better or worse than another. Lower total cost wins. */
export interface CostTerm {
  name: string;
  cost(candidate: Candidate, context: CostContext): number;
}

export interface MixerWeights {
  /** Per (times two players have shared a game this session) squared, for each pair. */
  pairRepeat: number;
  /**
   * Extra cost for a pair whose next game would follow straight on from
   * playing together. Indexed by games played since (0, 1, 2...); beyond the list costs nothing.
   */
  pairRecency: number[];
  /** Per (games in a row already played as this family) squared, for each player who could be rotated. */
  formatStreak: number;
  /** Per place down a player's own preference list the format is. */
  preferenceRank: number;
  /** Per game each chosen player has already played this session. */
  gamesPlayed: number;
  /** Cost of passing over a player who has not been passed over yet. */
  skipFirst: number;
  /** ...one who has been passed over once already. */
  skipSecond: number;
  /** ...one who has reached the cap. Effectively never. */
  skipOver: number;
  /** After this many skips in a row a player is put into the next game. */
  maxSkips: number;
  /**
   * How adventurous the final pick is. Among groups close to the best, one is
   * chosen at random, favouring the better ones; lower means closer to always
   * taking the very best.
   */
  temperature: number;
  /** Extra reasons to add, e.g. skill matching for a competitive night. */
  extraTerms: CostTerm[];
}

export const DEFAULT_WEIGHTS: MixerWeights = {
  pairRepeat: 3,
  pairRecency: [8, 3, 1],
  formatStreak: 4,
  preferenceRank: 0.5,
  gamesPlayed: 3,
  skipFirst: 8,
  skipSecond: 60,
  skipOver: 1000,
  maxSkips: 2,
  temperature: 2,
  extraTerms: [],
};

const total = <T>(items: T[], value: (item: T) => number) =>
  items.reduce((sum, item) => sum + value(item), 0);

/** Every pair among the four, except players who are always together anyway. */
export function pairsIn(candidate: Candidate, context: CostContext): [Player, Player][] {
  const pairs: [Player, Player][] = [];
  const { players } = candidate;
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      if (context.partnerOf.get(players[i].id) === players[j].id) continue;
      pairs.push([players[i], players[j]]);
    }
  }
  return pairs;
}

export const STANDARD_TERMS: CostTerm[] = [
  {
    name: "pairRepeat",
    cost: (c, ctx) =>
      total(pairsIn(c, ctx), ([a, b]) => {
        const times = ctx.tracker.pairCount(a.id, b.id);
        return ctx.weights.pairRepeat * times * times;
      }),
  },
  {
    name: "pairRecency",
    cost: (c, ctx) =>
      total(pairsIn(c, ctx), ([a, b]) => {
        const gap = ctx.tracker.minGapSince(a.id, b.id);
        return gap === null ? 0 : ctx.weights.pairRecency[gap] ?? 0;
      }),
  },
  {
    name: "format",
    cost: c => c.formatCost,
  },
  {
    name: "gamesPlayed",
    cost: (c, ctx) => ctx.weights.gamesPlayed * total(c.players, p => ctx.tracker.gamesPlayed(p.id)),
  },
  {
    name: "skips",
    cost: (c, ctx) =>
      total(c.skipped, p => {
        const skips = ctx.tracker.skipCount(p.id);
        if (skips >= ctx.weights.maxSkips) return ctx.weights.skipOver;
        return skips === 0 ? ctx.weights.skipFirst : ctx.weights.skipSecond;
      }),
  },
];
