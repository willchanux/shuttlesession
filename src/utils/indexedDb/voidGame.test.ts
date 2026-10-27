import { describe, it, expect } from "vitest";
import { PlayerStatsManager } from "./playerStats";
import { GameRecordsManager } from "./gameRecords";

/** Just enough of IndexedDB to run the void logic: object stores with get / put / a newest-first cursor. */
function fakeDb(tables: Record<string, Map<any, any>>) {
  return {
    transaction(names: string[]) {
      const tx: any = { oncomplete: null, onerror: null };
      let pending = 0;
      const finish = () => {
        if (--pending <= 0) setTimeout(() => tx.oncomplete?.(), 0);
      };
      const request = (work: (req: any) => void) => {
        pending++;
        const req: any = {};
        setTimeout(() => {
          work(req);
          req.onsuccess?.({ target: req });
          finish();
        }, 0);
        return req;
      };
      tx.objectStore = (name: string) => ({
        get: (key: any) => request(req => (req.result = structuredClone(tables[name].get(key)))),
        put: (value: any) => request(req => tables[name].set(value.playerId ?? value.id, structuredClone(value))),
        index: () => ({
          openCursor: () => {
            const rows = [...tables[name].entries()].sort((a, b) => b[1].timestamp - a[1].timestamp);
            let at = 0;
            const req: any = {};
            const next = () => {
              setTimeout(() => {
                const row = rows[at];
                let continued = false;
                req.result = row
                  ? {
                      value: row[1],
                      delete: () => tables[name].delete(row[0]),
                      continue: () => { continued = true; at++; next(); },
                    }
                  : null;
                req.onsuccess?.({ target: req });
                if (!continued) finish(); // the code stopped asking for more rows
              }, 0);
            };
            pending++;
            next();
            return req;
          },
        }),
      });
      return tx;
    },
  };
}

describe("voiding a recorded game", () => {
  it("takes the game out of lifetime stats", async () => {
    const stats = new Map<number, any>([
      [1, { playerId: 1, name: "A", gamesPlayed: 3, lastPlayed: 5, partners: { 2: 2, 3: 3 }, wins: 1, losses: 1 }],
      [2, { playerId: 2, name: "B", gamesPlayed: 2, lastPlayed: 5, partners: { 1: 1 }, wins: 0, losses: 0 }],
    ]);
    const manager = new PlayerStatsManager({ ensureInit: async () => fakeDb({ playerStats: stats }) } as any, {} as any);

    await manager.reversePlayerStats([1, 2]);

    expect(stats.get(1)).toMatchObject({ gamesPlayed: 2, partners: { 2: 1, 3: 3 } });
    expect(stats.get(2)).toMatchObject({ gamesPlayed: 1, partners: {} });
  });

  it("reverses wins and losses when the removed game had winners, and never goes below zero", async () => {
    const stats = new Map<number, any>([
      [1, { playerId: 1, name: "A", gamesPlayed: 0, lastPlayed: 0, partners: {}, wins: 0, losses: 0 }],
      [2, { playerId: 2, name: "B", gamesPlayed: 1, lastPlayed: 0, partners: { 1: 1 }, wins: 1, losses: 0 }],
    ]);
    const manager = new PlayerStatsManager({ ensureInit: async () => fakeDb({ playerStats: stats }) } as any, {} as any);
    await manager.reversePlayerStats([1, 2], [2]);
    expect(stats.get(1)).toMatchObject({ gamesPlayed: 0, losses: 0 });
    expect(stats.get(2)).toMatchObject({ gamesPlayed: 0, wins: 0 });
  });

  it("removes only the latest game by exactly those players", async () => {
    const games = new Map<number, any>([
      [1, { id: 1, playerIds: [1, 2, 3, 4], timestamp: 100 }],
      [2, { id: 2, playerIds: [5, 6, 7, 8], timestamp: 200 }],
      [3, { id: 3, playerIds: [4, 3, 2, 1], timestamp: 300 }],
    ]);
    const manager = new GameRecordsManager({ ensureInit: async () => fakeDb({ gameHistory: games }) } as any);

    const removed = await manager.removeLatestGame([1, 2, 3, 4]);

    expect(removed?.id).toBe(3);
    expect([...games.keys()].sort()).toEqual([1, 2]);
  });

  it("returns null when no game matches", async () => {
    const games = new Map<number, any>([[1, { id: 1, playerIds: [1, 2, 3, 4], timestamp: 100 }]]);
    const manager = new GameRecordsManager({ ensureInit: async () => fakeDb({ gameHistory: games }) } as any);
    expect(await manager.removeLatestGame([9, 8, 7, 6])).toBeNull();
    expect(games.size).toBe(1);
  });
});
