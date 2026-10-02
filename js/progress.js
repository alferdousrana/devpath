// ---------------------------------------------------------------------------
// Progress engine. Everything here is DERIVED from the raw activity log
// (lesson completions + immutable attempts). Scores are re-graded against the
// answer key on every read instead of trusting a stored number, and XP/streaks
// can't drift between devices because they're never stored as counters.
// ---------------------------------------------------------------------------
import * as db from "./db.js";
import C, { question, lessonInfo } from "./content.js";
import { XP, APP, DEFAULT_GOALS } from "./config.js";

let cache = null;
db.onWriteSync(() => { cache = null; });
export const invalidate = () => { cache = null; };

export const dayKey = (ts = Date.now()) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const weekKey = (ts = Date.now()) => {
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return dayKey(d.getTime());
};
const addDays = (ts, n) => { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); };

export function levelFor(xp) {
  let L = 1;
  while (50 * (L + 1) * L <= xp) L++;
  const floor = 50 * L * (L - 1), next = 50 * (L + 1) * L;
  return { level: L, floor, next, pct: (xp - floor) / (next - floor) };
}

export function goals() {
  const p = db.get("profile", "main");
  return { ...DEFAULT_GOALS, ...(p?.goals || {}) };
}

export function gradeAnswers(answers) {
  let correct = 0, wrong = 0, unanswered = 0;
  const rows = [];
  for (const a of answers || []) {
    const q = question(a.qid);
    if (!q) continue;
    const answered = a.chosen !== null && a.chosen !== undefined;
    const ok = answered && a.chosen === q.correctAnswer;
    if (!answered) unanswered++; else if (ok) correct++; else wrong++;
    rows.push({ q, chosen: answered ? a.chosen : null, correct: ok, answered, ms: a.ms || 0, explanation: a.explanation || "" });
  }
  const total = rows.length;
  return { rows, correct, wrong, unanswered, total, percent: total ? Math.round((correct / total) * 100) : 0 };
}

