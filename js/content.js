// ---------------------------------------------------------------------------
// Content provider. All course material lives in /data as JSON so new
// modules, lessons, questions, exams and challenges can be added without
// touching application code. To add a module: create data/modules/<id>.json
// and data/questions/<id>.json, then add <id> to the track in data/tracks.json.
// ---------------------------------------------------------------------------
const C = {
  tracks: [], track: null, modules: [], moduleMap: new Map(), lessonMap: new Map(),
  questions: [], questionMap: new Map(), logic: [], coding: [], codingMap: new Map(),
  exams: [], achievements: [], loaded: false
};
export default C;

async function json(path) {
  const r = await fetch(path, { cache: "no-cache" }).catch(() => fetch(path));
  if (!r.ok) throw new Error(`Couldn't load ${path} (${r.status})`);
  return r.json();
}

export async function loadContent(trackId) {
  const t = await json("data/tracks.json");
  C.tracks = t.tracks;
  C.track = t.tracks.find((x) => x.id === trackId) || t.tracks.find((x) => x.status === "active");
  const ids = C.track.modules;
  const [mods, qs, logic, coding, exams, ach] = await Promise.all([
    Promise.all(ids.map((id) => json(`data/modules/${id}.json`))),
    Promise.all(ids.map((id) => json(`data/questions/${id}.json`).catch(() => []))),
    json("data/logic.json"), json("data/coding.json"), json("data/exams.json"), json("data/achievements.json")
  ]);
  C.modules = mods.map((m, i) => ({ ...m, order: i + 1 }));
  C.moduleMap = new Map(C.modules.map((m) => [m.id, m]));
  C.lessonMap = new Map();
  for (const m of C.modules) m.lessons.forEach((l, i) => C.lessonMap.set(l.id, { lesson: l, module: m, index: i }));
  C.questions = qs.flat().map((q) => ({ ...q, kind: "mcq" }));
  C.logic = logic.map((q) => ({ ...q, kind: "logic" }));
  C.questionMap = new Map([...C.questions, ...C.logic].map((q) => [q.id, q]));
  C.coding = coding;
  C.codingMap = new Map(coding.map((c) => [c.id, c]));
  C.exams = exams;
  C.achievements = ach;
  C.loaded = true;
  return C;
}

export const moduleById = (id) => C.moduleMap.get(id);
export const lessonInfo = (id) => C.lessonMap.get(id);
export const question = (id) => C.questionMap.get(id);
export const questionsFor = (moduleId) => C.questions.filter((q) => q.module === moduleId);
export const allLessons = () => C.modules.flatMap((m) => m.lessons.map((l) => ({ lesson: l, module: m })));
export const topicLesson = (moduleId, topic) => {
  const q = C.questions.find((x) => x.module === moduleId && x.topic === topic && x.lesson);
  return q ? lessonInfo(q.lesson) : null;
};
