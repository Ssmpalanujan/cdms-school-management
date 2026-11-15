import { useState } from "react";
import { useLocal } from "./useLocal.js";
import { upcoming, d } from "./calendar.js";

const label = (n) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);

export default function UpcomingDates({ s, readOnly = false }) {
  const { meta, go } = s;
  const [custom, setCustom] = useLocal("srb-dates", []);
  const [f, setF] = useState({ title: "", date: "" });
  const [err, setErr] = useState("");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const items = [
    ...upcoming(meta.schedule || "tamil-sinhala", now),
    ...custom.map((c) => ({ date: c.date, title: c.title, sub: "Added by you", id: c.id })),
  ].filter((i) => d(i.date) >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);

  const add = (e) => {
    e.preventDefault();
    if (!f.title.trim() || !f.date) return setErr("Enter a title and a date.");
    setCustom([...custom, { id: Math.random().toString(36).slice(2, 9), title: f.title.trim(), date: f.date }]);
    setF({ title: "", date: "" }); setErr("");
  };

  return (
    <section className="card upc">
      <div className="acthead"><h3>Upcoming dates</h3><button className="linkbtn" onClick={() => go("calendar")}>View full calendar</button></div>
      {!items.length ? <p className="muted">Nothing upcoming. Add a date below.</p> : (
        <ul className="dates">
          {items.map((i, idx) => {
            const dt = d(i.date), n = Math.round((dt - today) / 864e5);
            return (
              <li key={i.date + i.title} className={idx === 0 ? "first" : ""}>
                <span className="dbadge"><b>{dt.getDate()}</b>{dt.toLocaleDateString("en-GB", { month: "short" })}</span>
                <span className="dtext"><b>{i.title}</b>{i.sub && <small>{i.sub}</small>}</span>
                <span className="dwhen">{label(n)}</span>
                {i.id && !readOnly && <button className="linkbtn" aria-label={`Delete ${i.title}`} onClick={() => setCustom(custom.filter((c) => c.id !== i.id))}>Delete</button>}
              </li>
            );
          })}
        </ul>
      )}
      {!readOnly && <details>
        <summary>Add your own date (for example exams)</summary>
        <form className="dform" onSubmit={add}>
          <input aria-label="Title" placeholder="Term 1 exams" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <input aria-label="Date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          <button className="btn">Add date</button>
        </form>
        {err && <p className="alert bad" role="alert">{err}</p>}
      </details>}
    </section>
  );
}
