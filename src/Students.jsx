import { useRef, useState } from "react";
import { GENDERS, GRADES, blankStudent, validateStudent, counts } from "./students.js";
import { uid } from "./defaults.js";
import { importStudents, downloadStudents, downloadStudentTemplate } from "./sheet.js";
import { toast } from "./toastBus.js";
import { logActivity } from "./activity.js";
import { createCheckpoint } from "./backup.js";
import { Field } from "./ui.jsx";
import { readUsers, roleOf } from "./auth.js";
import PersonAvatar from "./PersonAvatar.jsx";
import { studentHistory } from "./results.js";
import { moduleResult, studentTotals, studentGpa } from "./grading.js";

export default function Students({ s }) {
  const { meta, students, setStudents, setStore, can, store, cfg, gradeOnly } = s;
  const [form, setForm] = useState(blankStudent(meta));
  const [editId, setEditId] = useState("");
  const [errs, setErrs] = useState({});
  const [q, setQ] = useState(""), [fg, setFg] = useState(""), [fd, setFd] = useState(""), [fs, setFs] = useState("");
  const [msg, setMsg] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const fileRef = useRef();
  const c = counts(students);
  const studentAccounts = readUsers().filter((account) => roleOf(account) === "student");
  const photoForStudent = (student) => studentAccounts.find((account) => String(account.studentId || "").trim().toLowerCase() === String(student.index).trim().toLowerCase())?.photo;
  const grades = [...new Set(students.map((x) => x.grade))];
  const divisions = [...new Set(students.map((x) => x.division))].sort();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const list = students
    .filter((x) => (!fg || x.grade === fg) && (!fd || x.division === fd) && (!fs || x.gender === fs) && (!q.trim() || `${x.name} ${x.index}`.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => a.index.localeCompare(b.index, undefined, { numeric: true }));

  const reset = () => { setForm(blankStudent(meta)); setEditId(""); setErrs({}); };
  const submit = (e) => {
    e.preventDefault();
    const er = validateStudent(form, students, editId);
    setErrs(er);
    if (Object.keys(er).length) return toast("Please fix the highlighted fields.", "bad");
    const clean = { ...form, index: form.index.trim(), name: form.name.trim(), division: form.division.trim().toUpperCase(), guardian: form.guardian.trim(), email: form.email.trim().toLowerCase() };
    if (editId) {
      const old = students.find((x) => x.id === editId);
      setStudents(students.map((x) => (x.id === editId ? { ...clean, id: editId } : x)));
      if (old && (old.index !== clean.index || old.name !== clean.name)) { // keep marks linked to the student
        setStore((st) => Object.fromEntries(Object.entries(st || {}).map(([k, recs]) => [k, recs.map((r) => (String(r.studentId).toLowerCase() === old.index.toLowerCase() ? { ...r, studentId: clean.index, name: clean.name } : r))])));
      }
      toast(`${clean.name} updated`);
    } else {
      setStudents([...students, { ...clean, id: uid() }]);
      toast(`${clean.name} added`);
      logActivity("student", `Added student ${clean.name}`);
    }
    reset();
  };
  const edit = (st) => { setForm({ ...blankStudent(meta), ...st }); setEditId(st.id); setErrs({}); document.getElementById("student-form")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const del = (st) => {
    if (!window.confirm(`Delete ${st.name} (${st.index})? Marks already entered for this student are kept.`)) return;
    setStudents(students.filter((x) => x.id !== st.id));
    if (editId === st.id) reset();
    toast(`${st.name} deleted`);
  };
  const onImport = async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try {
      const out = await importStudents(f, students);
      createCheckpoint("Before importing students workbook");
      setStudents([...students, ...out.students]);
      const bad = out.errors;
      setMsg({ type: bad.length ? "bad" : "ok", lines: [`Imported ${out.students.length} of ${out.total} students.`, ...bad.slice(0, 8), ...(bad.length > 8 ? [`...and ${bad.length - 8} more.`] : [])] });
      toast(`Imported ${out.students.length} students`);
      logActivity("import", `Imported ${out.students.length} students`);
    } catch (err) { setMsg({ type: "bad", lines: [err.message] }); toast(err.message, "bad"); }
  };

  return (
    <>
      <div className="pagehead"><h2>Students</h2><div className="savebox"><span className="muted">{c.total} student{c.total === 1 ? "" : "s"}</span></div></div>
      <div className="kpis kpis3">
        <div className="card kpi"><span className="muted">Total students</span><b>{c.total}</b></div>
        <div className="card kpi"><span className="muted">Male</span><b>{c.male}</b></div>
        <div className="card kpi"><span className="muted">Female</span><b>{c.female}</b>{c.other > 0 && <span>{c.other} gender not set</span>}</div>
      </div>
      {c.byDiv.length > 0 && <div className="card"><h3>Division-wise count</h3><div className="chips">{c.byDiv.map(([k, n]) => <span key={k} className="chip plain">{k}: {n}</span>)}</div></div>}

      <section id="student-form" className="card">
        <h3>{editId ? "Edit student" : "Add student"}</h3>
        <form onSubmit={submit} noValidate>
          <div className="grid">
            <Field label="Full name" error={errs.name}><input value={form.name} onChange={set("name")} /></Field>
            <Field label="Index number" error={errs.index}><input value={form.index} onChange={set("index")} /></Field>
            <Field label="Gender" error={errs.gender}><select value={form.gender} onChange={set("gender")}><option value="">Choose</option>{GENDERS.map((g) => <option key={g}>{g}</option>)}</select></Field>
            <Field label="Grade" error={errs.grade}><select value={form.grade} onChange={set("grade")}>{[...new Set([...GRADES, form.grade])].map((g) => <option key={g}>{g}</option>)}</select></Field>
            <Field label="Division" error={errs.division}><input value={form.division} onChange={set("division")} maxLength={3} /></Field>
            <Field label="Date of birth" error={errs.dob}><input type="date" value={form.dob} onChange={set("dob")} /></Field>
            <Field label="Student email address" error={errs.email}><input type="email" value={form.email} onChange={set("email")} autoComplete="email" /></Field>
            <Field label="Guardian phone" error={errs.guardian}><input value={form.guardian} onChange={set("guardian")} inputMode="tel" /></Field>
          </div>
          <div className="row form-actions">
            <button className="btn teal">{editId ? "Save changes" : "Add student"}</button>
            {editId && <button type="button" className="btn ghost" onClick={reset}>Cancel</button>}
          </div>
        </form>
      </section>

      <section className="card">
        <div className="acthead"><h3>Student list</h3>
          <div className="row" style={{ margin: 0 }}>
            <button className="btn ghost sm" onClick={downloadStudentTemplate}>Download template</button>
            <button className="btn ghost sm" onClick={() => fileRef.current.click()}>Import students</button>
            <input ref={fileRef} type="file" hidden accept=".xlsx,.xls" onChange={onImport} />
            <button className="btn ghost sm" disabled={!students.length} onClick={() => downloadStudents(students)}>Export students</button>
          </div>
        </div>
        {msg && <div className={"alert " + msg.type} role="status">{msg.lines.map((l, i) => <div key={i}>{l}</div>)}</div>}
        <div className="filters">
          <input type="search" aria-label="Search students" placeholder="Search name or index number" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Filter by grade" value={fg} onChange={(e) => setFg(e.target.value)}><option value="">All grades</option>{grades.map((g) => <option key={g}>{g}</option>)}</select>
          <select aria-label="Filter by division" value={fd} onChange={(e) => setFd(e.target.value)}><option value="">All divisions</option>{divisions.map((g) => <option key={g}>{g}</option>)}</select>
          <select aria-label="Filter by gender" value={fs} onChange={(e) => setFs(e.target.value)}><option value="">All genders</option>{GENDERS.map((g) => <option key={g}>{g}</option>)}</select>
        </div>
        {selectedStudent && (
          <section className="student-marks-detail" aria-label={`${selectedStudent.name} marks`}>
            <div className="acthead">
              <div>
                <h3>Marks for {selectedStudent.name}</h3>
                <p className="muted">{selectedStudent.index} · {selectedStudent.grade} {selectedStudent.division}</p>
              </div>
              <button type="button" className="btn ghost sm" onClick={() => setSelectedStudent(null)}>Close marks</button>
            </div>
            {(() => {
              const history = studentHistory(store, selectedStudent.index, cfg);
              if (!history.length) return <p className="muted">No marks have been entered for this student yet.</p>;
              return history.map(({ key, year, term, rec }) => {
                const totals = studentTotals(rec.modules, cfg.scale);
                const overall = studentGpa(rec.modules, cfg.scale, rec.gpaOverride);
                return (
                  <section className="student-marks-period" key={key}>
                    <div className="student-marks-period-head">
                      <h4>{term} {year}</h4>
                      <span className="muted">
                        Average {totals.avg.toFixed(1)}% · {gradeOnly ? `Grade ${overall.grade}` : `GPA ${overall.gpa.toFixed(2)} · Grade ${overall.grade}`}
                      </span>
                    </div>
                    <div className="scroll">
                      <table className="tbl student-marks-table">
                        <thead><tr><th>Subject</th><th>Activities</th><th className="c">Formative</th><th className="c">Summative</th><th className="c">Total</th><th className="c">Grade</th></tr></thead>
                        <tbody>{rec.modules.map((module, index) => {
                          const result = moduleResult(module, cfg.scale);
                          const activities = (module.activities || []).filter((activity) => activity.mark !== "" || activity.max !== "");
                          return (
                            <tr key={`${module.moduleId || module.moduleTitle}-${index}`}>
                              <td>{module.moduleTitle || module.moduleId || "Subject"}</td>
                              <td>{activities.length ? activities.map((activity, activityIndex) => <span className="student-mark-activity" key={activityIndex}>A{activityIndex + 1}: {activity.mark === "" ? "–" : activity.mark}/{activity.max || "–"}</span>) : "–"}</td>
                              <td className="c">{module.absent ? "AB" : module.formative ?? "–"}</td>
                              <td className="c">{module.absent ? "AB" : module.summative ?? "–"}</td>
                              <td className="c">{module.absent ? "AB" : result.total ?? "–"}</td>
                              <td className="c">{result.grade}</td>
                            </tr>
                          );
                        })}</tbody>
                      </table>
                    </div>
                    {rec.remark && <p className="muted student-marks-remark">Teacher observation: {rec.remark}</p>}
                  </section>
                );
              });
            })()}
          </section>
        )}
        {!students.length ? <p className="muted">No students yet. Add one above, import a workbook, or enter marks (students are added automatically).</p>
          : !list.length ? <p className="muted">No student matches the search and filters.</p> : (
            <div className="scroll">
              <table className="tbl stu">
                <thead><tr><th>Student</th><th>Index no</th><th>Gender</th><th>Grade</th><th className="c">Division</th><th>Guardian phone</th><th><span className="sr">Actions</span></th></tr></thead>
                <tbody>{list.map((x, i) => (
                  <tr key={x.id}>
                    <td><span className="person-cell"><PersonAvatar name={x.name} photo={photoForStudent(x)} /><button type="button" className="linkbtn student-mark-open" aria-label={`View marks for ${x.name}`} onClick={() => setSelectedStudent(x)}>{x.name}</button></span></td><td>{x.index}</td><td>{x.gender || "–"}</td><td>{x.grade}</td><td className="c">{x.division}</td><td>{x.guardian || "–"}</td>
                    <td className="acts"><button className="linkbtn" onClick={() => edit(x)}>Edit</button>{can("students.delete") && <button className="linkbtn del" onClick={() => del(x)}>Delete</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
      </section>
    </>
  );
}
