import { useEffect, useRef, useState } from "react";
import { AUDIENCES, audienceLabel, visibleTo, expired, validateAnnouncement } from "./announce.js";
import { uid as newId } from "./defaults.js";
import { toast } from "./toastBus.js";
import { Field } from "./ui.jsx";

const blank = { title: "", body: "", audience: "all", priority: "normal", until: "" };

export default function Announcements({ s }) {
  const { announcements, setAnnouncements, user, role, can, annSeen, setAnnSeen, uid } = s;
  const canPost = can("announce.post"), isAdmin = role === "admin";
  const prevSeen = useRef(annSeen[uid] || 0);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState("");
  const [errs, setErrs] = useState({});
  const [q, setQ] = useState(""), [fa, setFa] = useState("");
  useEffect(() => { const t = setTimeout(() => setAnnSeen((m) => ({ ...m, [uid]: Date.now() })), 1200); return () => clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const items = announcements
    .filter((a) => visibleTo(a, role, uid) && !(role === "student" && expired(a)) && (!fa || a.audience === fa) && (!q.trim() || `${a.title} ${a.body}`.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((x, y) => (y.priority === "important") - (x.priority === "important") || y.at - x.at);

  const submit = (e) => {
    e.preventDefault();
    const er = validateAnnouncement(form);
    setErrs(er);
    if (Object.keys(er).length) return toast("Please fix the highlighted fields.", "bad");
    const base = { ...form, title: form.title.trim(), body: form.body.trim() };
    if (editId) { setAnnouncements(announcements.map((a) => (a.id === editId ? { ...a, ...base, edited: Date.now() } : a))); toast("Announcement updated"); }
    else { setAnnouncements([...announcements, { ...base, id: newId(), author: user.name, role, at: Date.now() }]); toast(`Announcement posted for ${audienceLabel(form.audience).toLowerCase()}`); }
    setForm(blank); setEditId(""); setErrs({});
  };
  const edit = (a) => { setForm({ title: a.title, body: a.body, audience: a.audience, priority: a.priority, until: a.until || "" }); setEditId(a.id); setErrs({}); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const del = (a) => { if (window.confirm(`Delete "${a.title}"?`)) { setAnnouncements(announcements.filter((x) => x.id !== a.id)); toast("Announcement deleted"); } };

  return (
    <>
      <div className="pagehead"><h2>Announcements</h2><div className="savebox"><span className="muted">{items.length} shown</span></div></div>
      {canPost && (
        <section className="card">
          <h3>{editId ? "Edit announcement" : "New announcement"}</h3>
          <form onSubmit={submit} noValidate>
            <div className="grid grid3">
              <Field label="Title" error={errs.title}><input value={form.title} onChange={set("title")} maxLength={90} /></Field>
              <Field label="Show to" error={errs.audience}><select value={form.audience} onChange={set("audience")}>{AUDIENCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
              <Field label="Priority"><select value={form.priority} onChange={set("priority")}><option value="normal">Normal</option><option value="important">Important</option></select></Field>
            </div>
            <Field label="Message" error={errs.body}><textarea rows={4} value={form.body} onChange={set("body")} maxLength={1500} /></Field>
            <div className="grid grid3"><Field label="Show until (optional)" error={errs.until}><input type="date" value={form.until} onChange={set("until")} /></Field></div>
            <div className="row announcement-actions">
              <button className="btn teal">{editId ? "Save changes" : "Post announcement"}</button>
              {editId && <button type="button" className="btn ghost" onClick={() => { setForm(blank); setEditId(""); setErrs({}); }}>Cancel</button>}
            </div>
          </form>
        </section>
      )}
      <section className="card">
        <div className="filters">
          <input type="search" aria-label="Search announcements" placeholder="Search announcements" value={q} onChange={(e) => setQ(e.target.value)} />
          {role !== "student" && <select aria-label="Audience" value={fa} onChange={(e) => setFa(e.target.value)}><option value="">All audiences</option>{AUDIENCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}
        </div>
        {!announcements.length ? <p className="muted">No announcements yet.{canPost ? " Post the first one above." : ""}</p> : !items.length ? <p className="muted">No announcement matches your search.</p> : (
          <div className="annlist">
            {items.map((a) => (
              <article key={a.id} className={"ann" + (a.priority === "important" ? " imp" : "")}>
                <div className="annhead">
                  <h4>{a.title}</h4>
                  <div className="chips">
                    {a.at > prevSeen.current && a.author !== user.name && <span className="chip teal sm">New</span>}
                    {a.priority === "important" && <span className="chip amber sm">Important</span>}
                    <span className="chip plain sm">{audienceLabel(a.audience)}</span>
                    {expired(a) && <span className="chip plain sm">Expired</span>}
                  </div>
                </div>
                <p className="annbody">{a.body}</p>
                <div className="annfoot">
                  <span className="muted">By {a.author} ({a.role}) · {new Date(a.at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}{a.until ? ` · until ${a.until}` : ""}</span>
                  {(isAdmin || (canPost && a.author === user.name)) && <span className="acts"><button className="linkbtn" onClick={() => edit(a)}>Edit</button><button className="linkbtn del" onClick={() => del(a)}>Delete</button></span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
