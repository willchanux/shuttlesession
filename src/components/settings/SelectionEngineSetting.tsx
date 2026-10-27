import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { SELECTION_ENGINE_KEY, isMixerEngineEnabled } from "@/utils/mixer/suggestion";

/** Switches between the original auto-select and the newer mixing engine. */
export function SelectionEngineSetting() {
  const [mixer, setMixer] = useState<boolean>(() => isMixerEngineEnabled());
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const handleValueChange = (value: string) => {
    const useMixer = value === "mixer";
    setMixer(useMixer);
    try {
      if (useMixer) localStorage.setItem(SELECTION_ENGINE_KEY, "mixer");
      else localStorage.removeItem(SELECTION_ENGINE_KEY);
    } catch (e) {
      console.error("Error saving selection engine:", e);
    }
    toast({
      title: "Setting saved",
      description: "Applies to the next game that is picked.",
    });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b pb-4 gap-4">
      <div>
        <h3 className="font-medium text-foreground">Player mixing (beta)</h3>
        <p className="text-sm text-muted-foreground">
          Auto-select mixes partners, opponents and formats more. The longest waiter always plays.
        </p>
      </div>
      <RadioGroup
        value={mixer ? "mixer" : "standard"}
        onValueChange={handleValueChange}
        className={`flex ${isMobile ? "flex-col space-y-2" : "space-x-2"}`}
      >
        <div className="flex items-center space-x-3 cursor-pointer hover:bg-accent/50 rounded-md p-2 transition-colors">
          <RadioGroupItem value="standard" id="engine-standard" />
          <Label htmlFor="engine-standard" className="cursor-pointer text-foreground font-medium">Standard</Label>
        </div>
        <div className="flex items-center space-x-3 cursor-pointer hover:bg-accent/50 rounded-md p-2 transition-colors">
          <RadioGroupItem value="mixer" id="engine-mixer" />
          <Label htmlFor="engine-mixer" className="cursor-pointer text-foreground font-medium">Mixing</Label>
        </div>
      </RadioGroup>
    </div>
  );
}
