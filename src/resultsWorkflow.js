import { moduleResult, num, studentGpa, studentTotals, validate } from "./grading.js";

const same = (left, right) => String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
const emptyResults = () => ({ sheets: {}, classes: {}, audit: [], notifications: [] });
const asObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const asArray = (value) => Array.isArray(value) ? value : [];

export const resultClassKey = (year, term, grade, division) =>
  [year, term, grade, division].map((part) => String(part || "").trim().toLowerCase()).join("|");
export const resultSheetKey = (year, term, grade, division, subject) =>
  `${resultClassKey(year, term, grade, division)}|${String(subject || "").trim().toLowerCase()}`;

export function normalizeResults(value) {
  const state = asObject(value);
  const sheets = Object.fromEntries(Object.entries(asObject(state.sheets)).map(([key, sheet]) => [
    key,
    {
      ...asObject(sheet),
      marks: asArray(sheet?.marks).filter((mark) => mark && typeof mark === "object" && !Array.isArray(mark)),
      status: typeof sheet?.status === "string" ? sheet.status : "Draft",
    },
  ]));
  const classes = Object.fromEntries(Object.entries(asObject(state.classes)).filter(([, snapshot]) =>
    snapshot && typeof snapshot === "object" && !Array.isArray(snapshot),
  ));
  return {
    sheets,
    classes,
    audit: asArray(state.audit).filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry)),
    notifications: asArray(state.notifications).filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry)),
  };
}

export function assignmentFor(assignments, year, grade, division) {
  return asArray(assignments).find((assignment) =>
    (!assignment.year || String(assignment.year) === String(year))
      && same(assignment.grade, grade)
      && same(assignment.division, division),
  ) || null;
}

export function teacherScopes(user, assignments, year) {
  if (!user || !user.id) return [];
  return asArray(assignments).filter((assignment) =>
    (!assignment.year || String(assignment.year) === String(year))
      && (assignment.classTeacherId === user.id
        || asArray(assignment.subjects).some((subject) => subject.teacherId === user.id)),
  );
}

const assignmentIsCurrent = (user, assignment, assignments) => {
  if (!Array.isArray(assignments)) return true;
  return assignments.some((candidate) =>
    same(candidate.grade, assignment?.grade)
      && same(candidate.division, assignment?.division)
      && (!candidate.year || !assignment?.year || String(candidate.year) === String(assignment.year))
      && (user.role === "admin" || candidate.classTeacherId === user.id
        || asArray(candidate.subjects).some((item) => item.teacherId === user.id)),
  );
};

export function canEditSubject(user, assignment, subject, state, assignments) {
  if (!user || !assignment || !subject) return false;
  if (user.role === "teacher" && !Array.isArray(assignments)) return false;
  if (!assignmentIsCurrent(user, assignment, assignments)) return false;
  if (user.role === "admin") return state?.status !== "Published";
  if (user.role !== "teacher") return false;
  const assignedSubject = asArray(assignment.subjects).find((item) => same(item.subject, subject));
  if (!assignedSubject || assignedSubject.teacherId !== user.id) return false;
  const status = state?.status || "Draft";
  return status === "Draft" && state?.correctionOpen !== false;
}

export function canReviewClass(user, assignment, assignments) {
  if (user?.role === "teacher" && !Array.isArray(assignments)) return false;
  return !!user && !!assignment && (user.role === "admin"
    || (user.role === "teacher" && assignment.classTeacherId === user.id))
    && assignmentIsCurrent(user, assignment, assignments);
}

