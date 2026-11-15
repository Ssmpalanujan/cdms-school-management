import { useState } from "react";
import { useLocal } from "./useLocal.js";

const CRITERIA = [
  "1\nஇனங்காணல்",
  "2\nமுகம் வரைதல்",
  "3\nமுகபாவனை",
  "4\nவர்ணந்தீட்டல்",
  "5\nஆக்கத்திறன்",
];

const editField = (value, label, onChange, numeric = false) => (
  <input
    className="art-score-edit"
    aria-label={label}
    inputMode={numeric ? "decimal" : "text"}
    value={value ?? ""}
    onChange={(event) => onChange(event.target.value)}
  />
);

export default function ArtClassScoreSheet({ meta, students, records, dataKey }) {
  const [savedData, setSavedData] = useLocal(`srb-art-class-sheet-${dataKey}`, {});
  const [data, setData] = useState(savedData);
  const [saveMessage, setSaveMessage] = useState("");
  const update = (section, key, field, value) => setData((current) => ({
    ...current,
    [section]: {
      ...(current[section] || {}),
      [key]: { ...(current[section]?.[key] || {}), [field]: value },
    },
  }));
  const updateField = (section, field, value) => setData((current) => ({
    ...current,
    [section]: { ...(current[section] || {}), [field]: value },
  }));
  const roster = students.length
    ? students
    : records.map((record) => ({ index: record.studentId, name: record.name }));
  const studentOptions = [...roster].sort((a, b) => String(a.index).localeCompare(String(b.index), undefined, { numeric: true }));
  const rows = Array.from({ length: Math.max(20, roster.length) }, (_, index) => roster[index] || null);
  const baseCounts = { students: roster.length, boys: students.filter((student) => String(student.gender || "").toLowerCase() === "male").length, girls: students.filter((student) => String(student.gender || "").toLowerCase() === "female").length, total: roster.length };
  const boys = students.filter((student) => String(student.gender || "").toLowerCase() === "male").length;
  const girls = students.filter((student) => String(student.gender || "").toLowerCase() === "female").length;

  return (
    <section className="art-class-score-sheet">
      <h3>புள்ளிப் பதிவுப் படிவம் – தரம் 6 – புதிய முகம் ஒன்று வரைவோம்</h3>
      <table className="tbl art-score-info">
        <tbody>
          <tr><th>பாடசாலையின் பெயர்</th><td>{editField(data.info?.schoolName ?? meta.schoolName, "Art sheet school name", (value) => updateField("info", "schoolName", value))}</td></tr>
          <tr><th>தரம் / பிரிவு</th><td>{editField(data.info?.className ?? `${meta.grade} ${meta.className}`, "Art sheet grade and class", (value) => updateField("info", "className", value))}</td></tr>
          <tr><th>ஆசிரியரின் பெயர்</th><td>{editField(data.info?.teacher ?? meta.classTeacher, "Art sheet teacher name", (value) => updateField("info", "teacher", value))}</td></tr>
          <tr><th>திகதி</th><td>{editField(data.info?.date, "Art sheet date", (value) => updateField("info", "date", value))}</td></tr>
        </tbody>
      </table>
      <div className="scroll art-score-scroll">
        <table className="tbl art-score-table">
          <thead>
            <tr>
              <th>இல.</th>
              <th>மாணவரின் பெயர்</th>
              {CRITERIA.map((criterion) => <th key={criterion}>{criterion}</th>)}
              <th>மொத்தம்<br />/ 20</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((student, index) => {
              const rowKey = student?.index || `blank-${index}`;
              const saved = data.rows?.[rowKey] || {};
              const selectedStudent = studentOptions.find((option) => String(option.index) === String(saved.studentIndex ?? student?.index));
              const scores = CRITERIA.map((_, scoreIndex) => saved[`score-${scoreIndex}`] ?? "");
              const total = scores.some((score) => score !== "" && Number.isFinite(Number(score)))
                ? String(scores.reduce((sum, score) => sum + (Number.isFinite(Number(score)) ? Number(score) : 0), 0))
                : "";
              return (
              <tr key={rowKey}>
                <td>{editField(saved.number ?? index + 1, `Art sheet row ${index + 1} number`, (value) => update("rows", rowKey, "number", value), true)}</td>
                <td>
                  <select
                    className="art-score-edit"
                    aria-label={`Art sheet student name ${index + 1}`}
                    value={selectedStudent?.index || ""}
                    onChange={(event) => {
                      const chosen = studentOptions.find((option) => String(option.index) === event.target.value);
                      setData((current) => ({
                        ...current,
                        rows: {
                          ...(current.rows || {}),
                          [rowKey]: { ...(current.rows?.[rowKey] || {}), studentIndex: chosen?.index || "", name: chosen?.name || "" },
                        },
                      }));
                    }}
                  >
                    <option value="">Select student</option>
                    {studentOptions.map((option) => <option key={option.index} value={option.index}>{option.name} · {option.index}</option>)}
                    {saved.name && !studentOptions.some((option) => option.name === saved.name) && <option value={saved.studentIndex || ""}>{saved.name}</option>}
                  </select>
                </td>
                {CRITERIA.map((criterion, scoreIndex) => <td key={criterion}>{editField(scores[scoreIndex], `Art sheet student ${index + 1}, ${criterion.split("\n")[1]}`, (value) => update("rows", rowKey, `score-${scoreIndex}`, value), true)}</td>)}
                <td>{editField(saved.total ?? total, `Art sheet student ${index + 1}, total`, (value) => update("rows", rowKey, "total", value), true)}</td>
              </tr>
              );
            })}
            <tr className="art-score-summary">
              <th colSpan={2}>வகுப்புச் சராசரி</th>
              {CRITERIA.map((criterion, index) => <td key={criterion}>{editField(data.averages?.[`score-${index}`], `Art class average, ${criterion.split("\n")[1]}`, (value) => updateField("averages", `score-${index}`, value), true)}</td>)}
              <td>{editField(data.averages?.total, "Art class average total", (value) => updateField("averages", "total", value), true)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="art-score-bottom">
        <table className="tbl art-score-counts">
          <tbody>
            <tr><th>மொத்த மாணவர் தொகை</th><th>ஆண்கள்</th><th>பெண்கள்</th><th>மொத்தம்</th></tr>
            <tr><td>{editField(data.counts?.students ?? baseCounts.students, "Art total students", (value) => updateField("counts", "students", value), true)}</td><td>{editField(data.counts?.boys ?? (boys || ""), "Art boys count", (value) => updateField("counts", "boys", value), true)}</td><td>{editField(data.counts?.girls ?? (girls || ""), "Art girls count", (value) => updateField("counts", "girls", value), true)}</td><td>{editField(data.counts?.total ?? baseCounts.total, "Art student total", (value) => updateField("counts", "total", value), true)}</td></tr>
            <tr><th>வருகைத் தொகை</th><td>{editField(data.counts?.present, "Art attendance count", (value) => updateField("counts", "present", value), true)}</td><th>வரவின்மைத் தொகை</th><td>{editField(data.counts?.absent, "Art absent count", (value) => updateField("counts", "absent", value), true)}</td></tr>
          </tbody>
        </table>
        <table className="tbl art-score-counts art-score-levels">
          <tbody>
            <tr><th>சிறப்பு தேர்ச்சி</th><td>{editField(data.levels?.excellent, "Art excellent achievement count", (value) => updateField("levels", "excellent", value), true)}</td></tr>
            <tr><th>சாதாரண தேர்ச்சி</th><td>{editField(data.levels?.satisfactory, "Art satisfactory achievement count", (value) => updateField("levels", "satisfactory", value), true)}</td></tr>
            <tr><th>பயிற்சி தேவை</th><td>{editField(data.levels?.practice, "Art needs practice count", (value) => updateField("levels", "practice", value), true)}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="art-score-notes">
        <b>குறிப்பு</b>
        <p>தேர்ச்சி மட்டம்: 4 – மிகச் சிறப்பாக, 3 – நன்று, 2 – சிறிது உதவியுடன், 1 – மேலும் பயிற்சி தேவை. மஞ்சள் கூடுகளில் மட்டும் பதியுங்கள்; “மொத்தம்” தானாகக் கணிக்கப்படும் (எ.கா: 3, 4, 3, 2, 4 → 16).</p>
        <p>நியதி 1: மனதில் தோன்றும் எண்ணத்தின்படி, முகத்தினால் வெளிக்காட்டப்படும் இயல்புகளைச் சரியாக இனங்காண முடியும்.</p>
        <p>நியதி 2: உணர்ச்சியை வெளிப்படுத்தும் முகத்தை நன்றாக வரைந்து கொள்ள முடியும்.</p>
        <p>நியதி 3: உணர்ச்சி வெளிப்பாட்டின்படி முகபாவனைகளைச் சரியாக வரைய முடியும்.</p>
        <p>நியதி 4: வரைந்த முகத்துக்குச் சிறப்பாக வர்ணம் தீட்ட முடியும்.</p>
        <p>நியதி 5: உருவப்படமொன்றினை ஆக்கத்திறனுடன் வரைய முடியும்.</p>
      </div>
      <div className="art-score-signatures">
        <label>ஆசிரியர் கையொப்பம்: {editField(data.signatures?.teacher, "Art teacher signature", (value) => updateField("signatures", "teacher", value))}</label>
        <label>அதிபர் கையொப்பம்: {editField(data.signatures?.principal, "Art principal signature", (value) => updateField("signatures", "principal", value))}</label>
      </div>
      <div className="art-score-submit no-print">
        <button className="btn" type="button" onClick={() => { setSavedData(data); setSaveMessage("Art score sheet saved."); }}>Submit</button>
        <span className="muted" role="status" aria-live="polite">{saveMessage}</span>
      </div>
    </section>
  );
}
