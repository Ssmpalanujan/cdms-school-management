import { useState } from "react";
import { LEAVE_TYPES, DEFAULT_ENT, countDays, addWorkingDays, balance, validateLeave, nextNo, isLate, reminders, today } from "./leave.js";
import { uid } from "./defaults.js";
import { toast } from "./toastBus.js";
import { logActivity } from "./activity.js";
import NumField from "./NumField.jsx";
import { Field } from "./ui.jsx";
import { idOf, readUsers, roleOf } from "./auth.js";
import PersonAvatar from "./PersonAvatar.jsx";
import { SUBJECTS } from "./ClassAssignments.jsx";
import { getYearEntitlement, setYearEntitlement, canWriteYear } from "./academic.js";
import { pensionDetails, formatDateParts, validateTeacherDates, retirementGroup } from "./pension.js";
import { downloadTeacherPensions } from "./sheet.js";
import TeacherPageNav from "./TeacherPageNav.jsx";

const label = (k) => LEAVE_TYPES.find((t) => t[0] === k)?.[1] || k;
const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const blank = (teacher) => ({ teacher, type: "casual", from: "", days: "", to: "", submitted: today(), reason: "" });
const blankTeacher = { name: "", accountId: "", dateOfBirth: "", subject: "", subjectOther: "", phone: "", email: "", qualifications: "", address: "", dateJoined: "" };

