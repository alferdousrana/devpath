import C from "../content.js";
import * as db from "../db.js";
import { stats } from "../progress.js";
import { esc, pct, fmtDate, fmtDuration, toast, blocks } from "../components/ui.js";

export default function profile({ el, user }) {
  const s = stats();
  const p = db.get("profile", "main") || {};
  const name = p.displayName || user.name;
  const badges = db.list("achievements").length;
  el.innerHTML = `
  <div class="page-head"><div><h1>Profile</h1></div></div>
  <div class="grid g2">
    <section class="card"><div class="row"><div class="bi" style="width:64px;height:64px;border-radius:16px;display:grid;place-items:center;font-size:1.6rem;font-weight:700;background:var(--accent-grad);color:#fff" aria-hidden="true">${esc(name.slice(0, 1).toUpperCase())}</div>
      <div><h2 style="margin:0">${esc(name)}</h2><div class="sub">${esc(user.email || "Local profile")}</div><div class="sub">Learning since ${fmtDate(p.createdAt || Date.now())}</div></div></div>
      <form id="nameForm" style="margin-top:1.2rem"><label for="dn">Display name</label><div class="row"><input id="dn" type="text" maxlength="60" value="${esc(name)}" style="flex:1"><button class="btn-ghost" type="submit">Save</button></div></form></section>
    <section class="card"><h2>Level ${s.level.level}</h2>${blocks(s.level.pct, { segments: 20, label: "Level progress" })}<p class="sub" style="margin-top:.4rem">${s.xp} XP · ${s.level.next - s.xp} to next level</p>
      <div class="kv"><span>Track</span><strong>${esc(C.track.title)}</strong></div><div class="kv"><span>Overall progress</span><strong>${pct(s.overall)}</strong></div>
      <div class="kv"><span>Badges</span><strong>${badges}/${C.achievements.length}</strong></div><div class="kv"><span>Study time</span><strong>${fmtDuration(s.studySec)}</strong></div>
      <div class="kv"><span>Best streak</span><strong>${s.bestStreak} days</strong></div></section>
  </div>`;
  el.querySelector("#nameForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = el.querySelector("#dn").value.trim().replace(/[<>]/g, "").slice(0, 60);
    if (!v) return toast("Enter a name.", { type: "error" });
    await db.put("profile", "main", { ...(db.get("profile", "main") || {}), displayName: v });
    toast("Name saved.", { type: "ok" });
  });
}
