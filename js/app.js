// ---------------------------------------------------------------------------
// App bootstrap: theme → service worker → content → auth → user store → sync
// → router. Views are lazy-loaded ES modules in js/views/.
// ---------------------------------------------------------------------------
import { APP } from "./config.js";
import { loadContent } from "./content.js";
import { initAuth, onUser, currentUser } from "./auth.js";
import * as db from "./db.js";
import { startSync, stopSync, onSync, syncNow } from "./sync.js";
import { route, fallback, onRoute, resolve, navigate, parse } from "./router.js";
import { stats, levelFor, dayKey } from "./progress.js";
import { checkAchievements } from "./achievements.js";
import { esc, icon, toast, xpBurst, fmtRel, skeleton } from "./components/ui.js";
import { wire as bmWire } from "./bookmarks.js";

// ---------- Theme ----------
export function applyTheme(t) {
  const theme = t || localStorage.getItem("devpath:theme") || "dark";
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("devpath:theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#F4F6FC" : "#0D1222");
}
applyTheme();

// ---------- Routes ----------
const V = (name) => () => import(`./views/${name}.js`);
route("/", V("landing"), { public: true, bare: true });
route("/login", V("auth"), { public: true, bare: true });
route("/register", V("auth"), { public: true, bare: true });
route("/dashboard", V("dashboard"), { nav: "dashboard", title: "Today" });
route("/path", V("path"), { nav: "path", title: "Learning path" });
route("/module/:id", V("module"), { nav: "path", title: "Module" });
route("/lesson/:id", V("lesson"), { nav: "path", title: "Lesson", study: true });
route("/practice", V("practice"), { nav: "practice", title: "MCQ practice", study: true });
route("/exams", V("exams"), { nav: "exams", title: "Exam center" });
route("/exam/:id", V("exam"), { nav: "exams", title: "Exam", study: true, focus: true });
route("/exam-result/:id", V("examResult"), { nav: "exams", title: "Exam result" });
route("/logic", V("logic"), { nav: "logic", title: "Logic Lab", study: true });
route("/coding", V("coding"), { nav: "coding", title: "Coding Lab" });
route("/coding/:id", V("challenge"), { nav: "coding", title: "Challenge", study: true });
route("/review", V("review"), { nav: "review", title: "Review center", study: true });
route("/analytics", V("analytics"), { nav: "analytics", title: "Analytics" });
route("/achievements", V("achievements"), { nav: "achievements", title: "Achievements" });
route("/saved", V("saved"), { nav: "saved", title: "Saved" });
route("/search", V("search"), { nav: "", title: "Search" });
route("/profile", V("profile"), { nav: "profile", title: "Profile" });
route("/settings", V("settings"), { nav: "settings", title: "Settings" });
route("/sync", V("syncView"), { nav: "sync", title: "Offline & sync" });
fallback(V("notFound"));

const NAV = [
  ["dashboard", "Today", "today"], ["path", "Learning path", "path"], ["practice", "MCQ practice", "quiz"],
  ["exams", "Exams", "exam"], ["logic", "Logic Lab", "logic"], ["coding", "Coding Lab", "code"],
  ["review", "Review", "review"], ["saved", "Saved", "bookmark"], ["analytics", "Analytics", "chart"],
  ["achievements", "Achievements", "award"]
];
const NAV2 = [["profile", "Profile", "user"], ["settings", "Settings", "gear"], ["sync", "Offline & sync", "sync"]];
const BOTTOM = ["dashboard", "path", "practice", "review"];

