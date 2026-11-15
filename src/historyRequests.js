import { uid } from "./defaults.js";

const same = (left, right) => String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();

export function requestPreviousClassData(requests, input, actor, assignments, enrollments, students, now = Date.now()) {
  if (actor?.role !== "teacher") throw new Error("Only a teacher can request previous class data.");
  if (!input?.students?.length) throw new Error("Select at least one student.");
  if (String(input.sourceYear) >= String(input.targetYear)) throw new Error("Previous class data must be from an earlier academic year.");
  if (input.receiverId === actor.id) throw new Error("You cannot request data from yourself.");
  const receiverAssigned = (assignments || []).some((item) => String(item.year) === String(input.sourceYear)
    && same(item.grade, input.sourceGrade) && same(item.division, input.sourceDivision)
    && item.classTeacherId === input.receiverId);
  if (!receiverAssigned) throw new Error("The previous class teacher is no longer assigned to that class.");
  const senderAssigned = (assignments || []).some((item) => String(item.year) === String(input.targetYear)
    && same(item.grade, input.targetGrade) && same(item.division, input.targetDivision)
    && item.classTeacherId === actor.id);
  if (!senderAssigned) throw new Error("Only the current class teacher can request this class's history.");
  const validStudents = input.students.every((student) =>
    (students || []).some((item) => same(item.index, student.studentId)
      && same(item.grade, input.targetGrade) && same(item.division, input.targetDivision))
    && (enrollments || []).some((item) => same(item.studentId, student.studentId)
      && String(item.year) === String(input.sourceYear)
      && same(item.grade, input.sourceGrade) && same(item.division, input.sourceDivision)));
  if (!validStudents) throw new Error("Every selected student must belong to both the current class and the requested previous class.");
  if (new Set(input.students.map((item) => String(item.studentId).trim().toLowerCase())).size !== input.students.length) {
    throw new Error("A student can appear only once in a data request.");
  }
  const alreadyRequested = (requests || []).some((request) => ["Pending", "Accepted"].includes(request.status)
    && request.receiverId === input.receiverId
    && String(request.targetYear) === String(input.targetYear)
    && request.students.some((student) => input.students.some((selected) => same(student.studentId, selected.studentId))));
  if (alreadyRequested) throw new Error("A pending or accepted data request already covers one or more selected students.");
  const request = {
    ...input,
    id: uid(),
    senderId: actor.id,
    senderName: actor.name,
    status: "Pending",
    createdAt: now,
    updatedAt: now,
    declineReason: "",
  };
  return [...(requests || []), request];
}

export function decideHistoryRequest(requests, requestId, action, actor, reason = "", now = Date.now(), assignments) {
  const request = (requests || []).find((item) => item.id === requestId);
  if (!request || request.status !== "Pending") throw new Error("This data request is no longer pending.");
  const admin = actor?.role === "admin";
  if ((action === "accept" || action === "decline") && !admin
    && (actor?.role !== "teacher" || actor.id !== request.receiverId)) {
    throw new Error("Only the previous class teacher can respond to this data request.");
  }
  if (action === "cancel" && (actor?.role !== "teacher" || actor.id !== request.senderId)) {
    throw new Error("Only the requesting teacher can cancel this data request.");
  }
  if (action === "decline" && !String(reason).trim()) throw new Error("A reason is required.");
  if (action === "accept" && Array.isArray(assignments) && !assignments.some((item) =>
    String(item.year) === String(request.sourceYear) && same(item.grade, request.sourceGrade)
    && same(item.division, request.sourceDivision) && item.classTeacherId === request.receiverId)) {
    throw new Error("You are no longer assigned to the previous class.");
  }
  if (action === "accept" && Array.isArray(assignments) && !assignments.some((item) =>
    String(item.year) === String(request.targetYear) && same(item.grade, request.targetGrade)
    && same(item.division, request.targetDivision) && item.classTeacherId === request.senderId)) {
    throw new Error("The requesting teacher is no longer assigned to the current class.");
  }
  if (!["accept", "decline", "cancel"].includes(action)) throw new Error("Unsupported data request action.");
  const status = action === "accept" ? "Accepted" : action === "decline" ? "Declined" : "Cancelled";
  return (requests || []).map((item) => item.id === requestId ? {
    ...item,
    status,
    declineReason: action === "decline" ? String(reason).trim() : "",
    decisionReason: String(reason).trim(),
    decidedBy: actor?.id || "",
    updatedAt: now,
  } : item);
}

export function canViewRequestedHistory(requests, teacherId, studentId, snapshot, currentEnrollment, currentAssignment) {
  if (!currentEnrollment || currentAssignment?.classTeacherId !== teacherId) return false;
  return (requests || []).some((request) => request.status === "Accepted"
    && request.senderId === teacherId
    && String(request.targetYear) === String(currentEnrollment.year)
    && same(request.targetGrade, currentEnrollment.grade)
    && same(request.targetDivision, currentEnrollment.division)
    && String(request.sourceYear) === String(snapshot?.year)
    && same(request.sourceGrade, snapshot?.grade)
    && same(request.sourceDivision, snapshot?.division)
    && request.students.some((student) => same(student.studentId, studentId)));
}
