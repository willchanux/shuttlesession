import { PlayPreference } from "../types/member";

export interface PlayerUpdate {
  id?: number;
  /** Their name before this edit, for finding them if their id does not match (see below). */
  previousName?: string;
  name: string;
  gender?: "male" | "female";
  isGuest?: boolean;
  playPreferences?: PlayPreference[];
}

/**
 * The changed details applied to whichever player in the list they belong to:
 * by id, else by their previous name (a player added to a session can carry a
 * different id from their member record), else by name when no id is given.
 */
export function applyPlayerUpdate<T extends { id: number; name: string }>(players: T[], updated: PlayerUpdate): T[] {
  return players.map(player => {
    const matches =
      (updated.id !== undefined && player.id === updated.id) ||
      (updated.previousName !== undefined
        ? player.name === updated.previousName
        : !updated.id && player.name === updated.name);
    if (!matches) return player;
    return {
      ...player,
      name: updated.name,
      ...(updated.gender && { gender: updated.gender }),
      ...(typeof updated.isGuest === "boolean" && { isGuest: updated.isGuest }),
      ...(updated.playPreferences && { playPreferences: updated.playPreferences }),
    };
  });
}
