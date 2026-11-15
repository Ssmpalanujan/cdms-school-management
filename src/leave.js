export const LEAVE_TYPES = [["sick", "Sick"], ["casual", "Casual"], ["duty", "Duty"], ["special", "Special"]];
// Starting values only. Change them in the app to match your own leave rules.
export const DEFAULT_ENT = { casual: 21, sick: 21, special: 0, duty: 0 };
export const STATUSES = ["pending", "approved", "rejected", "cancelled"];
const D = (s) => new Date(s + "T00:00:00");
export const today = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; };

export function calendarDays(from, to) {
  if (!from || !to || isNaN(D(from)) || isNaN(D(to)) || D(to) < D(from)) return 0;
  return Math.round((D(to) - D(from)) / 864e5) + 1;
}

// working days (Monday to Friday) from start to end, both included
export function countDays(from, to) {
  if (!from || !to || isNaN(D(from)) || isNaN(D(to)) || D(to) < D(from)) return 0;
  let n = 0;
  for (let d = D(from); d <= D(to); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) { const w = d.getDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}
// date of the n-th working day (Monday to Friday) counting from `from`
export function addWorkingDays(from, n) {
  if (!from || isNaN(D(from)) || !(n >= 1)) return "";
  let d = D(from), left = Math.floor(n);
  const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  for (;;) {
    const w = d.getDay();
    if (w !== 0 && w !== 6) { left--; if (left === 0) return fmt(d); }
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
}
const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const active = (l) => l.status === "pending" || l.status === "approved";

export function balance(leaves, ent, teacher, year, excludeId) {
  const yearlyEntitlement = ent && ent[String(year)] && typeof ent[String(year)] === "object" ? ent[String(year)] : ent;
  const out = {};
  LEAVE_TYPES.forEach(([k]) => {
    const used = leaves.filter((l) => l.id !== excludeId && active(l) && l.type === k && same(l.teacher, teacher) && String(l.from).slice(0, 4) === String(year)).reduce((s, l) => s + l.days, 0);
    const total = Math.max(0, Number(yearlyEntitlement?.[k]) || 0);
    out[k] = { total, used, remaining: total - used };
  });
  return out;
}

export function validateLeave(f, leaves, ent, editId) {
  const e = {};
  if (!f.teacher.trim()) e.teacher = "Enter the teacher name.";
  if (!LEAVE_TYPES.some(([k]) => k === f.type)) e.type = "Choose a leave type.";
  if (!f.from) e.from = "Choose the start date.";
  if (!f.to) e.to = "Choose the end date.";
  if (f.from && f.to && D(f.to) < D(f.from)) e.to = "The end date is before the start date.";
  if (f.reason.trim().length < 3) e.reason = "Enter a reason.";
  if (!e.from && !e.to && f.teacher.trim()) {
    const auto = countDays(f.from, f.to), has = f.days !== "" && f.days != null;
    const days = has ? Number(f.days) : auto, cal = calendarDays(f.from, f.to);
    if (!has && auto === 0) e.to = "These dates have no working days (weekends only). Enter the number of days if the leave still counts.";
    else if (!(days > 0)) e.days = "Enter the number of days.";
    else if (days > cal) e.days = `That is more than the ${cal} calendar day${cal === 1 ? "" : "s"} between the dates.`;
    else if (!Number.isInteger(days * 2)) e.days = "Use whole or half days.";
    if (!e.to && !e.days) {
      const clash = leaves.find((l) => l.id !== editId && active(l) && same(l.teacher, f.teacher) && D(l.from) <= D(f.to) && D(l.to) >= D(f.from));
      if (clash) e.from = `Overlaps leave ${clash.no} (${clash.from} to ${clash.to}).`;
      else if (!e.type) {
        const left = balance(leaves, ent, f.teacher, f.from.slice(0, 4), editId)[f.type].remaining;
        if (days > left) {
          e.type = left <= 0
            ? `0 days available for ${f.type} leave in ${f.from.slice(0, 4)}. Ask the administrator to change this year's entitlement.`
            : `Only ${Math.max(left, 0)} ${f.type} leave day${left === 1 ? "" : "s"} remaining for ${f.from.slice(0, 4)}, but ${days} requested.`;
        }
      }
    }
  }
  return e;
}

export function nextNo(leaves, year) {
  const n = leaves.filter((l) => String(l.no).startsWith(`L-${year}-`)).map((l) => +String(l.no).split("-")[2] || 0);
  return `L-${year}-${String((n.length ? Math.max(...n) : 0) + 1).padStart(3, "0")}`;
}
export const isLate = (l) => !!l.submitted && !!l.from && D(l.submitted) > D(l.from);

export function reminders(leaves, ent, teacher, now = today(), academicYear = now.slice(0, 4)) {
  const out = [];
  const pending = leaves.filter((l) => l.status === "pending").length;
  if (pending) out.push({ tone: "warn", text: `${pending} leave request${pending === 1 ? "" : "s"} waiting for approval.` });
  leaves.filter(active).forEach((l) => {
    const n = Math.round((D(l.from) - D(now)) / 864e5);
    if (n >= 0 && n <= 7) out.push({ tone: "info", text: `${l.teacher}: ${l.type} leave ${l.no} starts ${n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`}.` });
  });
  const late = leaves.filter((l) => active(l) && isLate(l)).length;
  if (late) out.push({ tone: "warn", text: `${late} leave request${late === 1 ? " was" : "s were"} submitted after the start date.` });
  if (teacher) {
    const b = balance(leaves, ent, teacher, academicYear);
    LEAVE_TYPES.forEach(([k, label]) => { if (b[k].total > 0 && b[k].remaining <= 2) out.push({ tone: "warn", text: `${teacher}: only ${Math.max(b[k].remaining, 0)} ${label.toLowerCase()} leave day${b[k].remaining === 1 ? "" : "s"} left this year.` }); });
  }
  return out;
}
