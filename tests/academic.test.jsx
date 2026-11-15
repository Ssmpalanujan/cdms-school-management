import { describe, expect, it } from "vitest";
import { balance, DEFAULT_ENT, validateLeave } from "../src/leave.js";
import {
  addAcademicYear, canManageYears, canWriteYear, closeAcademicYear, getYearEntitlement, normalizeEnrollments,
  migrateAcademicStorage, setCurrentAcademicYear, setYearEntitlement,
} from "../src/academic.js";
import { addYearsClamped, datePartsBetween, pensionDetails, validateTeacherDates } from "../src/pension.js";
import {
  applyAcceptedPromotion, decidePromotion, reassignPromotion, sendPromotionRequest, visiblePublishedHistory,
} from "../src/promotions.js";
import { publishedResultsForStudent } from "../src/resultsWorkflow.js";

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(String(key), String(value)); }
}

describe("yearly leave entitlements", () => {
  it("uses the requested defaults and blocks a request with zero available days", () => {
    expect(DEFAULT_ENT).toEqual({ casual: 21, sick: 21, special: 0, duty: 0 });
    const form = { teacher: "T", type: "special", from: "2027-01-04", to: "2027-01-04", days: "1", submitted: "2026-11-02", reason: "Personal" };
    const errors = validateLeave(form, [], getYearEntitlement({}, "2027"));
    expect(errors.type).toMatch(/0 days available/);
    expect(validateLeave({ ...form, type: "duty" }, [], getYearEntitlement({}, "2027")).type).toMatch(/0 days available/);
  });

  it("resets used leave for a new year and persists entitlements by year", () => {
    const leaves = [{ id: "l1", teacher: "T", type: "casual", from: "2026-02-02", to: "2026-02-02", days: 1, status: "pending" }];
    const data = setYearEntitlement({}, "2026", { ...DEFAULT_ENT, casual: 15 });
    expect(balance(leaves, getYearEntitlement(data, "2026"), "T", "2026").casual).toMatchObject({ total: 15, used: 1, remaining: 14 });
    expect(balance(leaves, getYearEntitlement(data, "2027"), "T", "2027").casual).toMatchObject({ total: 21, used: 0, remaining: 21 });
  });
});

describe("academic year access and migration", () => {
  const years = [{ year: "2026", current: true, closed: false }, { year: "2027", current: false, closed: false }];

  it("allows only admins to add or close years and locks closed years", () => {
    expect(canManageYears("admin")).toBe(true);
    for (const role of ["teacher", "student"]) {
      expect(canManageYears(role)).toBe(false);
      expect(() => addAcademicYear(years, "2028", { role })).toThrow(/Only an administrator/);
      expect(() => closeAcademicYear(years, "2027", { role })).toThrow(/Only an administrator/);
      expect(canWriteYear(role, "2027", years)).toBe(false);
    }
    expect(addAcademicYear(years, "2028", { role: "admin" })).toHaveLength(3);
    const current = setCurrentAcademicYear(years, "2027", { role: "admin" });
    expect(current.find((item) => item.year === "2027").current).toBe(true);
    const closed = closeAcademicYear(current, "2027", { role: "admin" });
    expect(closed.find((item) => item.year === "2027").closed).toBe(true);
    expect(canWriteYear("admin", "2027", closed)).toBe(false);
  });

  it("migrates existing students into current enrollment without changing marks or losing malformed-safe behavior", () => {
    const storage = new MemoryStorage();
    const marks = { "2025|Term 1": [{ studentId: "1", name: "A" }] };
    storage.setItem("srb-marks", JSON.stringify(marks));
    storage.setItem("srb-students", JSON.stringify([{ index: "1", grade: "Grade 6", division: "A" }]));
    storage.setItem("srb-leave-ent", "{broken");
    const result = migrateAcademicStorage(storage, "2026", [{ index: "1", grade: "Grade 6", division: "A" }], {});
    expect(result.enrollments).toEqual([expect.objectContaining({ studentId: "1", year: "2026", grade: "Grade 6", division: "A" })]);
    expect(JSON.parse(storage.getItem("srb-marks"))).toEqual(marks);
    expect(getYearEntitlement(JSON.parse(storage.getItem("srb-leave-ent")), "2026")).toEqual(DEFAULT_ENT);
    expect(() => migrateAcademicStorage(storage, "2026", [], {})).not.toThrow();
  });

  it("normalizes duplicate enrollment years without dropping other historical years", () => {
    const records = [
      { studentId: "1", year: "2025", grade: "Grade 5", division: "A" },
      { studentId: "1", year: "2025", grade: "Grade 5", division: "B" },
      { studentId: "1", year: "2026", grade: "Grade 6", division: "A" },
    ];
    const normalized = normalizeEnrollments(records, [], "2026", {});
    expect(normalized).toHaveLength(2);
    expect(normalized.map((item) => item.year).sort()).toEqual(["2025", "2026"]);
  });
});

