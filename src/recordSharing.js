import { idOf } from "./auth.js";

const same = (left, right) => String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();

export function createRecordShare(shares, {
  actorId,
  receiverId,
  sourceYear,
  grade,
  division,
  studentIds,
  attendance = {},
}, assignments, students, now = Date.now()) {
  if (!actorId || !receiverId || same(actorId, receiverId)) throw new Error("Choose another teacher to share these records with.");
  const source = (assignments || []).find((item) => String(item.year) === String(sourceYear)
    && same(item.grade, grade) && same(item.division, division) && same(item.classTeacherId, actorId));
  if (!source) throw new Error("Only the assigned class teacher can share this class's records.");
  const selectedIds = [...new Set((studentIds || []).map((id) => String(id).trim()).filter(Boolean))];
  if (!selectedIds.length) throw new Error("Select at least one student.");
  const rosterIds = new Set((students || []).filter((student) => same(student.grade, grade) && same(student.division, division))
    .map((student) => String(student.index).trim().toLowerCase()));
  if (selectedIds.some((id) => !rosterIds.has(id.toLowerCase()))) throw new Error("The selected students are not in this class.");
  return [...(Array.isArray(shares) ? shares : []), {
    id: `record-share-${now}-${Math.random().toString(36).slice(2, 8)}`,
    senderId: actorId,
    receiverId,
    sourceYear: String(sourceYear),
    sourceGrade: source.grade,
    sourceDivision: source.division,
    studentIds: selectedIds,
    attendance: Object.fromEntries(Object.entries(attendance || {})
      .map(([date, marks]) => [date, Object.fromEntries(Object.entries(marks || {}).filter(([studentId]) => selectedIds.some((id) => same(id, studentId))))])
      .filter(([, marks]) => Object.keys(marks).length)),
    status: "Shared",
    createdAt: now,
  }];
}

export function canViewSharedStudent(shares, actorId, studentId, snapshot) {
  return (shares || []).some((share) => share?.status === "Shared"
    && same(share.receiverId, actorId)
    && String(share.sourceYear) === String(snapshot?.year)
    && same(share.sourceGrade, snapshot?.grade)
    && same(share.sourceDivision, snapshot?.division)
    && (share.studentIds || []).some((id) => same(id, studentId)));
}

export function revokeRecordShare(shares, shareId, actorId, role = "teacher") {
  const share = (shares || []).find((item) => item.id === shareId);
  if (!share) throw new Error("This shared record grant no longer exists.");
  if (role !== "admin" && !same(share.senderId, actorId)) throw new Error("Only the sharing class teacher or an administrator can revoke this access.");
  return (shares || []).map((item) => item.id === shareId ? { ...item, status: "Revoked", revokedAt: Date.now() } : item);
}

export function sharedStudentsForTeacher(shares, actorId, students) {
  const ids = new Set((shares || []).filter((share) => share?.status === "Shared" && same(share.receiverId, actorId))
    .flatMap((share) => share.studentIds || []).map((id) => String(id).toLowerCase()));
  return (students || []).filter((student) => ids.has(String(student.index).toLowerCase()));
}

export function attendanceTotals(attendance, studentId, year) {
  const totals = { Present: 0, Absent: 0, Late: 0, Excused: 0 };
  Object.entries(attendance || {}).filter(([date]) => !year || date.startsWith(String(year))).forEach(([, marks]) => {
    const status = marks?.[studentId]?.status;
    if (Object.hasOwn(totals, status)) totals[status] += 1;
  });
  return totals;
}

export function attendanceEntries(attendance, studentId, year) {
  return Object.entries(attendance || {}).filter(([date]) => !year || date.startsWith(String(year)))
    .map(([date, marks]) => ({ date, status: marks?.[studentId]?.status }))
    .filter((entry) => entry.status)
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function classTeacherName(assignments, accounts, year, grade, division) {
  const assignment = (assignments || []).find((item) => String(item.year) === String(year)
    && same(item.grade, grade) && same(item.division, division) && item.classTeacherId);
  return assignment ? (accounts || []).find((account) => idOf(account) === assignment.classTeacherId)?.name || "Assigned teacher" : "Not assigned";
}
