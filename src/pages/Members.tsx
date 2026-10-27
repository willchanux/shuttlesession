
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Member } from "@/types/member";
import { MemberForm } from "@/components/members/MemberForm";
import { MemberList } from "@/components/members/MemberList";
import { DeleteConfirmDialog } from "@/components/members/DeleteConfirmDialog";
import { DashboardProvider, useDashboard } from "@/contexts/DashboardContext";

// Empty initial members list
const initialMembers: Member[] = [];
export default function Members() {
  return (
    <DashboardProvider>
      <MembersPageContent />
    </DashboardProvider>
  );
}

function MembersPageContent() {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<number | null>(null);
  const [preferencesEnabled, setPreferencesEnabled] = useState(false);

  const { updateActivePlayerInfo } = useDashboard();

  // Helper function to check if an object has the basic member structure
  function hasBasicMemberStructure(obj: any): boolean {
    return (
      obj &&
      typeof obj === "object" &&
      typeof obj.id === "number" &&
      typeof obj.name === "string" &&
      (obj.gender === "male" || obj.gender === "female") &&
      typeof obj.isGuest === "boolean"
    );
  }

  // Helper function to ensure member has all required fields
  function ensureMemberFields(obj: any): Member {
    return {
      ...obj,
      wins: typeof obj.wins === "number" ? obj.wins : 0,
      losses: typeof obj.losses === "number" ? obj.losses : 0,
      playPreferences: Array.isArray(obj.playPreferences) ? obj.playPreferences : [],
      rating: typeof obj.rating === "number" ? obj.rating : 1000
    };
  }

  // Function to load members from localStorage
  const loadMembers = () => {
    const savedMembers = localStorage.getItem("clubMembers");
    if (savedMembers) {
      try {
        const parsedMembers = JSON.parse(savedMembers);
        console.log("Raw parsed members:", parsedMembers);
        
        // Filter for basic structure first, then ensure all fields
        let validMembers = Array.isArray(parsedMembers)
          ? parsedMembers
              .filter(hasBasicMemberStructure)
              .map(ensureMemberFields)
          : [];
        
        console.log("Valid members after processing:", validMembers);
        
        // Check for duplicate IDs and warn
        const ids = validMembers.map((m: any) => m.id);
        const hasDuplicateIds = ids.length !== new Set(ids).size;
        if (hasDuplicateIds) {
          console.warn("Duplicate member IDs found in localStorage!", ids);
        }
        
        setMembers(validMembers);
        
        // Save the processed members back to localStorage to ensure consistency
        localStorage.setItem("clubMembers", JSON.stringify(validMembers));
        localStorage.setItem("members", JSON.stringify(validMembers)); // Keep both in sync
      } catch (e) {
        console.error("Error parsing members from localStorage", e);
      }
    }
  };

  // Load members from localStorage on component mount
  useEffect(() => {
    const enablePref = localStorage.getItem("enablePlayerPreferences");
    setPreferencesEnabled(enablePref === "true");
    loadMembers();
  }, []);

  // Listen for storage events to auto-refresh when members are added from other components
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'clubMembers' && e.newValue) {
        console.log("Members page: Storage event detected, refreshing members list");
        loadMembers();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Save members to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("clubMembers", JSON.stringify(members));
    localStorage.setItem("members", JSON.stringify(members)); // Keep both in sync
  }, [members]);

  // Sort members alphabetically by name
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => a.name.localeCompare(b.name));
  }, [members]);

  const handleAddMember = () => {
    setEditMode(false);
    setEditingMember(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (member: Member) => {
    setEditingMember(member);
    setEditMode(true);
    setIsDialogOpen(true);
  };

  const handleSaveMember = (memberData: Omit<Member, "id" | "wins" | "losses">) => {
    if (editMode && editingMember) {
      // --- LOG the state before update
      console.log("Before update:", members.map(m => ({ id: m.id, name: m.name })));

      // Update existing member only (verify by ID)
      const updatedMembers = members.map(member =>
        member.id === editingMember.id
          ? {
              ...member,
              name: memberData.name,
              gender: memberData.gender,
              isGuest: memberData.isGuest,
              playPreferences: preferencesEnabled ? memberData.playPreferences : member.playPreferences
            }
          : member
      );
      
      // --- LOG the state after update
      console.log("After update:", updatedMembers.map(m => ({ id: m.id, name: m.name })));
      
      setMembers(updatedMembers);
      toast.success("Member updated successfully");
      
      // --- SYNC if player is active - use ID-based update ---
      updateActivePlayerInfo({
        id: editingMember.id,
        previousName: editingMember.name,
        name: memberData.name,
        gender: memberData.gender,
        isGuest: memberData.isGuest,
        playPreferences: preferencesEnabled ? memberData.playPreferences : [],
      });
    } else {
      // Add new member - guarantee a new unique timestamp (retry if collision)
      let newId = Date.now();
      while (members.some(m => m.id === newId)) {
        newId += 1;
      }
      const newMember = {
        id: newId,
        name: memberData.name,
        gender: memberData.gender,
        isGuest: memberData.isGuest,
        wins: 0,
        losses: 0,
        playPreferences: preferencesEnabled ? memberData.playPreferences : [],
        rating: 1000
      };
      setMembers([...members, newMember]);
      toast.success("Member added successfully");
    }
    setIsDialogOpen(false);
    setEditMode(false);
    setEditingMember(null);
  };

  const confirmDeleteMember = (memberId: number) => {
    setMemberToDelete(memberId);
    setIsAlertDialogOpen(true);
  };

  const handleDeleteMember = () => {
    if (memberToDelete !== null) {
      // Only delete if there are valid members
      const updatedMembers = members.filter(
        (member) => member.id !== memberToDelete
      );
      setMembers(updatedMembers);
      setIsAlertDialogOpen(false);
      setMemberToDelete(null);
      toast.success("Member removed successfully");
    }
  };

  // Check if score keeping is enabled
  const isScoreKeepingEnabled = localStorage.getItem("scoreKeeping") === "true";

  return (
    <div className="space-y-6 w-full col-span-full">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-2xl font-bold mb-2 text-shuttle-lightBlue">Members</h1>
          <p className="text-shuttle-lightBlue">Manage club members</p>
        </div>
        
        <Button onClick={handleAddMember} className="text-shuttle-primary bg-shuttle-lightBlue">Add Member</Button>
      </div>
      
      <MemberList 
        members={sortedMembers} 
        isScoreKeepingEnabled={isScoreKeepingEnabled} 
        preferencesEnabled={preferencesEnabled} 
        onEditMember={handleEditClick} 
        onDeleteMember={confirmDeleteMember} 
      />

      {/* Add/Edit Member Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <MemberForm 
          isEditMode={editMode} 
          initialMember={editingMember} 
          preferencesEnabled={preferencesEnabled} 
          onSave={handleSaveMember} 
          onCancel={() => setIsDialogOpen(false)} 
        />
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog 
        isOpen={isAlertDialogOpen} 
        onClose={() => setIsAlertDialogOpen(false)} 
        onConfirm={handleDeleteMember} 
      />
    </div>
  );
}
