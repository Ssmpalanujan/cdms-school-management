import { moduleResult, studentGpa, studentTotals } from "./grading.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));
const marksFor = (snapshot, index) => snapshot.subjects.map((subject) => ({
  ...subject,
  mark: subject.marks.find((item) => String(item.studentId) === String(index)),
})).filter((item) => item.mark);
const modulesFor = (marks) => marks.map(({ subject, mark }) => ({ ...mark, moduleTitle: subject, absent: !!mark.absent }));

const commonStyles = `
  body { color:#17233a; font:14px/1.45 "Noto Sans Tamil","Latha","Nirmala UI",Arial,sans-serif; margin:24px; }
  h1,h2,p { margin:0 0 8px; } h1 { font-size:22px; } h2 { font-size:17px; margin-top:20px; }
  .meta { margin-bottom:18px; color:#44546c; } table { width:100%; border-collapse:collapse; margin:12px 0; }
  th,td { border:1px solid #ccd5e2; padding:6px 8px; text-align:left; vertical-align:top; }
  th { background:#edf2f8; } .center { text-align:center; } .muted { color:#52637d; }
  .logo { max-width:76px; max-height:76px; object-fit:contain; float:right; }
  .signature { margin-top:42px; width:260px; border-top:1px solid #17233a; padding-top:6px; }
  @media print { body { margin:12mm; } .no-print { display:none; } }
`;

const header = (snapshot, meta) => `
  ${meta.logo ? `<img class="logo" src="${escapeHtml(meta.logo)}" alt="">` : ""}
  <h1>${escapeHtml(meta.schoolName || "School results")}</h1>
  <div class="meta">${escapeHtml(snapshot.grade)} ${escapeHtml(snapshot.division)} · ${escapeHtml(snapshot.term)} ${escapeHtml(snapshot.year)}<br>
  Published on ${escapeHtml(new Date(snapshot.publishedAt).toLocaleString())} · Version ${escapeHtml(snapshot.version)}</div>
`;

export function buildClassResultsHtml(snapshot, meta = {}) {
  const headers = snapshot.gradeOnly
    ? "<th>Total</th><th>Average</th><th>Grade</th>"
    : "<th>Total</th><th>Average</th><th>Grade</th><th>GPA</th>";
  const subjectNames = snapshot.subjects.map((subject) => subject.subject);
  const rows = snapshot.students.map((student) => {
    const subjects = marksFor(snapshot, student.index);
    const modules = modulesFor(subjects);
    const totals = studentTotals(modules, snapshot.scale);
    const gpa = studentGpa(modules, snapshot.scale);
    const subjectCells = subjects.map(({ subject, mark }) => {
      const result = moduleResult({ ...mark, absent: !!mark.absent }, snapshot.scale);
      return `<td>${result.absent ? `AB${mark.absentRemark ? `: ${escapeHtml(mark.absentRemark)}` : ""}` : escapeHtml(result.total ?? "—")} (${escapeHtml(result.grade)})</td>`;
    }).join("");
    const overallTotal = subjects.reduce((sum, item) => {
      const result = moduleResult({ ...item.mark, absent: !!item.mark.absent }, snapshot.scale);
      return sum + (result.total ?? 0);
    }, 0);
    const allHeaders = snapshot.gradeOnly
      ? `<td>${overallTotal}</td><td>${totals.avg}</td><td>${escapeHtml(gpa.grade)}</td>`
      : `<td>${overallTotal}</td><td>${totals.avg}</td><td>${escapeHtml(gpa.grade)}</td><td>${gpa.gpa.toFixed(2)}</td>`;
    return `<tr><td>${escapeHtml(student.index)}</td><td>${escapeHtml(student.name)}</td>${subjectCells}${allHeaders}</tr>`;
  }).join("");
  const averages = snapshot.subjects.map((subject) => `<li>${escapeHtml(subject.subject)}: ${escapeHtml(subject.average)}</li>`).join("");
  const logoHtml = header(snapshot, meta);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(snapshot.grade)} ${escapeHtml(snapshot.division)} results</title><style>${commonStyles}</style></head>
  <body>${logoHtml}<table><thead><tr><th>Index</th><th>Student</th>${subjectNames.map((subject) => `<th>${escapeHtml(subject)}</th>`).join("")}${headers}</tr></thead><tbody>${rows}</tbody></table>
  <h2>Class average by subject</h2><ul>${averages}</ul>
  <div class="signature">${escapeHtml(snapshot.classTeacherName || "Class teacher")}<br>Class teacher signature</div>
  <script>window.addEventListener("load",()=>setTimeout(()=>window.print(),300));</script></body></html>`;
}

export function buildStudentResultsHtml(snapshot, studentIndex, meta = {}) {
  const student = snapshot.students.find((item) => String(item.index) === String(studentIndex));
  if (!student) throw new Error("Student is not included in this published snapshot.");
  const marks = marksFor(snapshot, studentIndex);
  const modules = modulesFor(marks);
  const summary = studentTotals(modules, snapshot.scale);
  const gpa = studentGpa(modules, snapshot.scale);
  const gpaCell = snapshot.gradeOnly ? "" : `<th>GPA</th>`;
  const gpaValue = snapshot.gradeOnly ? "" : `<td>${gpa.gpa.toFixed(2)}</td>`;
  const rows = marks.map(({ subject, mark }) => {
    const result = moduleResult({ ...mark, absent: !!mark.absent }, snapshot.scale);
    return `<tr><td>${escapeHtml(subject)}</td><td>${result.absent ? `AB${mark.absentRemark ? `: ${escapeHtml(mark.absentRemark)}` : ""}` : escapeHtml(result.total ?? "—")}</td><td>${escapeHtml(result.grade)}</td></tr>`;
  }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(student.name)} report card</title><style>${commonStyles}</style></head><body>
  ${header(snapshot, meta)}<h2>Student report card</h2><p><b>${escapeHtml(student.name)}</b> · Index ${escapeHtml(student.index)}</p>
  <table><thead><tr><th>Subject</th><th>Total</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table>
  <table><thead><tr><th>Total</th><th>Average</th><th>Overall grade</th>${gpaCell}</tr></thead><tbody><tr><td>${summary.total}</td><td>${summary.avg}</td><td>${escapeHtml(gpa.grade)}</td>${gpaValue}</tr></tbody></table>
  <div class="signature">${escapeHtml(snapshot.classTeacherName || "Class teacher")}<br>Class teacher signature</div>
  <script>window.addEventListener("load",()=>setTimeout(()=>window.print(),300));</script></body></html>`;
}

