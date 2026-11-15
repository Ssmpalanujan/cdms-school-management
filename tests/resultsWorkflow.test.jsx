import { describe, expect, it } from "vitest";
import {
  canEditSubject,
  makeSheet,
  migrateLegacyMarks,
  publishClass,
  publishReadiness,
  publishedResultsForStudent,
  removeSubjectMark,
  resultSheetKey,
  reviewSubject,
  submitSubject,
  unpublishClass,
  updateSubjectMarks,
  visibleClassRecordMarks,
} from "../src/resultsWorkflow.js";
import { DEFAULT_SCALE } from "../src/grading.js";
import { buildClassResultsHtml, buildStudentResultsHtml, buildSubjectMarksHtml } from "../src/resultsPdf.js";

const assignment = {
  year: "2026",
  grade: "Grade 6",
  division: "A",
  classTeacherId: "ct1",
  subjects: [
    { subject: "Mathematics", teacherId: "st1" },
    { subject: "Science", teacherId: "st2" },
  ],
};
const roster = [
  { index: "1001", name: "Kumar", grade: "Grade 6", division: "A" },
  { index: "1002", name: "Nisha", grade: "Grade 6", division: "A" },
];
const cfg = { fmax: 70, scale: DEFAULT_SCALE };
const filledSheet = (subject, teacherId) => makeSheet("2026", "Term 1", "Grade 6", "A", subject, teacherId, roster.map((student) => ({
  studentId: student.index, name: student.name, formative: 50, summative: 20, credit: 1, absent: false,
  absentRemark: "", activities: [],
})));

