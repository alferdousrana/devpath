import { signInGoogle, signInEmail, registerEmail, resetPassword, startLocal, authErrorMessage } from "../auth.js";
import { isFirebaseConfigured } from "../config.js";
import { esc, toast } from "../components/ui.js";

const GOOGLE = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

export default function authView({ el, query }) {
  const isRegister = location.hash.startsWith("#/register");
  const configured = isFirebaseConfigured();
  el.innerHTML = `
  <div class="auth-wrap">
    <div class="card auth-card">
      <a class="brand" href="#/"><span class="brand-mark" aria-hidden="true"></span><span>DevPath</span></a>
      <h1>${isRegister ? "Create your account" : "Sign in"}</h1>
      <p class="muted">${isRegister ? "Your progress syncs across your devices." : "Pick up where you left off."}</p>
      ${configured ? `
      <button class="btn-ghost wide" id="google" type="button">${GOOGLE}<span>Continue with Google</span></button>
      <div class="divider">or use email</div>
      <form id="form" novalidate>
        ${isRegister ? `<div class="field"><label for="name">Name</label><input id="name" type="text" autocomplete="name" maxlength="60" required></div>` : ""}
        <div class="field"><label for="email">Email</label><input id="email" type="email" autocomplete="email" maxlength="120" required></div>
        <div class="field"><label for="pw">Password</label><input id="pw" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" minlength="8" maxlength="128" required>
          ${isRegister ? `<small class="muted">At least 8 characters.</small>` : ""}</div>
        <p class="err" id="err" role="alert"></p>
        <button class="btn wide" type="submit" id="submit">${isRegister ? "Create account" : "Sign in"}</button>
      </form>
      <div class="row between" style="margin-top:1rem">
        ${isRegister ? `<a href="#/login${query.next ? `?next=${encodeURIComponent(query.next)}` : ""}">I already have an account</a>` : `<a href="#/register">Create an account</a><button class="btn-ghost sm" id="reset" type="button">Reset password</button>`}
      </div>` : `
      <div class="notice"><strong>Firebase isn't configured yet.</strong> Add your project keys to <code>js/config.js</code> to turn on accounts and cloud sync (see README). Until then you can study in local mode: everything is saved in this browser only.</div>
      <form id="localForm">
        <div class="field"><label for="lname">Your name</label><input id="lname" type="text" maxlength="60" placeholder="Learner"></div>
        <button class="btn wide" type="submit">Start in local mode</button>
      </form>`}
    </div>
  </div>`;

  const err = el.querySelector("#err");
  const busy = (b) => el.querySelectorAll("button").forEach((x) => (x.disabled = b));
  const run = async (fn) => {
    if (!navigator.onLine) { err.textContent = "You're offline. Signing in for the first time needs a connection."; return; }
    err.textContent = ""; busy(true);
    try { await fn(); } catch (e) { err.textContent = authErrorMessage(e); } finally { busy(false); }
  };

  el.querySelector("#localForm")?.addEventListener("submit", (e) => { e.preventDefault(); startLocal(el.querySelector("#lname").value); });
  el.querySelector("#google")?.addEventListener("click", () => run(signInGoogle));
  el.querySelector("#form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = el.querySelector("#email").value.trim();
    const pw = el.querySelector("#pw").value;
    const name = el.querySelector("#name")?.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = "Enter a valid email address."; return; }
    if (pw.length < 8) { err.textContent = "Passwords need at least 8 characters."; return; }
    if (isRegister && !name) { err.textContent = "Enter your name."; return; }
    run(() => (isRegister ? registerEmail(name, email, pw) : signInEmail(email, pw)));
  });
  el.querySelector("#reset")?.addEventListener("click", () => {
    const email = el.querySelector("#email").value.trim();
    if (!email) { err.textContent = "Enter your email first, then press Reset password."; return; }
    run(async () => { await resetPassword(email); toast(`Reset link sent to ${email}.`, { type: "ok" }); });
  });
}
