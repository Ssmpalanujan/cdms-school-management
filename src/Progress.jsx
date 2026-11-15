import { useMemo, useState } from "react";
import { buildProgressAlerts, comparePeriods, periodsInOrder } from "./analytics.js";
import { Head } from "./ui.jsx";

export default function Progress({ s }) {
  const { store, students, meta, cfg } = s;
  const periods = useMemo(() => periodsInOrder(store), [store]);
  const [earlier, setEarlier] = useState("");
  const [later, setLater] = useState("");
  const alerts = useMemo(() => buildProgressAlerts({ store, students, meta, cfg }), [store, students, meta, cfg]);
  const first = earlier || periods.at(-2) || "";
  const second = later || periods.at(-1) || "";
  const comparisons = useMemo(() => first && second && first !== second ? comparePeriods(store, first, second, cfg.scale) : [], [store, first, second, cfg.scale]);

  return (
    <>
      <div className="pagehead"><h2>Student progress</h2><span className="muted">{alerts.length} alert{alerts.length === 1 ? "" : "s"} for {meta.term} {meta.year}</span></div>
      <section className="card">
        <h3>Progress alerts</h3>
        {!alerts.length ? <p className="muted">No missing, low, or falling results detected for the current class and term.</p>
          : <div className="alert-list">{alerts.map((alert) => <article className="alert-row" key={alert.id}><b>{alert.kind}</b><span>{alert.message}</span></article>)}</div>}
      </section>
      <section className="card">
        <div className="acthead"><h3>Term-to-term comparison</h3>
          <div className="row compare-selects">
            <label className="field"><span>Earlier term</span><select value={first} onChange={(event) => setEarlier(event.target.value)}>{periods.map((period) => <option key={period}>{period}</option>)}</select></label>
            <label className="field"><span>Later term</span><select value={second} onChange={(event) => setLater(event.target.value)}>{periods.map((period) => <option key={period}>{period}</option>)}</select></label>
          </div>
        </div>
        {periods.length < 2 || first === second ? <p className="muted">Save marks for at least two different terms to compare results.</p>
          : !comparisons.length ? <p className="muted">No students have marks in these terms.</p>
            : <div className="scroll"><table className="tbl compare-table">
              <thead><tr><th>Student</th><th className="c">{first.replace("|", " ")}</th><th className="c">{second.replace("|", " ")}</th><th className="c">Change</th><th>Subject changes</th></tr></thead>
              <tbody>{comparisons.map((row) => <tr key={row.studentId}>
                <td>{row.name} <small className="muted">({row.studentId})</small></td>
                <td className="c">{row.beforeAverage == null ? "–" : `${row.beforeAverage.toFixed(1)}%`}</td>
                <td className="c">{row.afterAverage == null ? "–" : `${row.afterAverage.toFixed(1)}%`}</td>
                <td className="c">{row.averageChange == null ? "–" : `${row.averageChange > 0 ? "+" : ""}${row.averageChange.toFixed(1)}%`}</td>
                <td>{row.subjects.filter((subject) => subject.change != null).map((subject) => `${subject.subject}: ${subject.change > 0 ? "+" : ""}${subject.change.toFixed(1)}`).join(" · ") || "No comparable subjects"}</td>
              </tr>)}</tbody>
            </table></div>}
      </section>
      <section className="card print-friendly">
        <div className="acthead"><h3>Parent-friendly progress summary</h3><button className="btn ghost no-print" onClick={() => window.print()} disabled={!comparisons.length}>Print / Save PDF</button></div>
        {comparisons.length ? <>
          <Head meta={meta} />
          <p className="muted">A simple comparison of each student's average and subject changes. Use your browser's print dialog to save or share as PDF.</p>
          <div className="scroll"><table className="tbl"><thead><tr><th>Student</th><th>Previous average</th><th>Current average</th><th>Change</th></tr></thead>
            <tbody>{comparisons.map((row) => <tr key={row.studentId}><td>{row.name} · {row.studentId}</td><td>{row.beforeAverage == null ? "Not available" : `${row.beforeAverage.toFixed(1)}%`}</td><td>{row.afterAverage == null ? "Not available" : `${row.afterAverage.toFixed(1)}%`}</td><td>{row.averageChange == null ? "–" : `${row.averageChange > 0 ? "+" : ""}${row.averageChange.toFixed(1)}%`}</td></tr>)}</tbody></table></div>
        </> : <p className="muted">Select two terms with saved marks to prepare a parent-friendly summary.</p>}
      </section>
    </>
  );
}
