
import { Player } from "../types/player";
import { getPlannedFormat } from "./mixer/plannedFormats";

/**
 * The format the selection engine deliberately chose for this group, provided
 * it is still possible. Only groups picked by the newer engine have one.
 */
function plannedFormat(
  players: Player[],
  possible: { Mixed: boolean; Ladies: boolean; Open: boolean }
): "Mixed" | "Ladies" | "Open" | null {
  const planned = getPlannedFormat(players);
  return planned && possible[planned] ? planned : null;
}

/**
 * Checks if a set of players can form a valid game based on preferences
 */
export const canFormValidGame = (players: Player[]): boolean => {
  if (players.length !== 4) return false;
  
  // Check if play preferences are enabled
  const prefEnabled = localStorage.getItem("enablePlayerPreferences") === "true";
  if (!prefEnabled) return true;
  
  // Determine the best possible game type for this combination
  const gameType = determineBestGameType(players);
  
  // If no valid game type can be determined, the game is invalid
  return gameType !== null;
};

/**
 * Checks if a player accepts a specific game type based on their preferences
 */
function playerAcceptsGameType(player: Player, gameType: string): boolean {
  const prefs = player.playPreferences || [];
  
  // If player has no preferences set, they accept all game types
  if (prefs.length === 0) return true;
  
  // If player has explicit preferences, they must include this game type
  return prefs.includes(gameType as any);
}

/**
 * Determines the best game type based on players and their preferences
 * Gives priority to preferences of players at the top of the queue
 */
export const determineBestGameType = (players: Player[]): "Mixed" | "Ladies" | "Open" | null => {
  if (players.length !== 4) return null;
  
  // Check if preference feature is enabled
  const prefEnabled = localStorage.getItem("enablePlayerPreferences") === "true";
  if (!prefEnabled) return "Open"; // Default when preferences aren't enabled
  
  // Count genders
  const maleCount = players.filter(p => p.gender === "male").length;
  const femaleCount = players.filter(p => p.gender === "female").length;
  
  // Determine physically possible game types
  const isMixedPossible = maleCount === 2 && femaleCount === 2;
  const isLadiesPossible = femaleCount === 4;
  
  // Get preferences of the highest priority player (top of queue)
  const topPlayerPrefs = players[0]?.playPreferences || [];
  
  // Check if all players accept each game type
  const allAcceptMixed = players.every(p => playerAcceptsGameType(p, "Mixed"));
  const allAcceptLadies = players.every(p => playerAcceptsGameType(p, "Ladies"));
  const allAcceptOpen = players.every(p => playerAcceptsGameType(p, "Open"));

  // A format chosen by the selection engine wins, if it is still possible
  const planned = plannedFormat(players, {
    Mixed: isMixedPossible && allAcceptMixed,
    Ladies: isLadiesPossible && allAcceptLadies,
    Open: allAcceptOpen,
  });
  if (planned) return planned;

  // Priority order: Try to match top player's preference first while ensuring all players accept it
  if (topPlayerPrefs.length > 0) {
    // Check each preference of the top player in order
    for (const pref of topPlayerPrefs) {
      if (pref === "Mixed" && isMixedPossible && allAcceptMixed) return "Mixed";
      if (pref === "Ladies" && isLadiesPossible && allAcceptLadies) return "Ladies";
      if (pref === "Open" && allAcceptOpen) return "Open";
    }
  }
  
  // If top player has no preferences or we couldn't satisfy them, use default priority
  // But still respect what all players can accept
  if (isMixedPossible && allAcceptMixed) return "Mixed";
  if (isLadiesPossible && allAcceptLadies) return "Ladies";
  if (allAcceptOpen) return "Open";
  
  // If we couldn't form a valid game with everyone's preferences
  return null;
};

/**
 * Gets the configured player pool size from localStorage 
 */
export const getPlayerPoolSize = (): number => {
  return Number(localStorage.getItem("playerPoolSize")) || 8;
};

/**
 * Infers the preferred game type from a piggyback pair based on genders
 */
export const inferPiggybackGameTypePreference = (masterPlayer: Player, partnerPlayer: Player): "Mixed" | "Ladies" | "Open" | null => {
  if (!masterPlayer || !partnerPlayer) return null;
  
  const masterGender = masterPlayer.gender;
  const partnerGender = partnerPlayer.gender;
  
  // Two females → prefer Ladies match
  if (masterGender === "female" && partnerGender === "female") {
    return "Ladies";
  }
  
  // Two males → prefer Open match  
  if (masterGender === "male" && partnerGender === "male") {
    return "Open";
  }
  
  // One male, one female → prefer Mixed match
  if ((masterGender === "male" && partnerGender === "female") || 
      (masterGender === "female" && partnerGender === "male")) {
    return "Mixed";
  }
  
  return null;
};

/**
 * Enhanced game type determination that considers piggyback pair preferences
 */
export const determineBestGameTypeWithPiggyback = (
  players: Player[], 
  piggybackPairs?: Array<{ master: number; partner: number }>
): "Mixed" | "Ladies" | "Open" | null => {
  if (players.length !== 4) return null;
  
  // Check if preference feature is enabled
  const prefEnabled = localStorage.getItem("enablePlayerPreferences") === "true";
  if (!prefEnabled) return "Open"; // Default when preferences aren't enabled
  
  // Count genders
  const maleCount = players.filter(p => p.gender === "male").length;
  const femaleCount = players.filter(p => p.gender === "female").length;
  
  // Determine physically possible game types
  const isMixedPossible = maleCount === 2 && femaleCount === 2;
  const isLadiesPossible = femaleCount === 4;
  
  // Check for piggyback pair preferences
  let piggybackPreference: string | null = null;
  if (piggybackPairs && piggybackPairs.length > 0) {
    for (const pair of piggybackPairs) {
      const masterPlayer = players.find(p => p.id === pair.master);
      const partnerPlayer = players.find(p => p.id === pair.partner);
      
      if (masterPlayer && partnerPlayer) {
        piggybackPreference = inferPiggybackGameTypePreference(masterPlayer, partnerPlayer);
        break; // Use first found piggyback pair preference
      }
    }
  }
  
  // Check if all players accept each game type
  const allAcceptMixed = players.every(p => playerAcceptsGameType(p, "Mixed"));
  const allAcceptLadies = players.every(p => playerAcceptsGameType(p, "Ladies"));
  const allAcceptOpen = players.every(p => playerAcceptsGameType(p, "Open"));

  // A format chosen by the selection engine wins, if it is still possible
  const planned = plannedFormat(players, {
    Mixed: isMixedPossible && allAcceptMixed,
    Ladies: isLadiesPossible && allAcceptLadies,
    Open: allAcceptOpen,
  });
  if (planned) return planned;

  // Priority: Piggyback preference first (if valid), then top player preference, then defaults
  if (piggybackPreference) {
    if (piggybackPreference === "Mixed" && isMixedPossible && allAcceptMixed) return "Mixed";
    if (piggybackPreference === "Ladies" && isLadiesPossible && allAcceptLadies) return "Ladies";
    if (piggybackPreference === "Open" && allAcceptOpen) return "Open";
  }
  
  // Fall back to original logic if piggyback preference can't be satisfied
  return determineBestGameType(players);
};