export function visibleClassRecordMarks({ role, actorId, year, term, grade, division, assignments, students, results }) {
  if (!["admin", "teacher"].includes(role) || !actorId || !grade || !division) return [];
  const assignment = assignmentFor(assignments, year, grade, division);
  const isClassTeacher = role === "teacher" && assignment?.classTeacherId === actorId;
  if (role === "teacher" && !isClassTeacher && !assignment?.subjects?.some((subject) => subject.teacherId === actorId)) return [];

  const sheets = asObject(normalizeResults(results).sheets);
  const assignedSubjects = asArray(assignment?.subjects)
    .filter((subject) => role === "admin" || isClassTeacher || subject.teacherId === actorId)
    .filter((subject) => String(subject.subject || "").trim());
  const subjects = assignedSubjects.length
    ? assignedSubjects.map((subject) => ({ subject: subject.subject, teacherId: subject.teacherId }))
    : role === "admin"
      ? Object.values(sheets)
        .filter((sheet) => String(sheet.year) === String(year) && same(sheet.term, term)
          && same(sheet.grade, grade) && same(sheet.division, division))
        .map((sheet) => ({ subject: sheet.subject, teacherId: sheet.teacherId }))
      : [];
  const roster = asArray(students).filter((student) => same(student.grade, grade) && same(student.division, division));

  return subjects.flatMap((subject) => {
    const sheet = sheets[resultSheetKey(year, term, grade, division, subject.subject)];
    if ((!sheet && !isClassTeacher) || role === "teacher" && !isClassTeacher && sheet?.teacherId && sheet.teacherId !== actorId) return [];
    return roster.map((student) => {
      const mark = asArray(sheet?.marks).find((item) => same(item.studentId, student.index)) || null;
      const entered = !!mark && (!!mark.absent || num(mark.formative) != null || num(mark.summative) != null || asArray(mark.activities).length > 0);
      return {
        studentId: student.index,
        studentName: student.name,
        subject: subject.subject,
        teacherId: subject.teacherId || sheet.teacherId || "",
        sheetStatus: sheet?.status || "Not entered",
        mark,
        entered,
      };
    }).filter((row) => role !== "teacher" || isClassTeacher || row.entered);
  }).sort((left, right) => left.subject.localeCompare(right.subject) || left.studentName.localeCompare(right.studentName));
}

export function makeSheet(year, term, grade, division, subject, teacherId = "", marks = []) {
  return {
    year: String(year), term: String(term), grade: String(grade), division: String(division),
    subject: String(subject), teacherId, marks: asArray(marks), status: "Draft",
    correctionOpen: true, reviewComment: "", lastAction: "", submittedAt: null, approvedAt: null,
  };
}

export function migrateLegacyMarks(results, store, meta) {
  const state = normalizeResults(results);
  const sheets = { ...state.sheets };
  let changed = false;
  for (const [periodKey, records] of Object.entries(asObject(store))) {
    const [year, term] = periodKey.split("|");
    if (!year || !term || !Array.isArray(records)) continue;
    for (const record of records) {
      if (!record || !String(record.studentId || "").trim()) continue;
      const grade = record.grade || meta?.grade;
      const division = record.division || record.className || meta?.className;
      for (const module of asArray(record.modules)) {
        const subject = String(module?.moduleTitle || module?.moduleId || "").trim();
        if (!subject) continue;
        const key = resultSheetKey(year, term, grade, division, subject);
        const sheet = sheets[key] || makeSheet(year, term, grade, division, subject);
        if (sheet.marks.some((mark) => same(mark.studentId, record.studentId))) continue;
        sheets[key] = {
          ...sheet,
          marks: [...sheet.marks, {
            studentId: String(record.studentId), name: String(record.name || ""),
            formative: module.formative ?? "", summative: module.summative ?? "",
            credit: module.credit ?? 1, absent: !!module.absent,
            absentRemark: String(module.absentRemark || ""),
            activities: asArray(module.activities).map((activity) => ({ ...activity })),
            remark: String(record.remark || ""),
          }],
        };
        changed = true;
      }
    }
  }
  return changed ? { ...state, sheets } : state;
}

