import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { activityFormative, num, r2 } from "./grading.js";

export default function ActivitiesDialog({ title, initial, fmax, onSave, onClose }) {
  const [acts, setActs] = useState(initial.length ? initial.map((a) => ({ ...a })) : [{ mark: "", max: "" }, { mark: "", max: "" }]);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);
  const set = (i, key, v) => setActs(acts.map((a, j) => (j === i ? { ...a, [key]: v } : a)));
  const bad = (a) => (a.max !== "" && !(num(a.max) > 0)) || (a.mark !== "" && num(a.max) > 0 && (num(a.mark) == null || num(a.mark) < 0 || num(a.mark) > num(a.max)));
  const incomplete = (a) => (a.mark !== "") !== (a.max !== "");
  const used = acts.filter((a) => a.mark !== "" && a.max !== "");
  const sm = used.reduce((s, a) => s + (num(a.mark) || 0), 0), mx = used.reduce((s, a) => s + (num(a.max) || 0), 0);
  const total = activityFormative(used, fmax);
  const blocked = acts.some(bad) || acts.some(incomplete);
  return createPortal(
    <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog wide" role="dialog" aria-modal="true" aria-labelledby="actt">
        <h3 id="actt">Activities{title ? `: ${title}` : ""}</h3>
        <p className="muted">Enter each activity mark and its maximum. The formative mark is the total scaled to {fmax}.</p>
        <div className="actt-scroll">
          <table className="tbl small actt">
            <colgroup><col style={{ width: 110 }} /><col style={{ width: 160 }} /><col style={{ width: 160 }} /><col style={{ width: 90 }} /></colgroup>
            <thead><tr><th>Activity</th><th>Marks</th><th>Out of</th><th><span className="sr">Remove</span></th></tr></thead>
            <tbody>{acts.map((a, i) => (
              <tr key={i}>
                <td>Activity {i + 1}</td>
                <td><input type="number" aria-label={`Activity ${i + 1} marks`} className={bad(a) ? "bad" : ""} value={a.mark} onChange={(e) => set(i, "mark", e.target.value)} /></td>
                <td><input type="number" aria-label={`Activity ${i + 1} maximum`} value={a.max} onChange={(e) => set(i, "max", e.target.value)} /></td>
                <td><button type="button" className="linkbtn" onClick={() => setActs(acts.filter((_, j) => j !== i))}>Remove</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {acts.some(bad) && <p className="alert bad" role="alert">A mark is above its maximum, or a maximum is not above 0.</p>}
        {!acts.some(bad) && acts.some(incomplete) && <p className="alert bad" role="alert">Fill both marks and maximum for each activity, or remove the row.</p>}
        <p className="sumline">{used.length ? <>Total {r2(sm)} / {r2(mx)} → formative <b>{total}</b> out of {fmax}</> : "No activity marks yet."}</p>
        <div className="row crow">
          {acts.length < 10 && <button type="button" className="btn ghost" onClick={() => setActs([...acts, { mark: "", max: "" }])}>Add activity</button>}
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn teal" disabled={blocked} onClick={() => onSave(used, total)}>Apply</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
