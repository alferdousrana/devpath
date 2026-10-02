import C, { moduleById, questionsFor } from "../content.js";
import { stats, isDone } from "../progress.js";
import { esc, blocks, pct, icon, empty, diffChip, md, inline } from "../components/ui.js";

export default function moduleView({ el, params, query }) {
  const m = moduleById(params.id);
  if (!m) { el.innerHTML = empty("Module not found", "It may have been renamed.", `<a class="btn" href="#/path">Open learning path</a>`); return; }
  const s = stats();
  const ms = s.modules.find((x) => x.id === m.id);
  const qs = questionsFor(m.id);
  const exam = C.exams.find((e) => e.scope === "module" && e.module === m.id);
  const examAttempts = s.exams.filter((e) => e.examId === exam?.id);
  const best = examAttempts.reduce((b, e) => Math.max(b, e.grade.percent), 0);
  const challenges = C.coding.filter((c) => c.module === m.id);
  const logic = C.logic.filter((q) => q.module === m.id);
  const byDiff = (d) => qs.filter((q) => q.difficulty === d).length;
  const tab = query.tab || "overview";

  const tabs = [["overview", "Overview"], ["lessons", `Lessons (${m.lessons.length})`], ["practice", "Practice"], ["tests", "Quiz & exam"]];
  el.innerHTML = `
  <div class="crumbs"><a href="#/path">Learning path</a><span>/</span><span>Module ${m.order}</span></div>
  <div class="page-head">
    <div><h1>${esc(m.title)}</h1><p>${esc(m.tagline)}</p></div>
    <div style="min-width:240px"><div class="row between sub"><span>${ms.completed}/${ms.total} lessons</span><strong>${pct(ms.pct)}</strong></div>${blocks(ms.pct, { segments: 12, label: "Module progress" })}
      <div class="row" style="margin-top:.6rem">${ms.completed === ms.total ? `<span class="chip ok">Lessons complete</span>` : ms.completed ? `<span class="chip">In progress</span>` : `<span class="chip">Not started</span>`}${ms.passedExam ? `<span class="chip ok">Exam passed</span>` : ""}${ms.accuracy !== null ? `<span class="chip">${pct(ms.accuracy)} accuracy</span>` : ""}</div></div>
  </div>
  <div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button role="tab" aria-selected="${tab === id}" data-tab="${id}" id="tab-${id}" aria-controls="panel">${label}</button>`).join("")}</div>
  <div id="panel" role="tabpanel"></div>`;

  const panel = el.querySelector("#panel");
  const panels = {
    overview: () => `
      <div class="grid g2">
        <section class="card span2"><h2>Overview</h2>${md(m.overview)}</section>
        <section class="card"><h2>Learning objectives</h2><ul>${m.objectives.map((o) => `<li>${inline(o)}</li>`).join("")}</ul></section>
        <section class="card"><h2>Important notes</h2><ul>${m.notes.map((o) => `<li>${inline(o)}</li>`).join("")}</ul></section>
        <section class="card span2"><h2>Key concepts</h2><dl class="terms">${m.concepts.map(([t, d]) => `<div><dt>${inline(t)}</dt><dd>${inline(d)}</dd></div>`).join("")}</dl></section>
        <section class="card span2"><h2>Engineering checkpoints</h2><p class="muted">Before you call this module done, you should be able to answer yes to each of these.</p>
          <div class="grid g4">${[["explain", "Can you explain this?"], ["use", "Can you use this?"], ["debug", "Can you debug this?"], ["build", "Can you build with this?"]].map(([k, t]) => `<div><h3>${t}</h3><ul>${(m.checkpoints[k] || []).map((x) => `<li>${inline(x)}</li>`).join("")}</ul></div>`).join("")}</div></section>
      </div>`,
    lessons: () => `<div class="card"><div class="list">${m.lessons.map((l, i) => `
      <div class="list-item"><span class="tick-s">${isDone(l.id) ? `<span class="chip ok">${icon("check", "sm")} Done</span>` : `<span class="chip">Lesson ${i + 1}</span>`}</span>
        <div class="grow"><a class="title" href="#/lesson/${l.id}">${esc(l.title)}</a><div class="sub">${esc(l.summary)}</div></div><span class="sub">${l.minutes} min</span></div>`).join("")}</div></div>`,
    practice: () => `
      <div class="grid g2">
        <section class="card"><h2>MCQ practice</h2><p class="muted">${qs.length} questions: ${byDiff("easy")} easy, ${byDiff("medium")} medium, ${byDiff("hard")} hard.</p>
          <div class="row">${["all", "easy", "medium", "hard"].map((d) => `<a class="btn-ghost sm" href="#/practice?module=${m.id}&difficulty=${d}&start=1">${d === "all" ? "All levels" : d[0].toUpperCase() + d.slice(1)}</a>`).join("")}</div></section>
        <section class="card"><h2>Logic practice</h2>${logic.length ? `<p class="muted">${logic.length} reasoning and code-tracing problems tied to this module.</p><a class="btn-ghost sm" href="#/logic?module=${m.id}">Open in Logic Lab</a>` : `<p class="muted">No module-specific logic problems yet. The Logic Lab has general ones.</p><a class="btn-ghost sm" href="#/logic">Open Logic Lab</a>`}</section>
        <section class="card span2"><h2>Hands-on tasks</h2><p class="muted">Do these in a real terminal or editor. They are where the understanding sticks.</p>
          ${m.tasks.map((t) => `<div class="hint"><strong>${esc(t.title)}</strong><p class="sub" style="margin:.2rem 0 .4rem">${inline(t.goal)}</p><ol>${t.steps.map((x) => `<li>${inline(x)}</li>`).join("")}</ol></div>`).join("")}</section>
        ${challenges.length ? `<section class="card span2"><h2>Coding Lab challenges</h2><div class="list">${challenges.map((c) => `<div class="list-item"><div class="grow"><a class="title" href="#/coding/${c.id}">${esc(c.title)}</a></div>${diffChip(c.difficulty)}</div>`).join("")}</div></section>` : ""}
      </div>`,
    tests: () => `
      <div class="grid g2">
        <section class="card"><h2>Mini quiz</h2><p class="muted">5 random questions from this module with instant feedback. Good after each lesson.</p><a class="btn" href="#/practice?module=${m.id}&count=5&mode=mini&start=1">Start mini quiz</a></section>
        <section class="card"><h2>Module exam</h2>${exam ? `<p class="muted">${exam.count} questions · ${exam.minutes} minutes · pass mark ${exam.passPercent}%. Answers are revealed only after you submit.</p>
          <div class="row"><a class="btn" href="#/exam/${exam.id}">Start exam</a>${examAttempts.length ? `<span class="sub">Best: ${best}% over ${examAttempts.length} attempt${examAttempts.length > 1 ? "s" : ""}</span>` : ""}</div>` : `<p class="muted">No exam defined.</p>`}</section>
      </div>`
  };
  const show = (id) => {
    panel.innerHTML = panels[id]();
    el.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === id)));
    history.replaceState(null, "", `#/module/${m.id}?tab=${id}`);
  };
  el.querySelector(".tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) show(b.dataset.tab); });
  el.querySelector(".tabs").addEventListener("keydown", (e) => {
    if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
    const bs = [...el.querySelectorAll("[data-tab]")]; const i = bs.indexOf(document.activeElement);
    const n = bs[(i + (e.key === "ArrowRight" ? 1 : -1) + bs.length) % bs.length]; n.focus(); show(n.dataset.tab);
  });
  panel.innerHTML = panels[tab] ? panels[tab]() : panels.overview();
}
