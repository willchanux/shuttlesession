import { familyOf } from "./formats";
import { Family, GameType } from "./types";

/** What the selection engine needs to know about the night so far. */
export interface MixTrackerReader {
  /** How many games these two have shared this session. */
  pairCount(a: number, b: number): number;
  /**
   * How many games either of them has played since they last shared one (the
   * smaller of the two): 0 means their next game would follow straight on from
   * playing together. Null if they have not played together.
   */
  minGapSince(a: number, b: number): number | null;
  gamesPlayed(id: number): number;
  /** How many of the player's most recent games in a row were this family. */
  familyStreak(id: number, family: Family): number;
  /** How many times in a row the player has been passed over for someone behind them. */
  skipCount(id: number): number;
}

/** The little of localStorage that is used, so tests can supply their own. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const MIX_TRACKER_KEY = "mixTrackerState";
/** If nothing has happened for this long, saved state is from an earlier night. */
const SESSION_GAP_MS = 8 * 60 * 60 * 1000;
const FAMILY_HISTORY_LIMIT = 8;

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

interface SavedState {
  pairCounts: [string, number][];
  lastShared: [string, [number, number]][];
  played: [number, number][];
  families: [number, Family[]][];
  skips: [number, number][];
  lastActivity: number;
}

/** What putting one game on a court changed, so that it can be taken back if the game is voided. */
interface GameDelta {
  key: string;
  ids: number[];
  family: Family | null;
  skippedIds: number[];
  /** Each affected player's skips before the game. */
  priorSkips: [number, number][];
  /** For each pair: when they last shared a game before this one, and what this game set it to. */
  pairLast: { pair: string; prior: [number, number] | undefined; set: [number, number] }[];
}

const UNDO_LIMIT = 20;
const gameKey = (ids: number[]) => [...ids].sort((a, b) => a - b).join("-");

/**
 * Remembers, for the current session only, who has played with whom, how many
 * games each player has had, what kinds of game, and who has been passed over.
 * Saved to storage so a refresh mid-session loses nothing.
 */
export class MixTracker implements MixTrackerReader {
  private pairCounts = new Map<string, number>();
  /** Games played by (lower id, higher id) at the moment they last shared a game. */
  private lastShared = new Map<string, [number, number]>();
  private played = new Map<number, number>();
  private families = new Map<number, Family[]>();
  private skips = new Map<number, number>();
  private skipSnapshot: Map<number, number> | null = null;
  /** Kept in memory only: a game voided after the app was reloaded cannot be taken back. */
  private deltas: GameDelta[] = [];
  private lastActivity = Date.now();
  private readonly storage: StorageLike | null;

  /**
   * `storage` defaults to localStorage when there is one. Pass null to keep
   * everything in memory (the simulator does).
   */
  constructor(options: { storage?: StorageLike | null } = {}) {
    this.storage =
      options.storage !== undefined
        ? options.storage
        : typeof localStorage !== "undefined"
          ? localStorage
          : null;
    this.load();
  }

  // ---- reading -------------------------------------------------------------

  pairCount(a: number, b: number): number {
    return this.pairCounts.get(pairKey(a, b)) ?? 0;
  }

  minGapSince(a: number, b: number): number | null {
    const shared = this.lastShared.get(pairKey(a, b));
    if (!shared) return null;
    const [low, high] = a < b ? [a, b] : [b, a];
    return Math.min(this.gamesPlayed(low) - shared[0], this.gamesPlayed(high) - shared[1]);
  }

  gamesPlayed(id: number): number {
    return this.played.get(id) ?? 0;
  }

  familyStreak(id: number, family: Family): number {
    const history = this.families.get(id) ?? [];
    let streak = 0;
    for (let i = history.length - 1; i >= 0 && history[i] === family; i--) streak++;
    return streak;
  }

  skipCount(id: number): number {
    return this.skips.get(id) ?? 0;
  }

  // ---- recording -----------------------------------------------------------

