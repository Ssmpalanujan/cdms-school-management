import { useMemo, useState } from "react";
import { idOf, readUsers } from "./auth.js";
import { moduleResult, studentGpa, studentTotals } from "./grading.js";
import { toast } from "./toastBus.js";
import {
  canReviewClass, classSubjectsStatus, normalizeResults, publishClass,
  publishReadiness, publishedResultsForStudent, resultClassKey, resultNotificationCount,
  resultSheetKey, reviewSubject, unpublishClass, visibleNotifications,
} from "./resultsWorkflow.js";
import { buildClassResultsHtml, buildStudentResultsHtml, printResultsHtml } from "./resultsPdf.js";
import ScopedMarksEntry from "./ScopedMarksEntry.jsx";

const same = (left, right) => String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
const classLabel = (assignment) => `${assignment.grade} ${assignment.division}`;
const statusClass = (status) => `workflow-status status-${String(status || "Draft").toLowerCase().replace(/\s+/g, "-")}`;

function classRoster(students, assignment) {
  return students.filter((student) => same(student.grade, assignment.grade) && same(student.division, assignment.division))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function sheetFor(results, year, term, assignment, subject) {
  return normalizeResults(results).sheets[resultSheetKey(year, term, assignment.grade, assignment.division, subject)] || { marks: [], status: "Draft" };
}

function countMarks(sheet, roster) {
  const keys = new Set((sheet?.marks || []).map((mark) => String(mark.studentId).trim().toLowerCase()));
  return { entered: roster.filter((student) => keys.has(String(student.index).trim().toLowerCase())).length, total: roster.length };
}

export default function ResultsWorkflow({ s }) {
  const { role, user, meta, classAssignments = [], students = [], results, setResults, cfg, gradeOnly } = s;
  const [year, setYear] = useState(String(meta.year));
  const [term, setTerm] = useState(meta.term);
  const [gradeFilter, setGradeFilter] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("");
  const [auditFilter, setAuditFilter] = useState("");
  const [comments, setComments] = useState({});
  const reviewer = { ...user, id: idOf(user) };
  const allAssignments = classAssignments.filter((assignment) => !assignment.year || String(assignment.year) === year);
  const scopes = allAssignments.filter((assignment) => role === "admin"
    || assignment.classTeacherId === reviewer.id
    || assignment.subjects?.some((subject) => subject.teacherId === reviewer.id));
  const visibleAssignments = scopes.filter((assignment) =>
    (!gradeFilter || same(assignment.grade, gradeFilter))
      && (!divisionFilter || same(assignment.division, divisionFilter)),
  );
  const users = useMemo(() => readUsers(), []);
  const teacherName = (id) => users.find((account) => idOf(account) === id)?.name || "Teacher login unavailable";
  const notices = visibleNotifications(results, reviewer, null);
  const audit = normalizeResults(results).audit.filter((entry) =>
    (!auditFilter || entry.action === auditFilter)
      && String(entry.year) === year
      && entry.term === term
      && (!gradeFilter || same(entry.grade, gradeFilter))
      && (!divisionFilter || same(entry.division, divisionFilter)),
  );
  const grades = [...new Set(allAssignments.map((assignment) => assignment.grade))].sort();
  const divisions = [...new Set(allAssignments.filter((assignment) => !gradeFilter || same(assignment.grade, gradeFilter)).map((assignment) => assignment.division))].sort();
  const isAdmin = role === "admin";

  const notifyActionError = (error) => toast(error.message || "Could not update results.", "bad");
  const doReview = (assignment, subject, decision) => {
    try {
      const comment = comments[resultSheetKey(year, term, assignment.grade, assignment.division, subject)] || "";
      setResults(reviewSubject(results, { user: reviewer, assignment, subject, year, term, decision, comment, assignments: classAssignments }));
      setComments((current) => ({ ...current, [resultSheetKey(year, term, assignment.grade, assignment.division, subject)]: "" }));
      toast(decision === "approve" ? `${subject} approved` : `Changes requested for ${subject}`);
    } catch (error) { notifyActionError(error); }
  };
  const doPublish = (assignment) => {
    const roster = classRoster(students, assignment);
    if (!window.confirm(`Publish results for ${classLabel(assignment)} · ${term} ${year}?\nStudents: ${roster.length}\nGrade-only: ${gradeOnly ? "Yes" : "No"}\nGPA shown: ${gradeOnly ? "No" : "Yes"}`)) return;
    try {
      setResults(publishClass(results, {
        user: reviewer, assignment, year, term, students: roster, cfg, gradeOnly,
        classTeacherName: teacherName(assignment.classTeacherId), assignments: classAssignments,
      }));
      toast(`Results published for ${classLabel(assignment)}`);
    } catch (error) { notifyActionError(error); }
  };
  const doUnpublish = (assignment) => {
    const reason = window.prompt("Enter the reason for unpublishing and correcting these results.");
    if (reason === null) return;
    try {
      setResults(unpublishClass(results, { user: reviewer, assignment, year, term, reason, assignments: classAssignments }));
      toast(`Results unpublished for correction: ${classLabel(assignment)}`);
    } catch (error) { notifyActionError(error); }
  };
  const doPrintClass = (snapshot) => {
    try { printResultsHtml(buildClassResultsHtml(snapshot, meta)); } catch (error) { notifyActionError(error); }
  };
  const doPrintStudent = (snapshot, studentId) => {
    try { printResultsHtml(buildStudentResultsHtml(snapshot, studentId, meta)); } catch (error) { notifyActionError(error); }
  };

  return (
    <>
      {isAdmin && <ScopedMarksEntry s={s} />}
      <div className="pagehead"><h2>Results workflow</h2><span className="muted">{role === "admin" ? "All assigned classes" : "Your assigned classes and subjects"}</span></div>
      <section className="card">
        <div className="filters workflow-filters">
          <label className="field"><span>Academic year</span><input type="number" aria-label="Workflow year" value={year} onChange={(event) => setYear(event.target.value)} /></label>
          <label className="field"><span>Term</span><select aria-label="Workflow term" value={term} onChange={(event) => setTerm(event.target.value)}>{["Term 1", "Term 2", "Term 3"].map((item) => <option key={item}>{item}</option>)}</select></label>
          {isAdmin && <>
            <label className="field"><span>Grade</span><select aria-label="Filter grade" value={gradeFilter} onChange={(event) => { setGradeFilter(event.target.value); setDivisionFilter(""); }}><option value="">All grades</option>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="field"><span>Division</span><select aria-label="Filter division" value={divisionFilter} onChange={(event) => setDivisionFilter(event.target.value)}><option value="">All divisions</option>{divisions.map((item) => <option key={item}>{item}</option>)}</select></label>
          </>}
        </div>
        {!visibleAssignments.length ? <p className="muted">{isAdmin ? "No class assignments for this year and filter. Configure them on Assign teachers." : "No classes or subjects are assigned to your teacher account for this academic year."}</p> : (
          <div className="workflow-class-list">
            {visibleAssignments.map((assignment) => {
              const normalizedAssignment = { ...assignment, year, term, subjects: assignment.subjects || [] };
              const roster = classRoster(students, assignment);
              const isReviewer = canReviewClass(reviewer, assignment, classAssignments);
              const allowedSubjects = isReviewer ? normalizedAssignment.subjects : normalizedAssignment.subjects.filter((subject) => subject.teacherId === reviewer.id);
              const subjectStates = classSubjectsStatus(results, normalizedAssignment, year, term);
              const key = resultClassKey(year, term, assignment.grade, assignment.division);
              const published = normalizeResults(results).classes[key];
              const readiness = publishReadiness({ assignment: normalizedAssignment, students: roster, sheets: normalizeResults(results).sheets, cfg });
              const approved = subjectStates.filter((item) => item.sheet.status === "Approved" || item.sheet.status === "Published").length;
              return (
                <article className="workflow-class" key={`${assignment.year || year}|${assignment.grade}|${assignment.division}`}>
                  <div className="acthead workflow-class-head">
                    <div><h3>{classLabel(assignment)} · {term} {year}</h3><span className="muted">Class teacher: {teacherName(assignment.classTeacherId)} · {roster.length} students</span></div>
                    <span className={statusClass(published?.published ? "Published" : approved === subjectStates.length && subjectStates.length ? "Approved" : "Draft")}>{published?.published ? `Published · v${published.version}` : `${approved}/${subjectStates.length} approved`}</span>
                  </div>
                  {!assignment.classTeacherId && <p className="alert bad">Assign a class teacher before publishing.</p>}
                  {!subjectStates.length && <p className="muted">No subjects are assigned for this class.</p>}
                  {allowedSubjects.length > 0 && (
                    <div className="scroll">
                      <table className="tbl small workflow-subject-table">
                        <thead><tr><th>Subject</th><th>Teacher</th><th>Status</th><th>Marks entered</th><th>Next action</th></tr></thead>
                        <tbody>{allowedSubjects.map((subject) => {
                          const sheet = sheetFor(results, year, term, assignment, subject.subject);
                          const counts = countMarks(sheet, roster);
                          const subjectKey = resultSheetKey(year, term, assignment.grade, assignment.division, subject.subject);
                          return <tr key={subject.subject}>
                            <td>{subject.subject}</td><td>{teacherName(subject.teacherId)}</td><td><span className={statusClass(sheet.lastAction === "Changes requested" && sheet.status === "Draft" ? "Changes requested" : sheet.status)}>{sheet.lastAction === "Changes requested" && sheet.status === "Draft" ? "Changes requested" : sheet.status}</span></td>
                            <td>{counts.entered}/{counts.total}{counts.entered < counts.total && <small className="reason">{counts.total - counts.entered} missing</small>}</td>
                            <td className="workflow-actions">
                              {!published?.published && sheet.status === "Submitted" && isReviewer && <>
                                <button type="button" className="btn sm" onClick={() => doReview(normalizedAssignment, subject.subject, "approve")}>Approve</button>
                                <textarea aria-label={`Comment for ${subject.subject}`} placeholder="Comment required for changes" rows={2} value={comments[subjectKey] || ""} onChange={(event) => setComments({ ...comments, [subjectKey]: event.target.value })} />
                                <button type="button" className="btn ghost sm" onClick={() => doReview(normalizedAssignment, subject.subject, "changes")}>Request changes</button>
                              </>}
                              {!published?.published && sheet.status === "Draft" && subject.teacherId === reviewer.id && <button type="button" className="btn sm" onClick={() => s.go("builder")}>Enter marks</button>}
                              {sheet.reviewComment && <small className="reason">Comment: {sheet.reviewComment}</small>}
                            </td>
                          </tr>;
                        })}</tbody>
                      </table>
                    </div>
                  )}
                  {isReviewer && (
                    <>
                      {!published?.published && readiness.reasons.length > 0 && <ul className="workflow-blockers">{readiness.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
                      <div className="row workflow-footer">
                        {published?.published ? <>
                          <button type="button" className="btn" onClick={() => doPrintClass(published)}>Make class PDF</button>
                          <button type="button" className="btn ghost" onClick={() => doUnpublish(normalizedAssignment)}>Unpublish / correct</button>
                        </> : <>
                          <button type="button" className="btn" disabled={!readiness.allowed} onClick={() => doPublish(normalizedAssignment)}>Publish results</button>
                          <span className="muted">Publishing creates Version {(Number(published?.version) || 0) + 1}.</span>
                        </>}
                      </div>
                      {published?.published && <div className="student-pdf-list">
                        <b>Individual report PDFs</b>
                        <div className="row">{roster.map((student) => <button key={student.index} type="button" className="btn ghost sm" onClick={() => doPrintStudent(published, student.index)}>{student.name} · PDF</button>)}</div>
                      </div>}
                      {!!roster.length && <div className="scroll workflow-preview">
                        <table className="tbl small"><thead><tr><th>Student</th>{normalizedAssignment.subjects.map((subject) => <th key={subject.subject}>{subject.subject}</th>)}</tr></thead>
                          <tbody>{roster.slice(0, 5).map((student) => <tr key={student.index}><td>{student.name}</td>{normalizedAssignment.subjects.map((subject) => {
                            const mark = sheetFor(results, year, term, assignment, subject.subject).marks?.find((item) => same(item.studentId, student.index));
                            const total = mark ? moduleResult({ ...mark, absent: !!mark.absent }, cfg.scale) : null;
                            return <td key={subject.subject}>{!mark ? "Missing" : total.absent ? `AB${mark.absentRemark ? `: ${mark.absentRemark}` : ""}` : `${total.total ?? "—"} · ${total.grade}`}</td>;
                          })}</tr>)}</tbody>
                        </table>
                        {roster.length > 5 && <small className="muted">Previewing 5 of {roster.length} students.</small>}
                      </div>}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
      {isAdmin && <section className="card">
        <div className="acthead"><h3>Results audit log</h3><select aria-label="Audit action filter" value={auditFilter} onChange={(event) => setAuditFilter(event.target.value)}><option value="">All actions</option>{["Submitted", "Approved", "Changes requested", "Published", "Unpublished"].map((item) => <option key={item}>{item}</option>)}</select></div>
        {!audit.length ? <p className="muted">No results workflow events yet.</p> : <div className="scroll"><table className="tbl small">
          <thead><tr><th>Date</th><th>Action</th><th>Actor</th><th>Class / subject</th><th>Reason</th></tr></thead>
          <tbody>{audit.map((entry) => <tr key={entry.id}><td>{new Date(entry.at).toLocaleString()}</td><td>{entry.action}</td><td>{entry.actor}</td><td>{entry.grade} {entry.division} · {entry.subject || "All subjects"} · {entry.term} {entry.year}</td><td>{entry.reason || "—"}</td></tr>)}</tbody>
        </table></div>}
      </section>}
      <section className="card">
        <h3>Results notifications <span className="chip plain">{resultNotificationCount(results, reviewer, null)}</span></h3>
        {!notices.length ? <p className="muted">No results notifications yet.</p> : <ul className="remlist workflow-notification-list">{notices.slice(0, 10).map((notice) => <li key={notice.id}>{notice.message}<small className="reason">{new Date(notice.at).toLocaleString()}</small></li>)}</ul>}
      </section>
    </>
  );
}

export function StudentPublishedResults({ s, compact = false, onView, showHistory = false }) {
  const { user, students, results, cfg, meta } = s;
  const student = students.find((item) => same(item.index, user.studentId));
  const [selectedKey, setSelectedKey] = useState("");
  const reports = useMemo(() => publishedResultsForStudent(results, {
    studentId: user.studentId, grade: student?.grade, division: student?.division,
  }, undefined, s.enrollments || []), [results, user.studentId, student?.grade, student?.division, s.enrollments]);
  const reportKey = (snapshot) => `${snapshot.year}|${snapshot.term}|${snapshot.grade}|${snapshot.division}`;
  const latest = reports.find((snapshot) => reportKey(snapshot) === selectedKey) || reports[0];
  const notices = visibleNotifications(results, { id: user.studentId, role: "student" }, student);
  if (!latest) return <section className="card student-published-results"><h3>Results published</h3><p className="muted">There are no published results for your class yet. Your results will appear here after your class teacher publishes them.</p></section>;
  const modules = latest.ownMarks.map((subject) => ({ ...subject.marks[0], moduleTitle: subject.subject, absent: !!subject.marks[0]?.absent })).filter((module) => module.studentId);
  const scale = latest.scale?.length ? latest.scale : cfg.scale;
  const totals = studentTotals(modules, scale);
  const gpa = studentGpa(modules, scale);
  const gradeOnlyMode = !!latest.gradeOnly;
  const makePdf = () => {
    try { printResultsHtml(buildStudentResultsHtml(latest, user.studentId, meta)); }
    catch (error) { toast(error.message, "bad"); }
  };
  return <section className="card student-published-results">
    <div className="acthead"><div><h3>Results published · {latest.term} {latest.year}</h3><span className="muted">Published {new Date(latest.publishedAt).toLocaleDateString()} · Version {latest.version}</span></div>
      <div className="row"><button type="button" className="btn ghost" onClick={() => onView ? onView() : document.getElementById("student-results-details")?.scrollIntoView({ behavior: "smooth" })}>View</button><button type="button" className="btn" onClick={makePdf}>Download my PDF</button></div>
    </div>
    {showHistory && reports.length > 1 && <label className="field"><span>Published term</span><select aria-label="Published results term" value={reportKey(latest)} onChange={(event) => setSelectedKey(event.target.value)}>{reports.map((snapshot) => <option key={reportKey(snapshot)} value={reportKey(snapshot)}>{snapshot.term} {snapshot.year} · Version {snapshot.version}</option>)}</select></label>}
    <>
      <div className="statrow">
        <div><b>{totals.avg.toFixed(1)}</b><span>Average</span></div>
        {!gradeOnlyMode && <div><b>{gpa.gpa.toFixed(2)}</b><span>GPA</span></div>}
        <div><b>{gpa.grade}</b><span>Grade</span></div>
        <div><b>{modules.length}</b><span>Subjects</span></div>
      </div>
      <div id="student-results-details" className="scroll"><table className="tbl small"><thead><tr><th>Subject</th><th>Total</th><th>Grade</th></tr></thead>
        <tbody>{latest.ownMarks.map((subject) => {
          const mark = subject.marks[0] || {};
          const result = moduleResult({ ...mark, absent: !!mark.absent }, scale);
          return <tr key={subject.subject}><td>{subject.subject}</td><td>{result.absent ? `AB${mark.absentRemark ? `: ${mark.absentRemark}` : ""}` : result.total ?? "—"}</td><td>{result.grade}</td></tr>;
        })}</tbody>
      </table></div>
    </>
    {notices.length > 0 && <div className="result-notices"><b>Results notifications</b><ul className="remlist">{notices.slice(0, 5).map((notice) => <li key={notice.id}>{notice.message}</li>)}</ul></div>}
  </section>;
}
