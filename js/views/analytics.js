import C, { moduleById } from "../content.js";
import { stats, dayKey } from "../progress.js";
import { esc, pct, blocks, fmtDuration, fmtDate } from "../components/ui.js";
import { barChart, lineChart } from "../components/charts.js";
import { accClass } from "./dashboard.js";

export default function analytics({ el, query }) {
  const s = stats();
  const range = Number(query.range) || 7;
  const days = [];
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = dayKey(d.getTime()), v = s.days.get(k) || {};
    days.push({ k, d, xp: v.xp || 0, min: Math.round((v.studySec || 0) / 60), q: (v.mcq || 0) + (v.logic || 0) + (v.review || 0) });
  }
  const short = (d) => (range <= 7 ? d.toLocaleDateString(undefined, { weekday: "short" }) : String(d.getDate()));
  const avgExam = s.exams.length ? Math.round(s.exams.reduce((a, e) => a + e.grade.percent, 0) / s.exams.length) : null;
  const topicRow = (t) => `<div class="prog-row"><span>${esc(t.topic)} <span class="sub">${esc(moduleById(t.module)?.title || "Logic")}</span></span>${blocks(t.accuracy, { segments: 8, label: t.topic })}<span class="num acc ${accClass(t.accuracy)}">${pct(t.accuracy)}</span></div>`;
  const weakest = [...s.topics].filter((t) => t.total >= 3).sort((a, b) => a.accuracy - b.accuracy).slice(0, 6);
  const stat = (v, l) => `<div class="card tight stat"><b>${v}</b><span>${l}</span></div>`;

  el.innerHTML = `
  <div class="page-head"><div><h1>Analytics</h1><p>Everything here is computed from your raw activity, so it's the same on every device.</p></div></div>
  <div class="grid g4" style="margin-bottom:1rem">
    ${stat(fmtDuration(s.studySec), "Total study time")}${stat(`${s.done.size}/${s.totalLessons}`, "Lessons completed")}
    ${stat(s.mcqAnswered, "MCQs answered")}${stat(s.accuracy === null ? "—" : pct(s.accuracy), "Overall accuracy")}
    ${stat(s.exams.length, "Exams taken")}${stat(avgExam === null ? "—" : `${avgExam}%`, "Average exam score")}
    ${stat(`${s.streak} days`, `Current streak (best ${s.bestStreak})`)}${stat(`${s.weeklyStreak} wk`, "Weekly goal streak")}
  </div>
  <div class="grid g2">
    <section class="card span2"><div class="row between"><h2 style="margin:0">Activity</h2>
      <div class="seg" role="group" aria-label="Range">${[7, 28].map((r) => `<button type="button" data-r="${r}" aria-pressed="${r === range}">${r === 7 ? "7 days" : "4 weeks"}</button>`).join("")}</div></div>
      <div class="grid g2" style="margin-top:1rem">
        <div><div class="sub">XP per day</div>${barChart(days.map((d) => ({ label: d.k, short: short(d.d), value: d.xp, highlight: d.k === dayKey() })), { title: "XP per day" })}</div>
        <div><div class="sub">Study minutes per day</div>${barChart(days.map((d) => ({ label: d.k, short: short(d.d), value: d.min, highlight: d.k === dayKey() })), { title: "Study minutes per day", unit: " min" })}</div>
      </div></section>
    <section class="card"><h2>Accuracy by module</h2>${s.modules.map((m) => `<div class="prog-row"><a href="#/module/${m.id}">${esc(m.title)}</a>${blocks(m.accuracy || 0, { segments: 8, label: m.title })}<span class="num ${m.accuracy === null ? "" : `acc ${accClass(m.accuracy)}`}">${m.accuracy === null ? "—" : pct(m.accuracy)}</span></div>`).join("")}</section>
    <section class="card"><h2>Strongest topics</h2>${s.strong.length ? s.strong.slice(0, 6).map(topicRow).join("") : `<p class="muted">Topics appear here at 85%+ accuracy over 3+ answers.</p>`}
      <h2 style="margin-top:1.5rem">Weakest topics</h2>${weakest.length ? weakest.map(topicRow).join("") : `<p class="muted">Answer at least 3 questions in a topic to see it here.</p>`}</section>
    <section class="card span2"><h2>Exam scores</h2>${s.exams.length ? lineChart(s.exams.slice(-20).map((a) => ({ label: `${a.title} (${fmtDate(a.createdAt)})`, value: a.grade.percent, bad: !a.passed })), { title: "Exam scores", threshold: 70 }) + `<p class="sub">Dashed line: 70% pass mark. Red dots: failed attempts.</p>` : `<p class="muted">Take an exam to start the trend line.</p>`}</section>
    <section class="card span2"><h2>Lesson completion</h2>${s.modules.map((m) => `<div class="prog-row"><a href="#/module/${m.id}">${esc(m.title)}</a>${blocks(m.pct, { segments: 10, label: m.title })}<span class="num">${m.completed}/${m.total}</span></div>`).join("")}</section>
  </div>`;
  el.querySelector(".seg").addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (b) location.hash = `#/analytics?range=${b.dataset.r}`; });
}
