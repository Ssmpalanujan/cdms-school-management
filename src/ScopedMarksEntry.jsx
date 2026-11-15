import { useMemo, useState } from "react";
import ActivitiesDialog from "./ActivitiesDialog.jsx";
import { moduleResult, num, validate } from "./grading.js";
import { idOf } from "./auth.js";
import { canEditSubject, removeSubjectMark, resultSheetKey, submitSubject, teacherScopes, updateSubjectMarks } from "./resultsWorkflow.js";
import { toast } from "./toastBus.js";
import { buildSubjectMarksHtml, printResultsHtml } from "./resultsPdf.js";
import Icon from "./Icon.jsx";

const same = (left, right) => String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
const subjectKey = (year, term, assignment, subject) => resultSheetKey(year, term, assignment.grade, assignment.division, subject);

function getMark(results, year, term, assignment, subject, student) {
  const sheet = results?.sheets?.[subjectKey(year, term, assignment, subject)];
  return sheet?.marks?.find((mark) => same(mark.studentId, student.index)) || {
    studentId: student.index, name: student.name, formative: "", summative: "", credit: 1,
    absent: false, absentRemark: "", activities: [],
  };
}

export default function ScopedMarksEntry({ s, embedded = false }) {
  const { user, meta, classAssignments = [], students = [], results, setResults, cfg, gradeOnly, setGradeOnly } = s;
  const userId = idOf(user);
  const year = String(meta.year);
  const term = meta.term;
  const assignments = user.role === "admin"
    ? classAssignments.filter((assignment) => !assignment.year || String(assignment.year) === year)
    : teacherScopes({ ...user, id: userId }, classAssignments, year);
  const mine = assignments.flatMap((assignment) => (assignment.subjects || [])
    .filter((subject) => user.role === "admin" || subject.teacherId === userId)
    .map((subject) => ({ assignment: { ...assignment, year }, subject })));
  const [selected, setSelected] = useState("");
  const [activitiesStudent, setActivitiesStudent] = useState(null);
  const [activeStudentId, setActiveStudentId] = useState("");
  const selectedItem = mine.find(({ assignment, subject }) => subjectKey(year, term, assignment, subject.subject) === selected) || mine[0];
  const assignment = selectedItem?.assignment;
  const subject = selectedItem?.subject;
  const roster = useMemo(() => assignment ? students
    .filter((student) => same(student.grade, assignment.grade) && same(student.division, assignment.division))
    .sort((left, right) => left.name.localeCompare(right.name)) : [], [students, assignment?.grade, assignment?.division]);
  const sheetKey = assignment && subject ? subjectKey(year, term, assignment, subject.subject) : "";
  const sheet = sheetKey ? results?.sheets?.[sheetKey] : null;
  const editable = assignment && subject && canEditSubject({ ...user, id: userId }, assignment, subject.subject, sheet, classAssignments);
  const missing = roster.filter((student) => {
    const mark = getMark(results, year, term, assignment, subject.subject, student);
    return mark.absent ? !String(mark.absentRemark || "").trim() : num(mark.formative) == null && num(mark.summative) == null;
  });
  const validationErrors = roster.flatMap((student) => {
    const mark = getMark(results, year, term, assignment, subject.subject, student);
    return validate([{ ...mark, moduleTitle: subject.subject, moduleId: subject.subject }], cfg)
      .map((error) => `${student.name}: ${error.replace(/^Row 1:? ?/, "")}`);
  });
  const update = (student, patch) => {
    try {
      setResults(updateSubjectMarks(results, {
        user: { ...user, id: userId }, assignment, subject: subject.subject, student, patch, year, term,
        assignments: classAssignments, students,
      }));
    } catch (error) {
      toast(error.message || "Could not save this mark.", "bad");
    }
  };
  const adjustCredit = (student, credit, delta) => {
    const current = num(credit) ?? 1;
    const next = Math.max(0.01, Math.round((current + delta * 0.25) * 100) / 100);
    update(student, { credit: String(next) });
  };
  const removeMark = (student) => {
    if (!window.confirm(`Remove ${subject.subject} marks for ${student.name}?`)) return;
    try {
      setResults(removeSubjectMark(results, {
        user: { ...user, id: userId }, assignment, subject: subject.subject, student, year, term,
        assignments: classAssignments, students,
      }));
      toast(`Removed ${subject.subject} marks for ${student.name}.`);
    } catch (error) {
      toast(error.message || "Could not remove these marks.", "bad");
    }
  };
  const submit = () => {
    try {
      if (missing.length) throw new Error(`${missing.length} student${missing.length === 1 ? " is" : "s are"} missing marks or an absent remark.`);
      if (validationErrors.length) throw new Error(validationErrors[0]);
      setResults(submitSubject(results, { user: { ...user, id: userId }, assignment, subject: subject.subject, year, term, assignments: classAssignments }));
      toast(`${subject.subject} submitted to the class teacher.`);
    } catch (error) { toast(error.message || "Could not submit marks.", "bad"); }
  };
  const makePdf = () => {
    try { printResultsHtml(buildSubjectMarksHtml({ assignment, subject: subject.subject, students: roster, sheet, cfg, year, term, meta, gradeOnly })); }
    catch (error) { toast(error.message || "Could not create the marks PDF.", "bad"); }
  };
  const calculate = () => {
    if (missing.length) {
      toast(`${missing.length} student${missing.length === 1 ? " is" : "s are"} missing marks or an absent remark.`, "bad");
      return;
    }
    if (validationErrors.length) {
      toast(validationErrors[0], "bad");
      return;
    }
    toast(`Calculated results for ${subject.subject}.`);
  };
  const activeStudent = roster.find((student) => same(student.index, activeStudentId) && !getMark(results, year, term, assignment, subject.subject, student).absent)
    || roster.find((student) => !getMark(results, year, term, assignment, subject.subject, student).absent);
  if (!mine.length) return <section id={embedded ? "modules" : undefined} className="card scoped-marks-entry">
    {embedded ? <h3>Marks entry</h3> : <h2>Marks entry</h2>}<p className="muted">{user.role === "admin" ? `No class subjects are assigned for ${year}. Configure them on Assign teachers.` : `No subject has been assigned to your teacher account for ${year}. Ask an administrator to assign your classes and subjects.`}</p>
  </section>;

  return <>
    {!embedded && <div className="pagehead"><div><h2>{user.role === "admin" ? "Scoped marks correction" : "Marks entry"}</h2><span className="muted">{user.role === "admin" ? "Admin override for assigned classes. Published results must be unpublished first." : "Only your assigned classes and subjects are available."}</span></div></div>}
    <section id={embedded ? "modules" : undefined} className="card scoped-marks-entry">
      {embedded && <div className="acthead scoped-marks-heading"><h3>Marks entry <span className="muted small">{assignment.grade} {assignment.division} · {term} {year}</span></h3></div>}
      <div className="grid workflow-filters scoped-assignment-filter">
        <label className="field"><span>Class and subject</span><select id="assigned-class-subject" aria-label="Assigned class and subject" value={selectedItem ? subjectKey(year, term, selectedItem.assignment, selectedItem.subject.subject) : ""} onChange={(event) => setSelected(event.target.value)}>
          {mine.map(({ assignment: itemAssignment, subject: itemSubject }) => {
            const value = subjectKey(year, term, itemAssignment, itemSubject.subject);
            return <option key={value} value={value}>{itemAssignment.grade} {itemAssignment.division} · {itemSubject.subject}</option>;
          })}
        </select></label>
      </div>
      {sheet?.reviewComment && <p className="alert">{sheet.reviewComment}</p>}
      {!roster.length ? <p className="muted">No students are listed for {assignment.grade} {assignment.division}. Add the students before entering marks.</p> : <>
        <p className="muted">{roster.length - missing.length}/{roster.length} students have marks or an absent remark for {subject.subject}.</p>
        {!editable && <p className="alert">This subject is {sheet?.status || "locked"} and cannot be edited until changes are requested or results are corrected.</p>}
        <div className="scroll"><table className="tbl small scoped-marks-table">
          <thead><tr><th>Index no</th><th>Student name</th><th>Subject</th><th>Formative (0–{cfg.fmax})</th><th>Summative (0–{100 - cfg.fmax})</th><th>Credit</th><th>Total</th><th>Grade</th><th>GPV</th><th>Points</th><th>GPA</th><th>Actions</th></tr></thead>
          <tbody>{roster.map((student) => {
            const mark = getMark(results, year, term, assignment, subject.subject, student);
            const result = moduleResult({ ...mark, absent: !!mark.absent }, cfg.scale);
            const gpa = result.credit ? result.points / result.credit : 0;
            const hasSavedMark = !!sheet?.marks?.some((item) => same(item.studentId, student.index));
            return <tr key={student.index} className={mark.absent ? "absent" : ""} onFocusCapture={() => setActiveStudentId(student.index)}>
              <td>{student.index}</td><td>{student.name}</td><td>{subject.subject}</td>
              <td><input aria-label={`${student.name} formative`} type="number" min="0" max={cfg.fmax} disabled={!editable || mark.absent || (mark.activities || []).length > 0} value={mark.formative ?? ""} onChange={(event) => update(student, { formative: event.target.value })} /></td>
              <td><input aria-label={`${student.name} summative`} type="number" min="0" max={100 - cfg.fmax} disabled={!editable || mark.absent} value={mark.summative ?? ""} onChange={(event) => update(student, { summative: event.target.value })} /></td>
              <td><div className="scoped-credit-control">
                <input aria-label={`${student.name} credit`} type="number" min="0.01" step="0.25" disabled={!editable || mark.absent} value={mark.credit ?? 1} onChange={(event) => update(student, { credit: event.target.value })} />
                <span className="scoped-credit-steps">
                  <button type="button" aria-label={`${student.name} increase credit`} title="Increase credit" disabled={!editable || mark.absent} onClick={() => adjustCredit(student, mark.credit, 1)}><Icon name="up" size={13} /></button>
                  <button type="button" aria-label={`${student.name} decrease credit`} title="Decrease credit" disabled={!editable || mark.absent || (num(mark.credit) ?? 1) <= 0.01} onClick={() => adjustCredit(student, mark.credit, -1)}><Icon name="down" size={13} /></button>
                </span>
              </div></td>
              <td>{result.absent ? "AB" : result.total ?? "—"}</td><td>{result.grade}</td>
              <td>{result.gpv.toFixed(2)}</td><td>{result.points.toFixed(2)}</td><td>{gpa.toFixed(2)}</td>
              <td className="scoped-mark-row-actions">
                <button type="button" className="btn ghost sm" disabled={!editable} onClick={() => update(student, mark.absent
                  ? { absent: false, absentRemark: "" }
                  : { absent: true, formative: "", summative: "", activities: [], absentRemark: "" })}>
                  {mark.absent ? "Clear absent" : "Mark absent"}
                </button>
                {mark.absent && <input aria-label={`${student.name} absent remark`} placeholder="Absence reason" disabled={!editable} value={mark.absentRemark || ""} onChange={(event) => update(student, { absentRemark: event.target.value })} />}
                <button type="button" className="btn danger sm" disabled={!editable || !hasSavedMark} onClick={() => removeMark(student)}>Remove</button>
              </td>
            </tr>;
          })}</tbody>
        </table></div>
        {validationErrors.length > 0 && <div className="alert bad" role="status"><b>Fix before submitting:</b><ul>{[...new Set(validationErrors)].slice(0, 10).map((error) => <li key={error}>{error}</li>)}</ul></div>}
        {missing.length > 0 && <p className="muted">Missing: {missing.map((student) => `${student.name} (${student.index})`).join(", ")}</p>}
        <div className="scoped-mark-actions">
          <button type="button" className="btn" onClick={() => document.getElementById("assigned-class-subject")?.focus()}>Choose module</button>
          <button type="button" className="btn" disabled={!editable || !activeStudent} title={activeStudent ? `Edit activities for ${activeStudent.name}` : "No available student row"} onClick={() => activeStudent && setActivitiesStudent(activeStudent)}>Activities{activeStudent ? ` (${(getMark(results, year, term, assignment, subject.subject, activeStudent).activities || []).length})` : ""}</button>
          <button type="button" className="btn" onClick={calculate}>Calculate</button>
          <button type="button" className="btn teal" disabled={!editable || !!missing.length || !!validationErrors.length} onClick={submit}>Submit to class teacher</button>
          <button type="button" className="btn teal" onClick={makePdf}>Print report</button>
        </div>
        <label className="switch printopt"><input type="checkbox" checked={!!gradeOnly} onChange={(event) => setGradeOnly(event.target.checked)} /><span>Print grades only. GPA, GPV and points are left off the printed reports.</span></label>
      </>}
    </section>
    {activitiesStudent && (() => {
      const mark = getMark(results, year, term, assignment, subject.subject, activitiesStudent);
      return <ActivitiesDialog title={`${activitiesStudent.name} · ${subject.subject}`} initial={mark.activities || []} fmax={cfg.fmax}
        onClose={() => setActivitiesStudent(null)}
        onSave={(activities, total) => {
          update(activitiesStudent, { activities, formative: activities.length && total != null ? String(total) : mark.formative });
          setActivitiesStudent(null);
        }} />;
    })()}
  </>;
}
