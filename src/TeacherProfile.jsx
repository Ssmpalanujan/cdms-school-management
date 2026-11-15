import { useState } from "react";
import { createPortal } from "react-dom";
import { usePhotoCrop } from "./CropDialog.jsx";
import { logActivity } from "./activity.js";

export default function TeacherProfile({ meta, setMeta, onClose }) {
  const [name, setName] = useState(meta.classTeacher || "");
  const [photo, setPhoto] = useState(meta.teacherPhoto || "");
  const crop = usePhotoCrop((p) => setPhoto(p));
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "T";
  const save = () => {
    setMeta((m) => ({ ...m, classTeacher: name.trim(), teacherPhoto: photo }));
    logActivity("profile", "Teacher profile updated");
    onClose();
  };
  const modal = (
    <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog tprofile" role="dialog" aria-modal="true" aria-labelledby="tpt" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <h3 id="tpt">Teacher profile</h3>
        <div className="tpface">{photo ? <img src={photo} alt="Class teacher" /> : <span aria-hidden="true">{initials}</span>}</div>
        <div className="row center">
          <button type="button" className="btn ghost" onClick={crop.open}>{photo ? "Change photo" : "Add photo"}</button>
          {photo && <button type="button" className="btn ghost" onClick={() => setPhoto("")}>Remove photo</button>}
        </div>
        {crop.err && <p className="alert bad" role="alert">{crop.err}</p>}
        <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
        <p className="muted">Role: Class teacher</p>
        <div className="row crow">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn teal" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
  return <>{createPortal(modal, document.body)}{crop.input}{crop.dialog}</>;
}
