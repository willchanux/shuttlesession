import { describe, it, expect } from "vitest";
import { toCourtPlayer } from "./courtPlayers";
import { CourtPlayer } from "../types/DashboardTypes";

describe("toCourtPlayer", () => {
  it("keeps play preferences and rating when a player goes on or off court", () => {
    const player: CourtPlayer = {
      id: 7,
      name: "Sam",
      gender: "female",
      playPreferences: ["Open", "Mixed"],
      rating: 1180,
    };

    const copy = toCourtPlayer(player);

    expect(copy.playPreferences).toEqual(["Open", "Mixed"]);
    expect(copy.rating).toBe(1180);
    expect(copy.id).toBe(7);
  });

  it("keeps extra fields from the full player object", () => {
    const player = { id: 1, name: "Alex", gender: "male" as const, wins: 4, sessionWins: 2 };
    expect(toCourtPlayer(player)).toMatchObject({ wins: 4, sessionWins: 2 });
  });

  it("defaults isGuest to false", () => {
    expect(toCourtPlayer({ id: 1, name: "Alex", gender: "male" }).isGuest).toBe(false);
    expect(toCourtPlayer({ id: 2, name: "Bo", gender: "male", isGuest: true }).isGuest).toBe(true);
  });

  it("returns a copy and leaves the original untouched", () => {
    const player: CourtPlayer = { id: 1, name: "Alex", gender: "male" };
    const copy = toCourtPlayer(player);

    expect(copy).not.toBe(player);
    expect(player.isGuest).toBeUndefined();
  });
});
