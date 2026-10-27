
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PlayerRankings } from "./PlayerOfSession/PlayerRankings";
import { useAllTimePlayerRankings } from "@/hooks/useAllTimePlayerRankings";
import { gameHistoryDB } from "@/utils/indexedDbUtils";
import { Medal } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { releaseStuckPointerEvents } from "@/utils/releaseStuckPointerEvents";

interface PlayerOfMonthDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PlayerOfMonthDialog({ isOpen, onClose }: PlayerOfMonthDialogProps) {
  const { topPlayers, hasScores } = useAllTimePlayerRankings(isOpen);
  const [resetting, setResetting] = useState(false);
  const isMobile = useIsMobile();

  // Safety net: once closed, make sure the page is clickable again
  useEffect(() => {
    if (isOpen) return;
    const timer = setTimeout(() => releaseStuckPointerEvents(), 400);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Reset all-time stats and also reset wins/losses in localStorage for all members
  const handleClose = async () => {
    setResetting(true);
    await gameHistoryDB.clearAllPlayerStats();

    // Reset wins/losses for all members, preserving other info and ratings
    const membersKeys = ["members", "clubMembers"];
    membersKeys.forEach(key => {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const arr = JSON.parse(raw);
          const resetArr = arr.map((m: any) => ({
            ...m,
            wins: 0,
            losses: 0,
          }));
          localStorage.setItem(key, JSON.stringify(resetArr));
        } catch (e) {
          console.error(`Error resetting ${key} after all-time stats wipe`, e);
        }
      }
    });

    setResetting(false);
    onClose();
  };

  const content = (
    <>
      <div className="py-6 space-y-6 text-sm sm:text-base">
        {hasScores ? (
          <PlayerRankings topPlayers={topPlayers} />
        ) : (
          <div className="flex flex-col items-center justify-center text-yellow-700 gap-3 py-8">
            <Medal className="w-9 h-9 text-yellow-400" />
            <span className="font-medium">Not enough players have played games yet!</span>
            <span className="text-xs text-yellow-900 text-center max-w-xs">
              At least one player must play a game for Player of the Month to be crowned.
            </span>
          </div>
        )}
      </div>
      
      <div className="pt-4">
        <Button onClick={handleClose} className="w-full text-sm sm:text-base" disabled={resetting}>
          Close &amp; Reset All-Time Scores
        </Button>
      </div>
    </>
  );

  // Mobile: Use Drawer
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={handleClose}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle className="text-center text-xl sm:text-2xl md:text-3xl">
              Player of the Month
            </DrawerTitle>
            <DrawerDescription className="text-center text-sm sm:text-base">
              All-time win rate leaderboard (players with 1+ games)
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop/Tablet: Use Sheet
  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-[400px] sm:w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-center text-xl sm:text-2xl md:text-3xl">
            Player of the Month
          </SheetTitle>
          <SheetDescription className="text-center text-sm sm:text-base">
            All-time win rate leaderboard (players with 1+ games)
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6">
          {content}
        </div>
      </SheetContent>
    </Sheet>
  );
}
