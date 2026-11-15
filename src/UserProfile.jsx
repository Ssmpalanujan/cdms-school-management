import { useState } from "react";
import { createPortal } from "react-dom";
import { usePhotoCrop } from "./CropDialog.jsx";
import { Field } from "./ui.jsx";

export default function UserProfile({ user, initialPhoto, onSave, onClose }) {
  const [name, setName] = useState(user.name || "");
  const [photo, setPhoto] = useState(user.photo || initialPhoto || "");
  const [error, setError] = useState("");
  const crop = usePhotoCrop(setPhoto);
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "U";
  const role = user.role === "teacher" ? "Teacher" : user.role === "admin" ? "Admin" : "Student";
  const save = () => {
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (onSave({ name: name.trim(), photo })) onClose();
  };
  const modal = (
    <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog tprofile" role="dialog" aria-modal="true" aria-labelledby="upt" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <h3 id="upt">Edit profile</h3>
        <div className="tpface">{photo ? <img src={photo} alt={`${role} profile`} /> : <span aria-hidden="true">{initials}</span>}</div>
        <div className="row center">
          <button type="button" className="btn ghost" onClick={crop.open}>{photo ? "Change photo" : "Add photo"}</button>
          {photo && <button type="button" className="btn ghost" onClick={() => setPhoto("")}>Remove photo</button>}
        </div>
        {crop.err && <p className="alert bad" role="alert">{crop.err}</p>}
        <Field label="Name" error={error}><input value={name} onChange={(e) => { setName(e.target.value); setError(""); }} autoFocus maxLength={100} /></Field>
        <p className="muted profile-role">Role: {role}</p>
        <div className="row crow">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn teal" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
  return <>{createPortal(modal, document.body)}{crop.input}{crop.dialog}</>;
}
