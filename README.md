# DevPath: Track A, AI / Backend Engineer

A personal, offline-first learning system: structured lessons, MCQ practice, timed exams, a Logic Lab, a Coding Lab, spaced review of mistakes, streaks, XP, analytics, notes and bookmarks. It's built with vanilla HTML/CSS/JavaScript and uses Firebase for accounts and sync. It runs on GitHub Pages and installs as a PWA.

**What's included**

| | |
|---|---|
| Modules | 12, in order: Linux, Git, Python, Django/DRF, REST, PostgreSQL, Docker, HTTP, DNS, SSH, Environment Variables, Networking |
| Lessons | 54. Each has a simple explanation, a technical explanation, an analogy, an example, key terms, what to remember, common mistakes, interview questions and practice prompts |
| MCQs | 140, tagged by module, topic, lesson and difficulty |
| Logic Lab | 24 problems. Every Python output-prediction answer was verified by executing the code |
| Coding Lab | 12 challenges (Python, algorithms, backend, SQL). Every Python reference solution passes its listed tests |
| Exams | 12 module exams plus 2 full Track A exams |
| Badges | 25 |

---

## 1. Run it locally (2 minutes)

The app uses `fetch()` and ES modules, so it must be served over HTTP. Opening `index.html` from disk won't work.

```bash
cd devpath
python3 -m http.server 8000
# open http://localhost:8000
```

With an empty `js/config.js`, the app runs in **local mode**. Everything is saved in this browser's IndexedDB and there's no cloud sync. It's the quickest way to try it before setting up Firebase.

> Local-mode progress belongs to a local profile. To carry it into your Firebase account later, go to **Settings → Export backup**, then sign in and use **Import backup**. Imports merge safely.

---

## 2. Firebase setup

### 2.1 Create the project
1. Go to <https://console.firebase.google.com>, choose **Add project**, and turn Analytics on or off as you like.
2. Open **Project settings → General → Your apps**, then click the **Web** icon (`</>`). Register the app; hosting isn't needed.
3. Copy the `firebaseConfig` values into `js/config.js`:

```js
export const firebaseConfig = {
  apiKey: "AIza…",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};
```

These values are **not secrets**. They identify your project, and every Firebase web app ships them to the browser. Your data is protected by the **Security Rules** in step 2.4, not by hiding this config. Real secrets, such as service-account keys or admin credentials, must never go in this repo.

### 2.2 Authentication
1. Go to **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Email/Password** and **Google**. Google asks you to pick a support email.
3. Under **Settings → Authorized domains**, add your GitHub Pages domain, for example `yourname.github.io`, and any custom domain. `localhost` is there by default.
   - If you skip this, Google sign-in fails with `auth/unauthorized-domain`.

### 2.3 Firestore
1. Go to **Build → Firestore Database → Create database**.
2. Choose **Production mode** and a region near you, for example `asia-south1` for Bangladesh/India.
3. You don't need to create collections; the app creates them on first sync.

### 2.4 Security Rules
Publish `firestore.rules` in one of two ways.

**Console:** go to Firestore → **Rules**, paste the contents of `firestore.rules`, and click **Publish**.

**CLI:**
```bash
npm install -g firebase-tools
firebase login
firebase use --add            # pick your project
firebase deploy --only firestore:rules
```

What the rules guarantee:
- A user can read and write **only** their own `users/{uid}/…` tree. Nobody can read anyone else's progress.
- Quiz, exam and logic attempts and achievements are **append-only**. Once written, they can't be edited or deleted, so history can't be rewritten.
- Lesson completion can't be undone.
- Exam attempts are shape-checked: answer count, time spent within the limit, pass mark between 0 and 100.
- Notes are capped at 20,000 characters and code drafts at 50,000.
- The optional `/content` tree is world-readable and client-read-only.
- Everything else is denied.

Firebase Storage isn't used. The app doesn't need file uploads.

---

## 3. Deploy to GitHub Pages

```bash
cd devpath
git init && git add . && git commit -m "DevPath v1"
git branch -M main
git remote add origin git@github.com:YOURNAME/devpath.git
git push -u origin main
```

