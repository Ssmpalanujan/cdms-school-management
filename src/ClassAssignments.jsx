import { useState } from "react";
import { idOf } from "./auth.js";
import { toast } from "./toastBus.js";
import { Field } from "./ui.jsx";
import PersonAvatar from "./PersonAvatar.jsx";
import { GRADES } from "./students.js";

export const SUBJECTS = [
  "Buddhism", "Civic Education", "Commerce", "Dancing", "Drama and Theatre",
  "English", "Geography", "Health and Physical Education", "History", "ICT",
  "Mathematics", "Music", "Science", "Sinhala", "Tamil", "Technology",
  "Aesthetics",
];

const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
const emptyForm = (meta) => ({
  year: String(meta.year || new Date().getFullYear()),
  grade: meta.grade || "",
  division: meta.className || "",
  classTeacherId: "",
  subjects: [{ subject: "", teacherId: "" }],
});

export default function ClassAssignments({ meta, students, assignments, setAssignments, users }) {
  const [form, setForm] = useState(() => emptyForm(meta));
  const [editKey, setEditKey] = useState("");
  const [error, setError] = useState("");
  const teachers = users.filter((user) => user.role === "teacher");
  const grades = [...new Set([...GRADES, ...students.map((student) => student.grade), ...assignments.map((assignment) => assignment.grade), form.grade].filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const divisions = [...new Set([
    ...students.filter((student) => same(student.grade, form.grade)).map((student) => student.division),
    ...assignments.filter((assignment) => same(assignment.grade, form.grade)).map((assignment) => assignment.division),
    ...(same(meta.grade, form.grade) ? [meta.className] : []),
    form.division,
  ].filter(Boolean))].sort();
  const classKey = (assignment, year = form.year) => `${String(assignment.year || year).trim()}|${String(assignment.grade).trim().toLowerCase()}|${String(assignment.division).trim().toLowerCase()}`;
  const teacherName = (id) => teachers.find((teacher) => idOf(teacher) === id)?.name || "";
  const assignmentRows = assignments.map((assignment) => {
    const assignedIds = [...new Set([assignment.classTeacherId, ...(assignment.subjects || []).map((subject) => subject.teacherId)].filter(Boolean))];
    return {
      key: classKey(assignment),
      assignment,
      assignedTeachers: teachers.filter((teacher) => assignedIds.includes(idOf(teacher))),
    };
  });
  const assignedTeacherIds = new Set(assignmentRows.flatMap((row) => row.assignedTeachers.map(idOf)));
  const overviewRows = [
    ...assignmentRows,
    ...teachers.filter((teacher) => !assignedTeacherIds.has(idOf(teacher))).map((teacher) => ({
      key: `unassigned|${idOf(teacher)}`,
      assignedTeachers: [teacher],
      assignment: null,
    })),
  ];

  const updateSubject = (index, key, value) => setForm((current) => ({
    ...current,
    subjects: current.subjects.map((subject, i) => i === index ? { ...subject, [key]: value } : subject),
  }));
  const edit = (assignment) => {
    setForm({
      year: String(assignment.year || meta.year),
      grade: assignment.grade,
      division: assignment.division,
      classTeacherId: assignment.classTeacherId,
      subjects: assignment.subjects?.length ? assignment.subjects : [{ subject: "", teacherId: "" }],
    });
    setEditKey(classKey(assignment));
    setError("");
  };
  const reset = () => {
    setForm(emptyForm(meta));
    setEditKey("");
    setError("");
  };
  const save = (event) => {
    event.preventDefault();
    const subjects = form.subjects.filter((item) => item.subject.trim() || item.teacherId);
    if (!/^\d{4}$/.test(form.year.trim())) return setError("Enter a four-digit academic year.");
    if (!form.grade.trim() || !form.division.trim()) return setError("Enter both grade and division.");
    if (form.classTeacherId && !teachers.some((teacher) => idOf(teacher) === form.classTeacherId)) return setError("Choose a class teacher with a teacher login.");
    if (subjects.some((item) => !item.subject.trim() || !teachers.some((teacher) => idOf(teacher) === item.teacherId))) {
      return setError("For each subject, enter its name and choose a teacher.");
    }
    if (new Set(subjects.map((item) => item.subject.trim().toLowerCase())).size !== subjects.length) return setError("A subject can only be assigned once for this class.");
    const assignment = {
      year: form.year.trim(),
      grade: form.grade.trim(),
      division: form.division.trim().toUpperCase(),
      classTeacherId: form.classTeacherId,
      subjects: subjects.map((item) => ({ subject: item.subject.trim(), teacherId: item.teacherId })),
    };
    const nextKey = classKey(assignment);
    setAssignments((current) => [
      ...current.filter((item) => classKey(item) !== nextKey && classKey(item) !== editKey),
      assignment,
    ]);
    toast(`Teacher assignments saved for ${assignment.grade} ${assignment.division} · ${assignment.year}`);
    reset();
  };

  return (
    <section className="card">
      <h3>Assign class and subject teachers</h3>
      <p className="muted">Create teacher logins in User accounts first. Assignments appear on every linked student’s dashboard.</p>
      {!teachers.length ? <p className="alert">No teacher logins yet. Open User accounts to add teachers before assigning classes and subjects.</p> : (
        <form onSubmit={save} noValidate>
          <div className="grid teacher-assignment-grid">
            <Field label="Academic year"><input type="number" min="2000" max="9999" aria-label="Assignment year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></Field>
            <Field label="Grade">
              <select aria-label="Assignment grade" value={form.grade} onChange={(e) => {
                const grade = e.target.value;
                const nextDivisions = students.filter((student) => same(student.grade, grade)).map((student) => student.division);
                const assignedDivisions = assignments.filter((assignment) => same(assignment.grade, grade)).map((assignment) => assignment.division);
                const division = nextDivisions[0] || assignedDivisions[0] || (same(meta.grade, grade) ? meta.className : "");
                setForm({ ...form, grade, division });
              }}>
                <option value="">Choose a grade</option>
                {grades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
              </select>
            </Field>
            <Field label="Division">
              <select aria-label="Assignment division" value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })}>
                <option value="">Choose a division</option>
                {divisions.map((division) => <option key={division} value={division}>{division}</option>)}
              </select>
            </Field>
            <Field label="Class teacher">
              <select aria-label="Class teacher" value={form.classTeacherId} onChange={(e) => setForm({ ...form, classTeacherId: e.target.value })}>
                <option value="">Not assigned</option>
                {teachers.map((teacher) => <option key={idOf(teacher)} value={idOf(teacher)}>{teacher.name}</option>)}
              </select>
            </Field>
          </div>
          <h4>Subject teachers</h4>
          {form.subjects.map((subject, index) => (
            <div className="grid teacher-subject-row" key={index}>
              <Field label={`Subject ${index + 1}`}>
                <select aria-label={`Subject ${index + 1}`} value={subject.subject} onChange={(e) => updateSubject(index, "subject", e.target.value)}>
                  <option value="">Choose a subject</option>
                  {[...new Set([...SUBJECTS, ...assignments.flatMap((assignment) => (assignment.subjects || []).map((item) => item.subject)), subject.subject].filter(Boolean))].sort().map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </Field>
              <Field label={`Teacher for subject ${index + 1}`}>
                <select aria-label={`Teacher for subject ${index + 1}`} value={subject.teacherId} onChange={(e) => updateSubject(index, "teacherId", e.target.value)}>
                  <option value="">Choose a teacher</option>
                  {teachers.map((teacher) => <option key={idOf(teacher)} value={idOf(teacher)}>{teacher.name}</option>)}
                </select>
              </Field>
              {form.subjects.length > 1 && <button type="button" className="btn ghost sm" onClick={() => setForm((current) => ({ ...current, subjects: current.subjects.filter((_, i) => i !== index) }))}>Remove subject</button>}
            </div>
          ))}
          {error && <p className="alert bad" role="alert">{error}</p>}
          <div className="teacher-assignment-actions">
            <button type="button" className="btn ghost" onClick={() => setForm((current) => ({ ...current, subjects: [...current.subjects, { subject: "", teacherId: "" }] }))}>Add subject teacher</button>
            <button className="btn teal">{editKey ? "Save assignments" : "Assign teachers"}</button>
            {editKey && <button type="button" className="btn ghost" onClick={reset}>Cancel</button>}
          </div>
        </form>
      )}
      {(teachers.length > 0 || assignments.length > 0) && (
        <div className="teacher-directory teacher-assignment-directory">
          <h3>Teachers and class assignments</h3>
          <div className="scroll">
            <table className="tbl teacher-assignment-table">
              <thead><tr><th>Year</th><th>Class</th><th>Teacher logins</th><th>Class teacher</th><th>Assigned subjects</th><th>Actions</th></tr></thead>
              <tbody>{overviewRows.map(({ key, assignment, assignedTeachers }) => (
                <tr key={key}>
                  <td>{assignment?.year || "–"}</td>
                  <td>{assignment ? `${assignment.grade} ${assignment.division}` : "Not assigned"}</td>
                  <td>{assignedTeachers.length
                    ? <div className="assignment-teacher-list">{assignedTeachers.map((teacher) => <span className="assignment-teacher" key={idOf(teacher)}>
                      <PersonAvatar name={teacher.name} photo={teacher.photo} />
                      <span><b>{teacher.name}</b><small>{idOf(teacher) || "Username unavailable"}</small></span>
                    </span>)}</div>
                    : "No teacher logins assigned"}
                  </td>
                  <td>{assignment ? teacherName(assignment.classTeacherId) || "Not assigned" : "–"}</td>
                  <td>{assignment ? (assignment.subjects || []).map((item) => `${item.subject}: ${teacherName(item.teacherId) || "Teacher login unavailable"}`).join("; ") || "None assigned" : "Not assigned"}</td>
                  <td>{assignment && <button type="button" className="linkbtn" onClick={() => edit(assignment)}>Edit</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
      {(() => {
        const keys = new Set(assignments.map((item) => classKey(item)));
        const classes = new Map(students.map((student) => [`${student.grade}|${student.division}`, { grade: student.grade, division: student.division }]));
        const unassigned = [...classes.values()].filter((item) => !keys.has(classKey({ ...item, year: form.year })));
        return unassigned.length ? <div className="alert bad" role="status"><b>Classes needing assignments</b><ul>{unassigned.map((item) => <li key={`${item.grade}|${item.division}`}>{item.grade} {item.division} has no class/subject assignments for {form.year}.</li>)}</ul></div> : null;
      })()}
      {students.length === 0 && <p className="muted">Add students to link these assignments to a student class.</p>}
    </section>
  );
}
