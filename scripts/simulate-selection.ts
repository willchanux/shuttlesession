/**
 * Replays simulated club nights through the player-selection engines and prints
 * a comparison.
 *
 *   bun scripts/simulate-selection.ts
 *   SEEDS=500 bun scripts/simulate-selection.ts
 *
 * Every engine plays the same nights (same seeds), so differences are down to
 * the engine, not luck. The roster and its preferences are assumptions: see
 * src/simulation/roster.ts.
 */
import "./local-storage-shim"; // must come first: the engines read localStorage as they load
import { formatReport } from "../src/simulation/report";
import { runScenario, seedRange } from "../src/simulation/runScenario";
import { DEFAULT_SIM_CONFIG, SelectionEngine, SimConfig } from "../src/simulation/types";

// Loading the engines starts the app's check for a browser database, which
// complains when run outside a browser. That is expected here, so mute it.
const originalError = console.error;
console.error = () => {};
const { currentEngine, mixerEngine, queueOrderEngine } = await import("../src/simulation/engines");
await new Promise(resolve => setTimeout(resolve, 0));
console.error = originalError;

const nights = Number(process.env.SEEDS ?? 200);

const scenarios: { title: string; config: SimConfig }[] = [
  { title: "22 players on 3 courts (a full pool of 8 most of the time)", config: { ...DEFAULT_SIM_CONFIG, courts: 3 } },
  { title: "22 players on 4 courts (only about 6 waiting)", config: { ...DEFAULT_SIM_CONFIG, courts: 4 } },
];

const engines: SelectionEngine[] = [currentEngine, mixerEngine, queueOrderEngine];

const log = console.log;
for (const { title, config } of scenarios) {
  const results = [];
  for (const engine of engines) {
    results.push({ name: engine.name, summary: await runScenario(engine, config, seedRange(nights)) });
  }
  log(formatReport(title, config, results));
  log("");
}
