export type GameType = "Mixed" | "Ladies" | "Open";

/** Mixed is one family; Ladies and Open are both "level" games. */
export type Family = "mixed" | "level";

/** Two players who must always be on court together. */
export interface Pair {
  master: number;
  partner: number;
}
