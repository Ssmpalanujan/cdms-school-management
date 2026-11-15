import { useState } from "react";
import { Head } from "./ui.jsx";
import PrintCards from "./PrintCards.jsx";
import NumField from "./NumField.jsx";
import { TAMIL_RUBRICS } from "./rubricTamil.js";
import MarkingSheetTamil from "./MarkingSheetTamil.jsx";
import ArtClassScoreSheet from "./ArtClassScoreSheet.jsx";

export const DEFAULT_RUBRIC = {
  title: "Assessment rubric",
  levels: ["Excellent", "Good", "Satisfactory", "Needs improvement"],
  criteria: [
    {
      name: "Content knowledge",
      desc: [
        "Demonstrates a strong and accurate understanding of the topic.",
        "Shows a clear understanding with minor gaps.",
        "Shows basic understanding but lacks depth.",
        "Demonstrates limited understanding of the topic.",
      ],
    },
    {
      name: "Accuracy of work",
      desc: [
        "Work is highly accurate, detailed and precise.",
        "Work is mostly accurate with few errors.",
        "Work is somewhat accurate but contains several errors.",
        "Work has frequent inaccuracies and little correctness.",
      ],
    },
    {
      name: "Presentation",
      desc: [
        "Presentation is polished, neat and highly effective.",
        "Presentation is neat and clearly organized.",
        "Presentation is understandable but somewhat limited.",
        "Presentation is weak, unclear or poorly organized.",
      ],
    },
    {
      name: "Participation",
      desc: [
        "Participates actively and contributes meaningfully.",
        "Participates regularly and contributes appropriately.",
        "Participates occasionally with limited contribution.",
        "Rarely participates or contributes.",
      ],
    },
  ],
};
const TABS = [["cards", "Student reports"], ["class", "Class marks"], ["sheet", "Marking sheet"], ["rubric", "Rubric chart"], ["absent", "Absent list"]];
const rubricChartLabel = (chart) => chart.label.includes("…")
  ? chart.criteria[0]?.name || chart.label
  : chart.label;

