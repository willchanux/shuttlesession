
// All references now use IDs exclusively for stats/game records

import { gameHistoryDB } from "./indexedDbUtils";
import { Player } from "../types/player";
import { computeRepeatPenalty, countGamesTogether } from "./repeatPenalty";

/**
 * Gets game history from IndexedDB (returns array of GameRecord objects with IDs)
 */
export const getGameHistory = async (): Promise<any[]> => {
  try {
    const games = await gameHistoryDB.getGameHistory(50);
    return games;
  } catch (e) {
    console.error("Error loading game history from IndexedDB:", e);
    // Fallback to localStorage
    try {
      const history = localStorage.getItem("gameHistory");
      return history ? JSON.parse(history) : [];
    } catch (fallbackError) {
      console.error("Error loading game history from localStorage fallback:", fallbackError);
      return [];
    }
  }
};

/**
 * Gets up to `limit` of the most recent games (newest first) for repeat
 * analysis. Uses IndexedDB, falling back to the (smaller) localStorage copy.
 */
export const getRecentGames = async (limit = 200): Promise<any[]> => {
  try {
    return await gameHistoryDB.getGameHistory(limit);
  } catch (e) {
    console.error("Error loading recent games from IndexedDB:", e);
    try {
      const history = localStorage.getItem("gameHistory");
      return history ? JSON.parse(history) : [];
    } catch (fallbackError) {
      console.error("Error loading recent games from localStorage fallback:", fallbackError);
      return [];
    }
  }
};

/**
 * Records a new game in IndexedDB (with fallback). Now expects complete player objects (with ID) and winner IDs.
 * `gameType` (Mixed / Ladies / Open) is stored with the record when known.
 */
export const recordGame = async (players: Player[], winnerIds?: number[], gameType?: string): Promise<void> => {
  try {
    console.log("gameHistory.recordGame: Recording game", {
      players: players.map(p => ({ id: p.id, name: p.name })),
      winnerIds,
      gameType
    });

    await gameHistoryDB.addGame(players, gameType, undefined, winnerIds);
    console.log("Game recorded in IndexedDB (IDs)");
    
    // Also record in session tracker for enhanced auto-select
    const { sessionTracker } = await import("./sessionTracking");
    sessionTracker.recordGame(players);
  } catch (e) {
    console.error("Error recording game to IndexedDB:", e);

    // Fallback to localStorage
    try {
      const history = await getGameHistory();
      const newGame = {
        playerIds: players.map(p => p.id),
        timestamp: Date.now(),
        gameType,
        winners: winnerIds || []
      };
      const updatedHistory = [newGame, ...history].slice(0, 50);
      localStorage.setItem("gameHistory", JSON.stringify(updatedHistory));
      console.log("Game recorded in localStorage as fallback");
      
      // Also record in session tracker
      const { sessionTracker } = await import("./sessionTracking");
      sessionTracker.recordGame(players);
    } catch (fallbackError) {
      console.error("Error recording game to localStorage fallback:", fallbackError);
    }
  }
};

/**
 * Counts games that included every one of the given player IDs (a pair, or a
 * full group), optionally only games at or after `since` (ms timestamp).
 */
export const getPlayedTogetherCount = async (playerIds: number[], since = 0): Promise<number> => {
  try {
    return await gameHistoryDB.getPlayedTogetherCount(playerIds, since);
  } catch (e) {
    console.error("Error getting played together count by ID from IndexedDB:", e);
    // Fallback to localStorage
    const history = await getGameHistory();
    return countGamesTogether(history, playerIds, since);
  }
};

/**
 * Calculates a penalty score for how often players have played together.
 * Higher score = played together more often. IDs only!
 * Pass `since` to count only games from the current session.
 */
export const calculateRepeatPenalty = async (players: Player[], since = 0): Promise<number> => {
  const games = await getRecentGames();
  return computeRepeatPenalty(players.map(p => p.id), games, since);
};
