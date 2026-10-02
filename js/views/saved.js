import C, { lessonInfo, question, moduleById } from "../content.js";
import * as bm from "../bookmarks.js";
import { esc, empty, inline } from "../components/ui.js";

export default function saved({ el }) {
  const items = bm.saved();
  const lessons = items.filter((b) => b.type === "lesson" && lessonInfo(b.refId));
  const qs = items.filter((b) => b.type === "question" && question(b.refId));
  const code = items.filter((b) => b.type === "coding" && C.codingMap.get(b.refId));
  if (!lessons.length && !qs.length && !code.length) {
    el.innerHTML = `<div class="page-head"><div><h1>Saved</h1></div></div>` + empty("Nothing saved yet", "Use the Bookmark button on lessons, questions and coding challenges to collect them here.", `<a class="btn" href="#/path">Browse lessons</a>`);
    return;
  }
  el.innerHTML = `
  <div class="page-head"><div><h1>Saved</h1><p>Your bookmarks, synced across devices.</p></div>${qs.length ? `<a class="btn" href="#/practice?ids=${qs.map((b) => b.refId).join(",")}&start=1&label=Saved%20questions">Practice saved questions</a>` : ""}</div>
  <div class="grid g2">
    <section class="card"><h2>Lessons (${lessons.length})</h2><div class="list">${lessons.map((b) => { const i = lessonInfo(b.refId); return `<div class="list-item"><div class="grow"><a class="title" href="#/lesson/${i.lesson.id}">${esc(i.lesson.title)}</a><div class="sub">${esc(i.module.title)}</div></div>${bm.button("lesson", i.lesson.id, "Bookmark")}</div>`; }).join("") || `<p class="muted">None.</p>`}</div></section>
    <section class="card"><h2>Coding challenges (${code.length})</h2><div class="list">${code.map((b) => { const c = C.codingMap.get(b.refId); return `<div class="list-item"><div class="grow"><a class="title" href="#/coding/${c.id}">${esc(c.title)}</a></div>${bm.button("coding", c.id, "Bookmark")}</div>`; }).join("") || `<p class="muted">None.</p>`}</div></section>
    <section class="card span2"><h2>Questions (${qs.length})</h2><div class="list">${qs.map((b) => { const q = question(b.refId); return `<div class="list-item"><div class="grow"><span>${inline(q.question.slice(0, 140))}</span><div class="sub">${esc(moduleById(q.module)?.title || q.category)}</div></div>${bm.button("question", q.id)}</div>`; }).join("") || `<p class="muted">None.</p>`}</div></section>
  </div>`;
  bm.wire(el);
}
