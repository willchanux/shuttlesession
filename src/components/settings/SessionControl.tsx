
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PlayerOfSessionDialog } from "@/components/PlayerOfSessionDialog";
import { clearSessionScores } from "@/utils/storageUtils";
import { sessionTracker } from "@/utils/sessionTracking";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function SessionControl() {
  const [showPlayerOfSession, setShowPlayerOfSession] = useState<boolean>(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [shouldEndSession, setShouldEndSession] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Check if score keeping is enabled
  const scoreKeeping = localStorage.getItem("scoreKeeping") !== "false";

  const handleDialogConfirm = () => {
    setShowEndDialog(false); // this will trigger onOpenChange to run finishEndSession
    setShouldEndSession(true);
  };

  // Effect: when the dialog closes after confirm, do the ending logic
  // (The dialog unmounts after open=false)
  React.useEffect(() => {
    if (!showEndDialog && shouldEndSession) {
      // Show Player of Session dialog if score keeping is enabled
      if (scoreKeeping) {
        setShowPlayerOfSession(true);
      } else {
        finishEndSession();
      }
      setShouldEndSession(false);
    }
    // eslint-disable-next-line
  }, [showEndDialog, shouldEndSession]);

  const finishEndSession = () => {
    console.log("SessionControl: finishEndSession called");
    // Clear player queue and next game data
    localStorage.removeItem("playerQueue");
    localStorage.removeItem("nextGamePlayers");
    
    // Clear courts data
    localStorage.removeItem("courts");
    
    // Clear session-specific scores
    clearSessionScores();

    // Forget who has played with whom, so the next session starts with a clean slate
    sessionTracker.resetSession();

    // Navigate back to splash screen
    navigate("/app");
    
    // Show success toast
    toast({
      title: "Session ended",
      description: "Player data and court assignments have been cleared. Member data is preserved."
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-destructive/30">
      <h2 className="text-xl font-semibold mb-4 text-destructive">Session Control</h2>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">End the current badminton session and return to the start screen</p>
        <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="lg" className="w-full sm:w-auto">End Session</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>End Current Session?</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to end the current session and return to the start screen. 
                This action will clear all player queue data, court assignments, and session scores but preserve member information.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                asChild
              >
                <Button
                  variant="destructive"
                  onClick={handleDialogConfirm}
                  autoFocus
                  type="button"
                  className="w-full sm:w-auto"
                >
                  End Session
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      
      {/* Player of Session Dialog */}
      <PlayerOfSessionDialog 
        isOpen={showPlayerOfSession} 
        onClose={() => {
          setShowPlayerOfSession(false);
          finishEndSession();
        }} 
      />
    </div>
  );
}