export function publishReadiness({ assignment, students, sheets, cfg }) {
  const roster = asArray(students);
  const configuredSubjects = asArray(assignment?.subjects);
  const missingClassTeacher = !assignment?.classTeacherId;
  const missingSubjects = configuredSubjects.filter((item) => !item.teacherId || !String(item.subject || "").trim());
  const missingApprovals = configuredSubjects.filter((item) => {
    const sheet = sheets[resultSheetKey(assignment.year, assignment.term, assignment.grade, assignment.division, item.subject)];
    return sheet?.status !== "Approved";
  });
  const missingMarks = [];
  const validationErrors = [];
  for (const subject of configuredSubjects) {
    const key = resultSheetKey(assignment.year, assignment.term, assignment.grade, assignment.division, subject.subject);
    const sheet = sheets[key];
    const byStudent = new Map(asArray(sheet?.marks).map((mark) => [String(mark.studentId).trim().toLowerCase(), mark]));
    for (const student of roster) {
      const mark = byStudent.get(String(student.index || "").trim().toLowerCase());
      if (!mark || (mark.absent ? !String(mark.absentRemark || "").trim() : num(mark.formative) == null && num(mark.summative) == null)) {
        missingMarks.push(`${student.name} · ${subject.subject}`);
      }
    }
    const rows = asArray(sheet?.marks).map((mark) => ({
      ...mark, moduleTitle: subject.subject,
      moduleId: String(subject.subject).trim().toLowerCase().replace(/\s+/g, "-"),
    }));
    validationErrors.push(...validate(rows, cfg).map((message) => `${subject.subject}: ${message}`));
  }
  const reasons = [];
  if (missingClassTeacher) reasons.push("Assign a class teacher.");
  if (!configuredSubjects.length) reasons.push("Assign at least one subject teacher.");
  if (missingSubjects.length) reasons.push(`Subject assignments missing a teacher or subject: ${missingSubjects.map((item) => item.subject || "Unnamed subject").join(", ")}.`);
  if (missingApprovals.length) reasons.push(`Approve all subjects first: ${missingApprovals.map((item) => item.subject).join(", ")}.`);
  if (missingMarks.length) reasons.push(`Missing marks or absent remarks (${missingMarks.length}): ${missingMarks.join(", ")}.`);
  if (validationErrors.length) reasons.push(...validationErrors);
  return { allowed: reasons.length === 0, reasons, missingMarks, validationErrors };
}

export function makePublishedSnapshot({ assignment, year, term, students, sheets, cfg, gradeOnly, classTeacherName, now = new Date(), version = 1 }) {
  const subjects = asArray(assignment.subjects).map((item) => {
    const sheet = sheets[resultSheetKey(year, term, assignment.grade, assignment.division, item.subject)];
    const marks = asArray(sheet?.marks).map((mark) => ({ ...mark, activities: asArray(mark.activities).map((activity) => ({ ...activity })) }));
    const totals = marks.map((mark) => moduleResult({ ...mark, absent: !!mark.absent }, cfg.scale).total).filter((total) => total != null);
    return {
      subject: item.subject,
      teacherId: item.teacherId,
      marks,
      average: totals.length ? Math.round((totals.reduce((sum, total) => sum + total, 0) / totals.length) * 100) / 100 : 0,
    };
  });
  return {
    year: String(year), term: String(term), grade: assignment.grade, division: assignment.division,
    classTeacherName: classTeacherName || "", publishedAt: now.toISOString(), version,
    published: true, gradeOnly: !!gradeOnly, students: asArray(students).map((student) => ({ index: student.index, name: student.name })),
    subjects, scale: asArray(cfg.scale).map((row) => [...row]),
  };
}

export function publishedResultsForStudent(results, student, assignments, enrollments = []) {
  if (!student?.studentId) return [];
  const state = normalizeResults(results);
  return Object.values(state.classes).filter((snapshot) => {
    const enrolledInSnapshotClass = asArray(enrollments).some((enrollment) => same(enrollment.studentId, student.studentId)
      && String(enrollment.year) === String(snapshot?.year)
      && same(enrollment.grade, snapshot?.grade) && same(enrollment.division, snapshot?.division));
    const currentClass = same(snapshot?.grade, student.grade) && same(snapshot?.division, student.division);
    return snapshot && snapshot.published === true && (currentClass || enrolledInSnapshotClass)
      && asArray(snapshot.students).some((item) => item && same(item.index, student.studentId));
  }
  ).map((snapshot) => {
    const ownSubjects = asArray(snapshot.subjects).filter((subject) => subject && typeof subject === "object" && !Array.isArray(subject)).map((subject) => ({
      ...subject,
      marks: asArray(subject.marks).filter((mark) => mark && typeof mark === "object" && same(mark.studentId, student.studentId)),
    }));
    return {
      ...snapshot,
      students: asArray(snapshot.students).filter((item) => item && same(item.index, student.studentId)),
      subjects: ownSubjects,
      ownMarks: ownSubjects,
    };
  }).sort((a, b) => String(b.year).localeCompare(String(a.year)) || String(b.term).localeCompare(String(a.term)));
}