  /** A game has gone onto a court. `gameType` is null when it is not known. */
  recordGame(players: { id: number }[], gameType: GameType | null): void {
    const ids = players.map(p => p.id);
    for (const id of ids) {
      this.played.set(id, this.gamesPlayed(id) + 1);
      this.skips.set(id, 0);
    }

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = pairKey(ids[i], ids[j]);
        const [low, high] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
        this.pairCounts.set(key, (this.pairCounts.get(key) ?? 0) + 1);
        this.lastShared.set(key, [this.gamesPlayed(low), this.gamesPlayed(high)]);
      }
    }

    const family = familyOf(gameType);
    if (family) {
      for (const id of ids) {
        const history = [...(this.families.get(id) ?? []), family];
        this.families.set(id, history.slice(-FAMILY_HISTORY_LIMIT));
      }
    }

    this.touchAndSave();
  }

  /**
   * A group has been chosen. Those chosen start again from zero; those passed
   * over (see selectGame) are one more skip in a row.
   */
  commitSelection(chosenIds: number[], skippedIds: number[]): void {
    this.skipSnapshot = new Map(this.skips);
    for (const id of chosenIds) this.skips.set(id, 0);
    for (const id of skippedIds) this.skips.set(id, this.skipCount(id) + 1);
    this.touchAndSave();
  }

  /**
   * A game has gone onto a court: count it, and (when it was the engine's own
   * suggestion) count those passed over to get it. Unlike calling recordGame and
   * commitSelection separately, this can be taken back with voidGame.
   * Pass `skippedIds` null for a game the engine did not suggest.
   */
  assignGame(players: { id: number }[], gameType: GameType | null, skippedIds: number[] | null): void {
    const ids = players.map(p => p.id);
    const skipped = skippedIds ?? [];

    const priorSkips: [number, number][] = [...ids, ...skipped].map(id => [id, this.skipCount(id)]);
    const priorLast = new Map<string, [number, number] | undefined>();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = pairKey(ids[i], ids[j]);
        const prior = this.lastShared.get(key);
        priorLast.set(key, prior ? [prior[0], prior[1]] : undefined);
      }
    }

    if (skippedIds) this.commitSelection(ids, skippedIds);
    this.recordGame(players, gameType);

    this.deltas.push({
      key: gameKey(ids),
      ids,
      family: familyOf(gameType),
      skippedIds: skipped,
      priorSkips,
      pairLast: Array.from(priorLast, ([pair, prior]) => {
        const set = this.lastShared.get(pair)!;
        return { pair, prior, set: [set[0], set[1]] as [number, number] };
      }),
    });
    if (this.deltas.length > UNDO_LIMIT) this.deltas.shift();
  }

  /**
   * A game put on a court with assignGame was voided: it never happened. Takes
   * back its games played, pairings, format and skips, leaving anything that has
   * happened since untouched. Returns false if there is nothing to take back.
   */
  voidGame(players: { id: number }[]): boolean {
    const key = gameKey(players.map(p => p.id));
    const index = this.deltas.map(d => d.key).lastIndexOf(key);
    if (index === -1) return false;
    const [delta] = this.deltas.splice(index, 1);

    for (const id of delta.ids) {
      this.played.set(id, Math.max(0, this.gamesPlayed(id) - 1));

      if (delta.family) {
        const history = [...(this.families.get(id) ?? [])];
        const last = history.lastIndexOf(delta.family);
        if (last !== -1) history.splice(last, 1);
        this.families.set(id, history);
      }
    }

    for (const { pair, prior, set } of delta.pairLast) {
      const count = (this.pairCounts.get(pair) ?? 0) - 1;
      if (count > 0) this.pairCounts.set(pair, count);
      else this.pairCounts.delete(pair);

      // Only rewind "last shared" if no later game involving the pair has moved it on
      const current = this.lastShared.get(pair);
      if (current && current[0] === set[0] && current[1] === set[1]) {
        if (prior) this.lastShared.set(pair, prior);
        else this.lastShared.delete(pair);
      }
    }

    const before = new Map(delta.priorSkips);
    for (const id of delta.ids) {
      if (this.skipCount(id) === 0) this.skips.set(id, before.get(id) ?? 0);
    }
    for (const id of delta.skippedIds) {
      this.skips.set(id, Math.max(0, this.skipCount(id) - 1));
    }

    this.touchAndSave();
    return true;
  }

  /** The last chosen group was cleared before it was played: take back its skips. */
  undoSelection(): void {
    if (!this.skipSnapshot) return;
    this.skips = this.skipSnapshot;
    this.skipSnapshot = null;
    this.touchAndSave();
  }

  /** Start afresh, e.g. when a session ends. */
  reset(): void {
    this.pairCounts.clear();
    this.lastShared.clear();
    this.played.clear();
    this.families.clear();
    this.skips.clear();
    this.skipSnapshot = null;
    this.deltas = [];
    this.lastActivity = Date.now();
    try {
      this.storage?.removeItem(MIX_TRACKER_KEY);
    } catch (e) {
      console.error("Error clearing mix tracker:", e);
    }
  }

  // ---- storage -------------------------------------------------------------

  private touchAndSave() {
    this.lastActivity = Date.now();
    if (!this.storage) return;

    const state: SavedState = {
      pairCounts: Array.from(this.pairCounts),
      lastShared: Array.from(this.lastShared),
      played: Array.from(this.played),
      families: Array.from(this.families),
      skips: Array.from(this.skips),
      lastActivity: this.lastActivity,
    };
    try {
      this.storage.setItem(MIX_TRACKER_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Error saving mix tracker:", e);
    }
  }

  private load() {
    if (!this.storage) return;
    try {
      const stored = this.storage.getItem(MIX_TRACKER_KEY);
      if (!stored) return;

      const state: SavedState = JSON.parse(stored);
      if (Date.now() - state.lastActivity > SESSION_GAP_MS) {
        // From an earlier night that was never ended: start afresh
        this.storage.removeItem(MIX_TRACKER_KEY);
        return;
      }

      this.pairCounts = new Map(state.pairCounts);
      this.lastShared = new Map(state.lastShared);
      this.played = new Map(state.played);
      this.families = new Map(state.families);
      this.skips = new Map(state.skips);
      this.lastActivity = state.lastActivity;
    } catch (e) {
      console.error("Error loading mix tracker:", e);
    }
  }
}

/** The tracker the app uses, shared by everything in the session. */
export const mixTracker = new MixTracker();
