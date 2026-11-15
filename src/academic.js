import { DEFAULT_ENT } from "./leave.js";

export const DEFAULT_RETIREMENT_AGE = 60;
export const DEFAULT_PROMOTION_EXPIRY_DAYS = 30;

export function normalizeAcademicYears(years, currentYear) {
  const valid = Array.isArray(years) ? years.filter((item) => item && /^\d{4}$/.test(String(item.year))) : [];
  const map = new Map(valid.map((item) => [String(item.year), { ...item, year: String(item.year), closed: !!item.closed }]));
  const current = String(currentYear);
  if (!map.has(current)) map.set(current, { year: current, closed: false, createdAt: Date.now() });
  return [...map.values()].map((item) => ({ ...item, current: item.year === current }));
}

export function canManageYears(role) {
  return role === "admin";
}

export function addAcademicYear(years, value, actor, now = Date.now()) {
  if (!canManageYears(actor?.role)) throw new Error("Only an administrator can add academic years.");
  const year = String(value || "").trim();
  if (!/^\d{4}$/.test(year)) throw new Error("Enter a four-digit academic year.");
  if ((years || []).some((item) => String(item.year) === year)) throw new Error("That academic year already exists.");
  return [...(years || []), { year, current: false, closed: false, createdAt: now }];
}

export function setCurrentAcademicYear(years, value, actor) {
  if (!canManageYears(actor?.role)) throw new Error("Only an administrator can set the current academic year.");
  const year = String(value);
  const selected = (years || []).find((item) => String(item.year) === year);
  if (!selected || selected.closed) throw new Error("Choose an open academic year.");
  return (years || []).map((item) => ({ ...item, current: String(item.year) === year }));
}

export function closeAcademicYear(years, value, actor, now = Date.now()) {
  if (!canManageYears(actor?.role)) throw new Error("Only an administrator can close academic years.");
  const year = String(value);
  const target = (years || []).find((item) => String(item.year) === year);
  if (!target || target.closed) throw new Error("This academic year is not open.");
  const available = (years || []).filter((item) => String(item.year) !== year && !item.closed);
  if (target.current && !available.length) throw new Error("Add another academic year and set it as current before closing this year.");
  const replacement = target.current ? available.sort((a, b) => String(a.year).localeCompare(String(b.year)))[available.length - 1] : null;
  return (years || []).map((item) => String(item.year) === year
    ? { ...item, closed: true, current: false, closedAt: now }
    : replacement && String(item.year) === String(replacement.year) ? { ...item, current: true } : item);
}

export function canWriteYear(role, year, academicYears) {
  const target = (academicYears || []).find((item) => String(item.year) === String(year));
  return !!target && !target.closed && (role === "admin" || target.current);
}

export function normalizeEnrollments(enrollments, students, currentYear, meta) {
  const byKey = new Map();
  (Array.isArray(enrollments) ? enrollments : []).filter((item) => item && item.studentId && item.year).forEach((item) => {
    byKey.set(`${String(item.studentId).toLowerCase()}|${item.year}`, item);
  });
  const rows = [...byKey.values()];
  const keys = new Set(rows.map((item) => `${String(item.studentId).toLowerCase()}|${item.year}`));
  (Array.isArray(students) ? students : []).forEach((student) => {
    const key = `${String(student.index || "").toLowerCase()}|${currentYear}`;
    if (!student.index || keys.has(key)) return;
    rows.push({ studentId: String(student.index), year: String(currentYear), grade: student.grade || meta.grade || "", division: student.division || meta.className || "", classTeacherId: "" });
    keys.add(key);
  });
  return rows;
}

export function getYearEntitlement(store, year) {
  const current = store && typeof store === "object" && !Array.isArray(store) ? store : {};
  if (current[String(year)] && typeof current[String(year)] === "object") return { ...DEFAULT_ENT, ...current[String(year)] };
  const isFlat = Object.keys(DEFAULT_ENT).some((key) => Object.prototype.hasOwnProperty.call(current, key));
  if (isFlat) {
    const previousDefaults = { casual: 7, sick: 21, special: 7, duty: 14 };
    const matchesPreviousDefaults = Object.keys(previousDefaults).every((key) => Number(current[key]) === previousDefaults[key]);
    return matchesPreviousDefaults ? { ...DEFAULT_ENT } : { ...DEFAULT_ENT, ...current };
  }
  return { ...DEFAULT_ENT };
}

export function setYearEntitlement(store, year, entitlement) {
  const current = store && typeof store === "object" && !Array.isArray(store) ? store : {};
  const legacyFlat = Object.keys(DEFAULT_ENT).some((key) => Object.prototype.hasOwnProperty.call(current, key));
  const years = legacyFlat ? { [String(year)]: getYearEntitlement(current, year) } : current;
  return { ...years, [String(year)]: { ...DEFAULT_ENT, ...entitlement } };
}

export function migrateAcademicStorage(storage, currentYear, students, meta) {
  const read = (key, fallback) => {
    try { return JSON.parse(storage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
  };
  const years = normalizeAcademicYears(read("srb-academic-years", read("srb-years", [])), currentYear);
  const enrollmentKey = "srb-enrollments";
  const existing = read(enrollmentKey, []);
  const enrollments = normalizeEnrollments(existing, students, currentYear, meta || {});
  const entitlements = getYearEntitlement(read("srb-leave-ent", DEFAULT_ENT), currentYear);
  if (storage && typeof storage.setItem === "function") {
    try {
      storage.setItem("srb-academic-years", JSON.stringify(years));
      storage.setItem(enrollmentKey, JSON.stringify(enrollments));
      storage.setItem("srb-leave-ent", JSON.stringify(setYearEntitlement(read("srb-leave-ent", DEFAULT_ENT), currentYear, entitlements)));
    } catch (error) {
      console.error("Could not migrate academic year data", error);
    }
  }
  return { years, enrollments };
}
