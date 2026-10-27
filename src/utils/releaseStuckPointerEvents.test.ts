import { describe, it, expect } from "vitest";
import { releaseStuckPointerEvents } from "./releaseStuckPointerEvents";

const fakeDoc = (pointerEvents: string, modalOpen: boolean) =>
  ({
    body: { style: { pointerEvents } },
    querySelector: () => (modalOpen ? {} : null),
  }) as unknown as Document;

describe("releaseStuckPointerEvents", () => {
  it("clears a stuck block when nothing modal is open", () => {
    const doc = fakeDoc("none", false);
    expect(releaseStuckPointerEvents(doc)).toBe(true);
    expect(doc.body.style.pointerEvents).toBe("");
  });

  it("leaves the block alone while a dialog is open", () => {
    const doc = fakeDoc("none", true);
    expect(releaseStuckPointerEvents(doc)).toBe(false);
    expect(doc.body.style.pointerEvents).toBe("none");
  });

  it("does nothing when the page is already clickable", () => {
    expect(releaseStuckPointerEvents(fakeDoc("", false))).toBe(false);
  });
});
