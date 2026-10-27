# Changelog

What changed in each version of Shuttle Session, in plain words. The newest is at the top.

## 1.3.1 - 27 October 2026

### New
- **Player mixing (beta).** A new setting (Settings → Player mixing) that picks games to mix people up more: fresh partners and opponents, and a change between Mixed and Open/Ladies games. The longest waiter always plays, and nobody is passed over more than twice. It is off by default; the original auto-select is still the standard.
- **Why this group?** On the Next Game card, a short list of reasons for the suggested group (with Player mixing on).
- **Plays next.** A badge in the queue for a player who has been passed over twice.

### Improved
- Auto-select now avoids repeating the same partners and opponents more reliably, and only counts tonight's games.
- Piggybacking now moves the earlier player down to join the later one, so nobody jumps ahead or is pulled up, and Clear Selection puts everyone back where they were.
- The player preference chips (Open, Mixed, Ladies) were removed from the queue cards to reduce clutter. Preferences are still shown and edited under Members.
- Settings now shows the real app version and build date.

### Fixed
- The page no longer stops responding after recording game winners, after using Piggyback, after ending a session, or around Player of the Month.
- Editing a member (name, gender, preferences) now changes them in the live queue, next game and courts. Previously only the screen changed.
- A newly added player is now linked to their member record straight away, so editing them (for example fixing their gender) works.
- "Ladies" is removed from a player's preferences when they are a man, including for members saved that way before.
- Voiding a game now takes it back out of the history, the session record and players' lifetime totals, so those four are not treated as having just played together.
- Players keep their preferences and rating when they go on and off a court.
- Repeat-game history now clears when a session ends, and old sessions that were never ended no longer count as tonight.

### Behind the scenes
- A simulator for comparing how different auto-select engines mix a night of play, and automated tests for the new code.

---

Earlier versions were not tracked.
