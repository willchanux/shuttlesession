import { findBestCombination } from "../utils/gameSelection";
import type { MixerWeights } from "../utils/mixer/costs";
import { MixTracker } from "../utils/mixer/mixTracker";
import { clearPlannedFormats, planFormat } from "../utils/mixer/plannedFormats";
import { selectGame } from "../utils/mixer/selectGame";
import { sessionTracker } from "../utils/sessionTracking";
import { SelectionEngine } from "./types";

const HISTORY_KEY = "gameHistory";
const HISTORY_LIMIT = 200; // what the app reads back for repeat scoring

/**
 * The selection logic the app uses today, driven exactly as the app drives it:
 * the pool is the first N active players in the queue, then findBestCombination
 * picks from it. Game history is kept where the engine falls back to reading
 * it when no browser database is available.
 */
export const currentEngine: SelectionEngine = {
  name: "Current engine",

  startSession() {
    localStorage.removeItem(HISTORY_KEY);
    sessionTracker.resetSession();
    clearPlannedFormats();
  },

  async select(queue, { config }) {
    const pool = queue.filter(p => !p.isResting).slice(0, config.poolSize);
    return findBestCombination(pool, []);
  },

  recordGame(players, { gameType }) {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    history.unshift({ playerIds: players.map(p => p.id), timestamp: Date.now(), gameType });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
    sessionTracker.recordGame(players);
  },
};

/**
 * A control: always the first four in the queue, with no thought for who has
 * played whom. Shows how much mixing the queue order alone produces.
 */
export const queueOrderEngine: SelectionEngine = {
  name: "Queue order only",
  startSession() {
    clearPlannedFormats();
  },
  async select(queue) {
    return queue.slice(0, 4);
  },
  recordGame() {},
};

/**
 * The newer engine (src/utils/mixer). Its memory of the night lives in a
 * tracker made fresh for each simulated night and kept only in memory.
 * `weights` lets different tunings be compared.
 */
export function createMixerEngine(
  name = "Mixer engine",
  weights: Partial<MixerWeights> = {},
  /** Minutes within which players who came off court count as having waited equally. */
  waveMinutes?: number
): SelectionEngine {
  let tracker = new MixTracker({ storage: null });

  return {
    name,

    startSession() {
      tracker = new MixTracker({ storage: null });
      clearPlannedFormats();
    },

    async select(queue, { config, waitingSince }) {
      const active = queue.filter(p => !p.isResting);
      const result = selectGame({
        queue: active,
        poolSize: config.poolSize,
        tracker,
        preferencesEnabled: true,
        weights,
        queuedAt: waveMinutes === undefined ? undefined : waitingSince,
        waveWindow: waveMinutes,
      });
      if (!result) return [];

      tracker.commitSelection(
        result.players.map(p => p.id),
        result.reasons.skipped.map(s => s.id)
      );
      if (result.gameType) planFormat(result.players, result.gameType);
      return result.players;
    },

    recordGame(players, { gameType }) {
      tracker.recordGame(players, gameType);
    },
  };
}

export const mixerEngine = createMixerEngine();
