
import { useState } from "react";
import { Player } from "../types/player";
import { movePairTogether, restorePosition } from "../utils/piggybackQueue";

// Each pair has a master and a partner; one player can only be in one pair.
export type PiggybackPair = { master: number; partner: number };

// Original position storage for masters
const ORIGINAL_POSITIONS_KEY = "piggybackOriginalPositions";

function getInitialPairs(): PiggybackPair[] {
  const saved = localStorage.getItem("piggybackPairs");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (p: any) =>
            typeof p.master === "number" && typeof p.partner === "number" && p.master !== p.partner
        );
      }
    } catch {}
  }
  return [];
}

function getOriginalPositions(): Record<number, number> {
  const saved = localStorage.getItem(ORIGINAL_POSITIONS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {}
  }
  return {};
}

function saveOriginalPositions(positions: Record<number, number>) {
  localStorage.setItem(ORIGINAL_POSITIONS_KEY, JSON.stringify(positions));
}

export function usePiggybackPairs(queueManipulation?: {
  getQueue: () => Player[];
  setQueue: (updater: (prev: Player[]) => Player[]) => void;
}) {
  const [piggybackPairs, setPiggybackPairs] = useState<PiggybackPair[]>(getInitialPairs);

  const persist = (pairs: PiggybackPair[]) => {
    setPiggybackPairs(pairs);
    localStorage.setItem("piggybackPairs", JSON.stringify(pairs));
  };

  // Add a new pair, removing the players from any previous pairs
  function addPair(master: number, partner: number) {
    // Bring the pair together: whoever is earlier in the queue moves down to sit
    // above the later one, so no one jumps ahead and the later player is not pulled up
    if (queueManipulation) {
      const move = movePairTogether(queueManipulation.getQueue(), master, partner);
      if (move.moverId !== null && move.originalIndex !== null) {
        const originalPositions = getOriginalPositions();
        originalPositions[move.moverId] = move.originalIndex;
        saveOriginalPositions(originalPositions);
        queueManipulation.setQueue(() => move.queue);
      }
    }

    // Remove both if they exist elsewhere
    let newPairs = piggybackPairs.filter(pair =>
      pair.master !== master &&
      pair.partner !== master &&
      pair.master !== partner &&
      pair.partner !== partner
    );
    newPairs.push({ master, partner });
    persist(newPairs);
  }

  // Remove a pair if player is the master
  function removePairByMaster(master: number) {
    // Put back whichever of the two was moved down to join the other
    if (queueManipulation) {
      const pair = piggybackPairs.find(p => p.master === master);
      const originalPositions = getOriginalPositions();
      let restored = false;
      for (const id of [master, pair?.partner]) {
        if (id === undefined || typeof originalPositions[id] !== "number") continue;
        const originalIndex = originalPositions[id];
        queueManipulation.setQueue(prevQueue => restorePosition(prevQueue, id, originalIndex));
        delete originalPositions[id];
        restored = true;
      }
      if (restored) saveOriginalPositions(originalPositions);
    }

    persist(piggybackPairs.filter(pair => pair.master !== master));
  }

  // Utility: find a pair involving a player
  function findPairOf(playerId: number): PiggybackPair | undefined {
    return piggybackPairs.find(pair => pair.master === playerId || pair.partner === playerId);
  }
  // Is master or not
  function isMaster(playerId: number) {
    return piggybackPairs.some(pair => pair.master === playerId);
  }
  // Is partner or not
  function isPartner(playerId: number) {
    return piggybackPairs.some(pair => pair.partner === playerId);
  }

  // Clear all pairs (for example after user action)
  function clearAllPairs() {
    // Clear stored original positions
    localStorage.removeItem(ORIGINAL_POSITIONS_KEY);
    persist([]);
  }

  return {
    piggybackPairs,
    addPair,
    removePairByMaster,
    findPairOf,
    isMaster,
    isPartner,
    clearAllPairs
  };
}
