// ---------------------------------------------------------------------------
// Local-first data store.
//
// Every write lands here first (IndexedDB), is mirrored in memory for fast
// synchronous reads, and is added to an *outbox*. sync.js drains the outbox to
// Firestore whenever the user is online. Nothing waits on the network, so
// progress recorded offline can't be lost by a dropped connection.
//
// Each collection declares a merge strategy used when local and cloud differ:
//   append  – immutable records with unique ids (attempts). Never conflict.
//   lesson  – completion is monotonic: completed on any device = completed.
//   lww     – last-write-wins by updatedAt (notes, bookmarks, settings…).
// ---------------------------------------------------------------------------
export const COLLECTIONS = {
  profile: "lww",
  lessons: "lesson",
  quizAttempts: "append",
  examAttempts: "append",
  logicAttempts: "append",
  achievements: "append",
  wrongAnswers: "lww",
  notes: "lww",
  bookmarks: "lww",
  coding: "lww",
  sessions: "lww"
};

const DB_NAME = "devpath";
const DB_VERSION = 1;
let idb = null;
let idbFailed = false;
let uid = null;
let queueing = true;   // false in local-only mode: nothing will ever sync, so don't grow an outbox
export const setQueueing = (on) => { queueing = on; };
const mem = new Map();            // col -> Map(id -> data)
const memOutbox = new Map();      // fallback when IndexedDB is unavailable
const changeListeners = new Set();
const outboxListeners = new Set();

export const now = () => Date.now();
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
const key = (col, id) => `${uid}|${col}|${id}`;

function openIdb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains("docs")) d.createObjectStore("docs", { keyPath: "key" });
      if (!d.objectStoreNames.contains("outbox")) d.createObjectStore("outbox", { keyPath: "key" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const txDone = (t) => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
const userRange = () => IDBKeyRange.bound(`${uid}|`, `${uid}|\uffff`);

export async function openUser(userId) {
  uid = userId;
  mem.clear();
  for (const col of Object.keys(COLLECTIONS)) mem.set(col, new Map());
  if (!idb && !idbFailed) {
    try { idb = await openIdb(); } catch (e) { idbFailed = true; console.warn("IndexedDB unavailable; data will only live in memory", e); }
  }
  if (idb) {
    const rows = await reqP(idb.transaction("docs").objectStore("docs").getAll(userRange()));
    for (const row of rows) mem.get(row.col)?.set(row.id, row.data);
  }
  emitChange("*");
}

export const isPersistent = () => Boolean(idb);
export const list = (col) => [...(mem.get(col)?.values() || [])];
export const get = (col, id) => mem.get(col)?.get(id) || null;

// Write locally + queue for sync.
export async function put(col, id, data) {
  if (!uid) throw new Error("No user store open");
  const doc = { ...data, id, updatedAt: now() };
  mem.get(col).set(id, doc);
  const entry = { key: key(col, id), uid, col, id, ts: doc.updatedAt };
  if (idb) {
    const t = idb.transaction(queueing ? ["docs", "outbox"] : ["docs"], "readwrite");
    t.objectStore("docs").put({ key: entry.key, uid, col, id, data: doc });
    if (queueing) t.objectStore("outbox").put(entry);
    await txDone(t);
  } else if (queueing) memOutbox.set(entry.key, entry);
  emitChange(col);
  outboxListeners.forEach((f) => f());
  return doc;
}

// Write a value that came from the cloud (no outbox entry).
export async function applyRemote(col, id, data) {
  mem.get(col).set(id, data);
  if (idb) {
    const t = idb.transaction("docs", "readwrite");
    t.objectStore("docs").put({ key: key(col, id), uid, col, id, data });
    await txDone(t);
  }
  emitChange(col);
}

export async function outboxList() {
  if (!uid) return [];
  if (!idb) return [...memOutbox.values()].filter((e) => e.uid === uid);
  return reqP(idb.transaction("outbox").objectStore("outbox").getAll(userRange()));
}

// Remove only if no newer local write happened while syncing.
export async function outboxRemove(entryKey, ts) {
  if (!idb) { if (memOutbox.get(entryKey)?.ts === ts) memOutbox.delete(entryKey); return; }
  const t = idb.transaction("outbox", "readwrite");
  const s = t.objectStore("outbox");
  const rec = await reqP(s.get(entryKey));
  if (rec && rec.ts === ts) s.delete(entryKey);
  await txDone(t);
}

export async function queue(col, id) {
  const doc = get(col, id);
  if (!doc) return;
  const entry = { key: key(col, id), uid, col, id, ts: doc.updatedAt || now() };
  if (idb) { const t = idb.transaction("outbox", "readwrite"); t.objectStore("outbox").put(entry); await txDone(t); }
  else memOutbox.set(entry.key, entry);
}

export async function wipeUser() {
  if (idb) {
    const t = idb.transaction(["docs", "outbox"], "readwrite");
    t.objectStore("docs").delete(userRange());
    t.objectStore("outbox").delete(userRange());
    await txDone(t);
  }
  for (const m of mem.values()) m.clear();
  memOutbox.clear();
  emitChange("*");
}

export function exportAll() {
  const out = {};
  for (const [col, m] of mem) out[col] = [...m.values()];
  return { app: "devpath", version: 1, exportedAt: new Date().toISOString(), data: out };
}

// Import merges with the same strategies sync uses, then queues everything.
export async function importAll(payload, mergeFn) {
  if (payload?.app !== "devpath" || !payload.data) throw new Error("This file isn't a DevPath export.");
  let n = 0;
  for (const [col, docs] of Object.entries(payload.data)) {
    if (!COLLECTIONS[col] || !Array.isArray(docs)) continue;
    for (const d of docs) {
      if (!d || typeof d.id !== "string") continue;
      const merged = mergeFn(COLLECTIONS[col], get(col, d.id), d);
      if (merged !== get(col, d.id)) { await applyRemote(col, d.id, merged); await queue(col, d.id); n++; }
    }
  }
  outboxListeners.forEach((f) => f());
  return n;
}

// Synchronous write hooks (used to invalidate derived caches before any read).
const writeHooks = new Set();
export function onWriteSync(fn) { writeHooks.add(fn); return () => writeHooks.delete(fn); }

let pendingEmit = new Set();
let emitTimer = null;
function emitChange(col) {
  writeHooks.forEach((f) => f(col));
  pendingEmit.add(col);
  clearTimeout(emitTimer);
  emitTimer = setTimeout(() => {
    const cols = pendingEmit; pendingEmit = new Set();
    changeListeners.forEach((f) => f(cols));
  }, 30);
}
export function onChange(fn) { changeListeners.add(fn); return () => changeListeners.delete(fn); }
export function onOutbox(fn) { outboxListeners.add(fn); return () => outboxListeners.delete(fn); }
