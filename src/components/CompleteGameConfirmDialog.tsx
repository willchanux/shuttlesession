import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CourtPlayer } from "@/types/DashboardTypes";

interface CompleteGameConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  courtName: string;
  players: CourtPlayer[];
  scoreKeepingEnabled: boolean;
}

export function CompleteGameConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  courtName,
  players,
  scoreKeepingEnabled
}: CompleteGameConfirmDialogProps) {
  const handleConfirm = () => {
    onOpenChange(false);
    if (scoreKeepingEnabled) {
      // The winners sheet opens next. Let this dialog finish closing first:
      // two dialogs changing at once can leave the whole page unclickable.
      setTimeout(onConfirm, 300);
    } else {
      onConfirm();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-green-600">
            Complete Game on {courtName}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {scoreKeepingEnabled ? (
              <>
                You will be asked to record the winners for these players:
                <div className="mt-2 p-2 bg-gray-50 rounded">
                  {players.map((player, idx) => (
                    <div key={idx} className="text-sm font-medium">
                      • {player.name} {player.isGuest && "(Guest)"}
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-sm text-green-600">
                  Game results will be recorded for all players.
                </div>
              </>
            ) : (
              <>
                The following players will return to the queue:
                <div className="mt-2 p-2 bg-gray-50 rounded">
                  {players.map((player, idx) => (
                    <div key={idx} className="text-sm font-medium">
                      • {player.name} {player.isGuest && "(Guest)"}
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  No game results will be recorded (score keeping is disabled).
                </div>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-green-500 hover:bg-green-600"
          >
            Complete Game
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
