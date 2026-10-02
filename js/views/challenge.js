import C from "../content.js";
import * as db from "../db.js";
import { run } from "../coding/runner.js";
import { esc, md, inline, codeBlock, diffChip, empty, toast, confirmBox } from "../components/ui.js";
import * as bm from "../bookmarks.js";

export default function challenge({ el, params }) {
  const c = C.codingMap.get(params.id);
  if (!c) { el.innerHTML = empty("Challenge not found", "", `<a class="btn" href="#/coding">Coding Lab</a>`); return; }
  const rec = db.get("coding", c.id) || {};
  let hintsShown = rec.hintsShown || 0;
  const lang = c.category === "sql" ? "sql" : "python";

  el.innerHTML = `
  <div class="crumbs"><a href="#/coding">Coding Lab</a><span>/</span><span>${esc(c.category)}</span></div>
  <div class="page-head"><div><h1>${esc(c.title)}</h1><div class="row">${diffChip(c.difficulty)}${rec.status === "solved" ? `<span class="chip ok">Solved</span>` : ""}</div></div>${bm.button("coding", c.id, "Bookmark")}</div>
  <div class="grid g2">
    <section class="card"><h2>Problem</h2>${md(c.statement)}
      <h3>Examples</h3>${c.examples.map((x) => `<div class="hint"><div class="sub">Input</div><code>${esc(x.input)}</code><div class="sub" style="margin-top:.4rem">Output</div><code>${esc(x.output)}</code>${x.explain ? `<p class="sub" style="margin:.4rem 0 0">${inline(x.explain)}</p>` : ""}</div>`).join("")}
      <h3>Expected behavior</h3>${md(c.expected)}
      <h3>Test cases</h3><div class="table-wrap"><table><thead><tr><th>Input</th><th>Expected</th></tr></thead><tbody>${c.tests.map((t) => `<tr><td><code>${esc(t.input)}</code></td><td><code>${esc(t.expected)}</code></td></tr>`).join("")}</tbody></table></div>
    </section>
    <section class="stack">
      <div class="card">
        <label for="code">Your solution (${lang})</label>
        <textarea id="code" class="editor" spellcheck="false" autocapitalize="off" autocomplete="off">${esc(rec.draft ?? c.starter)}</textarea>
        <div class="row between" style="margin-top:.6rem"><span class="sub" id="saveState">${rec.draft ? "Draft saved" : ""}</span>
          <div class="row"><button class="btn-ghost sm" id="reset" type="button">Reset to starter</button><button class="btn-ghost sm" id="runBtn" type="button">Run tests</button></div></div>
        <div id="runOut" class="runner-box" style="margin-top:.8rem" hidden></div>
      </div>
      <div class="card"><h3>Hints</h3><div id="hints"></div><button class="btn-ghost sm" id="hintBtn" type="button">Show a hint</button></div>
      <div class="card"><h3>Self-check</h3><p class="sub">Walk through every test case by hand (or run it locally). Mark solved only when all of them pass, including the edge cases.</p>
        <div class="row"><button class="btn ${rec.status === "solved" ? "pass" : ""}" id="solved" type="button">${rec.status === "solved" ? "Solved" : "Mark as solved"}</button><button class="btn-ghost" id="showSol" type="button">Show solution</button></div>
        <div id="sol" hidden style="margin-top:1rem">${codeBlock(c.solution.code, c.solution.lang)}${md(c.explanation)}</div></div>
    </section>
  </div>`;

  bm.wire(el);
  const ta = el.querySelector("#code"), st = el.querySelector("#saveState");
  let t = null;
  const saveDraft = async () => {
    const cur = db.get("coding", c.id) || {};
    if (cur.draft === ta.value) return;
    await db.put("coding", c.id, { ...cur, draft: ta.value.slice(0, 50000), status: cur.status || "attempted" });
    st.textContent = "Draft saved";
  };
  ta.addEventListener("input", () => { st.textContent = "Saving…"; clearTimeout(t); t = setTimeout(saveDraft, 800); });
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText("    ", s, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); }
    if (e.key === "Escape") ta.blur(); // keyboard users can leave the editor
  });
  el.querySelector("#reset").addEventListener("click", async () => { if (await confirmBox("Reset code?", "Your draft will be replaced with the starter code.", "Reset")) { ta.value = c.starter; saveDraft(); } });
  el.querySelector("#runBtn").addEventListener("click", async () => {
    const out = el.querySelector("#runOut");
    const r = await run({ language: lang, code: ta.value, tests: c.tests });
    out.hidden = false;
    out.innerHTML = r.supported
      ? r.results.map((x) => `<div class="kv"><span>${esc(x.name)}</span><span class="acc ${x.passed ? "good" : "bad"}">${x.passed ? "Pass" : "Fail"}</span></div>`).join("")
      : `<strong>Test runner not connected.</strong><p style="margin:.3rem 0 0">${esc(r.reason)} See <code>js/coding/runner.js</code> for how to add Pyodide or a sandbox API.</p>`;
  });
  const hints = el.querySelector("#hints"), hb = el.querySelector("#hintBtn");
  const paintHints = () => {
    hints.innerHTML = c.hints.slice(0, hintsShown).map((h, i) => `<div class="hint"><strong>Hint ${i + 1}.</strong> ${inline(h)}</div>`).join("");
    hb.hidden = hintsShown >= c.hints.length;
    hb.textContent = hintsShown ? "Show next hint" : "Show a hint";
  };
  hb.addEventListener("click", async () => { hintsShown++; paintHints(); const cur = db.get("coding", c.id) || {}; await db.put("coding", c.id, { ...cur, hintsShown, status: cur.status || "attempted" }); });
  paintHints();
  el.querySelector("#showSol").addEventListener("click", async (e) => {
    const sol = el.querySelector("#sol");
    if (sol.hidden && !(db.get("coding", c.id)?.status === "solved") && !(await confirmBox("Show the solution?", "Try at least one more hint first. Reading a solution is useful, but it isn't the same as solving it.", "Show solution"))) return;
    sol.hidden = !sol.hidden; e.target.textContent = sol.hidden ? "Show solution" : "Hide solution";
  });
  el.querySelector("#solved").addEventListener("click", async (e) => {
    const cur = db.get("coding", c.id) || {};
    if (cur.status === "solved") return;
    await db.put("coding", c.id, { ...cur, draft: ta.value.slice(0, 50000), status: "solved", solvedAt: Date.now() });
    e.target.classList.add("pass"); e.target.textContent = "Solved";
    toast("Marked as solved.", { type: "ok" });
  });
  return () => { clearTimeout(t); saveDraft(); };
}
