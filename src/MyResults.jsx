import { StudentPublishedResults } from "./ResultsWorkflow.jsx";

export default function MyResults({ s }) {
  const { user, students } = s;
  const linked = students.some((student) => String(student.index).trim().toLowerCase() === String(user.studentId || "").trim().toLowerCase());
  if (!user.studentId || !linked) return <div className="card">
    <div className="pagehead"><h2>My results</h2></div>
    <p className="muted">{user.studentId ? "Your login is not linked to a student record in your class. Ask the administrator to link it." : "Your login is not linked to a student record. Ask the administrator to link it."}</p>
  </div>;
  return <>
    <div className="pagehead"><h2>My results</h2><span className="muted">Only results published for your class are shown here.</span></div>
    <StudentPublishedResults s={s} showHistory />
  </>;
}
