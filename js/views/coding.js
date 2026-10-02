import C, { moduleById } from "../content.js";
import * as db from "../db.js";
import { esc, diffChip, blocks } from "../components/ui.js";

const CATS = [["all", "All"], ["python", "Python"], ["algorithm", "Algorithms"], ["backend", "Backend"], ["sql", "SQL"]];

export default function coding({ el, query }) {
  const cat = query.category || "all";
  const status = (id) => db.get("coding", id)?.status;
  const solved = C.coding.filter((c) => status(c.id) === "solved").length;
  const list = C.coding.filter((c) => cat === "all" || c.category === cat);
  el.innerHTML = `
  <div class="page-head"><div><h1>Coding Lab</h1><p>Write real solutions against real test cases. Your code is saved as a draft on this device and synced. Automatic test running isn't connected yet; check your solution against the listed tests or run it locally.</p></div>
    <div style="min-width:220px"><div class="row between sub"><span>Solved</span><strong>${solved}/${C.coding.length}</strong></div>${blocks(solved / Math.max(1, C.coding.length), { segments: 12, label: "Coding solved" })}</div></div>
  <div class="seg" role="group" aria-label="Category" style="margin-bottom:1.2rem">${CATS.map(([v, t]) => `<button type="button" data-c="${v}" aria-pressed="${cat === v}">${t} (${v === "all" ? C.coding.length : C.coding.filter((c) => c.category === v).length})</button>`).join("")}</div>
  <div class="card"><div class="list">${list.map((c) => `
    <div class="list-item"><div class="grow"><a class="title" href="#/coding/${c.id}">${esc(c.title)}</a><div class="sub">${esc(c.category[0].toUpperCase() + c.category.slice(1))}${c.module ? ` · ${esc(moduleById(c.module)?.title || "")}` : ""}</div></div>
      ${status(c.id) === "solved" ? `<span class="chip ok">Solved</span>` : status(c.id) ? `<span class="chip">Attempted</span>` : ""}${diffChip(c.difficulty)}</div>`).join("")}</div></div>`;
  el.querySelector(".seg").addEventListener("click", (e) => { const b = e.target.closest("[data-c]"); if (b) location.hash = `#/coding?category=${b.dataset.c}`; });
}