export default function Leave({ s }) {
  const { meta, user, leaves, setLeaves, ent, setEnt, teachers, setTeachers, can, role } = s;
  const isAdmin = can("leave.approve");
  const isTeacherDetails = isAdmin && s.page === "teacherDetails";
  const me = isAdmin ? meta.classTeacher || user.name : user.name;
  const [tab, setTab] = useState(s.leaveTab || "requests");
  const activeTab = isTeacherDetails ? "teachers" : tab === "teachers" ? "requests" : tab;
  const [form, setForm] = useState(blank(me));
  const [editId, setEditId] = useState("");
  const [errs, setErrs] = useState({});
  const [done, setDone] = useState("");
  const [viewT, setViewT] = useState(me);
  const [fs, setFs] = useState(""), [ft, setFt] = useState(""), [fq, setFq] = useState(""), [fa, setFa] = useState(""), [fb, setFb] = useState("");
  const [year, setYear] = useState(String(s.currentYear || meta.year || new Date().getFullYear()));
  const names = [...new Set([me, ...teachers.map((t) => t.name), ...leaves.map((l) => l.teacher)].filter(Boolean))];
  const teacherAccounts = readUsers().filter((account) => roleOf(account) === "teacher");
  const photoForTeacher = (name) => teacherAccounts.find((account) => same(account.name, name))?.photo;
  const mineOnly = role === "teacher";
  const visible = mineOnly ? leaves.filter((l) => same(l.teacher, user.name)) : leaves;
  const upd = (patch) => setForm((f) => ({ ...f, ...patch }));
  const onFrom = (v) => {
    const n = Number(form.days);
    upd(n > 0
      ? { from: v, to: addWorkingDays(v, Math.ceil(n)) }
      : { from: v, days: form.to ? String(countDays(v, form.to) || "") : "" });
  };
  const onTo = (v) => {
    const n = Number(form.days);
    const keepFraction = form.days !== "" && Number.isFinite(n) && !Number.isInteger(n);
    upd({ to: v, days: keepFraction ? form.days : form.from ? String(countDays(form.from, v) || "") : form.days });
  };
  const onDays = (v) => {
    const n = Number(v);
    upd(n > 0 && form.from ? { days: v, to: addWorkingDays(form.from, Math.ceil(n)) } : { days: v });
  };
  const days = form.days === "" ? countDays(form.from, form.to) : Number(form.days);
  const who = mineOnly ? user.name : form.teacher;
  const bal = who.trim() && form.from ? balance(leaves, ent, who, form.from.slice(0, 4), editId)[form.type] : null;
  const yearEntitlement = getYearEntitlement(ent, year);
  const entitlementEditable = isAdmin && canWriteYear("admin", year, s.academicYears);
  const cards = balance(leaves, ent, mineOnly ? user.name : viewT, year);
  const rem = reminders(visible, ent, mineOnly ? user.name : me, today(), year);

  const reset = () => { setForm(blank(me)); setEditId(""); setErrs({}); };
  const submit = (e) => {
    e.preventDefault();
    const data = { ...form, teacher: (mineOnly ? user.name : form.teacher).trim() };
    const er = validateLeave(data, leaves, ent, editId);
    setErrs(er); setDone("");
    if (Object.keys(er).length) return toast("Please fix the highlighted fields.", "bad");
    const base = { ...data, reason: data.reason.trim(), days: data.days === "" ? countDays(data.from, data.to) : Number(data.days) };
    if (editId) {
      setLeaves(leaves.map((l) => (l.id === editId ? { ...l, ...base } : l)));
      setDone(`Leave updated: ${base.days} ${label(base.type).toLowerCase()} day${base.days === 1 ? "" : "s"} from ${base.from} to ${base.to}.`);
      toast("Leave request updated");
    } else {
      const rec = { ...base, id: uid(), no: nextNo(leaves, form.from.slice(0, 4)), status: "pending" };
      setLeaves([...leaves, rec]);
      setDone(`Leave ${rec.no} submitted for ${rec.teacher}: ${rec.days} ${label(rec.type).toLowerCase()} day${rec.days === 1 ? "" : "s"} from ${rec.from} to ${rec.to}. It is waiting for approval.`);
      toast(`Leave ${rec.no} submitted`);
      logActivity("leave", `Leave ${rec.no} submitted for ${rec.teacher}`);
    }
    reset();
  };
  const edit = (l) => { setForm({ teacher: l.teacher, type: l.type, from: l.from, days: String(l.days), to: l.to, submitted: l.submitted, reason: l.reason }); setEditId(l.id); setErrs({}); setDone(""); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const setStatus = (l, status) => {
    if (status === "approved") { const er = validateLeave({ ...l }, leaves.filter((x) => x.id !== l.id), ent, ""); if (er.type) return toast(er.type, "bad"); }
    setLeaves(leaves.map((x) => (x.id === l.id ? { ...x, status } : x)));
    toast(`Leave ${l.no} ${status}`);
  };
  const list = visible
    .filter((l) => (!fs || l.status === fs) && (!ft || l.type === ft) && (!fq.trim() || l.teacher.toLowerCase().includes(fq.trim().toLowerCase())) && (!fa || l.to >= fa) && (!fb || l.from <= fb))
    .sort((a, b) => b.from.localeCompare(a.from));

  // teachers tab (admin)
  const [tf, setTf] = useState(blankTeacher), [tEdit, setTEdit] = useState(""), [tErr, setTErr] = useState({}), [tq, setTq] = useState("");
  const [pensionSort, setPensionSort] = useState(1);
  const saveTeacher = (e) => {
    e.preventDefault();
    const er = {};
    if (!tf.name.trim()) er.name = "Enter the teacher name.";
    else if (teachers.some((t) => t.id !== tEdit && same(t.name, tf.name))) er.name = "This teacher already exists.";
    if (tf.accountId && teachers.some((t) => t.id !== tEdit && String(t.accountId || "").trim().toLowerCase() === tf.accountId)) er.accountId = "This teacher account is already linked.";
    if (tf.phone && !/^[0-9+\s-]{7,15}$/.test(tf.phone.trim())) er.phone = "Enter a valid phone number.";
    if (tf.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tf.email.trim())) er.email = "Enter a valid email address.";
    if (tf.subject === "Other" && !tf.subjectOther.trim()) er.otherSubject = "Enter the subject name.";
    if (tf.dateOfBirth) Object.assign(er, validateTeacherDates(tf, today()));
    else if (tf.dateJoined && tf.dateJoined > today()) er.dateJoined = "Date joined cannot be in the future.";
    setTErr(er);
    if (Object.keys(er).length) return toast("Please fix the highlighted fields.", "bad");
    const t = {
      ...tf,
      name: tf.name.trim(),
      subject: (tf.subject === "Other" ? tf.subjectOther : tf.subject).trim(),
      phone: tf.phone.trim(),
      email: tf.email.trim(),
      qualifications: tf.qualifications.trim(),
      address: tf.address.trim(),
      dateJoined: tf.dateJoined,
      dateOfBirth: tf.dateOfBirth,
    };
    if (tEdit) {
      setTeachers(teachers.map((x) => (x.id === tEdit ? { ...t, id: tEdit } : x)));
      logActivity("teacher-details", `Teacher details changed for ${t.name}`);
      toast("Teacher updated");
    } else {
      setTeachers([...teachers, { ...t, id: uid() }]);
      logActivity("teacher-details", `Teacher details added for ${t.name}`);
      toast(`${t.name} added`);
    }
    setTf(blankTeacher); setTEdit("");
  };
  const years = [...new Set([year, s.currentYear, ...Object.keys(ent || {}).filter((value) => /^\d{4}$/.test(value)), ...leaves.map((l) => l.from.slice(0, 4))].filter(Boolean))].sort();
  const pensionRows = teachers.map((teacher) => ({ teacher, ...pensionDetails(teacher, s.settings?.retirementAge || 60) }));
  const filteredPensionRows = pensionRows.filter((item) => !tq.trim() || `${item.teacher.name} ${item.teacher.subject || ""}`.toLowerCase().includes(tq.trim().toLowerCase()));
  const retireGroups = ["3 months", "6 months", "12 months"].map((group) => [group, pensionRows.filter((item) => retirementGroup(item.teacher, s.settings?.retirementAge || 60) === group)]);
  const tabs = isAdmin && !isTeacherDetails ? [["requests", "Requests"], ["balances", "Balances"]] : [];

  return (
    <>
      <div className="pagehead">
        {isAdmin ? (
          <>
            <h2 className="sr">{isTeacherDetails ? "Teacher details" : "Teacher leave"}</h2>
            <TeacherPageNav page={s.page} go={s.go} setLeaveTab={s.setLeaveTab} />
          </>
        ) : (
          <h2>{mineOnly ? "My leave" : "Teacher leave"}</h2>
        )}
        {isAdmin && !isTeacherDetails && <div className="savebox"><span className="muted">{leaves.filter((l) => l.status === "pending").length} pending</span></div>}
      </div>
      {tabs.length > 0 && (
        <div className="row tabs" role="tablist">
          {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={activeTab === k} className={activeTab === k ? "btn" : "btn ghost"} onClick={() => { setTab(k); s.setLeaveTab?.(k); }}>{l}</button>)}
        </div>
      )}

      {activeTab === "requests" && (
        <>
          <section className="card">
            <div className="acthead"><h3>Leave balance {year}{isAdmin ? `: ${viewT}` : ""}</h3>
              {isAdmin && <label className="dfil"><span>Teacher</span><select value={viewT} onChange={(e) => setViewT(e.target.value)}>{names.map((n) => <option key={n}>{n}</option>)}</select></label>}
            </div>
            <div className="lcards">
              {LEAVE_TYPES.map(([k, l]) => (
                <div key={k} className={"lcard" + (cards[k].remaining <= 2 && cards[k].total > 0 ? " low" : "")}>
                  <span className="muted">{l} leave</span><b>{cards[k].remaining}</b><span>{cards[k].total === 0 ? "0 days available" : `days left · ${cards[k].used} of ${cards[k].total} used`}</span>
                </div>
              ))}
            </div>
            {rem.length > 0 && <ul className="remlist">{rem.slice(0, 4).map((r, i) => <li key={i} className={r.tone}>{r.text}</li>)}</ul>}
          </section>

          <section className="card" id="leave-form">
            <h3>{editId ? "Edit leave request" : "Apply for leave"}</h3>
            {done && <div className="alert ok" role="status">{done}</div>}
            <form onSubmit={submit} noValidate>
              <datalist id="teacher-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
              <div className="grid">
                <Field label="Teacher name" error={errs.teacher}><input list={mineOnly ? undefined : "teacher-names"} value={mineOnly ? user.name : form.teacher} readOnly={mineOnly} onChange={(e) => upd({ teacher: e.target.value })} /></Field>
                <Field label="Leave type" error={errs.type}><select value={form.type} onChange={(e) => upd({ type: e.target.value })}>{LEAVE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
                <Field label="Start date" error={errs.from}><input type="date" value={form.from} onChange={(e) => onFrom(e.target.value)} /></Field>
                <Field label="Number of days"><NumField label="Number of days" min={0.5} max={60} step={0.5} value={form.days} onChange={onDays} /></Field>
                <Field label="End date" error={errs.to}><input type="date" min={form.from} value={form.to} onChange={(e) => onTo(e.target.value)} /></Field>
                <Field label="Submission date"><input type="date" value={form.submitted} onChange={(e) => upd({ submitted: e.target.value })} /></Field>
              </div>
              <Field label="Reason" error={errs.reason}><input value={form.reason} onChange={(e) => upd({ reason: e.target.value })} /></Field>
              <p className="muted leavecalc" aria-live="polite">
                {days ? `${days} working day${days === 1 ? "" : "s"} (Monday to Friday).` : "Choose the start date and the number of days, or the end date."}
                {bal && days > 0 ? (bal.total === 0 ? ` 0 days available for ${label(form.type).toLowerCase()} leave. Ask the administrator to change this year's entitlement.` : ` ${Math.max(bal.remaining, 0)} ${label(form.type).toLowerCase()} day${bal.remaining === 1 ? "" : "s"} remaining before this request.`) : ""}
                {form.from && form.submitted && form.submitted > form.from ? " This request is submitted after the start date." : ""}
              </p>
              <div className="row form-actions">
                <button className="btn teal">{editId ? "Save changes" : "Submit request"}</button>
                {editId && <button type="button" className="btn ghost" onClick={reset}>Cancel</button>}
              </div>
            </form>
          </section>

          <section className="card">
            <h3>Leave records</h3>
            <div className="filters">
              {!mineOnly && <input type="search" aria-label="Search teacher" placeholder="Search teacher" value={fq} onChange={(e) => setFq(e.target.value)} />}
              <select aria-label="Status" value={fs} onChange={(e) => setFs(e.target.value)}><option value="">All statuses</option>{["pending", "approved", "rejected", "cancelled"].map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</select>
              <select aria-label="Leave type" value={ft} onChange={(e) => setFt(e.target.value)}><option value="">All types</option>{LEAVE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <label className="dfil"><span>From</span><input type="date" value={fa} onChange={(e) => setFa(e.target.value)} /></label>
              <label className="dfil"><span>To</span><input type="date" value={fb} onChange={(e) => setFb(e.target.value)} /></label>
            </div>
            {!visible.length ? <p className="muted">No leave requests yet. Apply for leave above.</p> : !list.length ? <p className="muted">No leave record matches the filters.</p> : (
              <div className="scroll">
                <table className="tbl leavetbl">
                  <thead><tr><th>Leave no</th><th>Teacher</th><th>Type</th><th>Leave dates</th><th className="c">Days</th><th>Submitted</th><th>Status</th><th><span className="sr">Actions</span></th></tr></thead>
                  <tbody>{list.map((l) => (
                    <tr key={l.id}>
                      <td>{l.no}</td><td>{l.teacher}<small className="reason">{l.reason}</small></td><td>{label(l.type)}</td><td>{l.from} to {l.to}</td><td className="c">{l.days}</td>
                      <td>{l.submitted}{isLate(l) && <span className="chip amber sm">Late</span>}</td>
                      <td><span className={"chip st-" + l.status}>{l.status}</span></td>
                      <td className="acts">
                        {(l.status === "pending" || isAdmin) && l.status !== "cancelled" && <button className="linkbtn" onClick={() => edit(l)}>Edit</button>}
                        {isAdmin && l.status === "pending" && <><button className="linkbtn" onClick={() => setStatus(l, "approved")}>Approve</button><button className="linkbtn del" onClick={() => setStatus(l, "rejected")}>Reject</button></>}
                        {(l.status === "pending" || l.status === "approved") && <button className="linkbtn del" onClick={() => { if (window.confirm(`Cancel leave ${l.no}?`)) setStatus(l, "cancelled"); }}>Cancel</button>}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === "balances" && isAdmin && (
        <section className="card">
          <div className="acthead"><h3>Leave balances</h3><label className="dfil"><span>Year</span><select value={year} onChange={(e) => setYear(e.target.value)}>{years.map((y) => <option key={y}>{y}</option>)}</select></label></div>
          <p className="muted">Pending and approved leave count as used. Cancelled and rejected leave does not.</p>
          <div className="scroll">
            <table className="tbl bal">
              <thead><tr><th>Teacher</th>{LEAVE_TYPES.map(([k, l]) => <th key={k} className="c">{l}<small>used / total</small></th>)}</tr></thead>
              <tbody>{names.map((n) => {
                const b = balance(leaves, ent, n, year);
                return <tr key={n}><td>{n}</td>{LEAVE_TYPES.map(([k]) => <td key={k} className={"c" + (b[k].remaining < 0 ? " neg" : "")}>{b[k].used} / {b[k].total}<small>{b[k].remaining} left</small></td>)}</tr>;
              })}</tbody>
            </table>
          </div>
          {!names.length && <p className="muted">Add a teacher or a leave request to see balances.</p>}
          <h3 className="sub">Yearly entitlement</h3>
          <p className="muted">Entitlements are configured separately by academic year. New years default to Casual 21, Sick 21, Special 0, Duty 0 days.</p>
          <div className="grid">{LEAVE_TYPES.map(([k, l]) => <Field key={k} label={`${l} leave days`}><NumField label={`${l} leave days`} min={0} value={yearEntitlement[k]} disabled={!entitlementEditable} onChange={(v) => setEnt((all) => setYearEntitlement(all, year, { ...yearEntitlement, [k]: Math.max(0, Number(v) || 0) }))} /></Field>)}</div>
          <button className="btn ghost sm" disabled={!entitlementEditable} onClick={() => setEnt((all) => setYearEntitlement(all, year, DEFAULT_ENT))}>Reset this year to defaults</button>
          {!entitlementEditable && <p className="muted">Entitlements for a closed or unknown year are read-only.</p>}
        </section>
      )}

      {activeTab === "teachers" && isAdmin && (
        <>
          <section className="card">
            <h3>Retirement settings</h3>
            <Field label="Retirement age (years)"><NumField label="Retirement age" min={18} max={100} value={s.settings?.retirementAge || 60} onChange={(value) => {
              const retirementAge = Math.min(100, Math.max(18, Math.floor(Number(value) || 60)));
              s.setSettings({ ...s.settings, retirementAge });
              logActivity("retirement-setting", `Retirement age changed to ${retirementAge}`);
            }} /></Field>
            <p className="muted">Retirement age is a setting. Confirm the applicable rule with the official circular.</p>
            <div className="duo">{retireGroups.map(([group, list]) => <div key={group}><h4>Retiring within {group}</h4>{list.length ? <ul>{list.map(({ teacher, retirementDate }) => <li key={teacher.id}>{teacher.name} · {retirementDate}</li>)}</ul> : <p className="muted">No teachers in this period.</p>}</div>)}</div>
          </section>
          <section className="card">
            <h3>{tEdit ? "Edit teacher details" : "Add teacher details"}</h3>
            <form onSubmit={saveTeacher} noValidate>
              <div className="grid teacher-details-grid">
                <Field label="Teacher name" error={tErr.name}><input value={tf.name} onChange={(e) => setTf({ ...tf, name: e.target.value })} /></Field>
                <Field label="Linked teacher account" error={tErr.accountId}><select aria-label="Linked teacher account" value={tf.accountId || ""} onChange={(e) => setTf({ ...tf, accountId: e.target.value })}><option value="">Not linked</option>{teacherAccounts.map((account) => <option key={idOf(account)} value={idOf(account)}>{account.name} · {idOf(account)}</option>)}</select></Field>
                <Field label="Date of birth" error={tErr.dateOfBirth}><input type="date" value={tf.dateOfBirth || ""} onChange={(e) => setTf({ ...tf, dateOfBirth: e.target.value })} /></Field>
                <Field label="Subject" error={tErr.otherSubject}><select aria-label="Subject" value={tf.subject} onChange={(e) => setTf({ ...tf, subject: e.target.value, subjectOther: e.target.value === "Other" ? tf.subjectOther : "" })}><option value="">Choose a subject</option>{SUBJECTS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}<option value="Other">Other</option></select></Field>
                <Field label="Phone" error={tErr.phone}><input value={tf.phone} inputMode="tel" onChange={(e) => setTf({ ...tf, phone: e.target.value })} /></Field>
                {tf.subject === "Other" && <Field label="Other subject"><input value={tf.subjectOther} onChange={(e) => setTf({ ...tf, subjectOther: e.target.value })} /></Field>}
                <Field label="Email" error={tErr.email}><input type="email" value={tf.email} onChange={(e) => setTf({ ...tf, email: e.target.value })} /></Field>
                <Field label="Qualifications"><input value={tf.qualifications} onChange={(e) => setTf({ ...tf, qualifications: e.target.value })} /></Field>
                <Field label="Address"><input value={tf.address} onChange={(e) => setTf({ ...tf, address: e.target.value })} /></Field>
                <Field label="Date joined" error={tErr.dateJoined}><input type="date" value={tf.dateJoined} onChange={(e) => setTf({ ...tf, dateJoined: e.target.value })} /></Field>
              </div>
              <div className="row form-actions"><button className="btn teal">{tEdit ? "Save changes" : "Add teacher"}</button>{tEdit && <button type="button" className="btn ghost" onClick={() => { setTEdit(""); setTf(blankTeacher); }}>Cancel</button>}</div>
            </form>
          </section>
          <section className="card">
            <div className="acthead"><h3>Teachers</h3><input className="search" type="search" aria-label="Search teachers" placeholder="Search teachers" value={tq} onChange={(e) => setTq(e.target.value)} /></div>
            {(() => {
              const l = teachers.filter((t) => !tq.trim() || `${t.name} ${t.subject}`.toLowerCase().includes(tq.trim().toLowerCase()));
              if (!teachers.length) return <p className="muted">No teachers added yet. Names from leave requests still appear in the balances.</p>;
              if (!l.length) return <p className="muted">No teacher matches the search.</p>;
              return (
                <div className="scroll"><table className="tbl">
                  <thead><tr><th>Teacher</th><th>Date of birth</th><th>Subject</th><th>Phone</th><th>Email</th><th>Qualifications</th><th>Address</th><th>Date joined</th><th><span className="sr">Actions</span></th></tr></thead>
                  <tbody>{l.map((t) => (
                    <tr key={t.id}><td><span className="person-cell"><PersonAvatar name={t.name} photo={photoForTeacher(t.name)} />{t.name}</span></td><td>{t.dateOfBirth || "–"}</td><td>{t.subject || "–"}</td><td>{t.phone || "–"}</td><td>{t.email || "–"}</td><td>{t.qualifications || "–"}</td><td>{t.address || "–"}</td><td>{t.dateJoined || "–"}</td>
                      <td className="acts"><button className="linkbtn" onClick={() => { setTf({ ...blankTeacher, ...t, subject: SUBJECTS.includes(t.subject) ? t.subject : t.subject ? "Other" : "", subjectOther: SUBJECTS.includes(t.subject) ? "" : t.subject || "" }); setTEdit(t.id); }}>Edit</button><button className="linkbtn del" onClick={() => { if (window.confirm(`Delete ${t.name}? Their leave records are kept.`)) { setTeachers(teachers.filter((x) => x.id !== t.id)); toast("Teacher deleted"); } }}>Delete</button></td></tr>
                  ))}</tbody>
                </table></div>
              );
            })()}
          </section>
          <section className="card pension-panel">
            <div className="acthead"><div><h3>All teacher pension dates</h3><span className="muted">Sorted by retirement date · Confirm the rule with the official circular.</span></div><button className="btn ghost" onClick={() => downloadTeacherPensions(pensionRows, s.settings?.retirementAge || 60)}>Export Excel</button></div>
            <div className="filters"><input type="search" aria-label="Filter pension table" placeholder="Filter teachers" value={tq} onChange={(event) => setTq(event.target.value)} /></div>
            {!filteredPensionRows.length ? <p className="muted">No teacher pension records match this filter.</p> : <div className="scroll"><table className="tbl small teacher-pension-table">
              <thead><tr><th>Teacher</th><th><button type="button" className="linkbtn" onClick={() => setPensionSort((direction) => direction * -1)}>Retirement date ↕</button></th><th>Time remaining</th><th>Days left</th><th>Service completed</th><th>Status</th></tr></thead>
              <tbody>{[...filteredPensionRows].sort((a, b) => pensionSort * a.retirementDate.localeCompare(b.retirementDate)).map(({ teacher, retirementDate, remaining, daysLeft, service, retired }) => <tr key={teacher.id}><td>{teacher.name}</td><td>{retirementDate || "Add date of birth"}</td><td>{retirementDate ? formatDateParts(remaining) : "–"}</td><td>{daysLeft ?? "–"}</td><td>{service ? formatDateParts(service) : "Add date joined"}</td><td><span className={`chip ${retired ? "st-rejected" : "st-approved"}`}>{retired ? "Retired" : "Active"}</span></td></tr>)}</tbody>
            </table></div>}
          </section>
        </>
      )}
    </>
  );
}
