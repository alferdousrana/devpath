// Lazy-loads the Firebase modular SDK from the official CDN.
// The service worker caches these files, so the app still boots offline.
import { firebaseConfig, isFirebaseConfigured, APP } from "./config.js";

const base = `https://www.gstatic.com/firebasejs/${APP.firebaseSdk}`;
let fb = null;
let loading = null;

export const getFb = () => fb;

export function loadFirebase() {
  if (fb) return Promise.resolve(fb);
  if (!isFirebaseConfigured()) return Promise.resolve(null);
  if (loading) return loading;
  loading = (async () => {
    try {
      const [appM, authM, fsM] = await Promise.all([
        import(`${base}/firebase-app.js`),
        import(`${base}/firebase-auth.js`),
        import(`${base}/firebase-firestore.js`)
      ]);
      const app = appM.initializeApp(firebaseConfig);
      const auth = authM.getAuth(app);
      let db;
      try {
        // Firestore's own offline cache (IndexedDB), shared across tabs.
        db = fsM.initializeFirestore(app, {
          localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() })
        });
      } catch (e) {
        console.warn("Firestore persistent cache unavailable; using default cache", e);
        db = fsM.getFirestore(app);
      }
      fb = { app, auth, db, authM, fsM };
      return fb;
    } catch (e) {
      console.warn("Firebase SDK could not load (offline before first cache?)", e);
      loading = null;
      return null;
    }
  })();
  return loading;
}
