import C, { moduleById, question, topicLesson } from "../content.js";
import { stats } from "../progress.js";
import { dueReviews, reviewQueue, saveQuiz } from "../quiz.js";
import { runQuiz, resultsHtml } from "../components/quizRunner.js";
import { esc, pct, empty, fmtRel } from "../components/ui.js";
import { accClass } from "./dashboard.js";
import { REVIEW_INTERVALS } from "../config.js";

export default function review({ el, query }) {
  let stop = null;

  function home() {
    const s = stats();
    const due = dueReviews();
    const queue = reviewQueue();
    const nextDue = queue.filter((w) => w.due > Date.now()).sort((a, b) => a.due - b.due)[0];
    const poorModules = s.modules.filter((m) => m.completed > 0 && m.accuracy !== null && m.answered >= 3 && m.accuracy < 0.7);
    const repeat = queue.filter((w) => (w.wrongCount || 0) >= 2).sort((a, b) => b.wrongCount - a.wrongCount).slice(0, 8);
    const boxes = REVIEW_INTERVALS.map((d, i) => ({ d, n: queue.filter((w) => (w.box || 0) === i).length }));

    el.innerHTML = `
    <div class="page-head"><div><h1>Review center</h1><p>Questions you miss come back on a schedule: 1, 2, 4 and 8 days. Get one right at each step and it's mastered. Weak topics are found automatically from your answers.</p></div></div>
    <div class="grid g3">
      <section class="card span2 glass"><div class="row between"><div><h2 style="margin:0">${due.length} due now</h2>
        <p class="sub" style="margin:.3rem 0 0">${queue.length} in your queue${nextDue && !due.length ? `. Next one is due ${fmtRel(nextDue.due).replace(" ago", "")}` : ""}.</p></div>
        ${due.length ? `<a class="btn" href="#/review?start=1">Start review (${Math.min(due.length, 20)})</a>` : `<span class="chip ok">All caught up</span>`}</div>
        <div class="grid g4" style="margin-top:1rem">${boxes.map((b, i) => `<div class="stat"><b>${b.n}</b><span>Step ${i + 1} · ${b.d} day${b.d > 1 ? "s" : ""}</span></div>`).join("")}</div></section>
      <section class="card"><h2>How topics are flagged</h2><ul class="sub"><li>MCQ accuracy under 70% after 3+ answers</li><li>Questions missed more than once, including in exams</li><li>Lessons done, but the module's quiz accuracy is under 70%</li></ul></section>
    </div>

    <h2 style="margin-top:2rem">Recommended review</h2>
    ${s.weak.length ? `<div class="grid g2">${s.weak.map((w) => {
      const li = topicLesson(w.module, w.topic);
      const wrongIds = queue.filter((x) => x.module === w.module && x.topic === w.topic).map((x) => x.id);
      const isLogic = !moduleById(w.module);
      return `<div class="card tight"><div class="row between"><strong>⚠️ ${esc(moduleById(w.module)?.title || "Logic Lab")}: ${esc(w.topic)}</strong><span class="acc ${accClass(w.accuracy)}">${pct(w.accuracy)}</span></div>
        <p class="sub" style="margin:.3rem 0 .7rem">${w.correct}/${w.total} correct</p>
        <div class="row">${li ? `<a class="btn-ghost sm" href="#/lesson/${li.lesson.id}">Review lesson</a>` : ""}
          ${wrongIds.length ? `<a class="btn-ghost sm" href="#/practice?ids=${wrongIds.join(",")}&start=1&mode=review&label=${encodeURIComponent(w.topic)}%20mistakes">Practice wrong questions (${wrongIds.length})</a>` : ""}
          ${isLogic ? `<a class="btn-ghost sm" href="#/logic?category=${encodeURIComponent(w.topic)}">Practice in Logic Lab</a>` : `<a class="btn-ghost sm" href="#/practice?module=${w.module}&topic=${encodeURIComponent(w.topic)}&count=5&start=1">Take mini quiz</a>`}</div></div>`;
    }).join("")}</div>` : `<p class="muted">Nothing flagged. Keep answering questions and this fills in on its own.</p>`}

    ${poorModules.length ? `<h2 style="margin-top:2rem">Studied, but not sticking yet</h2><div class="grid g3">${poorModules.map((m) => `<div class="card tight"><strong>${esc(m.title)}</strong><p class="sub" style="margin:.3rem 0 .7rem">${m.completed}/${m.total} lessons done, ${pct(m.accuracy)} accuracy</p>
      <div class="row"><a class="btn-ghost sm" href="#/module/${m.id}?tab=lessons">Re-read lessons</a><a class="btn-ghost sm" href="#/practice?module=${m.id}&count=5&mode=mini&start=1">Mini quiz</a></div></div>`).join("")}</div>` : ""}

    ${repeat.length ? `<h2 style="margin-top:2rem">Missed more than once</h2><div class="card"><div class="list">${repeat.map((w) => { const q = question(w.id); return `<div class="list-item"><div class="grow"><span>${esc(q.question.slice(0, 120))}${q.question.length > 120 ? "…" : ""}</span><div class="sub">${esc(moduleById(q.module)?.title || "Logic")} · ${esc(w.topic)}</div></div><span class="chip bad">${w.wrongCount}×</span></div>`; }).join("")}</div></div>` : ""}`;
  }

  function start() {
    const g = stats().goals;
    const due = dueReviews().slice(0, Math.max(g.review, 20));
    const qs = due.map((w) => question(w.id)).filter(Boolean).filter((q) => q.kind === "mcq" || q.kind === "logic");
    if (!qs.length) { el.innerHTML = empty("Nothing due", "All caught up. Missed questions will come back on schedule.", `<a class="btn" href="#/review">Review center</a>`); return; }
    stop = runQuiz(el, qs, {
      title: "Spaced review", immediate: true,
      onFinish: async (session) => {
        if (!session) { location.hash = "#/review"; return; }
        await saveQuiz(session, { mode: "review", label: "Spaced review" });
        el.innerHTML = resultsHtml(session, { heading: "Review complete", actions: `<a class="btn" href="#/review">Back to review center</a>` });
      }
    });
  }

  if (query.start) start(); else home();
  return () => stop?.();
}
