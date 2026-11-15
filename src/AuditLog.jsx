import { useActivity, ago } from "./activity.js";

export default function AuditLog() {
  const entries = useActivity();
  return (
    <>
      <div className="pagehead"><h2>Activity history</h2><span className="muted">{entries.length} recent event{entries.length === 1 ? "" : "s"}</span></div>
      <section className="card">
        {!entries.length ? <p className="muted">Important actions will appear here as they are recorded.</p>
          : <ol className="audit-list">{entries.map((entry, index) => <li key={`${entry.at}-${index}`}><div><b>{entry.message}</b><span className="muted">{entry.actor || "School user"} · {ago(entry.at)}</span></div><span className="chip plain">{entry.type}</span></li>)}</ol>}
        <p className="muted">This history is stored in this browser only. It is not shared between devices or tamper-resistant.</p>
      </section>
    </>
  );
}
