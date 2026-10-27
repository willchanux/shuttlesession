import { describe, it, expect } from "vitest";
import { preferencesForGender } from "./preferences";

describe("preferencesForGender", () => {
  it("drops Ladies for a man and keeps the rest in order", () => {
    expect(preferencesForGender("male", ["Open", "Mixed", "Ladies"])).toEqual(["Open", "Mixed"]);
  });
  it("leaves a woman's preferences alone", () => {
    expect(preferencesForGender("female", ["Open", "Mixed", "Ladies"])).toEqual(["Open", "Mixed", "Ladies"]);
  });
  it("leaves a man who only had Ladies with none, meaning he accepts anything", () => {
    expect(preferencesForGender("male", ["Ladies"])).toEqual([]);
  });
});