export function stats() {
  if (cache) return cache;
  const days = new Map();
  const day = (ts) => { const k = dayKey(ts); if (!days.has(k)) days.set(k, { xp: 0, studySec: 0, mcq: 0, correct: 0, logic: 0, lessons: 0, review: 0 }); return days.get(k); };
  const addXp = (ts, n) => { day(ts).xp += n; };

  // Lessons
  const done = new Map();
  for (const l of db.list("lessons")) {
    if (!l.completed || !lessonInfo(l.id)) continue;
    done.set(l.id, l.completedAt || l.updatedAt);
    addXp(done.get(l.id), XP.lesson);
    day(done.get(l.id)).lessons++;
  }

  // Answer records from every source
  const records = [];
  const topics = new Map();
  const touch = (rec) => {
    records.push(rec);
    const k = `${rec.module}::${rec.topic}`;
    if (!topics.has(k)) topics.set(k, { key: k, module: rec.module, topic: rec.topic, total: 0, correct: 0, last: 0 });
    const t = topics.get(k);
    t.total++; if (rec.correct) t.correct++; t.last = Math.max(t.last, rec.ts);
  };

  const quizzes = db.list("quizAttempts").sort((a, b) => a.createdAt - b.createdAt);
  for (const a of quizzes) {
    const g = gradeAnswers(a.answers);
    addXp(a.createdAt, XP.quizAttempt + g.correct * XP.correct);
    const d = day(a.createdAt);
    for (const r of g.rows) {
      if (!r.answered) continue;
      if (a.mode === "review") d.review++; else d.mcq++;
      if (r.correct) d.correct++;
      touch({ qid: r.q.id, correct: r.correct, ts: a.createdAt, source: "quiz", module: r.q.module, topic: r.q.topic });
    }
  }

  const exams = db.list("examAttempts").sort((a, b) => a.createdAt - b.createdAt).map((a) => {
    const g = gradeAnswers(a.answers);
    const passPercent = a.passPercent || APP.passPercent;
    const passed = g.percent >= passPercent;
    addXp(a.createdAt, XP.examTaken + (passed ? XP.examPassed : 0) + g.correct * XP.correct);
    const d = day(a.createdAt);
    for (const r of g.rows) {
      if (!r.answered) continue;
      d.mcq++; if (r.correct) d.correct++;
      touch({ qid: r.q.id, correct: r.correct, ts: a.createdAt, source: "exam", module: r.q.module, topic: r.q.topic });
    }
    return { ...a, grade: g, passed, passPercent };
  });

  for (const a of db.list("logicAttempts")) {
    const g = gradeAnswers(a.answers);
    addXp(a.createdAt, g.correct * XP.logicCorrect);
    for (const r of g.rows) {
      if (!r.answered) continue;
      day(a.createdAt).logic++;
      touch({ qid: r.q.id, correct: r.correct, ts: a.createdAt, source: "logic", module: r.q.module || "logic", topic: r.q.category });
    }
  }

  let codingSolved = 0;
  for (const c of db.list("coding")) if (c.status === "solved" && C.codingMap.has(c.id)) { codingSolved++; addXp(c.solvedAt || c.updatedAt, XP.codingSolved); }

  let studySec = 0;
  for (const s of db.list("sessions")) { studySec += s.sec || 0; day(s.startedAt || s.updatedAt).studySec += s.sec || 0; }

  // Totals
  const xp = [...days.values()].reduce((s, d) => s + d.xp, 0);
  const answered = records.length;
  const correct = records.filter((r) => r.correct).length;
  const mcqAnswered = records.filter((r) => r.source !== "logic").length;
  const logicCorrect = records.filter((r) => r.source === "logic" && r.correct).length;

  // Streaks
  const active = (k) => { const d = days.get(k); return d && (d.xp > 0 || d.studySec >= 120); };
  const today = dayKey();
  let streak = 0;
  let cursor = active(today) ? Date.now() : addDays(Date.now(), -1);
  while (active(dayKey(cursor))) { streak++; cursor = addDays(cursor, -1); }
  let best = 0, run = 0;
  const sortedDays = [...days.keys()].filter(active).sort();
  let prev = null;
  for (const k of sortedDays) {
    const t = new Date(k + "T12:00:00").getTime();
    run = prev !== null && dayKey(addDays(prev, 1)) === k ? run + 1 : 1;
    best = Math.max(best, run); prev = t;
  }

  const g = goals();
  const weekXp = new Map();
  for (const [k, d] of days) { const w = weekKey(new Date(k + "T12:00:00").getTime()); weekXp.set(w, (weekXp.get(w) || 0) + d.xp); }
  const thisWeek = weekKey();
  let weeklyStreak = (weekXp.get(thisWeek) || 0) >= g.weeklyXp ? 1 : 0;
  let wc = addDays(new Date(thisWeek + "T12:00:00").getTime(), -7);
  while ((weekXp.get(weekKey(wc)) || 0) >= g.weeklyXp) { weeklyStreak++; wc = addDays(wc, -7); }

  // Modules
  const modules = C.modules.map((m) => {
    const total = m.lessons.length;
    const completed = m.lessons.filter((l) => done.has(l.id)).length;
    const mt = [...topics.values()].filter((t) => t.module === m.id);
    const ans = mt.reduce((s, t) => s + t.total, 0), cor = mt.reduce((s, t) => s + t.correct, 0);
    const passedExam = exams.some((e) => e.passed && e.scope === "module" && e.moduleId === m.id);
    return { id: m.id, title: m.title, total, completed, pct: total ? completed / total : 0, answered: ans, accuracy: ans ? cor / ans : null, passedExam };
  });
  const totalLessons = modules.reduce((s, m) => s + m.total, 0);
  const overall = totalLessons ? done.size / totalLessons : 0;

  let next = null;
  for (const m of C.modules) { const l = m.lessons.find((x) => !done.has(x.id)); if (l) { next = { module: m, lesson: l, index: m.lessons.indexOf(l) }; break; } }

  const topicList = [...topics.values()].map((t) => ({ ...t, accuracy: t.correct / t.total }));
  const weak = topicList.filter((t) => t.total >= APP.minAnswersForWeak && t.accuracy < APP.weakAccuracy).sort((a, b) => a.accuracy - b.accuracy);
  const strong = topicList.filter((t) => t.total >= APP.minAnswersForWeak && t.accuracy >= 0.85).sort((a, b) => b.accuracy - a.accuracy || b.total - a.total);

  cache = {
    xp, level: levelFor(xp), days, today: days.get(today) || { xp: 0, studySec: 0, mcq: 0, correct: 0, logic: 0, lessons: 0, review: 0 },
    streak, bestStreak: best, weeklyStreak, weekXp: weekXp.get(thisWeek) || 0, goals: g,
    done, modules, overall, next, totalLessons,
    records, answered, correct, accuracy: answered ? correct / answered : null, mcqAnswered, logicCorrect,
    quizzes, exams, codingSolved, studySec, topics: topicList, weak, strong
  };
  return cache;
}

export async function completeLesson(lessonId) {
  const info = lessonInfo(lessonId);
  if (!info) return;
  const existing = db.get("lessons", lessonId);
  if (existing?.completed) return existing;
  return db.put("lessons", lessonId, { moduleId: info.module.id, completed: true, completedAt: Date.now() });
}

export const isDone = (lessonId) => Boolean(db.get("lessons", lessonId)?.completed);
