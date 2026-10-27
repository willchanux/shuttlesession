
import React from "react";
import { PlayerPoolSizeSetting } from "./PlayerPoolSizeSetting";
import { CourtNumberSetting } from "./CourtNumberSetting";
import { PlayerPreferencesSetting } from "./PlayerPreferencesSetting";
import { SelectionEngineSetting } from "./SelectionEngineSetting";
import { ScoreKeepingSetting } from "./ScoreKeepingSetting";
import { PiggybackSetting } from "./PiggybackSetting";

export function GeneralSettings() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border">
      <h2 className="text-xl font-semibold mb-3 text-foreground">General Game Settings</h2>
      <div className="flex flex-col gap-6">
        <PlayerPoolSizeSetting />
        <CourtNumberSetting />
        <PlayerPreferencesSetting />
        <SelectionEngineSetting />
        <ScoreKeepingSetting />
        <PiggybackSetting />
      </div>
    </div>
  );
}
