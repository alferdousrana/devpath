import { stats } from "../progress.js";
import { moduleById } from "../content.js";
import { reviewRow } from "../components/quizRunner.js";
import { esc, fmtDuration, fmtDate, empty, pct, blocks } from "../components/ui.js";
import { accClass } from "./dashboard.js";

export default function examResult({ el, params }) {
  const a = stats().exams.find((x) => x.id === params.id);
  if (!a) { el.innerHTML = empty("Result not found", "If you took this exam on another device, it appears once sync finishes.", `<a class="btn" href="#/exams">Exam center</a>`); return; }
  const g = a.grade;
  const byTopic = new Map();
  for (const r of g.rows) {
    const k = `${r.q.module}::${r.q.topic}`;
    if (!byTopic.has(k)) byTopic.set(k, { module: r.q.module, topic: r.q.topic, total: 0, correct: 0 });
    const t = byTopic.get(k); t.total++; if (r.correct) t.correct++;
  }
  const topics = [...byTopic.values()].sort((x, y) => x.correct / x.total - y.correct / y.total);
  const wrongIds = g.rows.filter((r) => !r.correct).map((r) => r.q.id);
  const filter = (f) => g.rows.map((r, i) => ({ r, i })).filter(({ r }) => f === "all" || (f === "wrong" && r.answered && !r.correct) || (f === "skip" && !r.answered) || (f === "right" && r.correct));

  el.innerHTML = `
  <div class="crumbs"><a href="#/exams">Exam center</a><span>/</span><span>${fmtDate(a.createdAt)}</span></div>
  <div class="grid g3">
    <section class="card span2"><div class="row" style="gap:1.5rem">
      <div class="score-ring" style="--v:${g.percent};--ring:${a.passed ? "var(--pass)" : "var(--fail)"}"><div><b>${g.percent}%</b><span>${a.passed ? "Passed" : "Not passed"}</span></div></div>
      <div><h1 style="margin-bottom:.3rem">${esc(a.title)}</h1><p class="muted" style="margin:0">Pass mark ${a.passPercent}%. ${a.passed ? "You cleared it." : `You needed ${Math.ceil((a.passPercent / 100) * g.total) - g.correct} more correct.`}</p>
      <div class="row" style="margin-top:.8rem">${wrongIds.length ? `<a class="btn" href="#/practice?ids=${wrongIds.join(",")}&start=1&label=Exam%20mistakes">Practice ${wrongIds.length} missed questions</a>` : ""}<a class="btn-ghost" href="#/exam/${a.examId}">Retake exam</a></div></div></div></section>
    <section class="card"><div class="kv"><span>Correct</span><strong class="acc good">${g.correct}</strong></div><div class="kv"><span>Wrong</span><strong class="acc bad">${g.wrong}</strong></div>
      <div class="kv"><span>Unanswered</span><strong>${g.unanswered}</strong></div><div class="kv"><span>Time used</span><strong>${fmtDuration(a.durationSec)} of ${fmtDuration(a.timeLimitSec)}</strong></div>
      <div class="kv"><span>Avg per question</span><strong>${fmtDuration(a.durationSec / Math.max(1, g.total))}</strong></div></section>
    <section class="card span2"><h2>By topic</h2>${topics.map((t) => `<div class="prog-row"><span>${esc(t.topic)} <span class="sub">${esc(moduleById(t.module)?.title || "")}</span></span>${blocks(t.correct / t.total, { segments: 8, label: t.topic })}<span class="num acc ${accClass(t.correct / t.total)}">${pct(t.correct / t.total)}</span></div>`).join("")}</section>
    <section class="card"><h2>What to do next</h2><p class="sub">${a.passed ? "Look at the weakest topics on the left anyway. A pass with gaps is still gaps." : "Review the lessons for your two weakest topics, practice the missed questions, then retake the exam in a day or two."}</p>
      <p class="sub">Every missed question is now in your review queue.</p><a class="btn-ghost sm" href="#/review">Open review center</a></section>
  </div>
  <div class="row between" style="margin:2rem 0 1rem"><h2 style="margin:0">Question review</h2>
    <div class="seg" role="group" aria-label="Filter questions">${[["all", "All"], ["wrong", `Wrong (${g.wrong})`], ["skip", `Unanswered (${g.unanswered})`], ["right", `Correct (${g.correct})`]].map(([v, t], i) => `<button type="button" data-f="${v}" aria-pressed="${i === 0}">${t}</button>`).join("")}</div></div>
  <div class="stack" id="rows"></div>`;
  const rows = el.querySelector("#rows");
  const show = (f) => { rows.innerHTML = filter(f).map(({ r, i }) => reviewRow(r, i)).join("") || `<p class="muted">Nothing here.</p>`; };
  el.querySelector(".seg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; el.querySelectorAll("[data-f]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); show(b.dataset.f); });
  show("all");
}
