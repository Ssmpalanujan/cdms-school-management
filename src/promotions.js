import { uid } from "./defaults.js";
import { canViewRequestedHistory } from "./historyRequests.js";

const same = (left, right) => String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
const ACTIVE = new Set(["Pending"]);

export function sendPromotionRequest(requests, input, actor, assignments, now = Date.now(), roster, academicYears) {
  if (actor?.role !== "teacher") throw new Error("Only a teacher can send a promotion request.");
  if (!input?.students?.length) throw new Error("Select at least one student.");
  if (input.students.some((student) => !student.studentId || !student.division)) throw new Error("Every selected student needs a target division.");
  if (new Set(input.students.map((student) => String(student.studentId).toLowerCase())).size !== input.students.length) throw new Error("A student can appear only once in a promotion request.");
  if (Array.isArray(roster) && input.students.some((selected) => !roster.some((student) => same(student.index, selected.studentId)
    && same(student.grade, input.sourceGrade) && same(student.division, input.sourceDivision)))) {
    throw new Error("Every selected student must belong to your current class.");
  }
  if (Array.isArray(academicYears) && !academicYears.some((item) => String(item.year) === String(input.targetYear) && !item.closed)) {
    throw new Error("The administrator must create an open target academic year first.");
  }
  if (Number(input.targetYear) <= Number(input.sourceYear)) throw new Error("The target year must be later than the source year.");
  const senderAssigned = (assignments || []).some((item) => String(item.year) === String(input.sourceYear)
    && same(item.grade, input.sourceGrade) && same(item.division, input.sourceDivision)
    && item.classTeacherId === actor.id);
  if (!senderAssigned) throw new Error("Only the current class teacher can promote this class.");
  const active = (requests || []).find((request) => ACTIVE.has(request.status)
    && request.students.some((student) => input.students.some((selected) => same(student.studentId, selected.studentId))));
  if (active) throw new Error("A selected student already has an active promotion request.");
  const receiverAssigned = input.students.every((student) => (assignments || []).some((item) => String(item.year) === String(input.targetYear)
    && same(item.grade, input.targetGrade) && same(item.division, student.division)
    && item.classTeacherId === input.receiverId));
  if (!receiverAssigned) throw new Error("The receiving teacher must be assigned to every selected target class for that year.");
  const request = { ...input, id: uid(), senderId: actor.id, senderName: actor.name, status: "Pending", createdAt: now, updatedAt: now, declineReason: "" };
  return [...(requests || []), request];
}

export function decidePromotion(requests, requestId, action, actor, reason = "", now = Date.now(), assignments, students, academicYears) {
  const request = (requests || []).find((item) => item.id === requestId);
  if (!request || request.status !== "Pending") throw new Error("This request is no longer pending.");
  const isAdmin = actor?.role === "admin";
  if (action === "accept" && !isAdmin && (actor?.role !== "teacher" || actor.id !== request.receiverId)) throw new Error("Only the receiving class teacher or an admin can accept this request.");
  if (action === "decline" && !isAdmin && (actor?.role !== "teacher" || actor.id !== request.receiverId)) throw new Error("Only the receiving class teacher or an admin can decline this request.");
  if (action === "cancel" && (actor?.role !== "teacher" || actor.id !== request.senderId)) throw new Error("Only the sending teacher can cancel this request.");
  if (action === "force" && !isAdmin) throw new Error("Only an admin can force a transfer.");
  if ((action === "decline" || action === "force") && !String(reason).trim()) throw new Error("A reason is required.");
  if ((action === "accept" || action === "force") && Array.isArray(students) && !request.students.every((student) => students.some((item) => same(item.index, student.studentId)))) {
    throw new Error("A student in this request is no longer in the school roster.");
  }
  if ((action === "accept" || action === "force") && Array.isArray(academicYears)
    && !academicYears.some((item) => String(item.year) === String(request.targetYear) && !item.closed)) {
    throw new Error("The target academic year must still be open.");
  }
  if (action === "accept" && Array.isArray(assignments) && !request.students.every((student) => assignments.some((item) =>
    String(item.year) === String(request.targetYear) && same(item.grade, request.targetGrade)
      && same(item.division, student.division) && item.classTeacherId === request.receiverId))) {
    throw new Error("The receiving teacher is no longer assigned to every target class.");
  }
  const status = action === "accept" || action === "force" ? "Accepted" : action === "decline" ? "Declined" : "Cancelled";
  return (requests || []).map((item) => item.id === requestId ? { ...item, status, declineReason: action === "decline" ? String(reason).trim() : "", updatedAt: now, decidedBy: actor.id, decisionReason: String(reason).trim() } : item);
}

export function reassignPromotion(requests, requestId, receiverId, receiverName, actor, assignments, reason, now = Date.now()) {
  if (actor?.role !== "admin") throw new Error("Only an administrator can reassign a promotion request.");
  const request = (requests || []).find((item) => item.id === requestId);
  if (!request || request.status !== "Pending") throw new Error("Only pending requests can be reassigned.");
  if (!String(reason || "").trim()) throw new Error("A reason is required.");
  const assigned = request.students.every((student) => (assignments || []).some((item) => String(item.year) === String(request.targetYear)
    && same(item.grade, request.targetGrade) && same(item.division, student.division) && item.classTeacherId === receiverId));
  if (!assigned) throw new Error("The new receiving teacher must be assigned to every target class.");
  return (requests || []).map((item) => item.id === requestId ? {
    ...item, receiverId, receiverName, reassignmentReason: String(reason).trim(), updatedAt: now,
  } : item);
}

