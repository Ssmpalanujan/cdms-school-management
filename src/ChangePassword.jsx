import { useState } from "react";
import { createPortal } from "react-dom";
import { readUsers, writeUsers, hashFor, idOf } from "./auth.js";
import { toast } from "./toastBus.js";

export default function ChangePassword({ user, onClose }) {
  const [f, setF] = useState({ cur: "", next: "", again: "" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const users = readUsers(), me = idOf(user), acc = users.find((u) => idOf(u) === me);
    if (!acc) return setErr("This account was not found on this device.");
    if ((await hashFor(me, f.cur)) !== acc.hash) return setErr("The current password is not correct.");
    if (f.next.length < 8) return setErr("The new password needs at least 8 characters.");
    if (f.next !== f.again) return setErr("The new passwords do not match.");
    const hash = await hashFor(me, f.next);
    writeUsers(readUsers().map((u) => (idOf(u) === me ? { ...u, hash } : u)));
    toast("Password changed");
    onClose();
  };
  return createPortal(
    <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="cpt" onSubmit={save} noValidate onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <h3 id="cpt">Change password</h3>
        {err && <p className="alert bad" role="alert">{err}</p>}
        <label className="field"><span>Current password</span><input type="password" autoFocus value={f.cur} onChange={set("cur")} autoComplete="current-password" /></label>
        <label className="field"><span>New password</span><input type="password" value={f.next} onChange={set("next")} autoComplete="new-password" /></label>
        <label className="field"><span>Confirm new password</span><input type="password" value={f.again} onChange={set("again")} autoComplete="new-password" /></label>
        <div className="row crow"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn teal">Change password</button></div>
      </form>
    </div>,
    document.body
  );
}
