
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Player } from "@/types/player";
import { Check } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { releaseStuckPointerEvents } from "@/utils/releaseStuckPointerEvents";

interface PiggybackModalProps {
  open: boolean;
  onClose: () => void;
  candidates: Player[];
  onConfirm: (partnerId: number) => void;
}

export function PiggybackModal({ open, onClose, candidates, onConfirm }: PiggybackModalProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const isMobile = useIsMobile();

  React.useEffect(() => { setSelectedId(null); }, [open]);

  // Safety net: once closed, make sure the page is clickable again
  React.useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => releaseStuckPointerEvents(), 400);
    return () => clearTimeout(timer);
  }, [open]);

  const candidatesList = (
    <div className="space-y-2 max-h-56 overflow-y-auto">
      {candidates.length === 0 ? (
        <div className="text-muted-foreground py-6 text-center text-sm">No available players to pair with.</div>
      ) : (
        candidates.map(player =>
          <button
            key={player.id}
            type="button"
            className={`w-full flex items-center justify-between p-3 rounded-lg border transition
              ${selectedId === player.id ? "bg-purple-100 border-purple-400" : "hover:bg-purple-50 border-gray-200"}
            `}
            onClick={() => setSelectedId(player.id)}
          >
            <div className="flex items-center gap-2">
              <span className={player.gender === "male" ? "text-blue-500" : "text-pink-500"}>●</span>
              <span>{player.name}</span>
              {player.isGuest && <span className="ml-2 text-xs bg-gray-100 px-1 py-0.5 rounded">Guest</span>}
            </div>
            {selectedId === player.id && (
              <span className="rounded-full bg-purple-600 p-1">
                <Check className="w-4 h-4 text-white" />
              </span>
            )}
          </button>
        )
      )}
    </div>
  );

  const confirmButton = (
    <Button
      type="button"
      className="w-full bg-purple-700 text-white"
      disabled={selectedId === null}
      onClick={() => selectedId !== null && onConfirm(selectedId)}
    >
      Confirm
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onClose}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>Choose Piggyback Partner</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            {candidatesList}
            <div className="pt-4">
              {confirmButton}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose Piggyback Partner</DialogTitle>
        </DialogHeader>
        {candidatesList}
        <DialogFooter>
          {confirmButton}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
