import C, { moduleById, question } from "../content.js";
import * as db from "../db.js";
import { pick, pickBalanced, saveQuiz, dueReviews } from "../quiz.js";
import { runQuiz, resultsHtml } from "../components/quizRunner.js";
import { esc, empty } from "../components/ui.js";
import * as bm from "../bookmarks.js";

export default function practice({ el, query }) {
  let stop = null;
  const profile = db.get("profile", "main") || {};
  const cfg = {
    module: query.module || "mixed",
    difficulty: query.difficulty || "all",
    count: Math.min(50, Math.max(1, Number(query.count) || 10)),
    immediate: query.immediate ? query.immediate === "1" : profile.immediateFeedback !== false,
    mode: query.mode || "practice"
  };

  function poolFor() {
    if (query.ids) return query.ids.split(",").map(question).filter(Boolean);
    if (query.lesson) return C.questions.filter((q) => q.lesson === query.lesson);
    let p = cfg.module === "mixed" ? C.questions : C.questions.filter((q) => q.module === cfg.module);
    if (query.topic) p = p.filter((q) => q.topic === query.topic);
    return p;
  }

  function choose() {
    const p = poolFor();
    if (query.ids || query.lesson) return pick(p, { count: 50 });
    return cfg.module === "mixed" && cfg.difficulty === "all" ? pickBalanced(p, cfg.count) : pick(p, { count: cfg.count, difficulty: cfg.difficulty });
  }

  function label() {
    if (query.label) return query.label;
    if (query.lesson) return "Lesson practice";
    if (cfg.mode === "mini") return `${moduleById(cfg.module)?.title} mini quiz`;
    if (query.topic) return `${moduleById(cfg.module)?.title}: ${query.topic}`;
    return cfg.module === "mixed" ? "Mixed practice" : `${moduleById(cfg.module)?.title} practice`;
  }

  function configScreen() {
    const opts = (name, list, cur) => `<div class="seg" role="group" aria-label="${name}">${list.map(([v, t]) => `<button type="button" data-${name}="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
    const saved = bm.saved().filter((b) => b.type === "question" && question(b.refId));
    el.innerHTML = `
    <div class="page-head"><div><h1>MCQ practice</h1><p>Pick a scope and difficulty. Wrong answers go to your review queue automatically.</p></div></div>
    <div class="grid g2">
      <section class="card span2">
        <div class="field"><label for="mod">Module</label>
          <select id="mod"><option value="mixed">Mixed: all modules</option>${C.modules.map((m) => `<option value="${m.id}" ${cfg.module === m.id ? "selected" : ""}>${esc(m.title)} (${C.questions.filter((q) => q.module === m.id).length})</option>`).join("")}</select></div>
        <div class="field"><label>Difficulty</label>${opts("difficulty", [["all", "All"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]], cfg.difficulty)}</div>
        <div class="field"><label>Questions</label>${opts("count", [[5, "5"], [10, "10"], [20, "20"], [30, "30"]], cfg.count)}</div>
        <div class="field"><label>Feedback</label>${opts("immediate", [[true, "After each answer"], [false, "At the end"]], cfg.immediate)}</div>
        <p class="sub" id="avail"></p>
        <button class="btn" id="go" type="button">Start practice</button>
      </section>
      <section class="card"><h2>Random quiz</h2><p class="muted">10 questions balanced across every module.</p><a class="btn-ghost" href="#/practice?module=mixed&count=10&start=1">Start random quiz</a></section>
      <section class="card"><h2>Due for review</h2><p class="muted">${dueReviews().length} questions you got wrong are due.</p><a class="btn-ghost" href="#/review?start=1">Practice wrong answers</a></section>
      ${saved.length ? `<section class="card span2"><h2>Saved questions</h2><p class="muted">${saved.length} bookmarked.</p><a class="btn-ghost" href="#/practice?ids=${saved.map((b) => b.refId).join(",")}&start=1&label=Saved%20questions">Practice saved questions</a></section>` : ""}
    </div>`;
    const avail = () => { const n = poolFor().filter((q) => cfg.difficulty === "all" || q.difficulty === cfg.difficulty).length; el.querySelector("#avail").textContent = `${n} questions available${n < cfg.count ? `, so you'll get ${n}` : ""}.`; };
    el.querySelector("#mod").addEventListener("change", (e) => { cfg.module = e.target.value; avail(); });
    el.querySelectorAll(".seg").forEach((g) => g.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const [k, v] = Object.entries(b.dataset)[0];
      cfg[k] = k === "count" ? Number(v) : k === "immediate" ? v === "true" : v;
      g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      avail();
    }));
    el.querySelector("#go").addEventListener("click", start);
    avail();
  }

  function start(list) {
    const qs = Array.isArray(list) ? list : choose();
    if (!qs.length) { el.innerHTML = empty("No questions match", "Try a different difficulty or module.", `<a class="btn" href="#/practice">Change settings</a>`); return; }
    stop = runQuiz(el, qs, {
      title: label(), immediate: cfg.immediate,
      onFinish: async (session) => {
        if (!session) { configScreen(); return; }
        await saveQuiz(session, { mode: ["mini", "review"].includes(cfg.mode) ? cfg.mode : "practice", moduleId: cfg.module === "mixed" ? null : cfg.module, label: label() });
        const wrong = session.items.filter((i) => i.chosen !== i.q.correctAnswer).map((i) => i.q);
        el.innerHTML = resultsHtml(session, { heading: label(), actions:
          `${wrong.length ? `<button class="btn" id="retry" type="button">Retry ${wrong.length} incorrect</button>` : ""}
           <button class="btn-ghost" id="again" type="button">New set</button><a class="btn-ghost" href="#/practice">Change settings</a>` });
        bm.wire(el);
        el.querySelector("#retry")?.addEventListener("click", () => start(wrong));
        el.querySelector("#again").addEventListener("click", () => start());
      }
    });
  }

  if (query.start) start(); else configScreen();
  return () => stop?.();
}
