import { studentGpa, studentTotals } from "./grading.js";
import { TERMS } from "./defaults.js";

// All terms in which a student has marks, newest first. `store` is { "2026|Term 1": [records] }.
export function studentHistory(store, studentId, cfg) {
  const id = String(studentId || "").trim().toLowerCase();
  if (!id) return [];
  return Object.entries(store || {}).flatMap(([key, recs]) => {
    const rec = (Array.isArray(recs) ? recs : []).find((r) => String(r.studentId).trim().toLowerCase() === id);
    if (!rec) return [];
    const [year, term] = key.split("|");
    const g = studentGpa(rec.modules, cfg.scale, rec.gpaOverride), t = studentTotals(rec.modules, cfg.scale);
    return [{ key, year, term, rec, gpa: g.gpa, grade: g.grade, credits: g.credits, avg: t.avg, total: t.total }];
  }).sort((a, b) => (b.year - a.year) || (TERMS.indexOf(b.term) - TERMS.indexOf(a.term)));
}