describe("results workflow", () => {
  it("shows all class subjects and student rows to the admin/class teacher and only entered assigned marks to subject teachers", () => {
    const sheets = {
      [resultSheetKey("2026", "Term 1", "Grade 6", "A", "Mathematics")]: {
        ...makeSheet("2026", "Term 1", "Grade 6", "A", "Mathematics", "st1", [
          { studentId: "1001", formative: 50, summative: 20 },
        ]),
      },
      [resultSheetKey("2026", "Term 1", "Grade 6", "A", "Science")]: {
        ...makeSheet("2026", "Term 1", "Grade 6", "A", "Science", "st2", [
          { studentId: "1002", formative: 45, summative: 25 },
        ]),
      },
      [resultSheetKey("2026", "Term 1", "Grade 6", "B", "Mathematics")]: filledSheet("Mathematics", "st1"),
    };
    const args = { year: "2026", term: "Term 1", grade: "Grade 6", division: "A", assignments: [assignment], students: roster, results: { sheets } };
    const classTeacher = visibleClassRecordMarks({ ...args, role: "teacher", actorId: "ct1" });
    expect(classTeacher).toHaveLength(4);
    expect(classTeacher.filter((row) => row.entered)).toHaveLength(2);
    expect(classTeacher.map((row) => row.subject)).toEqual(["Mathematics", "Mathematics", "Science", "Science"]);
    const missingScienceSheet = visibleClassRecordMarks({
      ...args,
      role: "teacher",
      actorId: "ct1",
      results: { sheets: { [resultSheetKey("2026", "Term 1", "Grade 6", "A", "Mathematics")]: sheets[resultSheetKey("2026", "Term 1", "Grade 6", "A", "Mathematics")] } },
    });
    expect(missingScienceSheet.filter((row) => row.subject === "Science")).toHaveLength(2);
    expect(missingScienceSheet.filter((row) => row.subject === "Science").every((row) => row.sheetStatus === "Not entered")).toBe(true);
    expect(visibleClassRecordMarks({ ...args, role: "admin", actorId: "admin" })).toHaveLength(4);
    const subjectTeacher = visibleClassRecordMarks({ ...args, role: "teacher", actorId: "st1" });
    expect(subjectTeacher).toHaveLength(1);
    expect(subjectTeacher[0]).toMatchObject({ studentId: "1001", subject: "Mathematics", teacherId: "st1", entered: true });
    expect(visibleClassRecordMarks({ ...args, role: "teacher", actorId: "st2" })).toHaveLength(1);
    expect(visibleClassRecordMarks({ ...args, role: "teacher", actorId: "outsider" })).toEqual([]);
  });

  it("limits subject teachers to assigned subjects and classes", () => {
    const user = { id: "st1", role: "teacher" };
    expect(canEditSubject(user, assignment, "Mathematics", null, [assignment])).toBe(true);
    expect(canEditSubject(user, assignment, "Science", null, [assignment])).toBe(false);
    expect(canEditSubject(user, { ...assignment, division: "B" }, "Mathematics", null, [assignment])).toBe(false);
    expect(canEditSubject(user, assignment, "Mathematics", null, [{ ...assignment, division: "B" }])).toBe(false);
    expect(canEditSubject(user, assignment, "Mathematics", { status: "Submitted" }, [assignment])).toBe(false);
    expect(canEditSubject({ id: "admin", role: "admin" }, assignment, "Mathematics", { status: "Published" })).toBe(false);
  });

  it("blocks publishing until all subjects are approved and all students have marks", () => {
    const sheets = {
      [resultSheetKey("2026", "Term 1", "Grade 6", "A", "Mathematics")]: { ...filledSheet("Mathematics", "st1"), status: "Approved" },
    };
    const readiness = publishReadiness({ assignment: { ...assignment, year: "2026", term: "Term 1" }, students: roster, sheets, cfg });
    expect(readiness.allowed).toBe(false);
    expect(readiness.reasons.join(" ")).toMatch(/Science/);
    sheets[resultSheetKey("2026", "Term 1", "Grade 6", "A", "Science")] = { ...filledSheet("Science", "st2"), status: "Approved", marks: [] };
    expect(publishReadiness({ assignment: { ...assignment, year: "2026", term: "Term 1" }, students: roster, sheets, cfg }).reasons.join(" ")).toMatch(/missing/i);
  });

  it("requests changes back to Draft with a comment and notifies the subject teacher", () => {
    const user = { id: "st1", role: "teacher", name: "Subject Teacher" };
    const state = {
      sheets: { [resultSheetKey("2026", "Term 1", "Grade 6", "A", "Mathematics")]: { ...filledSheet("Mathematics", "st1"), status: "Submitted" } },
      classes: {}, audit: [], notifications: [],
    };
    const changed = reviewSubject(state, { user: { id: "ct1", role: "teacher", name: "Class Teacher" }, assignment, assignments: [assignment], subject: "Mathematics", year: "2026", term: "Term 1", decision: "changes", comment: "Check Nisha's absent mark", at: 10 });
    const sheet = changed.sheets[resultSheetKey("2026", "Term 1", "Grade 6", "A", "Mathematics")];
    expect(sheet.status).toBe("Draft");
    expect(sheet.lastAction).toBe("Changes requested");
    expect(sheet.reviewComment).toBe("Check Nisha's absent mark");
    expect(changed.notifications[0]).toMatchObject({ toUserId: "st1" });
    expect(user.role).toBe("teacher");
  });

  it("submits a subject to its class teacher and locks marks until changes are requested", () => {
    const user = { id: "st1", role: "teacher", name: "Subject Teacher" };
    const state = { sheets: { [resultSheetKey("2026", "Term 1", "Grade 6", "A", "Mathematics")]: filledSheet("Mathematics", "st1") } };
    const submitted = submitSubject(state, { user, assignment, assignments: [assignment], subject: "Mathematics", year: "2026", term: "Term 1" });
    expect(submitted.sheets[resultSheetKey("2026", "Term 1", "Grade 6", "A", "Mathematics")].status).toBe("Submitted");
    expect(submitted.notifications[0]).toMatchObject({ toUserId: "ct1", toRole: "teacher" });
    expect(() => updateSubjectMarks(submitted, {
      user, assignment, assignments: [assignment], subject: "Mathematics", student: roster[0], patch: { formative: 1 }, year: "2026", term: "Term 1",
    })).toThrow(/not allowed/);
  });

  it("publishes per-class snapshots and exposes only the matching student's own marks", () => {
    const sheets = {
      [resultSheetKey("2026", "Term 1", "Grade 6", "A", "Mathematics")]: { ...filledSheet("Mathematics", "st1"), status: "Approved" },
      [resultSheetKey("2026", "Term 1", "Grade 6", "A", "Science")]: { ...filledSheet("Science", "st2"), status: "Approved" },
    };
    const state = { sheets, classes: {}, audit: [], notifications: [] };
    const result = publishClass(state, {
      user: { id: "ct1", name: "Class Teacher", role: "teacher" },
      assignment, assignments: [assignment], year: "2026", term: "Term 1", students: roster, cfg, gradeOnly: true,
      classTeacherName: "Class Teacher", at: new Date("2026-10-28T00:00:00Z"),
    });
    const own = publishedResultsForStudent(result, { studentId: "1001", grade: "Grade 6", division: "A" });
    const otherClass = publishedResultsForStudent(result, { studentId: "1001", grade: "Grade 6", division: "B" });
    expect(own).toHaveLength(1);
    expect(own[0].ownMarks.flatMap((subject) => subject.marks).map((mark) => mark.studentId)).toEqual(["1001", "1001"]);
    expect(own[0].students).toEqual([{ index: "1001", name: "Kumar" }]);
    expect(JSON.stringify(own[0])).not.toContain("Nisha");
    expect(otherClass).toHaveLength(0);
    expect(publishedResultsForStudent(result, { studentId: "9999", grade: "Grade 6", division: "A" })).toHaveLength(0);
    expect(own[0].gradeOnly).toBe(true);
    expect(own[0].version).toBe(1);
  });

  it("requires a reason to unpublish, increments version after republish, and audits correction", () => {
    const sheets = {
      [resultSheetKey("2026", "Term 1", "Grade 6", "A", "Mathematics")]: { ...filledSheet("Mathematics", "st1"), status: "Approved" },
      [resultSheetKey("2026", "Term 1", "Grade 6", "A", "Science")]: { ...filledSheet("Science", "st2"), status: "Approved" },
    };
    const published = publishClass({ sheets, classes: {}, audit: [], notifications: [] }, {
      user: { id: "ct1", name: "Class Teacher", role: "teacher" }, assignment, year: "2026", term: "Term 1",
      assignments: [assignment], students: roster, cfg, gradeOnly: false, at: new Date("2026-10-28T00:00:00Z"),
    });
    expect(() => unpublishClass(published, { user: { id: "ct1", role: "teacher" }, assignment, assignments: [assignment], year: "2026", term: "Term 1", reason: "" })).toThrow(/reason/);
    const corrected = unpublishClass(published, { user: { id: "ct1", name: "Class Teacher", role: "teacher" }, assignment, assignments: [assignment], year: "2026", term: "Term 1", reason: "Corrected marks", at: 30 });
    expect(publishedResultsForStudent(corrected, { studentId: "1001", grade: "Grade 6", division: "A" })).toHaveLength(0);
    let reviewed = corrected;
    for (const [subject, teacherId] of [["Mathematics", "st1"], ["Science", "st2"]]) {
      reviewed = submitSubject(reviewed, { user: { id: teacherId, name: "Subject Teacher", role: "teacher" }, assignment, assignments: [assignment], subject, year: "2026", term: "Term 1" });
      reviewed = reviewSubject(reviewed, { user: { id: "ct1", name: "Class Teacher", role: "teacher" }, assignment, assignments: [assignment], subject, year: "2026", term: "Term 1", decision: "approve" });
    }
    const republished = publishClass(reviewed, {
      user: { id: "ct1", name: "Class Teacher", role: "teacher" }, assignment, year: "2026", term: "Term 1",
      assignments: [assignment], students: roster, cfg, gradeOnly: false, at: new Date("2026-10-29T00:00:00Z"),
    });
    expect(Object.values(republished.classes)[0].version).toBe(2);
    expect(republished.audit.filter((entry) => entry.action === "Published")).toHaveLength(2);
    expect(republished.audit.find((entry) => entry.action === "Unpublished").reason).toBe("Corrected marks");
  });

  it("migrates existing period records into the default school class without losing marks", () => {
    const oldStore = { "2026|Term 1": [{ studentId: "1001", name: "Kumar", remark: "Good", modules: [{ moduleTitle: "Mathematics", formative: 50, summative: 20, credit: 2, absent: false, activities: [{ mark: "5", max: "10" }] }] }] };
    const migrated = migrateLegacyMarks({ sheets: {}, classes: {}, audit: [], notifications: [] }, oldStore, { grade: "Grade 6", className: "A" });
    const sheet = migrated.sheets[resultSheetKey("2026", "Term 1", "Grade 6", "A", "Mathematics")];
    expect(sheet.marks[0]).toMatchObject({ studentId: "1001", formative: 50, summative: 20, credit: 2, activities: [{ mark: "5", max: "10" }], remark: "Good" });
    expect(oldStore["2026|Term 1"][0].modules[0].activities).toEqual([{ mark: "5", max: "10" }]);
  });

  it("enforces mark updates through the scoped data-access helper", () => {
    const user = { id: "st1", role: "teacher" };
    expect(() => updateSubjectMarks({ sheets: {}, classes: {}, audit: [], notifications: [] }, {
      user, assignment, subject: "Science", student: roster[0], patch: { formative: 10 }, year: "2026", term: "Term 1",
      assignments: [assignment], students: roster,
    })).toThrow(/not allowed/);
    const updated = updateSubjectMarks({ sheets: {}, classes: {}, audit: [], notifications: [] }, {
      user, assignment, subject: "Mathematics", student: roster[0], patch: { formative: 10 }, year: "2026", term: "Term 1",
      assignments: [assignment], students: roster,
    });
    expect(updated.sheets[resultSheetKey("2026", "Term 1", "Grade 6", "A", "Mathematics")].marks[0].formative).toBe(10);
    expect(() => updateSubjectMarks({ sheets: {}, classes: {}, audit: [], notifications: [] }, {
      user, assignment, subject: "Mathematics", student: { ...roster[0], grade: "Grade 7" }, patch: { formative: 10 },
      year: "2026", term: "Term 1", assignments: [assignment], students: roster,
    })).toThrow(/not in the assigned class/);
  });

  it("removes marks only for an assigned subject and an enrolled student", () => {
    const user = { id: "st1", role: "teacher" };
    const key = resultSheetKey("2026", "Term 1", "Grade 6", "A", "Mathematics");
    const state = { sheets: { [key]: filledSheet("Mathematics", "st1") } };
    const removed = removeSubjectMark(state, {
      user, assignment, subject: "Mathematics", student: roster[0], year: "2026", term: "Term 1",
      assignments: [assignment], students: roster,
    });
    expect(removed.sheets[key].marks.map((mark) => mark.studentId)).toEqual(["1002"]);
    expect(() => removeSubjectMark(state, {
      user, assignment, subject: "Science", student: roster[0], year: "2026", term: "Term 1",
      assignments: [assignment], students: roster,
    })).toThrow(/not allowed/);
    expect(() => removeSubjectMark(state, {
      user, assignment, subject: "Mathematics", student: { ...roster[0], division: "B" }, year: "2026", term: "Term 1",
      assignments: [assignment], students: roster,
    })).toThrow(/not in the assigned class/);
  });

  it("builds class and individual report print layouts from the published snapshot", () => {
    const snapshot = {
      year: "2026", term: "Term 1", grade: "Grade 6", division: "A", published: true,
      publishedAt: "2026-10-28T00:00:00.000Z", version: 2, gradeOnly: true,
      classTeacherName: "Class Teacher", scale: DEFAULT_SCALE,
      students: [{ index: "1001", name: "Kumar" }],
      subjects: [{ subject: "Mathematics", average: 70, marks: [{ studentId: "1001", name: "Kumar", formative: 50, summative: 20, credit: 1, absent: false }] }],
    };
    const classHtml = buildClassResultsHtml(snapshot, { schoolName: "Example School" });
    const studentHtml = buildStudentResultsHtml(snapshot, "1001", { schoolName: "Example School" });
    expect(classHtml).toContain("Version 2");
    expect(classHtml).toContain("Class average by subject");
    expect(classHtml).not.toContain("<th>GPA</th>");
    expect(studentHtml).toContain("Kumar report card");
    expect(studentHtml).not.toContain("<th>GPA</th>");
    expect(() => buildStudentResultsHtml(snapshot, "9999")).toThrow(/not included/);
    const gpaHtml = buildStudentResultsHtml({ ...snapshot, gradeOnly: false }, "1001");
    expect(gpaHtml).toContain("<th>GPA</th>");
    const subjectHtml = buildSubjectMarksHtml({
      assignment, subject: "Mathematics", students: roster, sheet: filledSheet("Mathematics", "st1"),
      cfg, year: "2026", term: "Term 1", meta: { schoolName: "Example School" },
    });
    expect(subjectHtml).toContain("Kumar");
    expect(subjectHtml).toContain("Formative");
    expect(subjectHtml).toContain("<th>GPV</th>");
    expect(subjectHtml).toContain("<th>Points</th>");
    expect(subjectHtml).toContain("<th>GPA</th>");
    expect(subjectHtml).toContain("<th>Absent remark</th>");
    const gradesOnlySubjectHtml = buildSubjectMarksHtml({
      assignment, subject: "Mathematics", students: roster, sheet: filledSheet("Mathematics", "st1"),
      cfg, year: "2026", term: "Term 1", meta: { schoolName: "Example School" }, gradeOnly: true,
    });
    expect(gradesOnlySubjectHtml).not.toContain("<th>GPV</th>");
    expect(gradesOnlySubjectHtml).not.toContain("<th>Points</th>");
    expect(gradesOnlySubjectHtml).not.toContain("<th>GPA</th>");
  });
});
