import { Player } from "../types/player";
import { determineBestGameTypeWithPiggyback } from "../utils/gameValidation";
import { shuffle } from "../utils/shuffle";
import { createRng } from "./random";
import { makeRoster } from "./roster";
import {
  GameLogEntry,
  GameType,
  SelectionEngine,
  SessionLog,
  SimConfig,
} from "./types";

/** An arbitrary Tuesday evening; only differences in time matter. */
const BASE_TIME = Date.UTC(2026, 0, 6, 18, 0, 0);

interface Court {
  endMinute: number;
  players: Player[];
}

/**
 * Engines read the clock, Math.random and localStorage, so a simulation takes
 * them over for its duration: time only moves when the simulation says so,
 * randomness comes from the seed, and the noisy logging of the engines is
 * silenced. Everything is put back afterwards.
 */
function installWorld(random: () => number, config: SimConfig) {
  const saved = {
    random: Math.random,
    now: Date.now,
    log: console.log,
    info: console.info,
    debug: console.debug,
    warn: console.warn,
    error: console.error,
    preferences: localStorage.getItem("enablePlayerPreferences"),
    poolSize: localStorage.getItem("playerPoolSize"),
  };

  let nowMs = BASE_TIME;
  const quiet = () => {};

  Math.random = random;
  Date.now = () => nowMs;
  console.log = console.info = console.debug = console.warn = console.error = quiet;
  localStorage.setItem("enablePlayerPreferences", "true");
  localStorage.setItem("playerPoolSize", String(config.poolSize));

  const restoreItem = (key: string, value: string | null) =>
    value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value);

  return {
    setMinute(minute: number) {
      nowMs = BASE_TIME + Math.round(minute * 60_000);
    },
    restore() {
      Math.random = saved.random;
      Date.now = saved.now;
      console.log = saved.log;
      console.info = saved.info;
      console.debug = saved.debug;
      console.warn = saved.warn;
      console.error = saved.error;
      restoreItem("enablePlayerPreferences", saved.preferences);
      restoreItem("playerPoolSize", saved.poolSize);
    },
  };
}

/**
 * Replays one club night with the given engine choosing the groups.
 *
 * The flow mirrors the app: everyone joins the queue; the next game is chosen
 * and held while the courts are busy; when a court frees up the held game goes
 * on and the next one is chosen; finished players rejoin the back of the queue
 * in the order they came off court (no winners are recorded).
 */
export async function simulateSession(
  engine: SelectionEngine,
  config: SimConfig,
  seed: number
): Promise<SessionLog> {
  const random = createRng(seed);
  const world = installWorld(random, config);

  try {
    const roster = makeRoster(config.players, config.ladies);
    engine.startSession(roster, config);

    let queue: Player[] = shuffle(roster, random);
    const queueSince = new Map<number, number>(queue.map(p => [p.id, 0]));
    const courts: (Court | null)[] = Array.from({ length: config.courts }, () => null);
    let nextGame: { players: Player[]; forced: boolean } | null = null;
    let minute = 0;

    const log: SessionLog = {
      config,
      players: roster,
      games: [],
      waits: Object.fromEntries(roster.map(p => [p.id, [] as number[]])),
      skipEpisodes: [],
      selections: 0,
      failedSelections: 0,
    };
    const skipRuns = new Map<number, number>();

    /** Works out who was passed over by this pick, among the players in the pool. */
    const recordSkips = (chosen: Player[]) => {
      const pool = queue.slice(0, config.poolSize);
      const chosenIds = new Set(chosen.map(p => p.id));
      let lastChosen = -1;
      pool.forEach((p, i) => {
        if (chosenIds.has(p.id)) lastChosen = i;
      });

      for (let i = 0; i <= lastChosen; i++) {
        const id = pool[i].id;
        if (chosenIds.has(id)) {
          const run = skipRuns.get(id) ?? 0;
          if (run > 0) log.skipEpisodes.push(run);
          skipRuns.set(id, 0);
        } else {
          skipRuns.set(id, (skipRuns.get(id) ?? 0) + 1);
        }
      }
    };

    const prepareNextGame = async () => {
      world.setMinute(minute);
      log.selections++;

      let chosen = await engine.select(queue.slice(), { minute, config });
      let forced = false;
      if (chosen.length !== 4) {
        // The host would have to sort this out by hand: take the first four
        log.failedSelections++;
        chosen = queue.slice(0, 4);
        forced = true;
      }

      recordSkips(chosen);
      const chosenIds = new Set(chosen.map(p => p.id));
      queue = queue.filter(p => !chosenIds.has(p.id));
      nextGame = { players: chosen, forced };
    };

    const putNextGameOnCourt = (courtIndex: number) => {
      const { players, forced } = nextGame!;
      world.setMinute(minute);

      const gameType: GameType | null = determineBestGameTypeWithPiggyback(players, []);
      const duration =
        config.gameMinutes.min + random() * (config.gameMinutes.max - config.gameMinutes.min);

      const entry: GameLogEntry = {
        index: log.games.length,
        startMinute: minute,
        endMinute: minute + duration,
        playerIds: players.map(p => p.id),
        gameType,
        forced,
      };
      log.games.push(entry);
      engine.recordGame(players, { minute, config, gameType });

      for (const p of players) {
        log.waits[p.id].push(minute - (queueSince.get(p.id) ?? 0));
      }
      courts[courtIndex] = { endMinute: entry.endMinute, players };
      nextGame = null;
    };

    /** Keep a game held and keep every free court busy, as far as the queue allows. */
    const settle = async () => {
      for (;;) {
        const freeCourt = courts.findIndex(c => c === null);
        if (nextGame && freeCourt !== -1) {
          putNextGameOnCourt(freeCourt);
        } else if (!nextGame && queue.length >= 4) {
          await prepareNextGame();
        } else {
          break;
        }
      }
    };

    await settle();

    for (;;) {
      let soonest = -1;
      courts.forEach((court, i) => {
        if (court && (soonest === -1 || court.endMinute < courts[soonest]!.endMinute)) soonest = i;
      });
      if (soonest === -1 || courts[soonest]!.endMinute >= config.sessionMinutes) break;

      const finished = courts[soonest]!;
      minute = finished.endMinute;
      courts[soonest] = null;

      // Players rejoin the back of the queue in the order they came off court
      for (const p of finished.players) {
        queue.push(p);
        queueSince.set(p.id, minute);
      }
      await settle();
    }

    // Anyone still being passed over when the night ends counts as a run too
    for (const run of skipRuns.values()) {
      if (run > 0) log.skipEpisodes.push(run);
    }
    return log;
  } finally {
    world.restore();
  }
}
