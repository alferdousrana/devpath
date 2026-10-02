import C, { lessonInfo } from "../content.js";
import * as db from "../db.js";
import { completeLesson, isDone, stats } from "../progress.js";
import { esc, md, inline, codeBlock, blocks, icon, empty, toast } from "../components/ui.js";
import * as bm from "../bookmarks.js";

export default function lessonView({ el, params, navigate }) {
  const info = lessonInfo(params.id);
  if (!info) { el.innerHTML = empty("Lesson not found", "It may have moved.", `<a class="btn" href="#/path">Open learning path</a>`); return; }
  const { lesson: l, module: m, index } = info;
  const total = m.lessons.length;
  const prev = m.lessons[index - 1], next = m.lessons[index + 1];
  const nextModule = !next ? C.modules[C.modules.indexOf(m) + 1] : null;
  const qCount = C.questions.filter((q) => q.lesson === l.id).length;
  const note = db.get("notes", l.id)?.text || "";
  const done = isDone(l.id);
  const doneInModule = m.lessons.filter((x) => isDone(x.id)).length;

  const sections = [
    ["simple", "Simple explanation", md(l.simple)],
    ["technical", "Technical explanation", md(l.technical)],
    ["analogy", "Real-world analogy", `<div class="callout">${md(l.analogy)}</div>`],
    ["example", "Example", `${codeBlock(l.example.code, l.example.lang)}${md(l.example.explain)}`],
    ["terms", "Important terms", `<dl class="terms">${l.terms.map(([t, d]) => `<div><dt>${inline(t)}</dt><dd>${inline(d)}</dd></div>`).join("")}</dl>`],
    ["remember", "What you must remember", `<div class="callout pass"><ul>${l.remember.map((x) => `<li>${inline(x)}</li>`).join("")}</ul></div>`],
    ["mistakes", "Common mistakes", `<div class="callout warn"><ul>${l.mistakes.map((x) => `<li>${inline(x)}</li>`).join("")}</ul></div>`],
    ["interview", "Interview questions", `<ol>${l.interview.map((x) => `<li>${inline(x)}</li>`).join("")}</ol><p class="sub">Answer out loud or in your notes before checking the lesson again. Explaining is the test.</p>`],
    ["practice", "Practice questions", `<ol>${l.practice.map((x) => `<li>${inline(x)}</li>`).join("")}</ol>
      ${qCount ? `<a class="btn-ghost" href="#/practice?lesson=${l.id}&start=1">Answer ${qCount} MCQs on this lesson</a>` : ""}`]
  ];

  el.innerHTML = `
  <div class="crumbs"><a href="#/path">Path</a><span>/</span><a href="#/module/${m.id}">${esc(m.title)}</a><span>/</span><span>Lesson ${index + 1}</span></div>
  <div class="page-head">
    <div><h1>${esc(l.title)}</h1><p>${esc(l.summary)}</p></div>
    <div class="row">${bm.button("lesson", l.id, "Bookmark")}</div>
  </div>
  <div class="card tight" style="margin-bottom:1.5rem">
    <div class="row between sub"><span>Lesson ${index + 1} of ${total} · about ${l.minutes} min</span><span>${doneInModule}/${total} done in module</span></div>
    ${blocks((index + 1) / total, { segments: total, label: `Lesson ${index + 1} of ${total}` })}
  </div>
  <div class="lesson-wrap">
    <article class="lesson-body">
      ${sections.map(([id, title, body]) => `<section id="s-${id}" aria-labelledby="h-${id}"><h2 id="h-${id}">${title}</h2>${body}</section>`).join("")}
      <div class="lesson-foot">
        ${prev ? `<a class="btn-ghost" href="#/lesson/${prev.id}">Previous: ${esc(prev.title)}</a>` : `<a class="btn-ghost" href="#/module/${m.id}">Module overview</a>`}
        <button class="btn ${done ? "pass" : ""}" id="complete" type="button" ${done ? "disabled" : ""}>${done ? `${icon("check", "sm")} Completed` : "Mark as complete"}</button>
        ${next ? `<a class="btn-ghost" href="#/lesson/${next.id}">Next: ${esc(next.title)}</a>` : nextModule ? `<a class="btn-ghost" href="#/module/${nextModule.id}">Next module: ${esc(nextModule.title)}</a>` : `<a class="btn-ghost" href="#/exams">Exam center</a>`}
      </div>
    </article>
    <aside class="lesson-aside">
      <nav class="card tight toc" aria-label="On this page"><strong>On this page</strong>${sections.map(([id, t]) => `<a href="#/lesson/${l.id}" data-jump="s-${id}">${t}</a>`).join("")}</nav>
      <section class="card tight" aria-labelledby="note-h">
        <h3 id="note-h">${icon("note", "sm")} Personal note</h3>
        <label for="note" class="sr-only">Personal note for this lesson</label>
        <textarea id="note" maxlength="20000" placeholder="Write it in your own words. Notes save on this device instantly and sync when online.">${esc(note)}</textarea>
        <div class="sub" id="noteState">${note ? "Saved" : ""}</div>
      </section>
      <section class="card tight"><h3>After this lesson</h3>
        <a class="btn-ghost sm wide" href="#/practice?module=${m.id}&count=5&mode=mini&start=1">Take a 5-question mini quiz</a></section>
    </aside>
  </div>`;

  bm.wire(el, "Bookmark");
  el.querySelectorAll("[data-jump]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById(a.dataset.jump)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }));

  el.querySelector("#complete").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    await completeLesson(l.id);
    b.classList.add("pass");
    b.innerHTML = `${icon("check", "sm")} Completed`;
    const s = stats();
    const mod = s.modules.find((x) => x.id === m.id);
    toast(mod.completed === mod.total ? `${m.title}: all lessons complete. Try the module exam.` : "Lesson complete.", { type: "ok" });
  });

  const ta = el.querySelector("#note"), state = el.querySelector("#noteState");
  let t = null;
  const save = async () => {
    const text = ta.value.slice(0, 20000);
    if (text === (db.get("notes", l.id)?.text || "")) return;
    await db.put("notes", l.id, { text, lessonId: l.id, moduleId: m.id });
    state.textContent = navigator.onLine ? "Saved" : "Saved on this device · will sync";
  };
  ta.addEventListener("input", () => { state.textContent = "Saving…"; clearTimeout(t); t = setTimeout(save, 600); });
  return () => { clearTimeout(t); save(); };
}
