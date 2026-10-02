import C from "../content.js";
import * as db from "../db.js";
import { stats, levelFor } from "../progress.js";
import { evaluate } from "../achievements.js";
import { esc, blocks, fmtDate } from "../components/ui.js";

export default function achievements({ el }) {
  const s = stats();
  const L = levelFor(s.xp);
  const got = C.achievements.filter((a) => db.get("achievements", a.id));
  const milestones = [100, 500, 1000, 2500, 5000, 10000];
  el.innerHTML = `
  <div class="page-head"><div><h1>Achievements</h1><p>${got.length} of ${C.achievements.length} badges earned.</p></div></div>
  <div class="grid g2" style="margin-bottom:2rem">
    <section class="card"><div class="row between"><h2 style="margin:0">Level ${L.level}</h2><strong>${s.xp} XP</strong></div>
      <div style="margin:.8rem 0 .3rem">${blocks(L.pct, { segments: 20, size: "lg", label: "Progress to next level" })}</div>
      <div class="sub">${L.next - s.xp} XP to level ${L.level + 1}</div></section>
    <section class="card"><h2>XP milestones</h2><div class="row">${milestones.map((m) => `<span class="chip ${s.xp >= m ? "ok" : ""}">${m.toLocaleString()} XP</span>`).join("")}</div>
      <p class="sub" style="margin-top:.8rem">XP: lesson 20, quiz 5 + 2 per correct answer, exam 10 (+50 if passed), logic problem 8, coding challenge 25.</p></section>
  </div>
  <div class="badges">${C.achievements.map((a) => {
    const rec = db.get("achievements", a.id);
    const ev = evaluate(a.condition, s);
    return `<div class="badge ${rec ? "got" : ""}"><div class="bi" aria-hidden="true">${esc(a.icon)}</div><div><strong>${esc(a.title)}</strong><small>${esc(a.description)}</small>
      ${rec ? `<small>Earned ${fmtDate(rec.unlockedAt)}</small>` : `${blocks(ev.progress, { segments: 10, size: "sm", label: `${a.title} progress` })}`}</div></div>`;
  }).join("")}</div>`;
}
