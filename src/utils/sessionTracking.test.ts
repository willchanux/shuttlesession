import { describe, it, expect, beforeEach } from "vitest";
import { isStaleSession, SessionTracker, SessionStats } from "./sessionTracking";

const HOUR = 60 * 60 * 1000;
const STORAGE_KEY = "currentSessionStats";

const statsFor = (playerId: number, lastGameTime?: number): SessionStats => ({
  playerId,
  gamesPlayed: lastGameTime ? 1 : 0,
  lastGameTime,
  recentCombinations: [],
});

describe("isStaleSession", () => {
  const now = 1_000_000_000_000;

  it("is not stale when a game was played recently", () => {
    expect(isStaleSession([statsFor(1, now - 1 * HOUR)], now - 3 * HOUR, now)).toBe(false);
  });

  it("is stale when the latest game was more than eight hours ago", () => {
    expect(isStaleSession([statsFor(1, now - 30 * HOUR)], now - 31 * HOUR, now)).toBe(true);
  });

  it("goes by the most recent game across all players", () => {
    const stats = [statsFor(1, now - 40 * HOUR), statsFor(2, now - 2 * HOUR)];
    expect(isStaleSession(stats, now - 41 * HOUR, now)).toBe(false);
  });

  it("uses the session start when no game has been played yet", () => {
    expect(isStaleSession([], now - 1 * HOUR, now)).toBe(false);
    expect(isStaleSession([], now - 20 * HOUR, now)).toBe(true);
  });
});

describe("SessionTracker loading and reset", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const seed = (lastGameTime: number, sessionStart: number) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ stats: [[1, statsFor(1, lastGameTime)]], sessionStart })
    );
  };

  it("keeps stats from a session that is still going", () => {
    const now = Date.now();
    seed(now - 1 * HOUR, now - 2 * HOUR);

    const tracker = new SessionTracker();

    expect(tracker.getGamesPlayedCount(1)).toBe(1);
    expect(tracker.getSessionStart()).toBe(now - 2 * HOUR);
  });

  it("starts afresh when saved stats are from an earlier, un-ended session", () => {
    const before = Date.now();
    seed(before - 48 * HOUR, before - 50 * HOUR);

    const tracker = new SessionTracker();

    expect(tracker.getGamesPlayedCount(1)).toBe(0);
    expect(tracker.getSessionStart()).toBeGreaterThanOrEqual(before);
    // and the stale data is no longer in storage
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string).stats).toEqual([]);
  });

  it("resetSession clears stats and restarts the session clock", () => {
    const now = Date.now();
    seed(now - 1 * HOUR, now - 2 * HOUR);
    const tracker = new SessionTracker();

    tracker.resetSession();

    expect(tracker.getGamesPlayedCount(1)).toBe(0);
    expect(tracker.getSessionStart()).toBeGreaterThanOrEqual(now);
  });
});
