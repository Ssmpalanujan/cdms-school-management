import { useState } from "react";
import { Head } from "./ui.jsx";
import { TAMIL_RUBRICS } from "./rubricTamil.js";

const FACE_DRAWING_CRITERIA = TAMIL_RUBRICS.find((chart) => chart.page === 2).criteria.map((criterion) => criterion.name);
const LEVELS = [
  ["a", 4],
  ["b", 3],
  ["c", 2],
  ["d", 1],
];

const emptyScores = () => FACE_DRAWING_CRITERIA.map(() => ({ level: "", mark: "" }));

export default function MarkingSheetTamil({ meta }) {
  const schoolName = meta.schoolName || "";
  const division = [meta.grade, meta.className].filter(Boolean).join(" ");
  const [form, setForm] = useState({
    school: schoolName,
    student: "",
    division,
    date: "",
    teacherDate: "",
    studentDate: "",
    note: "",
  });
  const [scores, setScores] = useState(emptyScores);
  const updateForm = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };
  const updateScore = (index, field, value) => {
    setScores((current) => current.map((score, row) => (
      row === index ? { ...score, [field]: value } : score
    )));
  };
  const total = scores.reduce((sum, score) => sum + (Number(score.mark) || 0), 0);

  return (
    <section className="card rep mark-sheet-tamil">
      <Head meta={meta} />
      <div className="mst-top">
        <div className="mst-side">ஆசிரியர்<br />மாணவர்</div>
        <div className="mst-title">
          <h3>புள்ளி வழங்கும் படிவம்</h3>
          <p>தரம் 6 – புதிய முகம் ஒன்று வரைவோம்</p>
        </div>
        <label className="mst-date">
          <span>திகதி</span>
          <input type="date" aria-label="திகதி" value={form.date} onChange={updateForm("date")} />
        </label>
      </div>

      <table className="tbl mst-info">
        <tbody>
          <tr>
            <th scope="row">பாடசாலையின் பெயர்</th>
            <td><input className="mst-text-input" aria-label="பாடசாலையின் பெயர்" value={form.school} onChange={updateForm("school")} /></td>
          </tr>
          <tr>
            <th scope="row">மாணவரின் பெயர்</th>
            <td><input className="mst-text-input" aria-label="மாணவரின் பெயர்" value={form.student} onChange={updateForm("student")} placeholder="மாணவரின் பெயரை உள்ளிடவும்" /></td>
          </tr>
          <tr>
            <th scope="row">தரம் / பிரிவு</th>
            <td><input className="mst-text-input" aria-label="தரம் / பிரிவு" value={form.division} onChange={updateForm("division")} /></td>
          </tr>
        </tbody>
      </table>

      <p className="mst-legend">
        <b>தேர்ச்சி மட்டம்:</b> 4 – மிகச் சிறப்பாக&nbsp; 3 – நன்று&nbsp; 2 – சிறிது உதவியுடன்&nbsp; 1 – மேலும் பயிற்சி தேவை
      </p>
      <p className="mst-hint">பொருத்தமான தேர்ச்சி மட்டத்தின் கீழ் (✓) இடுங்கள்; அந்த மட்ட இலக்கமே அந்நியதிக்கான புள்ளியாகும்.</p>

      <table className="tbl mst-table">
        <colgroup>
          <col style={{ width: "48%" }} />
          {LEVELS.map(([level]) => <col key={level} style={{ width: "8%" }} />)}
          <col style={{ width: "20%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>கணிப்பீட்டு நியதி</th>
            {LEVELS.map(([level, score]) => <th key={level}>{score}</th>)}
            <th>பெற்ற புள்ளி</th>
          </tr>
        </thead>
        <tbody>
          {FACE_DRAWING_CRITERIA.map((criterion, index) => (
            <tr key={criterion}>
              <td>{index + 1}. {criterion}</td>
              {LEVELS.map(([level, score]) => (
                <td key={level} className="mst-score-cell">
                  <label>
                    <input
                      type="radio"
                      name={`score-${index}`}
                      value={score}
                      aria-label={`${index + 1}. ${criterion} — ${score}`}
                      checked={scores[index].level === level}
                      onChange={() => {
                        updateScore(index, "level", level);
                        updateScore(index, "mark", String(score));
                      }}
                    />
                  </label>
                </td>
              ))}
              <td>
                <input
                  type="number"
                  min="0"
                  max="4"
                  className="mst-mark-input"
                  inputMode="numeric"
                  aria-label={`${index + 1}. பெற்ற புள்ளி`}
                  value={scores[index].mark}
                  onChange={(event) => {
                    const mark = event.target.value;
                    updateScore(index, "mark", mark);
                    const matchingLevel = LEVELS.find(([, score]) => String(score) === mark);
                    updateScore(index, "level", matchingLevel?.[0] || "");
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={5}>மொத்தம்</td><td>{total} / 20</td></tr>
        </tfoot>
      </table>

      <label className="mst-note">
        <b>ஆசிரியர் குறிப்பு:</b>
        <textarea className="mst-note-input" aria-label="ஆசிரியர் குறிப்பு" rows={3} value={form.note} onChange={updateForm("note")} placeholder="குறிப்பை இங்கே எழுதவும்" />
      </label>

      <table className="tbl mst-sign">
        <tbody>
          <tr>
            <th scope="row">ஆசிரியர் கையொப்பம்:</th>
            <td><label className="mst-date-field"><span>திகதி</span><input type="date" aria-label="ஆசிரியர் கையொப்பத் திகதி" value={form.teacherDate} onChange={updateForm("teacherDate")} /></label></td>
          </tr>
          <tr>
            <th scope="row">மாணவர் கையொப்பம்</th>
            <td><label className="mst-date-field"><span>திகதி</span><input type="date" aria-label="மாணவர் கையொப்பத் திகதி" value={form.studentDate} onChange={updateForm("studentDate")} /></label></td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
