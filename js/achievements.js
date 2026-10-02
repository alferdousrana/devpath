// Achievement rules are data (data/achievements.json); this evaluates them.
import * as db from "./db.js";
import C from "./content.js";
import { stats } from "./progress.js";
import { achievementPop } from "./components/ui.js";

export function evaluate(cond, s) {
  const r = (have, need) => ({ met: have >= need, progress: Math.min(1, need ? have / need : 0), have, need });
  switch (cond.type) {
    case "module": { const m = s.modules.find((x) => x.id === cond.module); return m ? r(m.completed, m.total) : r(0, 1); }
    case "lessons": return r(s.done.size, cond.count);
    case "xp": return r(s.xp, cond.value);
    case "streak": return r(Math.max(s.streak, s.bestStreak), cond.value);
    case "mcq": return r(s.mcqAnswered, cond.count);
    case "logic": return r(s.logicCorrect, cond.count);
    case "coding": return r(s.codingSolved, cond.count);
    case "examPass": {
      const ok = s.exams.some((e) => e.passed && e.scope === cond.scope && (!cond.module || e.moduleId === cond.module));
      return r(ok ? 1 : 0, 1);
    }
    case "accuracy": {
      if (s.answered < cond.min) return { ...r(s.answered, cond.min), met: false };
      return r(Math.round((s.accuracy || 0) * 100), cond.value);
    }
    case "track": return r(s.done.size, s.totalLessons);
    default: return r(0, 1);
  }
}

// Unlock any newly met achievements. `silent` on first load avoids a flood of popups.
export async function checkAchievements(silent = false) {
  const s = stats();
  for (const a of C.achievements) {
    if (db.get("achievements", a.id)) continue;
    if (evaluate(a.condition, s).met) {
      await db.put("achievements", a.id, { unlockedAt: Date.now(), createdAt: Date.now() });
      if (!silent) achievementPop(a);
    }
  }
}
