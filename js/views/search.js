import C, { moduleById } from "../content.js";
import { esc } from "../components/ui.js";

let index = null;
function build() {
  index = [];
  const add = (group, title, ctx, href, title_, body) => index.push({ group, title, ctx, href, t: (title_ || title).toLowerCase(), b: (body || "").toLowerCase() });
  for (const m of C.modules) {
    add("Modules", m.title, m.tagline, `#/module/${m.id}`, m.title, `${m.tagline} ${m.overview}`);
    for (const [name, desc] of m.concepts) add("Concepts", name, `${m.title}: ${desc}`, `#/module/${m.id}`, name, desc);
    for (const l of m.lessons) {
      add("Lessons", `${m.title} → ${l.title}`, l.summary, `#/lesson/${l.id}`, l.title, `${l.summary} ${l.simple} ${l.technical} ${l.terms.map((t) => t.join(" ")).join(" ")}`);
      for (const [term, def] of l.terms) add("Concepts", term, `${m.title} → ${l.title}: ${def}`, `#/lesson/${l.id}`, term, def);
    }
  }
  for (const q of C.questions) add("MCQs", q.question, `${moduleById(q.module)?.title} · ${q.topic}`, `#/practice?ids=${q.id}&start=1&label=Search%20result`, q.question, `${q.topic} ${q.options.join(" ")} ${q.explanation}`);
  for (const q of C.logic) add("Logic practice", q.title, q.category, `#/logic?id=${q.id}`, `${q.title} ${q.question}`, `${q.category} ${q.code || ""} ${q.explanation}`);
  for (const c of C.coding) add("Coding challenges", c.title, c.category, `#/coding/${c.id}`, c.title, `${c.statement} ${c.category}`);
}

export function search(q) {
  if (!index) build();
  const terms = q.toLowerCase().split(/\s+/).filter((t) => t.length > 1).slice(0, 6);
  if (!terms.length) return [];
  const out = [];
  for (const it of index) {
    let score = 0;
    for (const t of terms) {
      if (it.t.includes(t)) score += it.t.startsWith(t) || it.t.includes(` ${t}`) ? 6 : 4;
      else if (it.b.includes(t)) score += 1;
      else { score = 0; break; }
    }
    if (score) out.push({ ...it, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

const hl = (text, terms) => {
  let s = esc(text);
  for (const t of terms) s = s.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>");
  return s;
};

export default function searchView({ el, query }) {
  const q = (query.q || "").slice(0, 80);
  el.innerHTML = `
  <div class="page-head"><div><h1>Search</h1></div></div>
  <form id="sf" role="search" style="margin-bottom:1.5rem"><label for="sq" class="sr-only">Search</label>
    <div class="row"><input id="sq" type="text" value="${esc(q)}" placeholder="Try: decorator, JOIN, CIDR, chmod" maxlength="80" style="flex:1"><button class="btn" type="submit">Search</button></div></form>
  <div id="res" aria-live="polite"></div>`;
  const res = el.querySelector("#res");
  const paint = (text) => {
    if (!text.trim()) { res.innerHTML = `<p class="muted">Search across modules, lessons, concepts, MCQs, Logic Lab and Coding Lab.</p>`; return; }
    const terms = text.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    const r = search(text);
    if (!r.length) { res.innerHTML = `<p class="muted">No results for "${esc(text)}". Try a shorter or different term.</p>`; return; }
    const groups = ["Lessons", "Concepts", "Modules", "MCQs", "Logic practice", "Coding challenges"];
    res.innerHTML = `<p class="sub">${r.length} results</p>` + groups.map((g) => {
      const items = r.filter((x) => x.group === g);
      const seen = new Set();
      const uniq = items.filter((x) => { const k = x.title + x.href; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
      return uniq.length ? `<div class="result-group"><h2>${g} <span class="sub">(${items.length})</span></h2>${uniq.map((x) => `<a class="result" href="${x.href}"><strong>${hl(x.title.length > 140 ? x.title.slice(0, 140) + "…" : x.title, terms)}</strong><small>${hl((x.ctx || "").slice(0, 160), terms)}</small></a>`).join("")}</div>` : "";
    }).join("");
  };
  el.querySelector("#sf").addEventListener("submit", (e) => { e.preventDefault(); const v = el.querySelector("#sq").value.trim(); history.replaceState(null, "", `#/search?q=${encodeURIComponent(v)}`); paint(v); });
  let t; el.querySelector("#sq").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => paint(e.target.value), 200); });
  paint(q);
  if (!q) el.querySelector("#sq").focus();
  const top = document.getElementById("searchInput"); if (top) top.value = q;
}
