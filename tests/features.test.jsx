import { describe, expect, it } from "vitest";
import { createBackup, createCheckpoint, parseBackup, restoreData } from "../src/backup.js";
import { buildProgressAlerts, comparePeriods, periodsInOrder } from "../src/analytics.js";
import { DEFAULT_SCALE } from "../src/grading.js";

class MemoryStorage {
  data = new Map();
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(String(key), String(value)); }
  removeItem(key) { this.data.delete(key); }
}

describe("school data backups", () => {
  it("exports school records without transferring local credentials", () => {
    const storage = new MemoryStorage();
    storage.setItem("srb-students", JSON.stringify([{ index: "1" }]));
    storage.setItem("srb-users", JSON.stringify([{ username: "admin", hash: "secret" }]));
    storage.setItem("srb-user", JSON.stringify({ name: "Admin" }));
    const backup = createBackup(storage);
    expect(backup.data).toEqual({ "srb-students": [{ index: "1" }] });
  });

  it("saves checkpoints and validates imported backup structure", () => {
    const storage = new MemoryStorage();
    storage.setItem("srb-students", JSON.stringify([{ index: "1" }]));
    const saved = createCheckpoint("Before import", storage);
    expect(saved.data["srb-students"]).toEqual([{ index: "1" }]);
    expect(parseBackup(JSON.stringify({ format: "kalvi-valai-backup", version: 1, data: saved.data })).data).toEqual(saved.data);
    expect(() => parseBackup(JSON.stringify({ format: "other", version: 1, data: {} }))).toThrow(/supported/);
    expect(() => parseBackup(JSON.stringify({ format: "kalvi-valai-backup", version: 1, data: { "srb-users": [] } }))).toThrow(/unsupported/);
  });

  it("restores school data and removes stale school keys without touching accounts", () => {
    const storage = new MemoryStorage();
    storage.setItem("srb-students", JSON.stringify([{ index: "old" }]));
    storage.setItem("srb-old-school-setting", "true");
    storage.setItem("srb-users", JSON.stringify([{ hash: "keep" }]));
    restoreData({ "srb-students": [{ index: "new" }] }, storage);
    expect(JSON.parse(storage.getItem("srb-students"))).toEqual([{ index: "new" }]);
    expect(storage.getItem("srb-old-school-setting")).toBeNull();
    expect(storage.getItem("srb-users")).toContain("keep");
  });
});

describe("student progress analysis", () => {
  const record = (studentId, name, formative, summative) => ({
    studentId, name,
    modules: [{ moduleId: "math", moduleTitle: "Math", formative, summative, credit: 1 }],
  });
  const meta = { year: "2027", term: "Term 1", grade: "Grade 6", className: "A" };
  const cfg = { scale: DEFAULT_SCALE };

  it("finds missing marks, incomplete subjects, low averages, and falling averages", () => {
    const store = {
      "2026|Term 1": [record("1", "Asha", 40, 40)],
      "2027|Term 1": [{ ...record("1", "Asha", 20, 20), modules: [
        { moduleId: "math", moduleTitle: "Math", formative: 20, summative: 20, credit: 1 },
        { moduleId: "eng", moduleTitle: "English", formative: "", summative: "" },
      ] }],
    };
    const students = [
      { index: "1", name: "Asha", grade: "Grade 6", division: "A" },
      { index: "2", name: "Bala", grade: "Grade 6", division: "A" },
    ];
    const alerts = buildProgressAlerts({ store, students, meta, cfg });
    expect(alerts.map((alert) => alert.kind)).toEqual(expect.arrayContaining(["Missing marks", "Incomplete marks", "Support needed", "Falling average"]));
  });

  it("compares term averages and subject deltas", () => {
    const store = {
      "2026|Term 1": [record("1", "Asha", 30, 30)],
      "2026|Term 2": [record("1", "Asha", 40, 40)],
    };
    expect(periodsInOrder(store)).toEqual(["2026|Term 1", "2026|Term 2"]);
    const [comparison] = comparePeriods(store, "2026|Term 1", "2026|Term 2", DEFAULT_SCALE);
    expect(comparison.averageChange).toBe(20);
    expect(comparison.subjects[0].change).toBe(20);
  });
});
