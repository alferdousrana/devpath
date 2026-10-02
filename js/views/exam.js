import { examDef, buildExam, saveProgress, loadProgress, clearProgress, submitExam } from "../exam.js";
import { questionHtml } from "../components/quizRunner.js";
import { esc, inline, fmtClock, empty, confirmBox, modal, icon } from "../components/ui.js";

const L = "ABCD";

export default function examView({ el, params, navigate }) {
  const def = examDef(params.id);
  if (!def) { el.innerHTML = empty("Exam not found", "", `<a class="btn" href="#/exams">Exam center</a>`); return; }
  let session = null, deadline = 0, tick = null, submitting = false;
  let paletteOpen = matchMedia("(min-width: 901px)").matches;
  const existing = loadProgress();

  function intro() {
    el.innerHTML = `
    <div class="quiz"><div class="card">
      <div class="crumbs"><a href="#/exams">Exam center</a></div>
      <h1>${esc(def.title)}</h1>
      <p class="muted">${esc(def.description || "")}</p>
      <div class="kv"><span>Questions</span><strong>${def.count}</strong></div>
      <div class="kv"><span>Time limit</span><strong>${def.minutes} minutes</strong></div>
      <div class="kv"><span>Pass mark</span><strong>${def.passPercent}%</strong></div>
      <div class="kv"><span>Feedback</span><strong>After you submit</strong></div>
      <p class="sub" style="margin-top:1rem">Questions and options are shuffled. You can move freely between questions and flag ones to revisit. Your answers are checkpointed on this device, so a reload or lost connection won't lose the exam. The exam submits automatically when time runs out.</p>
      ${existing && existing.def.id !== def.id ? `<div class="callout warn"><p>You have another exam in progress (${esc(existing.def.title)}). Starting this one discards it.</p></div>` : ""}
      <div class="row" style="margin-top:1rem"><button class="btn" id="begin" type="button">Start exam</button><a class="btn-ghost" href="#/exams">Not now</a></div>
    </div></div>`;
    el.querySelector("#begin").addEventListener("click", () => {
      session = buildExam(def);
      if (!session.total) { el.innerHTML = empty("No questions available", "This exam's question pool is empty.", ""); return; }
      deadline = Date.now() + def.minutes * 60000;
      saveProgress(def, session, deadline);
      run();
    });
  }

  function run() {
    document.addEventListener("keydown", onKey);
    tick = setInterval(updateTimer, 1000);
    render();
  }

  function render() {
    const it = session.current, q = it.q;
    const answered = session.items.filter((i) => i.chosen !== null).length;
    el.innerHTML = `
    <div class="exam-layout">
      <div>
        <div class="quiz-top"><strong>${esc(def.title)}</strong><span>Question ${session.index + 1} of ${session.total}</span></div>
        <div class="card">
          ${questionHtml(q)}
          <ul class="options">${it.order.map((oi, pos) => `<li><button type="button" class="opt ${it.chosen === oi ? "picked" : ""}" data-oi="${oi}" aria-pressed="${it.chosen === oi}"><span class="letter">${L[pos]}</span><span>${inline(q.options[oi])}</span></button></li>`).join("")}</ul>
          <div class="row" style="margin-top:1rem"><button class="btn-ghost sm ${it.flagged ? "on" : ""}" id="flag" type="button" aria-pressed="${it.flagged}">${icon("flag", "sm")} ${it.flagged ? "Flagged" : "Flag for review"}</button>
          ${it.chosen !== null ? `<button class="btn-ghost sm" id="clear" type="button">Clear answer</button>` : ""}</div>
        </div>
        <div class="quiz-nav"><button class="btn-ghost" id="prev" type="button" ${session.index === 0 ? "disabled" : ""}>Previous</button>
          ${session.index + 1 < session.total ? `<button class="btn" id="next" type="button">Next</button>` : `<button class="btn" id="submit2" type="button">Submit exam</button>`}</div>
      </div>
      <aside class="exam-side card tight">
        <div class="row between"><span class="sub">Time left</span><span class="timer" id="timer">${fmtClock((deadline - Date.now()) / 1000)}</span></div>
        <div class="sub" style="margin:.8rem 0 .5rem">${answered}/${session.total} answered</div>
        <details class="pal-details" ${paletteOpen ? "open" : ""}><summary>Jump to question</summary>
        <div class="palette" role="navigation" aria-label="Question navigation">${session.items.map((x, i) => `<button type="button" data-go="${i}" class="${x.chosen !== null ? "answered" : ""} ${x.flagged ? "flagged" : ""} ${i === session.index ? "current" : ""}" aria-label="Question ${i + 1}${x.chosen !== null ? ", answered" : ""}${x.flagged ? ", flagged" : ""}">${i + 1}</button>`).join("")}</div>
        </details>
        <button class="btn wide" id="submit" type="button" style="margin-top:1rem">Submit exam</button>
      </aside>
    </div>`;
    el.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => { session.answer(Number(b.dataset.oi)); persist(); render(); }));
    el.querySelector("#flag").addEventListener("click", () => { it.flagged = !it.flagged; persist(); render(); });
    el.querySelector("#clear")?.addEventListener("click", () => { it.chosen = null; persist(); render(); });
    el.querySelector("#prev").addEventListener("click", () => go(session.index - 1));
    el.querySelector("#next")?.addEventListener("click", () => go(session.index + 1));
    el.querySelector("#submit").addEventListener("click", () => submit(false));
    el.querySelector("#submit2")?.addEventListener("click", () => submit(false));
    el.querySelector(".pal-details").addEventListener("toggle", (e) => { paletteOpen = e.target.open; });
    el.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => go(Number(b.dataset.go))));
  }

  const go = (i) => { session.go(i); persist(); render(); el.querySelector(".opt")?.focus(); };
  const persist = () => saveProgress(def, session, deadline);

  function updateTimer() {
    const left = (deadline - Date.now()) / 1000;
    const t = el.querySelector("#timer");
    if (t) { t.textContent = fmtClock(left); t.classList.toggle("low", left < 60); }
    if (left <= 0) submit(true);
  }

  function onKey(e) {
    if (e.target.matches("input, textarea") || document.querySelector(".modal-wrap")) return;
    const i = L.indexOf(e.key.toUpperCase());
    if (i > -1) el.querySelectorAll(".opt")[i]?.click();
    if (e.key === "ArrowRight") go(session.index + 1);
    if (e.key === "ArrowLeft") go(session.index - 1);
  }

  async function submit(auto) {
    if (submitting) return;
    if (!auto) {
      const un = session.items.filter((i) => i.chosen === null).length;
      const fl = session.items.filter((i) => i.flagged).length;
      const ok = await confirmBox("Submit exam?", `${un ? `${un} question${un > 1 ? "s are" : " is"} unanswered and will count as wrong. ` : "All questions answered. "}${fl ? `${fl} flagged. ` : ""}You can't change answers after submitting.`, "Submit exam");
      if (!ok) return;
    }
    submitting = true;
    cleanup();
    const id = await submitExam(def, session);
    if (auto) await modal({ title: "Time's up", body: "<p>Your exam was submitted automatically.</p>", actions: [{ id: "ok", label: "See results", primary: true }] });
    navigate(`/exam-result/${id}`, { replace: true });
  }

  function cleanup() { clearInterval(tick); document.removeEventListener("keydown", onKey); }

  if (existing && existing.def.id === def.id) {
    session = existing.session; deadline = existing.deadline;
    if (Date.now() >= deadline) { submit(true); return cleanup; }
    run();
  } else intro();

  return cleanup;
}