describe("teacher pension countdown", () => {
  it("handles leap-year retirement dates, month-end math, days left and age changes", () => {
    expect(addYearsClamped("2000-02-29", 21)).toBe("2021-02-28");
    expect(datePartsBetween("2026-10-20", "2027-03-04")).toEqual({ years: 0, months: 4, days: 12 });
    const teacher = { dateOfBirth: "2000-02-29", dateJoined: "2020-03-31" };
    const standardAge = pensionDetails(teacher, 60, "2026-10-20");
    expect(standardAge.retirementDate).toBe("2060-02-29");
    expect(standardAge.daysLeft).toBeGreaterThan(0);
    expect(pensionDetails(teacher, 50, "2026-10-20").retirementDate).toBe("2050-02-28");
    expect(pensionDetails({ dateOfBirth: "2005-02-28", dateJoined: "2025-02-28" }, 22, "2026-10-20").remaining).toEqual({ years: 0, months: 4, days: 8 });
    expect(pensionDetails({ dateOfBirth: "1960-01-01", dateJoined: "1980-01-01" }, 60, "2026-01-02").retired).toBe(true);
  });

  it("validates birth and service dates against the school's local date", () => {
    expect(validateTeacherDates({ dateOfBirth: "2000-01-01", dateJoined: "2018-01-01" }, "2026-01-01")).toEqual({});
    expect(validateTeacherDates({ dateOfBirth: "2010-01-01", dateJoined: "2020-01-01" }, "2026-01-01").dateJoined).toMatch(/at least 18/);
    expect(validateTeacherDates({ dateOfBirth: "2027-01-01", dateJoined: "2027-01-01" }, "2026-01-01").dateOfBirth).toMatch(/past/);
    expect(validateTeacherDates({ dateOfBirth: "2000-01-01", dateJoined: "2027-01-01" }, "2026-01-01").dateJoined).toMatch(/future/);
  });
});

