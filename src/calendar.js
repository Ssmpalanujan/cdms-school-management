// Source: Ministry of Education Circular 31/2026 (2027 school term calendar), as reported in the news on 21 Aug 2026.
export const d = (s) => new Date(s + "T00:00:00");
export const dot = (s) => s.replaceAll("-", ".");
export const nice = (s) => d(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const SCHEDULES = {
  "tamil-sinhala": {
    label: "Tamil & Sinhala schools",
    periods: [
      { term: "Term 1", kind: "school", from: "2027-01-04", to: "2027-04-09" },
      { label: "April holidays", kind: "holiday", from: "2027-04-10", to: "2027-04-25" },
      { term: "Term 2", kind: "school", from: "2027-04-26", to: "2027-07-30" },
      { label: "August holidays", kind: "holiday", from: "2027-07-31", to: "2027-08-29" },
      { term: "Term 3", kind: "school", from: "2027-08-30", to: "2027-12-03" },
    ],
  },
  muslim: {
    label: "Muslim schools",
    note: "Term 1 Phase 2 and Term 3 dates are not listed here. Check Circular 31/2026 for them.",
    periods: [
      { term: "Term 1 · Phase 1", kind: "school", from: "2027-01-04", to: "2027-02-05" },
      { label: "Vacation", kind: "holiday", from: "2027-02-06", to: "2027-03-14" },
      { term: "Term 1 · Phase 3", kind: "school", from: "2027-04-15", to: "2027-04-30" },
      { label: "Short break", kind: "holiday", from: "2027-05-01", to: "2027-05-02" },
      { term: "Term 2 · Phase 1", kind: "school", from: "2027-05-03", to: "2027-05-14" },
      { label: "Holidays", kind: "holiday", from: "2027-05-15", to: "2027-05-20" },
      { term: "Term 2 · Phase 2", kind: "school", from: "2027-05-21", to: "2027-08-27" },
      { label: "Short break", kind: "holiday", from: "2027-08-28", to: "2027-08-29" },
    ],
  },
};

export function status(key = "tamil-sinhala", now = new Date()) {
  const ps = (SCHEDULES[key] || SCHEDULES["tamil-sinhala"]).periods;
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cur = ps.find((p) => t >= d(p.from) && t <= d(p.to));
  const nextSchool = ps.find((p) => p.kind === "school" && d(p.from) > t);
  if (cur?.kind === "school") {
    const left = Math.round((d(cur.to) - t) / 864e5);
    return { tone: "school", label: `${cur.term} · ends ${dot(cur.to)}`, sub: `${left} calendar days left` };
  }
  if (nextSchool) return { tone: "holiday", label: `Holiday · ${nextSchool.term} starts ${dot(nextSchool.from)}`, sub: "School vacation period" };
  return { tone: "unknown", label: "No dated period right now", sub: "Check Circular 31/2026" };
}

export function upcoming(key = "tamil-sinhala", now = new Date()) {
  const ps = (SCHEDULES[key] || SCHEDULES["tamil-sinhala"]).periods;
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out = [];
  ps.forEach((p, i) => {
    if (p.kind !== "school") return;
    const prev = ps[i - 1], next = ps[i + 1];
    if (d(p.from) >= t) out.push({ date: p.from, title: `${p.term} starts`, sub: prev?.kind === "holiday" ? `After ${prev.label}` : "" });
    if (d(p.to) >= t) out.push({ date: p.to, title: `${p.term} ends`, sub: next?.kind === "holiday" ? `${next.label} follow` : "" });
  });
  return out;
}
