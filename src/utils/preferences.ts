import { PlayPreference } from "../types/member";

/**
 * The preferences that make sense for this gender. "Ladies" is only offered to
 * women, so it is dropped for a man; otherwise it stays saved but hidden after a
 * gender change, shows as a badge next to his name, and for someone who only had
 * "Ladies" leaves him with no game he can be put in.
 */
export function preferencesForGender(gender: "male" | "female", preferences: PlayPreference[]): PlayPreference[] {
  return gender === "male" ? preferences.filter(p => p !== "Ladies") : preferences;
}
