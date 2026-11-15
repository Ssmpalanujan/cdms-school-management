import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { idOf, readUsers, roleOf } from "./auth.js";
import { toast } from "./toastBus.js";
import { logActivity } from "./activity.js";
import { decidePromotion, sendPromotionRequest, applyAcceptedPromotion, reassignPromotion } from "./promotions.js";
import { decideHistoryRequest, requestPreviousClassData } from "./historyRequests.js";
import { Field } from "./ui.jsx";
import { GRADES } from "./students.js";
import { visiblePublishedHistory } from "./promotions.js";
import { DEFAULT_SCALE, moduleResult, studentGpa } from "./grading.js";
import { visibleClassRecordMarks } from "./resultsWorkflow.js";
import { attendanceEntries, attendanceTotals, classTeacherName, createRecordShare, revokeRecordShare, sharedStudentsForTeacher } from "./recordSharing.js";
import PersonAvatar from "./PersonAvatar.jsx";

const same = (left, right) => String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
const ALL_RECORD_CLASSES = "__all_classes__";
const RECORD_GRADE_PREFIX = "__grade__:";

export default function Promotions({ s }) {
  const {
    role, user, uid, meta, students, setStudents, academicYears, currentYear, classAssignments,
    promotionRequests, setPromotionRequests, enrollments, setEnrollments, announcements, setAnnouncements,
    historyRequests, setHistoryRequests, settings, setSettings,
    recordShares = [], setRecordShares = () => {}, attendance = {}, results = {},
  } = s;
  const admin = role === "admin";
  const [historyClassKey, setHistoryClassKey] = useState("");
  const [historyMessage, setHistoryMessage] = useState("");
  const [decliningHistory, setDecliningHistory] = useState("");
  const [historyDeclineReason, setHistoryDeclineReason] = useState("");
  const assignments = classAssignments.filter((item) => String(item.year) === String(currentYear));
  const myClasses = assignments.filter((item) => item.classTeacherId === uid);
  const recordYear = String(meta.year || currentYear);
  const recordTerm = String(meta.term || "Term 1");
  const periodAssignments = classAssignments.filter((item) => String(item.year) === recordYear);
  const recordAssignments = admin ? periodAssignments : periodAssignments.filter((item) => item.classTeacherId === uid
    || (item.subjects || []).some((subject) => subject.teacherId === uid));
  const recordClassOptions = [...new Map([
    ...(admin ? students.map((student) => [`${student.grade}|${student.division}`, { grade: student.grade, division: student.division, assignment: null }]) : []),
    ...recordAssignments.map((item) => [`${item.grade}|${item.division}`, { grade: item.grade, division: item.division, assignment: item }]),
  ]).values()].filter((item) => item.grade && item.division)
    .sort((left, right) => String(left.grade).localeCompare(String(right.grade), undefined, { numeric: true }) || String(left.division).localeCompare(String(right.division)));
  const [recordClassKey, setRecordClassKey] = useState(role === "admin" ? ALL_RECORD_CLASSES : "");
  const [recordSearch, setRecordSearch] = useState("");
  const [selectedRecordStudentId, setSelectedRecordStudentId] = useState("");
  const [classRecordTab, setClassRecordTab] = useState("records");
  const allRecordClasses = recordClassKey === ALL_RECORD_CLASSES;
  const selectedRecordGrade = recordClassKey.startsWith(RECORD_GRADE_PREFIX) ? recordClassKey.slice(RECORD_GRADE_PREFIX.length) : "";
  const selectedRecordClass = allRecordClasses || selectedRecordGrade
    ? null
    : recordClassOptions.find((item) => `${item.grade}|${item.division}` === recordClassKey) || recordClassOptions[0];
  const visibleRecordClasses = allRecordClasses
    ? recordClassOptions
    : selectedRecordGrade
      ? recordClassOptions.filter((item) => same(item.grade, selectedRecordGrade))
      : selectedRecordClass ? [selectedRecordClass] : [];
  const classTeacherView = admin || visibleRecordClasses.every((item) => item.assignment?.classTeacherId === uid);
  const visibleRecordMarks = visibleRecordClasses.flatMap((recordClass) => {
    const classMarks = visibleClassRecordMarks({
      role, actorId: uid, year: recordYear, term: recordTerm,
      grade: recordClass.grade, division: recordClass.division,
      assignments: periodAssignments, students, results,
    });
    const searchableClassMarks = classMarks.filter((row) => !recordSearch.trim()
      || `${row.studentName} ${row.studentId} ${row.subject}`.toLowerCase().includes(recordSearch.trim().toLowerCase()));
    if (classMarks.length || !(admin || recordClass.assignment?.classTeacherId === uid)) return searchableClassMarks;
    return students
      .filter((student) => same(student.grade, recordClass.grade) && same(student.division, recordClass.division))
      .filter((student) => !recordSearch.trim() || `${student.name} ${student.index}`.toLowerCase().includes(recordSearch.trim().toLowerCase()))
      .map((student) => ({ studentId: student.index, studentName: student.name, subject: "", teacherId: "", mark: null, entered: false, sheetStatus: "Not entered" }));
  });
  const visibleRecordStudentIds = new Set(visibleRecordMarks.map((row) => String(row.studentId).toLowerCase()));
  const recordDirectoryStudents = students
    .filter((student) => visibleRecordStudentIds.has(String(student.index).toLowerCase()))
    .filter((student) => visibleRecordClasses.some((recordClass) => same(student.grade, recordClass.grade) && same(student.division, recordClass.division)))
    .filter((student) => !recordSearch.trim() || `${student.name} ${student.index} ${student.grade} ${student.division}`.toLowerCase().includes(recordSearch.trim().toLowerCase()))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
  const selectedRecordStudent = students.find((student) => same(student.index, selectedRecordStudentId));
  const studentAccounts = readUsers().filter((account) => roleOf(account) === "student");
  const photoForStudent = (student) => studentAccounts.find((account) => same(account.studentId, student.index))?.photo;
  const selectedStudentMarks = selectedRecordStudent
    ? visibleRecordMarks.filter((row) => same(row.studentId, selectedRecordStudent.index))
    : [];
  const selectedStudentAttendance = selectedRecordStudent
    ? attendanceEntries(attendance, selectedRecordStudent.index)
    : [];
  const [shareClassKey, setShareClassKey] = useState("");
  const [shareReceiverId, setShareReceiverId] = useState("");
  const [shareStudentIds, setShareStudentIds] = useState({});
  const shareClass = myClasses.find((item) => `${item.grade}|${item.division}` === shareClassKey) || myClasses[0];
  const shareRoster = students.filter((student) => shareClass && same(student.grade, shareClass.grade) && same(student.division, shareClass.division));
  const historyClass = myClasses.find((item) => `${item.grade}|${item.division}` === historyClassKey) || myClasses[0];
  const historyRoster = students.filter((student) => historyClass && same(student.grade, historyClass.grade) && same(student.division, historyClass.division));
  const previousClassGroups = Object.values(historyRoster.reduce((groups, student) => {
    const previousEnrollment = enrollments.filter((item) => same(item.studentId, student.index) && Number(item.year) < Number(currentYear))
      .sort((a, b) => Number(b.year) - Number(a.year))[0];
    if (!previousEnrollment) return groups;
    const previousAssignment = classAssignments.find((item) => String(item.year) === String(previousEnrollment.year)
      && same(item.grade, previousEnrollment.grade) && same(item.division, previousEnrollment.division) && item.classTeacherId);
    if (!previousAssignment || previousAssignment.classTeacherId === uid) return groups;
    const key = `${previousEnrollment.year}|${previousEnrollment.grade}|${previousEnrollment.division}|${previousAssignment.classTeacherId}`;
    if (!groups[key]) groups[key] = { key, enrollment: previousEnrollment, assignment: previousAssignment, students: [] };
    groups[key].students.push(student);
    return groups;
  }, {}));
  const [sourceKey, setSourceKey] = useState("");
  const source = myClasses.find((item) => `${item.grade}|${item.division}` === sourceKey) || myClasses[0];
  const [targetGrade, setTargetGrade] = useState("");
  const [targetDivision, setTargetDivision] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState({});
  const [declining, setDeclining] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterDivision, setFilterDivision] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const users = readUsers().filter((account) => account.role === "teacher");
  const allSnapshots = Object.values(results?.classes || {});
  const sharedStudents = sharedStudentsForTeacher(recordShares, uid, students);
  const recordCandidates = admin ? students : [...new Map([...students.filter((student) => myClasses.some((item) => same(student.grade, item.grade) && same(student.division, item.division))), ...sharedStudents].map((student) => [String(student.index).toLowerCase(), student])).values()];
  const publishedHistory = recordCandidates.flatMap((student) => visiblePublishedHistory({
    role: admin ? "admin" : "teacher", actorId: uid, studentId: student.index, snapshots: allSnapshots,
    assignments: classAssignments, enrollments, requests: promotionRequests, historyRequests, recordShares, currentYear,
  }).map((snapshot) => ({ student, snapshot })));
  const incomingShares = recordShares.filter((share) => share.status === "Shared" && share.receiverId === uid);
  const visibleShares = recordShares.filter((share) => admin || share.senderId === uid || share.receiverId === uid);
  const nextYear = [...academicYears].filter((item) => Number(item.year) > Number(currentYear) && !item.closed).sort((a, b) => a.year.localeCompare(b.year))[0]?.year || "";
  const roster = students.filter((student) => source && same(student.grade, source.grade) && same(student.division, source.division));
  const targetAssignments = classAssignments.filter((item) => String(item.year) === String(nextYear) && same(item.grade, targetGrade) && same(item.division, targetDivision) && item.classTeacherId);
  const visibleRequests = promotionRequests.filter((request) => admin || request.senderId === uid || request.receiverId === uid);
  const filteredRequests = visibleRequests.filter((request) => (!filterYear || String(request.targetYear) === filterYear)
    && (!filterGrade || same(request.targetGrade, filterGrade))
    && (!filterDivision || same(request.targetDivision, filterDivision))
    && (!filterTeacher || request.senderId === filterTeacher || request.receiverId === filterTeacher));
  const gradeOptions = [...new Set([...GRADES, ...students.map((student) => student.grade)])].filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const unsentClasses = admin ? assignments.filter((assignment) => !promotionRequests.some((request) => request.sourceYear === currentYear && same(request.sourceGrade, assignment.grade) && same(request.sourceDivision, assignment.division))) : [];

  useEffect(() => {
    if (!source) return;
    if (!targetGrade) setTargetGrade(gradeOptions[Math.min(gradeOptions.indexOf(source.grade) + 1, gradeOptions.length - 1)] || source.grade);
    if (!targetDivision) setTargetDivision(source.division);
  }, [source?.grade, source?.division, targetGrade, targetDivision, gradeOptions.join("|")]);

  const notifyUsers = (userIds, title, body) => {
    const recipients = [...new Set(userIds.filter(Boolean))];
    if (!recipients.length) return;
    setAnnouncements((items) => [...items, { id: `promotion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, body, audience: "all", targetUserIds: recipients, priority: "important", author: "School notifications", role: "admin", at: Date.now() }]);
  };
  const shareRecords = (event) => {
    event.preventDefault();
    const selectedIds = Object.entries(shareStudentIds).filter(([, selectedValue]) => selectedValue).map(([studentId]) => studentId);
    const recipient = users.find((account) => idOf(account) === shareReceiverId);
    if (!shareClass || !recipient) return toast("Choose a class and receiving teacher.", "bad");
    if (!window.confirm(`Share the selected ${selectedIds.length} student's details, attendance and published marks with ${recipient.name}? The grant is read-only and can be revoked.`)) return;
    try {
      setRecordShares((current) => createRecordShare(current, {
        actorId: uid, receiverId: shareReceiverId, sourceYear: currentYear,
        grade: shareClass.grade, division: shareClass.division, studentIds: selectedIds, attendance,
      }, assignments, students));
      logActivity("record-sharing", `Shared ${selectedIds.length} ${shareClass.grade} ${shareClass.division} student record(s) with ${recipient.name}`);
      notifyUsers([shareReceiverId], "Class records shared with you", `${user.name} shared ${selectedIds.length} student record(s) from ${shareClass.grade} ${shareClass.division} for ${currentYear}.`);
      setShareStudentIds({});
      toast("Read-only class records shared.");
    } catch (error) { toast(error.message, "bad"); }
  };
  const revokeShare = (share) => {
    if (!window.confirm("Revoke this teacher's access to the shared records?")) return;
    try {
      setRecordShares((current) => revokeRecordShare(current, share.id, uid, role));
      logActivity("record-sharing", `Revoked shared records for ${share.receiverId}`);
      notifyUsers([share.receiverId], "Shared class records access revoked", `Access to ${share.sourceGrade} ${share.sourceDivision} records was revoked.`);
      toast("Shared access revoked.");
    } catch (error) { toast(error.message, "bad"); }
  };
  const sendHistoryRequest = (group) => {
    const receiver = users.find((account) => idOf(account) === group.assignment.classTeacherId);
    const input = {
      receiverId: group.assignment.classTeacherId,
      receiverName: receiver?.name || "Previous class teacher",
      sourceYear: String(group.enrollment.year),
      sourceGrade: group.enrollment.grade,
      sourceDivision: group.enrollment.division,
      targetYear: String(currentYear),
      targetGrade: historyClass.grade,
      targetDivision: historyClass.division,
      students: group.students.map((student) => ({ studentId: student.index, name: student.name })),
      message: historyMessage.trim(),
    };
    if (!window.confirm(`Request previous-year activity, marks and GPA for ${group.students.length} student(s) from ${receiver?.name || "the previous class teacher"}?`)) return;
    try {
      const next = requestPreviousClassData(historyRequests, input, { ...user, id: uid }, classAssignments, enrollments, students);
      setHistoryRequests(next);
      logActivity("history-request", `Requested previous class data for ${group.students.length} students from ${input.receiverName}`);
      notifyUsers([input.receiverId], "Previous class data requested", `${user.name} requests the previous-year records of ${group.students.length} student(s) from ${input.sourceGrade} ${input.sourceDivision}.`);
      setHistoryMessage("");
      toast("Previous class data request sent");
    } catch (error) { toast(error.message, "bad"); }
  };
  const answerHistoryRequest = (request, action, reason = "") => {
    if (action === "accept" && !window.confirm(`Share the published previous-year student records for ${request.students.length} student(s) with ${request.senderName}?`)) return;
    try {
      const next = decideHistoryRequest(historyRequests, request.id, action, { ...user, id: uid }, reason, Date.now(), classAssignments);
      setHistoryRequests(next);
      logActivity("history-request", `Previous class data request ${action}${reason ? `: ${reason.trim()}` : ""}`);
      if (action === "accept") notifyUsers([request.senderId], "Previous class data approved", `${request.receiverName || user.name} approved access to ${request.students.length} student(s)' published previous-year records.`);
      if (action === "decline") notifyUsers([request.senderId], "Previous class data declined", reason.trim());
      if (action === "cancel") notifyUsers([request.receiverId], "Previous class data request cancelled", `${user.name} cancelled the request for ${request.students.length} student(s).`);
      setDecliningHistory(""); setHistoryDeclineReason("");
      toast(`Previous data request ${action}ed`);
    } catch (error) { toast(error.message, "bad"); }
  };
  const saveRequests = (next, messageText) => {
    setPromotionRequests(next);
    logActivity("promotion", messageText);
  };
  const applyAcceptance = (next, request) => {
    const accepted = next.find((item) => item.id === request.id);
    const moved = applyAcceptedPromotion(enrollments, students, accepted);
    setEnrollments(moved.enrollments);
    setStudents(moved.students);
    const studentUsers = readUsers().filter((account) => account.role === "student" && accepted.students.some((student) => same(student.studentId, account.studentId))).map(idOf);
    notifyUsers([accepted.senderId, accepted.receiverId, ...readUsers().filter((account) => account.role === "admin").map(idOf), ...studentUsers], "Class promotion accepted", `Promotion to ${accepted.targetGrade} ${accepted.targetDivision} was accepted for ${accepted.students.length} student(s).`);
  };
  const send = (event) => {
    event.preventDefault();
    if (!source || !nextYear) return toast("A class and a newly created next academic year are required.", "bad");
    const picked = roster.filter((student) => selected[student.index] !== false);
    if (!window.confirm(`Send a promotion request for ${picked.length} student(s) to ${targetGrade} ${targetDivision}?`)) return;
    try {
      const requestInput = {
        sourceYear: String(currentYear), sourceGrade: source.grade, sourceDivision: source.division,
        targetYear: String(nextYear), targetGrade, targetDivision, receiverId,
        receiverName: users.find((account) => idOf(account) === receiverId)?.name || "",
        students: picked.map((student) => ({ studentId: student.index, name: student.name, division: selected[`${student.index}:division`] || targetDivision })),
        message: message.trim(),
      };
      const next = sendPromotionRequest(promotionRequests, requestInput, { ...user, id: uid }, classAssignments, Date.now(), students, academicYears);
      saveRequests(next, `Promotion request sent for ${picked.length} students from ${source.grade} ${source.division} to ${targetGrade} ${targetDivision}`);
      notifyUsers([receiverId], "Incoming class promotion request", `${user.name} requests transfer of ${picked.length} student(s) to ${targetGrade} ${targetDivision}.`);
      setSelected({}); setMessage(""); toast("Promotion request sent");
    } catch (error) { toast(error.message, "bad"); }
  };
  const decision = (request, action, reason = "") => {
    if (action === "accept" && !window.confirm(`Accept promotion for ${request.students.length} student(s) to ${request.targetGrade} ${request.targetDivision}?`)) return;
    if (action === "cancel" && !window.confirm("Cancel this pending promotion request?")) return;
    if (action === "force" && !window.confirm(`Force this transfer to ${request.targetGrade} ${request.targetDivision}?`)) return;
    try {
      const next = decidePromotion(promotionRequests, request.id, action, { ...user, id: uid }, reason, Date.now(), classAssignments, students, academicYears);
      saveRequests(next, `Promotion request ${action}${action === "decline" || action === "force" ? `: ${reason.trim()}` : ""}`);
      if (action === "accept" || action === "force") applyAcceptance(next, request);
      else if (action === "decline") notifyUsers([request.senderId], "Promotion request declined", reason.trim());
      else notifyUsers([request.receiverId], "Promotion request cancelled", `Request for ${request.students.length} student(s) was cancelled.`);
      setDeclining(""); setDeclineReason(""); toast(`Promotion request ${action === "force" ? "transferred" : `${action}ed`}`);
    } catch (error) { toast(error.message, "bad"); }
  };
  const resend = (request) => {
    if (!request.sourceYear || String(request.sourceYear) !== String(currentYear)) return toast("This declined request belongs to a past academic year.", "bad");
    setSourceKey(`${request.sourceGrade}|${request.sourceDivision}`);
    setTargetGrade(request.targetGrade);
    setTargetDivision(request.targetDivision);
    setReceiverId(request.receiverId);
    setMessage(request.message || "");
    setSelected(Object.fromEntries(request.students.map((student) => [student.studentId, true])
      .concat(request.students.map((student) => [`${student.studentId}:division`, student.division]))));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return <>
    <div className="pagehead"><h2>Class record</h2><span className="muted">Academic year {recordYear} · {recordTerm}</span></div>
    <div className="class-record-tabs" role="tablist" aria-label="Class record sections">
      <button type="button" role="tab" aria-selected={classRecordTab === "records"} className={classRecordTab === "records" ? "class-record-tab active" : "class-record-tab"} onClick={() => setClassRecordTab("records")}>Class record</button>
      <button type="button" role="tab" aria-selected={classRecordTab === "workflow"} className={classRecordTab === "workflow" ? "class-record-tab active" : "class-record-tab"} onClick={() => setClassRecordTab("workflow")}>Promotions &amp; sharing</button>
    </div>
    {classRecordTab === "records" && <section className="card">
      <div className="acthead"><div><h3>Student marks and attendance</h3><p className="muted">{allRecordClasses ? "Showing records for all classes available to you." : classTeacherView ? "Class teachers and admins can review every assigned subject and student, including marks still in progress." : "You can see only marks entered for your assigned subjects."} Attendance includes every recorded attendance date. Records are read-only here.</p></div></div>
      {!recordClassOptions.length ? <p className="muted">{admin ? `No class records are available for ${recordYear}.` : `No class or subject assignments are available for ${recordYear}.`}</p> : <>
        <div className="filters class-record-filters">
          <label className="field"><span>Class</span><select aria-label="Class record class" value={allRecordClasses ? ALL_RECORD_CLASSES : selectedRecordGrade ? `${RECORD_GRADE_PREFIX}${selectedRecordGrade}` : selectedRecordClass ? `${selectedRecordClass.grade}|${selectedRecordClass.division}` : ""} onChange={(event) => { setRecordClassKey(event.target.value); setRecordSearch(""); }}>
            <option value={ALL_RECORD_CLASSES}>All classes</option>
            {admin && GRADES.map((grade) => <option key={grade} value={`${RECORD_GRADE_PREFIX}${grade}`}>{grade} · all classes</option>)}
            {recordClassOptions.map((item) => <option key={`${item.grade}|${item.division}`} value={`${item.grade}|${item.division}`}>{item.grade} {item.division}</option>)}
          </select></label>
          <label className="field"><span>Search students</span><input type="search" aria-label="Search students" placeholder="Search by name, index or subject" value={recordSearch} onChange={(event) => setRecordSearch(event.target.value)} /></label>
        </div>
        {!allRecordClasses && !selectedRecordGrade && selectedRecordClass?.assignment?.classTeacherId && <p className="muted">Class teacher: {classTeacherName(classAssignments, users, recordYear, selectedRecordClass.grade, selectedRecordClass.division)}</p>}
        {!recordDirectoryStudents.length ? <p className="muted">{recordSearch ? "No students match your search." : "No students are available for this class."}</p> : (
          <div className="class-record-student-grid">
            {recordDirectoryStudents.map((student) => (
              <button
                type="button"
                className="class-record-student"
                key={student.id || student.index}
                aria-label={`View student details for ${student.name}`}
                onClick={() => setSelectedRecordStudentId(student.index)}
              >
                <PersonAvatar name={student.name} photo={photoForStudent(student)} className="class-record-student-avatar" />
                <span className="class-record-student-info">
                  <b>{student.name}</b>
                  <span>{student.grade} {student.division}</span>
                  <small>Index {student.index}</small>
                </span>
                <span className="class-record-student-open" aria-hidden="true">View details</span>
              </button>
            ))}
          </div>
        )}
      </>}
    </section>}
    {selectedRecordStudent && createPortal(
      <div className="modal student-record-modal" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRecordStudentId(""); }}>
        <section
          className="dialog student-record-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-record-title"
          onKeyDown={(event) => { if (event.key === "Escape") setSelectedRecordStudentId(""); }}
        >
          <button type="button" className="student-record-close" aria-label="Close student details" autoFocus onClick={() => setSelectedRecordStudentId("")}>×</button>
          <header className="student-record-header">
            <PersonAvatar name={selectedRecordStudent.name} photo={photoForStudent(selectedRecordStudent)} className="student-record-avatar" />
            <div>
              <h2 id="student-record-title">{selectedRecordStudent.name}</h2>
              <p className="muted">{selectedRecordStudent.grade} {selectedRecordStudent.division} · Index {selectedRecordStudent.index}</p>
            </div>
          </header>
          <section className="student-record-section">
            <h3>Student details</h3>
            <dl className="student-record-details">
              <div><dt>Gender</dt><dd>{selectedRecordStudent.gender || "Not provided"}</dd></div>
              <div><dt>Date of birth</dt><dd>{selectedRecordStudent.dob || "Not provided"}</dd></div>
              <div><dt>Student email</dt><dd>{selectedRecordStudent.email || "Not provided"}</dd></div>
              <div><dt>Guardian phone</dt><dd>{selectedRecordStudent.guardian || "Not provided"}</dd></div>
              <div><dt>Class teacher</dt><dd>{classTeacherName(classAssignments, users, recordYear, selectedRecordStudent.grade, selectedRecordStudent.division)}</dd></div>
            </dl>
          </section>
          <section className="student-record-section">
            <h3>Marks and subjects <span className="muted">{recordTerm} {recordYear}</span></h3>
            {!selectedStudentMarks.length ? <p className="muted">No subject records are available for this student in the selected class and period.</p> : (
              <div className="scroll">
                <table className="tbl student-record-marks-table">
                  <thead><tr><th>Subject</th><th>Subject teacher</th><th>Formative</th><th>Summative</th><th>Total</th><th>Grade</th><th>Activities / remarks</th><th>Status</th></tr></thead>
                  <tbody>{selectedStudentMarks.map((row, index) => {
                    const mark = row.mark;
                    const scale = Array.isArray(s.cfg?.scale) && s.cfg.scale.length ? s.cfg.scale : DEFAULT_SCALE;
                    const result = mark ? moduleResult({ ...mark, moduleTitle: row.subject, absent: !!mark.absent }, scale) : null;
                    const teacherName = users.find((account) => idOf(account) === row.teacherId)?.name || "Assigned teacher";
                    const activities = (mark?.activities || []).map((activity) => `${activity.name || activity.title || "Activity"}: ${activity.score ?? activity.mark ?? activity.marks ?? "–"}/${activity.max ?? "–"}`).join("; ");
                    return <tr key={`${row.subject}|${row.teacherId}|${index}`}>
                      <td>{row.subject || "–"}</td><td>{row.teacherId ? teacherName : "–"}</td>
                      <td>{mark?.absent ? "Absent" : mark?.formative ?? "–"}</td><td>{mark?.absent ? "Absent" : mark?.summative ?? "–"}</td>
                      <td>{result?.total ?? "–"}</td><td>{result?.grade || "–"}</td><td>{activities || mark?.absentRemark || mark?.remark || "–"}</td>
                      <td>{row.entered ? row.sheetStatus : "Not entered"}</td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            )}
          </section>
          <section className="student-record-section">
            <h3>Attendance</h3>
            <div className="student-record-attendance-summary">
              {Object.entries(attendanceTotals(attendance, selectedRecordStudent.index)).map(([status, count]) => (
                <div key={status}><span>{status}</span><b>{count}</b></div>
              ))}
            </div>
            {!selectedStudentAttendance.length ? <p className="muted">No attendance has been recorded for this student.</p> : (
              <div className="scroll">
                <table className="tbl student-record-attendance-table">
                  <thead><tr><th>Date</th><th>Status</th></tr></thead>
                  <tbody>{selectedStudentAttendance.map((entry) => <tr key={entry.date}><td>{entry.date}</td><td>{entry.status}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </div>,
      document.body,
    )}
    {classRecordTab === "workflow" && <>
    <section className="card">
      <div className="acthead"><div><h3>{admin ? "Class roster and attendance" : "My class roster and attendance"}</h3><p className="muted">Read-only student details and attendance totals. The class teacher is shown for every class.</p></div></div>
      {!admin && !myClasses.length ? <p className="muted">You are not assigned as a class teacher for {currentYear}.</p> : (() => {
        const displayedStudents = admin ? students : students.filter((student) => myClasses.some((item) => same(student.grade, item.grade) && same(student.division, item.division)));
        return !displayedStudents.length ? <p className="muted">No students are enrolled in the assigned class yet.</p> : <div className="scroll">
          <table className="tbl small class-records-table">
            <thead><tr><th>Student</th><th>Index</th><th>Gender</th><th>Date of birth</th><th>Guardian phone</th><th>Grade / division</th><th>Class teacher</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Attendance details</th></tr></thead>
            <tbody>{displayedStudents.map((student) => {
              const totals = attendanceTotals(attendance, student.index, recordYear);
              const days = attendanceEntries(attendance, student.index, recordYear);
              return <tr key={student.id || student.index}>
                <td>{student.name}</td><td>{student.index}</td><td>{student.gender || "–"}</td><td>{student.dob || "–"}</td><td>{student.guardian || "–"}</td><td>{student.grade} {student.division}</td>
                <td>{classTeacherName(classAssignments, users, currentYear, student.grade, student.division)}</td>
                <td>{totals.Present}</td><td>{totals.Absent}</td><td>{totals.Late}</td><td>{totals.Excused}</td>
                <td>{days.length ? <details className="class-record-attendance"><summary>{days.length} marked day(s)</summary><ul>{days.map((day) => <li key={day.date}>{day.date}: {day.status}</li>)}</ul></details> : "–"}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>;
      })()}
    </section>
    {role === "teacher" && <section className="card">
      <div className="acthead"><div><h3>Share class records</h3><p className="muted">Share selected students' details, all recorded attendance dates, and published marks/activities as read-only data. Attendance is not stored by academic year. Only the assigned class teacher can grant access to the named teacher and selected students.</p></div></div>
      {!myClasses.length ? <p className="muted">Only a class teacher assigned to a class in {currentYear} can share records.</p> : <>
        <form onSubmit={shareRecords}>
          <div className="grid">
            <Field label="Your class"><select aria-label="Class to share" value={shareClass ? `${shareClass.grade}|${shareClass.division}` : ""} onChange={(event) => { setShareClassKey(event.target.value); setShareStudentIds({}); }}>
              {myClasses.map((item) => <option key={`${item.grade}|${item.division}`} value={`${item.grade}|${item.division}`}>{item.grade} {item.division}</option>)}
            </select></Field>
            <Field label="Share with teacher"><select aria-label="Share with teacher" value={shareReceiverId} onChange={(event) => setShareReceiverId(event.target.value)}>
              <option value="">Choose a teacher</option>{users.filter((account) => idOf(account) !== uid).map((account) => <option key={idOf(account)} value={idOf(account)}>{account.name}</option>)}
            </select></Field>
          </div>
          <div className="acthead"><h4>Select students ({Object.values(shareStudentIds).filter(Boolean).length} selected)</h4>
            <button type="button" className="btn ghost sm" onClick={() => setShareStudentIds(Object.fromEntries(shareRoster.map((student) => [student.index, true])))}>Select all</button>
          </div>
          {!shareRoster.length ? <p className="muted">There are no students in this class.</p> : <div className="scroll"><table className="tbl small class-records-table">
            <thead><tr><th>Share</th><th>Student</th><th>Index</th><th>Grade / division</th><th>Class teacher</th></tr></thead>
            <tbody>{shareRoster.map((student) => <tr key={student.index}>
              <td><input type="checkbox" aria-label={`Share ${student.name}`} checked={!!shareStudentIds[student.index]} onChange={(event) => setShareStudentIds((current) => ({ ...current, [student.index]: event.target.checked }))} /></td>
              <td>{student.name}</td><td>{student.index}</td><td>{student.grade} {student.division}</td><td>{classTeacherName(classAssignments, users, currentYear, student.grade, student.division)}</td>
            </tr>)}</tbody>
          </table></div>}
          <button className="btn teal" disabled={!shareReceiverId || !Object.values(shareStudentIds).some(Boolean)}>Share selected records</button>
        </form>
      </>}
    </section>}
    {role === "teacher" && incomingShares.length > 0 && <section className="card">
      <h3>Records shared with me · read-only</h3>
      <p className="muted">These records are limited to the teacher, students and source class selected by the sharing teacher.</p>
      <div className="scroll"><table className="tbl small class-records-table">
        <thead><tr><th>From teacher</th><th>Year / class</th><th>Student</th><th>Index</th><th>Gender</th><th>Date of birth</th><th>Guardian phone</th><th>Attendance (P/A/L/E)</th><th>Attendance details</th></tr></thead>
        <tbody>{incomingShares.flatMap((share) => share.studentIds.map((studentId) => {
          const student = students.find((item) => same(item.index, studentId));
          if (!student) return null;
          const totals = attendanceTotals(share.attendance, student.index, share.sourceYear);
          const days = attendanceEntries(share.attendance, student.index, share.sourceYear);
          const senderName = users.find((account) => idOf(account) === share.senderId)?.name || "Teacher";
          return <tr key={`${share.id}|${student.index}`}><td>{senderName}</td><td>{share.sourceYear} · {share.sourceGrade} {share.sourceDivision}</td><td>{student.name}</td><td>{student.index}</td><td>{student.gender || "–"}</td><td>{student.dob || "–"}</td><td>{student.guardian || "–"}</td><td>{totals.Present}/{totals.Absent}/{totals.Late}/{totals.Excused}</td><td>{days.length ? <details className="class-record-attendance"><summary>{days.length} marked day(s)</summary><ul>{days.map((day) => <li key={day.date}>{day.date}: {day.status}</li>)}</ul></details> : "–"}</td></tr>;
        }))}</tbody>
      </table></div>
    </section>}
    <section className="card">
      <div className="acthead"><div><h3>Published marks, GPA and activities · read-only</h3><p className="muted">Only published marks for students authorized in your class or explicitly shared with you are shown.</p></div></div>
      {!publishedHistory.length ? <p className="muted">No published student history is available to this class yet.</p> : <div className="scroll"><table className="tbl small teacher-history-table">
        <thead><tr><th>Student</th><th>Index</th><th>Class teacher</th><th>Year / term</th><th>Subject</th><th>Activities</th><th>Formative</th><th>Summative</th><th>Grade</th><th>Final GPA</th><th>Remarks</th></tr></thead>
        <tbody>{publishedHistory.flatMap(({ student, snapshot }) => {
          const scale = Array.isArray(snapshot.scale) && snapshot.scale.length ? snapshot.scale : DEFAULT_SCALE;
          const gpa = studentGpa(snapshot.subjects.flatMap((subject) => subject.marks), scale).gpa;
          return snapshot.subjects.flatMap((subject) => subject.marks.map((mark) => {
            const result = moduleResult({ ...mark, moduleTitle: subject.subject, absent: !!mark.absent }, scale);
            const activities = (mark.activities || []).map((activity) => `${activity.name || activity.title || "Activity"}: ${activity.score ?? activity.mark ?? activity.marks ?? "–"}/${activity.max ?? "–"}`).join("; ");
            return <tr key={`${student.index}|${snapshot.year}|${snapshot.term}|${subject.subject}`}><td>{student.name}</td><td>{student.index}</td><td>{classTeacherName(classAssignments, users, snapshot.year, snapshot.grade, snapshot.division)}</td><td>{snapshot.year} · {snapshot.term}</td><td>{subject.subject}</td><td>{activities || "–"}</td><td>{mark.formative ?? "–"}</td><td>{mark.summative ?? "–"}</td><td>{result.grade}</td><td>{gpa.toFixed(2)}</td><td>{mark.absentRemark || mark.remark || "–"}</td></tr>;
          }));
        })}</tbody>
      </table></div>}
    </section>
    {visibleShares.length > 0 && <section className="card">
      <h3>Shared record access</h3>
      <div className="scroll"><table className="tbl small class-records-table">
        <thead><tr><th>Class / year</th><th>Shared by</th><th>Shared with</th><th>Students</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{visibleShares.map((share) => <tr key={share.id}>
          <td>{share.sourceYear} · {share.sourceGrade} {share.sourceDivision}</td>
          <td>{users.find((account) => idOf(account) === share.senderId)?.name || "Teacher"}</td>
          <td>{users.find((account) => idOf(account) === share.receiverId)?.name || "Teacher"}</td>
          <td>{share.studentIds.map((id) => students.find((student) => same(student.index, id))?.name || id).join(", ")}</td>
          <td><span className={`chip ${share.status === "Shared" ? "st-approved" : "plain"}`}>{share.status}</span></td>
          <td>{share.status === "Shared" && (admin || share.senderId === uid) && <button className="linkbtn del" onClick={() => revokeShare(share)}>Revoke access</button>}</td>
        </tr>)}</tbody>
      </table></div>
    </section>}
    {!admin && <section className="card">
      <h3>Promote class to {nextYear || "next year"}</h3>
      {!nextYear ? <p className="muted">The administrator must add the next academic year before a class can be promoted.</p>
        : !myClasses.length ? <p className="muted">Only a class teacher assigned to a class in {currentYear} can submit a promotion request.</p>
          : <form onSubmit={send} noValidate>
            <div className="grid">
              <Field label="Your class"><select aria-label="Your class" value={sourceKey || (myClasses[0] ? `${myClasses[0].grade}|${myClasses[0].division}` : "")} onChange={(event) => { setSourceKey(event.target.value); setSelected({}); setTargetGrade(""); setTargetDivision(""); }}>{
                myClasses.map((item) => <option key={`${item.grade}|${item.division}`} value={`${item.grade}|${item.division}`}>{item.grade} {item.division}</option>)
              }</select></Field>
              <Field label="Target grade"><select aria-label="Target grade" value={targetGrade || gradeOptions[Math.min(gradeOptions.indexOf(source?.grade) + 1, gradeOptions.length - 1)] || ""} onChange={(event) => setTargetGrade(event.target.value)}>{gradeOptions.map((grade) => <option key={grade}>{grade}</option>)}</select></Field>
              <Field label="Target division"><input aria-label="Target division" value={targetDivision || source?.division || ""} onChange={(event) => setTargetDivision(event.target.value.toUpperCase())} /></Field>
              <Field label="Receiving class teacher"><select aria-label="Receiving class teacher" value={receiverId} onChange={(event) => setReceiverId(event.target.value)}><option value="">Choose assigned teacher</option>{targetAssignments.map((item) => <option key={item.classTeacherId} value={item.classTeacherId}>{users.find((account) => idOf(account) === item.classTeacherId)?.name || "Teacher"} · {item.grade} {item.division}</option>)}</select></Field>
            </div>
            <h4>Students ({roster.length})</h4>
            {!roster.length ? <p className="muted">No students are enrolled in this class.</p> : <div className="scroll"><table className="tbl small">
              <thead><tr><th>Move</th><th>Student</th><th>Target division</th></tr></thead>
              <tbody>{roster.map((student) => <tr key={student.index}><td><input type="checkbox" aria-label={`Promote ${student.name}`} checked={selected[student.index] !== false} onChange={(event) => setSelected((value) => ({ ...value, [student.index]: event.target.checked }))} /></td><td>{student.name} · {student.index}</td><td><input aria-label={`${student.name} target division`} value={selected[`${student.index}:division`] || targetDivision || source?.division || ""} onChange={(event) => setSelected((value) => ({ ...value, [`${student.index}:division`]: event.target.value.toUpperCase() }))} /></td></tr>)}</tbody>
            </table></div>}
            <Field label="Optional message"><textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} /></Field>
            <button className="btn teal" disabled={!receiverId || !roster.some((student) => selected[student.index] !== false)}>Send promotion request</button>
          </form>}
    </section>}
    {role === "teacher" && <section className="card">
      <div className="acthead"><div><h3>Request previous class data</h3><p className="muted">Ask the prior class teacher to approve access to published activities, marks and GPA for students now in your class.</p></div></div>
      {!myClasses.length ? <p className="muted">Only a class teacher assigned to the current year can request previous class data.</p> : <>
        <Field label="Your current class"><select aria-label="Current class for history request" value={historyClassKey || `${historyClass.grade}|${historyClass.division}`} onChange={(event) => setHistoryClassKey(event.target.value)}>{myClasses.map((item) => <option key={`${item.grade}|${item.division}`} value={`${item.grade}|${item.division}`}>{item.grade} {item.division}</option>)}</select></Field>
        <Field label="Optional message"><textarea rows={2} value={historyMessage} onChange={(event) => setHistoryMessage(event.target.value)} /></Field>
        {!historyRoster.length ? <p className="muted">There are no students in this current class.</p>
          : !previousClassGroups.length ? <p className="muted">No students have a prior-year enrollment assigned to another class teacher.</p>
            : <div className="history-request-groups">{previousClassGroups.map((group) => {
              const prior = historyRequests.find((request) => ["Pending", "Accepted"].includes(request.status)
                && request.senderId === uid && request.receiverId === group.assignment.classTeacherId
                && String(request.sourceYear) === String(group.enrollment.year)
                && same(request.sourceGrade, group.enrollment.grade) && same(request.sourceDivision, group.enrollment.division)
                && String(request.targetYear) === String(currentYear)
                && request.students.some((student) => group.students.some((item) => same(item.index, student.studentId))));
              const teacherName = users.find((account) => idOf(account) === group.assignment.classTeacherId)?.name || "Previous class teacher";
              return <article className="history-request-group" key={group.key}>
                <div><b>{group.enrollment.year} · {group.enrollment.grade} {group.enrollment.division}</b><span className="muted">Previous teacher: {teacherName} · {group.students.length} student(s)</span></div>
                <p>{group.students.map((student) => `${student.name} (${student.index})`).join(", ")}</p>
                {prior ? <span className={`chip ${prior.status === "Accepted" ? "st-approved" : "st-pending"}`}>{prior.status}</span>
                  : <button className="btn ghost" onClick={() => sendHistoryRequest(group)}>Request records</button>}
              </article>;
            })}</div>}
      </>}
    </section>}
    {(role === "teacher" || admin) && <section className="card">
      <h3>Previous class data requests{admin ? "" : " · sent and received"}</h3>
      {(() => {
        const visible = historyRequests.filter((request) => admin || request.receiverId === uid || request.senderId === uid);
        const displayed = visible;
        if (!displayed.length) return <p className="muted">No previous class data requests.</p>;
        return <div className="history-request-groups">{displayed.map((request) => <article className="history-request-group" key={request.id}>
          <div className="acthead"><b>{request.sourceYear} · {request.sourceGrade} {request.sourceDivision} → {request.targetYear} · {request.targetGrade} {request.targetDivision}</b><span className={`chip ${request.status === "Accepted" ? "st-approved" : request.status === "Pending" ? "st-pending" : "plain"}`}>{request.status}</span></div>
          <p>From {request.senderName} · To {request.receiverName} · {request.students.length} student(s)</p>
          <ul>{request.students.map((student) => <li key={student.studentId}>{student.name} · Index {student.studentId}</li>)}</ul>
          <p className="muted">{request.message || "No message."}{request.declineReason ? ` Decline reason: ${request.declineReason}` : ""}</p>
          {role === "teacher" && request.status === "Pending" && request.receiverId === uid && <div className="row">
            <button className="btn teal" onClick={() => answerHistoryRequest(request, "accept")}>Approve and share records</button>
            <button className="btn danger" onClick={() => setDecliningHistory(request.id)}>Decline</button>
          </div>}
          {role === "teacher" && request.status === "Pending" && request.senderId === uid && <button className="linkbtn del" onClick={() => answerHistoryRequest(request, "cancel")}>Cancel request</button>}
          {role === "teacher" && decliningHistory === request.id && <div className="grid"><Field label="Decline reason"><textarea aria-label="History request decline reason" value={historyDeclineReason} onChange={(event) => setHistoryDeclineReason(event.target.value)} /></Field><button className="btn danger" disabled={!historyDeclineReason.trim()} onClick={() => { if (window.confirm("Decline this previous class data request?")) answerHistoryRequest(request, "decline", historyDeclineReason); }}>Confirm decline</button><button className="btn ghost" onClick={() => setDecliningHistory("")}>Cancel</button></div>}
        </article>)}</div>;
      })()}
    </section>}
    {admin && <>
      <section className="card">
        <h3>Settings</h3><Field label="Pending request expiry (days)"><input aria-label="Pending request expiry days" type="number" min="1" value={settings.promotionExpiryDays || 30} onChange={(event) => setSettings({ ...settings, promotionExpiryDays: Math.max(1, Number(event.target.value) || 30) })} /></Field>
        <p className="muted">Pending requests older than this number of days are flagged as expired.</p>
      </section>
      <section className="card"><h3>Classes without a request · {currentYear}</h3>{unsentClasses.length ? <ul>{unsentClasses.map((item) => <li key={`${item.grade}|${item.division}`}>{item.grade} {item.division}</li>)}</ul> : <p className="muted">Every assigned class has sent a request, or no classes are assigned.</p>}</section>
    </>}
    {role === "teacher" && <section className="card"><h3>Incoming requests</h3>
      {visibleRequests.filter((request) => request.receiverId === uid).length ? visibleRequests.filter((request) => request.receiverId === uid).map((request) => <article className="card" key={request.id}>
        <div className="acthead"><h4>{request.sourceGrade} {request.sourceDivision} → {request.targetGrade} {request.targetDivision}</h4><span className={`chip ${request.status === "Accepted" ? "st-approved" : request.status === "Pending" ? "amber" : "plain"}`}>{request.status}</span></div>
        <p>From {request.senderName} · {request.students.length} student(s)</p>
        <ul>{request.students.map((student) => <li key={student.studentId}>{student.name}</li>)}</ul><p className="muted">{request.message || "No message."}</p>
        {request.status === "Pending" && <div className="row"><button className="btn teal" onClick={() => decision(request, "accept")}>Accept</button><button className="btn danger" onClick={() => setDeclining(request.id)}>Decline</button></div>}
        {request.status === "Pending" && declining === request.id && <div className="grid"><Field label="Decline reason"><textarea aria-label="Decline reason" value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} /></Field><button className="btn danger" disabled={!declineReason.trim()} onClick={() => { if (window.confirm("Decline this request?")) decision(request, "decline", declineReason); }}>Confirm decline</button><button className="btn ghost" onClick={() => setDeclining("")}>Cancel</button></div>}
      </article>) : <p className="muted">No incoming promotion requests.</p>}
    </section>}
    <section className="card">
      <div className="acthead">
        <h3>{admin ? "All promotion requests" : "My sent requests"}</h3>
        {admin && <div className="filters">
          <select aria-label="Filter by year" value={filterYear} onChange={(event) => setFilterYear(event.target.value)}><option value="">All years</option>{academicYears.map((item) => <option key={item.year}>{item.year}</option>)}</select>
          <select aria-label="Filter by grade" value={filterGrade} onChange={(event) => setFilterGrade(event.target.value)}><option value="">All grades</option>{gradeOptions.map((grade) => <option key={grade}>{grade}</option>)}</select>
          <select aria-label="Filter by division" value={filterDivision} onChange={(event) => setFilterDivision(event.target.value)}><option value="">All divisions</option>{[...new Set(promotionRequests.map((item) => item.targetDivision))].map((division) => <option key={division}>{division}</option>)}</select>
          <select aria-label="Filter by teacher" value={filterTeacher} onChange={(event) => setFilterTeacher(event.target.value)}><option value="">All teachers</option>{users.map((account) => <option key={idOf(account)} value={idOf(account)}>{account.name}</option>)}</select>
        </div>}
      </div>
      {!filteredRequests.length ? <p className="muted">No promotion requests match this view.</p> : <div className="scroll">
        <table className="tbl small">
          <thead><tr><th>From / to</th><th>Teachers</th><th>Students</th><th>Message / reason</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{filteredRequests.map((request) => {
            const receiverName = users.find((account) => idOf(account) === request.receiverId)?.name || request.receiverName;
            const reassignees = classAssignments.filter((item) => String(item.year) === String(request.targetYear)
              && same(item.grade, request.targetGrade)
              && request.students.every((student) => same(student.division, item.division))
              && item.classTeacherId && item.classTeacherId !== request.receiverId);
            return <tr key={request.id}>
              <td>{request.sourceYear}: {request.sourceGrade} {request.sourceDivision}<br />{request.targetYear}: {request.targetGrade} {request.targetDivision}</td>
              <td>{request.senderName}<br />{receiverName}</td>
              <td>{request.students.length}: {request.students.map((student) => student.name).join(", ")}</td>
              <td>{request.declineReason || request.decisionReason || request.message || "–"}</td>
              <td><span className="chip plain">{request.status}</span></td>
              <td className="acts">
                {request.senderId === uid && request.status === "Pending" && <button className="linkbtn del" onClick={() => decision(request, "cancel")}>Cancel</button>}
                {request.senderId === uid && request.status === "Declined" && <button className="linkbtn" onClick={() => resend(request)}>Edit and resend</button>}
                {admin && request.status === "Pending" && <>
                  <select aria-label={`Reassign ${request.sourceGrade} ${request.sourceDivision}`} value={request.receiverId} onChange={(event) => {
                    const nextReceiverId = event.target.value;
                    const reason = window.prompt("Reason for reassignment");
                    if (!reason?.trim() || !window.confirm("Reassign this request to the selected receiving teacher?")) return;
                    const nextName = users.find((account) => idOf(account) === nextReceiverId)?.name || nextReceiverId;
                    try {
                      setPromotionRequests(reassignPromotion(promotionRequests, request.id, nextReceiverId, nextName, { ...user, id: uid }, classAssignments, reason));
                    } catch (error) { return toast(error.message, "bad"); }
                    logActivity("promotion", `Promotion request reassigned to ${nextName}: ${reason.trim()}`);
                    notifyUsers([nextReceiverId], "Incoming class promotion request", `${request.senderName} requests transfer of ${request.students.length} student(s).`);
                  }}>
                    <option value={request.receiverId}>{receiverName}</option>
                    {reassignees.map((item) => <option key={item.classTeacherId} value={item.classTeacherId}>{users.find((account) => idOf(account) === item.classTeacherId)?.name || "Teacher"} · {item.division}</option>)}
                  </select>
                  <button className="linkbtn" onClick={() => { const reason = window.prompt("Reason for forcing this transfer"); if (reason?.trim()) decision(request, "force", reason); }}>Force transfer</button>
                </>}
              </td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
    </section>
    {admin && <section className="card"><h3>Retirement age setting</h3><p className="muted">See Teacher details for the retirement date and pension countdown. Confirm the applicable rule against the official circular.</p></section>}
    </>}
  </>;
}