export function studentResultSummary(snapshot, cfg) {
  const modules = asArray(snapshot?.ownMarks).map((subject) =>
    asArray(subject.marks).map((mark) => ({ ...mark, moduleTitle: subject.subject })),
  ).flat();
  return { totals: studentTotals(modules, cfg.scale), gpa: studentGpa(modules, cfg.scale) };
}

export function makeWorkflowNotification(toUserId, toRole, classId, message, at = Date.now()) {
  return { id: `${at}-${Math.random().toString(36).slice(2, 8)}`, toUserId, toRole, classId, message, at };
}

export function visibleNotifications(results, user, student) {
  const state = normalizeResults(results);
  return state.notifications.filter((notification) => {
    if (notification.toUserId && notification.toUserId === user?.id) return true;
    if (notification.toRole === "admin" && user?.role === "admin") return true;
    if (notification.toRole === "class" && user?.role === "student"
      && same(notification.grade, student?.grade) && same(notification.division, student?.division)) return true;
    return false;
  }).sort((a, b) => b.at - a.at);
}

export function auditResult(results, { actor, action, year, term, grade, division, subject = "", reason = "", at = Date.now() }) {
  const state = normalizeResults(results);
  return {
    ...state,
    audit: [{
      id: `${at}-${Math.random().toString(36).slice(2, 8)}`, actor: actor || "School user", action,
      year: String(year), term: String(term), grade, division, subject, reason, at,
    }, ...state.audit].slice(0, 1000),
  };
}

const notifyClassTeacher = (state, assignment, message, at) => {
  if (!assignment.classTeacherId) return state;
  const notification = makeWorkflowNotification(
    assignment.classTeacherId, "teacher",
    resultClassKey(assignment.year, assignment.term, assignment.grade, assignment.division), message, at,
  );
  return { ...state, notifications: [...state.notifications, notification] };
};

export function updateSubjectMarks(results, { user, assignment, subject, student, patch, year, term, assignments, students }) {
  const state = normalizeResults(results);
  const key = resultSheetKey(year, term, assignment?.grade, assignment?.division, subject);
  const sheet = state.sheets[key] || makeSheet(year, term, assignment?.grade, assignment?.division, subject);
  if (!canEditSubject(user, assignment, subject, sheet, assignments)) throw new Error("You are not allowed to edit marks for this class and subject.");
  assertAssignedStudent(student, assignment, students);
  const existing = sheet.marks.find((mark) => same(mark.studentId, student.index));
  const marks = existing
    ? sheet.marks.map((mark) => same(mark.studentId, student.index) ? { ...mark, ...patch, studentId: student.index, name: student.name } : mark)
    : [...sheet.marks, { studentId: student.index, name: student.name, formative: "", summative: "", credit: 1, absent: false, absentRemark: "", activities: [], ...patch }];
  return { ...state, sheets: { ...state.sheets, [key]: { ...sheet, marks, teacherId: asArray(assignment.subjects).find((item) => same(item.subject, subject))?.teacherId || sheet.teacherId } } };
}

function assertAssignedStudent(student, assignment, students) {
  const isInClass = Array.isArray(students) && students.some((item) =>
    item && same(item.index, student?.index) && same(item.grade, assignment?.grade) && same(item.division, assignment?.division),
  );
  if (!student?.index || !same(student.grade, assignment?.grade) || !same(student.division, assignment?.division) || !isInClass) {
    throw new Error("This student is not in the assigned class.");
  }
}

