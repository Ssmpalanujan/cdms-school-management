import * as XLSX from "xlsx";
import { moduleResult, studentGpa, num, slug } from "./grading.js";
import { today } from "./leave.js";
import { pensionDetails, formatDateParts } from "./pension.js";

export const REQUIRED = ["studentId", "name", "grade", "medium", "className", "classTeacher", "term", "year", "moduleId", "moduleTitle", "summative", "formative"];
export const OPTIONAL = ["credit", "gender", "absent", "absentRemark", "schoolName", "schoolAddress", "developer"];
export const HEADERS = [...REQUIRED, ...OPTIONAL];

const base = { grade: "Grade 6", medium: "English", className: "A", classTeacher: "Mr. S. Arigaran", term: "Term 1", year: 2026, credit: 1, gender: "", absent: "", absentRemark: "", schoolName: "Sample College", schoolAddress: "Karaitivu", developer: "" };
export const SAMPLE = [
  { studentId: "1001", name: "A. Kumar", gender: "Male", moduleId: "aesth-01", moduleTitle: "Aesthetics", formative: 61.5, summative: 26.9 },
  { studentId: "1002", name: "S. Nisha", gender: "Female", moduleId: "aesth-01", moduleTitle: "Aesthetics", formative: 60, summative: 26.5 },
  { studentId: "1001", name: "A. Kumar", gender: "Male", moduleId: "math-01", moduleTitle: "Mathematics", formative: 55, summative: 22 },
  { studentId: "1002", name: "S. Nisha", gender: "Female", moduleId: "math-01", moduleTitle: "Mathematics", formative: "", summative: "", absent: "yes", absentRemark: "Sick leave" },
].map((r) => ({ ...base, ...r }));

const write = (header, rows, name) => {
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, name);
};
const save = (rows, name) => write(HEADERS, rows.map((r) => HEADERS.map((h) => r[h] ?? "")), name);

export const flatten = (records, meta) =>
  records.flatMap((r) => r.modules.map((m) => ({
    studentId: r.studentId, name: r.name, grade: meta.grade, medium: meta.medium, className: meta.className,
    classTeacher: meta.classTeacher, term: meta.term, year: meta.year, moduleId: m.moduleId, moduleTitle: m.moduleTitle,
    summative: m.summative, formative: m.formative, credit: m.credit, gender: r.gender || "", absent: m.absent ? "yes" : "",
    absentRemark: m.absentRemark || "", schoolName: meta.schoolName, schoolAddress: meta.schoolAddress, developer: "",
  })));

export const downloadWorkbook = (records, meta) => save(flatten(records, meta), "report-workbook.xlsx");
export const downloadSample = () => save(SAMPLE, "sample-workbook.xlsx");
export const downloadBlank = () => save([], "blank-template.xlsx");

// Printable-style marks report: one row per student and subject
export function downloadMarksReport(records, students, meta, cfg) {
  const maxAct = Math.max(0, ...records.flatMap((r) => r.modules.map((m) => (m.activities || []).length)));
  const acts = Array.from({ length: maxAct }, (_, i) => `Activity ${i + 1}`);
  const header = ["No.", "Full Name", "Index Number", "Grade", "Division", "Date", "Subject", ...acts, "Credit", "Formative", "Summative", "Total", "GPA", "Grade Result", "Remarks"];
  const date = today();
  const rows = [];
  records.forEach((r, i) => {
    const st = students.find((s) => s.index.toLowerCase() === String(r.studentId).toLowerCase());
    const g = studentGpa(r.modules, cfg.scale, r.gpaOverride);
    r.modules.forEach((m) => {
      const x = moduleResult(m, cfg.scale);
      rows.push([
        i + 1, r.name, r.studentId, st?.grade || meta.grade, st?.division || meta.className, date, m.moduleTitle,
        ...acts.map((_, k) => { const a = (m.activities || [])[k]; return a && a.mark !== "" ? `${a.mark}/${a.max}` : ""; }),
        x.absent ? "" : x.credit, m.absent ? "AB" : m.formative, m.absent ? "AB" : m.summative, x.absent ? "AB" : x.total ?? "",
        g.gpa, x.grade, m.absent ? m.absentRemark || "Absent" : r.remark || "",
      ]);
    });
  });
  write(header, rows, `marks-report-${meta.year}-${slug(meta.term)}.xlsx`);
}

const SH = ["No.", "Full Name", "Index Number", "Gender", "Grade", "Division", "Date of Birth", "Guardian Phone", "Email"];
export const downloadStudents = (students) => write(SH, students.map((s, i) => [i + 1, s.name, s.index, s.gender, s.grade, s.division, s.dob, s.guardian, s.email || ""]), "students.xlsx");
export const downloadStudentTemplate = () => write(["indexNumber", "fullName", "gender", "grade", "division", "dateOfBirth", "guardianPhone", "email"], [["1001", "A. Kumar", "Male", "Grade 6", "A", "2014-05-12", "0771234567", "kumar@example.com"]], "students-template.xlsx");

