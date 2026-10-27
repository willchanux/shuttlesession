import { Player } from "../types/player";
import { PlayPreference } from "../types/member";

interface Archetype {
  share: number;
  prefs: PlayPreference[];
}

/**
 * ASSUMPTION: a plausible spread of preferences, to be replaced with the club's
 * real roster. An empty list means "no preference set", which the app treats
 * as willing to play anything.
 */
export const MEN_ARCHETYPES: Archetype[] = [
  { share: 0.6, prefs: ["Mixed", "Open"] },
  { share: 0.25, prefs: ["Open"] }, // not set for mixed
  { share: 0.15, prefs: [] },
];

export const LADIES_ARCHETYPES: Archetype[] = [
  { share: 0.55, prefs: ["Mixed", "Ladies"] },
  { share: 0.2, prefs: ["Mixed", "Open", "Ladies"] }, // stronger ladies who also play with the men
  { share: 0.15, prefs: ["Ladies"] },
  { share: 0.1, prefs: [] },
];

/** Splits `total` across the shares, rounding so the counts add up exactly. */
export function allocate(total: number, shares: number[]): number[] {
  const exact = shares.map(s => s * total);
  const counts = exact.map(Math.floor);
  let remaining = total - counts.reduce((a, b) => a + b, 0);

  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const { index } of byRemainder) {
    if (remaining <= 0) break;
    counts[index]++;
    remaining--;
  }
  return counts;
}

function build(
  count: number,
  archetypes: Archetype[],
  gender: "male" | "female",
  firstId: number,
  label: string
): Player[] {
  const counts = allocate(count, archetypes.map(a => a.share));
  const players: Player[] = [];
  archetypes.forEach((archetype, i) => {
    for (let n = 0; n < counts[i]; n++) {
      const id = firstId + players.length;
      players.push({
        id,
        name: `${label} ${players.length + 1}`,
        gender,
        waitingTime: 0,
        playPreferences: [...archetype.prefs],
      });
    }
  });
  return players;
}

/** Men get ids 1..M, ladies the ids after them. */
export function makeRoster(totalPlayers: number, ladies: number): Player[] {
  const men = totalPlayers - ladies;
  return [
    ...build(men, MEN_ARCHETYPES, "male", 1, "Man"),
    ...build(ladies, LADIES_ARCHETYPES, "female", men + 1, "Lady"),
  ];
}
