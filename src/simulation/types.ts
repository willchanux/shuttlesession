import { Player } from "../types/player";

export type GameType = "Mixed" | "Ladies" | "Open";

/** Mixed is one family; Ladies and Open are both "level" games. */
export type Family = "mixed" | "level";

export interface SimConfig {
  /** Total players at the session. */
  players: number;
  /** How many of them are ladies. */
  ladies: number;
  /** Courts actually in use (the app's court count is only a guide). */
  courts: number;
  /** The app's "player pool size" setting. */
  poolSize: number;
  sessionMinutes: number;
  /** Each game lasts a random time in this range. */
  gameMinutes: { min: number; max: number };
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  players: 22,
  ladies: 10,
  courts: 3,
  poolSize: 8,
  sessionMinutes: 180,
  gameMinutes: { min: 12, max: 18 },
};

export interface GameLogEntry {
  index: number;
  startMinute: number;
  endMinute: number;
  playerIds: number[];
  /** What the app would call this game, or null if the group is not a valid game. */
  gameType: GameType | null;
  /** True when the engine found nothing and the first four in the queue were used. */
  forced: boolean;
}

export interface SessionLog {
  config: SimConfig;
  players: Player[];
  games: GameLogEntry[];
  /** Minutes each player waited between joining the queue and starting a game. */
  waits: Record<number, number[]>;
  /**
   * For every run of consecutive times a player in the pool was passed over
   * (someone behind them was picked), how long that run was.
   */
  skipEpisodes: number[];
  selections: number;
  failedSelections: number;
}

export interface EngineContext {
  minute: number;
  config: SimConfig;
}

/**
 * Whatever picks the next four players. The simulator hands it the queue
 * (longest waiting first) and expects four players back, or [] if it can find
 * no valid game.
 */
export interface SelectionEngine {
  name: string;
  /** Called once before the session starts, to reset any state the engine keeps. */
  startSession(players: Player[], config: SimConfig): void;
  select(queue: Player[], ctx: EngineContext): Promise<Player[]>;
  /** Called when the chosen game goes onto a court. */
  recordGame(players: Player[], ctx: EngineContext & { gameType: GameType | null }): void;
}
