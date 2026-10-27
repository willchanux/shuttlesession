
/**
 * Player statistics management for IndexedDB
 */

import { PlayerStats, GameRecord } from './types';
import { DatabaseManager } from './database';
import { GameRecordsManager } from './gameRecords';

export class PlayerStatsManager {
  constructor(
    private dbManager: DatabaseManager,
    private gameRecordsManager: GameRecordsManager
  ) {}

  /**
   * Get PlayerStats by playerId (preferred). For legacy support, can fallback to name.
   */
  async getPlayerStats(playerId: number): Promise<PlayerStats | null> {
    const db = await this.dbManager.ensureInit();

    return new Promise(async (resolve, reject) => {
      const transaction = db.transaction(['playerStats'], 'readonly');
      const store = transaction.objectStore('playerStats');
      const request = store.get(playerId);

      request.onsuccess = async () => {
        if (request.result) {
          // Found in playerStats
          resolve(request.result);
        } else {
          // Not found – try to reconstruct from gameHistory by ID
          console.log(`[PATCH] playerStats for ID ${playerId} missing, rebuilding...`);
          try {
            const allGames: GameRecord[] = await this.gameRecordsManager.getGameHistory(10000);
            let gamesPlayed = 0;
            let wins = 0;
            let losses = 0;
            let lastPlayed = 0;
            const partners: Record<number, number> = {};
            // To get a player's name for stats
            let playerName = "";
            
            for (const game of allGames) {
              if (
                Array.isArray(game.playerIds) &&
                game.playerIds.includes(playerId)
              ) {
                gamesPlayed += 1;
                lastPlayed = Math.max(lastPlayed, game.timestamp);

                // Lookup name for legacy games or just copy from first match
                if (!playerName && Array.isArray(game.players) && Array.isArray(game.playerIds)) {
                  const idx = game.playerIds.findIndex((id) => id === playerId);
                  if (idx >= 0 && game.players && game.players[idx]) {
                    playerName = game.players[idx];
                  }
                }

                // Add partner counts
                for (const id of game.playerIds) {
                  if (id !== playerId) {
                    partners[id] = (partners[id] || 0) + 1;
                  }
                }
                // Score win/loss if info available
                if ('winners' in game && Array.isArray(game.winners)) {
                  if (game.winners.includes(playerId)) wins++;
                  else losses++;
                }
                // Fallback: legacy games, match by index in winners (not implemented - all modern games should use IDs)
              }
            }
            
            if (gamesPlayed === 0) {
              resolve(null);
              return;
            }
            
            const stats: PlayerStats = {
              playerId,
              name: playerName,
              gamesPlayed,
              lastPlayed,
              partners,
              wins,
              losses,
            };
            
            // Save for future
            const writeTxn = db.transaction(['playerStats'], 'readwrite');
            const writeStore = writeTxn.objectStore('playerStats');
            const putReq = writeStore.put(stats);
            putReq.onsuccess = () => {
              console.log(`[PATCH] playerStats for playerId=${playerId} rebuilt`, stats);
              resolve(stats);
            };
            putReq.onerror = () => {
              console.error(`[PATCH] Failed to save rebuilt playerStats for ID`, playerId, putReq.error);
              resolve(stats);
            };
          } catch (err) {
            console.error(`[PATCH] Error rebuilding stats for ID ${playerId}:`, err);
            resolve(null);
          }
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updatePlayerStats(
    players: { id: number; name: string }[],
    winnerIds?: number[]
  ): Promise<void> {
    const db = await this.dbManager.ensureInit();
    const transaction = db.transaction(['playerStats'], 'readwrite');
    const statsStore = transaction.objectStore('playerStats');

    // Update player stats (by ID!)
    for (const player of players) {
      const stats = (await this.getPlayerStats(player.id)) || {
        playerId: player.id,
        name: player.name,
        gamesPlayed: 0,
        lastPlayed: 0,
        partners: {},
        wins: 0,
        losses: 0
      };

      stats.gamesPlayed += 1;
      stats.lastPlayed = Date.now();

      // Update partner counts
      for (const partner of players) {
        if (partner.id !== player.id) {
          stats.partners[partner.id] = (stats.partners[partner.id] || 0) + 1;
        }
      }

      // If this is a win/loss record, update accordingly
      if (winnerIds && Array.isArray(winnerIds)) {
        if (winnerIds.includes(player.id)) {
          stats.wins += 1;
        } else {
          stats.losses += 1;
        }
      }
      
      await new Promise((resolve, reject) => {
        const request = statsStore.put(stats);
        request.onsuccess = () => {
          console.log(`IndexedDB: Updated playerStats for playerId=${player.id}`, stats);
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
      });
    }
  }

  /**
   * Takes one game back out of the players' lifetime totals (the inverse of
   * updatePlayerStats), for a game that was recorded and then voided. A player
   * with no stats yet is skipped. Counts never go below zero.
   */
  async reversePlayerStats(playerIds: number[], winnerIds?: number[]): Promise<void> {
    const db = await this.dbManager.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['playerStats'], 'readwrite');
      const store = transaction.objectStore('playerStats');

      for (const id of playerIds) {
        const getRequest = store.get(id);
        getRequest.onsuccess = () => {
          const stats: PlayerStats | undefined = getRequest.result;
          if (!stats) return;

          stats.gamesPlayed = Math.max(0, stats.gamesPlayed - 1);

          for (const other of playerIds) {
            if (other === id) continue;
            const left = (stats.partners[other] || 0) - 1;
            if (left > 0) stats.partners[other] = left;
            else delete stats.partners[other];
          }

          if (winnerIds && Array.isArray(winnerIds)) {
            if (winnerIds.includes(id)) stats.wins = Math.max(0, stats.wins - 1);
            else stats.losses = Math.max(0, stats.losses - 1);
          }

          store.put(stats);
        };
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Reset all player stats
  async clearAllPlayerStats(): Promise<void> {
    const db = await this.dbManager.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['playerStats'], 'readwrite');
      const statsStore = transaction.objectStore('playerStats');
      const req = statsStore.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
