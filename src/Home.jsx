import { status, SCHEDULES } from "./calendar.js";
import Icon from "./Icon.jsx";
import AnnouncementList from "./AnnouncementList.jsx";
import { latest } from "./announce.js";
import { idOf, readUsers, roleOf } from "./auth.js";
import LeaveRegister from "./LeaveRegister.jsx";
import SetupChecklist from "./SetupChecklist.jsx";
import UpcomingDates from "./UpcomingDates.jsx";
import { counts } from "./students.js";
import { LEAVE_TYPES, balance, reminders, today } from "./leave.js";
import { moduleResult, studentGpa, r2 } from "./grading.js";
import { buildProgressAlerts } from "./analytics.js";
import { classSubjectsStatus, resultClassKey } from "./resultsWorkflow.js";
import { pensionDetails, retirementGroup, formatDateParts } from "./pension.js";

const mean = (a) => (a.length ? r2(a.reduce((x, y) => x + y, 0) / a.length) : 0);
const same = (left, right) => String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();

export default function Home({ s }) {
  const { meta, records, cfg, go, students, leaves, ent, user, announcements, teachers, annSeen, uid, openTeacherDetails, store, classAssignments = [], results } = s;
  const users = readUsers();
  const currentAssignments = classAssignments.filter((assignment) => !assignment.year || String(assignment.year) === String(meta.year));
  const mods = new Set(records.flatMap((r) => r.modules.map((m) => m.moduleId || m.moduleTitle)));
  const totals = records.flatMap((r) => r.modules.map((m) => moduleResult(m, cfg.scale).total)).filter((t) => t != null);
  const gpa = mean(records.map((r) => studentGpa(r.modules, cfg.scale).gpa));
  const key = meta.schedule || "tamil-sinhala";
  const st = status(key);

  const c = counts(students);
  const me = meta.classTeacher || user?.name || "";
  const bal = balance(leaves, ent, me, meta.year);
  const rem = reminders(leaves, ent, me, today(), meta.year);
  const alerts = buildProgressAlerts({ store, students, meta, cfg });
  const retiring = teachers.map((teacher) => ({ teacher, ...pensionDetails(teacher, s.settings?.retirementAge || 60) }))
    .filter((item) => retirementGroup(item.teacher, s.settings?.retirementAge || 60));
  const allReminders = [
    ...rem,
    ...retiring.map((item) => ({ tone: "warn", text: `${item.teacher.name} is retiring within ${retirementGroup(item.teacher, s.settings?.retirementAge || 60)} (${item.retirementDate}).` })),
    ...alerts.slice(0, 5).map((alert) => ({ tone: "warn", text: alert.message })),
  ];
  const onLeave = leaves.filter((l) => l.status === "approved" && l.from <= today() && l.to >= today());
  const kpis = [
    ["Students", c.total || records.length, c.total ? `${c.male} male · ${c.female} female` : `Enrolled in ${meta.grade}`],
    ["Subjects", mods.size, "Active curriculum modules"],
    ["Class average", `${mean(totals).toFixed(1)}%`, `GPA: ${gpa.toFixed(2)}`],
    ["Records saved", totals.length, "Assessment scores stored"],
  ];
  const actions = [
    ["newfile", "Start new report", "Set up school name, grade, medium and class teacher.", () => go("builder", "school")],
    ["upload", "Import spreadsheet", "Bulk upload class rosters and marks from Excel (.xlsx).", () => go("builder", "sheet")],
    ["calendar", "View term calendar", "Official 2027 schedule from Circular 31/2026.", () => go("calendar")],
    ["pencil", "Marks & GPA assessment", "Enter formative and summative marks with live calculations.", () => go("builder", "modules")],
    ["guide", "Format guide & samples", "Download Excel templates and review column specs.", () => go("guide")],
    ["students", "Manage students", "Add, edit and search students by grade and division.", () => go("students")],
    ["leave", "Teacher leave", "Submit leave, check balances and approve requests.", () => go("leave")],
    ["attendance", "Daily attendance", "Record attendance and review frequent absences.", () => go("attendance")],
    ["results", "Student progress", "Find missing marks, falling averages and term changes.", () => go("progress")],
    ["print", "Reports and printing", "Report cards, class marks, marking sheets and rubric charts.", () => go("reports")],
    ["results", "Results workflow", "Review assignments, follow subject approvals and publish class results.", () => go("workflow")],
    ["students", "Assign teachers", "Set class teachers and subject teachers for each grade and division.", () => go("assignments")],
    ...(s.role === "admin" ? [["backup", "Back up school data", "Save checkpoints or export a backup before major changes.", () => go("backups")]] : []),
  ];
  const classes = new Map();
  students.forEach((student) => {
    const key = `${String(student.grade).trim().toLowerCase()}|${String(student.division).trim().toLowerCase()}`;
    if (!classes.has(key)) classes.set(key, { grade: student.grade, division: student.division });
  });
  currentAssignments.forEach((assignment) => {
    const key = `${String(assignment.grade).trim().toLowerCase()}|${String(assignment.division).trim().toLowerCase()}`;
    if (!classes.has(key)) classes.set(key, { grade: assignment.grade, division: assignment.division });
  });
  const teacherName = (id) => users.find((account) => idOf(account) === id)?.name || "Not assigned";
  const resultRows = [...classes.values()].map((item) => {
    const assignment = currentAssignments.find((candidate) => same(candidate.grade, item.grade) && same(candidate.division, item.division));
    const subjects = assignment?.subjects || [];
    const states = assignment ? classSubjectsStatus(results, assignment, meta.year, meta.term) : [];
    const key = resultClassKey(meta.year, meta.term, item.grade, item.division);
    const published = results?.classes?.[key]?.published;
    const warnings = [];
    if (!assignment) warnings.push("No assignments");
    else {
      if (!assignment.classTeacherId) warnings.push("Class teacher missing");
      if (!subjects.length) warnings.push("No subjects assigned");
      if (subjects.some((subject) => !subject.teacherId)) warnings.push("Subject teacher missing");
    }
    return {
      ...item, assignment, subjects, states, warning: warnings.join("; "), published,
      classTeacher: teacherName(assignment?.classTeacherId),
      approval: `${states.filter((state) => state.sheet.status === "Approved" || state.sheet.status === "Published").length}/${subjects.length}`,
    };
  });

  return (
    <>
      <section className="hero card">
        {user?.photo ? <img className="crest" src={user.photo} alt="Admin profile" /> : meta.logo ? <img className="crest" src={meta.logo} alt="School logo" /> : <div className="crest ph">Logo</div>}
        <div className="heroText">
          {meta.zone && <span className="chip zone">{meta.zone}</span>}
          <h2 className="school">{meta.schoolName || "Add your school name"}</h2>
          {meta.schoolNameEn && meta.schoolNameEn !== meta.schoolName && <p className="en">{meta.schoolNameEn}</p>}
          <div className="chips">
            {meta.principal && <span className="chip dark">Principal: {meta.principal}</span>}
            <span className="chip dark">{meta.grade} · {meta.className}</span>
            <span className="chip dark">{meta.medium}</span>
            <span className="chip teal">{meta.term} · {meta.year}</span>
          </div>
        </div>
        <div className="heroBtns">
          <button className="btn big" onClick={() => go("builder", "modules")}>Continue report</button>
          <button className="btn dark" onClick={() => go("builder", "school")}>Edit school details</button>
        </div>
      </section>

      <div className="duo">
        <SetupChecklist s={s} />
        <UpcomingDates s={s} />
      </div>

      <section className="card">
        <div className="acthead"><div><h3>Retiring soon</h3><span className="muted">Retirement age is a setting; confirm the rule with the official circular.</span></div><button className="linkbtn" onClick={() => go("teacherDetails")}>All teacher pension dates</button></div>
        {!retiring.length ? <p className="muted">No teachers are within 12 months of retirement.</p> : <div className="duo">{["12 months", "6 months", "3 months"].map((group) => {
          const items = retiring.filter((item) => retirementGroup(item.teacher, s.settings?.retirementAge || 60) === group);
          return <div key={group}><h4>Within {group}</h4>{items.length ? <ul>{items.map((item) => <li key={item.teacher.id}>{item.teacher.name} · {item.retirementDate} · {formatDateParts(item.remaining)}</li>)}</ul> : <p className="muted">None in this period.</p>}</div>;
        })}</div>}
      </section>

      <section className="card">
        <div className="acthead"><div><h3>Results readiness · {meta.term} {meta.year}</h3><span className="muted">Set up every class before teachers can publish results.</span></div><div className="row"><button type="button" className="btn ghost" onClick={() => go("assignments")}>Assignments</button><button type="button" className="btn" onClick={() => go("workflow")}>Results workflow</button></div></div>
        {!resultRows.length ? <p className="muted">Add students or class assignments to see results readiness.</p> : <div className="scroll results-readiness-scroll"><table className="tbl small results-readiness-table">
          <thead><tr><th scope="col">Class</th><th scope="col">Class teacher</th><th scope="col">Subjects approved</th><th scope="col">Publish status</th><th scope="col">Setup warning</th></tr></thead>
          <tbody>{resultRows.map((item) => <tr key={`${item.grade}|${item.division}`}><td className="readiness-class">{item.grade} {item.division}</td><td>{item.classTeacher}</td><td className="readiness-approved">{item.approval}</td><td>{item.published ? "Published" : "Not published"}</td><td className="readiness-warning">{item.warning || "Ready for marks entry"}</td></tr>)}</tbody>
        </table></div>}
      </section>

      <section className="card profile school-profile-panel">
        <div className="acthead"><h3>School profile</h3><button className="linkbtn" onClick={() => go("builder", "school")}>Edit</button></div>
        <dl className="kv pf">
          <dt>School</dt><dd>{meta.schoolName || "Not set"}</dd>
          <dt>Principal</dt><dd>{meta.principal || "Not set"}</dd>
          <dt>Address</dt><dd>{meta.schoolAddress || "Not set"}</dd>
          <dt>Phone</dt><dd>{meta.schoolPhone || "Not set"}</dd>
        </dl>
        <div className="statrow">
          <div><b>{c.total}</b><span>Total students</span></div>
          <div><b>{c.male}</b><span>Male</span></div>
          <div><b>{c.female}</b><span>Female</span></div>
          <div><b>{leaves.filter((l) => l.status === "pending").length}</b><span>Pending leave</span></div>
        </div>
        {c.byDiv.length > 0 ? <div className="chips divchips">{c.byDiv.map(([k, n]) => <span key={k} className="chip plain">{k}: {n}</span>)}</div> : <p className="muted">Add students to see the division-wise count.</p>}
      </section>

      <div className="duo">
        <section className="card">
          <div className="acthead"><h3>Leave summary{me ? `: ${me}` : ""}</h3><button className="linkbtn" onClick={() => go("leave")}>Manage leave</button></div>
          <table className="tbl small lsum">
            <thead><tr><th>Type</th><th className="c">Used</th><th className="c">Total</th><th className="c">Remaining</th></tr></thead>
            <tbody>{LEAVE_TYPES.map(([k, l]) => <tr key={k}><td>{l}</td><td className="c">{bal[k].used}</td><td className="c">{bal[k].total}</td><td className={"c" + (bal[k].remaining <= 2 ? " neg" : "")}><b>{bal[k].remaining}</b></td></tr>)}</tbody>
          </table>
          <p className="muted">{onLeave.length ? `On approved leave today: ${onLeave.map((l) => l.teacher).join(", ")}.` : "No teacher is on approved leave today."}</p>
        </section>
        <section className="card remind">
          <div className="acthead"><h3>Reminders</h3></div>
          {allReminders.length ? <ul className="remlist">{allReminders.map((r, i) => <li key={i}>{r.text}</li>)}</ul> : <p className="muted">No reminders right now.</p>}
        </section>
      </div>

      <section className="card">
        <div className="acthead"><h3>Leave register</h3><button className="linkbtn" onClick={() => go("leave")}>Open leave</button></div>
        <LeaveRegister leaves={leaves} limit={6} empty="No leave records yet. Teachers can apply from their own dashboard." />
      </section>

      <div className="duo">
        <section className="card">
          <div className="acthead"><h3>Announcements</h3><button className="linkbtn" onClick={() => go("announcements")}>Post or see all</button></div>
          <AnnouncementList items={latest(announcements, "admin", 3, uid)} seenAt={annSeen[uid]} go={go} empty="No announcements yet. Post one for teachers or students." />
        </section>
        <section className="card">
          <div className="acthead"><h3>Accounts</h3><div className="row" style={{ margin: 0 }}>
            <button type="button" className="linkbtn" onClick={openTeacherDetails}>Add teacher details</button>
            <button className="linkbtn" onClick={() => go("accounts")}>Manage users</button>
          </div></div>
          <div className="statrow three">
            <div><b>{users.filter((u) => roleOf(u) === "teacher").length}</b><span>Teacher logins</span></div>
            <div><b>{users.filter((u) => roleOf(u) === "student").length}</b><span>Student logins</span></div>
            <div><b>{students.filter((x) => !users.some((u) => roleOf(u) === "student" && String(u.studentId || "").toLowerCase() === x.index.toLowerCase())).length}</b><span>Students without login</span></div>
          </div>
          <p className="muted">{teachers.filter((t) => !users.some((u) => roleOf(u) === "teacher" && String(u.name).trim().toLowerCase() === t.name.trim().toLowerCase())).length} teacher{teachers.length === 1 ? "" : "s"} without a login.</p>
        </section>
      </div>

      <section className="card banner">
        <div className="bicon" aria-hidden="true">▦</div>
        <div>
          <span className="chip amber">Active ministry schedule</span>
          <span className="muted"> {SCHEDULES[key].label}</span>
        </div>
        <div className="bstatus">
          <b className={"tone-" + st.tone}>{st.label}</b>
          <span>{st.sub}</span>
        </div>
        <button className="btn ghost round" aria-label="Open term calendar" onClick={() => go("calendar")}>›</button>
      </section>

      <div className="kpis">
        {kpis.map(([t, v, sub]) => (
          <div className="card kpi" key={t}><span className="muted">{t}</span><b>{v}</b><span>{sub}</span></div>
        ))}
      </div>

      <h3 className="sec">Quick actions</h3>
      <div className="qa">
        {actions.map(([ic, t, sub, fn]) => (
          <button className="card qcard" key={t} onClick={fn}>
            <span className="qi" aria-hidden="true"><Icon name={ic} size={24} /></span>
            <span><b>{t}</b><br /><span className="muted">{sub}</span></span>
          </button>
        ))}
      </div>
    </>
  );
}
