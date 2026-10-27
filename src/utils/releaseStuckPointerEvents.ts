/**
 * Radix dialogs make the rest of the page unclickable (body pointer-events:
 * none) while open and undo it when they close. If one dialog closes just as
 * another opens, the undo can be missed and the page stays dead. This clears it
 * once nothing modal is actually open.
 */
export function releaseStuckPointerEvents(doc: Document = document): boolean {
  const body = doc.body;
  if (!body || body.style.pointerEvents !== "none") return false;

  const modalOpen = doc.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
  if (modalOpen) return false;

  body.style.pointerEvents = "";
  return true;
}
