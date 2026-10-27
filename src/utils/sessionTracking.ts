import { Player } from "../types/player";

export interface SessionStats {
  playerId: number;
  gamesPlayed: number;
  lastGameTime?: number;
  recentCombinations: number[][]; // Track recent 4-player combinations this player was in
}

const SESSION_STATS_KEY = "currentSessionStats";
const COOLING_PERIOD_GAMES = 2; // Number of games to wait before prioritizing again
const RECENT_COMBINATIONS_LIMIT = 5; // Track last 5 combinations per player
// If nothing has happened for this long, saved stats belong to an earlier session
const SESSION_GAP_MS = 8 * 60 * 60 * 1000;

/**
 * True when saved session stats are too old to be part of the current session:
 * the latest activity (the most recent game, or the session start if no game has
 * been played) is further back than `gapMs`.
 *
 * Sessions are normally cleared when they are ended, but if the app is simply
 * closed that never happens, and last week's games would otherwise count as
 * "tonight" for repeat scoring.
 */
export function isStaleSession(
  stats: Iterable<SessionStats>,
  sessionStart: number,
  now: number,
  gapMs: number = SESSION_GAP_MS
): boolean {
  let lastActivity = sessionStart;
  for (const playerStats of stats) {
    if (playerStats.lastGameTime && playerStats.lastGameTime > lastActivity) {
      lastActivity = playerStats.lastGameTime;
    }
  }
  return now - lastActivity > gapMs;
}

export class SessionTracker {
  private stats: Map<number, SessionStats> = new Map();
  private sessionStartTime = Date.now();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(SESSION_STATS_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const stats = new Map<number, SessionStats>(data.stats || []);
        const sessionStart: number = data.sessionStart || Date.now();

        if (isStaleSession(stats.values(), sessionStart, Date.now())) {
          // Left over from an earlier session that was never ended: start afresh
          this.stats = new Map();
          this.sessionStartTime = Date.now();
          this.saveToStorage();
          return;
        }

        this.stats = stats;
        this.sessionStartTime = sessionStart;
      }
    } catch (e) {
      console.error("Error loading session stats:", e);
    }
  }

  private saveToStorage() {
    try {
      const data = {
        stats: Array.from(this.stats.entries()),
        sessionStart: this.sessionStartTime
      };
      localStorage.setItem(SESSION_STATS_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Error saving session stats:", e);
    }
  }

  /**
   * Record that a game was played with these players
   */
  recordGame(players: Player[]) {
    const playerIds = players.map(p => p.id);
    const gameTime = Date.now();

    playerIds.forEach(playerId => {
      const existing = this.stats.get(playerId) || {
        playerId,
        gamesPlayed: 0,
        recentCombinations: []
      };

      existing.gamesPlayed++;
      existing.lastGameTime = gameTime;
      
      // Add this combination to recent combinations (store other player IDs)
      const otherPlayers = playerIds.filter(id => id !== playerId).sort();
      existing.recentCombinations.unshift(otherPlayers);
      
      // Keep only recent combinations
      if (existing.recentCombinations.length > RECENT_COMBINATIONS_LIMIT) {
        existing.recentCombinations = existing.recentCombinations.slice(0, RECENT_COMBINATIONS_LIMIT);
      }

      this.stats.set(playerId, existing);
    });

    this.saveToStorage();
  }

  /**
   * Timestamp (ms) when the current session started. Used to limit repeat
   * history to tonight's games rather than every game ever recorded.
   */
  getSessionStart(): number {
    return this.sessionStartTime;
  }

  /**
   * Get games played count for a player this session
   */
  getGamesPlayedCount(playerId: number): number {
    return this.stats.get(playerId)?.gamesPlayed || 0;
  }

  /**
   * Check if player is in cooling period (recently played)
   */
  isInCoolingPeriod(playerId: number): boolean {
    const playerStats = this.stats.get(playerId);
    if (!playerStats || !playerStats.lastGameTime) return false;

    // Check if this player has played more recently than others
    const allLastGameTimes = Array.from(this.stats.values())
      .map(s => s.lastGameTime || 0)
      .filter(t => t > 0)
      .sort((a, b) => b - a); // Most recent first

    if (allLastGameTimes.length < COOLING_PERIOD_GAMES) return false;

    const coolingThreshold = allLastGameTimes[COOLING_PERIOD_GAMES - 1];
    return playerStats.lastGameTime! > coolingThreshold;
  }

  /**
   * Calculate session balance score for a player (higher = needs more games)
   */
  getSessionBalanceScore(playerId: number): number {
    const playerGames = this.getGamesPlayedCount(playerId);
    
    // Get average games played by all players
    const allGamesCounts = Array.from(this.stats.values()).map(s => s.gamesPlayed);
    const averageGames = allGamesCounts.length > 0 
      ? allGamesCounts.reduce((sum, count) => sum + count, 0) / allGamesCounts.length 
      : 0;

    // Return positive score for players who need more games
    return Math.max(0, averageGames - playerGames);
  }

  /**
   * Calculate variety bonus for a combination (higher = more variety)
   */
  getVarietyBonus(players: Player[]): number {
    const playerIds = players.map(p => p.id);
    let varietyScore = 10; // Base variety score

    // Check each player's recent combinations
    playerIds.forEach(playerId => {
      const playerStats = this.stats.get(playerId);
      if (!playerStats) return;

      const otherPlayersInThisCombination = playerIds.filter(id => id !== playerId).sort();
      
      // Check if this exact combination (minus this player) was recent
      const hasRecentSimilarCombination = playerStats.recentCombinations.some(recentCombo => {
        return recentCombo.length === otherPlayersInThisCombination.length &&
               recentCombo.every(id => otherPlayersInThisCombination.includes(id));
      });

      if (hasRecentSimilarCombination) {
        varietyScore -= 3; // Penalty for repeating exact combination
      }

      // Smaller penalty for any overlap with recent combinations
      const overlapCount = playerStats.recentCombinations.reduce((overlap, recentCombo) => {
        return overlap + recentCombo.filter(id => otherPlayersInThisCombination.includes(id)).length;
      }, 0);

      varietyScore -= overlapCount * 0.5;
    });

    return Math.max(0, varietyScore);
  }

  /**
   * Reset session stats (new session)
   */
  resetSession() {
    this.stats.clear();
    this.sessionStartTime = Date.now();
    this.saveToStorage();
  }

  /**
   * Get all session stats for debugging
   */
  getSessionStats() {
    return {
      stats: Array.from(this.stats.entries()),
      sessionStart: this.sessionStartTime
    };
  }
}

// Singleton instance
export const sessionTracker = new SessionTracker();
