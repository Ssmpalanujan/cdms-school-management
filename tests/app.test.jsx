import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.jsx";

const seed = (extra = {}) => {
  localStorage.setItem("srb-user", JSON.stringify({ name: "Test Admin", email: "a@b.co", role: "admin", school: "Test College", phone: "0771234567" }));
  localStorage.setItem("srb-meta", JSON.stringify({ schoolName: "Test College", principal: "Mr P", grade: "Grade 6", className: "A", medium: "English", classTeacher: "Mr T", term: "Term 1", year: "2026", schedule: "tamil-sinhala", logoTrim: true }));
  localStorage.setItem("srb-owl-tips", "false");
  Object.entries(extra).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
};
const nav = async (u, name) => { await u.click(screen.getAllByRole("button", { name: new RegExp(`^${name}`, "i") })[0]); };

describe("school management flows", () => {
  beforeEach(() => seed());

  it("adds students, blocks duplicate index, shows counts on dashboard", async () => {
    const u = userEvent.setup();
    render(<App />);
    await nav(u, "Students");
    const add = async (name, idx, gender) => {
      const form = document.getElementById("student-form");
      await u.clear(within(form).getByLabelText("Full name")); await u.type(within(form).getByLabelText("Full name"), name);
      await u.clear(within(form).getByLabelText("Index number")); await u.type(within(form).getByLabelText("Index number"), idx);
      await u.selectOptions(within(form).getByLabelText("Gender"), gender);
      await u.click(within(form).getByRole("button", { name: /add student/i }));
    };
    await add("Aroofath", "1000", "Female");
    await add("Kumar", "1001", "Male");
    await add("Dup", "1000", "Male");
    expect(await screen.findByText("This index number already exists.")).toBeTruthy();
    expect(screen.getAllByText("Kumar").length).toBeGreaterThan(0);
    await nav(u, "Admin dashboard");
    const prof = document.querySelector(".profile");
    expect(within(prof).getByText("Mr P")).toBeTruthy();
    expect(prof.querySelector(".statrow").textContent).toMatch(/2Total students1Male1Female/);
    expect(prof.textContent).toMatch(/Grade 6 A: 2/);
  });

  it("marks entry: validation, add record, absent, activities, duplicate protection", async () => {
    const u = userEvent.setup();
    render(<App />);
    await nav(u, "Report builder");
    const sec = document.getElementById("modules");
    const row = () => within(sec).getAllByRole("row")[1];
    const credit = within(row()).getByRole("spinbutton", { name: "Credit" });
    expect(credit.parentElement.classList.contains("numf-credit")).toBe(true);
    await u.click(within(row()).getByRole("button", { name: "Decrease Credit" }));
    expect(credit.value).toBe("0.75");
    await u.click(within(row()).getByRole("button", { name: "Increase Credit" }));
    expect(credit.value).toBe("1");
    await u.type(within(row()).getByLabelText("Index number"), "2001");
    await u.type(within(row()).getByLabelText("Student name"), "Nila");
    await u.type(within(row()).getByLabelText("Subject"), "History");
    await u.type(within(row()).getByRole("spinbutton", { name: "Formative" }), "99");
    await u.type(within(row()).getByRole("spinbutton", { name: "Summative" }), "20");
    await u.click(within(sec).getByRole("button", { name: "Add record" }));
    expect(await within(sec).findByText(/formative must be between 0 and 70/)).toBeTruthy();
    expect(within(row()).getByText("Max 70")).toBeTruthy();
    // fix mark, then add
    const f = within(row()).getByRole("spinbutton", { name: "Formative" });
    await u.clear(f); await u.type(f, "56");
    await u.click(within(sec).getByRole("button", { name: "Add record" }));
    const rec = document.getElementById("records");
    expect(await within(rec).findByText("Nila")).toBeTruthy();
    expect(rec.textContent).toMatch(/76/); // total
    // student auto-created
    expect(JSON.parse(localStorage.getItem("srb-students")).some((s) => s.index === "2001")).toBe(true);
    // absent row for another student
    await u.type(within(row()).getByLabelText("Index number"), "2002");
    await u.type(within(row()).getByLabelText("Student name"), "Ravi");
    await u.type(within(row()).getByLabelText("Subject"), "History");
    await u.click(within(row()).getByRole("checkbox"));
    await u.type(within(row()).getByLabelText("Absent remark"), "Fever");
    await u.click(within(sec).getByRole("button", { name: "Add record" }));
    expect(await within(rec).findByText("Ravi")).toBeTruthy();
    const marks = JSON.parse(localStorage.getItem("srb-marks"))["2026|Term 1"];
    const ravi = marks.find((r) => r.studentId === "2002");
    expect(ravi.modules[0].absent).toBe(true);
    expect(ravi.modules[0].absentRemark).toBe("Fever");
    // duplicate entry triggers confirm (stubbed true => replace)
    await u.type(within(row()).getByLabelText("Index number"), "2001");
    await u.type(within(row()).getByLabelText("Subject"), "History");
    await u.type(within(row()).getByRole("spinbutton", { name: "Formative" }), "60");
    await u.type(within(row()).getByRole("spinbutton", { name: "Summative" }), "25");
    await u.click(within(sec).getByRole("button", { name: "Add record" }));
    await waitFor(() => expect(within(sec).getByText(/1 replaced/)).toBeTruthy());
    // activities dialog scales to formative max
    await u.type(within(row()).getByLabelText("Index number"), "2003");
    await u.type(within(row()).getByLabelText("Student name"), "Mala");
    await u.type(within(row()).getByLabelText("Subject"), "Art");
    await u.click(within(document.querySelector(".btngrid")).getByRole("button", { name: "Activities" }));
    const dlg = screen.getByRole("dialog");
    expect([...dlg.querySelectorAll(".actt col")].map((col) => col.style.width)).toEqual(["110px", "160px", "160px", "90px"]);
    expect(dlg.querySelector(".actt").parentElement.className).toBe("actt-scroll");
    await u.type(within(dlg).getByLabelText("Activity 1 marks"), "8");
    await u.type(within(dlg).getByLabelText("Activity 1 maximum"), "10");
    await u.type(within(dlg).getByLabelText("Activity 2 marks"), "6");
    await u.type(within(dlg).getByLabelText("Activity 2 maximum"), "10");
    expect(dlg.textContent).toMatch(/formative 49 out of 70/);
    await u.click(within(dlg).getByRole("button", { name: "Apply" }));
    expect(row().querySelector(".actv").textContent).toBe("49");
  });

  it("places the blue Activities button next to Add module", async () => {
    const u = userEvent.setup();
    render(<App />);
    await nav(u, "Report builder");
    const actions = document.querySelector(".btngrid");
    const buttons = within(actions).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Add module", "Activities", "Calculate", "Add record", "Print report"]);
    expect(buttons[1].classList.contains("btn")).toBe(true);
    expect(buttons[1].classList.contains("teal")).toBe(false);
  });

  it("removes the calendar banner icon and Right now chip", async () => {
    const u = userEvent.setup();
    render(<App />);
    await nav(u, "Term calendar");

    expect(screen.queryByText("Right now")).toBeNull();
    expect(document.querySelector(".bicon")).toBeNull();
    expect(document.querySelector(".calendar-status")).toBeTruthy();
  });

  it("periods keep marks separate and old single-list data migrates", async () => {
    localStorage.clear(); seed({ "srb-records": [{ studentId: "9", name: "Old", modules: [{ moduleId: "m", moduleTitle: "M", formative: 50, summative: 20, credit: 1 }], remark: "" }] });
    const u = userEvent.setup();
    render(<App />);
    await nav(u, "Report builder");
    expect(await within(document.getElementById("records")).findByText("Old")).toBeTruthy();
    await u.selectOptions(screen.getByLabelText("Term"), "Term 2");
    expect(within(document.getElementById("records")).queryByText("Old")).toBeNull();
    await u.selectOptions(screen.getByLabelText("Term"), "Term 1");
    expect(within(document.getElementById("records")).getByText("Old")).toBeTruthy();
  });

  it("leave: submit, overlap and balance validation, approve, dashboard summary", async () => {
    const u = userEvent.setup();
    render(<App />);
    await nav(u, "Teacher leave");
    const fill = async (from, to, type = "sick") => {
      const fm = document.querySelector("form");
      await u.selectOptions(within(fm).getByLabelText("Leave type"), type);
      await u.clear(within(fm).getByLabelText("Start date")); await u.type(within(fm).getByLabelText("Start date"), from);
      await u.clear(within(fm).getByLabelText("End date")); await u.type(within(fm).getByLabelText("End date"), to);
      await u.clear(within(fm).getByLabelText("Reason")); await u.type(within(fm).getByLabelText("Reason"), "Fever");
      await u.click(within(fm).getByRole("button", { name: /submit request/i }));
    };
    await fill("2026-11-02", "2026-11-04");
    expect(await screen.findByText("L-2026-001")).toBeTruthy();
    await fill("2026-11-03", "2026-11-05");
    expect(await screen.findByText(/Overlaps leave L-2026-001/)).toBeTruthy();
    await fill("2026-12-01", "2026-12-31", "special");
    expect((await screen.findAllByText(/0 days available for special leave/)).length).toBeGreaterThan(0);
    await u.click(screen.getAllByRole("button", { name: "Approve" })[0]);
    expect(document.querySelector(".st-approved")).toBeTruthy();
    await nav(u, "Admin dashboard");
    const row = [...document.querySelectorAll(".lsum tbody tr")].find((r) => r.textContent.startsWith("Sick"));
    expect(row.textContent).toMatch(/Sick3213?18/); // 3 used, 21 total, 18 remaining
  });

  it("leave: preserves a half-day request through form entry and save", async () => {
    localStorage.setItem("srb-user", JSON.stringify({ name: "Mr Ravi", email: "ravi@school.lk", role: "teacher" }));
    const u = userEvent.setup();
    render(<App />);
    await nav(u, "My leave");
    const form = document.querySelector("#leave-form form");
    await u.clear(within(form).getByLabelText("Start date"));
    await u.type(within(form).getByLabelText("Start date"), "2026-11-02");
    const dayInput = within(form).getByRole("spinbutton", { name: "Number of days" });
    await u.clear(dayInput);
    await u.type(dayInput, "0.5");
    expect(within(form).getByLabelText("End date").value).toBe("2026-11-02");
    await u.type(within(form).getByLabelText("Reason"), "Medical appointment");
    await u.click(within(form).getByRole("button", { name: /submit request/i }));
    expect(await screen.findByText(/Leave L-2026-001 submitted for Mr Ravi: 0\.5 casual days/)).toBeTruthy();
    expect(document.querySelector(".leavetbl tbody tr").textContent).toContain("0.5");
    expect(JSON.parse(localStorage.getItem("srb-leaves"))[0].days).toBe(0.5);
  });

  it("reports render: class marks, marking sheet, rubric, absent list; grade-only hides GPA", async () => {
    seed({ "srb-theme": "dark", "srb-marks": { "2026|Term 1": [{ studentId: "1", name: "A", remark: "", modules: [{ moduleId: "m", moduleTitle: "Math", formative: 50, summative: 20, credit: 1, activities: [] }, { moduleId: "n", moduleTitle: "Art", absent: true, absentRemark: "Sick", credit: 1, activities: [] }] }] } });
    const u = userEvent.setup();
    render(<App />);
    await nav(u, "Reports");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.querySelector(".cards.screen .report-table-scroll")).toBeTruthy();
    await u.click(screen.getByRole("tab", { name: "Class marks" }));
    expect(document.querySelector(".classtbl")).toBeNull();
    expect(document.querySelector(".optbar")).toBeNull();
    expect(screen.queryByLabelText("Subject")).toBeNull();
    expect(document.querySelector(".art-class-score-sheet")).toBeTruthy();
    expect(document.querySelectorAll(".art-score-table tbody tr")).toHaveLength(21);
    const artScore = screen.getByLabelText(/Art sheet student 1,.*இனங்காணல்/);
    await u.type(artScore, "4");
    expect(screen.getByLabelText("Art sheet student 1, total").value).toBe("4");
    const studentDropdown = screen.getByLabelText("Art sheet student name 1");
    expect(studentDropdown.tagName).toBe("SELECT");
    expect([...studentDropdown.options].map((option) => option.textContent).join(" ")).toContain("A");
    expect(localStorage.getItem("srb-art-class-sheet-2026|Term 1")).not.toContain('"score-0":"4"');
    await u.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("srb-art-class-sheet-2026|Term 1")).rows["1"]["score-0"]).toBe("4");
    });
    expect(document.querySelector(".art-score-submit [role='status']").textContent).toBe("Art score sheet saved.");
    await u.click(screen.getByRole("tab", { name: "Marking sheet" }));
    expect(screen.getByText("புள்ளி வழங்கும் படிவம்")).toBeTruthy();
    await u.selectOptions(screen.getByLabelText("Sheet"), "class");
    expect(screen.getByText("Activity 4")).toBeTruthy();
    await u.click(screen.getByRole("tab", { name: "Rubric chart" }));
    expect(screen.getByLabelText("Rubric title")).toBeTruthy();
    await u.click(screen.getByRole("tab", { name: "Absent list" }));
    expect(screen.getByText("Sick")).toBeTruthy();
  });

  it("shows the Art Excel score sheet for all subjects even when no Art marks are recorded", async () => {
    seed({ "srb-marks": { "2026|Term 1": [{ studentId: "1", name: "Student", remark: "", modules: [{ moduleId: "tamil", moduleTitle: "Tamil", formative: 50, summative: 25, credit: 1, activities: [] }] }] } });
    const u = userEvent.setup();
    render(<App />);
    await nav(u, "Reports");
    await u.click(screen.getByRole("tab", { name: "Class marks" }));

    expect(document.querySelector(".art-class-score-sheet")).toBeTruthy();
    const studentDropdown = screen.getByLabelText("Art sheet student name 1");
    expect(studentDropdown.tagName).toBe("SELECT");
    expect(studentDropdown.options[studentDropdown.selectedIndex].textContent).toContain("Student");
  });

  it("shows all 36 PDF rubric charts by default, including chart 36", async () => {
    const u = userEvent.setup();
    render(<App />);
    await nav(u, "Reports");
    await u.click(screen.getByRole("tab", { name: "Rubric chart" }));

    expect(screen.getByLabelText("Chart").value).toBe("all");
    const charts = document.querySelectorAll(".tamil-chart");
    expect(charts).toHaveLength(36);
    expect(document.querySelectorAll(".tamil-chart tbody tr")).toHaveLength(144);
    expect([...screen.getByLabelText("Chart").options].some((option) => option.textContent.includes("…"))).toBe(false);
    expect(charts[35].textContent).toContain("ஆக்கத்தின் புதுமைப்பாடு");
    expect(charts[35].textContent).toContain("முன்வைத்தல், மதிப்பிடுதல் ஆகியவற்றின் வெற்றிகரத் தன்மை");
  });

  it("teacher role cannot edit GPA, approve leave or open grading settings", async () => {
    seed({ "srb-user": { name: "Teach", email: "t@b.co", role: "teacher" }, "srb-marks": { "2026|Term 1": [{ studentId: "1", name: "A", remark: "", modules: [{ moduleId: "m", moduleTitle: "Math", formative: 50, summative: 20, credit: 1 }] }] }, "srb-leaves": [{ id: "x", no: "L-2026-001", teacher: "A", type: "sick", from: "2026-11-02", to: "2026-11-02", days: 1, status: "pending", submitted: "2026-10-30", reason: "r" }] });
    const u = userEvent.setup();
    render(<App />);
    await nav(u, "Report builder");
    expect(document.getElementById("records").textContent).not.toMatch(/Edit/);
    expect(document.getElementById("grading").textContent).toMatch(/Only an admin/);
    await nav(u, "My leave");
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });
});