// ---------- Shell ----------
const $ = (s) => document.querySelector(s);
function renderShell() {
  const link = ([id, label, ic]) => `<a href="#/${id}" data-nav="${id}">${icon(ic)}<span>${label}</span></a>`;
  $("#sidebar").innerHTML = `
    <a class="brand" href="#/dashboard" aria-label="${APP.name} home"><span class="brand-mark" aria-hidden="true"></span><span>${APP.name}</span></a>
    <div class="side-track"><span>Track A</span><strong>AI / Backend Engineer</strong></div>
    <nav aria-label="Main">${NAV.map(link).join("")}</nav>
    <nav aria-label="Account" class="nav2">${NAV2.map(link).join("")}</nav>
    <div class="side-level" id="sideLevel"></div>`;
  const all = Object.fromEntries([...NAV, ...NAV2].map((n) => [n[0], n]));
  const SHORT = { path: "Path", practice: "Practice" };
  $("#bottomnav").innerHTML = BOTTOM.map((id) => link([id, SHORT[id] || all[id][1], all[id][2]])).join("") +
    `<button type="button" id="moreBtn" aria-haspopup="dialog" aria-expanded="false">${icon("more")}<span>More</span></button>`;
  $("#sheet").innerHTML = `<div class="sheet-panel" role="dialog" aria-label="More pages"><div class="sheet-handle"></div>
    <div class="sheet-grid">${[...NAV, ...NAV2].filter((n) => !BOTTOM.includes(n[0])).map(link).join("")}</div></div>`;
  $("#moreBtn").onclick = () => toggleSheet(true);
  $("#sheet").onclick = (e) => { if (e.target.id === "sheet" || e.target.closest("a")) toggleSheet(false); };
  $("#searchForm").onsubmit = (e) => { e.preventDefault(); const q = $("#searchInput").value.trim(); if (q) navigate(`/search?q=${encodeURIComponent(q)}`); };
  $("#themeBtn").onclick = () => setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
  paintThemeBtn();
}
export function setTheme(t) { applyTheme(t); paintThemeBtn(); }
function paintThemeBtn() {
  const light = document.documentElement.dataset.theme === "light";
  $("#themeBtn").innerHTML = icon(light ? "moon" : "sun");
  $("#themeBtn").setAttribute("aria-label", light ? "Switch to dark mode" : "Switch to light mode");
}
function toggleSheet(open) {
  if (!open && !$("#sheet").classList.contains("open")) return;
  $("#sheet").classList.toggle("open", open);
  $("#moreBtn")?.setAttribute("aria-expanded", String(open));
  if (open) $("#sheet a")?.focus();
}
function paintLevel() {
  if (!currentUser()) return;
  const s = stats();
  const L = levelFor(s.xp);
  $("#sideLevel").innerHTML = `<div class="lvl-row"><span>Level ${L.level}</span><span>${s.xp} XP</span></div>
    <div class="lvl-bar"><i style="width:${Math.round(L.pct * 100)}%"></i></div>
    <div class="lvl-row muted"><span>${icon("fire", "sm")} ${s.streak} day streak</span><span>${esc(displayName())}</span></div>`;
}

export const displayName = () => db.get("profile", "main")?.displayName || currentUser()?.name || "Learner";
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); window.__installPrompt = e; });

// ---------- Sync pill ----------
const SYNC_TEXT = { local: "Local only", offline: "Offline", syncing: "Syncing…", synced: "Synced", pending: "Pending", error: "Sync error", idle: "Online" };
onSync((s) => {
  const pill = $("#syncPill");
  if (!pill) return;
  const online = navigator.onLine;
  let state = s.state;
  if (state === "synced" && s.pending) state = "pending";
  pill.dataset.state = online ? state : "offline";
  pill.innerHTML = `<i aria-hidden="true"></i><span>${SYNC_TEXT[online ? state : "offline"]}${s.pending && state !== "syncing" ? ` · ${s.pending}` : ""}</span>`;
  pill.title = s.lastSync ? `Last synced ${fmtRel(s.lastSync)}` : "Not synced yet";
});
window.addEventListener("online", () => toast("Back online. Syncing your progress.", { type: "ok" }));
window.addEventListener("offline", () => toast("You're offline. Keep studying — progress is saved on this device.", { ms: 4500 }));

// ---------- Rendering ----------
let cleanup = null;
let renderSeq = 0;
let currentRoute = null;