export function removeSubjectMark(results, { user, assignment, subject, student, year, term, assignments, students }) {
  const state = normalizeResults(results);
  const key = resultSheetKey(year, term, assignment?.grade, assignment?.division, subject);
  const sheet = state.sheets[key] || makeSheet(year, term, assignment?.grade, assignment?.division, subject);
  if (!canEditSubject(user, assignment, subject, sheet, assignments)) throw new Error("You are not allowed to edit marks for this class and subject.");
  assertAssignedStudent(student, assignment, students);
  if (!sheet.marks.some((mark) => same(mark.studentId, student.index))) return state;
  return {
    ...state,
    sheets: {
      ...state.sheets,
      [key]: { ...sheet, marks: sheet.marks.filter((mark) => !same(mark.studentId, student.index)) },
    },
  };
}

export function submitSubject(results, { user, assignment, subject, year, term, assignments, at = Date.now() }) {
  const state = normalizeResults(results);
  const key = resultSheetKey(year, term, assignment.grade, assignment.division, subject);
  const sheet = state.sheets[key] || makeSheet(year, term, assignment.grade, assignment.division, subject);
  if (!canEditSubject(user, assignment, subject, sheet, assignments)) throw new Error("This subject is not assigned to you or is locked.");
  const submitted = { ...sheet, status: "Submitted", correctionOpen: false, submittedAt: new Date(at).toISOString(), lastAction: "Submitted" };
  const next = { ...state, sheets: { ...state.sheets, [key]: submitted } };
  const notified = notifyClassTeacher(next, { ...assignment, year, term }, `${subject} marks submitted for ${assignment.grade} ${assignment.division}.`, at);
  return auditResult(notified, { actor: user.name, action: "Submitted", year, term, grade: assignment.grade, division: assignment.division, subject, at });
}

export function reviewSubject(results, { user, assignment, subject, year, term, decision, comment = "", assignments, at = Date.now() }) {
  if (!canReviewClass(user, assignment, assignments)) throw new Error("Only the class teacher or admin can review this class.");
  const state = normalizeResults(results);
  const key = resultSheetKey(year, term, assignment.grade, assignment.division, subject);
  const sheet = state.sheets[key];
  if (!sheet || sheet.status !== "Submitted") throw new Error("Only submitted subjects can be reviewed.");
  if (decision !== "approve" && decision !== "changes") throw new Error("Choose approve or request changes.");
  if (decision === "changes" && !comment.trim()) throw new Error("Enter a comment when requesting changes.");
  const nextSheet = decision === "approve"
    ? { ...sheet, status: "Approved", correctionOpen: false, approvedAt: new Date(at).toISOString(), reviewComment: "", lastAction: "Approved" }
    : { ...sheet, status: "Draft", correctionOpen: true, approvedAt: null, reviewComment: comment.trim(), lastAction: "Changes requested" };
  let next = { ...state, sheets: { ...state.sheets, [key]: nextSheet } };
  const subjectAssignment = asArray(assignment.subjects).find((item) => same(item.subject, subject));
  if (decision === "changes" && subjectAssignment?.teacherId) {
    next = {
      ...next,
      notifications: [...next.notifications, makeWorkflowNotification(subjectAssignment.teacherId, "teacher",
        resultClassKey(year, term, assignment.grade, assignment.division), `Changes requested for ${subject}: ${comment.trim()}`, at)],
    };
  }
  if (decision === "approve") {
    const allApproved = asArray(assignment.subjects).every((item) => {
      const current = item.subject === subject ? nextSheet : next.sheets[resultSheetKey(year, term, assignment.grade, assignment.division, item.subject)];
      return current?.status === "Approved";
    });
    if (allApproved) next = notifyClassTeacher(next, { ...assignment, year, term }, `All subjects are approved for ${assignment.grade} ${assignment.division}. Results are ready to publish.`, at);
  }
  return auditResult(next, { actor: user.name, action: decision === "approve" ? "Approved" : "Changes requested", year, term, grade: assignment.grade, division: assignment.division, subject, reason: comment.trim(), at });
}

