import C, { moduleById } from "../content.js";
import { stats } from "../progress.js";
import { loadProgress } from "../exam.js";
import { esc, fmtDate, fmtDuration, blocks } from "../components/ui.js";
import { lineChart } from "../components/charts.js";

export default function exams({ el }) {
  const s = stats();
  const resume = loadProgress();
  const card = (e) => {
    const att = s.exams.filter((a) => a.examId === e.id);
    const best = att.reduce((b, a) => Math.max(b, a.grade.percent), 0);
    const passed = att.some((a) => a.passed);
    const ms = e.module ? s.modules.find((m) => m.id === e.module) : null;
    return `<div class="card tight">
      <div class="row between"><strong>${esc(e.title)}</strong>${passed ? `<span class="chip ok">Passed</span>` : att.length ? `<span class="chip bad">Not passed yet</span>` : ""}</div>
      <p class="sub" style="margin:.3rem 0 .6rem">${e.count} questions · ${e.minutes} min · pass ${e.passPercent}%</p>
      ${ms ? `<div class="sub" style="margin-bottom:.3rem">Lessons ${ms.completed}/${ms.total}</div>${blocks(ms.pct, { segments: 10, size: "sm", label: "Lessons done" })}` : ""}
      <div class="row between" style="margin-top:.8rem"><span class="sub">${att.length ? `Best ${best}% · ${att.length} attempt${att.length > 1 ? "s" : ""}` : "Not attempted"}</span><a class="btn-ghost sm" href="#/exam/${e.id}">Start</a></div></div>`;
  };
  const history = [...s.exams].reverse();
  el.innerHTML = `
  <div class="page-head"><div><h1>Exam center</h1><p>Timed exams with randomized questions and options. You won't see correct answers until you submit; then you get a full breakdown.</p></div></div>
  ${resume ? `<div class="card glass" style="margin-bottom:1.5rem"><div class="row between"><div><strong>Exam in progress: ${esc(resume.def.title)}</strong><div class="sub">${resume.session.items.filter((i) => i.chosen !== null).length}/${resume.session.total} answered · ${fmtDuration(Math.max(0, (resume.deadline - Date.now()) / 1000))} left</div></div><a class="btn" href="#/exam/${resume.def.id}">Resume exam</a></div></div>` : ""}
  <h2>Full Track A exams</h2>
  <div class="grid g2" style="margin-bottom:2rem">${C.exams.filter((e) => e.scope === "track").map(card).join("")}</div>
  <h2>Module exams</h2>
  <div class="grid g3" style="margin-bottom:2rem">${C.exams.filter((e) => e.scope === "module").map(card).join("")}</div>
  <h2>Exam history</h2>
  ${history.length ? `
    <div class="card" style="margin-bottom:1rem">${lineChart(s.exams.slice(-20).map((a) => ({ label: `${a.title} ${fmtDate(a.createdAt)}`, value: a.grade.percent, bad: !a.passed })), { title: "Exam scores over time", threshold: 70 })}</div>
    <div class="card table-wrap"><table><thead><tr><th>Date</th><th>Exam</th><th>Score</th><th>Correct</th><th>Time</th><th>Result</th><th></th></tr></thead>
    <tbody>${history.map((a) => `<tr><td>${fmtDate(a.createdAt)}</td><td>${esc(a.title)}</td><td><strong>${a.grade.percent}%</strong></td><td>${a.grade.correct}/${a.grade.total}</td><td>${fmtDuration(a.durationSec)}</td>
      <td>${a.passed ? `<span class="chip ok">Pass</span>` : `<span class="chip bad">Fail</span>`}</td><td><a href="#/exam-result/${a.id}">Analysis</a></td></tr>`).join("")}</tbody></table></div>`
    : `<p class="muted">No exams taken yet. A module exam after finishing its lessons is the best checkpoint.</p>`}`;
}
