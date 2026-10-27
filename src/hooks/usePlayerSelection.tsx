
import { Player } from "../types/player";
import { canFormValidGame, determineBestGameType, getPlayerPoolSize } from "../utils/gameUtils";
import { findBestCombination } from "../utils/gameSelection";
import { PiggybackPair } from "./usePiggybackPairs";
import { mixTracker } from "../utils/mixer/mixTracker";
import { planFormat } from "../utils/mixer/plannedFormats";
import { selectGame } from "../utils/mixer/selectGame";
import { isMixerEngineEnabled, rememberSuggestion } from "../utils/mixer/suggestion";

type UsePlayerSelectionOptions = {
  piggybackPairs?: PiggybackPair[];
};

export function usePlayerSelection(queue: Player[], options?: UsePlayerSelectionOptions) {
  const autoSelectPlayers = async (count: number = 4): Promise<Player[]> => {
    const piggybackPairs = options?.piggybackPairs || [];
    const poolSize = getPlayerPoolSize();
    
    // Filter out resting players first
    const activeQueue = queue.filter(player => !player.isResting);
    
    console.log("Auto-select: Starting with", activeQueue.length, "active players");
    console.log("Auto-select: Piggyback pairs:", piggybackPairs);

    // Apply fair piggyback positioning and create pool
    const poolPlayers = getFairPiggybackPool(activeQueue, piggybackPairs, poolSize);
    
    console.log("Auto-select: Fair pool size:", poolPlayers.length);

    // The newer mixer engine, when switched on (see utils/mixer)
    if (isMixerEngineEnabled()) {
      const result = selectGame({
        queue: poolPlayers,
        poolSize: poolPlayers.length,
        tracker: mixTracker,
        preferencesEnabled: localStorage.getItem("enablePlayerPreferences") === "true",
        piggybackPairs,
      });
      if (!result) {
        console.log("Auto-select (mixer): no valid game in the pool");
        return [];
      }
      if (result.gameType) planFormat(result.players, result.gameType);
      rememberSuggestion(result, poolPlayers, piggybackPairs);
      return result.players;
    }

    // Use the enhanced selection logic with piggyback awareness
    const selectedPlayers = await findBestCombination(poolPlayers, piggybackPairs);

    if (selectedPlayers.length === 4) {
      console.log("Auto-select: Successfully selected 4 players:", selectedPlayers.map(p => p.name));
      return selectedPlayers;
    }

    console.log("Auto-select: Failed to find valid combination");
    return [];
  };

  return { autoSelectPlayers };
}

/**
 * Gets fair pool positioning for piggyback pairs with all-or-nothing inclusion
 * Both players in a pair are positioned at the better player's queue position
 */
function getFairPiggybackPool(activeQueue: Player[], piggybackPairs: PiggybackPair[], poolSize: number): Player[] {
  if (piggybackPairs.length === 0) {
    return activeQueue.slice(0, Math.min(poolSize, activeQueue.length));
  }

  // Calculate effective positions for all players
  const playerPositions = new Map<number, number>();
  const pairExclusions = new Set<number>(); // Track pairs that can't both fit in pool
  
  activeQueue.forEach((player, index) => {
    const pair = piggybackPairs.find(p => p.master === player.id || p.partner === player.id);
    
    if (pair) {
      // Find both players in the pair
      const masterIndex = activeQueue.findIndex(p => p.id === pair.master);
      const partnerIndex = activeQueue.findIndex(p => p.id === pair.partner);
      
      if (masterIndex !== -1 && partnerIndex !== -1) {
        // Both players get positioned at the better (lower index) position for fairness
        const effectivePosition = Math.min(masterIndex, partnerIndex);
        
        // Check if both players can fit within pool size at their effective position
        // We need to ensure both players fit, so the effective position + 1 must be within pool
        if (effectivePosition < poolSize - 1 || (effectivePosition < poolSize && masterIndex < poolSize && partnerIndex < poolSize)) {
          playerPositions.set(pair.master, effectivePosition);
          playerPositions.set(pair.partner, effectivePosition);
          console.log(`Piggyback pair included: Master ${pair.master}, Partner ${pair.partner} at effective position ${effectivePosition}`);
        } else {
          // Exclude both players if they can't both fit in the pool
          pairExclusions.add(pair.master);
          pairExclusions.add(pair.partner);
          console.log(`Piggyback pair excluded from pool: Master ${pair.master}, Partner ${pair.partner} - pool size constraint`);
        }
      } else {
        // If partner not found, use original position
        playerPositions.set(player.id, index);
      }
    } else {
      // Non-piggybacked player keeps original position
      playerPositions.set(player.id, index);
    }
  });

  // Filter out excluded pairs and sort by effective positions
  const eligiblePlayers = activeQueue.filter(player => !pairExclusions.has(player.id));
  
  const sortedPlayers = [...eligiblePlayers].sort((a, b) => {
    const posA = playerPositions.get(a.id) ?? activeQueue.findIndex(p => p.id === a.id);
    const posB = playerPositions.get(b.id) ?? activeQueue.findIndex(p => p.id === b.id);
    return posA - posB;
  });

  // Apply pool size limit to fairly positioned players
  const finalPool = sortedPlayers.slice(0, Math.min(poolSize, sortedPlayers.length));
  
  // Final validation: ensure no piggyback pairs are split in the final pool
  const finalPoolIds = new Set(finalPool.map(p => p.id));
  for (const pair of piggybackPairs) {
    const hasMaster = finalPoolIds.has(pair.master);
    const hasPartner = finalPoolIds.has(pair.partner);
    
    if ((hasMaster && !hasPartner) || (hasPartner && !hasMaster)) {
      console.error(`CRITICAL: Piggyback pair split in final pool! Master: ${pair.master}, Partner: ${pair.partner}`);
      // Remove the lone player to maintain integrity
      const lonePlayerId = hasMaster ? pair.master : pair.partner;
      const fixedPool = finalPool.filter(p => p.id !== lonePlayerId);
      console.log(`Fixed pool by removing lone player ${lonePlayerId}`);
      return fixedPool;
    }
  }
  
  return finalPool;
}
