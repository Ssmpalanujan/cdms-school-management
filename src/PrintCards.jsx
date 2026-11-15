import { moduleResult, studentGpa, studentTotals } from "./grading.js";
import { Head } from "./ui.jsx";
import TeacherAvatar from "./TeacherAvatar.jsx";

// Student report cards. Hidden on screen (print only) unless `screen` is set.
export default function PrintCards({ s, screen = false }) {
  const { meta, records, cfg, obs, gradeOnly } = s;
  return (
    <div className={screen ? "cards screen" : "print-only"}>
      {records.map((r) => {
        const g = studentGpa(r.modules, cfg.scale, r.gpaOverride), t = studentTotals(r.modules, cfg.scale);
        return (
          <section className="report" key={r.studentId}>
            <Head meta={meta} />
            <p><strong>{r.name}</strong> · Index no {r.studentId} · {meta.grade} - {meta.className} · {meta.medium} · {meta.term} {meta.year}</p>
            <div className="scroll report-table-scroll">
              <table className="tbl">
                <thead><tr><th>Subject</th><th className="c">Formative</th><th className="c">Summative</th><th className="c">Total</th><th className="c">Grade</th>{!gradeOnly && <th className="c">GPV</th>}<th className="c">Credit</th>{!gradeOnly && <th className="c">Points</th>}</tr></thead>
                <tbody>{r.modules.map((m, i) => {
                  const x = moduleResult(m, cfg.scale), acts = (m.activities || []).filter((a) => a.mark !== "");
                  return (
                    <tr key={i}>
                      <td>{m.moduleTitle}{acts.length > 0 && <small className="actline"><br />{acts.map((a, k) => `A${k + 1} ${a.mark}/${a.max}`).join(" · ")}</small>}{m.absent && <small className="actline"><br />Absent{m.absentRemark ? `: ${m.absentRemark}` : ""}</small>}</td>
                      <td className="c">{m.absent ? "AB" : m.formative}</td><td className="c">{m.absent ? "AB" : m.summative}</td><td className="c">{m.absent ? "AB" : x.total}</td><td className="c">{x.grade}</td>
                      {!gradeOnly && <td className="c">{x.gpv.toFixed(2)}</td>}<td className="c">{x.absent ? "-" : x.credit}</td>{!gradeOnly && <td className="c">{x.points.toFixed(2)}</td>}
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            <p><strong>Total {t.total} · Average {t.avg.toFixed(2)} · Credits {g.credits}</strong></p>
            <p><strong>{gradeOnly ? `Overall grade ${g.grade}` : `GPA ${g.gpa.toFixed(2)} · Grade ${g.grade}`}</strong></p>
            <p>Teacher observations</p>
            {obs && r.remark ? <p className="remark">{r.remark}</p> : <><div className="line" /><div className="line" /></>}
            <div className="sign">{meta.teacherPhoto && <TeacherAvatar meta={meta} size={44} />}<span>Class teacher: {meta.classTeacher || "__________"}</span></div>
          </section>
        );
      })}
    </div>
  );
}
