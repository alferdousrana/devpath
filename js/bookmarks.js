// Bookmarks use soft deletes (active:false) so removing one on a device that's
// offline still wins over an older "add" from another device (last-write-wins).
import * as db from "./db.js";
import { icon } from "./components/ui.js";

const id = (type, refId) => `${type}:${refId}`;
export const isSaved = (type, refId) => Boolean(db.get("bookmarks", id(type, refId))?.active);
export async function toggle(type, refId) {
  const now = !isSaved(type, refId);
  await db.put("bookmarks", id(type, refId), { type, refId, active: now, savedAt: Date.now() });
  return now;
}
export const saved = () => db.list("bookmarks").filter((b) => b.active).sort((a, b) => b.savedAt - a.savedAt);

export const button = (type, refId, label = "Save") =>
  `<button type="button" class="btn-ghost sm ${isSaved(type, refId) ? "on" : ""}" data-bm="${type}" data-ref="${refId}" data-label="${label}" aria-pressed="${isSaved(type, refId)}">${icon("bookmark", "sm")}<span>${isSaved(type, refId) ? "Saved" : label}</span></button>`;

// Delegated handler; call once per view root.
export function wire(root, label = "Save") {
  if (root.dataset.bmWired) return;
  root.dataset.bmWired = "1";
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-bm]");
    if (!b) return;
    const on = await toggle(b.dataset.bm, b.dataset.ref);
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
    b.querySelector("span").textContent = on ? "Saved" : (b.dataset.label || label);
  });
}
