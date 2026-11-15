import UpcomingDates from "./UpcomingDates.jsx";
import AnnouncementList from "./AnnouncementList.jsx";
import { latest } from "./announce.js";
import { status } from "./calendar.js";
import { idOf, readUsers } from "./auth.js";
import { StudentPublishedResults } from "./ResultsWorkflow.jsx";

export default function StudentHome({ s }) {
  const { meta, user, students, announcements, annSeen, uid, go, openProfile, classAssignments = [] } = s;
  const st = students.find((x) => String(x.index || "").trim().toLowerCase() === String(user.studentId).trim().toLowerCase());
  const grade = st?.grade || meta.grade;
  const division = st?.division || meta.className;
  const assigned = classAssignments.find((item) => (!item.year || String(item.year) === String(meta.year))
    && String(item.grade).trim().toLowerCase() === String(grade).trim().toLowerCase()
    && String(item.division).trim().toLowerCase() === String(division).trim().toLowerCase());
  const accounts = readUsers();
  const assignedTeacher = (id) => accounts.find((account) => idOf(account) === id);
  const classTeacher = assignedTeacher(assigned?.classTeacherId);
  const classPhoto = classTeacher?.photo || (!assigned || String(classTeacher?.name || "").trim().toLowerCase() === String(meta.classTeacher || "").trim().toLowerCase() ? meta.teacherPhoto : "");
  const subjects = assigned?.subjects || [];
  const items = latest(announcements, "student", 3, uid);
  const stat = status(meta.schedule || "tamil-sinhala");
  return (
    <>
      <section className="card hero2 student-hero">
        <div className="avatar2 student-avatar">{user.photo ? <img src={user.photo} alt={`${user.name} profile`} /> : user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "S"}</div>
        <div className="heroText">
          <span className="chip zone">Student dashboard</span>
          <h2 className="greet">Welcome, {user.name}</h2>
          <div className="chips">
            {user.studentId && <span className="chip dark">Index {user.studentId}</span>}
            <span className="chip dark">{grade} {division}</span>
            <span className="chip teal">{meta.term} · {meta.year}</span>
          </div>
          <button type="button" className="linkbtn student-edit-profile" onClick={openProfile}>Edit profile</button>
        </div>
        <div className="student-school">
          <div className="student-school-name">{meta.schoolName || "School name not set"}</div>
          <div className="tcell2">
            {classPhoto ? <img src={classPhoto} alt="" className="mini" /> : <span className="mini ph2" aria-hidden="true">T</span>}
            <span><span className="muted small">Class teacher</span><br /><b>{classTeacher?.name || (!assigned && meta.classTeacher) || "Not set"}</b></span>
          </div>
        </div>
      </section>

      {!user.studentId && <div className="alert bad" role="alert">Your login is not linked to a student record. Ask the admin to link it.</div>}

      <section className="card">
        <h3>My teachers</h3>
        <p className="muted">{grade} {division}</p>
        {!assigned ? <p className="muted">Your class teacher and subject teachers have not been assigned yet.</p> : (
          <div className="scroll">
            <table className="tbl small student-teachers-table">
              <thead><tr><th>Class / subject</th><th>Teacher</th></tr></thead>
              <tbody>
                <tr><td>Class teacher</td><td><span className="teacheridentity">{classPhoto ? <img className="mini" src={classPhoto} alt="" /> : <span className="mini ph2" aria-hidden="true">T</span>}{classTeacher?.name || "Teacher login unavailable"}</span></td></tr>
                {subjects.map((item, index) => {
                  const teacher = assignedTeacher(item.teacherId);
                  const initials = String(teacher?.name || "T").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
                  return <tr key={`${item.subject}-${index}`}><td>{item.subject}</td><td><span className="teacheridentity">{teacher?.photo ? <img className="mini" src={teacher.photo} alt="" /> : <span className="mini ph2" aria-hidden="true">{initials}</span>}{teacher?.name || "Teacher login unavailable"}</span></td></tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <StudentPublishedResults s={s} compact onView={() => go("results")} />

      <div className="duo">
        <section className="card">
          <div className="acthead"><h3>Announcements</h3><button className="linkbtn" onClick={() => go("announcements")}>View all</button></div>
          <AnnouncementList items={items} seenAt={annSeen[uid]} go={go} empty="No announcements right now." />
        </section>
        <UpcomingDates s={s} readOnly />
      </div>
      <section className="card banner">
        <div className="bicon" aria-hidden="true">▦</div>
        <div><span className="chip amber">School term</span></div>
        <div className="bstatus"><b className={"tone-" + stat.tone}>{stat.label}</b><span>{stat.sub}</span></div>
        <button className="btn ghost round" aria-label="Open term calendar" onClick={() => go("calendar")}>›</button>
      </section>
    </>
  );
}
