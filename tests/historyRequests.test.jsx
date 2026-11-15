import { describe, expect, it } from "vitest";
import { decideHistoryRequest, requestPreviousClassData } from "../src/historyRequests.js";
import { visiblePublishedHistory } from "../src/promotions.js";

const assignments = [
  { year: "2026", grade: "Grade 6", division: "A", classTeacherId: "old-teacher" },
  { year: "2027", grade: "Grade 7", division: "B", classTeacherId: "new-teacher" },
];
const students = [
  { index: "1", name: "Asha", grade: "Grade 7", division: "B" },
  { index: "2", name: "Kavi", grade: "Grade 7", division: "B" },
];
const enrollments = [
  { studentId: "1", year: "2026", grade: "Grade 6", division: "A" },
  { studentId: "1", year: "2027", grade: "Grade 7", division: "B" },
  { studentId: "2", year: "2027", grade: "Grade 7", division: "B" },
];
const input = {
  receiverId: "old-teacher", receiverName: "Old Teacher",
  sourceYear: "2026", sourceGrade: "Grade 6", sourceDivision: "A",
  targetYear: "2027", targetGrade: "Grade 7", targetDivision: "B",
  students: [{ studentId: "1", name: "Asha" }],
  message: "Please share published records.",
};

describe("previous class data requests", () => {
  it("allows the current teacher to request an enrolled student's old class data", () => {
    const requests = requestPreviousClassData([], input, { role: "teacher", id: "new-teacher", name: "New Teacher" }, assignments, enrollments, students, 100);
    expect(requests[0]).toMatchObject({ status: "Pending", senderId: "new-teacher", receiverId: "old-teacher", students: input.students });
    expect(() => requestPreviousClassData([], { ...input, students: [{ studentId: "2", name: "Kavi" }] },
      { role: "teacher", id: "new-teacher" }, assignments, enrollments, students)).toThrow(/previous class/);
  });

  it("limits response to the old class teacher and requires a decline reason", () => {
    const pending = requestPreviousClassData([], input, { role: "teacher", id: "new-teacher" }, assignments, enrollments, students);
    expect(() => decideHistoryRequest(pending, pending[0].id, "accept", { role: "teacher", id: "stranger" }, "", 101, assignments))
      .toThrow(/Only the previous class teacher/);
    expect(() => decideHistoryRequest(pending, pending[0].id, "decline", { role: "teacher", id: "old-teacher" }, "", 101, assignments))
      .toThrow(/reason is required/);
  });

  it("exposes only accepted students' published marks, activities and GPA to their current class teacher", () => {
    const pending = requestPreviousClassData([], input, { role: "teacher", id: "new-teacher", name: "New Teacher" }, assignments, enrollments, students);
    const accepted = decideHistoryRequest(pending, pending[0].id, "accept", { role: "teacher", id: "old-teacher" }, "", 101, assignments);
    const snapshot = {
      year: "2026", term: "Term 1", grade: "Grade 6", division: "A", published: true,
      students: [{ index: "1", name: "Asha" }, { index: "2", name: "Kavi" }],
      scale: [],
      subjects: [{ subject: "Math", marks: [
        { studentId: "1", formative: 40, summative: 50, activities: [{ name: "Quiz", score: 8, max: 10 }] },
        { studentId: "2", formative: 20, summative: 30, activities: [{ name: "Quiz", score: 4, max: 10 }] },
      ] }],
    };
    const history = (actorId, studentId) => visiblePublishedHistory({
      role: "teacher", actorId, studentId, snapshots: [snapshot], assignments, enrollments,
      requests: [], historyRequests: accepted, currentYear: "2027",
    });
    expect(history("new-teacher", "1")).toHaveLength(1);
    expect(history("new-teacher", "1")[0].subjects[0].marks).toEqual([snapshot.subjects[0].marks[0]]);
    expect(history("new-teacher", "1")[0].readOnly).toBe(true);
    expect(history("new-teacher", "2")).toEqual([]);
    expect(history("other-teacher", "1")).toEqual([]);
  });

  it("does not grant history access while the request is pending", () => {
    const pending = requestPreviousClassData([], input, { role: "teacher", id: "new-teacher" }, assignments, enrollments, students);
    const snapshot = { year: "2026", grade: "Grade 6", division: "A", published: true, students: [{ index: "1" }], subjects: [] };
    expect(visiblePublishedHistory({
      role: "teacher", actorId: "new-teacher", studentId: "1", snapshots: [snapshot], assignments, enrollments,
      requests: [], historyRequests: pending, currentYear: "2027",
    })).toEqual([]);
  });
});
