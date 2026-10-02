import * as db from "../db.js";
import { onSync, syncNow, syncStatus } from "../sync.js";
import { isFirebaseConfigured } from "../config.js";
import { esc, fmtRel } from "../components/ui.js";

const LABEL = { local: "Local only", offline: "Offline", syncing: "Syncing…", synced: "Synced", pending: "Changes waiting", error: "Sync error", idle: "Idle" };

export default function syncView({ el, user }) {
  el.innerHTML = `
  <div class="page-head"><div><h1>Offline & sync</h1><p>DevPath is offline-first: every action is saved on this device immediately, then copied to Firebase when you're online.</p></div></div>
  <div class="grid g2">
    <section class="card" id="statusCard" aria-live="polite"></section>
    <section class="card"><h2>How conflicts are handled</h2>
      <div class="kv"><span>Quiz, exam, logic attempts</span><strong>Never conflict</strong></div><p class="sub">Each attempt is an immutable record with a unique id. Both devices' attempts are kept.</p>
      <div class="kv"><span>Lesson completion</span><strong>Union</strong></div><p class="sub">Completed on any device means completed everywhere. Progress can't be undone by sync.</p>
      <div class="kv"><span>Notes, bookmarks, settings, drafts</span><strong>Latest edit wins</strong></div><p class="sub">Compared by edit time. Deletions are stored as tombstones so they sync too.</p>
      <div class="kv"><span>XP, streaks, accuracy</span><strong>Recomputed</strong></div><p class="sub">Derived from the records above, never stored as counters, so they can't drift.</p></section>
    <section class="card"><h2>Test offline mode</h2><ol class="sub">
      <li>Open the app once online so the service worker caches everything.</li>
      <li>In Chrome DevTools → Network, choose <strong>Offline</strong> (or turn on airplane mode).</li>
      <li>Reload. The app opens; the status pill shows Offline.</li>
      <li>Finish a lesson or a quiz. The pending count goes up.</li>
      <li>Go back online. The pill shows Syncing…, then Synced.</li></ol></section>
    <section class="card"><h2>Install the app</h2><p class="sub"><strong>Android / Chrome:</strong> menu → Install app (or the install icon in the address bar).<br><strong>iPhone / Safari:</strong> Share → Add to Home Screen.<br><strong>Desktop Chrome / Edge:</strong> install icon at the right of the address bar.</p><button class="btn-ghost" id="installBtn" type="button" hidden>Install DevPath</button></section>
  </div>`;
  const card = el.querySelector("#statusCard");
  const paint = async (s) => {
    const items = await db.outboxList();
    const byCol = items.reduce((m, i) => ((m[i.col] = (m[i.col] || 0) + 1), m), {});
    const state = navigator.onLine ? s.state : "offline";
    card.innerHTML = `<h2>Status</h2>
      <div class="kv"><span>Connection</span><strong class="acc ${navigator.onLine ? "good" : "mid"}">${navigator.onLine ? "Online" : "Offline"}</strong></div>
      <div class="kv"><span>Sync</span><strong>${LABEL[state] || state}</strong></div>
      <div class="kv"><span>Waiting to sync</span><strong>${items.length}</strong></div>
      ${Object.entries(byCol).map(([c, n]) => `<div class="kv sub"><span>${esc(c)}</span><span>${n}</span></div>`).join("")}
      <div class="kv"><span>Last synced</span><strong>${s.lastSync ? fmtRel(s.lastSync) : "Not yet this session"}</strong></div>
      <div class="kv"><span>Local storage</span><strong>${db.isPersistent() ? "IndexedDB (persistent)" : "Memory only"}</strong></div>
      <div class="kv"><span>Cloud</span><strong>${!isFirebaseConfigured() ? "Not configured" : user.mode === "local" ? "Off (local mode)" : "Firebase Firestore"}</strong></div>
      ${s.error ? `<p class="err">${esc(s.error)}</p>` : ""}
      <button class="btn" id="now" type="button" style="margin-top:1rem" ${user.mode === "local" ? "disabled" : ""}>Sync now</button>`;
    card.querySelector("#now").onclick = () => syncNow();
  };
  const off = onSync(paint);
  const onNet = () => paint(syncStatus());
  addEventListener("online", onNet); addEventListener("offline", onNet);
  const ib = el.querySelector("#installBtn");
  if (window.__installPrompt) { ib.hidden = false; ib.onclick = async () => { window.__installPrompt.prompt(); await window.__installPrompt.userChoice; window.__installPrompt = null; ib.hidden = true; }; }
  return () => { off(); removeEventListener("online", onNet); removeEventListener("offline", onNet); };
}