export function applyAcceptedPromotion(enrollments, students, request) {
  if (!request || request.status !== "Accepted") throw new Error("Only accepted requests can create enrollments.");
  const nextEnrollments = [...(enrollments || [])];
  const nextStudents = (students || []).map((student) => {
    const move = request.students.find((item) => same(item.studentId, student.index));
    if (!move) return student;
    const enrollment = { studentId: String(student.index), year: String(request.targetYear), grade: request.targetGrade, division: move.division, classTeacherId: request.receiverId };
    const existingIndex = nextEnrollments.findIndex((item) => same(item.studentId, student.index) && String(item.year) === String(request.targetYear));
    if (existingIndex >= 0) nextEnrollments[existingIndex] = enrollment;
    else nextEnrollments.push(enrollment);
    return { ...student, grade: request.targetGrade, division: move.division };
  });
  return { enrollments: nextEnrollments, students: nextStudents };
}

export function acceptedHistoryStudentIds(requests, teacherId, currentClass, currentYear) {
  const ids = new Set();
  (requests || []).filter((request) => request.status === "Accepted"
    && ((request.receiverId === teacherId && String(request.targetYear) === String(currentYear)
      && same(request.targetGrade, currentClass.grade) && request.students.some((student) => same(student.division, currentClass.division)))
      || (request.senderId === teacherId && String(request.sourceYear) === String(currentYear)
        && same(request.sourceGrade, currentClass.grade) && same(request.sourceDivision, currentClass.division))))
    .forEach((request) => request.students.forEach((student) => ids.add(String(student.studentId).toLowerCase())));
  return ids;
}

import { canViewSharedStudent } from "./recordSharing.js";

export function visibleStudentHistory({ role, actorId, studentId, year, records, currentClass, enrollments, requests, currentYear }) {
  const id = String(studentId).toLowerCase();
  const owned = role === "student" && same(actorId, studentId);
  const admin = role === "admin";
  const teacherHasStudent = role === "teacher" && acceptedHistoryStudentIds(requests, actorId, currentClass || {}, currentYear).has(id)
    && (enrollments || []).some((item) => same(item.studentId, studentId) && String(item.year) === String(currentYear)
      && same(item.grade, currentClass?.grade) && same(item.division, currentClass?.division));
  if (!owned && !admin && !teacherHasStudent) return [];
  return (records || []).filter((record) => same(record.studentId, studentId)).map((record) => ({ ...record, year, readOnly: true }));
}

export function visiblePublishedHistory({ role, actorId, studentId, snapshots, assignments, enrollments, requests, historyRequests = [], recordShares = [], currentYear }) {
  const studentKey = String(studentId).toLowerCase();
  return (snapshots || []).filter((snapshot) => snapshot?.published === true
    && snapshot.students?.some((student) => same(student.index, studentId)))
    .map((snapshot) => {
      const historicalEnrollment = (enrollments || []).find((item) => same(item.studentId, studentId)
        && String(item.year) === String(snapshot.year)
        && same(item.grade, snapshot.grade) && same(item.division, snapshot.division));
      const currentEnrollment = (enrollments || []).find((item) => same(item.studentId, studentId) && String(item.year) === String(currentYear));
      const currentAssignment = currentEnrollment && (assignments || []).find((item) => String(item.year) === String(currentYear)
        && same(item.grade, currentEnrollment.grade) && same(item.division, currentEnrollment.division));
      const historicalAssignment = (assignments || []).find((item) => String(item.year) === String(snapshot.year)
        && same(item.grade, snapshot.grade) && same(item.division, snapshot.division));
      const classTeacher = historicalAssignment?.classTeacherId === actorId;
      const currentClassTeacher = currentAssignment?.classTeacherId === actorId;
      const subjectAccess = (currentAssignment?.subjects || []).filter((subject) => subject.teacherId === actorId).map((subject) => subject.subject);
      const accepted = currentEnrollment && acceptedHistoryStudentIds(requests, currentAssignment?.classTeacherId, currentEnrollment, currentYear).has(studentKey);
      const requestedHistory = role === "teacher" && canViewRequestedHistory(
        historyRequests, actorId, studentId, snapshot, currentEnrollment, currentAssignment,
      );
      const sharedHistory = role === "teacher" && canViewSharedStudent(recordShares, actorId, studentId, snapshot);
      const allowed = role === "admin"
        || role === "student" && same(actorId, studentId)
        || role === "teacher" && historicalEnrollment && (classTeacher || requestedHistory || accepted && (currentClassTeacher || subjectAccess.length) || sharedHistory);
      if (!allowed) return null;
      const subjects = (snapshot.subjects || []).filter((subject) => classTeacher || currentClassTeacher || sharedHistory || !subjectAccess.length || subjectAccess.some((name) => same(name, subject.subject)))
        .map((subject) => ({ ...subject, marks: (subject.marks || []).filter((mark) => same(mark.studentId, studentId)) }));
      return { ...snapshot, subjects, readOnly: true };
    }).filter(Boolean);
}


export function expiredPromotionRequests(requests, days, now = Date.now()) {
  const maxAge = Math.max(1, Number(days) || 30) * 86400000;
  return (requests || []).map((request) => request.status === "Pending" && Number.isFinite(Number(request.createdAt)) && now - request.createdAt > maxAge
    ? { ...request, status: "Expired", updatedAt: now } : request);
}
