// Exam engine. An in-progress exam is checkpointed to localStorage on every
// change, so a reload, crash or lost connection never loses it, and the
// deadline is absolute, so reloading doesn't reset the clock.
import C from "./content.js";
import * as db from "./db.js";
import { Session, pick, pickBalanced, updateReview } from "./quiz.js";
import { currentUser } from "./auth.js";
import { APP } from "./config.js";

const key = () => `devpath:exam:${currentUser()?.uid}`;
export const examDef = (id) => C.exams.find((e) => e.id === id);

export function buildExam(def) {
  const pool = def.scope === "track" ? C.questions : C.questions.filter((q) => q.module === def.module);
  const qs = def.scope === "track" ? pickBalanced(pool, def.count) : pick(pool, { count: def.count });
  return new Session(qs, { shuffleOptions: true });
}

export function saveProgress(def, session, deadline) {
  localStorage.setItem(key(), JSON.stringify({ examId: def.id, deadline, session: session.toJSON() }));
}
export function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(key()) || "null");
    if (!raw || !examDef(raw.examId)) return null;
    const session = Session.fromJSON(raw.session);
    return session ? { def: examDef(raw.examId), session, deadline: raw.deadline } : null;
  } catch { return null; }
}
export const clearProgress = () => localStorage.removeItem(key());

export async function submitExam(def, session) {
  const id = db.uuid();
  const answers = session.items.map((it) => ({ qid: it.q.id, chosen: it.chosen, ms: Math.round(it.ms) }));
  const durationSec = Math.min(Math.round((Date.now() - session.startedAt) / 1000), def.minutes * 60);
  await db.put("examAttempts", id, {
    examId: def.id, title: def.title, scope: def.scope, moduleId: def.module || null,
    answers, total: answers.length, durationSec, timeLimitSec: def.minutes * 60,
    passPercent: def.passPercent || APP.passPercent, createdAt: Date.now()
  });
  await updateReview(answers, false);
  clearProgress();
  return id;
}
