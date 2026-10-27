import { Player } from "../../types/player";
import { inferPiggybackGameTypePreference } from "../gameValidation";
import { Family, GameType, Pair } from "./types";

export function familyOf(gameType: GameType | null): Family | null {
  if (gameType === "Mixed") return "mixed";
  if (gameType === "Ladies" || gameType === "Open") return "level";
  return null;
}

/** No preferences set means willing to play anything. */
export function acceptsFormat(player: Player, format: GameType): boolean {
  const prefs = player.playPreferences ?? [];
  return prefs.length === 0 || prefs.includes(format);
}

/**
 * Where this format sits in the player's own ordering (0 = their first choice).
 * Players with no preferences have no ordering, so every format is 0.
 */
export function preferenceRank(player: Player, format: GameType): number {
  const prefs = player.playPreferences ?? [];
  const index = prefs.indexOf(format);
  return prefs.length === 0 || index < 0 ? 0 : index;
}

/**
 * Whether the player could be given both kinds of game (Mixed and a level
 * game), judged only on their preferences and gender. Someone who can only ever
 * get one kind has nothing to rotate between.
 */
export function canPlayBothFamilies(player: Player): boolean {
  const prefs = player.playPreferences ?? [];
  if (prefs.length === 0) return true;

  const mixed = prefs.includes("Mixed");
  const level =
    player.gender === "female"
      ? prefs.includes("Ladies") || prefs.includes("Open")
      : prefs.includes("Open");
  return mixed && level;
}

export interface FormatOptions {
  /** The app's "player preferences" setting. Off means every game is simply Open. */
  preferencesEnabled: boolean;
  piggybackPairs?: Pair[];
}

/**
 * The formats a group of four could be played as, in the app's usual order of
 * precedence (Mixed, Ladies, Open). Empty when no format suits all four.
 *
 * Mixed needs two men and two ladies, Ladies needs four ladies, and Open can be
 * any group. Everyone must accept the format. As elsewhere in the app, a
 * piggyback pair's implied format wins when it is possible.
 */
export function feasibleFormats(players: Player[], options: FormatOptions): GameType[] {
  if (players.length !== 4) return [];
  if (!options.preferencesEnabled) return ["Open"];

  const men = players.filter(p => p.gender === "male").length;
  const ladies = players.filter(p => p.gender === "female").length;
  const everyoneAccepts = (format: GameType) => players.every(p => acceptsFormat(p, format));

  const formats: GameType[] = [];
  if (men === 2 && ladies === 2 && everyoneAccepts("Mixed")) formats.push("Mixed");
  if (ladies === 4 && everyoneAccepts("Ladies")) formats.push("Ladies");
  if (everyoneAccepts("Open")) formats.push("Open");

  for (const pair of options.piggybackPairs ?? []) {
    const master = players.find(p => p.id === pair.master);
    const partner = players.find(p => p.id === pair.partner);
    if (!master || !partner) continue;

    const implied = inferPiggybackGameTypePreference(master, partner);
    if (implied && formats.includes(implied)) return [implied];
    break; // as in the rest of the app, only the first pair found counts
  }

  return formats;
}
