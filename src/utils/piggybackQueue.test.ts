import { describe, it, expect } from "vitest";
import { movePairTogether, restorePosition } from "./piggybackQueue";
import { Player } from "../types/player";

const queue = (n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `P${i + 1}`, gender: "male" as const, waitingTime: 0 }));
const ids = (q: Player[]) => q.map(p => p.id);

describe("movePairTogether", () => {
  it("moves the earlier player down to sit just above the later one", () => {
    // position 2 piggybacks with position 8
    const result = movePairTogether(queue(10), 2, 8);
    expect(ids(result.queue)).toEqual([1, 3, 4, 5, 6, 7, 2, 8, 9, 10]);
    expect(result.moverId).toBe(2);
    expect(result.originalIndex).toBe(1);
  });

  it("does the same whichever of the pair is named first", () => {
    expect(ids(movePairTogether(queue(10), 8, 2).queue)).toEqual([1, 3, 4, 5, 6, 7, 2, 8, 9, 10]);
  });

  it("never moves the later player up", () => {
    const before = queue(10);
    const result = movePairTogether(before, 2, 8);
    expect(result.queue.findIndex(p => p.id === 8)).toBeGreaterThanOrEqual(before.findIndex(p => p.id === 8) - 1);
    expect(ids(result.queue).indexOf(8)).toBe(7); // still behind everyone it was behind
  });

  it("leaves everyone else in their relative order", () => {
    const rest = ids(movePairTogether(queue(10), 2, 8).queue).filter(id => id !== 2);
    expect(rest).toEqual([1, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("does nothing when they are already side by side or someone is missing", () => {
    expect(movePairTogether(queue(5), 2, 3).moverId).toBeNull();
    expect(movePairTogether(queue(5), 2, 99).moverId).toBeNull();
  });
});

describe("restorePosition", () => {
  it("puts the player back where they were", () => {
    const moved = movePairTogether(queue(10), 2, 8);
    expect(ids(restorePosition(moved.queue, 2, moved.originalIndex!))).toEqual(ids(queue(10)));
  });

  it("copes with a position beyond the queue", () => {
    expect(ids(restorePosition(queue(3), 1, 10))).toEqual([2, 3, 1]);
  });
});
