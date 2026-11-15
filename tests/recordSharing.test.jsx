import { describe, expect, it } from "vitest";
import { attendanceEntries, canViewSharedStudent, classTeacherName, createRecordShare, revokeRecordShare } from "../src/recordSharing.js";
import { visiblePublishedHistory } from "../src/promotions.js";

const assignments = [{ year: "2026", grade: "Grade 6", division: "A", classTeacherId: "old-teacher" }];
const students = [
  { index: "1001", name: "Kumar", grade: "Grade 6", division: "A" },
  { index: "1002", name: "Nisha", grade: "Grade 6", division: "A" },
];
const snapshot = {
  year: "2026", term: "Term 1", grade: "Grade 6", division: "A", published: true,
  students: [{ index: "1001", name: "Kumar" }, { index: "1002", name: "Nisha" }],
  subjects: [{ subject: "Mathematics", marks: [
    { studentId: "1001", formative: 40, summative: 50 },
    { studentId: "1002", formative: 20, summative: 30 },
  ] }],
};

describe("teacher-to-teacher record sharing", () => {
  it("allows only the assigned class teacher to share selected students with the chosen teacher", () => {
    expect(() => createRecordShare([], {
      actorId: "unassigned", receiverId: "next-teacher", sourceYear: "2026",
      grade: "Grade 6", division: "A", studentIds: ["1001"],
    }, assignments, students)).toThrow(/assigned class teacher/);
    expect(() => createRecordShare([], {
      actorId: "old-teacher", receiverId: "next-teacher", sourceYear: "2026",
      grade: "Grade 6", division: "A", studentIds: ["9999"],
    }, assignments, students)).toThrow(/not in this class/);
  });

  it("limits published read-only history to selected students and the specified source class", () => {
    const shares = createRecordShare([], {
      actorId: "old-teacher", receiverId: "next-teacher", sourceYear: "2026",
      grade: "Grade 6", division: "A", studentIds: ["1001"],
      attendance: { "2026-03-01": { "1001": { status: "Present" }, "1002": { status: "Absent" } }, "2025-12-01": { "1001": { status: "Late" } } },
    }, assignments, students, 1);
    const enrollments = students.map((student) => ({ studentId: student.index, year: "2026", grade: "Grade 6", division: "A" }));
    const args = { role: "teacher", actorId: "next-teacher", snapshots: [snapshot], assignments, enrollments, requests: [], recordShares: shares, currentYear: "2027" };
    const allowed = visiblePublishedHistory({ ...args, studentId: "1001" });
    expect(allowed).toHaveLength(1);
    expect(allowed[0]).toMatchObject({ readOnly: true, subjects: [{ subject: "Mathematics", marks: [{ studentId: "1001" }] }] });
    expect(visiblePublishedHistory({ ...args, studentId: "1002" })).toEqual([]);
    expect(visiblePublishedHistory({ ...args, actorId: "other-teacher", studentId: "1001" })).toEqual([]);
    expect(canViewSharedStudent(shares, "next-teacher", "1001", snapshot)).toBe(true);
    expect(canViewSharedStudent(shares, "next-teacher", "1001", { ...snapshot, division: "B" })).toBe(false);
    expect(classTeacherName(assignments, [{ username: "old-teacher", name: "Old Teacher" }], "2026", "Grade 6", "A")).toBe("Old Teacher");
    expect(attendanceEntries(shares[0].attendance, "1001", "2026")).toEqual([{ date: "2026-03-01", status: "Present" }]);
  });

  it("revokes the grant and blocks changes by an unrelated teacher", () => {
    const shares = createRecordShare([], {
      actorId: "old-teacher", receiverId: "next-teacher", sourceYear: "2026",
      grade: "Grade 6", division: "A", studentIds: ["1001"],
    }, assignments, students, 1);
    expect(() => revokeRecordShare(shares, shares[0].id, "other-teacher")).toThrow(/sharing class teacher/);
    const revoked = revokeRecordShare(shares, shares[0].id, "old-teacher");
    expect(canViewSharedStudent(revoked, "next-teacher", "1001", snapshot)).toBe(false);
  });
});
