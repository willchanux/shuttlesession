import { CourtPlayer } from "../types/DashboardTypes";

/**
 * Copies a player for placing on, or releasing from, a court.
 *
 * Keeps every field the player already has, in particular play preferences and
 * rating. Rebuilding the player from a short list of fields used to drop them,
 * so a player who had been on a court came back to the queue with no
 * preferences and was treated as willing to play any game type.
 */
export function toCourtPlayer<T extends CourtPlayer>(player: T): T & { isGuest: boolean } {
  return { ...player, isGuest: player.isGuest || false };
}
