
/**
 * Game records management for IndexedDB
 */

import { GameRecord } from './types';
import { DatabaseManager } from './database';
import { countGamesTogether, gameIncludesAllPlayers } from '../repeatPenalty';

export class GameRecordsManager {
  constructor(private dbManager: DatabaseManager) {}

  /**
   * Adds a game record using player IDs. (Legacy: accepts names only if needed)
   */
  async addGame(
    players: { id: number; name: string }[], // [{id, name}, ...] from Player[]
    gameType?: string,
    courtId?: number,
    winnerIds?: number[]
  ): Promise<void> {
    const db = await this.dbManager.ensureInit();

    const transaction = db.transaction(['gameHistory'], 'readwrite');
    const gameStore = transaction.objectStore('gameHistory');

    // Map player objects to their IDs and names for stats
    const playerIds = players.map(p => p.id);
    const playerNames = players.map(p => p.name);

    const game: GameRecord = {
      playerIds,
      timestamp: Date.now(),
      gameType,
      courtId,
      winners: winnerIds,
      // For legacy support:
      players: playerNames,
      legacyWinners: undefined, // no longer used
    };

    // Add game record
    await new Promise((resolve, reject) => {
      const request = gameStore.add(game);
      request.onsuccess = () => {
        console.log("IndexedDB: Added game record (IDs)", game);
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Returns recent games using player IDs.
   */
  async getGameHistory(limit: number = 50): Promise<GameRecord[]> {
    const db = await this.dbManager.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['gameHistory'], 'readonly');
      const store = transaction.objectStore('gameHistory');
      const index = store.index('timestamp');

      const request = index.openCursor(null, 'prev');
      const games: GameRecord[] = [];
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && count < limit) {
          games.push(cursor.value);
          count++;
          cursor.continue();
        } else {
          resolve(games);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Deletes the most recent game played by exactly these players (used when a
   * game is voided). Returns whether one was found.
   */
  async removeLatestGame(playerIds: number[]): Promise<boolean> {
    const db = await this.dbManager.ensureInit();
    const wanted = [...playerIds].sort((a, b) => a - b).join("-");

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['gameHistory'], 'readwrite');
      const index = transaction.objectStore('gameHistory').index('timestamp');
      const request = index.openCursor(null, 'prev');
      let removed = false;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (!cursor) return;
        const ids: number[] | undefined = cursor.value.playerIds;
        if (Array.isArray(ids) && [...ids].sort((a, b) => a - b).join("-") === wanted) {
          cursor.delete();
          removed = true;
          return; // stop here: only the latest
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve(removed);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Returns recent games that include every one of `playerIds`, optionally only
   * those recorded at or after `since` (ms timestamp).
   *
   * A game matches when all the given players took part in it, so a pair
   * lookup finds the four-player games the pair played in. Only id-based
   * records can match; legacy name-only records are ignored.
   */
  async getGamesWithPlayerIds(playerIds: number[], since = 0): Promise<GameRecord[]> {
    const allGames = await this.getGameHistory(200);

    return allGames.filter(game =>
      (game.timestamp ?? 0) >= since && gameIncludesAllPlayers(game, playerIds)
    );
  }

  async getPlayedTogetherCount(playerIds: number[], since = 0): Promise<number> {
    const games = await this.getGameHistory(200);
    return countGamesTogether(games, playerIds, since);
  }

  async clearOldGames(keepDays: number = 30): Promise<void> {
    const db = await this.dbManager.ensureInit();

    const cutoffTime = Date.now() - keepDays * 24 * 60 * 60 * 1000;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['gameHistory'], 'readwrite');
      const store = transaction.objectStore('gameHistory');
      const index = store.index('timestamp');

      const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }
}
