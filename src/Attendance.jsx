import { useMemo, useState } from "react";
import { logActivity } from "./activity.js";

const STATUSES = ["Present", "Absent", "Late", "Excused"];
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function Attendance({ s }) {
  if (s.role === "student") return <StudentAttendance attendance={s.attendance} studentId={s.user.studentId} />;
  return <StaffAttendance s={s} />;
}

function StudentAttendance({ attendance, studentId }) {
  const records = Object.entries(attendance || {})
    .map(([date, marks]) => ({ date, ...(marks?.[studentId] || {}) }))
    .filter((record) => STATUSES.includes(record.status))
    .sort((a, b) => b.date.localeCompare(a.date));
  const totals = Object.fromEntries(STATUSES.map((status) => [status, records.filter((record) => record.status === status).length]));
  const attendedDays = totals.Present + totals.Late;
  const countedDays = attendedDays + totals.Absent;
  const rate = countedDays ? `${Math.round((attendedDays / countedDays) * 100)}%` : "—";

  return (
    <>
      <div className="pagehead"><h2>My attendance</h2></div>
      {!studentId ? <div className="alert bad" role="alert">Your login is not linked to a student record. Ask the admin to link it.</div> : (
        <>
          <section className="card">
            <h3>Attendance summary</h3>
            <div className="kpis attendance-kpis student-attendance-kpis">
              <div className="card kpi"><span className="muted">Attendance rate</span><b>{rate}</b></div>
              {STATUSES.map((status) => <div className="card kpi" key={status}><span className="muted">{status}</span><b>{totals[status]}</b></div>)}
            </div>
            <p className="muted">Present and late days count as attended; excused days are excluded from the rate.</p>
          </section>
          <section className="card">
            <h3>Attendance history</h3>
            {!records.length ? <p className="muted">No attendance has been recorded for you yet.</p> : (
              <div className="scroll">
                <table className="tbl attendance-table student-attendance-table">
                  <thead><tr><th>Date</th><th>Status</th></tr></thead>
                  <tbody>{records.map((record) => <tr key={record.date}><td>{record.date}</td><td>{record.status}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

function StaffAttendance({ s }) {
  const { students, attendance, setAttendance } = s;
  const [date, setDate] = useState(today);
  const [grade, setGrade] = useState("");
  const [division, setDivision] = useState("");
  const roster = useMemo(() => students.filter((student) =>
    (!grade || student.grade === grade) && (!division || student.division === division),
  ).sort((a, b) => a.name.localeCompare(b.name)), [students, grade, division]);
  const day = attendance[date] || {};
  const summary = STATUSES.map((status) => [status, roster.filter((student) => (day[student.index]?.status || "") === status).length]);
  const absentCounts = new Map();
  for (const records of Object.values(attendance)) {
    for (const [studentId, mark] of Object.entries(records || {})) {
      if (mark.status === "Absent") absentCounts.set(studentId, (absentCounts.get(studentId) || 0) + 1);
    }
  }
  const frequent = students.map((student) => ({ student, count: absentCounts.get(student.index) || 0 })).filter(({ count }) => count >= 3).sort((a, b) => b.count - a.count);
  const saveStatus = (student, status) => {
    setAttendance((current) => ({ ...current, [date]: { ...(current[date] || {}), [student.index]: { ...current[date]?.[student.index], status } } }));
    logActivity("attendance", `${student.name} marked ${status} for ${date}`);
  };
  const markAllPresent = () => {
    if (!roster.length) return;
    setAttendance((current) => ({
      ...current,
      [date]: roster.reduce((marks, student) => ({ ...marks, [student.index]: { ...current[date]?.[student.index], status: "Present" } }), { ...(current[date] || {}) }),
    }));
    logActivity("attendance", `Marked ${roster.length} students present for ${date}`);
  };

  return (
    <>
      <div className="pagehead"><h2>Attendance</h2><button className="btn ghost" onClick={markAllPresent} disabled={!roster.length}>Mark all present</button></div>
      <section className="card">
        <div className="filters attendance-filters">
          <label className="field"><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label className="field"><span>Grade</span><select value={grade} onChange={(event) => setGrade(event.target.value)}><option value="">All grades</option>{[...new Set(students.map((student) => student.grade))].sort().map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="field"><span>Division</span><select value={division} onChange={(event) => setDivision(event.target.value)}><option value="">All divisions</option>{[...new Set(students.map((student) => student.division))].sort().map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <div className="kpis attendance-kpis">{summary.map(([status, count]) => <div className="card kpi" key={status}><span className="muted">{status}</span><b>{count}</b></div>)}</div>
        {!roster.length ? <p className="muted">Add students to record attendance.</p> : (
          <div className="scroll">
            <table className="tbl attendance-table">
              <thead><tr><th>Student</th><th>Index</th><th>Grade / Division</th><th>Status</th></tr></thead>
              <tbody>{roster.map((student) => <tr key={student.id}>
                <td>{student.name}</td><td>{student.index}</td><td>{student.grade} {student.division}</td>
                <td><select aria-label={`${student.name} attendance`} value={day[student.index]?.status || ""} onChange={(event) => saveStatus(student, event.target.value)}>
                  <option value="">Not marked</option>{STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
      <section className="card">
        <h3>Frequent absences</h3>
        {frequent.length ? <div className="scroll"><table className="tbl"><thead><tr><th>Student</th><th>Grade / Division</th><th>Absences recorded</th></tr></thead>
          <tbody>{frequent.map(({ student, count }) => <tr key={student.id}><td>{student.name}</td><td>{student.grade} {student.division}</td><td>{count}</td></tr>)}</tbody></table></div>
          : <p className="muted">No students have three or more recorded absences.</p>}
      </section>
    </>
  );
}
