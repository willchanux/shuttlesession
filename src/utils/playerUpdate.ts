import { PlayPreference } from "../types/member";

export interface PlayerUpdate {
  id?: number;
  name: string;
  gender?: "male" | "female";
  isGuest?: boolean;
  playPreferences?: PlayPreference[];
}

/** The changed details applied to whichever player in the list they belong to (by id, else by name). */
export function applyPlayerUpdate<T extends { id: number; name: string }>(players: T[], updated: PlayerUpdate): T[] {
  return players.map(player => {
    const matches = updated.id ? player.id === updated.id : player.name === updated.name;
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