1. In the repo, go to **Settings → Pages**.
2. Set **Source** to *Deploy from a branch*, then choose **main** and **/ (root)**, and save.
3. Wait about a minute. The app is at `https://YOURNAME.github.io/devpath/`.
4. Add `YOURNAME.github.io` to Firebase **Authorized domains** (step 2.2).

Every path in the app is relative and routing uses the URL hash (`#/dashboard`). It works from a repo subpath, and there are no 404s on refresh.

**Updating:** bump `VERSION` in `sw.js` on every deploy so installed apps pick up the new files. Users see an "update ready" toast. If you added or removed files, regenerate the precache list first:

```bash
python3 tools/build_sw.py
```

---

## 4. Install as an app (PWA)

- **Android (Chrome):** menu, then **Install app**, or use the install banner.
- **iPhone/iPad (Safari):** Share, then **Add to Home Screen**.
- **Desktop (Chrome/Edge):** click the install icon at the right end of the address bar. The *Offline & sync* page also has an Install button when the browser offers one.

---

## 5. Test offline mode

1. Open the deployed app once while online and sign in. The service worker caches the whole app, all course content and the Firebase SDK.
2. In Chrome DevTools, open **Network** and set throttling to **Offline**, or switch on airplane mode.
3. Reload. The app opens and the top-right pill shows **Offline**.
4. Complete a lesson, answer some MCQs, write a note. The pill shows a pending count.
5. Go back online. The pill shows **Syncing…**, then **Synced**.
6. Open the app on a second device with the same account. Your progress is there.

The *Offline & sync* page lists pending changes by type, shows the last sync time, and has a **Sync now** button.

---

## 6. Architecture

```
index.html            app shell (sidebar, top bar, bottom nav)
manifest.json         PWA manifest
sw.js                 service worker (precache + runtime caching)
firestore.rules       security rules        firebase.json / firestore.indexes.json  CLI config
css/                  style.css (tokens + components), responsive.css, animations.css
js/
  app.js              bootstrap, routes, auth guards, shell, study-time tracker
  router.js           hash router
  config.js           Firebase config + XP, goals, thresholds
  firebase.js         lazy loader for the Firebase modular SDK (CDN)
  auth.js             Google, email/password, local mode, offline-cached session
  db.js               local-first IndexedDB store + outbox
  sync.js             Firestore sync engine + merge strategies
  content.js          loads /data JSON, lookups
  progress.js         derived stats: XP, levels, streaks, topics, weak areas
  quiz.js             quiz sessions, attempt saving, spaced review (Leitner)
  exam.js             exam building, checkpointing, submission
  achievements.js     badge rule evaluation
  bookmarks.js        bookmarks with tombstones
  coding/runner.js    code-execution interface (placeholder; see §8)
  components/         ui.js (helpers, markdown-lite, icons, modals), charts.js (SVG), quizRunner.js
  views/              one module per page, lazy-loaded
data/
  tracks.json         tracks (A active; B–E planned)
  modules/<id>.json   module + its lessons
  questions/<id>.json MCQs for a module
  logic.json  coding.json  exams.json  achievements.json
tools/build_sw.py     regenerates the precache list in sw.js
```

### Offline-first data flow

```
UI action → db.put()  ──► memory (instant reads) + IndexedDB + outbox
                                     │
            online & signed in ──────┘
                                     ▼
            sync.js: pull changes since last sync → merge → push outbox → "Synced"
```

Nothing waits on the network. A write is only removed from the outbox after Firestore confirms it, and only if no newer local write happened in the meantime. Firestore's own persistent cache is also enabled.

### Conflict resolution

| Data | Strategy | Why |
|---|---|---|
| Quiz, exam and logic attempts, achievements | **Append-only**, unique IDs | Two devices can't conflict; both attempts are kept |
| Lesson completion | **Union** (completed anywhere = completed); earliest completion time kept | Progress can never be lost by sync |
| Notes, bookmarks, settings, code drafts, review schedule | **Last write wins** by `updatedAt`; deletes are tombstones | Simple and predictable for single-user edits |
| XP, streaks, accuracy, weak topics, levels | **Derived**, never stored | Recomputed from the records above, so they can't drift or double count |

