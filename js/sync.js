// ---------------------------------------------------------------------------
// Sync engine: local IndexedDB  ⇄  Firestore users/{uid}/...
//
// 1. pull:  fetch cloud docs changed since the last pull, merge into local.
// 2. flush: drain the outbox, merging with the cloud copy before each write.
// Runs on sign-in, when the browser comes online, after every local write
// (debounced) and every 60 s while items are pending.
// ---------------------------------------------------------------------------
import * as db from "./db.js";
import { getFb, loadFirebase } from "./firebase.js";

let user = null;
let running = false;
let rerun = false;
let timer = null;
let status = { state: "idle", pending: 0, lastSync: 0, error: "" };
const listeners = new Set();

export const syncStatus = () => ({ ...status });
export function onSync(fn) { listeners.add(fn); fn(syncStatus()); return () => listeners.delete(fn); }
function set(patch) { status = { ...status, ...patch }; listeners.forEach((f) => f(syncStatus())); }

// Merge two versions of a document according to the collection strategy.
export function merge(strategy, local, remote) {
  if (!local) return remote;
  if (!remote) return local;
  if (strategy === "append") return local;
  if (strategy === "lesson") {
    const completed = Boolean(local.completed || remote.completed);
    const times = [local.completedAt, remote.completedAt].filter(Boolean);
    const merged = { ...remote, ...local, completed, completedAt: times.length ? Math.min(...times) : null,
      updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0) };
    const same = merged.completed === local.completed && merged.completedAt === local.completedAt;
    return same ? local : merged;
  }
  return (remote.updatedAt || 0) > (local.updatedAt || 0) ? remote : local; // lww
}

const cloudEnabled = () => user && (user.mode === "firebase" || user.mode === "offline-cached");
const canSync = () => cloudEnabled() && navigator.onLine && getFb() && getFb().auth.currentUser?.uid === user.uid;
const pullKey = () => `devpath:lastPull:${user.uid}`;
const clean = (o) => JSON.parse(JSON.stringify(o));
const withTimeout = (p, ms = 15000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("Network timeout")), ms))]);

function ref(col, id) {
  const { fsM, db: fdb } = getFb();
  return col === "profile" ? fsM.doc(fdb, "users", user.uid) : fsM.doc(fdb, "users", user.uid, col, id);
}

export async function startSync(u) {
  user = u;
  await refreshPending();
  if (!cloudEnabled()) { set({ state: "local" }); return; }
  if (u.mode === "offline-cached") loadFirebase();
  set({ state: navigator.onLine ? "pending" : "offline" });
  syncNow();
}

export function stopSync() { user = null; set({ state: "idle", pending: 0 }); }

async function refreshPending() { set({ pending: (await db.outboxList()).length }); }

export function schedule(ms = 1200) {
  clearTimeout(timer);
  timer = setTimeout(syncNow, ms);
}

export async function syncNow() {
  if (!user) return;
  if (!cloudEnabled()) { await refreshPending(); set({ state: "local" }); return; }
  if (!navigator.onLine) { await refreshPending(); set({ state: "offline" }); return; }
  if (running) { rerun = true; return; }
  if (!getFb()) await loadFirebase();
  if (!canSync()) { await refreshPending(); set({ state: status.pending ? "pending" : "idle" }); return; }
  running = true;
  set({ state: "syncing", error: "" });
  try {
    await pull();
    await flush();
    set({ state: "synced", lastSync: Date.now() });
  } catch (e) {
    console.warn("Sync failed", e);
    set({ state: navigator.onLine ? "error" : "offline", error: e.message || String(e) });
  } finally {
    running = false;
    await refreshPending();
    if (rerun) { rerun = false; schedule(300); }
  }
}

async function pull() {
  const { fsM, db: fdb } = getFb();
  const since = Number(localStorage.getItem(pullKey()) || 0);
  const startedAt = Date.now();
  // profile lives at users/{uid}
  const p = await withTimeout(fsM.getDoc(ref("profile", "main")));
  if (p.exists()) await mergeIn("profile", "main", p.data());
  for (const col of Object.keys(db.COLLECTIONS)) {
    if (col === "profile") continue;
    const base = fsM.collection(fdb, "users", user.uid, col);
    // 10-minute overlap tolerates clock skew between devices
    const q = since ? fsM.query(base, fsM.where("updatedAt", ">", since - 600000)) : base;
    const snap = await withTimeout(fsM.getDocs(q), 30000);
    for (const d of snap.docs) await mergeIn(col, d.id, d.data());
  }
  localStorage.setItem(pullKey(), String(startedAt));
}

async function mergeIn(col, id, remote) {
  const local = db.get(col, id);
  const merged = merge(db.COLLECTIONS[col], local, remote);
  if (merged === local) return;               // local wins (already queued if changed)
  await db.applyRemote(col, id, merged);
  if (merged !== remote) await db.queue(col, id); // a true merge must go back up
}

async function flush() {
  const { fsM } = getFb();
  const items = await db.outboxList();
  for (const it of items) {
    const local = db.get(it.col, it.id);
    if (!local) { await db.outboxRemove(it.key, it.ts); continue; }
    const strategy = db.COLLECTIONS[it.col];
    const r = ref(it.col, it.id);
    const snap = await withTimeout(fsM.getDoc(r));
    const remote = snap.exists() ? snap.data() : null;
    if (strategy === "append" && remote) { await db.outboxRemove(it.key, it.ts); continue; } // immutable, already up
    const merged = merge(strategy, local, remote);
    if (merged === remote) {                       // cloud copy is newer: keep it locally
      await db.applyRemote(it.col, it.id, remote);
      await db.outboxRemove(it.key, it.ts);
      continue;
    }
    if (merged !== local) await db.applyRemote(it.col, it.id, merged);
    await withTimeout(fsM.setDoc(r, clean(merged)));
    await db.outboxRemove(it.key, it.ts);
  }
}

window.addEventListener("online", () => schedule(500));
window.addEventListener("offline", () => set({ state: cloudEnabled() ? "offline" : status.state }));
db.onOutbox(() => { refreshPending(); schedule(); });
setInterval(() => { if (status.pending && navigator.onLine) syncNow(); }, 60000);
