import { PlayPreference } from "./member";

export interface CourtPlayer {
  id: number;
  name: string;
  gender: "male" | "female";
  isGuest?: boolean;
  playPreferences?: PlayPreference[];
  rating?: number;
}

export interface Court {
  id: number;
  name: string;
  status: "available" | "occupied";
  players: CourtPlayer[];
  timeRemaining: number;
}
