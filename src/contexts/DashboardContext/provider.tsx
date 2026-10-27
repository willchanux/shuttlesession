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

  // Updated updateActivePlayerInfo function to handle ID-based updates
  const updateActivePlayerInfo = (updated: { 
    id?: number; 
    name: string; 
    gender?: "male" | "female"; 
    isGuest?: boolean; 
    playPreferences?: PlayPreference[] 
  }) => {
    console.log("DashboardContext: Updating active player info", updated);
    
    // Update player queue - use ID if available, fallback to name
    const updatedQueue = queueState.map(player => {
      const matches = updated.id ? player.id === updated.id : player.name === updated.name;
      return matches
        ? {
            ...player,
            name: updated.name,
            ...(updated.gender && { gender: updated.gender }),
            ...(typeof updated.isGuest === "boolean" && { isGuest: updated.isGuest }),
            ...(updated.playPreferences && { playPreferences: updated.playPreferences })
          }
        : player
    });
    
    setQueue(updatedQueue);
    
    // Update next game players - use ID if available, fallback to name
    const updatedNextGame = nextGamePlayersState.map(player => {
      const matches = updated.id ? player.id === updated.id : player.name === updated.name;
      return matches
        ? {
            ...player,
            name: updated.name,
            ...(updated.gender && { gender: updated.gender }),
            ...(typeof updated.isGuest === "boolean" && { isGuest: updated.isGuest }),
            ...(updated.playPreferences && { playPreferences: updated.playPreferences })
          }
        : player
    });
    
    setNextGamePlayers(updatedNextGame);
    
    // Update courts - use ID if available, fallback to name
    const updatedCourts = courtsState.map(court => ({
      ...court,
      players: court.players.map(player => {
        const matches = updated.id ? player.id === updated.id : player.name === updated.name;
        return matches
          ? {
              ...player,
              name: updated.name,
              ...(updated.gender && { gender: updated.gender }),
              ...(typeof updated.isGuest === "boolean" && { isGuest: updated.isGuest }),
              ...(updated.playPreferences && { playPreferences: updated.playPreferences })
            }
          : player
      })
    }));
    
    setCourts(updatedCourts);
  };

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