onRoute(async ({ route: r, params, query, path }) => {
  const user = currentUser();
  if (!r.public && !user) return navigate(`/login?next=${encodeURIComponent(path)}`, { replace: true });
  if (r.public && user && path !== "/register" && path !== "/login") return navigate("/dashboard", { replace: true });
  if (r.public && user) return navigate(query.next || "/dashboard", { replace: true });
  currentRoute = { ...r, path };
  toggleSheet(false);
  if (path !== "/search" && $("#searchInput")) $("#searchInput").value = "";
  const seq = ++renderSeq;
  document.body.classList.toggle("bare", Boolean(r.bare));
  document.body.classList.toggle("focus-mode", Boolean(r.focus));
  document.querySelectorAll("[data-nav]").forEach((a) => a.toggleAttribute("aria-current", a.dataset.nav === r.nav));
  if (a11yTitle(r)) document.title = `${a11yTitle(r)} · ${APP.name}`;
  if (typeof cleanup === "function") { try { cleanup(); } catch {} }
  cleanup = null;
  const main = $("#main");
  main.classList.remove("page-in");
  main.innerHTML = skeleton(4);
  try {
    const mod = await r.view();
    if (seq !== renderSeq) return;
    main.innerHTML = "";
    cleanup = await mod.default({ el: main, params, query, user, navigate });
    if (seq !== renderSeq) return;
    void main.offsetWidth;
    main.classList.add("page-in");
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="empty"><h3>This page didn't load</h3><p>${esc(e.message)}</p><p class="muted">If you're offline, open the app once online so it can cache everything.</p></div>`;
  }
});
const a11yTitle = (r) => r.title || (r.bare ? "" : APP.name);

// ---------- Study-time tracker ----------
let lastInput = Date.now();
["pointerdown", "keydown", "scroll", "touchstart"].forEach((ev) => addEventListener(ev, () => (lastInput = Date.now()), { passive: true }));
let session = null;
let unsaved = 0;
function newSession() { session = { id: db.uuid(), startedAt: Date.now(), sec: 0 }; }
async function flushSession() {
  if (!session || !unsaved || !currentUser()) return;
  unsaved = 0;
  await db.put("sessions", session.id, { startedAt: session.startedAt, date: dayKey(session.startedAt), sec: session.sec });
}
setInterval(() => {
  if (!currentUser() || !currentRoute?.study || document.visibilityState !== "visible") return;
  if (Date.now() - lastInput > 5 * 60000) return; // idle
  if (!session || dayKey(session.startedAt) !== dayKey()) { flushSession(); newSession(); }
  session.sec += 5; unsaved += 5;
  if (unsaved >= 120) flushSession();
}, 5000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSession(); });
addEventListener("hashchange", () => flushSession());

// ---------- XP + achievements reactions ----------
let lastXp = null;
let reactTimer = null;
db.onChange(() => {
  clearTimeout(reactTimer);
  reactTimer = setTimeout(async () => {
    if (!currentUser()) return;
    const s = stats();
    if (lastXp !== null && s.xp > lastXp) xpBurst(s.xp - lastXp);
    lastXp = s.xp;
    paintLevel();
    await checkAchievements(false);
  }, 120);
});

// ---------- User lifecycle ----------
async function enterUser(user) {
  if (!user) {
    stopSync(); lastXp = null; session = null;
    document.body.classList.remove("signed-in");
    return;
  }
  db.setQueueing(user.mode !== "local");
  await db.openUser(user.uid);
  if (!db.get("profile", "main")) await db.put("profile", "main", { name: user.name, createdAt: Date.now(), goals: {}, theme: localStorage.getItem("devpath:theme") || "dark" });
  document.body.classList.add("signed-in");
  lastXp = stats().xp;
  await checkAchievements(true);
  paintLevel();
  startSync(user);
}

// ---------- Boot ----------
async function boot() {
  renderShell();
  bmWire($("#main"));
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) toast("An update is ready. Reload to use it.", { ms: 8000 });
        });
      });
    }).catch((e) => console.warn("SW registration failed", e));
  }
  try { await loadContent(APP.defaultTrack); }
  catch (e) {
    $("#main").innerHTML = `<div class="empty"><h3>Course content didn't load</h3><p>${esc(e.message)}</p><p>Serve the folder over HTTP (see README) — opening index.html directly from disk blocks fetch().</p></div>`;
    document.body.classList.add("bare");
    return;
  }
  await initAuth();
  await enterUser(currentUser());
  onUser(async (u) => {
    await enterUser(u);
    const { path, query } = parse();
    if (u && (path === "/login" || path === "/register" || path === "/")) navigate(query.next || "/dashboard", { replace: true });
    else if (!u) navigate("/", { replace: true });
    else resolve();
  });
  document.getElementById("boot")?.remove();
  resolve();
}
boot();

// Expose a tiny debug handle for the console.
window.devpath = { stats, syncNow, db };