describe("promotion permissions and enrollment history", () => {
  const assignments = [
    { year: "2026", grade: "Grade 6", division: "A", classTeacherId: "sender" },
    { year: "2027", grade: "Grade 7", division: "A", classTeacherId: "receiver" },
  ];
  const input = {
    sourceYear: "2026", sourceGrade: "Grade 6", sourceDivision: "A",
    targetYear: "2027", targetGrade: "Grade 7", targetDivision: "A", receiverId: "receiver",
    students: [{ studentId: "1", name: "A", division: "A" }],
  };

  it("requires a reason to decline and creates a new enrollment on accept without replacing history", () => {
    const pending = sendPromotionRequest([], input, { role: "teacher", id: "sender", name: "Sender" }, assignments, 100);
    const request = pending[0];
    expect(() => decidePromotion(pending, request.id, "accept", { role: "teacher", id: "receiver" }, "", 101, [])).toThrow(/no longer assigned/);
    expect(() => decidePromotion(pending, request.id, "decline", { role: "teacher", id: "receiver" }, "")).toThrow(/reason is required/);
    const targetYears = [{ year: "2027", closed: false }];
    expect(() => decidePromotion(pending, request.id, "accept", { role: "teacher", id: "receiver" }, "", 101, assignments, [], targetYears)).toThrow(/no longer in the school roster/);
    const accepted = decidePromotion(pending, request.id, "accept", { role: "teacher", id: "receiver" }, "", Date.now(), assignments, [{ index: "1" }], targetYears);
    const result = applyAcceptedPromotion(
      [{ studentId: "1", year: "2026", grade: "Grade 6", division: "A" }],
      [{ index: "1", name: "A", grade: "Grade 6", division: "A" }],
      accepted[0],
    );
    expect(result.enrollments).toHaveLength(2);
    expect(result.enrollments[0].year).toBe("2026");
    expect(result.enrollments[1]).toMatchObject({ year: "2027", grade: "Grade 7", division: "A" });
    expect(result.students[0]).toMatchObject({ grade: "Grade 7", division: "A" });
  });

  it("prevents a second pending request for a student and isolates published history to authorized viewers", () => {
    const pending = sendPromotionRequest([], input, { role: "teacher", id: "sender", name: "Sender" }, assignments, 100);
    expect(() => sendPromotionRequest(pending, input, { role: "teacher", id: "sender", name: "Sender" }, assignments, 101)).toThrow(/active promotion request/);
    const requests = decidePromotion(pending, pending[0].id, "accept", { role: "teacher", id: "receiver" });
    const enrolled = [
      { studentId: "1", year: "2026", grade: "Grade 6", division: "A" },
      { studentId: "1", year: "2027", grade: "Grade 7", division: "A" },
    ];
    const snapshot = { published: true, year: "2026", term: "Term 1", grade: "Grade 6", division: "A", students: [{ index: "1" }], subjects: [{ subject: "Math", marks: [{ studentId: "1", formative: 50 }, { studentId: "2", formative: 99 }] }] };
    const permitted = visiblePublishedHistory({ role: "teacher", actorId: "receiver", studentId: "1", snapshots: [snapshot], assignments, enrollments: enrolled, requests, currentYear: "2027" });
    expect(permitted).toHaveLength(1);
    expect(permitted[0].subjects[0].marks).toEqual([{ studentId: "1", formative: 50 }]);
    expect(permitted[0].readOnly).toBe(true);
    expect(visiblePublishedHistory({ role: "teacher", actorId: "other", studentId: "1", snapshots: [snapshot], assignments, enrollments: enrolled, requests, currentYear: "2027" })).toEqual([]);
    expect(visiblePublishedHistory({ role: "teacher", actorId: "receiver", studentId: "2", snapshots: [snapshot], assignments, enrollments: enrolled, requests, currentYear: "2027" })).toEqual([]);
    const subjectOnly = visiblePublishedHistory({
      role: "teacher", actorId: "subject-teacher", studentId: "1", snapshots: [{ ...snapshot, subjects: [
        { subject: "Math", marks: [{ studentId: "1", formative: 50 }] },
        { subject: "Science", marks: [{ studentId: "1", formative: 60 }] },
      ] }],
      assignments: [assignments[0], { ...assignments[1], subjects: [{ subject: "Math", teacherId: "subject-teacher" }] }],
      enrollments: enrolled, requests, currentYear: "2027",
    });
    expect(subjectOnly[0].subjects.map((subject) => subject.subject)).toEqual(["Math"]);
    expect(publishedResultsForStudent({ classes: {
      a: { ...snapshot, year: "2026", published: true },
      b: { ...snapshot, year: "2025", grade: "Grade 5", division: "B", published: true, subjects: [{ subject: "Math", marks: [{ studentId: "1" }, { studentId: "2" }] }] },
    } }, { studentId: "1", grade: "Grade 7", division: "A" }, undefined, [
      { studentId: "1", year: "2026", grade: "Grade 6", division: "A" },
      { studentId: "1", year: "2025", grade: "Grade 5", division: "B" },
    ]).flatMap((item) => item.subjects.flatMap((subject) => subject.marks)).every((mark) => mark.studentId === "1")).toBe(true);
  });

  it("validates the sender roster and requires an open target academic year", () => {
    const actor = { role: "teacher", id: "sender", name: "Sender" };
    const roster = [{ index: "1", grade: "Grade 6", division: "A" }];
    const openYears = [{ year: "2027", closed: false }];
    expect(sendPromotionRequest([], input, actor, assignments, 100, roster, openYears)).toHaveLength(1);
    expect(() => sendPromotionRequest([], {
      ...input, students: [{ studentId: "2", division: "A" }],
    }, actor, assignments, 100, roster, openYears)).toThrow(/belong to your current class/);
    expect(() => sendPromotionRequest([], input, actor, assignments, 100, roster, [{ year: "2027", closed: true }])).toThrow(/open target academic year/);
  });

  it("allows only admins to reassign pending requests to teachers assigned to the target class", () => {
    const pending = sendPromotionRequest([], input, { role: "teacher", id: "sender", name: "Sender" }, assignments, 100);
    const reassignment = { ...assignments[1], classTeacherId: "new-receiver" };
    expect(() => reassignPromotion(pending, pending[0].id, "new-receiver", "New Receiver", { role: "teacher", id: "sender" }, [reassignment], "Unavailable"))
      .toThrow(/Only an administrator/);
    expect(() => reassignPromotion(pending, pending[0].id, "new-receiver", "New Receiver", { role: "admin", id: "admin" }, assignments, "Unavailable"))
      .toThrow(/assigned to every target class/);
    expect(reassignPromotion(pending, pending[0].id, "new-receiver", "New Receiver", { role: "admin", id: "admin" }, [reassignment], "Teacher unavailable")[0])
      .toMatchObject({ receiverId: "new-receiver", receiverName: "New Receiver", reassignmentReason: "Teacher unavailable" });
  });
});