export function buildSubjectMarksHtml({ assignment, subject, students, sheet, cfg, year, term, meta = {}, gradeOnly = false }) {
  const rows = students.map((student) => {
    const mark = (Array.isArray(sheet?.marks) ? sheet.marks : []).find((item) => item && String(item.studentId) === String(student.index)) || {};
    const result = moduleResult({ ...mark, absent: !!mark.absent }, cfg.scale);
    const gpa = result.credit ? result.points / result.credit : 0;
    const activities = (Array.isArray(mark.activities) ? mark.activities : []).map((activity) => `${escapeHtml(activity.title || "Activity")}: ${escapeHtml(activity.mark ?? "—")}/${escapeHtml(activity.max ?? "—")}`).join("<br>");
    const extra = gradeOnly ? "" : `<td>${result.gpv.toFixed(2)}</td><td>${result.points.toFixed(2)}</td><td>${gpa.toFixed(2)}</td>`;
    return `<tr><td>${escapeHtml(student.index)}</td><td>${escapeHtml(student.name)}</td><td>${escapeHtml(subject)}</td><td>${escapeHtml(mark.absent ? "Absent" : mark.formative ?? "—")}</td><td>${escapeHtml(mark.absent ? "—" : mark.summative ?? "—")}</td><td>${escapeHtml(mark.credit ?? "—")}</td><td>${mark.absent ? "Yes" : "No"}</td><td>${escapeHtml(mark.absentRemark || "—")}</td><td>${escapeHtml(mark.absent ? "AB" : result.total ?? "—")}</td><td>${escapeHtml(result.grade)}</td>${extra}<td>${activities || "—"}</td></tr>`;
  }).join("");
  const gradeColumns = gradeOnly ? "" : "<th>GPV</th><th>Points</th><th>GPA</th>";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(subject)} marks</title><style>${commonStyles}</style></head><body>
  <h1>${escapeHtml(meta.schoolName || "School results")}</h1>
  <div class="meta">${escapeHtml(assignment.grade)} ${escapeHtml(assignment.division)} · ${escapeHtml(subject)} · ${escapeHtml(term)} ${escapeHtml(year)}<br>
  Status: ${escapeHtml(sheet?.lastAction === "Changes requested" ? "Changes requested" : sheet?.status || "Draft")}</div>
  <table><thead><tr><th>Index no</th><th>Student name</th><th>Subject</th><th>Formative</th><th>Summative</th><th>Credit</th><th>Absent</th><th>Absent remark</th><th>Total</th><th>Grade</th>${gradeColumns}<th>Activities</th></tr></thead><tbody>${rows}</tbody></table>
  <script>window.addEventListener("load",()=>setTimeout(()=>window.print(),300));</script></body></html>`;
}

export function printResultsHtml(html, openWindow = (...args) => window.open(...args)) {
  const printWindow = openWindow("", "_blank");
  if (!printWindow) throw new Error("The print window was blocked. Allow pop-ups to make a PDF.");
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
