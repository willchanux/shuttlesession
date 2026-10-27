import type { GameType } from "./types";

/**
 * Formats the selection engine has chosen for the groups it picked.
 *
 * The app works out a game's type from its players wherever it needs to (the
 * Next Game card, the game history). When the engine has deliberately chosen a
 * format, for example Open for a group that could also be Mixed so that someone
 * gets a change, those places must agree with it. They consult this first.
 *
 * It is a leaf module (it imports only a type) so the validation code can use it
 * without any import cycles.
 */
const planned = new Map<string, GameType>();
const MAX_PLANNED = 24;

const keyOf = (players: { id: number }[]) =>
  players
    .map(p => p.id)
    .sort((a, b) => a - b)
    .join("-");

export function planFormat(players: { id: number }[], gameType: GameType): void {
  const key = keyOf(players);
  planned.delete(key); // so the newest plan is always the last entry
  planned.set(key, gameType);

  if (planned.size > MAX_PLANNED) {
    const oldest = planned.keys().next().value;
    if (oldest !== undefined) planned.delete(oldest);
  }
}

export function getPlannedFormat(players: { id: number }[]): GameType | undefined {
  return planned.get(keyOf(players));
}

/** Forget every plan, e.g. when a session ends. */
export function clearPlannedFormats(): void {
  planned.clear();
}
