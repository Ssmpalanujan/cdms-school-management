import { uid } from "./defaults.js";

export const GENDERS = ["Male", "Female"];
export const GRADES = Array.from({ length: 13 }, (_, i) => `Grade ${i + 1}`);
export const blankStudent = (meta = {}) => ({ id: "", index: "", name: "", gender: "", grade: meta.grade || "Grade 6", division: meta.className || "A", dob: "", guardian: "", email: "" });

export function validateStudent(f, students, editId) {
  const e = {};
  if (!f.name.trim()) e.name = "Enter the full name.";
  if (!f.index.trim()) e.index = "Enter the index number.";
  else if (students.some((s) => s.id !== editId && s.index.trim().toLowerCase() === f.index.trim().toLowerCase())) e.index = "This index number already exists.";
  if (!GENDERS.includes(f.gender)) e.gender = "Choose a gender.";
  if (!f.grade.trim()) e.grade = "Choose a grade.";
  if (!f.division.trim()) e.division = "Enter the division.";
  if (f.guardian && !/^[0-9+\s-]{7,15}$/.test(f.guardian.trim())) e.guardian = "Enter a valid phone number.";
  if (f.email && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email address.";
  if (f.dob && (isNaN(Date.parse(f.dob)) || new Date(f.dob) > new Date())) e.dob = "Enter a valid date of birth.";
  return e;
}

export function counts(students) {
  const byDiv = new Map();
  let male = 0, female = 0;
  students.forEach((s) => {
    if (s.gender === "Male") male++; else if (s.gender === "Female") female++;
    const k = `${s.grade} ${s.division}`.trim();
    byDiv.set(k, (byDiv.get(k) || 0) + 1);
  });
  return { total: students.length, male, female, other: students.length - male - female, byDiv: [...byDiv.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })) };
}

// students that appear in marks but are missing from the student list are added (gender left blank)
export function syncStudents(students, records, meta) {
  const have = new Set(students.map((s) => s.index.trim().toLowerCase()));
  const add = [];
  records.forEach((r) => {
    const k = String(r.studentId).trim().toLowerCase();
    if (k && !have.has(k)) { have.add(k); add.push({ ...blankStudent(meta), id: uid(), index: String(r.studentId).trim(), name: r.name }); }
  });
  return add.length ? [...students, ...add] : students;
}
