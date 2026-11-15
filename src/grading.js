// [grade, minimum total mark, GPV] - editable in the app
export const DEFAULT_SCALE = [
  ["A", 75, 5], ["A-", 70, 4.5], ["B+", 65, 4.25], ["B", 60, 4], ["B-", 55, 3.75],
  ["C+", 50, 3.25], ["C", 45, 3], ["S", 40, 2], ["D", 35, 1], ["E", 30, 0.5], ["F", 0, 0],
];
export const num = (v) => (v === "" || v == null || isNaN(+v) ? null : +v);
export const r2 = (n) => Math.round(n * 100) / 100;
export const slug = (t) => String(t || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const hasData = (r) => !!(r.studentId || r.name || r.moduleTitle || r.formative !== "" || r.summative !== "" || r.absent);
export const moduleKey = (r) => r.moduleId || slug(r.moduleTitle);

export function gradeFor(total, scale) {
  if (total == null) return { grade: "W", gpv: 0 };
  const s = [...scale].sort((a, b) => b[1] - a[1]);
  const hit = s.find((x) => total >= x[1]) || s[s.length - 1];
  return { grade: hit[0], gpv: hit[2] };
}

// formative mark scaled from activities: (sum of marks / sum of maximums) x formative maximum
export function activityFormative(acts, fmax) {
  const v = (acts || []).filter((a) => num(a.max) > 0 && num(a.mark) != null);
  if (!v.length) return null;
  const sm = v.reduce((s, a) => s + num(a.mark), 0), mx = v.reduce((s, a) => s + num(a.max), 0);
  return r2((sm / mx) * fmax);
}

export function moduleResult(m, scale) {
  const credit = num(m.credit) ?? 1;
  if (m.absent) return { total: null, grade: "AB", gpv: 0, points: 0, credit: 0, absent: true };
  const f = num(m.formative), s = num(m.summative);
  if (f == null && s == null) return { total: null, ...gradeFor(null, scale), points: 0, credit };
  const total = r2((f || 0) + (s || 0));
  const g = gradeFor(total, scale);
  return { total, ...g, points: r2(g.gpv * credit), credit };
}

export function studentGpa(modules, scale, override) {
  const rs = modules.map((m) => moduleResult(m, scale));
  const credits = rs.reduce((a, r) => a + r.credit, 0);
  const points = rs.reduce((a, r) => a + r.points, 0);
  const computed = credits ? r2(points / credits) : 0;
  const manual = override != null && override !== "" && !isNaN(+override);
  const gpa = manual ? r2(+override) : computed;
  const s = [...scale].sort((a, b) => b[2] - a[2]);
  let grade = (s.find((x) => gpa >= x[2]) || s[s.length - 1])[0];
  if (!credits && !manual) grade = rs.some((r) => r.absent) ? "AB" : "-";
  return { gpa, computed, grade, credits, points, manual };
}

export function studentTotals(modules, scale) {
  const t = modules.map((m) => moduleResult(m, scale).total).filter((x) => x != null);
  const total = r2(t.reduce((a, b) => a + b, 0));
  return { total, count: t.length, avg: t.length ? r2(total / t.length) : 0 };
}

export function validate(rows, cfg) {
  const e = [], smax = 100 - cfg.fmax, seen = new Map();
  rows.filter(hasData).forEach((r, i) => {
    const n = i + 1, f = num(r.formative), s = num(r.summative);
    if (!String(r.studentId).trim() || !String(r.name).trim()) e.push(`Row ${n}: enter the index no and student name.`);
    if (!String(r.moduleTitle).trim() && !String(r.moduleId).trim()) e.push(`Row ${n}: enter the subject.`);
    const k = String(r.studentId).trim().toLowerCase() + "|" + moduleKey(r);
    if (moduleKey(r) && String(r.studentId).trim()) {
      if (seen.has(k)) e.push(`Row ${n}: same student and subject as row ${seen.get(k)}. Remove the duplicate.`);
      else seen.set(k, n);
    }
    if (r.absent) return;
    if (f != null && (f < 0 || f > cfg.fmax)) e.push(`Row ${n}: formative must be between 0 and ${cfg.fmax}.`);
    if (s != null && (s < 0 || s > smax)) e.push(`Row ${n}: summative must be between 0 and ${smax}.`);
    if (!(num(r.credit) > 0)) e.push(`Row ${n}: credit must be above 0.`);
    (r.activities || []).forEach((a, j) => {
      if (a.mark === "" && a.max === "") return;
      if (!(num(a.max) > 0)) e.push(`Row ${n}, activity ${j + 1}: maximum mark must be above 0.`);
      else if (num(a.mark) == null || num(a.mark) < 0 || num(a.mark) > num(a.max)) e.push(`Row ${n}, activity ${j + 1}: marks must be between 0 and ${a.max}.`);
    });
  });
  return e;
}

// non-blocking hints
export function warnings(rows) {
  const w = [];
  rows.filter(hasData).forEach((r, i) => {
    if (r.absent) return;
    const n = i + 1, f = num(r.formative), s = num(r.summative);
    if (f == null && s == null) w.push(`Row ${n}: no marks entered. Tick Absent if the student did not attend.`);
    else if (f == null) w.push(`Row ${n}: formative is empty, the total uses summative only.`);
    else if (s == null) w.push(`Row ${n}: summative is empty, the total uses formative only.`);
  });
  return w;
}
