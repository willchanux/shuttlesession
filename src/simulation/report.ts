import { Summary } from "./metrics";
import { SimConfig } from "./types";

interface Row {
  label: string;
  value: (s: Summary) => string;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const num = (x: number, digits = 1) => x.toFixed(digits);

/** What is reported, in the order it is shown. */
export const REPORT_ROWS: Row[] = [
  // Who shares a court with whom
  { label: "Most times any pair shared a court (worst night)", value: s => `${num(s.maxPairCount)} (${s.maxPairCountWorst})` },
  { label: "Pairs who shared a court 3+ times", value: s => num(s.pairsMetThreePlus) },
  { label: "Pairs who never shared a court", value: s => num(s.pairsNeverMet) },
  { label: "Different people each player met", value: s => num(s.distinctCoPlayers) },
  { label: "Back-to-back games with 2+ of the same co-players", value: s => pct(s.overlapTwoPlusShare) },
  { label: "Back-to-back games with the identical four", value: s => pct(s.identicalFourShare) },

  // Format
  { label: "Share of games that were Mixed", value: s => pct(s.mixedShare) },
  { label: "Rotatable players given the same format again", value: s => pct(s.sameFamilyAgainShare) },
  { label: "Longest same-format streak (worst night)", value: s => `${num(s.longestFamilyStreak)} (${s.longestFamilyStreakWorst})` },
  { label: "Players with 3+ of the same format in a row", value: s => num(s.playersWithStreakOfThree) },

  // Fairness
  { label: "Games played: fewest / most", value: s => `${num(s.minGamesPlayed)} / ${num(s.maxGamesPlayed)}` },
  { label: "Games per player: ladies / men", value: s => `${num(s.womenGames)} / ${num(s.menGames)}` },
  { label: "Wait in minutes: average, longest (worst night)", value: s => `${num(s.meanWait, 0)}, ${num(s.maxWait, 0)} (${num(s.maxWaitWorst, 0)})` },

  // Being passed over
  { label: "Skip runs per night", value: s => num(s.skipRunsPerSession) },
  { label: "Skip runs that were a single skip", value: s => pct(s.singleSkipShare) },
  { label: "Longest skip run (worst night)", value: s => String(s.maxSkipsWorst) },

  { label: "Picks that found no valid game, per night", value: s => num(s.failedSelectionsPerSession, 2) },
  { label: "Games per night", value: s => num(s.gamesPerSession) },
];

export interface NamedSummary {
  name: string;
  summary: Summary;
}

/** A markdown table comparing engines under one scenario. */
export function formatReport(title: string, config: SimConfig, results: NamedSummary[]): string {
  const sessions = results[0]?.summary.sessions ?? 0;
  const lines = [
    `### ${title}`,
    `${config.players} players (${config.ladies} ladies), ${config.courts} courts, pool ${config.poolSize}, ` +
      `${config.sessionMinutes} minutes, ${sessions} simulated nights`,
    "",
    `| Measure | ${results.map(r => r.name).join(" | ")} |`,
    `| --- | ${results.map(() => "---").join(" | ")} |`,
    ...REPORT_ROWS.map(row => `| ${row.label} | ${results.map(r => row.value(r.summary)).join(" | ")} |`),
  ];
  return lines.join("\n");
}
