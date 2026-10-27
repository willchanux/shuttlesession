import { describe, it, expect } from "vitest";
import { shuffle } from "./shuffle";

describe("shuffle", () => {
  it("returns a permutation without changing the input", () => {
    const input = [1, 2, 3, 4, 5, 6, 7];
    const copy = [...input];
    const result = shuffle(input);

    expect(input).toEqual(copy);
    expect([...result].sort()).toEqual(copy);
  });

  it("is deterministic for a given random source", () => {
    const seeded = () => {
      let i = 0;
      const values = [0.1, 0.9, 0.4, 0.7, 0.2, 0.6];
      return () => values[i++ % values.length];
    };
    expect(shuffle([1, 2, 3, 4, 5, 6, 7], seeded())).toEqual(shuffle([1, 2, 3, 4, 5, 6, 7], seeded()));
  });

  it("handles empty and single-item arrays", () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle([1])).toEqual([1]);
  });

  it("picks every position about equally often (no bias to the front of the queue)", () => {
    const size = 7;
    const trials = 20000;
    const picked = Array(size).fill(0);

    for (let t = 0; t < trials; t++) {
      shuffle([...Array(size).keys()])
        .slice(0, 3)
        .forEach(position => picked[position]++);
    }

    const expected = 3 / size; // each position is chosen in 3 of 7 slots
    for (const count of picked) {
      expect(Math.abs(count / trials - expected)).toBeLessThan(0.03);
    }
  });
});
