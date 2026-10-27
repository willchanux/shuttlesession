import { Player } from "../../types/player";
import { DEFAULT_WEIGHTS } from "./costs";
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
  gameType: GameType | null;
  names: Map<number, string>;
  piggybackPairs: { master: number; partner: number }[];
}

let current: Suggestion | null = null;

const keyOf = (players: { id: number }[]) =>
  players
    .map(p => p.id)
    .sort((a, b) => a - b)
    .join("-");

export function rememberSuggestion(
  result: SelectGameResult,
  pool: { id: number; name: string }[] = [],
  piggybackPairs: { master: number; partner: number }[] = []
): void {
  current = {
    key: keyOf(result.players),
    chosenIds: result.players.map(p => p.id),
    skippedIds: result.reasons.skipped.map(s => s.id),
    reasons: result.reasons,
    gameType: result.gameType,
    names: new Map([...pool, ...result.players].map(p => [p.id, p.name])),
    piggybackPairs,
  };
}

/** Why the engine chose this group, if these are the players it suggested. */
export function reasonsFor(players: { id: number }[]): SelectionReasons | null {
  return current && current.key === keyOf(players) ? current.reasons : null;
}

/** A game has been put on a court. */
export function onGameAssigned(players: Player[], gameType: GameType | null): void {
  const asSuggested = current !== null && current.key === keyOf(players);
  mixTracker.assignGame(players, gameType, asSuggested ? current!.skippedIds : null);
  current = null;
}

/** A game on a court was voided: take it back out of the night's record. */
export function onGameVoided(players: { id: number }[]): void {
  mixTracker.voidGame(players);
}

/** Forget the night, e.g. when the session ends. */
export function endMixerSession(): void {
  current = null;
  mixTracker.reset();
  clearPlannedFormats();
}

/** Has this player been passed over as often as allowed, so that they play in the next game picked? */
export function playsNext(playerId: number): boolean {
  return isMixerEngineEnabled() && mixTracker.skipCount(playerId) >= DEFAULT_WEIGHTS.maxSkips;
}

/**
 * Short plain-English reasons for the suggested game, or null when these are not
 * the players the engine suggested (e.g. the host picked them by hand).
 */
export function explainSuggestion(players: { id: number }[]): string[] | null {
  if (!current || current.key !== keyOf(players) || !isMixerEngineEnabled()) return null;
  const { reasons, names } = current;
  const name = (id: number) => names.get(id) ?? "A player";
  const list = (ids: number[]) => {
    const all = ids.map(name);
    return all.length <= 1 ? all.join("") : `${all.slice(0, -1).join(", ")} and ${all[all.length - 1]}`;
  };

  const lines: string[] = [];
  lines.push(`${name(reasons.longestWaiterId)} has been waiting longest.`);

  const forcedOthers = reasons.forcedIds.filter(id => id !== reasons.longestWaiterId);
  if (forcedOthers.length > 0) {
    lines.push(`${list(forcedOthers)} ${forcedOthers.length > 1 ? "have" : "has"} been passed over already.`);
  }

  if (reasons.freshPairs === 6) lines.push("Everyone is playing with someone new.");
  else if (reasons.freshPairs > 0) lines.push(`${reasons.freshPairs} of the 6 pairings are new tonight.`);

  for (const pair of current.piggybackPairs) {
    if (players.some(p => p.id === pair.master) && players.some(p => p.id === pair.partner)) {
      lines.push(`${list([pair.master, pair.partner])} are piggybacked, so they play together.`);
    }
  }

  if (reasons.skipped.length > 0) {
    lines.push(`Passed over this time: ${list(reasons.skipped.map(s => s.id))}.`);
  }
  return lines;
}
