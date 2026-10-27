import { useState, useEffect } from "react";
import { preferencesForGender } from "@/utils/preferences";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GenderRadioGroup } from "./GenderRadioGroup";
import { PlayPreferencesSelector } from "./PlayPreferencesSelector";
import { PlayPreference, Member } from "@/types/member";
import { UserPlus, AlertTriangle } from "lucide-react";
import { getStorageItem } from "@/utils/storageUtils";

interface CreateMemberFormProps {
  initialName: string;
  existingMembers: Member[];
  onSubmit: (data: {
    name: string;
    gender: "male" | "female";
    isGuest: boolean;
    playPreferences: PlayPreference[];
  }) => void;
  onCancel: () => void;
}

export function CreateMemberForm({
  initialName,
  existingMembers,
  onSubmit,
  onCancel,
}: CreateMemberFormProps) {
  const [name, setName] = useState(initialName);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [isGuest, setIsGuest] = useState(false);
  const [playPreferences, setPlayPreferences] = useState<PlayPreference[]>([]);
  const [preferencesEnabled, setPreferencesEnabled] = useState(false);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    const enabled = getStorageItem("enablePlayerPreferences", true);
    setPreferencesEnabled(enabled);
  }, []);

  const togglePreference = (preference: PlayPreference) => {
    if (playPreferences.includes(preference)) {
      setPlayPreferences(playPreferences.filter((p) => p !== preference));
    } else {
      setPlayPreferences([...playPreferences, preference]);
    }
  };

  // Check for similar existing members
  const similarMember = existingMembers.find(
    (m) => m.name.toLowerCase() === name.trim().toLowerCase()
  );

  const isValidName = (val: string) => /^[\w\s\-.'']{2,30}$/.test(val.trim());
  const canSubmit = name.trim().length > 0 && isValidName(name);

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      gender,
      isGuest,
      playPreferences: preferencesEnabled ? preferencesForGender(gender, playPreferences) : [],
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <UserPlus size={18} />
          Create New Member
        </h3>
      </div>

      <p className="text-xs text-muted-foreground">
        This will create a new member in your database and add them to the queue.
      </p>

      {similarMember && (
        <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
          <AlertTriangle size={16} className="text-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-warning">Similar member exists</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              A member named "{similarMember.name}" already exists. Did you mean to
              select them from the list above?
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="new-member-name">Name</Label>
        <Input
          id="new-member-name"
          placeholder="Enter player name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
      </div>

      <GenderRadioGroup gender={gender} setGender={setGender} />

      {preferencesEnabled && (
        <PlayPreferencesSelector
          gender={gender}
          playPreferences={playPreferences}
          togglePreference={togglePreference}
        />
      )}

      <div className="flex items-center space-x-3 cursor-pointer hover:bg-accent/50 rounded-md p-2 transition-colors">
        <Checkbox
          id="new-member-guest"
          checked={isGuest}
          onCheckedChange={(checked) => setIsGuest(checked === true)}
        />
        <Label htmlFor="new-member-guest" className="cursor-pointer">
          Guest
        </Label>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit} className="flex-1">
          <UserPlus size={16} className="mr-2" />
          Create & Add
        </Button>
      </div>
    </div>
  );
}
