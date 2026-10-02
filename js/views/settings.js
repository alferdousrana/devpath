import * as db from "../db.js";
import { merge, syncNow } from "../sync.js";
import { goals } from "../progress.js";
import { signOut } from "../auth.js";
import { setTheme } from "../app.js";
import { APP, DEFAULT_GOALS } from "../config.js";
import { toast, confirmBox, esc } from "../components/ui.js";

const clampInt = (v, lo, hi, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

export default function settings({ el, user }) {
  const p = db.get("profile", "main") || {};
  const g = goals();
  const theme = document.documentElement.dataset.theme;
  const num = (id, label, v, lo, hi, help) => `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="number" min="${lo}" max="${hi}" value="${v}" inputmode="numeric"><small class="muted">${help}</small></div>`;
  el.innerHTML = `
  <div class="page-head"><div><h1>Settings</h1></div></div>
  <div class="grid g2">
    <section class="card"><h2>Appearance</h2>
      <div class="field"><label>Theme</label><div class="seg" role="group" aria-label="Theme" id="theme">${[["dark", "Dark"], ["light", "Light"]].map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${theme === v}">${t}</button>`).join("")}</div></div>
      <div class="field"><label>MCQ feedback by default</label><div class="seg" role="group" aria-label="Feedback" id="fb">${[["1", "After each answer"], ["0", "At the end"]].map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${String(p.immediateFeedback !== false ? "1" : "0") === v}">${t}</button>`).join("")}</div></div>
    </section>
    <section class="card"><h2>Daily and weekly goals</h2>
      <form id="goals">
        <div class="grid g2">${num("g-lessons", "Lessons per day", g.lessons, 1, 5, "1–5")}${num("g-mcq", "MCQs per day", g.mcq, 5, 50, "5–50")}${num("g-logic", "Logic problems per day", g.logic, 1, 5, "1–5")}${num("g-review", "Reviews per day", g.review, 0, 30, "0–30")}</div>
        ${num("g-week", "Weekly XP goal", g.weeklyXp, 100, 5000, "Weekly streaks count weeks that hit this.")}
        <div class="row"><button class="btn" type="submit">Save goals</button><button class="btn-ghost" type="button" id="defGoals">Use defaults</button></div>
      </form></section>
    <section class="card"><h2>Your data</h2>
      <p class="sub">Export a full JSON backup of your progress, notes and bookmarks. Importing merges with what's here using the same rules sync uses, so nothing is overwritten with older data.</p>
      <div class="row"><button class="btn-ghost" id="export" type="button">Export backup</button><label class="btn-ghost" for="importFile" style="margin:0">Import backup</label><input id="importFile" type="file" accept="application/json,.json" hidden></div>
      <hr><p class="sub">Clear this device's copy of your data. ${user.mode === "local" ? "<strong>In local mode this deletes your progress permanently.</strong>" : "Cloud data stays; it downloads again on next sync."}</p>
      <button class="btn danger" id="wipe" type="button">Clear data on this device</button></section>
    <section class="card"><h2>Account</h2>
      <div class="kv"><span>Signed in as</span><strong>${esc(user.email || user.name)}</strong></div>
      <div class="kv"><span>Mode</span><strong>${user.mode === "local" ? "Local only (no sync)" : user.mode === "offline-cached" ? "Offline session" : "Firebase account"}</strong></div>
      <div class="kv"><span>App version</span><strong>${APP.version}</strong></div>
      <div class="row" style="margin-top:1rem"><button class="btn-ghost" id="update" type="button">Check for updates</button><button class="btn-ghost" id="out" type="button">Sign out</button></div></section>
  </div>`;

  const saveProfile = (patch) => db.put("profile", "main", { ...(db.get("profile", "main") || {}), ...patch });
  el.querySelector("#theme").addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (!b) return; setTheme(b.dataset.v); saveProfile({ theme: b.dataset.v }); el.querySelectorAll("#theme button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); });
  el.querySelector("#fb").addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (!b) return; saveProfile({ immediateFeedback: b.dataset.v === "1" }); el.querySelectorAll("#fb button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); toast("Saved.", { type: "ok" }); });
  el.querySelector("#goals").addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = (id) => el.querySelector(id).value;
    await saveProfile({ goals: { lessons: clampInt(v("#g-lessons"), 1, 5, 1), mcq: clampInt(v("#g-mcq"), 5, 50, 10), logic: clampInt(v("#g-logic"), 1, 5, 1), review: clampInt(v("#g-review"), 0, 30, 5), weeklyXp: clampInt(v("#g-week"), 100, 5000, 400) } });
    toast("Goals saved.", { type: "ok" });
  });
  el.querySelector("#defGoals").addEventListener("click", async () => { await saveProfile({ goals: { ...DEFAULT_GOALS } }); toast("Default goals restored.", { type: "ok" }); location.reload(); });
  el.querySelector("#export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(db.exportAll(), null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `devpath-backup-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  el.querySelector("#importFile").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 20 * 1024 * 1024) { toast("That file is too large to be a DevPath backup.", { type: "error" }); return; }
    try { const n = await db.importAll(JSON.parse(await f.text()), merge); toast(`Imported ${n} records.`, { type: "ok" }); syncNow(); }
    catch (err) { toast(err.message || "Import failed.", { type: "error" }); }
    e.target.value = "";
  });
  el.querySelector("#wipe").addEventListener("click", async () => {
    const pending = (await db.outboxList()).length;
    const warn = user.mode === "local" ? "This permanently deletes all your progress, notes and bookmarks." : pending ? `${pending} changes haven't synced yet and will be lost.` : "Your cloud copy is untouched.";
    if (!(await confirmBox("Clear data on this device?", warn, "Clear data", true))) return;
    await db.wipeUser(); localStorage.removeItem(`devpath:lastPull:${user.uid}`); toast("Device data cleared.", { type: "ok" }); location.hash = "#/dashboard";
  });
  el.querySelector("#update").addEventListener("click", async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!reg) { toast("Service worker isn't active here."); return; }
    await reg.update(); toast(reg.waiting || reg.installing ? "Update downloading. Reload when prompted." : "You're on the latest version.");
  });
  el.querySelector("#out").addEventListener("click", async () => {
    const pending = (await db.outboxList()).length;
    if (pending && user.mode !== "local" && !(await confirmBox("Sign out?", `${pending} changes haven't synced yet. They stay on this device and sync next time you sign in here.`, "Sign out"))) return;
    signOut();
  });
}
