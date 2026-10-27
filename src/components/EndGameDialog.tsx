
import { useEffect } from "react";
import { Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useWinnerSelection } from "@/hooks/useWinnerSelection";
import { saveGameResults } from "@/utils/gameResultsHandler";
import { WinnerSelectionList } from "./EndGameDialog/WinnerSelectionList";
import { releaseStuckPointerEvents } from "@/utils/releaseStuckPointerEvents";

interface CourtPlayer {
  id: number;
  name: string;
  gender: "male" | "female";
  isGuest?: boolean;
}

interface EndGameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  players: CourtPlayer[]; // Court players with IDs
  onSaveResults: (winnerNames: string[]) => void;
}

export function EndGameDialog({
  isOpen,
  onClose,
  players,
  onSaveResults,
}: EndGameDialogProps) {
  const { selectedWinners, toggleWinner, isValidSelection } = useWinnerSelection(isOpen);
  const isScoreKeepingEnabled = localStorage.getItem("scoreKeeping") !== "false";

  // Safety net: once the sheet has closed, make sure the page is clickable again
  useEffect(() => {
    if (isOpen) return;
    const timer = setTimeout(() => releaseStuckPointerEvents(), 400);
    return () => clearTimeout(timer);
  }, [isOpen]);

  console.log("EndGameDialog: Received players", players.map(p => ({ id: p.id, name: p.name })));

  const handleSave = async () => {
    try {
      console.log("EndGameDialog: Saving game results", { 
        players: players.map(p => ({ id: p.id, name: p.name })), 
        selectedWinners 
      });
      
      // Convert court players to Player format for saveGameResults
      const playersForSaving = players.map(p => ({
        id: p.id,
        name: p.name,
        gender: p.gender,
        waitingTime: 0,
        isGuest: p.isGuest || false,
      }));
      
      await saveGameResults(playersForSaving, selectedWinners);
      onSaveResults(selectedWinners);
      onClose();
    } catch (error) {
      console.error("EndGameDialog: Error saving game results", error);
      // Still proceed with closing dialog - results handler logs errors internally
      onSaveResults(selectedWinners);
      onClose();
    }
  };

  if (!isScoreKeepingEnabled) {
    return null;
  }

  // Convert court players to Player format for WinnerSelectionList
  const playersForSelection = players.map(p => ({
    id: p.id,
    name: p.name,
    gender: p.gender,
    waitingTime: 0,
    isGuest: p.isGuest || false,
  }));

  return (
    <Sheet open={isOpen && isScoreKeepingEnabled} onOpenChange={onClose}>
      <SheetContent side="bottom" className="max-h-[80vh]">
        <SheetHeader>
          <SheetTitle>Record Game Results</SheetTitle>
          <SheetDescription>
            Select the two players who won the game. This will update their win/loss record.
          </SheetDescription>
        </SheetHeader>

        <WinnerSelectionList
          players={playersForSelection}
          selectedWinners={selectedWinners}
          onToggleWinner={toggleWinner}
        />

        <SheetFooter className="flex flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            <X className="h-4 w-4 mr-2" /> Cancel
          </Button>
          <Button
            disabled={!isValidSelection}
            onClick={handleSave}
            className="flex-1"
          >
            <Trophy className="h-4 w-4 mr-2" /> Save and End Game
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
