import { useEffect, useRef } from "react";
import { useLocal } from "./useLocal.js";
import { owlReact } from "./owlBus.js";
import Icon from "./Icon.jsx";

export default function SetupChecklist({ s }) {
  const { meta, records, printed, go } = s;
  const [dismissed, setDismissed] = useLocal("srb-setup-dismissed", false);
  const steps = [
    { t: "School details", d: "Name, grade, class and class teacher.", ok: !!(meta.schoolName && meta.grade && meta.className && meta.classTeacher), to: "school", b: "Add details" },
    { t: "School logo", d: "Upload a PNG, SVG or JPG.", ok: !!meta.logo, to: "logo", b: "Upload logo" },
    { t: "Import marks", d: "Upload a workbook or add records.", ok: records.length > 0, to: "sheet", b: "Import marks" },
    { t: "Print report", d: "Print your first report card.", ok: !!printed, to: "records", b: "Print report" },
  ];
  const done = steps.filter((x) => x.ok).length;
  const R = 34, C = 2 * Math.PI * R;

  const prev = useRef(done);
  useEffect(() => {
    if (prev.current < steps.length && done === steps.length) owlReact("confetti", { en: "Setup complete. Great job!", ta: "அமைப்பு முடிந்தது. அருமை!" });
    prev.current = done;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  if (dismissed) return null;
  if (done === steps.length) {
    return (
      <section className="card setupdone">
        <span className="chip teal">Setup complete</span>
        <button className="btn ghost" onClick={() => setDismissed(true)}>Dismiss</button>
      </section>
    );
  }
  return (
    <section className="card setup">
      <div className="ring" role="progressbar" aria-label="Setup progress" aria-valuemin="0" aria-valuemax="4" aria-valuenow={done}>
        <svg viewBox="0 0 84 84" width="84" height="84" aria-hidden="true">
          <circle cx="42" cy="42" r={R} className="rtrack" />
          <circle cx="42" cy="42" r={R} className="rbar" strokeDasharray={C} strokeDashoffset={C * (1 - done / steps.length)} transform="rotate(-90 42 42)" />
        </svg>
        <span><b>{Math.round((done / steps.length) * 100)}%</b><small>{done} of {steps.length}</small></span>
      </div>
      <div className="steps">
        <h3>Get started</h3>
        <ul>
          {steps.map((x) => (
            <li key={x.t} className={x.ok ? "ok" : ""}>
              <span className="tick" aria-hidden="true">{x.ok && <Icon name="check" size={14} />}</span>
              <span><b>{x.t}</b><small>{x.ok ? "Done" : x.d}</small></span>
              {!x.ok && <button className="btn ghost sm" onClick={() => go("builder", x.to)}>{x.b}</button>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
