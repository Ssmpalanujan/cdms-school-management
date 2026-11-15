import { useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { readUsers, writeUsers, hashFor, randomText, idOf, roleOf, validUsername, findUser } from "./auth.js";
import { toast } from "./toastBus.js";
import { Field } from "./ui.jsx";
import PersonAvatar from "./PersonAvatar.jsx";

const clean = (v) => String(v).toLowerCase().replace(/[^a-z0-9._-]/g, "");
const blank = { role: "teacher", name: "", username: "", password: "", email: "", studentId: "", teacherId: "" };

export default function Accounts({ s }) {
  const { meta, students, teachers, user } = s;
  const [users, setUsers] = useState(readUsers);
  const [form, setForm] = useState(blank);
  const [errs, setErrs] = useState({});
  const [show, setShow] = useState(false);
  const [made, setMade] = useState(null);
  const [q, setQ] = useState("");
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const me = idOf(user);
  const save = (list) => { writeUsers(list); setUsers(list); };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const free = students.filter((x) => !users.some((u) => String(u.studentId || "").toLowerCase() === x.index.toLowerCase()));
  const normalizeName = (name) => String(name || "").trim().toLowerCase();
  const freeTeachers = teachers.filter((teacher) => !users.some((account) =>
    roleOf(account) === "teacher" && normalizeName(account.name) === normalizeName(teacher.name)));

  const pickStudent = (e) => {
    const st = students.find((x) => x.index === e.target.value);
    setForm({ ...form, studentId: e.target.value, teacherId: "", name: st ? st.name : "", email: st?.email || "", username: st && !form.username ? clean(st.index) : form.username });
  };
  const pickTeacher = (e) => {
    const teacher = freeTeachers.find((item) => item.id === e.target.value);
    setForm({ ...form, teacherId: e.target.value, studentId: "", name: teacher?.name || "", email: teacher?.email || "", username: teacher && !form.username ? clean(teacher.name.replace(/\s+/g, ".")) : form.username });
  };
  const submit = async (e) => {
    e.preventDefault();
    const er = {}, uname = form.username.trim().toLowerCase();
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim()) er.name = "Enter the full name.";
    if (!/^\S+@\S+\.\S+$/.test(email)) er.email = "Enter a valid email address.";
    else if (users.some((account) => String(account.email || "").toLowerCase() === email)) er.email = "This email is already used by another account.";
    if (!validUsername(uname)) er.username = "Use 3 to 24 letters, numbers, dot, dash or underscore.";
    else if (findUser(users, uname)) er.username = "This username is already used.";
    if (form.password.length < 8) er.password = "Password must be at least 8 characters.";
    if (form.role === "student" && !form.studentId) er.studentId = "Choose the student this login belongs to.";
    if (form.role === "teacher" && !freeTeachers.some((teacher) => teacher.id === form.teacherId)) er.teacherId = "Choose a teacher from Teacher details.";
    setErrs(er);
    if (Object.keys(er).length) return toast("Please fix the highlighted fields.", "bad");
    const acc = { name: form.name.trim(), username: uname, email, role: form.role, school: meta.schoolName || "", studentId: form.role === "student" ? form.studentId : "", hash: await hashFor(uname, form.password) };
    save([...users, acc]);
    setMade({ name: acc.name, username: uname, password: form.password });
    setForm(blank);
    toast(`Login created for ${acc.name}`);
  };
  const genPassword = () => setForm({ ...form, password: randomText(8) });
  const reset = async (event) => {
    event.preventDefault();
    if (resetPassword.length < 8) return setResetError("Password must be at least 8 characters.");
    const hash = await hashFor(idOf(resetTarget), resetPassword);
    save(readUsers().map((x) => (idOf(x) === idOf(resetTarget) ? { ...x, hash } : x)));
    setMade({ name: resetTarget.name, username: idOf(resetTarget), password: resetPassword });
    setResetTarget(null);
    setResetPassword("");
    setResetError("");
    toast("Password reset");
  };
  const openReset = (account) => {
    setResetTarget(account);
    setResetPassword("");
    setResetError("");
  };
  const closeReset = () => {
    setResetTarget(null);
    setResetPassword("");
    setResetError("");
  };
  const del = (u) => {
    if (idOf(u) === me) return toast("You cannot delete the account you are using.", "bad");
    if (roleOf(u) === "admin" && users.filter((x) => roleOf(x) === "admin").length < 2) return toast("There must be at least one admin.", "bad");
    if (!window.confirm(`Delete the login of ${u.name}? Their marks and records stay.`)) return;
    save(users.filter((x) => x !== u));
    toast("Login deleted");
  };
  const bulk = async () => {
    if (!free.length) return toast("Every student already has a login.");
    const missingEmail = free.filter((student) => !/^\S+@\S+\.\S+$/.test(String(student.email || "").trim()));
    if (missingEmail.length) return toast(`Add a valid email address for ${missingEmail.length} student${missingEmail.length === 1 ? "" : "s"} before creating logins.`, "bad");
    if (!window.confirm(`Create logins for ${free.length} student${free.length === 1 ? "" : "s"}? Passwords are shown once in a downloaded Excel file.`)) return;
    const list = [...users], rows = [["Index number", "Name", "Username", "Password"]];
    for (const st of free) {
      let base = clean(st.index) || "student", name = base, n = 1;
      if (base.length < 3) base = name = base + "000".slice(base.length);
      while (findUser(list, name)) name = `${base}${++n}`;
      const pw = randomText(8);
      list.push({ name: st.name, username: name, email: st.email.trim().toLowerCase(), role: "student", school: meta.schoolName || "", studentId: st.index, hash: await hashFor(name, pw) });
      rows.push([st.index, st.name, name, st.email, pw]);
    }
    save(list);
    rows[0] = ["Index number", "Name", "Username", "Email", "Password"];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Student logins");
    XLSX.writeFile(wb, "student-logins.xlsx");
    toast(`${rows.length - 1} student logins created`);
  };
  const copyMade = () => navigator.clipboard?.writeText(`Username: ${made.username}\nPassword: ${made.password}`).then(() => toast("Copied")).catch(() => {});
  const list = users.filter((u) => !q.trim() || `${u.name} ${idOf(u)}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <div className="pagehead"><h2>User accounts</h2><div className="savebox"><span className="muted">{users.length} account{users.length === 1 ? "" : "s"}</span></div></div>
      <p className="muted lead">Create a separate username and password for each teacher and student. Add an email address; users verify it after entering their username and password.</p>
      {made && (
        <div className="alert ok madebox" role="status">
          <b>Share these details with {made.name}.</b> The password cannot be shown again.
          <div className="cred"><span>Username: <b>{made.username}</b></span><span>Password: <b>{made.password}</b></span></div>
          <div className="row" style={{ marginTop: 8 }}><button className="btn ghost sm" onClick={copyMade}>Copy</button><button className="btn ghost sm" onClick={() => setMade(null)}>Hide</button></div>
        </div>
      )}
      <section className="card">
        <h3>{form.role === "teacher" ? "Add a teacher" : "Create a student login"}</h3>
        <form onSubmit={submit} noValidate>
          <div className="grid">
            <Field label="Role"><select value={form.role} onChange={(e) => setForm({ ...blank, role: e.target.value })}><option value="teacher">Teacher</option><option value="student">Student</option></select></Field>
            {form.role === "student" ? (
              <Field label="Student" error={errs.studentId}><select value={form.studentId} onChange={pickStudent}><option value="">Choose a student</option>{free.map((student) => <option key={student.id} value={student.index}>{student.index} · {student.name}</option>)}</select></Field>
            ) : (
              <Field label="Teacher" error={errs.teacherId}><select value={form.teacherId} onChange={pickTeacher}><option value="">Choose a teacher</option>{freeTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}{teacher.subject ? ` · ${teacher.subject}` : ""}</option>)}</select></Field>
            )}
            <Field label="Username" error={errs.username}><input value={form.username} onChange={(e) => setForm({ ...form, username: clean(e.target.value) })} autoCapitalize="none" /></Field>
            <Field label="Email address" error={errs.email}><input type="email" value={form.email} onChange={set("email")} autoComplete="email" /></Field>
            <Field label="Password" error={errs.password}><input type={show ? "text" : "password"} value={form.password} onChange={set("password")} autoComplete="new-password" /></Field>
          </div>
          {form.role === "teacher" && !teachers.length && <p className="muted">Add teacher details first. Teachers with existing accounts are hidden from this dropdown.</p>}
          {form.role === "student" && !free.length && <p className="muted">All students already have accounts, or no students have been added yet.</p>}
          <div className="row form-actions">
            <button className="btn teal">{form.role === "teacher" ? "Add teacher login" : "Create student login"}</button>
            <button type="button" className="btn ghost" onClick={genPassword}>Generate password</button>
            <label className="switch" style={{ margin: 0 }}><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /><span>Show password</span></label>
          </div>
        </form>
      </section>
      <section className="card">
        <div className="acthead"><h3>Accounts</h3>
          <div className="row" style={{ margin: 0 }}>
            <input className="search" type="search" aria-label="Search accounts" placeholder="Search name or username" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn ghost sm" onClick={bulk}>Create logins for all students</button>
          </div>
        </div>
        {!list.length ? <p className="muted">No account matches the search.</p> : (
          <div className="scroll">
            <table className="tbl acctbl">
              <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Student index</th><th><span className="sr">Actions</span></th></tr></thead>
              <tbody>{list.map((u) => (
                <tr key={idOf(u)}>
                  <td><span className="person-cell"><PersonAvatar name={u.name} photo={u.photo} />{u.name}{idOf(u) === me && <span className="chip plain sm">You</span>}</span></td><td>{u.username || "–"}</td><td>{u.email || "Email required"}</td>
                  <td><span className={"chip role-" + roleOf(u)}>{roleOf(u)}</span></td><td>{u.studentId || "–"}</td>
                  <td className="acts"><button className="linkbtn" onClick={() => openReset(u)}>Reset password</button><button className="linkbtn del" onClick={() => del(u)}>Delete</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      {resetTarget && createPortal(
        <div className="modal" onMouseDown={(event) => { if (event.target === event.currentTarget) closeReset(); }}>
          <form className="dialog reset-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-title" onSubmit={reset} onKeyDown={(event) => { if (event.key === "Escape") closeReset(); }} noValidate>
            <h3 id="reset-title">Reset password</h3>
            <p className="muted">Set a new password for {resetTarget.name}.</p>
            <Field label="New password" error={resetError}>
              <input autoFocus type="password" autoComplete="new-password" value={resetPassword} onChange={(event) => { setResetPassword(event.target.value); setResetError(""); }} />
            </Field>
            <p className="muted reset-hint">Use at least 8 characters.</p>
            <div className="row crow">
              <button type="button" className="btn ghost" onClick={closeReset}>Cancel</button>
              <button className="btn teal">Save password</button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </>
  );
}
