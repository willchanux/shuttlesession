import { Player } from "../types/player";

export interface PairMove {
  queue: Player[];
  /** The player who was moved down to join the other, if anyone was. */
  moverId: number | null;
  /** Where the mover was before, to put them back if the pair is undone. */
  originalIndex: number | null;
}

/**
 * Brings a piggybacked pair together in the queue without anyone jumping ahead:
 * whichever of the two is earlier moves down to sit directly above the later one.
 * The later player keeps their place, so nobody is pulled up and nobody else is
 * pushed back. If the two are already side by side nothing moves.
 */
export function movePairTogether(queue: Player[], playerA: number, playerB: number): PairMove {
  const a = queue.findIndex(p => p.id === playerA);
  const b = queue.findIndex(p => p.id === playerB);
  if (a === -1 || b === -1 || Math.abs(a - b) === 1) {
    return { queue, moverId: null, originalIndex: null };
  }

  const early = Math.min(a, b);
  const late = Math.max(a, b);
  const next = [...queue];
  const [mover] = next.splice(early, 1);
  next.splice(late - 1, 0, mover); // the later player is now at late - 1; sit just above them
  return { queue: next, moverId: mover.id, originalIndex: early };
}

/** Puts a player back at (or as near as possible to) a position they held before. */
export function restorePosition(queue: Player[], playerId: number, originalIndex: number): Player[] {
  const current = queue.findIndex(p => p.id === playerId);
  if (current === -1) return queue;
  const next = [...queue];
  const [player] = next.splice(current, 1);
  next.splice(Math.min(originalIndex, next.length), 0, player);
  return next;
}
