import { useState, useEffect } from "react";
import { preferencesForGender } from "@/utils/preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Save, X } from "lucide-react";
import { PlayPreference, Member } from "@/types/member";

interface MemberFormProps {
  isEditMode: boolean;
  initialMember?: Member | null;
  preferencesEnabled: boolean;
  onSave: (memberData: Omit<Member, "id" | "wins" | "losses">) => void;
  onCancel: () => void;
}

export function MemberForm({
  isEditMode,
  initialMember,
  preferencesEnabled,
  onSave,
  onCancel
}: MemberFormProps) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [isGuest, setIsGuest] = useState(false);
  const [playPreferences, setPlayPreferences] = useState<PlayPreference[]>([]);
  
  // Initialize form with member data when editing
  useEffect(() => {
    if (isEditMode && initialMember) {
      setName(initialMember.name);
      setGender(initialMember.gender);
      setIsGuest(initialMember.isGuest);
      setPlayPreferences(initialMember.playPreferences || []);
    } else {
      // Reset form for new member
      setName("");
      setGender("male");
      setIsGuest(false);
      setPlayPreferences([]);
    }
  }, [isEditMode, initialMember]);
  
  const togglePreference = (preference: PlayPreference) => {
    if (playPreferences.includes(preference)) {
      setPlayPreferences(playPreferences.filter(p => p !== preference));
    } else {
      setPlayPreferences([...playPreferences, preference]);
    }
  };
  
  const isValidName = (val: string) => /^[\w\s\-.'’]{2,30}$/.test(val.trim());

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!isValidName(trimmedName)) return;

    onSave({
      name: trimmedName,
      gender,
      isGuest,
      playPreferences: preferencesEnabled ? preferencesForGender(gender, playPreferences) : []
    });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEditMode ? "Edit Member" : "Add New Member"}</DialogTitle>
      </DialogHeader>
      
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input 
            id="name" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter member name"
            maxLength={30}
            pattern="^[\w\s\-.'’]{2,30}$"
            required
          />
          {!isValidName(name) && name.length > 0 && (
            <span className="text-red-500 text-xs">Name must be 2–30 characters (letters, numbers, - . ' allowed)</span>
          )}
        </div>

        <div className="space-y-2">
          <Label>Gender</Label>
          <RadioGroup 
            value={gender}
            onValueChange={(value) => {
              const next = value as "male" | "female";
              setGender(next);
              setPlayPreferences(prev => preferencesForGender(next, prev));
            }}
            className="flex flex-col space-y-2"
          >
            <div className="flex items-center space-x-3 cursor-pointer hover:bg-accent/50 rounded-md p-2 transition-colors">
              <RadioGroupItem value="male" id="male" />
              <Label htmlFor="male" className="cursor-pointer">Male</Label>
            </div>
            <div className="flex items-center space-x-3 cursor-pointer hover:bg-accent/50 rounded-md p-2 transition-colors">
              <RadioGroupItem value="female" id="female" />
              <Label htmlFor="female" className="cursor-pointer">Female</Label>
            </div>
          </RadioGroup>
        </div>
        
        {/* Play preferences */}
        {preferencesEnabled && (
          <div className="space-y-2">
            <Label>Play Preferences</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-3 cursor-pointer hover:bg-accent/50 rounded-md p-2 transition-colors">
                <Checkbox 
                  id="open-play" 
                  checked={playPreferences.includes("Open")}
                  onCheckedChange={() => togglePreference("Open")}
                />
                <Label htmlFor="open-play" className="cursor-pointer">Open Play (any combination)</Label>
              </div>
              <div className="flex items-center space-x-3 cursor-pointer hover:bg-accent/50 rounded-md p-2 transition-colors">
                <Checkbox 
                  id="mixed-play" 
                  checked={playPreferences.includes("Mixed")}
                  onCheckedChange={() => togglePreference("Mixed")}
                />
                <Label htmlFor="mixed-play" className="cursor-pointer">Mixed Play (male/female pairs)</Label>
              </div>
              {gender === "female" && (
                <div className="flex items-center space-x-3 cursor-pointer hover:bg-accent/50 rounded-md p-2 transition-colors">
                  <Checkbox 
                    id="ladies-play" 
                    checked={playPreferences.includes("Ladies")}
                    onCheckedChange={() => togglePreference("Ladies")}
                  />
                  <Label htmlFor="ladies-play" className="cursor-pointer">Ladies Play (females only)</Label>
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="flex items-center space-x-3 cursor-pointer hover:bg-accent/50 rounded-md p-2 transition-colors">
          <Checkbox 
            id="guest" 
            checked={isGuest}
            onCheckedChange={(checked) => setIsGuest(checked === true)}
          />
          <Label htmlFor="guest" className="cursor-pointer">Guest</Label>
        </div>
      </div>
      
      <DialogFooter>
        {isEditMode ? (
          <>
            <Button variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim()}>
              <Save className="h-4 w-4 mr-1" /> Save Changes
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim()}>
              Add Member
            </Button>
          </>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
