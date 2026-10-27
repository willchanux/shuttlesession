import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { PreSessionSettings } from "@/components/settings/PreSessionSettings";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Trophy } from "lucide-react";
import { PlayerOfMonthDialog } from "@/components/PlayerOfMonthDialog";

const SplashScreen = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Clean up any previous session data when landing on /app
  useEffect(() => {
    const sessionKeys = [
      'selectedPlayers',
      'currentGames',
      'gameInProgress',
      'sessionStartTime',
      'piggybackPairs',
      'sessionScores'
    ];
    
    sessionKeys.forEach(key => {
      localStorage.removeItem(key);
    });
  }, []);

  // We'll use a simple session counter in localStorage for player of the month (not shown on splash)
  // Settings required - user must review/submit them before session can start.
  const [sessionReady, setSessionReady] = useState(
    !!localStorage.getItem("sawPreSessionSettings") // skip if already viewed once
  );

  // Player of the Month Dialog controls
  const [showPOMConfirm, setShowPOMConfirm] = useState(false);
  const [pomDialogOpen, setPOMDialogOpen] = useState(false);

  const handleShowSettings = () => setSettingsOpen(true);

  const handleSettingsClose = () => {
    setSettingsOpen(false);
    // Mark as ready, so 'Start Session' can be clicked once settings dialog has been opened/closed
    localStorage.setItem("sawPreSessionSettings", "true");
    setSessionReady(true);
  };

  const handleStartSession = () => {
    // Could record session count here if wanted for 'Player of the Month' logic elsewhere
    const sessions = parseInt(localStorage.getItem("sessionCount") || "0", 10);
    localStorage.setItem("sessionCount", String(sessions + 1));
    navigate("/app/session");
  };

  // Open warning modal to confirm "Player of the Month" action
  const handlePOMClick = () => setShowPOMConfirm(true);
  // When user confirms warning, open Player of Month dialog
  const handlePOMConfirmed = () => {
    setShowPOMConfirm(false);
    // Open the next one only after the confirmation has finished closing:
    // two dialogs changing at once can leave the page unclickable
    setTimeout(() => setPOMDialogOpen(true), 300);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-app-primary-700 text-neutral-000 p-6 bg-shuttle-primary">
      <div className="text-center animate-fade-in py-[120px]">
        <div className="flex justify-center mb-6">
          <div className="bg-transparent p-3 rounded-md flex items-center justify-center">
            <svg width="64" height="64" viewBox="0 0 28 56" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.9979 21.9689C20.2486 23.7330 21.4717 32.6751 21.2991 38.4443C21.0873 45.5213 18.6988 55.9979 17.6584 56C16.6181 55.9984 14.7354 46.1715 14.5236 39.0943C14.3561 33.4971 15.0302 24.4183 15.2064 22.1742C16.7473 22.1431 18.4647 22.0592 19.9979 21.9689Z" fill="white" />
              <path d="M8.19579 21.9802C9.74317 22.0698 11.4593 22.1505 12.9843 22.1773C13.124 24.3632 13.6427 32.9917 13.4759 38.566C13.2642 45.6434 11.5818 55.4707 10.5415 55.4717C9.5011 55.4697 7.1126 44.993 6.90079 37.916C6.72907 32.1771 7.93648 23.7197 8.19579 21.9802Z" fill="white" />
              <path d="M3.53298 21.6604C3.53298 21.6604 4.81379 21.763 6.59519 21.8802C6.29566 22.7214 5.25841 25.9382 5.10395 30.6415C4.90465 36.7101 1.37427 42.2614 0.394125 42.2642C-0.585003 42.2642 0.593467 35.655 0.394125 29.5849C0.235801 24.7639 2.75778 22.3125 3.39091 21.7749L3.53298 21.6604Z" fill="white" />
              <path d="M24.6188 21.7821C25.2695 22.3353 27.7639 24.7909 27.6064 29.5849C27.4071 35.6535 28.5843 42.2609 27.6064 42.2642C26.6273 42.2642 23.096 36.7116 22.8966 30.6415C22.7423 25.9423 21.7071 22.723 21.4064 21.8802C22.1929 21.8284 22.8818 21.7821 23.4056 21.7429L24.4655 21.6604L24.6188 21.7821Z" fill="white" />
              <path d="M24.4655 20.6038C24.4158 20.6079 18.0765 21.132 14.0003 21.1321C9.90768 21.1321 3.53298 20.6038 3.53298 20.6038V19.5472C3.53298 19.5472 9.90768 20.0755 14.0003 20.0755C18.0765 20.0754 24.4158 19.5513 24.4655 19.5472V20.6038Z" fill="white" />
              <path fillRule="evenodd" clipRule="evenodd" d="M14.0003 0C19.7803 0.000392716 24.4666 4.73082 24.4666 10.566V18.4906C24.4666 18.4906 18.0927 19.0188 14.0003 19.0189C9.92442 19.0189 3.5853 18.4948 3.53401 18.4906V10.566C3.53401 4.73058 8.21992 0 14.0003 0ZM12.9537 7.00722C12.3756 7.00722 11.907 8.12735 11.907 9.50943C11.907 10.8915 12.3756 12.0116 12.9537 12.0116C13.5314 12.0107 14.0003 10.8909 14.0003 9.50943C14.0003 8.12792 13.5314 7.00815 12.9537 7.00722ZM18.1868 7.00722C17.6088 7.00722 17.1402 8.12735 17.1402 9.50943C17.1402 10.8915 17.6088 12.0116 18.1868 12.0116C18.7645 12.0107 19.2334 10.8909 19.2334 9.50943C19.2334 8.12793 18.7645 7.00815 18.1868 7.00722Z" fill="white" />
            </svg>
          </div>
        </div>
        
        <h1 className="text-4xl font-bold mb-2">ShuttleSession</h1>
        <p className="text-xl mb-8 opacity-90">Badminton Session Management</p>
        
        <div className={`max-w-md mx-auto space-y-4 ${isMobile ? 'px-4' : 'px-8'}`}>
          <p className="text-lg opacity-80 mb-6">
            Create games, manage player queues and keep your badminton sessions running smoothly.
          </p>
          
          <div className="flex flex-col space-y-2">
            <Button
              variant="secondary"
              className="w-full py-4 text-base bg-white text-app-primary-700 hover:bg-neutral-100 transition-colors border border-gray-200"
              onClick={handleShowSettings}
            >
              Edit Game Settings
            </Button>
            <Button
              onClick={handleStartSession}
              disabled={!sessionReady}
              className="w-full py-6 text-lg bg-neutral-000 text-app-primary-700 hover:bg-neutral-100 transition-colors"
            >
              Start Session
            </Button>
            {!sessionReady && (
              <p className="mt-2 text-xs text-yellow-200">
                Please edit your game settings above before starting your session.
              </p>
            )}

            {/* Player of the Month: Subtle text link below the session buttons */}
            <div className="mt-4 flex flex-col items-center">
              <AlertDialog open={showPOMConfirm} onOpenChange={setShowPOMConfirm}>
                <AlertDialogTrigger asChild>
                  <button
                    onClick={handlePOMClick}
                    className="flex items-center space-x-2 text-xs text-neutral-200 hover:text-yellow-400 cursor-pointer py-2 bg-transparent border-0 outline-none font-medium transition-colors"
                    style={{ minHeight: 0 }}
                    aria-label="Player of the Month"
                    type="button"
                  >
                    <Trophy className="h-4 w-4 mr-1 text-yellow-400" />
                    <span>Player of the Month</span>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Player Records?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Crowning the <b>Player of the Month</b> will RESET all player wins/losses records.<br />
                      <span className="text-yellow-600 font-medium">This cannot be undone.</span> <br />
                      (Player ratings will not be erased.)
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel asChild>
                      <Button variant="outline" className="w-1/2" onClick={() => setShowPOMConfirm(false)}>
                        Cancel
                      </Button>
                    </AlertDialogCancel>
                    <AlertDialogAction asChild>
                      <Button
                        className="w-1/2 bg-yellow-500 hover:bg-yellow-600 text-black"
                        onClick={handlePOMConfirmed}
                      >
                        Continue
                      </Button>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Tournament Mode temporarily hidden for release
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/20" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-shuttle-primary px-2 text-white/60">or</span>
              </div>
            </div>

            <Button
              onClick={() => navigate("/app/tournament")}
              variant="outline"
              className="w-full py-4 text-base border-white/30 text-white bg-transparent hover:bg-white/10 hover:text-white transition-colors"
            >
              <Trophy className="w-5 h-5 mr-2" />
              Tournament Mode
            </Button>
            */}
          </div>
        </div>
      </div>
      
      <div className="mt-auto pt-8 text-center opacity-70 text-sm">
        <p>© 2025 ShuttleSession</p>
      </div>

      {/* Player Of Month Dialog triggers the reset after it closes */}
      <PlayerOfMonthDialog isOpen={pomDialogOpen} onClose={() => setPOMDialogOpen(false)} />

      <PreSessionSettings isOpen={settingsOpen} onClose={handleSettingsClose} />
    </div>
  );
};

export default SplashScreen;
