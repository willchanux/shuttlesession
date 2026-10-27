import { describe, it, expect } from "vitest";
import { applyPlayerUpdate } from "./playerUpdate";

const list = [
  { id: 1, name: "Sam", gender: "male" as const, playPreferences: ["Open" as const] },
  { id: 2, name: "Jo", gender: "female" as const },
];

describe("applyPlayerUpdate", () => {
  it("updates the matching player by id, including a rename", () => {
    const next = applyPlayerUpdate(list, { id: 1, name: "Samuel", playPreferences: ["Mixed", "Open"] });
    expect(next[0]).toMatchObject({ id: 1, name: "Samuel", playPreferences: ["Mixed", "Open"] });
    expect(next[1]).toBe(list[1]);
  });

  it("falls back to the name when there is no id", () => {
    expect(applyPlayerUpdate(list, { name: "Jo", isGuest: true })[1]).toMatchObject({ isGuest: true });
  });

  it("keeps fields that are not being changed, and does not change the original", () => {
    const next = applyPlayerUpdate(list, { id: 1, name: "Sam" });
    expect(next[0].gender).toBe("male");
    expect(list[0].playPreferences).toEqual(["Open"]);
  });

  it("can clear preferences with an empty list", () => {
    expect(applyPlayerUpdate(list, { id: 1, name: "Sam", playPreferences: [] })[0].playPreferences).toEqual([]);
  });
});