export default function Reports({ s }) {
  const { meta, records, students, gradeOnly, setGradeOnly, rubric, setRubric, print } = s;
  const [type, setType] = useState("cards");
  const [nAct, setNAct] = useState(4);
  const [subject, setSubject] = useState("");
  const [reportStudent, setReportStudent] = useState("");
  const [sheetMode, setSheetMode] = useState("art");
  const [rubricMode, setRubricMode] = useState("tamil");
  const [chartNo, setChartNo] = useState("all");
  const [tamilTitle, setTamilTitle] = useState("மதிப்பீட்டு அளவுகோல்");
  const rb = rubric && rubric.criteria ? rubric : DEFAULT_RUBRIC;
  const period = `${meta.grade} ${meta.className} · ${meta.medium} · ${meta.term} ${meta.year}`;
  const classStudents = students.filter((x) => x.grade === meta.grade && x.division.toLowerCase() === String(meta.className).toLowerCase());
  const artClassStudents = classStudents.map((student) => ({ index: student.index, name: student.name, gender: student.gender }));
  const roster = (classStudents.length ? classStudents : students).length ? (classStudents.length ? classStudents : students).map((x) => ({ index: x.index, name: x.name })) : records.map((r) => ({ index: r.studentId, name: r.name }));
  const sorted = [...roster].sort((a, b) => a.index.localeCompare(b.index, undefined, { numeric: true }));
  const absences = records.flatMap((r) => r.modules.filter((m) => m.absent).map((m) => ({ r, m })));
  const setRb = (patch) => setRubric({ ...rb, ...patch });
  const selectedCharts = chartNo === "all" ? TAMIL_RUBRICS : TAMIL_RUBRICS.filter((c) => String(c.page) === chartNo);
  const tamilCharts = selectedCharts.length ? selectedCharts : TAMIL_RUBRICS.slice(0, 1);
  const needsData = (type === "cards" || type === "class" || type === "absent") && !records.length;
  const reportRecords = reportStudent ? records.filter((record) => String(record.studentId).toLowerCase() === reportStudent.toLowerCase()) : records;
  const reportState = reportRecords.length === records.length ? s : { ...s, records: reportRecords };
  const averageKey = `${meta.year}|${meta.term}`;

  return (
    <>
      <div className="pagehead no-print"><h2>Reports</h2><button className="btn" onClick={print} disabled={needsData}>Print this report</button></div>
      <div className="row tabs no-print" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={type === k} className={type === k ? "btn" : "btn ghost"} onClick={() => setType(k)}>{l}</button>)}
      </div>
      {type !== "class" && <div className="card no-print optbar">
        {type === "cards" && <label className="switch"><input type="checkbox" checked={!!gradeOnly} onChange={(e) => setGradeOnly(e.target.checked)} /><span>Show grades only. GPA, GPV and points are left off.</span></label>}
        {type === "cards" && <label className="dfil"><span>Parent report</span><select value={reportStudent} onChange={(e) => setReportStudent(e.target.value)}><option value="">All students</option>{records.map((record) => <option key={record.studentId} value={record.studentId}>{record.name} · {record.studentId}</option>)}</select></label>}
        {type === "sheet" && <>
          <label className="dfil"><span>Sheet</span><select value={sheetMode} onChange={(e) => setSheetMode(e.target.value)}><option value="art">Grade 6 Art · Face drawing</option><option value="class">Class marks sheet</option></select></label>
          {sheetMode === "class" && <>
            <label className="dfil"><span>Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Optional" /></label>
            <label className="dfil"><span>Activity columns</span><NumField label="Activity columns" min={1} max={10} value={nAct} onChange={(v) => setNAct(Math.min(10, Math.max(1, Number(v) || 1)))} /></label>
          </>}
        </>}
        {type === "rubric" && <>
          <label className="dfil"><span>Rubric</span><select value={rubricMode} onChange={(e) => setRubricMode(e.target.value)}><option value="tamil">Tamil charts · Grade 6 Art</option><option value="custom">My rubric (editable)</option></select></label>
          {rubricMode === "tamil" && <label className="dfil"><span>Chart</span><select value={chartNo} onChange={(e) => setChartNo(e.target.value)}><option value="all">All {TAMIL_RUBRICS.length} charts</option>{TAMIL_RUBRICS.map((c) => <option key={c.page} value={String(c.page)}>{c.page}. {rubricChartLabel(c)}</option>)}</select></label>}
          <p className="muted" style={{ margin: 0 }}>{rubricMode === "tamil" ? "Tamil rubric charts from the Grade 6 Art teacher guide. Choose a chart, then print." : "Edit the rubric below. It prints exactly as shown."}</p>
        </>}
        {type === "absent" && <p className="muted" style={{ margin: 0 }}>Students marked absent for {meta.term} {meta.year}, with their remarks.</p>}
      </div>}

      {needsData && <div className="card"><p className="muted">No marks for {meta.term} {meta.year} yet. Add records in the report builder or import a workbook first.</p></div>}

      {type === "cards" && records.length > 0 && <PrintCards s={reportState} screen />}

      {type === "class" && <ArtClassScoreSheet key={averageKey} dataKey={averageKey} meta={meta} students={artClassStudents} records={records} />}

      {type === "sheet" && sheetMode === "art" && <MarkingSheetTamil meta={meta} />}

      {type === "sheet" && sheetMode === "class" && (
        <section className="card rep">
          <Head meta={meta} />
          <h3>Marking sheet</h3><p className="muted">{period}{subject ? ` · ${subject}` : " · Subject: ____________________"}</p>
          {!sorted.length ? <p className="muted">Add students first, or enter marks, to fill the roster. The blank sheet below still prints.</p> : null}
          <div className="scroll">
            <table className="tbl sheettbl">
              <thead><tr><th className="c">No.</th><th>Index no</th><th>Name</th>{Array.from({ length: nAct }, (_, i) => <th key={i} className="c">Activity {i + 1}</th>)}<th className="c">Total</th><th className="c">Absent</th><th>Remarks</th></tr></thead>
              <tbody>{(sorted.length ? sorted : Array.from({ length: 20 }, () => ({ index: "", name: "" }))).map((x, i) => (
                <tr key={i}><td className="c">{i + 1}</td><td>{x.index}</td><td>{x.name}</td>{Array.from({ length: nAct }, (_, k) => <td key={k} />)}<td /><td /><td /></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="sign">Teacher: ____________________ &nbsp; Date: ______________</p>
        </section>
      )}

      {type === "rubric" && rubricMode === "tamil" && tamilCharts.map((chart, idx) => (
        <section key={chart.page} className="card rep rubric tamil-chart">
          <Head meta={meta} />
          {idx === 0 && <input className="rtitle" aria-label="Rubric title" value={tamilTitle} onChange={(e) => setTamilTitle(e.target.value)} />}
          <p className="muted rubric-chart-no">அட்டவணை {chart.page} · {rubricChartLabel(chart)} · {period}</p>
          {chart.note && (
            <div className="rubric-note">
              {chart.note.split("•").map((part) => part.trim()).filter(Boolean).map((part, i) => <p key={i} className={i ? "rubric-note-item" : "rubric-note-head"}>{i ? `• ${part}` : part}</p>)}
            </div>
          )}
          <div className="scroll">
            <table className="tbl rtbl tamil">
              <thead>
                <tr><th rowSpan={2}>{chart.criteriaLabel}</th><th colSpan={chart.levels.length}>{chart.levelLabel}</th></tr>
                <tr>{chart.levels.map((l, i) => <th key={i}>{l}</th>)}</tr>
              </thead>
              <tbody>
                {chart.criteria.map((c, i) => (
                  <tr key={i}>
                    <th scope="row">{c.name}</th>
                    {c.levels.map((d, k) => <td key={k}>{d}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tamilCharts.length > 1 && <p className="muted rubric-chart-no">Chart {chart.page} of {TAMIL_RUBRICS.length}</p>}
        </section>
      ))}

      {type === "rubric" && rubricMode === "custom" && (
        <section className="card rep rubric">
          <Head meta={meta} />
          <input className="rtitle" aria-label="Rubric title" value={rb.title} onChange={(e) => setRb({ title: e.target.value })} />
          <p className="muted">{period}</p>
          <div className="scroll">
            <table className="tbl rtbl">
              <thead><tr><th>Criteria</th>{rb.levels.map((l, i) => <th key={i}><input aria-label={`Level ${i + 1}`} value={l} onChange={(e) => setRb({ levels: rb.levels.map((x, j) => (j === i ? e.target.value : x)) })} /></th>)}<th className="no-print"><span className="sr">Remove</span></th></tr></thead>
              <tbody>{rb.criteria.map((c, i) => (
                <tr key={i}>
                  <td><input aria-label="Criteria name" value={c.name} onChange={(e) => setRb({ criteria: rb.criteria.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /></td>
                  {c.desc.map((d, k) => <td key={k}><textarea rows={3} aria-label={`${c.name || "Criteria"}, ${rb.levels[k]}`} value={d} onChange={(e) => setRb({ criteria: rb.criteria.map((x, j) => (j === i ? { ...x, desc: x.desc.map((y, l) => (l === k ? e.target.value : y)) } : x)) })} /></td>)}
                  <td className="no-print"><button className="linkbtn del" onClick={() => setRb({ criteria: rb.criteria.filter((_, j) => j !== i) })}>Remove</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="row no-print"><button className="btn ghost sm" onClick={() => setRb({ criteria: [...rb.criteria, { name: "", desc: ["", "", "", ""] }] })}>Add criteria</button><button className="btn ghost sm" onClick={() => setRubric(DEFAULT_RUBRIC)}>Reset rubric</button></div>
        </section>
      )}

      {type === "absent" && records.length > 0 && (
        <section className="card rep">
          <Head meta={meta} />
          <h3>Absent students</h3><p className="muted">{period}</p>
          {!absences.length ? <p className="muted">No student is marked absent for this term.</p> : (
            <table className="tbl">
              <thead><tr><th>Index no</th><th>Name</th><th>Subject</th><th>Remark</th></tr></thead>
              <tbody>{absences.map(({ r, m }, i) => <tr key={i}><td>{r.studentId}</td><td>{r.name}</td><td>{m.moduleTitle}</td><td>{m.absentRemark || "–"}</td></tr>)}</tbody>
            </table>
          )}
        </section>
      )}
    </>
  );
}
