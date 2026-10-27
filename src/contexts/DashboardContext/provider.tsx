import React, { useState, useEffect, useRef } from "react";
import { Player } from "@/types/player";
import { PlayPreference } from "@/types/member";
import { useDashboardLogic } from "@/hooks/useDashboardLogic";
import { usePiggybackPairs } from "@/hooks/usePiggybackPairs";
import { DashboardContextType } from "./types";

interface DashboardProviderProps {
  children: React.ReactNode;
  value: DashboardContextType;
}

export function DashboardProviderLogic({ children }: { children: React.ReactNode }) {
  // State for managing active players
  const [nextGamePlayersState, setNextGamePlayers] = useState<Player[]>([]);
  const [queueState, setQueue] = useState<Player[]>([]);
  const [courtsState, setCourts] = useState<any[]>([]);

  // The queue the app actually selects from lives in useDashboardLogic below, and
  // queueState above is only a copy of it for display. Piggybacking has to reorder
  // the real queue, or the display shows one order while auto-select uses another.
  const realQueueRef = useRef<Player[]>([]);
  const syncRealQueueRef = useRef<(queue: Player[]) => void>(() => {});

  // Piggyback pairs state with queue manipulation
  const {
    piggybackPairs,
    addPair,
    removePairByMaster,
    findPairOf,
    clearAllPairs
  } = usePiggybackPairs({
    getQueue: () => realQueueRef.current,
    setQueue: updater => syncRealQueueRef.current(updater(realQueueRef.current))
  });

  // Main dashboard logic
  const {
    queue,
    nextGamePlayers,
    sortedCourts,
    endGameDialogOpen,
    currentCourtPlayers,
    addPlayerToQueue,
    removePlayerFromQueue,
    generateNextGame,
    assignToFreeCourt,
    handleEndGameClick,
    handlePlayerSelect,
    clearNextGame,
    setEndGameDialogOpen,
    finishEndGame,
    isNextGameReady,
    voidCourtAssignment,
    canVoidCourt,
    updateActivePlayerInfo,
    syncQueue
  } = useDashboardLogic({
    piggybackPairs,
    addPiggybackPair: addPair,
    removePiggybackPair: removePairByMaster,
    findPiggybackPair: findPairOf
  });

  realQueueRef.current = queue;
  syncRealQueueRef.current = syncQueue;

  // Sync state with hook values
  useEffect(() => {
    setNextGamePlayers(nextGamePlayers);
  }, [nextGamePlayers]);

  useEffect(() => {
    setQueue(queue);
  }, [queue]);

  useEffect(() => {
    setCourts(sortedCourts);
  }, [sortedCourts]);

  // Toggle player rest status - players stay in their queue position
  const togglePlayerRest = (playerId: number) => {
    const updatedQueue = queueState.map(player => 
      player.id === playerId 
        ? { ...player, isResting: !player.isResting }
        : player
    );
    
    setQueue(updatedQueue);
    syncQueue(updatedQueue);
  };

  const value: DashboardContextType = {
    // Player queue
    queue: queueState,
    addPlayerToQueue,
    removePlayerFromQueue,
    togglePlayerRest,
    updateActivePlayerInfo,

    // Next game
    nextGamePlayers: nextGamePlayersState,
    generateNextGame,
    clearNextGame,
    isNextGameReady,

    // Courts
    sortedCourts: courtsState,
    assignToFreeCourt,
    handleEndGameClick,
    voidCourtAssignment,
    canVoidCourt,

    // Game management
    handlePlayerSelect,
    endGameDialogOpen,
    currentCourtPlayers,
    setEndGameDialogOpen,
    finishEndGame,

    // Piggyback pairs - map to expected interface names
    piggybackPairs,
    addPiggybackPair: addPair,
    removePiggybackPair: removePairByMaster,
    findPiggybackPair: findPairOf,
    clearPiggybackPairs: clearAllPairs
  };

  return (
    <DashboardProviderComponent value={value}>
      {children}
    </DashboardProviderComponent>
  );
}

// Simple provider component that just passes the value
function DashboardProviderComponent({ children, value }: DashboardProviderProps) {
  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

// We need to import the context here to avoid circular dependencies
import { DashboardContext } from "./context";