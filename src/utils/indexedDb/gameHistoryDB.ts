
/**
 * Main GameHistoryDB class that orchestrates all IndexedDB operations
 */

import { DatabaseManager } from './database';
import { GameRecordsManager } from './gameRecords';
import { PlayerStatsManager } from './playerStats';
import { MigrationManager } from './migration';
import { GameRecord, PlayerStats } from './types';

export class GameHistoryDB {
  private dbManager: DatabaseManager;
  private gameRecordsManager: GameRecordsManager;
  private playerStatsManager: PlayerStatsManager;
  private migrationManager: MigrationManager;

  constructor() {
    this.dbManager = new DatabaseManager();
    this.gameRecordsManager = new GameRecordsManager(this.dbManager);
    this.playerStatsManager = new PlayerStatsManager(this.dbManager, this.gameRecordsManager);
    this.migrationManager = new MigrationManager(this.dbManager, this.gameRecordsManager);
  }

  async init(): Promise<void> {
    return this.dbManager.init();
  }

  /**
   * Adds a game record using player IDs. (Legacy: accepts names only if needed)
   */
  async addGame(
    players: { id: number; name: string }[],
    gameType?: string,
    courtId?: number,
    winnerIds?: number[]
  ): Promise<void> {
    await this.gameRecordsManager.addGame(players, gameType, courtId, winnerIds);
    await this.playerStatsManager.updatePlayerStats(players, winnerIds);
  }

  /**
   * Returns recent games using player IDs.
   */
  async getGameHistory(limit: number = 50): Promise<GameRecord[]> {
    return this.gameRecordsManager.getGameHistory(limit);
  }

  /**
   * A recorded game was voided: remove it, and take it back out of the players'
   * lifetime totals. Returns whether a matching game was found.
   */
  async removeLatestGame(playerIds: number[]): Promise<boolean> {
    const removed = await this.gameRecordsManager.removeLatestGame(playerIds);
    if (!removed) return false;
    await this.playerStatsManager.reversePlayerStats(playerIds, removed.winners);
    return true;
  }

  async getGamesWithPlayerIds(playerIds: number[], since = 0): Promise<GameRecord[]> {
    return this.gameRecordsManager.getGamesWithPlayerIds(playerIds, since);
  }

  /**
   * Get PlayerStats by playerId (preferred). For legacy support, can fallback to name.
   */
  async getPlayerStats(playerId: number): Promise<PlayerStats | null> {
    return this.playerStatsManager.getPlayerStats(playerId);
  }

  async getPlayedTogetherCount(playerIds: number[], since = 0): Promise<number> {
    return this.gameRecordsManager.getPlayedTogetherCount(playerIds, since);
  }

  async migrateFromLocalStorage(): Promise<void> {
    return this.migrationManager.migrateFromLocalStorage();
  }

  async clearOldGames(keepDays: number = 30): Promise<void> {
    return this.gameRecordsManager.clearOldGames(keepDays);
  }

  // Reset all player stats
  async clearAllPlayerStats(): Promise<void> {
    return this.playerStatsManager.clearAllPlayerStats();
  }
}
