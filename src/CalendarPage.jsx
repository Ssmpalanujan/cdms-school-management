import { SCHEDULES, status, d, nice } from "./calendar.js";

export default function CalendarPage({ s }) {
  const { meta, setMeta, role } = s;
  const canEdit = role === "admin";
  const key = meta.schedule || "tamil-sinhala";
  const sc = SCHEDULES[key];
  const st = status(key);
  const today = new Date();
  const days = (p) => Math.round((d(p.to) - d(p.from)) / 864e5) + 1;
  const maxDays = Math.max(...sc.periods.map(days));
  const state = (p) => (today > d(p.to) ? "Past" : today >= d(p.from) ? "Now" : "Upcoming");
  return (
    <>
      <div className="pagehead"><h2>Term calendar 2027</h2><div className="savebox"><span className="muted">Ministry of Education Circular 31/2026</span></div></div>
      <div className="row tabs" role="tablist">
        {Object.entries(SCHEDULES).filter(([k]) => canEdit || k === key).map(([k, v]) => (
          <button key={k} role="tab" aria-selected={k === key} className={k === key ? "btn" : "btn ghost"} onClick={() => setMeta({ ...meta, schedule: k })}>{v.label}</button>
        ))}
      </div>
      <section className="card banner">
        <div className="calendar-status"><b className={"tone-" + st.tone}>{st.label}</b><span>{st.sub}</span></div>
      </section>
      <section className="card">
        <div className="scroll">
          <table className="tbl cal">
            <colgroup><col style={{ width: "24%" }} /><col style={{ width: 130 }} /><col style={{ width: 130 }} /><col style={{ width: 70 }} /><col /><col style={{ width: 120 }} /></colgroup>
            <thead><tr><th>Period</th><th>From</th><th>To</th><th className="c">Days</th><th>Length</th><th className="c">Status</th></tr></thead>
            <tbody>
              {sc.periods.map((p, i) => (
                <tr key={i} className={p.kind === "holiday" ? "hol" : ""}>
                  <td>{p.term || p.label}</td><td>{nice(p.from)}</td><td>{nice(p.to)}</td>
                  <td className="c">{days(p)}</td>
                  <td><span className={"bar " + (p.kind === "holiday" ? "hol" : "")}><i style={{ width: (days(p) / maxDays) * 100 + "%" }} /></span></td>
                  <td className="c"><span className={"chip " + (state(p) === "Now" ? "teal" : "plain")}>{state(p)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sc.note && <p className="muted">{sc.note}</p>}
      </section>
    </>
  );
}
