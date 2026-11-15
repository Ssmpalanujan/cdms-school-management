import { useState } from "react";
import { uid } from "./defaults.js";
import { hashPw, hkOf, randomPassword, usernameTaken, slugName, accountId, uname, USERNAME_RE } from "./accounts.js";
import { ROLES, ROLE_LABEL } from "./perms.js";
import { downloadCredentials } from "./sheet.js";
import { toast } from "./toastBus.js";
import { logActivity } from "./activity.js";
import { Field } from "./ui.jsx";

const blank = { role: "teacher", link: "", name: "", username: "", password: "" };
const fixName = (b) => { const x = String(b).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, ""); return x.length >= 3 ? x : ("u" + x).padEnd(3, "0"); };

export default function Users({ s }) {
  const { users, setUsers, students, teachers, setTeachers, user, meta } = s;
  const [f, setF] = useState(blank);
  const [errs, setErrs] = useState({});
  const [show, setShow] = useState(false);
  const [made, setMade] = useState(null);
  const [q, setQ] = useState(""), [fr, setFr] = useState("");
  const [reset, setReset] = useState(null);
  const [bulk, setBulk] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const hasAcc = (role, id) => users.some((u) => u.role === role && u.linkId === id);
  const options = f.role === "student" ? students.filter((x) => !hasAcc("student", x.id)) : f.role === "teacher" ? teachers.filter((x) => !hasAcc("teacher", x.id)) : [];
  const pickRole = (e) => setF({ ...blank, role: e.target.value });
  const pickLink = (e) => {
    const id = e.target.value, role = f.role;
    const rec = role === "student" ? students.find((x) => x.id === id) : teachers.find((x) => x.id === id);
    setF({ ...f, link: id, name: rec ? rec.name : f.name, username: rec ? (role === "student" ? fixName(rec.index) : slugName(rec.name)) : f.username });
  };
  const nameOf = (u) => {
    if (u.role === "student") { const st = students.find((x) => x.id === u.linkId); return st ? `${st.index}, ${st.grade} ${st.division}` : "No student linked"; }
    if (u.role === "teacher") { const t = teachers.find((x) => x.id === u.linkId); return t ? t.subject || "Teacher record linked" : "No teacher record"; }
    return "School admin";
  };

  const create = async (e) => {
    e.preventDefault();
    const er = {};
    if (!f.name.trim()) er.name = "Enter the full name.";
    if (f.role === "student" && !f.link) er.link = "Choose the student.";
    if (!USERNAME_RE.test(f.username.trim())) er.username = "3 to 30 letters, numbers, dots, dashes or underscores.";
    else if (usernameTaken(users, f.username)) er.username = "This username is already taken.";
    if (f.password.length < 8) er.password = "At least 8 characters.";
    setErrs(er);
    if (Object.keys(er).length) return toast("Please fix the highlighted fields.", "bad");
    const hk = f.username.trim().toLowerCase();
    let linkId = f.link;
    if (f.role === "teacher" && !linkId) { const t = { id: uid(), name: f.name.trim(), subject: "", phone: "" }; setTeachers([...teachers, t]); linkId = t.id; }
    const acc = { id: uid(), username: f.username.trim(), name: f.name.trim(), role: f.role, linkId, school: meta.schoolName || "", hk, hash: await hashPw(hk, f.password), active: true, created: new Date().toISOString() };
    setUsers([...users, acc]);
    setMade({ username: acc.username, password: f.password, name: acc.name, role: acc.role });
    logActivity("user", `Created ${ROLE_LABEL[acc.role]} account ${acc.username}`);
    setF(blank); setErrs({});
  };

  const doReset = async (u) => {
    if (reset.password.length < 8) return toast("The new password needs at least 8 characters.", "bad");
    const hash = await hashPw(hkOf(u), reset.password);
    setUsers(users.map((x) => (accountId(x) === accountId(u) ? { ...x, hash } : x)));
    setMade({ username: uname(u), password: reset.password, name: u.name, role: u.role || "admin", reset: true });
    setReset(null);
  };
  const toggle = (u) => { setUsers(users.map((x) => (accountId(x) === accountId(u) ? { ...x, active: x.active === false } : x))); toast(`${u.name} ${u.active === false ? "enabled" : "disabled"}`); };
  const remove = (u) => { if (window.confirm(`Delete the account of ${u.name} (${uname(u)})? Their marks and leave records are kept.`)) { setUsers(users.filter((x) => accountId(x) !== accountId(u))); toast("Account deleted"); } };

  const bulkCreate = async (role) => {
    const list = (role === "student" ? students : teachers).filter((x) => !hasAcc(role, x.id));
    if (!list.length) return toast(`Every ${role} already has an account.`);
    if (!window.confirm(`Create ${list.length} ${role} account${list.length === 1 ? "" : "s"} with random passwords? The passwords are shown once, so download the list afterwards.`)) return;
    const next = [...users], rows = [];
    for (const x of list) {
      let base = role === "student" ? fixName(x.index) : slugName(x.name) || fixName(x.name), name = base, n = 1;
      while (usernameTaken(next, name)) name = `${base}${++n}`;
      const password = randomPassword(), hk = name.toLowerCase();
      next.push({ id: uid(), username: name, name: x.name, role, linkId: x.id, school: meta.schoolName || "", hk, hash: await hashPw(hk, password), active: true, created: new Date().toISOString() });
      rows.push({ role: ROLE_LABEL[role], name: x.name, cls: role === "student" ? `${x.grade} ${x.division}` : "", username: name, password });
    }
    setUsers(next); setBulk(rows);
    logActivity("user", `Created ${rows.length} ${role} accounts`);
  };

  const list = users.filter((u) => (!fr || (u.role || "admin") === fr) && (!q.trim() || `${u.name} ${uname(u)}`.toLowerCase().includes(q.trim().toLowerCase())));
  const noAcc = { student: students.filter((x) => !hasAcc("student", x.id)).length, teacher: teachers.filter((x) => !hasAcc("teacher", x.id)).length };

  return (
    <>
      <div className="pagehead"><h2>Users and accounts</h2><span className="muted">{users.length} account{users.length === 1 ? "" : "s"}</span></div>
      <p className="muted">Each teacher and student signs in with their own username and password. Passwords are stored as hashes in this browser only, so this is not real security until a backend is added.</p>

      {made && (
        <section className="card made" role="status">
          <h3>{made.reset ? "Password changed" : "Account created"}</h3>
          <p>Give these details to <b>{made.name}</b> ({ROLE_LABEL[made.role]}). The password cannot be shown again.</p>
          <dl className="kv"><dt>Username</dt><dd>{made.username}</dd><dt>Password</dt><dd>{made.password}</dd></dl>
          <div className="row"><button className="btn ghost sm" onClick={() => navigator.clipboard?.writeText(`Username: ${made.username}\nPassword: ${made.password}`).then(() => toast("Copied")).catch(() => {})}>Copy</button><button className="btn ghost sm" onClick={() => setMade(null)}>Done</button></div>
        </section>
      )}

      <section className="card">
        <h3>New account</h3>
        <form onSubmit={create} noValidate>
          <div className="grid">
            <Field label="Role"><select value={f.role} onChange={pickRole}>{ROLES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            {f.role !== "admin" && (
              <Field label={f.role === "student" ? "Student" : "Teacher (optional)"} error={errs.link}>
                <select value={f.link} onChange={pickLink}><option value="">{f.role === "student" ? "Choose a student" : "New teacher"}</option>{options.map((x) => <option key={x.id} value={x.id}>{f.role === "student" ? `${x.index} ${x.name}` : x.name}</option>)}</select>
              </Field>
            )}
            <Field label="Full name" error={errs.name}><input value={f.name} onChange={set("name")} disabled={!!f.link} /></Field>
            <Field label="Username" error={errs.username}><input value={f.username} onChange={set("username")} autoCapitalize="none" /></Field>
            <Field label="Password" error={errs.password}><input type={show ? "text" : "password"} value={f.password} onChange={set("password")} autoComplete="new-password" /></Field>
          </div>
          <div className="row">
            <button type="button" className="btn ghost sm" onClick={() => { setF({ ...f, password: randomPassword() }); setShow(true); }}>Generate password</button>
            <label className="switch sm"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /><span>Show password</span></label>
            <button className="btn teal">Create account</button>
          </div>
        </form>
      </section>

      <section className="card">
        <h3>Create many accounts at once</h3>
        <p className="muted">Usernames are the index number for students and the name for teachers. Passwords are random and listed once.</p>
        <div className="row" style={{ marginTop: 0 }}>
          <button className="btn ghost" disabled={!noAcc.student} onClick={() => bulkCreate("student")}>Students without an account ({noAcc.student})</button>
          <button className="btn ghost" disabled={!noAcc.teacher} onClick={() => bulkCreate("teacher")}>Teachers without an account ({noAcc.teacher})</button>
        </div>
        {bulk && (
          <div className="made2">
            <p className="alert ok" role="status">{bulk.length} account{bulk.length === 1 ? "" : "s"} created. Download the list now, the passwords will not be shown again.</p>
            <div className="row" style={{ marginTop: 0 }}><button className="btn teal" onClick={() => downloadCredentials(bulk)}>Download credentials (.xlsx)</button><button className="btn ghost" onClick={() => setBulk(null)}>Hide list</button></div>
            <div className="scroll"><table className="tbl small"><thead><tr><th>Name</th><th>Role</th><th>Username</th><th>Password</th></tr></thead><tbody>{bulk.map((r) => <tr key={r.username}><td>{r.name}</td><td>{r.role}</td><td>{r.username}</td><td>{r.password}</td></tr>)}</tbody></table></div>
          </div>
        )}
      </section>

      <section className="card">
        <div className="acthead"><h3>Accounts</h3></div>
        <div className="filters">
          <input type="search" aria-label="Search accounts" placeholder="Search name or username" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Filter by role" value={fr} onChange={(e) => setFr(e.target.value)}><option value="">All roles</option>{ROLES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        {!list.length ? <p className="muted">No account matches.</p> : (
          <div className="scroll">
            <table className="tbl usertbl">
              <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Linked to</th><th>Status</th><th><span className="sr">Actions</span></th></tr></thead>
              <tbody>{list.map((u) => {
                const me = accountId(u) === user.id;
                return (
                  <tr key={accountId(u)}>
                    <td>{u.name}{me && <span className="chip plain sm">You</span>}</td><td>{uname(u)}</td><td>{ROLE_LABEL[u.role || "admin"]}</td><td>{nameOf(u)}</td>
                    <td><span className={"chip " + (u.active === false ? "st-rejected" : "st-approved")}>{u.active === false ? "Disabled" : "Active"}</span></td>
                    <td className="acts">
                      {reset?.id === accountId(u) ? (
                        <span className="gpaedit"><input aria-label="New password" type="text" value={reset.password} onChange={(e) => setReset({ ...reset, password: e.target.value })} /><button className="linkbtn" onClick={() => doReset(u)}>Save</button><button className="linkbtn" onClick={() => setReset(null)}>Cancel</button></span>
                      ) : (
                        <>
                          <button className="linkbtn" onClick={() => setReset({ id: accountId(u), password: randomPassword() })}>Reset password</button>
                          {!me && <button className="linkbtn" onClick={() => toggle(u)}>{u.active === false ? "Enable" : "Disable"}</button>}
                          {!me && <button className="linkbtn del" onClick={() => remove(u)}>Delete</button>}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
