import C, { moduleById, topicLesson } from "../content.js";
import { stats, dayKey } from "../progress.js";
import { dueReviews } from "../quiz.js";
import { esc, blocks, pct, icon, fmtDuration } from "../components/ui.js";
import { displayName } from "../app.js";

const greeting = () => { const h = new Date().getHours(); return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
export const accClass = (a) => (a < 0.5 ? "bad" : a < 0.7 ? "mid" : "good");

export function todayGoals(s) {
  const g = s.goals, t = s.today, due = dueReviews().length;
  const next = s.next;
  const items = [
    t.lessons >= g.lessons
      ? { key: "lesson", done: true, label: `Complete ${g.lessons} lesson${g.lessons > 1 ? "s" : ""}`, sub: next ? `Done. Next up: ${next.lesson.title}` : "Done", href: next ? `#/lesson/${next.lesson.id}` : "#/path" }
      : { key: "lesson", done: false, label: next ? `${next.module.title}: ${next.lesson.title}` : "Track complete: review any module",
          sub: `${t.lessons}/${g.lessons} lesson${g.lessons > 1 ? "s" : ""} today`, href: next ? `#/lesson/${next.lesson.id}` : "#/path" },
    { key: "mcq", done: t.mcq >= g.mcq, label: `Answer ${g.mcq} MCQs`, sub: `${Math.min(t.mcq, g.mcq)}/${g.mcq} answered`,
      href: `#/practice?module=${next?.module.id || "mixed"}&count=${g.mcq}&start=1` },
    { key: "logic", done: t.logic >= g.logic, label: `Solve ${g.logic} Logic Lab challenge${g.logic > 1 ? "s" : ""}`, sub: `${Math.min(t.logic, g.logic)}/${g.logic} solved`, href: "#/logic" }
  ];
  if (due || t.review) items.push({ key: "review", done: t.review >= Math.min(g.review, due + t.review), label: `Review ${Math.min(g.review, due + t.review)} wrong answers`, sub: `${due} due now`, href: "#/review?start=1" });
  return items;
}

export default function dashboard({ el, user }) {
  const s = stats();
  const goals = todayGoals(s);
  const doneCount = goals.filter((g) => g.done).length;
  const next = s.next;
  const current = next?.module || C.modules.at(-1);
  const curStat = s.modules.find((m) => m.id === current.id);
  const lastExam = s.exams.at(-1);
  const week = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = dayKey(d.getTime()); week.push({ k, on: (s.days.get(k)?.xp || 0) > 0, today: i === 0, label: d.toLocaleDateString(undefined, { weekday: "narrow" }) }); }
  const weekPct = Math.min(1, s.weekXp / s.goals.weeklyXp);

  el.innerHTML = `
  <div class="grid g3">
    <section class="card glass hello span2" aria-labelledby="hi">
      <h1 id="hi">${greeting()}, ${esc(displayName().split(" ")[0])} 👋</h1>
      <p class="muted">Track A: AI / Backend Engineer</p>
      <div class="row between"><span>Overall progress</span><strong>${pct(s.overall)}</strong></div>
      <div class="bigbar">${blocks(s.overall, { segments: 24, size: "lg", label: "Overall progress" })}</div>
      <div class="sub">${s.done.size} of ${s.totalLessons} lessons complete</div>
      <div class="continue">
        <div>
          <div class="sub">Current module</div>
          <strong>${esc(current.title)}</strong> <span class="muted">${curStat.completed}/${curStat.total}</span>
          ${next ? `<div class="sub">Next: Lesson ${next.index + 1} of ${next.module.lessons.length}, ${esc(next.lesson.title)}</div>` : ""}
        </div>
        <a class="btn" href="${next ? `#/lesson/${next.lesson.id}` : "#/path"}">${next ? "Continue learning" : "Open learning path"}</a>
      </div>
    </section>

    <section class="card" aria-labelledby="streak-h">
      <h2 id="streak-h" class="sr-only">Streak</h2>
      <div class="sub">Current streak</div>
      <div class="streak-num">${icon("fire")} ${s.streak} <span class="muted" style="font-size:1rem;font-weight:500">day${s.streak === 1 ? "" : "s"}</span></div>
      <div class="week-dots" aria-label="Activity in the last 7 days">${week.map((d) => `<span><i class="${d.on ? "on" : ""} ${d.today ? "today" : ""}" title="${d.k}"></i>${d.label}</span>`).join("")}</div>
      <hr style="margin:1rem 0">
      <div class="row between"><span class="sub">Today</span><strong>${s.today.xp} XP</strong></div>
      <div class="row between"><span class="sub">This week</span><strong>${s.weekXp} / ${s.goals.weeklyXp} XP</strong></div>
      <div style="margin-top:.5rem">${blocks(weekPct, { segments: 10, size: "sm", label: "Weekly goal" })}</div>
    </section>

    <section class="card" aria-labelledby="goal-h">
      <div class="row between"><h2 id="goal-h">Today's goal</h2><span class="chip ${doneCount === goals.length ? "ok" : ""}">${doneCount}/${goals.length} completed</span></div>
      <ul class="goal-list">${goals.map((g) => `<li><a class="goal card-link ${g.done ? "done" : ""}" href="${g.href}">
        <span class="tick" aria-hidden="true">${g.done ? icon("check", "sm") : ""}</span>
        <span class="gtext"><span class="glabel">${esc(g.label)}</span><small>${esc(g.sub)}</small></span>
        <span class="sr-only">${g.done ? "Done" : "Not done"}</span>${icon("arrow", "sm")}</a></li>`).join("")}</ul>
    </section>

    <section class="card" aria-labelledby="weak-h">
      <div class="row between"><h2 id="weak-h">Weak areas</h2><a class="sm" href="#/review">Review center</a></div>
      ${s.weak.length ? s.weak.slice(0, 4).map((w) => {
        const li = topicLesson(w.module, w.topic);
        return `<div class="weak-item"><div><strong>${esc(moduleById(w.module)?.title || "Logic")}</strong> <span class="muted">${esc(w.topic)}</span></div>
          <span class="acc ${accClass(w.accuracy)}">${pct(w.accuracy)}</span>
          ${li ? `<a class="sub" href="#/lesson/${li.lesson.id}">Review lesson</a>` : `<span></span>`}<span class="sub">${w.correct}/${w.total} correct</span></div>`;
      }).join("") : `<p class="muted">No weak topics yet. Topics show up here when your accuracy drops below 70% after at least 3 answers.</p>`}
    </section>

    <section class="card" aria-labelledby="exam-h">
      <h2 id="exam-h">Recent exam</h2>
      ${lastExam ? `<p><strong>${esc(lastExam.title)}</strong></p>
        <div class="row between"><span class="stat"><b class="${lastExam.passed ? "acc good" : "acc bad"}">${lastExam.grade.percent}%</b><span>${lastExam.passed ? "Passed" : "Not passed"} · pass mark ${lastExam.passPercent}%</span></span>
        <a class="btn-ghost sm" href="#/exam-result/${lastExam.id}">See analysis</a></div>`
        : `<p class="muted">You haven't taken an exam yet. Module exams unlock whenever you're ready — there's no gate.</p><a class="btn-ghost sm" href="#/exams">Open exam center</a>`}
    </section>

    <section class="card span2" aria-labelledby="mods-h">
      <div class="row between"><h2 id="mods-h">Module progress</h2><a class="sm" href="#/path">Full path</a></div>
      ${s.modules.map((m) => `<div class="prog-row"><a href="#/module/${m.id}">${esc(m.title)}</a>${blocks(m.pct, { segments: 10, label: m.title })}<span class="num">${pct(m.pct)}</span></div>`).join("")}
    </section>

    <section class="card" aria-labelledby="stat-h">
      <h2 id="stat-h">At a glance</h2>
      <div class="kv"><span>Level</span><strong>${s.level.level}</strong></div>
      <div class="kv"><span>Total XP</span><strong>${s.xp}</strong></div>
      <div class="kv"><span>MCQ accuracy</span><strong>${s.accuracy === null ? "—" : pct(s.accuracy)}</strong></div>
      <div class="kv"><span>Questions answered</span><strong>${s.answered}</strong></div>
      <div class="kv"><span>Study time</span><strong>${fmtDuration(s.studySec)}</strong></div>
      <div class="kv"><span>Due for review</span><strong>${dueReviews().length}</strong></div>
    </section>
  </div>`;
}
