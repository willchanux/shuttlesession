import { preferencesForGender } from "./preferences";

const KEYS = ["members", "clubMembers", "playerQueue", "nextGamePlayers"];

/** Removes "Ladies" from any man in a list; returns the same list if nothing changed. */
export function cleanPeople(list: any[]): { list: any[]; changed: boolean } {
  let changed = false;
  const cleaned = list.map(person => {
    if (!person || person.gender !== "male" || !Array.isArray(person.playPreferences)) return person;
    const prefs = preferencesForGender("male", person.playPreferences);
    if (prefs.length === person.playPreferences.length) return person;
    changed = true;
    return { ...person, playPreferences: prefs };
  });
  return { list: cleaned, changed };
}

/**
 * One-off tidy-up: the "Ladies" preference used to stay saved on a woman who was
 * later changed to a man. Remove it from the saved members, queue and next game
 * (and court players), writing back only what changed. Safe to run on every load.
 */
export function cleanLadiesFromMen(storage: Pick<Storage, "getItem" | "setItem"> = localStorage): void {
  try {
    for (const key of KEYS) {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const { list, changed } = cleanPeople(JSON.parse(raw));
      if (changed) storage.setItem(key, JSON.stringify(list));
    }

    const rawCourts = storage.getItem("courts");
    if (rawCourts) {
      const courts: any[] = JSON.parse(rawCourts);
      let changed = false;
      const cleaned = courts.map(court => {
        if (!Array.isArray(court?.players)) return court;
        const result = cleanPeople(court.players);
        if (!result.changed) return court;
        changed = true;
        return { ...court, players: result.list };
      });
      if (changed) storage.setItem("courts", JSON.stringify(cleaned));
    }
  } catch (e) {
    console.error("Error cleaning saved preferences:", e);
  }
}
