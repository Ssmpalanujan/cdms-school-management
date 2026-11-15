import { useState } from "react";
import Icon from "./Icon.jsx";
import { readUsers, writeUsers, hashFor, idOf, findUser, roleOf, publicUser, USERS_KEY } from "./auth.js";

function Brand({ meta }) {
  return (
    <div className="brand">
      <div className="slogo big">{meta?.logo ? <img src={meta.logo} alt="School logo" /> : <Icon name="guide" size={40} />}</div>
      {meta?.schoolName && <b className="bname">{meta.schoolName}</b>}
    </div>
  );
}

export default function Login({ onLogin, meta }) {
  const [mode, setMode] = useState(readUsers().length ? "in" : "up");
  const [f, setF] = useState({ name: "", school: "", phone: "", id: "", email: "", password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [fails, setFails] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const up = mode === "up";
  const previewUser = mode === "in" && f.id.trim() ? findUser(readUsers(), f.id) : null;
  const finish = (u) => { setLeaving(true); setTimeout(() => onLogin(u), 280); };
  const switchMode = (next) => {
    setMode(next);
    setErr("");
    setF((current) => ({ ...current, password: "", confirm: "" }));
  };
  const failed = () => {
    const count = fails + 1;
    setFails(count);
    if (count >= 5) {
      setLockUntil(Date.now() + 30000);
      setFails(0);
      setErr("Too many attempts. Try again in 30 seconds.");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (Date.now() < lockUntil) return setErr("Too many attempts. Try again in 30 seconds.");
    const email = f.email.trim().toLowerCase();
    const identifier = (up ? email : f.id).trim().toLowerCase();
    if (up && !/^\S+@\S+\.\S+$/.test(email)) return setErr("Enter a valid email address.");
    if (!up && !identifier) return setErr("Enter your username or email.");
    if (up && !f.name.trim()) return setErr("Enter your name.");
    if (up && !f.school.trim()) return setErr("Enter your school name.");
    if (up && !/^[0-9+\s-]{9,15}$/.test(f.phone.trim())) return setErr("Enter a valid phone number.");
    if (up && f.password.length < 8) return setErr("Password must be at least 8 characters.");
    if (up && f.password !== f.confirm) return setErr("Passwords do not match.");
    if (!f.password) return setErr("Enter your password.");
    setBusy(true);
    try {
      const users = readUsers();
      if (up) {
        if (findUser(users, email)) return setErr("An account with this email already exists. Sign in instead.");
        const role = users.some((account) => roleOf(account) === "admin") ? "teacher" : "admin";
        const account = { name: f.name.trim(), email, role, school: f.school.trim(), phone: f.phone.trim() };
        writeUsers([...users, { ...account, hash: await hashFor(email, f.password) }]);
        finish(publicUser(account));
        return;
      }

      const account = findUser(users, identifier);
      if (account && account.hash === await hashFor(idOf(account), f.password)) {
        finish(publicUser(account));
        return;
      }
      failed();
      setErr((current) => current || "Username or password is incorrect.");
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Could not complete the account request.");
    } finally {
      setBusy(false);
    }
  };

  const clearAccounts = () => {
    if (!window.confirm("This removes EVERY account saved in this browser, including teacher and student logins. School data is not deleted. Continue?")) return;
    localStorage.removeItem(USERS_KEY);
    setMode("up");
    setErr("");
  };

  return (
    <div className={"login" + (up ? " signup-login" : "")}>
      <form className={"card lcard" + (up ? " signup-card" : "") + (leaving ? " leaving" : "")} onSubmit={submit} noValidate>
        <Brand meta={meta} />
        <h1 lang="ta">கல்வி வலை</h1>
        <p className="muted">Admin, teachers and students sign in with their username and password.</p>
        <div className="row tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!up} className={!up ? "btn" : "btn ghost"} onClick={() => switchMode("in")}>Sign in</button>
          <button type="button" role="tab" aria-selected={up} className={up ? "btn" : "btn ghost"} onClick={() => switchMode("up")}>Create account</button>
        </div>
        {err && <div className="alert bad" role="alert">{err}</div>}
        {up && <label className="field"><span>Full name</span><input value={f.name} onChange={set("name")} autoComplete="name" /></label>}
        {up && <label className="field"><span>School name</span><input value={f.school} onChange={set("school")} autoComplete="organization" /></label>}
        {up && <label className="field"><span>Phone number</span><input value={f.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" /></label>}
        {up
          ? <label className="field"><span>Email</span><input type="email" value={f.email} onChange={set("email")} autoComplete="email" /></label>
          : <label className="field"><span>Username or email</span><input type="text" value={f.id} onChange={set("id")} autoComplete="username" autoCapitalize="none" /></label>}
        {previewUser?.photo && (roleOf(previewUser) === "teacher" || roleOf(previewUser) === "student") && (
          <div className="login-profile-preview" aria-live="polite">
            <img src={previewUser.photo} alt={`${roleOf(previewUser)} profile`} />
            <span><b>{previewUser.name}</b><small>{roleOf(previewUser) === "teacher" ? "Teacher" : "Student"}</small></span>
          </div>
        )}
        <label className="field"><span>Password</span><input type={show ? "text" : "password"} value={f.password} onChange={set("password")} autoComplete={up ? "new-password" : "current-password"} /></label>
        {up && <label className="field"><span>Confirm password</span><input type={show ? "text" : "password"} value={f.confirm} onChange={set("confirm")} autoComplete="new-password" /></label>}
        {up && <p className="muted small">The first account becomes the admin. Later sign-ups are teachers. The admin creates student logins.</p>}
        <label className="switch"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /><span>Show password</span></label>
        <button className="btn big full" disabled={busy}>{busy ? "Please wait..." : up ? "Create account" : "Sign in"}</button>
        {!up && <>
          <button type="button" className="linkbtn forgot" onClick={() => setErr("Ask your school administrator to reset your password.")}>Forgot password?</button>
          <p className="login-powered-by"><span>Powerd By</span>{" "}<span className="login-powered-name">LittleBee Softwares</span></p>
        </>}
        {up && (
          <div className="linkcol">
            <button type="button" className="linkbtn" onClick={clearAccounts}>Remove all accounts on this device</button>
          </div>
        )}
      </form>
    </div>
  );
}
