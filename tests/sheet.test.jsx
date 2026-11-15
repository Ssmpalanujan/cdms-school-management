// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import fs from "fs";
import os from "os";
import path from "path";
import { importWorkbook, importStudents, downloadMarksReport, downloadStudents, downloadWorkbook, SAMPLE } from "../src/sheet.js";
import { DEFAULT_SCALE } from "../src/grading.js";

const cfg = { fmax: 70, scale: DEFAULT_SCALE };
const fileOf = (rows) => { const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "S"); const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }); return { arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) }; };
const base = { grade: "Grade 6", medium: "English", className: "A", classTeacher: "T", term: "Term 1", year: 2026, credit: 1 };

describe("workbook import", () => {
  it("imports valid rows, reports invalid and duplicate rows, never throws on row errors", async () => {
    const rows = [
      { ...base, studentId: "1", name: "A", moduleId: "m", moduleTitle: "Math", formative: 50, summative: 20 },
      { ...base, studentId: "1", name: "A", moduleId: "m", moduleTitle: "Math", formative: 51, summative: 21 },
      { ...base, studentId: "2", name: "B", moduleId: "m", moduleTitle: "Math", formative: 99, summative: 20 },
      { ...base, studentId: "3", name: "C", moduleId: "m", moduleTitle: "Math", formative: "abc", summative: 20 },
      { ...base, studentId: "4", name: "D", moduleId: "m", moduleTitle: "Math", formative: "", summative: "", absent: "yes", absentRemark: "Sick" },
      { ...base, studentId: "", name: "", moduleId: "m", moduleTitle: "Math", formative: 1, summative: 1 },
    ];
    const out = await importWorkbook(fileOf(rows), cfg);
    expect(out.records.map((r) => r.studentId)).toEqual(["1", "4"]);
    expect(out.errors.length).toBe(4);
    expect(out.errors.some((e) => /duplicate/.test(e))).toBe(true);
    expect(out.errors.some((e) => /between 0 and 70/.test(e))).toBe(true);
    expect(out.records[1].modules[0].absent).toBe(true);
    expect(out.meta.term).toBe("Term 1");
  });
  it("rejects a file with missing columns", async () => {
    await expect(importWorkbook(fileOf([{ studentId: "1", name: "A" }]), cfg)).rejects.toThrow(/Missing columns/);
  });
  it("imports students and skips duplicate index numbers", async () => {
    const f = fileOf([
      { indexNumber: "1", fullName: "A", gender: "male", grade: "Grade 6", division: "A" },
      { indexNumber: "1", fullName: "A2", gender: "Male", grade: "Grade 6", division: "A" },
      { indexNumber: "2", fullName: "B", gender: "other", grade: "Grade 6", division: "A" },
      { indexNumber: "3", fullName: "C", gender: "Female", grade: "Grade 6", division: "B" },
    ]);
    const out = await importStudents(f, [{ index: "3" }]);
    expect(out.students.map((s) => s.index)).toEqual(["1"]);
    expect(out.errors.length).toBe(3);
  });
  it("exports marks report with activity columns, absent, GPA, grade and remarks", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "srb-")); process.chdir(dir);
    const recs = [{ studentId: "1", name: "A", remark: "Good", modules: [{ moduleId: "m", moduleTitle: "Math", formative: 49, summative: 25, credit: 2, activities: [{ mark: 8, max: 10 }, { mark: 6, max: 10 }] }, { moduleId: "n", moduleTitle: "Art", absent: true, absentRemark: "Sick", credit: 1 }] }];
    downloadMarksReport(recs, [{ index: "1", grade: "Grade 6", division: "A" }], { grade: "Grade 6", className: "A", year: "2026", term: "Term 1" }, cfg);
    const wb = XLSX.readFile(path.join(dir, "marks-report-2026-term-1.xlsx"));
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    expect(rows[0]).toEqual(["No.", "Full Name", "Index Number", "Grade", "Division", "Date", "Subject", "Activity 1", "Activity 2", "Credit", "Formative", "Summative", "Total", "GPA", "Grade Result", "Remarks"]);
    expect(rows[1].slice(7, 10)).toEqual(["8/10", "6/10", 2]);
    expect(rows[1][12]).toBe(74); expect(rows[1][14]).toBe("A-");
    expect(rows[2][12]).toBe("AB"); expect(rows[2][15]).toBe("Sick");
    downloadStudents([{ index: "1", name: "A", gender: "Male", grade: "Grade 6", division: "A", dob: "", guardian: "" }]);
    downloadWorkbook(recs, { grade: "g", medium: "m", className: "A", classTeacher: "t", term: "Term 1", year: "2026" });
    const wb2 = XLSX.readFile(path.join(dir, "report-workbook.xlsx"));
    const back = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]]);
    expect(back.length).toBe(2); expect(back[1].absent).toBe("yes");
    expect(SAMPLE.length).toBe(4);
  });
});
