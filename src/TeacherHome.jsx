import UpcomingDates from "./UpcomingDates.jsx";
import LeaveRegister from "./LeaveRegister.jsx";
import AnnouncementList from "./AnnouncementList.jsx";
import QuickActions from "./QuickActions.jsx";
import { latest } from "./announce.js";
import { LEAVE_TYPES, balance, reminders } from "./leave.js";
import { idOf, readUsers, roleOf } from "./auth.js";
import PersonAvatar from "./PersonAvatar.jsx";
import { classSubjectsStatus, resultNotificationCount, resultSheetKey } from "./resultsWorkflow.js";
import { pensionDetails, formatDateParts } from "./pension.js";
import { visiblePublishedHistory } from "./promotions.js";
import { DEFAULT_SCALE, moduleResult, studentGpa } from "./grading.js";
import { classTeacherName, sharedStudentsForTeacher } from "./recordSharing.js";

const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

export default function TeacherHome({ s }) {
  const { meta, user, students, records, leaves, ent, announcements, annSeen, uid, go, classAssignments = [], teachers = [] } = s;
  const year = String(s.currentYear || meta.year);
  const mine = leaves.filter((l) => same(l.teacher, user.name));
  const bal = balance(leaves, ent, user.name, year);
  const rem = reminders(mine, ent, user.name, undefined, year);
  const studentAccounts = readUsers().filter((account) => roleOf(account) === "student");
  const assignmentsForMe = classAssignments.filter((assignment) => (!assignment.year || String(assignment.year) === year)
    && (assignment.classTeacherId === idOf(user) || (assignment.subjects || []).some((subject) => subject.teacherId === idOf(user))));
  const workflowAssignments = assignmentsForMe;
  const legacyClassAssignment = assignmentsForMe.length ? [] : [{ grade: meta.grade, division: meta.className, year, classTeacherId: idOf(user) }];
  const classesForMe = assignmentsForMe.length ? assignmentsForMe : legacyClassAssignment;
  const teacherAccounts = readUsers().filter((account) => roleOf(account) === "teacher");
  const classTeacherLabel = (grade, division) => {
    const assigned = classTeacherName(classAssignments, teacherAccounts, year, grade, division);
    return assigned === "Not assigned" ? meta.classTeacher || assigned : assigned;
  };
  const classContext = assignmentsForMe.length
    ? assignmentsForMe.map((assignment) => `${assignment.classTeacherId === idOf(user) ? "Class teacher" : "Subject teacher"} of ${assignment.grade} ${assignment.division} · class teacher: ${classTeacherLabel(assignment.grade, assignment.division)}`).join(" · ")
    : legacyClassAssignment.length ? `${same(user.name, meta.classTeacher || "") ? "Class teacher" : "Teacher"} of ${meta.grade} ${meta.className} · class teacher: ${meta.classTeacher || "Not assigned"}` : "Teacher";
  const cls = students.filter((student) => classesForMe.some((assignment) =>
    String(student.grade).trim().toLowerCase() === String(assignment.grade).trim().toLowerCase()
      && String(student.division).trim().toLowerCase() === String(assignment.division).trim().toLowerCase()));
  const historyCandidates = [...new Map([
    ...cls,
    ...sharedStudentsForTeacher(s.recordShares || [], idOf(user), students),
    ...(s.enrollments || []).filter((enrollment) => {
      const historicalAssignment = classAssignments.find((assignment) => String(assignment.year) === String(enrollment.year)
        && assignment.classTeacherId === idOf(user)
        && String(assignment.grade).toLowerCase() === String(enrollment.grade).toLowerCase()
        && String(assignment.division).toLowerCase() === String(enrollment.division).toLowerCase());
      return !!historicalAssignment;
    }).map((enrollment) => students.find((student) => String(student.index).toLowerCase() === String(enrollment.studentId).toLowerCase())).filter(Boolean),
  ].map((student) => [String(student.index).toLowerCase(), student])).values()];
  const publishedHistory = historyCandidates.flatMap((student) => visiblePublishedHistory({
    role: "teacher", actorId: idOf(user), studentId: student.index,
    snapshots: Object.values(s.results?.classes || {}),
    assignments: classAssignments,
    enrollments: s.enrollments || [],
    requests: s.promotionRequests || [],
    historyRequests: s.historyRequests || [],
    recordShares: s.recordShares || [],
    currentYear: year,
  }).map((snapshot) => ({ student, snapshot })));
  const photoForStudent = (student) => studentAccounts.find((account) => String(account.studentId || "").trim().toLowerCase() === String(student.index).trim().toLowerCase())?.photo;
  const mods = new Set(records.flatMap((r) => r.modules.map((m) => m.moduleId)));
  const isClassTeacher = assignmentsForMe.some((assignment) => assignment.classTeacherId === idOf(user))
    || same(user.name, meta.classTeacher || "");
  const myTeacherDetails = teachers.find((teacher) => teacher.accountId && String(teacher.accountId).trim().toLowerCase() === idOf(user));
  const pension = myTeacherDetails ? pensionDetails(myTeacherDetails, s.settings?.retirementAge || 60) : null;
  const profilePhoto = user.photo || (isClassTeacher ? meta.teacherPhoto : "");
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "T";
  const items = latest(announcements, "teacher", 3, uid);
  const pending = mine.filter((l) => l.status === "pending").length;
  const actions = [
    ["pencil", "Enter marks", "Add marks, activities and absent remarks.", () => go("builder", "modules")],
    ["students", "Students", "View and update your students.", () => go("students")],
    ["reports", "Reports", "Report cards, marking sheets and rubric charts.", () => go("reports")],
    ["leave", "Apply for leave", "Submit a leave request and check your balance.", () => go("leave")],
    ...(isClassTeacher && s.academicYears?.some((item) => Number(item.year) > Number(year) && !item.closed) ? [["students", "Promote class", "Request next-year class promotion from the receiving teacher.", () => go("promotions")]] : []),
    ["announcements", "Announcements", "Post a notice for students or staff.", () => go("announcements")],
    ["summary", "Class summary", "Class average and grade spread.", () => go("summary")],
  ];
  return (
    <>
      <section className="card hero2">
        <div className="avatar2" aria-hidden="true">{profilePhoto ? <img src={profilePhoto} alt="" /> : initials}</div>
        <div className="heroText">
          <span className="chip zone">Teacher dashboard</span>
          <h2 className="greet">Hello, {user.name}</h2>
          <p className="muted">{meta.schoolName || "School name not set"} · {classContext} · {meta.term} {year}</p>
        </div>
        <div className="heroBtns"><button className="btn big" onClick={() => go("builder", "modules")}>Enter marks</button><button className="btn dark" onClick={() => go("leave")}>Apply for leave</button></div>
      </section>

      <div className="kpis">
        <div className="card kpi"><span className="muted">My class</span><b>{cls.length}</b><span>{meta.grade} {meta.className} students</span></div>
        <div className="card kpi"><span className="muted">Marks entered</span><b>{records.length}</b><span>{meta.term} {meta.year}</span></div>
        <div className="card kpi"><span className="muted">Subjects</span><b>{mods.size}</b><span>This term</span></div>
        <div className="card kpi"><span className="muted">Casual leave left</span><b>{bal.casual.remaining}</b><span>{pending ? `${pending} request${pending === 1 ? "" : "s"} pending` : "No pending request"}</span></div>
      </div>

      <section className="card class-results-panel">
        <div className="acthead"><div><h3>{workflowAssignments.some((assignment) => assignment.classTeacherId === idOf(user)) ? "My class results" : "My classes and subjects"}</h3><span className="muted">{resultNotificationCount(s.results, { ...user, id: idOf(user) }, null)} results notification(s)</span></div><button type="button" className="btn" onClick={() => go("workflow")}>Open results workflow</button></div>
        {!workflowAssignments.length ? <p className="muted">No result classes are assigned for {meta.year}. Ask an administrator to set up your class and subject assignments.</p> : (
          <div className="scroll"><table className="tbl small">
            <thead><tr><th>Class</th><th>Subject</th><th>Status</th><th>Marks entered</th><th>Next action / comment</th></tr></thead>
            <tbody>{workflowAssignments.flatMap((assignment) => {
              const isClassTeacher = assignment.classTeacherId === idOf(user);
              const roster = students.filter((student) => String(student.grade).trim().toLowerCase() === String(assignment.grade).trim().toLowerCase()
                && String(student.division).trim().toLowerCase() === String(assignment.division).trim().toLowerCase());
              return classSubjectsStatus(s.results, assignment, meta.year, meta.term)
                .filter((item) => isClassTeacher || item.teacherId === idOf(user))
                .map((item) => {
                  const key = resultSheetKey(meta.year, meta.term, assignment.grade, assignment.division, item.subject);
                  const sheet = item.sheet;
                  const entered = new Set((sheet.marks || []).map((mark) => String(mark.studentId).trim().toLowerCase()));
                  const count = roster.filter((student) => entered.has(String(student.index).trim().toLowerCase())).length;
                  const status = sheet.lastAction === "Changes requested" && sheet.status === "Draft" ? "Changes requested" : sheet.status;
                  const action = sheet.status === "Draft" ? (item.teacherId === idOf(user) ? "Enter marks" : "Review in workflow")
                    : sheet.status === "Submitted" ? "Review submitted marks"
                      : sheet.status === "Approved" ? "Ready to publish" : "Published";
                  return <tr key={key}><td>{assignment.grade} {assignment.division}</td><td>{item.subject}</td>
                    <td><span className={`workflow-status status-${String(status).toLowerCase().replace(/\s+/g, "-")}`}>{status}</span></td>
                    <td>{count}/{roster.length}</td><td>{sheet.reviewComment || action}</td></tr>;
                });
            })}</tbody>
          </table></div>
        )}
      </section>
      <section className="card">
        <div className="acthead"><h3>Published student history · read-only</h3><span className="muted">Only published marks for students authorized in your class are shown.</span></div>
        {!publishedHistory.length ? <p className="muted">No published student history is available to this class yet.</p> : <div className="scroll"><table className="tbl small teacher-history-table">
          <thead><tr><th>Student</th><th>Index</th><th>Year / term</th><th>Subject</th><th>Activities</th><th>Formative</th><th>Summative</th><th>Grade</th><th>Final GPA</th><th>Remarks</th></tr></thead>
          <tbody>{publishedHistory.flatMap(({ student, snapshot }) => {
            const scale = Array.isArray(snapshot.scale) && snapshot.scale.length ? snapshot.scale : DEFAULT_SCALE;
            const gpa = studentGpa(snapshot.subjects.flatMap((subject) => subject.marks), scale).gpa;
            return snapshot.subjects.flatMap((subject) => subject.marks.map((mark) => {
              const result = moduleResult({ ...mark, moduleTitle: subject.subject, absent: !!mark.absent }, scale);
              const activities = (mark.activities || []).map((activity) => `${activity.name || activity.title || "Activity"}: ${activity.score ?? activity.mark ?? activity.marks ?? "–"}/${activity.max ?? "–"}`).join("; ");
              return <tr key={`${student.index}|${snapshot.year}|${snapshot.term}|${subject.subject}`}><td>{student.name}</td><td>{student.index}</td><td>{snapshot.year} · {snapshot.term}</td><td>{subject.subject}</td><td>{activities || "–"}</td><td>{mark.formative ?? "–"}</td><td>{mark.summative ?? "–"}</td><td>{result.grade}</td><td>{gpa.toFixed(2)}</td><td>{mark.absentRemark || mark.remark || "–"}</td></tr>;
            }));
          })}</tbody>
        </table></div>}
      </section>

      <section className="card">
        <div className="acthead"><h3>My students</h3><button className="linkbtn" onClick={() => go("students")}>Open student list</button></div>
        {!cls.length ? <p className="muted">No students are listed for your assigned class yet.</p> : (
          <div className="scroll">
            <table className="tbl small teacher-students-table">
              <thead><tr><th scope="col">Student</th><th scope="col">Index</th><th scope="col">Class</th><th scope="col">Class teacher</th></tr></thead>
              <tbody>{cls.map((student) => (
                <tr key={student.id || student.index}>
                  <td><span className="person-cell"><PersonAvatar name={student.name} photo={photoForStudent(student)} />{student.name}</span></td>
                  <td>{student.index}</td>
                  <td>{student.grade} {student.division}</td>
                  <td>{classTeacherLabel(student.grade, student.division)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <div className="duo">
        <section className="card">
          <div className="acthead"><h3>Announcements</h3><button className="linkbtn" onClick={() => go("announcements")}>View all</button></div>
          <AnnouncementList items={items} seenAt={annSeen[uid]} go={go} />
        </section>
        <section className="card">
          <div className="acthead"><h3>My leave</h3><button className="linkbtn" onClick={() => go("leave")}>Open</button></div>
          <table className="tbl small lsum">
            <thead><tr><th>Type</th><th className="c">Used</th><th className="c">Total</th><th className="c">Left</th></tr></thead>
            <tbody>{LEAVE_TYPES.map(([k, l]) => <tr key={k}><td>{l}</td><td className="c">{bal[k].used}</td><td className="c">{bal[k].total}</td><td className={"c" + (bal[k].remaining <= 2 ? " neg" : "")}><b>{bal[k].remaining}</b></td></tr>)}</tbody>
          </table>
          {rem.length > 0 && <ul className="remlist">{rem.slice(0, 3).map((r, i) => <li key={i} className={r.tone}>{r.text}</li>)}</ul>}
        </section>
      </div>
      <section className="card">
        <div className="acthead"><h3>My leave register</h3><button className="linkbtn" onClick={() => go("leave")}>Apply or see all</button></div>
        <LeaveRegister leaves={mine} limit={5} empty="You have not applied for leave yet." />
      </section>
      <section className="card">
        <div className="acthead"><h3>My pension</h3><span className="chip plain">Retirement age: {s.settings?.retirementAge || 60}</span></div>
        {!myTeacherDetails ? <p className="muted">Your teacher details have not been added by an administrator yet.</p> : <>
          <dl className="kv pf">
            <dt>Full name</dt><dd>{myTeacherDetails.name}</dd>
            <dt>Date of birth</dt><dd>{myTeacherDetails.dateOfBirth || "Not recorded"}</dd>
            <dt>Date joined service</dt><dd>{myTeacherDetails.dateJoined || "Not recorded"}</dd>
            <dt>Subject</dt><dd>{myTeacherDetails.subject || "Not recorded"}</dd>
            <dt>Phone</dt><dd>{myTeacherDetails.phone || "Not recorded"}</dd>
          </dl>
          {pension?.retirementDate ? <div className="statrow">
            <div><b>{pension.retirementDate}</b><span>Pension (retirement) date</span></div>
            <div><b>{pension.retired ? "Retired" : formatDateParts(pension.remaining)}</b><span>Time remaining</span></div>
            <div><b>{pension.daysLeft}</b><span>Days left</span></div>
            <div><b>{pension.service ? formatDateParts(pension.service) : "Not recorded"}</b><span>Service completed</span></div>
          </div> : <p className="muted">Add a valid date of birth and date joined service to calculate pension countdown.</p>}
          {pension?.retired && <p className="alert info" role="status">Retirement date passed. Your history and records are retained.</p>}
          <p className="muted">The retirement-age rule is a configurable setting; confirm it with the official circular.</p>
        </>}
      </section>
      <div className="duo"><UpcomingDates s={s} /></div>

      <h3 className="sec">Quick actions</h3>
      <QuickActions actions={actions} />
    </>
  );
}
