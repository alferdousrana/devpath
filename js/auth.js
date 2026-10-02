// Authentication: Firebase (Google + email/password) with two fallbacks:
//  - "local" mode when Firebase is not configured yet (single device, no sync)
//  - "offline-cached" when the SDK can't load offline: we reuse the last
//    signed-in identity so you keep studying; sync resumes once online.
import { loadFirebase } from "./firebase.js";
import { isFirebaseConfigured } from "./config.js";

const LAST_KEY = "devpath:lastUser";
let current = null;
const listeners = new Set();

export const currentUser = () => current;
export function onUser(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function emit(u) {
  const changed = (current?.uid || null) !== (u?.uid || null) || current?.mode !== u?.mode;
  current = u;
  if (u) localStorage.setItem(LAST_KEY, JSON.stringify(u));
  if (changed) listeners.forEach((f) => f(u));
}

const norm = (u) => u && {
  uid: u.uid,
  name: u.displayName || (u.email || "").split("@")[0] || "Learner",
  email: u.email || "",
  photo: u.photoURL || "",
  mode: "firebase"
};

export async function initAuth() {
  const cached = safeParse(localStorage.getItem(LAST_KEY));
  if (!isFirebaseConfigured()) { emit(cached?.mode === "local" ? cached : null); return; }
  const fb = await loadFirebase();
  if (!fb) { emit(cached && cached.mode !== "local" ? { ...cached, mode: "offline-cached" } : null); return; }
  fb.authM.getRedirectResult(fb.auth).catch(() => {});
  await new Promise((resolve) => {
    let first = true;
    fb.authM.onAuthStateChanged(fb.auth, (u) => {
      if (!u) localStorage.removeItem(LAST_KEY);
      emit(norm(u));
      if (first) { first = false; resolve(); }
    });
  });
}

async function need() {
  const fb = await loadFirebase();
  if (!fb) throw Object.assign(new Error("Firebase isn't available. Check your connection or js/config.js."), { code: "app/no-firebase" });
  return fb;
}

export async function signInGoogle() {
  const fb = await need();
  const provider = new fb.authM.GoogleAuthProvider();
  try {
    await fb.authM.signInWithPopup(fb.auth, provider);
  } catch (e) {
    const useRedirect = ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"];
    if (useRedirect.includes(e.code)) return fb.authM.signInWithRedirect(fb.auth, provider);
    throw e;
  }
}

export async function signInEmail(email, password) {
  const fb = await need();
  await fb.authM.signInWithEmailAndPassword(fb.auth, email.trim(), password);
}

export async function registerEmail(name, email, password) {
  const fb = await need();
  const cred = await fb.authM.createUserWithEmailAndPassword(fb.auth, email.trim(), password);
  if (name) await fb.authM.updateProfile(cred.user, { displayName: name.trim().slice(0, 60) });
  current = null; // force re-emit with display name
  emit(norm(fb.auth.currentUser));
}

export async function resetPassword(email) {
  const fb = await need();
  await fb.authM.sendPasswordResetEmail(fb.auth, email.trim());
}

export function startLocal(name) {
  emit({ uid: "local", name: (name || "Learner").trim().slice(0, 60) || "Learner", email: "", photo: "", mode: "local" });
}

export async function signOut() {
  if (current && current.mode !== "local") {
    const fb = await loadFirebase();
    if (fb) await fb.authM.signOut(fb.auth);
  }
  localStorage.removeItem(LAST_KEY);
  emit(null);
}

export function authErrorMessage(e) {
  const map = {
    "auth/invalid-email": "That email address isn't valid.",
    "auth/user-not-found": "No account uses that email. Create one instead.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/email-already-in-use": "An account already uses that email. Sign in instead.",
    "auth/weak-password": "Use a password with at least 8 characters.",
    "auth/network-request-failed": "No connection. The first sign-in needs internet.",
    "auth/popup-closed-by-user": "The Google window closed before sign-in finished.",
    "auth/unauthorized-domain": "This domain isn't authorized in Firebase Authentication. See README → Firebase Auth setup.",
    "auth/too-many-requests": "Too many attempts. Wait a minute, then try again.",
    "app/no-firebase": e.message
  };
  return map[e.code] || e.message || "Sign-in failed.";
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