### Score integrity

There's no server of your own, so client code can't be made tamper-proof. The design does what it can:
- Exam attempts store only **which question** and **which option** you chose. Scores are **re-graded against the answer key every time they're read**, so a stored score is never trusted.
- Security rules shape-check exam attempts and make them immutable.
- For true server-side grading, add a Cloud Function (Blaze plan) that keeps the answer key server-side and writes the graded result. The data model is ready for it.

---

## 7. Adding content (no code changes)

**New lesson:** append to the module's `lessons` array in `data/modules/<id>.json`:

```json
{
  "id": "postgres-window-functions",
  "title": "Window functions",
  "minutes": 15,
  "summary": "One line shown in lists and search.",
  "simple": "Plain-language explanation.",
  "technical": "Markdown-lite: paragraphs, - lists, `code`, **bold**, ```sql fences```.",
  "analogy": "…",
  "example": { "lang": "sql", "code": "SELECT …", "explain": "…" },
  "terms": [["OVER()", "Defines the window"]],
  "remember": ["…"], "mistakes": ["…"], "interview": ["…"], "practice": ["…"]
}
```

**New MCQ:** append to `data/questions/<module>.json`. `correctAnswer` is the 0-based option index, and `lesson` links the question to a lesson for "Review lesson" buttons and weak-topic mapping:

```json
{ "id": "postgres-q15", "module": "postgres", "topic": "Window functions", "lesson": "postgres-window-functions",
  "difficulty": "medium", "question": "…", "options": ["…", "…", "…", "…"], "correctAnswer": 2, "explanation": "…",
  "code": "optional snippet", "codeLang": "sql" }
```

**New module:** create `data/modules/<id>.json` and `data/questions/<id>.json`, add the id to `tracks.json`, and optionally add an exam to `exams.json` and a badge to `achievements.json`.

**New track (B–E):** set its `status` to `"active"`, list its modules in `tracks.json`, and pass the track id to `loadContent()`.

**Logic problems** (`data/logic.json`) use the MCQ shape plus `title` and `category`. **Coding challenges** (`data/coding.json`) have `statement`, `examples`, `expected`, `hints`, `tests`, `starter`, `solution` and `explanation`.

After adding files, run `python3 tools/build_sw.py` and bump `VERSION` in `sw.js`.

---

## 8. Coding Lab and code execution

GitHub Pages and Firebase can't safely run arbitrary code, so the app **does not fake execution**. Challenges have real test cases, saved drafts, hints shown one at a time, and reference solutions behind a confirmation. You mark a challenge solved yourself.

`js/coding/runner.js` defines the interface a runner must implement (`run({language, code, tests}) → results`). Two realistic options:
- **Pyodide** (Python in WebAssembly) for Python challenges, and **sql.js** for SQL. Both work on static hosting.
- A **sandboxed execution service** (for example self-hosted Judge0, or Cloud Run behind a Cloud Function that verifies the Firebase ID token) for backend-style challenges.

---

## 9. What was tested

- Every JS module passes a syntax check, and every JSON file is validated.
- Headless Chromium end-to-end run:
  - landing → local sign-in → lesson with a note and completion → 5-question practice → module exam (resumed after a page reload, then submitted) → Logic Lab → every page
  - search → XP and achievement unlock
  - service-worker install → **offline reload, lesson and practice while offline**
  - mobile viewport, including the bottom nav and More sheet → light theme
- Sync merge strategies are unit-tested in the browser: 11 cases covering union, last-write-wins, tombstones, append and nulls.
- The live Firebase path (Google and email sign-in, Firestore sync, rules) couldn't be exercised from the build environment. Follow §2 and §5 to verify it with your project. The `window.devpath` handle in the console exposes `stats()`, `syncNow()` and `db` for debugging.

## 10. Known limits and next steps

- Content is substantial but not exhaustive. Each module covers its core topics; extend lessons and question banks as you go (§7).
- No automatic code execution yet (§8).
- Exam integrity is best-effort without a server (§6).
- The service worker caches the Firebase SDK the first time it's used, so open the app online once after each deploy.
