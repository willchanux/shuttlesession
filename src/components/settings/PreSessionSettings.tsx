
import React from "react";
import { PlayerPoolSizeSetting } from "./PlayerPoolSizeSetting";
import { CourtNumberSetting } from "./CourtNumberSetting";
import { PlayerPreferencesSetting } from "./PlayerPreferencesSetting";
import { SelectionEngineSetting } from "./SelectionEngineSetting";
import { ScoreKeepingSetting } from "./ScoreKeepingSetting";
import { PiggybackSetting } from "./PiggybackSetting";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetFooter 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface PreSessionSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PreSessionSettings: React.FC<PreSessionSettingsProps> = ({ isOpen, onClose }) => {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-2xl font-semibold text-foreground">Session Settings</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Configure session settings as required before starting your session.
          </SheetDescription>
        </SheetHeader>
        
        <div className="bg-white rounded-xl shadow-sm p-4 border mb-4">
          <h3 className="text-lg font-semibold mb-3 text-foreground">General Game Settings</h3>
          <div className="flex flex-col gap-5">
            <PlayerPoolSizeSetting />
            <CourtNumberSetting />
            <PlayerPreferencesSetting />
            <SelectionEngineSetting />
            <ScoreKeepingSetting />
            <PiggybackSetting />
          </div>
        </div>

        <SheetFooter className="pt-4">
          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