export function downloadTeacherPensions(rows, retirementAge = 60) {
  const header = ["Teacher", "Date of birth", "Date joined", "Subject", "Phone", "Retirement date", "Time remaining", "Days left", "Service completed", "Status"];
  const data = rows.map(({ teacher }) => {
    const pension = pensionDetails(teacher, retirementAge);
    return [teacher.name, teacher.dateOfBirth || "", teacher.dateJoined || "", teacher.subject || "", teacher.phone || "",
      pension.retirementDate, pension.remaining ? formatDateParts(pension.remaining) : "", pension.daysLeft ?? "",
      pension.service ? formatDateParts(pension.service) : "", pension.retired ? "Retired" : "Active"];
  });
  write(header, data, "teacher-pension-countdown.xlsx");
}

const sheetRows = async (file) => {
  const wb = XLSX.read(await file.arrayBuffer());
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
};
const yes = (v) => ["yes", "y", "true", "1", "ab", "absent"].includes(String(v).trim().toLowerCase());

// Valid rows are imported, invalid rows are listed in `errors` and skipped.
export async function importWorkbook(file, cfg) {
  const rows = await sheetRows(file);
  if (!rows.length) throw new Error("The workbook has no rows.");
  const missing = REQUIRED.filter((c) => !(c in rows[0]));
  if (missing.length) throw new Error("Missing columns: " + missing.join(", "));
  const f = rows[0], smax = cfg ? 100 - cfg.fmax : 100;
  const meta = {
    grade: String(f.grade), medium: String(f.medium), className: String(f.className), classTeacher: String(f.classTeacher),
    term: String(f.term), year: String(f.year), ...(f.schoolName && { schoolName: String(f.schoolName) }), ...(f.schoolAddress && { schoolAddress: String(f.schoolAddress) }),
  };
  const by = new Map(), errors = [], seen = new Set();
  rows.forEach((r, i) => {
    const n = i + 2, id = String(r.studentId).trim(), absent = yes(r.absent), fm = Number(r.formative), sm = Number(r.summative);
    const bad = (m) => errors.push(`Row ${n}: ${m}`);
    if (!id || !String(r.name).trim()) return bad("studentId and name are required.");
    if (!String(r.moduleId).trim() && !String(r.moduleTitle).trim()) return bad("moduleId or moduleTitle is required.");
    if (!absent) {
      if (r.formative === "" || r.summative === "" || isNaN(fm) || isNaN(sm)) return bad("formative and summative must be numbers.");
      if (cfg && (fm < 0 || fm > cfg.fmax)) return bad(`formative must be between 0 and ${cfg.fmax}.`);
      if (cfg && (sm < 0 || sm > smax)) return bad(`summative must be between 0 and ${smax}.`);
    }
    const mid = String(r.moduleId).trim() || slug(r.moduleTitle), k = id.toLowerCase() + "|" + mid;
    if (seen.has(k)) return bad("duplicate of an earlier row (same student and subject), skipped.");
    seen.add(k);
    if (!by.has(id)) by.set(id, { studentId: id, name: String(r.name).trim(), gender: ["male", "female"].includes(String(r.gender).trim().toLowerCase()) ? (String(r.gender).trim().toLowerCase() === "male" ? "Male" : "Female") : "", modules: [], remark: "" });
    by.get(id).modules.push({ moduleId: mid, moduleTitle: String(r.moduleTitle).trim() || mid, formative: absent ? "" : fm, summative: absent ? "" : sm, credit: num(r.credit) > 0 ? Number(r.credit) : 1, absent, absentRemark: absent ? String(r.absentRemark || "").trim() : "", activities: [] });
  });
  return { meta, records: [...by.values()], errors, total: rows.length };
}

export async function importStudents(file, existing) {
  const rows = await sheetRows(file);
  if (!rows.length) throw new Error("The workbook has no rows.");
  const need = ["indexNumber", "fullName", "gender", "grade", "division"], miss = need.filter((c) => !(c in rows[0]));
  if (miss.length) throw new Error("Missing columns: " + miss.join(", "));
  const have = new Set(existing.map((s) => s.index.trim().toLowerCase())), out = [], errors = [];
  rows.forEach((r, i) => {
    const n = i + 2, idx = String(r.indexNumber).trim(), g = String(r.gender).trim().toLowerCase();
    const bad = (m) => errors.push(`Row ${n}: ${m}`);
    if (!idx || !String(r.fullName).trim()) return bad("indexNumber and fullName are required.");
    if (g !== "male" && g !== "female") return bad("gender must be Male or Female.");
    if (!String(r.grade).trim() || !String(r.division).trim()) return bad("grade and division are required.");
    if (have.has(idx.toLowerCase())) return bad(`index number ${idx} already exists, skipped.`);
    have.add(idx.toLowerCase());
    const email = String(r.email || "").trim().toLowerCase();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return bad("email must be a valid email address.");
    out.push({ id: Math.random().toString(36).slice(2, 9), index: idx, name: String(r.fullName).trim(), gender: g === "male" ? "Male" : "Female", grade: String(r.grade).trim(), division: String(r.division).trim(), dob: String(r.dateOfBirth || "").trim(), guardian: String(r.guardianPhone || "").trim(), email });
  });
  return { students: out, errors, total: rows.length };
}

// One-time credentials list for the admin to hand out. Passwords cannot be shown again after this.
export const downloadCredentials = (rows) => write(["No.", "Role", "Full Name", "Class", "Username", "Password"], rows.map((r, i) => [i + 1, r.role, r.name, r.cls || "", r.username, r.password]), "login-credentials.xlsx");