export function publishClass(results, { user, assignment, year, term, students, cfg, gradeOnly, classTeacherName, assignments, at = new Date() }) {
  if (!canReviewClass(user, assignment, assignments)) throw new Error("Only the class teacher or admin can publish this class.");
  const state = normalizeResults(results);
  const readiness = publishReadiness({
    assignment: { ...assignment, year, term },
    students,
    sheets: state.sheets,
    cfg,
  });
  if (!readiness.allowed) throw new Error(readiness.reasons.join("\n"));
  const key = resultClassKey(year, term, assignment.grade, assignment.division);
  const version = (Number(state.classes[key]?.version) || 0) + 1;
  const publishedAt = at instanceof Date ? at : new Date(at);
  const timestamp = publishedAt.getTime();
  const snapshot = makePublishedSnapshot({ assignment, year, term, students, sheets: state.sheets, cfg, gradeOnly, classTeacherName, now: publishedAt, version });
  const sheets = { ...state.sheets };
  for (const subject of assignment.subjects) {
    const subjectKey = resultSheetKey(year, term, assignment.grade, assignment.division, subject.subject);
    sheets[subjectKey] = { ...sheets[subjectKey], status: "Published", correctionOpen: false, publishedAt: snapshot.publishedAt };
  }
  let next = { ...state, sheets, classes: { ...state.classes, [key]: snapshot } };
  const recipients = asArray(students).map((student) => makeWorkflowNotification(
    String(student.index), "student", key,
    `Results published for ${assignment.grade} ${assignment.division} · ${term} ${year}.`,
    timestamp,
  ));
  next = { ...next, notifications: [...next.notifications, ...recipients] };
  next = notifyClassTeacher(next, { ...assignment, year, term }, `Results published for ${assignment.grade} ${assignment.division} · ${term} ${year}.`, timestamp);
  next = { ...next, notifications: [...next.notifications, makeWorkflowNotification("", "admin", key, `Results published for ${assignment.grade} ${assignment.division} · ${term} ${year}.`, timestamp)] };
  return auditResult(next, { actor: user.name, action: "Published", year, term, grade: assignment.grade, division: assignment.division, reason: `Version ${version}`, at: timestamp });
}

export function unpublishClass(results, { user, assignment, year, term, reason, assignments, at = Date.now() }) {
  if (!canReviewClass(user, assignment, assignments)) throw new Error("Only the class teacher or admin can correct this class.");
  if (!String(reason || "").trim()) throw new Error("Enter a reason before unpublishing results.");
  const state = normalizeResults(results);
  const key = resultClassKey(year, term, assignment.grade, assignment.division);
  const snapshot = state.classes[key];
  if (!snapshot?.published) throw new Error("This class does not have published results.");
  const sheets = { ...state.sheets };
  for (const subject of asArray(assignment.subjects)) {
    const subjectKey = resultSheetKey(year, term, assignment.grade, assignment.division, subject.subject);
    if (sheets[subjectKey]) sheets[subjectKey] = { ...sheets[subjectKey], status: "Draft", correctionOpen: true, reviewComment: reason.trim(), lastAction: "Unpublished for correction" };
  }
  const classes = { ...state.classes, [key]: { ...snapshot, published: false, correctionReason: reason.trim(), correctionAt: new Date(at).toISOString() } };
  return auditResult({ ...state, sheets, classes }, { actor: user.name, action: "Unpublished", year, term, grade: assignment.grade, division: assignment.division, reason: reason.trim(), at });
}

export function getSubjectResult(results, year, term, grade, division, subject) {
  return normalizeResults(results).sheets[resultSheetKey(year, term, grade, division, subject)] || null;
}

export function classSubjectsStatus(results, assignment, year, term) {
  const state = normalizeResults(results);
  return asArray(assignment?.subjects).map((subject) => ({
    ...subject,
    sheet: state.sheets[resultSheetKey(year, term, assignment.grade, assignment.division, subject.subject)]
      || makeSheet(year, term, assignment.grade, assignment.division, subject.subject, subject.teacherId),
  }));
}

export function resultNotificationCount(results, user, student) {
  return visibleNotifications(results, user, student).length;
}
