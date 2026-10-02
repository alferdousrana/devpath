// One-question-at-a-time runner used by MCQ practice, mini quizzes, reviews
// and the Logic Lab. Exams use their own interface (no feedback until submit).
import { Session } from "../quiz.js";
import { gradeAnswers } from "../progress.js";
import { moduleById } from "../content.js";
import { esc, md, inline, codeBlock, blocks, diffChip, fmtDuration, icon } from "./ui.js";
import * as bm from "../bookmarks.js";

const L = "ABCD";

export function questionHtml(q) {
  return `<div class="q-text">${inline(q.question)}</div>${q.code ? codeBlock(q.code, q.codeLang || "python") : ""}`;
}

export function runQuiz(el, questions, { title = "Practice", immediate = true, askWhy = false, shuffleOptions = true, onFinish }) {
  const s = new Session(questions, { shuffleOptions });
  bm.wire(el);
  let revealed = false;

  const keyHandler = (e) => {
    if (e.target.matches("textarea, input")) return;
    const k = e.key.toUpperCase();
    const i = L.indexOf(k);
    if (i > -1 && i < 4 && !revealed) { el.querySelectorAll(".opt")[i]?.click(); }
    if ((e.key === "Enter" || e.key === "ArrowRight") && revealed) el.querySelector("#next")?.click();
  };
  document.addEventListener("keydown", keyHandler);

  function render() {
    const it = s.current;
    const q = it.q;
    revealed = false;
    el.innerHTML = `
    <div class="quiz">
      <div class="quiz-top"><span><strong>${esc(title)}</strong></span><span>Question ${s.index + 1} of ${s.total}</span></div>
      ${blocks((s.index) / s.total, { segments: Math.min(s.total, 20), size: "sm", label: "Quiz progress" })}
      <div class="card" style="margin-top:1rem">
        <div class="row between" style="margin-bottom:.8rem"><div class="row">${diffChip(q.difficulty)}<span class="chip">${esc(moduleById(q.module)?.title || q.category || "Logic")}</span><span class="chip">${esc(q.topic || q.category)}</span></div>${bm.button("question", q.id)}</div>
        ${questionHtml(q)}
        <ul class="options" role="list">${it.order.map((oi, pos) => `<li><button type="button" class="opt" data-oi="${oi}"><span class="letter">${L[pos]}</span><span>${inline(q.options[oi])}</span></button></li>`).join("")}</ul>
        ${askWhy ? `<div class="field" style="margin-top:1rem"><label for="why">Explain your reasoning (optional, saved with your attempt)</label><textarea id="why" maxlength="2000" style="min-height:70px"></textarea></div>` : ""}
        <div id="feedback" aria-live="polite"></div>
      </div>
      <div class="quiz-nav"><button class="btn-ghost" id="quit" type="button">End quiz</button><button class="btn" id="next" type="button" hidden>${s.index + 1 === s.total ? "See results" : "Next question"}</button></div>
      <p class="sub" style="text-align:center;margin-top:1rem">Keys: A–D to answer, Enter for next.</p>
    </div>`;

    el.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => {
      if (revealed) return;
      const oi = Number(b.dataset.oi);
      if (askWhy) it.explanation = el.querySelector("#why").value;
      const ok = s.answer(oi);
      revealed = true;
      if (immediate) {
        el.querySelectorAll(".opt").forEach((o) => {
          o.disabled = true;
          const v = Number(o.dataset.oi);
          if (v === q.correctAnswer) o.classList.add("right");
          else if (v === oi) o.classList.add("wrong");
        });
        el.querySelector("#feedback").innerHTML = `<div class="callout ${ok ? "pass" : "warn"} explain"><strong>${ok ? "Correct." : `Not quite. The answer is ${L[it.order.indexOf(q.correctAnswer)]}.`}</strong>${md(q.explanation)}</div>`;
      } else {
        b.classList.add("picked");
        el.querySelectorAll(".opt").forEach((o) => (o.disabled = true));
      }
      const n = el.querySelector("#next");
      n.hidden = false;
      n.focus();
    }));
    el.querySelector("#next").addEventListener("click", () => {
      if (s.index + 1 < s.total) { s.go(s.index + 1); render(); } else finish();
    });
    el.querySelector("#quit").addEventListener("click", finish);
  }

  function finish() {
    document.removeEventListener("keydown", keyHandler);
    // only keep questions that were actually shown/answered
    const answered = s.items.filter((i) => i.chosen !== null);
    if (!answered.length) { onFinish?.(null); return; }
    s.items = answered;
    onFinish?.(s);
  }

  render();
  return () => document.removeEventListener("keydown", keyHandler);
}

export function resultsHtml(session, { heading = "Results", actions = "" } = {}) {
  const g = gradeAnswers(session.answersPayload());
  const percent = g.percent;
  const wrong = g.rows.filter((r) => !r.correct);
  return `
  <div class="quiz">
    <div class="card">
      <div class="row" style="gap:1.5rem;align-items:center">
        <div class="score-ring" style="--v:${percent};--ring:${percent >= 70 ? "var(--pass)" : percent >= 50 ? "var(--warn)" : "var(--fail)"}"><div><b>${percent}%</b><span>accuracy</span></div></div>
        <div class="stack" style="gap:.2rem"><h1 style="margin:0">${esc(heading)}</h1>
          <div class="sub">${g.correct} of ${g.total} correct · ${fmtDuration(session.durationSec)} · ${fmtDuration(session.durationSec / Math.max(1, g.total))} per question</div>
          <div class="row" style="margin-top:.6rem">${actions}</div></div>
      </div>
    </div>
    <h2 style="margin-top:1.5rem">Question review</h2>
    <div class="stack">${g.rows.map((r, i) => reviewRow(r, i)).join("")}</div>
    ${wrong.length ? "" : `<p class="muted" style="margin-top:1rem">No wrong answers. Nice work.</p>`}
  </div>`;
}

export function reviewRow(r, i) {
  const q = r.q;
  const cls = !r.answered ? "rv-skip" : r.correct ? "rv-ok" : "rv-bad";
  return `<details class="review-q ${cls}" ${r.correct ? "" : "open"}>
    <summary class="row between" style="cursor:pointer"><span><strong>${i + 1}.</strong> ${inline(q.question.length > 110 ? q.question.slice(0, 110) + "…" : q.question)}</span>
      <span class="chip ${r.correct ? "ok" : "bad"}">${!r.answered ? "Unanswered" : r.correct ? `${icon("check", "sm")} Correct` : `${icon("x", "sm")} Wrong`}</span></summary>
    <div style="margin-top:.8rem">
      ${q.code ? codeBlock(q.code, q.codeLang || "python") : ""}
      ${r.answered && !r.correct ? `<p class="answer-line"><span class="acc bad">Your answer:</span> ${inline(q.options[r.chosen])}</p>` : ""}
      <p class="answer-line"><span class="acc good">Correct answer:</span> ${inline(q.options[q.correctAnswer])}</p>
      <div class="sub">${md(q.explanation)}</div>
      ${r.explanation ? `<p class="sub"><strong>Your reasoning:</strong> ${esc(r.explanation)}</p>` : ""}
      <div class="row">${q.lesson ? `<a class="btn-ghost sm" href="#/lesson/${q.lesson}">Review lesson</a>` : ""}${bm.button("question", q.id)}</div>
    </div></details>`;
}
