import C from "../content.js";
import { esc, blocks } from "../components/ui.js";

export default function landing({ el }) {
  const sample = [1, .7, .4, .2, 0, 0];
  const lessons = C.modules.reduce((s, m) => s + m.lessons.length, 0);
  el.innerHTML = `
  <div class="landing">
    <header class="land-nav">
      <a class="brand" href="#/"><span class="brand-mark" aria-hidden="true"></span><span>DevPath</span></a>
      <div class="row"><a class="btn-ghost sm" href="#/login">Sign in</a><a class="btn sm" href="#/register">Create account</a></div>
    </header>
    <main>
      <section class="land-hero">
        <div>
          <h1>Become an AI and backend engineer, one block at a time.</h1>
          <p class="lead">A personal training system for Track A: ${C.modules.length} modules from Linux to networking, ${lessons} lessons, ${C.questions.length} MCQs, timed exams, a Logic Lab and a Coding Lab. It tells you what to study today, what you're weak at, and what to review — and it works offline.</p>
          <div class="row"><a class="btn" href="#/register">Start Track A</a><a class="btn-ghost" href="#/login">I have an account</a></div>
        </div>
        <div class="term" aria-label="Example of track progress after a few weeks">
          <div class="term-bar"><i></i><i></i><i></i></div>
          <div class="term-body">
            <div class="term-prompt">$ devpath status <b>--track backend</b></div>
            ${C.modules.slice(0, 6).map((m, i) => `<div class="term-line"><span>${esc(m.title)}</span>${blocks(sample[i], { segments: 10, label: m.title })}<span class="pc">${Math.round(sample[i] * 100)}%</span></div>`).join("")}
            <div class="term-prompt">weak: <b>postgres/joins 54%</b> · due for review: <b>6</b></div>
          </div>
        </div>
      </section>
      <section class="land-modules" aria-labelledby="mods">
        <h2 id="mods">The Track A route</h2>
        <p class="muted">Modules run in this order. Each one has lessons, MCQs, practice tasks, a mini quiz and a module exam.</p>
        <ol>${C.modules.map((m) => `<li><strong>${esc(m.title)}</strong><small>${m.lessons.length} lessons · ${C.questions.filter((q) => q.module === m.id).length} questions</small></li>`).join("")}</ol>
      </section>
    </main>
    <footer class="land-foot">Installable PWA · works offline · syncs with Firebase when you're back online</footer>
  </div>`;
}
