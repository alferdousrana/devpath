// ---------------------------------------------------------------------------
// DevPath service worker.
//  - Precaches the entire app (shell, views, course content) on install, so
//    every page works offline after the first visit.
//  - Course JSON: stale-while-revalidate (instant, refreshes in background).
//  - Firebase SDK + Google Fonts: runtime cached so the app boots offline.
//  - Firestore / Auth network calls are never cached (Firestore has its own
//    offline cache).
// Bump VERSION whenever you deploy; run `python3 tools/build_sw.py` after
// adding files to regenerate the ASSETS list.
// ---------------------------------------------------------------------------
const VERSION = "devpath-v1.0.0";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

/* ASSETS:START */
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/animations.css",
  "./css/responsive.css",
  "./css/style.css",
  "./js/achievements.js",
  "./js/app.js",
  "./js/auth.js",
  "./js/bookmarks.js",
  "./js/coding/runner.js",
  "./js/components/charts.js",
  "./js/components/quizRunner.js",
  "./js/components/ui.js",
  "./js/config.js",
  "./js/content.js",
  "./js/db.js",
  "./js/exam.js",
  "./js/firebase.js",
  "./js/progress.js",
  "./js/quiz.js",
  "./js/router.js",
  "./js/sync.js",
  "./js/views/achievements.js",
  "./js/views/analytics.js",
  "./js/views/auth.js",
  "./js/views/challenge.js",
  "./js/views/coding.js",
  "./js/views/dashboard.js",
  "./js/views/exam.js",
  "./js/views/examResult.js",
  "./js/views/exams.js",
  "./js/views/landing.js",
  "./js/views/lesson.js",
  "./js/views/logic.js",
  "./js/views/module.js",
  "./js/views/notFound.js",
  "./js/views/path.js",
  "./js/views/practice.js",
  "./js/views/profile.js",
  "./js/views/review.js",
  "./js/views/saved.js",
  "./js/views/search.js",
  "./js/views/settings.js",
  "./js/views/syncView.js",
  "./data/achievements.json",
  "./data/coding.json",
  "./data/exams.json",
  "./data/logic.json",
  "./data/modules/django.json",
  "./data/modules/dns.json",
  "./data/modules/docker.json",
  "./data/modules/env.json",
  "./data/modules/git.json",
  "./data/modules/http.json",
  "./data/modules/linux.json",
  "./data/modules/networking.json",
  "./data/modules/postgres.json",
  "./data/modules/python.json",
  "./data/modules/rest.json",
  "./data/modules/ssh.json",
  "./data/questions/django.json",
  "./data/questions/dns.json",
  "./data/questions/docker.json",
  "./data/questions/env.json",
  "./data/questions/git.json",
  "./data/questions/http.json",
  "./data/questions/linux.json",
  "./data/questions/networking.json",
  "./data/questions/postgres.json",
  "./data/questions/python.json",
  "./data/questions/rest.json",
  "./data/questions/ssh.json",
  "./data/tracks.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-512.png"
];
/* ASSETS:END */

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // add individually so one missing file doesn't abort the whole install
    await Promise.all(ASSETS.map((u) => cache.add(new Request(u, { cache: "reload" })).catch((e) => console.warn("[sw] skip", u, e))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (!k.startsWith(VERSION)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isRuntimeCacheable = (url) =>
  url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/") ||
  url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req).then((res) => { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || new Response("Offline", { status: 503 });
}

async function cacheFirst(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(RUNTIME)).put(req, res.clone());
    return res;
  } catch {
    return new Response("Offline and not cached", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate" && url.origin === location.origin) {
    // SPA: every navigation is index.html (routes live in the hash).
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(SHELL)).put(new URL("./index.html", self.registration.scope).href, res.clone());
        return res;
      } catch {
        return (await caches.match(new URL("./index.html", self.registration.scope).href)) || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }
  if (url.origin === location.origin) {
    event.respondWith(url.pathname.includes("/data/") ? staleWhileRevalidate(req, SHELL) : cacheFirst(req));
    return;
  }
  if (isRuntimeCacheable(url)) event.respondWith(staleWhileRevalidate(req, RUNTIME));
  // everything else (Firestore, Auth, Google APIs) goes straight to the network
});
