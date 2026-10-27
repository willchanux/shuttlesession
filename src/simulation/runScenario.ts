import { computeMetrics, summarise, Summary } from "./metrics";
import { simulateSession } from "./simulateSession";
import { SelectionEngine, SimConfig } from "./types";

/** Runs the same nights (same seeds) through an engine and summarises them. */
export async function runScenario(
  engine: SelectionEngine,
  config: SimConfig,
  seeds: number[]
): Promise<Summary> {
  const runs = [];
  for (const seed of seeds) {
    runs.push(computeMetrics(await simulateSession(engine, config, seed)));
  }
  return summarise(runs);
}

/** Seeds 1..count, so every engine is tested on identical nights. */
export const seedRange = (count: number): number[] => Array.from({ length: count }, (_, i) => i + 1);
