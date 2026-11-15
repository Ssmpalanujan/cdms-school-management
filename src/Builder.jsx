import { useRef, useState } from "react";
import { DEFAULT_SCALE, moduleResult, studentGpa, studentTotals, validate, warnings, hasData, num, moduleKey } from "./grading.js";
import { downloadWorkbook, downloadMarksReport, importWorkbook, REQUIRED, OPTIONAL } from "./sheet.js";
import { SCHEDULES } from "./calendar.js";
import { blankRow } from "./defaults.js";
import { mergeRecords, countDuplicates } from "./merge.js";
import { syncStudents } from "./students.js";
import { trimLogo } from "./image.js";
import { logActivity } from "./activity.js";
import { createCheckpoint } from "./backup.js";
import { owlReact } from "./owlBus.js";
import { toast } from "./toastBus.js";
import NumField from "./NumField.jsx";
import ActivitiesDialog from "./ActivitiesDialog.jsx";
import PrintCards from "./PrintCards.jsx";
import ScopedMarksEntry from "./ScopedMarksEntry.jsx";
import { Field } from "./ui.jsx";

export default function Builder({ s }) {
  const workflowEnabled = s.role === "teacher" && (s.classAssignments || []).some((assignment) =>
    String(assignment.year || s.meta.year) === String(s.meta.year),
  );
  return <LegacyBuilder s={s} workflowEnabled={workflowEnabled} />;
}

