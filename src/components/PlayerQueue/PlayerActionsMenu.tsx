import React from "react";
import { MoreVertical, Pause, Play, Users, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Player } from "@/types/player";
import { PiggybackPair } from "@/hooks/usePiggybackPairs";
import { getPiggybackEnabled } from "@/utils/storageUtils";

interface PlayerActionsMenuProps {
  player: Player;
  piggybackPairs: PiggybackPair[];
  findPiggybackPair: (playerId: number) => PiggybackPair | undefined;
  onToggleRest: (playerId: number) => void;
  onOpenPiggybackModal?: (player: Player) => void;
  onRemovePiggybackPair?: (masterId: number) => void;
  onPlayerLeave: (playerId: number, e: React.MouseEvent) => void;
  setPiggybackManualWarningShown?: (b: boolean) => void;
}

export function PlayerActionsMenu({
  player,
  piggybackPairs,
  findPiggybackPair,
  onToggleRest,
  onOpenPiggybackModal,
  onRemovePiggybackPair,
  onPlayerLeave,
  setPiggybackManualWarningShown
}: PlayerActionsMenuProps) {
  const piggybackEnabled = getPiggybackEnabled();
  const pair = piggybackEnabled && findPiggybackPair ? findPiggybackPair(player.id) : undefined;
  const isMaster = pair?.master === player.id;

  return (
    // Not modal: this menu opens dialogs (Piggyback), and a modal menu closing as a
    // dialog opens can leave the whole page unclickable.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px] w-11 border border-gray-300 hover:bg-gray-50"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Player actions</span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-48 bg-white border border-gray-200 shadow-lg z-50">
        {/* Pause/Resume */}
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onToggleRest(player.id);
          }}
          className="flex items-center gap-2 cursor-pointer hover:bg-gray-50"
        >
          {player.isResting ? (
            <>
              <Play className="h-4 w-4" />
              Resume
            </>
          ) : (
            <>
              <Pause className="h-4 w-4" />
              Pause
            </>
          )}
        </DropdownMenuItem>

        {/* Piggyback Actions - only show if enabled */}
        {piggybackEnabled && (
          <>
            <DropdownMenuSeparator />
            
            {/* Show Piggyback option if not in a pair */}
            {!pair && onOpenPiggybackModal && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPiggybackModal(player);
                  setPiggybackManualWarningShown?.(false);
                }}
                className="flex items-center gap-2 cursor-pointer hover:bg-purple-50 text-purple-700"
              >
                <Users className="h-4 w-4" />
                Piggyback
              </DropdownMenuItem>
            )}
            
            {/* Show Unpiggyback option if master of a pair */}
            {isMaster && onRemovePiggybackPair && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRemovePiggybackPair(player.id);
                }}
                className="flex items-center gap-2 cursor-pointer hover:bg-purple-50 text-purple-700"
              >
                <Users className="h-4 w-4" />
                Unpiggyback
              </DropdownMenuItem>
            )}
          </>
        )}

        <DropdownMenuSeparator />
        
        {/* Leave Queue */}
        <DropdownMenuItem
          onClick={(e) => onPlayerLeave(player.id, e)}
          className="flex items-center gap-2 cursor-pointer hover:bg-red-50 text-red-600"
        >
          <LogOut className="h-4 w-4" />
          Leave Queue
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}