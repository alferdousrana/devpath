// Small, dependency-free UI helpers. All dynamic text goes through esc().
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const pct = (x) => `${Math.round((x || 0) * 100)}%`;

export function fmtDuration(sec) {
  sec = Math.round(sec || 0);
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}h ${m}m` : `${m}m${s && m < 10 ? ` ${s}s` : ""}`;
}
export const fmtClock = (sec) => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; };
export const fmtDate = (ts) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
export const fmtRel = (ts) => {
  const d = Date.now() - ts;
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d / 60000)} min ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)} h ago`;
  return fmtDate(ts);
};

// Segmented progress: the visual signature of the app (████░░░░).
export function blocks(value, { segments = 12, label = "", size = "" } = {}) {
  const v = Math.max(0, Math.min(1, value || 0));
  const filled = v > 0 ? Math.max(1, Math.round(v * segments)) : 0;
  let segs = "";
  for (let i = 0; i < segments; i++) segs += `<i class="${i < filled ? "on" : ""}" style="--i:${i}"></i>`;
  return `<div class="blocks ${size}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(v * 100)}" aria-label="${esc(label || "Progress")}">${segs}</div>`;
}

export const diffChip = (d) => `<span class="chip diff-${esc(d)}">${esc(d ? d[0].toUpperCase() + d.slice(1) : "")}</span>`;

// Markdown-lite for lesson text: paragraphs, lists, `code`, **bold**, ```fences```.
export function md(src) {
  if (!src) return "";
  const out = [];
  const blocksArr = String(src).split(/```/);
  blocksArr.forEach((chunk, i) => {
    if (i % 2 === 1) {
      const nl = chunk.indexOf("\n");
      const lang = nl > -1 ? chunk.slice(0, nl).trim() : "";
      const code = nl > -1 ? chunk.slice(nl + 1) : chunk;
      out.push(codeBlock(code.replace(/\n$/, ""), lang));
      return;
    }
    for (const para of chunk.split(/\n{2,}/)) {
      const p = para.trim();
      if (!p) continue;
      const lines = p.split("\n");
      if (lines.every((l) => /^\s*[-*] /.test(l))) out.push(`<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ""))}</li>`).join("")}</ul>`);
      else if (lines.every((l) => /^\s*\d+\. /.test(l))) out.push(`<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+\. /, ""))}</li>`).join("")}</ol>`);
      else out.push(`<p>${inline(lines.join(" "))}</p>`);
    }
  });
  return out.join("");
}
export function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
export function codeBlock(code, lang = "") {
  return `<div class="code"><div class="code-bar"><span>${esc(lang || "text")}</span><button class="btn-ghost sm" data-copy type="button">Copy</button></div><pre><code>${esc(code)}</code></pre></div>`;
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-copy]");
  if (!b) return;
  const code = b.closest(".code")?.querySelector("code")?.textContent || "";
  navigator.clipboard?.writeText(code).then(() => { b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1400); });
});

// Toasts
export function toast(msg, { type = "info", ms = 3200 } = {}) {
  const host = document.getElementById("toasts");
  if (!host) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, ms);
}

export function xpBurst(n) {
  if (!n) return;
  const el = document.createElement("div");
  el.className = "xp-burst";
  el.textContent = `+${n} XP`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

export function achievementPop(a) {
  const el = document.createElement("div");
  el.className = "ach-pop";
  el.setAttribute("role", "status");
  el.innerHTML = `<div class="ach-icon">${esc(a.icon)}</div><div><strong>${esc(a.title)}</strong><span>${esc(a.description)}</span></div>`;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 400); }, 4200);
}

// Modal with focus trap. Returns a promise resolving to the clicked action.
export function modal({ title, body, actions = [{ id: "ok", label: "OK", primary: true }] }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const wrap = document.createElement("div");
    wrap.className = "modal-wrap";
    wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title">
      <h2 id="m-title">${esc(title)}</h2><div class="modal-body">${body}</div>
      <div class="modal-actions">${actions.map((a) => `<button type="button" class="${a.primary ? "btn" : a.danger ? "btn danger" : "btn-ghost"}" data-act="${esc(a.id)}">${esc(a.label)}</button>`).join("")}</div></div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add("in"));
    const close = (v) => { wrap.classList.remove("in"); setTimeout(() => wrap.remove(), 200); prev?.focus?.(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => {
      if (e.key === "Escape") close(null);
      if (e.key === "Tab") {
        const f = $$("button, input, textarea, select, a[href]", wrap);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(null); const b = e.target.closest("[data-act]"); if (b) close(b.dataset.act); });
    ($("[data-act].btn", wrap) || $("[data-act]", wrap))?.focus();
  });
}
export const confirmBox = (title, body, label = "Continue", danger = false) =>
  modal({ title, body: `<p>${esc(body)}</p>`, actions: [{ id: "cancel", label: "Cancel" }, { id: "yes", label, primary: !danger, danger }] }).then((v) => v === "yes");

export const empty = (title, text, action = "") => `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
export const skeleton = (n = 3) => `<div class="skel-wrap">${'<div class="skel"></div>'.repeat(n)}</div>`;

// Minimal inline SVG icon set (stroke icons, 24px grid).
const P = {
  today: "M4 5h16v15H4zM4 9h16M8 3v4M16 3v4M8 13h3v3H8z",
  path: "M6 3v18M6 7h8a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h9",
  quiz: "M9 9a3 3 0 1 1 4 2.8c-.8.4-1 1-1 1.7V15M12 18h.01M4 4h16v16H4z",
  exam: "M7 3h10l3 3v15H4V3zM8 9h8M8 13h8M8 17h5",
  logic: "M12 3a6 6 0 0 0-3 11.2V17h6v-2.8A6 6 0 0 0 12 3zM9.5 20h5",
  code: "M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14",
  review: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l3 2",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  award: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14 7 22l5-3 5 3-1.5-8",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  sync: "M20 7a8 8 0 0 0-14.6-1M4 3v4h4M4 17a8 8 0 0 0 14.6 1M20 21v-4h-4",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  check: "M5 12l5 5L20 7",
  x: "M6 6l12 12M18 6 6 18",
  flag: "M5 21V4h11l-1.5 4L16 12H5",
  note: "M4 4h12l4 4v12H4zM8 12h8M8 16h5",
  out: "M15 4h4v16h-4M10 17l5-5-5-5M15 12H3",
  fire: "M12 22c4 0 7-3 7-7 0-4-3-6-4-9-1 2-2 3-4 3 0-2 0-4-2-6-1 4-4 6-4 12 0 4 3 7 7 7z",
  arrow: "M5 12h14M13 6l6 6-6 6"
};
export const icon = (name, cls = "") => `<svg class="ic ${cls === "sm" ? "ic-sm" : cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${P[name] || P.more}"/></svg>`;