function LegacyBuilder({ s, workflowEnabled }) {
  const { meta, setMeta, rows, setRows, records, setRecords, setRecordsFor, store, cfg, setCfg, obs, setObs, go, print, students, setStudents, can, gradeOnly, setGradeOnly, autosave, setAutosave, dirty, commitRows } = s;
  const [errs, setErrs] = useState([]);
  const [note, setNote] = useState("");
  const [bmsg, setBmsg] = useState(null);
  const [savedAt, setSavedAt] = useState("");
  const [sheetMsg, setSheetMsg] = useState(null);
  const [actRow, setActRow] = useState(null);
  const [activeRowId, setActiveRowId] = useState(rows[0]?.id);
  const [q, setQ] = useState("");
  const [gpaEdit, setGpaEdit] = useState(null);
  const fileRef = useRef(), logoRef = useRef();
  const smax = 100 - cfg.fmax;
  const m = (k) => ({ value: meta[k] ?? "", onChange: (e) => setMeta({ ...meta, [k]: e.target.value }) });
  const admin = can("grading");
  const upd = (id, k, v) => setRows(rows.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
  const classStudents = students.filter((x) => x.grade === meta.grade && x.division.toLowerCase() === String(meta.className).toLowerCase());
  const pickList = classStudents.length ? classStudents : students;

  const onIndex = (id, val) => {
    const st = students.find((x) => x.index.trim().toLowerCase() === val.trim().toLowerCase());
    setRows(rows.map((r) => (r.id === id ? { ...r, studentId: val, name: st ? st.name : r.name } : r)));
  };

  const say = (type, lines, extra = {}) => setBmsg({ type, lines: [].concat(lines), ...extra });
  const sayErrors = (e) => {
    const used = rows.filter(hasData);
    const mf = Math.max(0, ...used.map((r) => num(r.formative) ?? 0)), ms = Math.max(0, ...used.map((r) => num(r.summative) ?? 0));
    const fixes = e.some((x) => /must be between/.test(x))
      ? [[70, 30], [60, 40], [50, 50], [40, 60]].filter(([f]) => f !== cfg.fmax && mf <= f && ms <= 100 - f).slice(0, 2)
      : [];
    setBmsg({ type: "bad", lines: e, fixes });
    owlReact("think", { en: "Let us fix the marked problems first.", ta: "முதலில் குறிப்பிடப்பட்ட பிழைகளைச் சரிசெய்வோம்." });
  };
  const applyWeights = (f) => { setCfg({ ...cfg, fmax: f }); say("ok", `Weights set to ${f} / ${100 - f}. Choose Add record again.`); };
  const addModule = () => { setRows([...rows, blankRow()]); say("ok", `Row added. You now have ${rows.length + 1} rows.`); };

  const calculate = () => {
    const used = rows.filter(hasData);
    if (!used.length) return say("bad", "Enter marks in at least one row first.");
    const e = validate(rows, cfg);
    if (e.length) return sayErrors(e);
    say("ok", `Calculated ${used.length} row${used.length > 1 ? "s" : ""}. Grade, GPV and points are shown in the table.`, { warns: warnings(rows) });
  };

  const addRecord = () => {
    const used = rows.filter(hasData);
    if (!used.length) return say("bad", "Enter a student and module marks before adding a record.");
    const e = validate(rows, cfg);
    if (e.length) return sayErrors(e);
    const by = new Map();
    used.forEach((r) => {
      const id = String(r.studentId).trim();
      const cur = by.get(id) || { studentId: id, name: r.name.trim(), modules: [], remark: "" };
      cur.modules.push({ moduleId: moduleKey(r), moduleTitle: r.moduleTitle.trim() || r.moduleId, formative: r.absent ? "" : r.formative, summative: r.absent ? "" : r.summative, credit: r.credit, absent: !!r.absent, absentRemark: r.absent ? (r.absentRemark || "").trim() : "", activities: r.absent ? [] : (r.activities || []) });
      by.set(id, cur);
    });
    const incoming = [...by.values()];
    const dups = countDuplicates(records, incoming);
    let replace = false;
    if (dups) replace = window.confirm(`${dups} entr${dups === 1 ? "y" : "ies"} already exist for ${meta.term} ${meta.year} (same student and subject).\n\nOK = replace them with the new marks\nCancel = keep the old marks and skip the duplicates`);
    const out = mergeRecords(records, incoming, replace);
    setRecords(out.records);
    setStudents(syncStudents(students, out.records, meta));
    setRows([blankRow()]);
    const names = incoming.map((r) => r.name).join(", ");
    say("ok", `Record saved for ${names}: ${out.added} added, ${out.replaced} replaced, ${out.skipped} skipped. See Student records below.`, { warns: warnings(rows) });
    toast(`Record added for ${names}`);
    logActivity("record", `Added record for ${names}`);
    owlReact("celebrate", { en: "Record added. Well done!", ta: "பதிவு சேர்க்கப்பட்டது. சிறப்பு!" });
  };

  const printReport = () => (records.length ? print() : say("bad", "Add at least one record before printing."));

  const save = () => {
    try {
      commitRows();
      localStorage.setItem("srb-meta", JSON.stringify(meta));
      localStorage.setItem("srb-marks", JSON.stringify(store));
      localStorage.setItem("srb-cfg", JSON.stringify(cfg));
      const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      setSavedAt(time);
      setSheetMsg({ type: "ok", text: `Saved school details, settings and ${records.length} student record${records.length === 1 ? "" : "s"} for ${meta.term} ${meta.year} at ${time}.` });
      toast("All changes saved");
      logActivity("save", `Saved school details and ${records.length} records`);
      owlReact("celebrate", { en: "All saved.", ta: "அனைத்தும் சேமிக்கப்பட்டது." });
    } catch {
      setSheetMsg({ type: "bad", text: "Could not save. Browser storage is full or blocked. Download the workbook as a backup." });
      toast("Could not save. Download a workbook as a backup.", "bad");
    }
  };

  const onLogo = (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 1024 * 1024) return setErrs(["Logo is larger than 1 MB. Choose a smaller PNG, SVG or JPG."]);
    const rd = new FileReader();
    rd.onload = async () => { const d = await trimLogo(rd.result); setMeta((x) => ({ ...x, logo: d, logoTrim: true, logoCut: 1 })); logActivity("logo", "Logo uploaded"); };
    rd.readAsDataURL(f);
  };

  const onImport = async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try {
      const out = await importWorkbook(f, cfg);
      createCheckpoint("Before importing marks workbook");
      const existing = store[`${out.meta.year}|${out.meta.term}`] || [];
      const dups = countDuplicates(existing, out.records);
      let replace = false;
      if (dups) replace = window.confirm(`${dups} subject entr${dups === 1 ? "y" : "ies"} in this file already exist for ${out.meta.term} ${out.meta.year}.\n\nOK = replace them with the file's marks\nCancel = keep the existing marks and skip the duplicates`);
      const merged = mergeRecords(existing, out.records, replace);
      setRecordsFor(out.meta.year, out.meta.term, merged.records);
      const nm = { ...meta, ...out.meta };
      setMeta(nm);
      setStudents(syncStudents(students, merged.records, nm));
      const bad = out.errors;
      setErrs(bad.length ? [`${bad.length} of ${out.total} row${out.total === 1 ? "" : "s"} could not be imported:`, ...bad.slice(0, 8), ...(bad.length > 8 ? [`...and ${bad.length - 8} more.`] : [])] : []);
      setNote(`Imported into ${out.meta.term} ${out.meta.year}: ${merged.added} added, ${merged.replaced} replaced, ${merged.skipped} skipped as duplicates${bad.length ? `, ${bad.length} invalid rows skipped` : ""}.`);
      toast(`Imported ${out.records.length} students`);
      logActivity("import", `Imported ${out.records.length} students from workbook`);
      owlReact("celebrate", { en: `Imported ${out.records.length} students.`, ta: `${out.records.length} மாணவர்கள் இறக்குமதி செய்யப்பட்டனர்.` });
    } catch (err) { setErrs([err.message]); setNote(""); toast(err.message, "bad"); }
  };

  const setScale = (i, j, v) => setCfg({ ...cfg, scale: cfg.scale.map((x, k) => (k === i ? x.map((y, l) => (l === j ? v : y)) : x)) });
  const maxGpv = Math.max(...cfg.scale.map((x) => x[2]));
  const saveGpa = (r, v) => {
    const n = v === "" ? null : Number(v);
    if (n != null && (isNaN(n) || n < 0 || n > maxGpv)) return toast(`GPA must be between 0 and ${maxGpv}.`, "bad");
    setRecords(records.map((y) => (y.studentId === r.studentId ? { ...y, gpaOverride: n } : y)));
    setGpaEdit(null);
    toast(n == null ? "GPA reset to the calculated value" : "GPA updated");
  };
  const verifyAll = () => {
    const manual = records.filter((r) => studentGpa(r.modules, cfg.scale, r.gpaOverride).manual && Math.abs(studentGpa(r.modules, cfg.scale, r.gpaOverride).gpa - studentGpa(r.modules, cfg.scale).computed) > 0.005);
    const missing = records.filter((r) => r.modules.some((x) => !x.absent && moduleResult(x, cfg.scale).total == null));
    if (!manual.length && !missing.length) return toast(`All ${records.length} GPA values match the marks.`);
    toast(`${manual.length} manual GPA value${manual.length === 1 ? "" : "s"} differ from the marks, ${missing.length} record${missing.length === 1 ? "" : "s"} with missing marks.`, "bad");
  };
  const shown = records.filter((r) => !q.trim() || `${r.name} ${r.studentId}`.toLowerCase().includes(q.trim().toLowerCase()));
  const activeActivityRow = rows.find((r) => r.id === activeRowId && !r.absent) || rows.find((r) => !r.absent);
  const actTarget = rows.find((r) => r.id === actRow);

  return (
    <>
      <div className="no-print">
        <div className="pagehead">
          <div className="phtitle"><h2>Report builder</h2><span className="chip plain">{meta.term} · {meta.year}</span></div>
          <div className="savebox">
            <label className="switch sm"><input type="checkbox" checked={autosave} onChange={(e) => setAutosave(e.target.checked)} /><span>Auto-save marks table</span></label>
            <span className={"savenote" + (sheetMsg?.type === "bad" || dirty ? " bad" : "")} aria-live="polite">
              {sheetMsg?.type === "bad" ? "Could not save" : dirty ? "Unsaved changes" : savedAt ? `Saved at ${savedAt}` : autosave ? "Changes save automatically" : "Auto-save is off"}
            </span>
            {workflowEnabled && <button className="btn ghost" type="button" onClick={() => go("workflow")}>Results workflow</button>}
            <button className="btn teal" onClick={save}>Save</button>
          </div>
        </div>
        {(errs.length > 0 || note) && (
          <div className={errs.length ? "alert bad" : "alert ok"} role="status">
            {errs.length ? errs.map((e, i) => <div key={i}>{e}</div>) : note}
            {errs.length > 0 && note && <div className="okline">{note}</div>}
          </div>
        )}

        <section id="school" className="card">
          <h3>School details</h3>
          <div className="grid">
            <Field label="School name"><input {...m("schoolName")} readOnly={!admin} /></Field>
            <Field label="School name (English)"><input {...m("schoolNameEn")} readOnly={!admin} /></Field>
            <Field label="Principal name"><input {...m("principal")} /></Field>
            <Field label="School phone"><input {...m("schoolPhone")} inputMode="tel" /></Field>
            <Field label="Educational zone"><input {...m("zone")} /></Field>
            <Field label="Schedule"><select value={meta.schedule || "tamil-sinhala"} onChange={(e) => setMeta({ ...meta, schedule: e.target.value })}>{Object.entries(SCHEDULES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
            <Field label="School address"><input {...m("schoolAddress")} /></Field>
            <Field label="Grade"><input {...m("grade")} /></Field>
            <Field label="Division"><input {...m("className")} /></Field>
            <Field label="Medium"><input {...m("medium")} /></Field>
            <Field label="Class teacher"><input {...m("classTeacher")} /></Field>
          </div>
          <p className="muted">The academic year and term are chosen at the top of the page.</p>
          <div className="uploads">
            <div id="logo" className="upl">
              {meta.logo ? <img src={meta.logo} alt="School logo" /> : <div className="ph">No logo</div>}
              <div>
                <strong>School logo</strong>
                <p className="muted">PNG, SVG, JPG or JPEG, up to 1 MB.</p>
                {admin ? (
                  <>
                    <button type="button" className="btn ghost" onClick={() => logoRef.current.click()}>Upload logo</button>
                    <input ref={logoRef} type="file" hidden accept=".png,.svg,.jpg,.jpeg" onChange={onLogo} />
                  </>
                ) : <p className="muted">Only an admin can change the school logo or name.</p>}
              </div>
            </div>
          </div>
        </section>

        <section id="grading" className="card">
          <h3>Grading settings</h3>
          {!can("grading") ? <p className="muted">Only an admin can change the weights and grade table. Current split: formative {cfg.fmax}, summative {smax}.</p> : (
            <>
              <p className="muted">Formative and summative marks add up to 100.</p>
              <div className="grid">
                <Field label="Formative out of"><NumField label="Formative out of" min={0} max={100} value={cfg.fmax} onChange={(v) => setCfg({ ...cfg, fmax: Math.min(100, Math.max(0, +v || 0)) })} /></Field>
                <Field label="Summative out of"><input value={smax} readOnly /></Field>
              </div>
              <details>
                <summary>Grade table (minimum mark and GPV)</summary>
                <table className="tbl small">
                  <thead><tr><th>Grade</th><th>Minimum mark</th><th>GPV</th></tr></thead>
                  <tbody>{cfg.scale.map(([g, min, gpv], i) => (
                    <tr key={g}><td>{g}</td>
                      <td><NumField label={`${g} minimum mark`} value={min} onChange={(v) => setScale(i, 1, +v)} /></td>
                      <td><NumField label={`${g} GPV`} step={0.25} value={gpv} onChange={(v) => setScale(i, 2, +v)} /></td></tr>
                  ))}</tbody>
                </table>
                <button className="btn ghost" onClick={() => setCfg({ fmax: 70, scale: DEFAULT_SCALE })}>Reset to defaults</button>
              </details>
            </>
          )}
        </section>

        {workflowEnabled ? <ScopedMarksEntry s={s} embedded /> : <section id="modules" className="card">
          <h3>Marks entry <span className="muted small">{meta.grade} {meta.className} · {meta.term} {meta.year}</span></h3>
          <datalist id="student-index">{pickList.map((x) => <option key={x.id} value={x.index}>{x.name}</option>)}</datalist>
          <div className="scroll">
            <table className="tbl marks">
              <thead><tr><th>Index no</th><th>Student name</th><th>Subject</th><th>Formative (0–{cfg.fmax})</th><th>Summative (0–{smax})</th><th>Credit</th><th>Absent</th><th className="c">Total</th><th className="c">Grade</th><th className="c">GPV</th><th className="c">Points</th><th className="c">GPA</th><th></th></tr></thead>
              <tbody>{rows.map((r) => {
                const x = moduleResult(r, cfg.scale), f = num(r.formative), sv = num(r.summative);
                const overF = !r.absent && f != null && (f < 0 || f > cfg.fmax), overS = !r.absent && sv != null && (sv < 0 || sv > smax);
                const nAct = (r.activities || []).length;
                return (
                  <tr key={r.id} className={r.absent ? "absent" : ""} onFocusCapture={() => setActiveRowId(r.id)}>
                    <td><input list="student-index" aria-label="Index number" value={r.studentId} onChange={(e) => onIndex(r.id, e.target.value)} /></td>
                    <td><input aria-label="Student name" value={r.name} onChange={(e) => upd(r.id, "name", e.target.value)} /></td>
                    <td><input aria-label="Subject" value={r.moduleTitle} onChange={(e) => upd(r.id, "moduleTitle", e.target.value)} /></td>
                    <td className="formative-cell">
                      <div className="formative-control">
                        {r.absent ? <span className="ab">AB</span> : nAct ? <b className="actv">{r.formative === "" ? "–" : r.formative}</b> : <NumField label="Formative" min={0} max={cfg.fmax} invalid={overF} value={r.formative} onChange={(v) => upd(r.id, "formative", v)} />}
                      </div>
                      {overF && <small className="warn">Max {cfg.fmax}</small>}
                      {!r.absent && !nAct && f == null && sv != null && <small className="warn">Empty</small>}
                    </td>
                    <td>
                      {r.absent ? <span className="ab">AB</span> : <NumField label="Summative" min={0} max={smax} invalid={overS} value={r.summative} onChange={(v) => upd(r.id, "summative", v)} />}
                      {overS && <small className="warn">Max {smax}</small>}
                      {!r.absent && sv == null && f != null && <small className="warn">Empty</small>}
                    </td>
                    <td><NumField className="numf-credit" label="Credit" min={0.01} step={0.25} value={r.credit} onChange={(v) => upd(r.id, "credit", v)} /></td>
                    <td className="abs">
                      <label className="chk"><input type="checkbox" checked={!!r.absent} onChange={(e) => upd(r.id, "absent", e.target.checked)} /> Absent</label>
                      {r.absent && <input aria-label="Absent remark" placeholder="Remark" value={r.absentRemark || ""} onChange={(e) => upd(r.id, "absentRemark", e.target.value)} />}
                    </td>
                    <td className="c">{x.absent ? "AB" : x.total ?? "–"}</td>
                    <td className="c">{x.grade}</td><td className="c">{x.gpv.toFixed(2)}</td><td className="c">{x.points.toFixed(2)}</td>
                    <td className="c">{x.credit ? (x.points / x.credit).toFixed(2) : "0.00"}</td>
                    <td><button className="btn danger" onClick={() => setRows(rows.length > 1 ? rows.filter((y) => y.id !== r.id) : [blankRow()])}>Remove</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          <div className="btngrid">
            <button className="btn" onClick={addModule}>Add module</button>
            <button type="button" className="btn" disabled={!activeActivityRow} title={activeActivityRow ? `Edit activities for ${activeActivityRow.name || activeActivityRow.studentId || "the current student"} · ${activeActivityRow.moduleTitle || "current subject"}` : "Add a marks row to enter activities"} onClick={() => activeActivityRow && setActRow(activeActivityRow.id)}>Activities</button>
            <button className="btn" onClick={calculate}>Calculate</button>
            <button className="btn teal" onClick={addRecord}>Add record</button>
            <button className="btn teal" onClick={printReport}>Print report</button>
          </div>
          <label className="switch printopt"><input type="checkbox" checked={!!gradeOnly} onChange={(e) => setGradeOnly(e.target.checked)} /><span>Print grades only. GPA, GPV and points are left off the printed reports.</span></label>
          {bmsg && (
            <div className={"alert " + bmsg.type} role="status">
              {bmsg.lines.map((l, i) => <div key={i}>{l}</div>)}
              {bmsg.warns?.length > 0 && <div className="warnlist"><b>Check these:</b>{bmsg.warns.map((w, i) => <div key={i}>{w}</div>)}</div>}
              {bmsg.fixes?.length > 0 && (
                <div className="fixrow"><span>Quick fix:</span>{bmsg.fixes.map(([f]) => <button key={f} type="button" className="btn ghost sm" onClick={() => applyWeights(f)}>Use {f} / {100 - f}</button>)}</div>
              )}
            </div>
          )}
        </section>}

        {workflowEnabled ? <section id="records" className="card">
          <h3>Student records</h3>
          <p className="muted">Assigned-class marks are managed through the results workflow. Legacy records remain unchanged and are not editable here.</p>
        </section> : <section id="records" className="card">
          <div className="acthead"><h3>Student records</h3>
            {records.length > 0 && <div className="row" style={{ margin: 0 }}>
              <input className="search" type="search" aria-label="Search records" placeholder="Search name or index" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn ghost sm" onClick={verifyAll}>Verify GPA</button>
            </div>}
          </div>
          {!records.length ? <p className="muted">No records for {meta.term} {meta.year} yet. Fill the table above and choose Add record, or import a workbook.</p> : !shown.length ? <p className="muted">No student matches your search.</p> : (
            <div className="scroll">
              <table className="tbl rec">
                <colgroup><col style={{ width: 60 }} /><col style={{ width: 110 }} /><col /><col style={{ width: 80 }} /><col style={{ width: 90 }} /><col style={{ width: 80 }} /><col style={{ width: 190 }} /><col style={{ width: 80 }} />{obs && <col />}<col style={{ width: 110 }} /></colgroup>
                <thead><tr><th className="c">S.No</th><th className="c">Index no</th><th>Name</th><th className="c">Credits</th><th className="c">Total</th><th className="c">Avg</th><th className="c">GPA</th><th className="c">Grade</th>{obs && <th>Remark</th>}<th className="c"><span className="sr">Remove</span></th></tr></thead>
                <tbody>{shown.map((r, i) => {
                  const g = studentGpa(r.modules, cfg.scale, r.gpaOverride), t = studentTotals(r.modules, cfg.scale);
                  const editing = gpaEdit?.id === r.studentId;
                  return (
                    <tr key={r.studentId}>
                      <td className="c">{i + 1}</td><td className="c">{r.studentId}</td><td>{r.name}</td>
                      <td className="c">{g.credits}</td><td className="c">{t.total}</td><td className="c">{t.avg.toFixed(1)}</td>
                      <td className="c gpacell">
                        {editing ? (
                          <span className="gpaedit"><input type="number" step="0.01" aria-label="GPA" value={gpaEdit.value} onChange={(e) => setGpaEdit({ id: r.studentId, value: e.target.value })} /><button className="linkbtn" onClick={() => saveGpa(r, gpaEdit.value)}>Save</button><button className="linkbtn" onClick={() => setGpaEdit(null)}>Cancel</button></span>
                        ) : (
                          <>
                            <b>{g.gpa.toFixed(2)}</b> {g.manual ? <span className="chip amber sm" title={`Calculated GPA is ${g.computed.toFixed(2)}`}>Manual</span> : <span className="chip plain sm">Calculated</span>}
                            {can("gpa.edit") && <button className="linkbtn" onClick={() => setGpaEdit({ id: r.studentId, value: String(g.gpa) })}>Edit</button>}
                            {g.manual && can("gpa.edit") && <button className="linkbtn" onClick={() => saveGpa(r, "")}>Reset</button>}
                          </>
                        )}
                      </td>
                      <td className="c">{g.grade}</td>
                      {obs && <td><input aria-label="Remark" value={r.remark} onChange={(e) => setRecords(records.map((y) => (y.studentId === r.studentId ? { ...y, remark: e.target.value } : y)))} /></td>}
                      <td className="c"><button className="btn danger" onClick={() => { if (window.confirm(`Remove the marks of ${r.name} for ${meta.term} ${meta.year}?`)) { setRecords(records.filter((y) => y.studentId !== r.studentId)); toast("Record removed"); } }}>Remove</button></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </section>}

        {workflowEnabled ? <section id="sheet" className="card dashed">
          <h3>Spreadsheet import and export</h3>
          <p className="muted">Use assigned-class marks entry to keep marks scoped to your classes and subjects. Spreadsheet import is unavailable here to prevent bypassing assignment and review rules.</p>
        </section> : <section id="sheet" className="card dashed">
          <h3>Spreadsheet import and export</h3>
          <p className="muted">Required columns: {REQUIRED.join(", ")}. Optional: {OPTIONAL.join(", ")}. Duplicates are never replaced without asking.</p>
          <div className="row">
            <button className="btn" onClick={() => fileRef.current.click()}>Upload workbook</button>
            <input ref={fileRef} type="file" hidden accept=".xlsx,.xls" onChange={onImport} />
            <button className="btn teal" onClick={save}>Save</button>
            <button className="btn ghost" disabled={!records.length} onClick={() => { downloadWorkbook(records, meta); logActivity("export", "Downloaded workbook"); }}>Download workbook</button>
            <button className="btn ghost" disabled={!records.length} onClick={() => { downloadMarksReport(records, students, meta, cfg); logActivity("export", "Downloaded marks report"); }}>Download marks report</button>
            <button className="btn ghost" onClick={() => go("guide")}>Format guide</button>
          </div>
          <p className="muted">The workbook can be uploaded again later. The marks report is for printing and sharing (activities, credit, GPA, grade, remarks).</p>
          {sheetMsg && <div className={"alert " + sheetMsg.type} role="status">{sheetMsg.text}</div>}
        </section>}

        <section className="card">
          <h3>Teacher observations</h3>
          <label className="switch">
            <input type="checkbox" checked={obs} onChange={(e) => setObs(e.target.checked)} />
            <span>Prefill remarks on the printout. Leave off to keep blank lines for handwriting.</span>
          </label>
        </section>
      </div>

      {actTarget && (
        <ActivitiesDialog title={actTarget.moduleTitle} initial={actTarget.activities || []} fmax={cfg.fmax} onClose={() => setActRow(null)}
          onSave={(acts, total) => { setRows(rows.map((r) => (r.id === actRow ? { ...r, activities: acts, formative: acts.length && total != null ? String(total) : r.formative } : r))); setActRow(null); }} />
      )}
      {!workflowEnabled && <PrintCards s={s} />}
    </>
  );
}
