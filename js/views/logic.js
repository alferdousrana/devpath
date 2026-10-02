import C, { moduleById } from "../content.js";
import { stats } from "../progress.js";
import { shuffle, saveLogic } from "../quiz.js";
import { runQuiz, resultsHtml } from "../components/quizRunner.js";
import { esc, pct, blocks, diffChip, empty } from "../components/ui.js";

const CATS = ["Logical reasoning", "Pattern recognition", "Algorithmic thinking", "Debugging", "Output prediction", "Code tracing", "Time complexity", "Data structures", "Programming logic"];

export default function logic({ el, query }) {
  let stop = null;
  const s = stats();
  const solved = new Set(s.records.filter((r) => r.source === "logic" && r.correct).map((r) => r.qid));

  function home() {
    const cats = CATS.map((c) => ({ c, items: C.logic.filter((q) => q.category === c) })).filter((x) => x.items.length);
    el.innerHTML = `
    <div class="page-head"><div><h1>Logic Lab</h1><p>Reasoning, code tracing, debugging and complexity problems. Commit to an answer, write down why, then compare with the explanation. The "why" is the real exercise.</p></div>
      <div style="min-width:220px"><div class="row between sub"><span>Solved</span><strong>${solved.size}/${C.logic.length}</strong></div>${blocks(solved.size / Math.max(1, C.logic.length), { segments: 12, label: "Logic solved" })}</div></div>
    <div class="row" style="margin-bottom:1.5rem"><a class="btn" href="#/logic?set=daily">Today's challenge</a><a class="btn-ghost" href="#/logic?set=random">5 random problems</a><a class="btn-ghost" href="#/logic?set=unsolved">Unsolved only</a></div>
    <div class="grid g3">${cats.map(({ c, items }) => {
      const d = items.filter((q) => solved.has(q.id)).length;
      return `<a class="card card-link tight" href="#/logic?category=${encodeURIComponent(c)}"><strong>${esc(c)}</strong><p class="sub" style="margin:.2rem 0 .6rem">${d}/${items.length} solved</p>${blocks(d / items.length, { segments: Math.max(4, items.length), size: "sm", label: c })}</a>`;
    }).join("")}</div>
    <h2 style="margin-top:2rem">All problems</h2>
    <div class="card"><div class="list">${C.logic.map((q) => `<div class="list-item"><div class="grow"><a class="title" href="#/logic?id=${q.id}">${esc(q.title)}</a><div class="sub">${esc(q.category)}${q.module ? ` · ${esc(moduleById(q.module)?.title)}` : ""}</div></div>${solved.has(q.id) ? `<span class="chip ok">Solved</span>` : ""}${diffChip(q.difficulty)}</div>`).join("")}</div></div>`;
  }

  function choose() {
    if (query.id) return C.logic.filter((q) => q.id === query.id);
    if (query.category) return shuffle(C.logic.filter((q) => q.category === query.category));
    if (query.module) return shuffle(C.logic.filter((q) => q.module === query.module));
    if (query.set === "daily") {
      const unsolved = C.logic.filter((q) => !solved.has(q.id));
      const pool = unsolved.length ? unsolved : C.logic;
      const seed = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ""));
      return [pool[seed % pool.length]];
    }
    if (query.set === "unsolved") return shuffle(C.logic.filter((q) => !solved.has(q.id))).slice(0, 5);
    return shuffle(C.logic).slice(0, 5);
  }

  function start(list) {
    const qs = list || choose();
    if (!qs.length) { el.innerHTML = empty("Nothing to solve here", "You've solved every problem in this set.", `<a class="btn" href="#/logic">Back to Logic Lab</a>`); return; }
    stop = runQuiz(el, qs, {
      title: query.category || (query.set === "daily" ? "Today's challenge" : "Logic Lab"), immediate: true, askWhy: true, shuffleOptions: false,
      onFinish: async (session) => {
        if (!session) { location.hash = "#/logic"; return; }
        await saveLogic(session);
        const wrong = session.items.filter((i) => i.chosen !== i.q.correctAnswer).map((i) => i.q);
        el.innerHTML = resultsHtml(session, { heading: "Logic Lab results", actions:
          `${wrong.length ? `<button class="btn" id="retry" type="button">Retry ${wrong.length} missed</button>` : ""}<a class="btn-ghost" href="#/logic">Back to Logic Lab</a>` });
        el.querySelector("#retry")?.addEventListener("click", () => start(wrong));
      }
    });
  }

  if (query.id || query.category || query.module || query.set) start(); else home();
  return () => stop?.();
}
