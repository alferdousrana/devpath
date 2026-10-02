// ---------------------------------------------------------------------------
// Quiz engine shared by MCQ practice, mini quizzes, reviews, Logic Lab and
// exams. A session holds questions with a per-question option shuffle; answers
// are always recorded as the ORIGINAL option index so grading stays stable.
// ---------------------------------------------------------------------------
import * as db from "./db.js";
import C, { question } from "./content.js";
import { REVIEW_INTERVALS } from "./config.js";

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function pick(pool, { count = 10, difficulty = "all", topic = null } = {}) {
  let p = pool;
  if (difficulty !== "all") p = p.filter((q) => q.difficulty === difficulty);
  if (topic) p = p.filter((q) => q.topic === topic);
  return shuffle(p).slice(0, count);
}

// Spread picks evenly across modules (used for mixed quizzes and track exams).
export function pickBalanced(pool, count) {
  const byMod = new Map();
  for (const q of shuffle(pool)) { if (!byMod.has(q.module)) byMod.set(q.module, []); byMod.get(q.module).push(q); }
  const out = [];
  const lists = [...byMod.values()];
  while (out.length < count && lists.some((l) => l.length)) for (const l of lists) if (l.length && out.length < count) out.push(l.pop());
  return shuffle(out);
}

export class Session {
  constructor(questions, { shuffleOptions = false } = {}) {
    this.items = questions.map((q) => ({
      q,
      order: shuffleOptions ? shuffle(q.options.map((_, i) => i)) : q.options.map((_, i) => i),
      chosen: null, ms: 0, flagged: false, explanation: ""
    }));
    this.index = 0;
    this.startedAt = Date.now();
    this.shownAt = Date.now();
  }
  get current() { return this.items[this.index]; }
  get total() { return this.items.length; }
  answer(originalIndex) {
    const it = this.current;
    it.ms += Date.now() - this.shownAt; this.shownAt = Date.now();
    it.chosen = originalIndex;
    return originalIndex === it.q.correctAnswer;
  }
  go(i) {
    if (i < 0 || i >= this.total) return;
    this.current.ms += Date.now() - this.shownAt;
    this.index = i; this.shownAt = Date.now();
  }
  answersPayload() {
    return this.items.map((it) => ({ qid: it.q.id, chosen: it.chosen, ms: Math.round(it.ms), ...(it.explanation ? { explanation: it.explanation.slice(0, 2000) } : {}) }));
  }
  get durationSec() { return Math.round((Date.now() - this.startedAt) / 1000); }
  toJSON() { return { ids: this.items.map((i) => i.q.id), items: this.items.map(({ order, chosen, ms, flagged }) => ({ order, chosen, ms, flagged })), index: this.index, startedAt: this.startedAt }; }
  static fromJSON(o) {
    const qs = o.ids.map(question).filter(Boolean);
    if (qs.length !== o.ids.length) return null;
    const s = new Session(qs);
    s.items.forEach((it, i) => Object.assign(it, o.items[i]));
    s.index = o.index; s.startedAt = o.startedAt; s.shownAt = Date.now();
    return s;
  }
}

// Persist a finished practice/review/mini quiz. mode: practice | mini | review | mixed
export async function saveQuiz(session, { mode, moduleId = null, label = "" }) {
  const id = db.uuid();
  const answers = session.answersPayload();
  await db.put("quizAttempts", id, { mode, moduleId, label: label.slice(0, 120), answers, durationSec: session.durationSec, createdAt: Date.now() });
  await updateReview(answers, mode === "review");
  return id;
}

export async function saveLogic(session) {
  const id = db.uuid();
  const answers = session.answersPayload();
  await db.put("logicAttempts", id, { answers, durationSec: session.durationSec, createdAt: Date.now() });
  await updateReview(answers, false);
  return id;
}

// Leitner-style spaced review over questions you got wrong.
export async function updateReview(answers, isReview) {
  const day = 86400000;
  for (const a of answers) {
    const q = question(a.qid);
    if (!q || a.chosen === null || a.chosen === undefined) continue;
    const ok = a.chosen === q.correctAnswer;
    const w = db.get("wrongAnswers", q.id);
    if (!ok) {
      await db.put("wrongAnswers", q.id, {
        module: q.module || "logic", topic: q.topic || q.category, box: 0,
        due: Date.now() + REVIEW_INTERVALS[0] * day, wrongCount: (w?.wrongCount || 0) + 1,
        lastWrongAt: Date.now(), resolved: false
      });
    } else if (w && !w.resolved && (isReview || w.due <= Date.now())) {
      const box = (w.box || 0) + 1;
      const resolved = box >= REVIEW_INTERVALS.length;
      await db.put("wrongAnswers", q.id, { ...w, box, resolved, due: resolved ? null : Date.now() + REVIEW_INTERVALS[box] * day });
    }
  }
}

export const reviewQueue = () => db.list("wrongAnswers").filter((w) => !w.resolved && question(w.id));
export const dueReviews = () => reviewQueue().filter((w) => (w.due || 0) <= Date.now()).sort((a, b) => a.due - b.due);

export const mcqPool = () => C.questions;
