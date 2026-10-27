import { Player } from "../../types/player";
import { mixTracker } from "./mixTracker";
import { clearPlannedFormats } from "./plannedFormats";
import type { SelectGameResult, SelectionReasons } from "./selectGame";
import type { GameType } from "./types";

/** localStorage key; the value "mixer" turns the mixer engine on. */
export const SELECTION_ENGINE_KEY = "selectionEngine";

export function isMixerEngineEnabled(): boolean {
  try {
    return localStorage.getItem(SELECTION_ENGINE_KEY) === "mixer";
  } catch {
    return false;
  }
}

/**
 * The game the engine last suggested, held until it is either put on a court or
 * replaced. Nothing is added to the tracker when a suggestion is made: a
 * suggestion only counts if the game is played as suggested. If the host picks
 * different players, nobody is counted as skipped and nobody is forced into a
 * later game because of it.
 */
interface Suggestion {
  key: string;
  chosenIds: number[];
  skippedIds: number[];
  reasons: SelectionReasons;
}

let current: Suggestion | null = null;

const keyOf = (players: { id: number }[]) =>
  players
    .map(p => p.id)
    .sort((a, b) => a - b)
    .join("-");

export function rememberSuggestion(result: SelectGameResult): void {
  current = {
    key: keyOf(result.players),
    chosenIds: result.players.map(p => p.id),
    skippedIds: result.reasons.skipped.map(s => s.id),
    reasons: result.reasons,
  };
}

/** Why the engine chose this group, if these are the players it suggested. */
export function reasonsFor(players: { id: number }[]): SelectionReasons | null {
  return current && current.key === keyOf(players) ? current.reasons : null;
}

/** A game has been put on a court. */
export function onGameAssigned(players: Player[], gameType: GameType | null): void {
  if (current && current.key === keyOf(players)) {
    mixTracker.commitSelection(current.chosenIds, current.skippedIds);
  }
  current = null;
  mixTracker.recordGame(players, gameType);
}

/** Forget the night, e.g. when the session ends. */
export function endMixerSession(): void {
  current = null;
  mixTracker.reset();
  clearPlannedFormats();
}
