import { describe, it, expect } from "vitest";
import { cleanLadiesFromMen } from "./cleanMemberPreferences";

const fakeStorage = (data: Record<string, string>) => ({
  data,
  getItem: (k: string) => (k in data ? data[k] : null),
  setItem: (k: string, v: string) => void (data[k] = v),
});

describe("cleanLadiesFromMen", () => {
  it("removes Ladies from men in members, queue, next game and courts, and leaves women alone", () => {
    const man = { id: 1, name: "M", gender: "male", playPreferences: ["Open", "Mixed", "Ladies"] };
    const woman = { id: 2, name: "W", gender: "female", playPreferences: ["Mixed", "Ladies"] };
    const store = fakeStorage({
      members: JSON.stringify([man, woman]),
      clubMembers: JSON.stringify([man, woman]),
      playerQueue: JSON.stringify([man]),
      nextGamePlayers: JSON.stringify([man, woman]),
      courts: JSON.stringify([{ id: 1, players: [man, woman] }]),
    });

    cleanLadiesFromMen(store as any);

    const members = JSON.parse(store.data.members);
    expect(members[0].playPreferences).toEqual(["Open", "Mixed"]);
    expect(members[1].playPreferences).toEqual(["Mixed", "Ladies"]);
    expect(JSON.parse(store.data.clubMembers)[0].playPreferences).toEqual(["Open", "Mixed"]);
    expect(JSON.parse(store.data.playerQueue)[0].playPreferences).toEqual(["Open", "Mixed"]);
    expect(JSON.parse(store.data.nextGamePlayers)[0].playPreferences).toEqual(["Open", "Mixed"]);
    expect(JSON.parse(store.data.courts)[0].players[0].playPreferences).toEqual(["Open", "Mixed"]);
    expect(JSON.parse(store.data.courts)[0].players[1].playPreferences).toEqual(["Mixed", "Ladies"]);
  });

  it("writes nothing when there is nothing to clean, and copes with missing or broken data", () => {
    const original = JSON.stringify([{ id: 1, gender: "male", playPreferences: ["Open"] }]);
    const store = fakeStorage({ members: original, playerQueue: "not json" });
    expect(() => cleanLadiesFromMen(store as any)).not.toThrow();
    expect(store.data.members).toBe(original);
  });
});
