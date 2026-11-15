import { usePhotoCrop } from "./CropDialog.jsx";
import { logActivity } from "./activity.js";

export default function TeacherAvatar({ meta, setMeta, size = 64, editable = false }) {
  const crop = usePhotoCrop((photo) => { setMeta((m) => ({ ...m, teacherPhoto: photo })); logActivity("photo", "Teacher photo updated"); });
  const initials = (meta.classTeacher || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "T";
  return (
    <div className="tav">
      <div className="tavface" style={{ width: size, height: size, fontSize: size / 3 }}>
        {meta.teacherPhoto ? <img src={meta.teacherPhoto} alt="Class teacher" /> : <span aria-hidden="true">{initials}</span>}
      </div>
      {editable && (
        <>
          <button className="linkbtn no-print" onClick={crop.open}>{meta.teacherPhoto ? "Change photo" : "Add photo"}</button>
          {crop.input}{crop.dialog}
        </>
      )}
      {crop.err && <small className="terr no-print" role="alert">{crop.err}</small>}
    </div>
  );
}
