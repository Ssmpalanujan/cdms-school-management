import { moduleResult, studentGpa, studentTotals } from "./grading.js";
import PrintCards from "./PrintCards.jsx";

export const findMine = (s) => {
  const me = s.students.find((x) => x.id === s.user.linkId);
  const rec = me ? s.records.find((r) => String(r.studentId).toLowerCase() === me.index.toLowerCase()) : null;
  return { me, rec };
};

// One student's marks for the selected year and term
export function ResultTable({ s, rec, detailed = false }) {
  const { cfg, gradeOnly } = s;
  const g = studentGpa(rec.modules, cfg.scale, rec.gpaOverride), t = studentTotals(rec.modules, cfg.scale);
  return (
    <>
      <div className="scroll">
        <table className="tbl restbl">
          <thead><tr><th>Subject</th><th className="c">Formative</th><th className="c">Summative</th><th className="c">Total</th><th className="c">Grade</th>{detailed && <th className="c">Credit</th>}</tr></thead>
          <tbody>{rec.modules.map((m, i) => {
            const x = moduleResult(m, cfg.scale), acts = (m.activities || []).filter((a) => a.mark !== "");
            return (
              <tr key={i}>
                <td>{m.moduleTitle}{detailed && acts.length > 0 && <small className="actline"><br />{acts.map((a, k) => `Activity ${k + 1}: ${a.mark}/${a.max}`).join(" · ")}</small>}{m.absent && <small className="actline"><br />Absent{m.absentRemark ? `: ${m.absentRemark}` : ""}</small>}</td>
                <td className="c">{m.absent ? "AB" : m.formative}</td><td className="c">{m.absent ? "AB" : m.summative}</td><td className="c">{m.absent ? "AB" : x.total ?? "–"}</td><td className="c"><b>{x.grade}</b></td>{detailed && <td className="c">{x.absent ? "-" : x.credit}</td>}
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <div className="statrow resum">
        <div><b>{t.total}</b><span>Total marks</span></div>
        <div><b>{t.avg.toFixed(1)}</b><span>Average</span></div>
        {!gradeOnly && <div><b>{g.gpa.toFixed(2)}</b><span>GPA</span></div>}
        <div><b>{g.grade}</b><span>{gradeOnly ? "Overall grade" : "Grade"}</span></div>
      </div>
    </>
  );
}

export default function Results({ s }) {
  const { meta, store, cfg, gradeOnly, print, user } = s;
  const { me, rec } = findMine(s);
  if (!me) return <><div className="pagehead"><h2>My results</h2></div><section className="card"><p className="muted">Your account is not linked to a student record yet. Ask your school admin to link it.</p></section></>;
  const terms = Object.entries(store).filter(([k]) => k.startsWith(meta.year + "|")).map(([k, recs]) => [k.split("|")[1], recs.find((r) => String(r.studentId).toLowerCase() === me.index.toLowerCase())]).filter(([, r]) => r).sort((a, b) => a[0].localeCompare(b[0]));
  return (
    <>
      <div className="pagehead"><h2>My results</h2><button className="btn" onClick={print} disabled={!rec}>Print my report card</button></div>
      <section className="card">
        <dl className="kv pf"><dt>Name</dt><dd>{me.name}</dd><dt>Index number</dt><dd>{me.index}</dd><dt>Class</dt><dd>{me.grade} {me.division}</dd><dt>Period</dt><dd>{meta.term} {meta.year}</dd></dl>
      </section>
      <section className="card">
        <h3>{meta.term} {meta.year}</h3>
        {rec ? <ResultTable s={s} rec={rec} detailed /> : <p className="muted">No marks have been entered for you in {meta.term} {meta.year} yet. Use the year and term at the top to look at another term.</p>}
      </section>
      {terms.length > 0 && (
        <section className="card">
          <h3>All terms in {meta.year}</h3>
          <table className="tbl small"><thead><tr><th>Term</th><th className="c">Total</th><th className="c">Average</th>{!gradeOnly && <th className="c">GPA</th>}<th className="c">Grade</th></tr></thead>
            <tbody>{terms.map(([term, r]) => { const g = studentGpa(r.modules, cfg.scale, r.gpaOverride), t = studentTotals(r.modules, cfg.scale); return <tr key={term}><td>{term}</td><td className="c">{t.total}</td><td className="c">{t.avg.toFixed(1)}</td>{!gradeOnly && <td className="c">{g.gpa.toFixed(2)}</td>}<td className="c"><b>{g.grade}</b></td></tr>; })}</tbody>
          </table>
        </section>
      )}
      {rec && <PrintCards s={{ ...s, records: [rec], obs: false }} />}
    </>
  );
}
