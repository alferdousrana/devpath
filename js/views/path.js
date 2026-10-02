import C from "../content.js";
import { stats } from "../progress.js";
import { esc, blocks, pct } from "../components/ui.js";

export default function pathView({ el }) {
  const s = stats();
  const currentId = s.next?.module.id;
  el.innerHTML = `
  <div class="page-head"><div><h1>Learning path</h1><p>Track A: AI / Backend Engineer. Modules build on each other in this order, but nothing is locked — jump ahead if you already know something.</p></div>
    <div style="min-width:220px"><div class="row between sub"><span>Overall</span><strong>${pct(s.overall)}</strong></div>${blocks(s.overall, { segments: 12, label: "Overall" })}</div></div>
  <ol class="route" aria-label="Modules in order">
    ${C.modules.map((m, i) => {
      const ms = s.modules[i];
      const cls = ms.completed === ms.total ? "done" : ms.completed ? "started" : "";
      return `<li class="station ${cls} ${m.id === currentId ? "current" : ""}" data-n="${i + 1}" style="list-style:none">
        <a class="card card-link" href="#/module/${m.id}">
          <div><h3 style="margin:0">${esc(m.title)}</h3><p class="sub" style="margin:.2rem 0 0">${esc(m.tagline)}</p></div>
          <div class="meta">${m.id === currentId ? `<span class="chip ok">Up next</span>` : ""}${ms.passedExam ? `<span class="chip ok">Exam passed</span>` : ""}<span>${ms.completed}/${ms.total} lessons</span>${ms.accuracy !== null ? `<span>${pct(ms.accuracy)} accuracy</span>` : ""}</div>
          ${blocks(ms.pct, { segments: 16, label: `${m.title} progress` })}
        </a></li>`;
    }).join("")}
  </ol>
  <h2 style="margin-top:2.5rem">Future tracks</h2>
  <div class="grid g4">${C.tracks.filter((t) => t.status !== "active").map((t) => `<div class="card tight"><strong>Track ${esc(t.code)}: ${esc(t.title)}</strong><p class="sub" style="margin:.3rem 0 0">${esc(t.description)}</p></div>`).join("")}</div>`;
}
