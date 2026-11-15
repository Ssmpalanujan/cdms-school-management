import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.jsx";

const meta = { schoolName: "Test College", principal: "Mr P", grade: "Grade 6", className: "A", medium: "English", classTeacher: "Mr T", term: "Term 1", year: "2026", schedule: "tamil-sinhala", logoTrim: true };
const students = [{ id: "s1", index: "1001", name: "Kumar", gender: "Male", grade: "Grade 6", division: "A", dob: "", guardian: "" }, { id: "s2", index: "1002", name: "Nisha", gender: "Female", grade: "Grade 6", division: "A", dob: "", guardian: "" }];
const marks = { "2026|Term 1": [
  { studentId: "1001", name: "Kumar", remark: "", modules: [{ moduleId: "math", moduleTitle: "Mathematics", formative: 50, summative: 25, credit: 1 }] },
  { studentId: "1002", name: "Nisha", remark: "", modules: [{ moduleId: "math", moduleTitle: "Mathematics", formative: 40, summative: 10, credit: 1 }] },
] };
const put = (o) => Object.entries(o).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
const base = (user) => put({ "srb-user": user, "srb-meta": meta, "srb-students": students, "srb-marks": marks, "srb-owl-tips": false });
const admin = { name: "Admin One", email: "admin@school.lk", role: "admin" };
const sideNames = () => [...document.querySelector("nav").querySelectorAll("button")].map((b) => b.textContent.replace(/\d+$/, "").replace(/^(.*?)(Home|Builder|Students|Summary|Reports|Leave|News|Users|Results|Calendar|Guide)$/, "$1"));
const signOut = async (u) => { await u.click(screen.getByRole("button", { name: "Profile menu" })); await u.click(screen.getByRole("menuitem", { name: "Sign out" })); };
const signIn = async (u, id, pw) => {
  await u.type(await screen.findByLabelText("Username or email"), id);
  await u.type(screen.getByLabelText("Password"), pw);
  await u.click(screen.getAllByRole("button", { name: "Sign in" }).pop());
};

describe("admin, teacher and student dashboards", () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("uses a four-item mobile quick bar and opens the full authorized drawer", async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn((query) => ({ matches: query === "(max-width:900px)", media: query, addEventListener() {}, removeEventListener() {} }));
    try {
      base(admin);
      const u = userEvent.setup();
      render(<App />);
      expect(screen.getByRole("heading", { name: "Test College" })).toBeTruthy();
      expect(screen.getByText("Principal: Mr P")).toBeTruthy();
      expect(screen.getByLabelText("Academic year")).toBeTruthy();
      expect(screen.getByLabelText("Term")).toBeTruthy();
      expect(document.querySelector(".top > .pill.saved")).toBeTruthy();
      const quickNav = screen.getByRole("navigation", { name: "Quick navigation" });
      expect(within(quickNav).getByRole("button", { name: "Home" })).toBeTruthy();
      expect(within(quickNav).getByRole("button", { name: "Announcements" })).toBeTruthy();
      expect(within(quickNav).getByRole("button", { name: "Students" })).toBeTruthy();
      expect(within(quickNav).getByRole("button", { name: "Profile" })).toBeTruthy();
      expect(within(screen.getByRole("navigation", { name: "Pages" })).getByRole("button", { name: "My profile" }).classList.contains("nav-profile")).toBe(true);
      expect(quickNav.querySelectorAll("button")).toHaveLength(4);
      const announcementsTab = within(quickNav).getByRole("button", { name: "Announcements" });
      await u.click(announcementsTab);
      expect(document.activeElement).not.toBe(announcementsTab);

      await u.click(screen.getByRole("button", { name: "Open navigation menu" }));
      expect(document.querySelector(".side").classList.contains("mobile-open")).toBe(true);
      expect(document.querySelector(".side.mobile-open .sidecal").textContent).toContain("Signed in as Admin One");
      expect(document.querySelector(".side.mobile-open nav").compareDocumentPosition(document.querySelector(".side.mobile-open .sidecal")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      await u.click(within(screen.getByRole("navigation", { name: "Pages" })).getByRole("button", { name: "User accounts" }));
      expect(await screen.findByRole("heading", { name: "User accounts" })).toBeTruthy();
      expect(document.querySelector(".side").classList.contains("mobile-open")).toBe(false);

      await u.click(within(quickNav).getByRole("button", { name: "Profile" }));
      expect(await screen.findByRole("heading", { name: "My profile" })).toBeTruthy();
      expect(document.querySelector('[role="menu"]')).toBeNull();
      for (const action of ["Edit profile", "Dark mode", "Excel tools", "Weights & GPV", "Change password", "Sign out"]) {
        expect(screen.getAllByRole("button", { name: new RegExp(action) }).length).toBeGreaterThan(0);
      }
      await u.click(screen.getAllByRole("button", { name: "Edit profile" })[0]);
      expect(await screen.findByRole("heading", { name: "Edit profile" })).toBeTruthy();
      const profileDialog = screen.getByRole("dialog", { name: "Edit profile" });
      expect(profileDialog.classList.contains("tprofile")).toBe(true);
      expect(profileDialog.querySelector(".fieldwrap")).toBeTruthy();
      expect(profileDialog.querySelector(".profile-role").textContent).toBe("Role: Admin");
      expect(profileDialog.querySelector(".crow").parentElement).toBe(profileDialog);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("shows year management only to admins and hides the academic-year picker from staff and students", () => {
    base(admin);
    const adminView = render(<App />);
    expect(screen.getByLabelText("Academic year")).toBeTruthy();
    const academicYearsButton = within(screen.getByRole("navigation", { name: "Pages" })).getByRole("button", { name: "Academic years" });
    expect(academicYearsButton.querySelector("svg path").getAttribute("d")).toContain("M4 5h16v16H4z");
    adminView.unmount();

    base({ name: "Teacher One", username: "teacher1", role: "teacher" });
    const teacherView = render(<App />);
    expect(screen.queryByLabelText("Academic year")).toBeNull();
    expect(screen.getByText("Academic year 2026")).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: "Pages" })).queryByRole("button", { name: "Academic years" })).toBeNull();
    teacherView.unmount();

    base({ name: "Kumar", username: "1001", role: "student", studentId: "1001" });
    render(<App />);
    expect(screen.queryByLabelText("Academic year")).toBeNull();
    expect(screen.getByText("Academic year 2026")).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: "Pages" })).queryByRole("button", { name: "Academic years" })).toBeNull();
  });

  it("omits progress, activity history, and backups from the sidebar", () => {
    for (const user of [admin, { name: "Teacher One", username: "teacher1", role: "teacher" }]) {
      localStorage.clear();
      base(user);
      const { unmount } = render(<App />);
      const pages = within(screen.getByRole("navigation", { name: "Pages" }));
      for (const label of ["Student progress", "Activity history", "Backups & restore"]) {
        expect(pages.queryByRole("button", { name: label })).toBeNull();
      }
      unmount();
    }
  });

  it("shows Results and My attendance in the student mobile quick navigation", async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn((query) => ({ matches: query === "(max-width:900px)", media: query, addEventListener() {}, removeEventListener() {} }));
    try {
      base({ name: "Kumar", username: "1001", role: "student", studentId: "1001" });
      render(<App />);
      const quickNav = screen.getByRole("navigation", { name: "Quick navigation" });
      expect(within(quickNav).getByRole("button", { name: "Results" })).toBeTruthy();
      expect(within(quickNav).getByRole("button", { name: "My attendance" })).toBeTruthy();
      expect(within(quickNav).queryByRole("button", { name: "Students" })).toBeNull();
      expect(quickNav.querySelectorAll("button")).toHaveLength(5);
      expect(document.querySelector(".top > .pill.saved")).toBeTruthy();
      await userEvent.setup().click(within(quickNav).getByRole("button", { name: "My attendance" }));
      expect(await screen.findByRole("heading", { name: "My attendance" })).toBeTruthy();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("admin dashboard opens the teacher details form directly", async () => {
    base(admin);
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getByRole("button", { name: "Add teacher details" }));
    expect(await screen.findByRole("heading", { name: "Add teacher details" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Teacher details" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Teachers" })).toBeNull();
    expect(screen.getByLabelText("Teacher name")).toBeTruthy();
    expect(screen.getByLabelText("Subject")).toBeTruthy();
    expect(screen.getByLabelText("Subject").tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: "Mathematics" })).toBeTruthy();
    expect(screen.getByLabelText("Phone")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Qualifications")).toBeTruthy();
    expect(screen.getByLabelText("Address")).toBeTruthy();
    expect(screen.getByLabelText("Date joined")).toBeTruthy();
    await u.type(screen.getByLabelText("Teacher name"), "Mrs Silva");
    await u.selectOptions(screen.getByLabelText("Subject"), "Mathematics");
    await u.type(screen.getByLabelText("Phone"), "0771234567");
    await u.type(screen.getByLabelText("Email"), "silva@school.lk");
    await u.type(screen.getByLabelText("Qualifications"), "B.Ed");
    await u.type(screen.getByLabelText("Address"), "Karaitivu");
    await u.type(screen.getByLabelText("Date joined"), "2020-01-15");
    expect(screen.getByRole("button", { name: "Add teacher" }).closest(".form-actions")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Add teacher" }));
    expect(await screen.findByText("silva@school.lk")).toBeTruthy();
    expect(screen.getByText("B.Ed")).toBeTruthy();
    expect(screen.getByText("Karaitivu")).toBeTruthy();
    expect(screen.getByText("2020-01-15")).toBeTruthy();
  });

  it("admin sidebar has a direct Teacher details page and teachers cannot access it", async () => {
    base(admin);
    const u = userEvent.setup();
    const { unmount } = render(<App />);
    const nav = within(document.querySelector("nav"));
    expect(nav.queryByRole("button", { name: "Teacher leave" })).toBeNull();
    expect(nav.queryByRole("button", { name: "Assign teachers" })).toBeNull();
    await u.click(nav.getByRole("button", { name: "Teacher details" }));
    expect(await screen.findByRole("heading", { name: "Add teacher details" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Teacher details" })).toBeTruthy();
    const teacherPageNav = screen.getByRole("navigation", { name: "Teacher pages" });
    expect(within(teacherPageNav).getByRole("button", { name: "Teacher details" }).getAttribute("aria-current")).toBe("page");
    expect(within(teacherPageNav).getAllByRole("button")).toHaveLength(3);
    expect(within(teacherPageNav).getByRole("button", { name: "Assign teachers" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Teachers" })).toBeNull();
    await u.click(within(teacherPageNav).getByRole("button", { name: "Assign teachers" }));
    expect(await screen.findByRole("heading", { name: "Assign teachers" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Assign class and subject teachers" })).toBeTruthy();
    const assignmentNav = screen.getByRole("navigation", { name: "Teacher pages" });
    expect(within(assignmentNav).getByRole("button", { name: "Assign teachers" }).getAttribute("aria-current")).toBe("page");
    await u.click(within(screen.getByRole("navigation", { name: "Pages" })).getByRole("button", { name: "Teacher details" }));
    await u.click(within(screen.getByRole("navigation", { name: "Teacher pages" })).getByRole("button", { name: "Teacher leave" }));
    expect(await screen.findByRole("heading", { name: "Teacher leave" })).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: "Teacher pages" })).getByRole("button", { name: "Assign teachers" })).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: "Teacher pages" })).getByRole("button", { name: "Teacher details" })).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: "Teacher pages" })).getByRole("button", { name: "Teacher leave" }).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("tab", { name: "Teachers" })).toBeNull();
    await u.click(within(screen.getByRole("navigation", { name: "Teacher pages" })).getByRole("button", { name: "Teacher details" }));
    expect(await screen.findByRole("heading", { name: "Add teacher details" })).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: "Teacher pages" })).getByRole("button", { name: "Teacher details" }).getAttribute("aria-current")).toBe("page");

    unmount();
    localStorage.clear();
    base({ name: "Mr Ravi", username: "ravi", role: "teacher" });
    render(<App />);
    expect(within(document.querySelector("nav")).queryByRole("button", { name: "Teacher details" })).toBeNull();
  });

  it("summarizes and filters academic years", async () => {
    base(admin);
    put({ "srb-academic-years": [
      { year: "2024", closed: true, current: false },
      { year: "2025", closed: false, current: false },
      { year: "2026", closed: false, current: true },
    ] });
    const u = userEvent.setup();
    render(<App />);
    await u.click(within(screen.getByRole("navigation", { name: "Pages" })).getByRole("button", { name: "Academic years" }));

    expect(screen.getByText("Academic year records")).toBeTruthy();
    expect(screen.getByText("Available for school records")).toBeTruthy();
    expect(screen.getByText("Read-only history")).toBeTruthy();
    expect([...document.querySelectorAll(".academic-year-table tbody tr td:first-child")].map((cell) => cell.textContent)).toEqual(["2026", "2025", "2024"]);

    await u.selectOptions(screen.getByLabelText("Filter academic years"), "closed");
    const yearTable = within(document.querySelector(".academic-year-table"));
    expect(yearTable.getByText("2024")).toBeTruthy();
    expect(yearTable.queryByText("2025")).toBeNull();
    await u.type(screen.getByRole("searchbox", { name: "Search academic years" }), "2023");
    expect(screen.getByText("No academic years match these filters.")).toBeTruthy();
  });

  it("shows student records from all available classes when selected", async () => {
    base(admin);
    put({
      "srb-meta": meta,
      "srb-students": [...students, { id: "s3", index: "1003", name: "Ravi", gender: "Male", grade: "Grade 7", division: "B", dob: "", guardian: "" }],
      "srb-academic-years": [{ year: "2026", current: true, closed: false }],
      "srb-class-assignments": [
        { year: "2026", grade: "Grade 6", division: "A", classTeacherId: "teacher-a", subjects: [] },
        { year: "2026", grade: "Grade 7", division: "B", classTeacherId: "teacher-b", subjects: [] },
      ],
    });
    const u = userEvent.setup();
    render(<App />);
    await u.click(within(document.querySelector("nav")).getByRole("button", { name: "Class record" }));

    const classFilter = screen.getByLabelText("Class record class");
    expect(within(classFilter).getByRole("option", { name: "All classes" })).toBeTruthy();
    expect([...classFilter.options].filter((option) => option.value.startsWith("__grade__:"))).toHaveLength(13);
    expect(classFilter.value).toBe("__all_classes__");
    await u.selectOptions(classFilter, "__grade__:Grade 6");
    expect(screen.getByRole("button", { name: "View student details for Kumar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View student details for Nisha" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "View student details for Ravi" })).toBeNull();
    await u.selectOptions(classFilter, "__all_classes__");
    expect(screen.getByRole("button", { name: "View student details for Kumar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View student details for Nisha" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View student details for Ravi" })).toBeTruthy();
  });

  it("shows class record students as profiles and opens complete student details", async () => {
    base(admin);
    put({
      "srb-students": [
        { ...students[0], gender: "Male", dob: "2014-05-12", guardian: "0771234567", email: "kumar@example.lk" },
        { ...students[1], grade: "Grade 7", division: "B" },
      ],
      "srb-users": [{ name: "Kumar", role: "student", studentId: "1001", photo: "data:image/png;base64,aGVsbG8=" }],
      "srb-academic-years": [{ year: "2026", current: true, closed: false }],
      "srb-class-assignments": [{ year: "2026", grade: "Grade 6", division: "A", classTeacherId: "teacher-a", subjects: [] }],
      "srb-attendance": { "2026-03-01": { "1001": { status: "Present" } } },
    });
    const u = userEvent.setup();
    render(<App />);
    await u.click(within(document.querySelector("nav")).getByRole("button", { name: "Class record" }));
    await u.selectOptions(screen.getByLabelText("Class record class"), "__all_classes__");

    const studentCard = screen.getByRole("button", { name: "View student details for Kumar" });
    expect(within(studentCard).getByRole("img", { name: "Kumar profile image" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View student details for Nisha" })).toBeTruthy();
    await u.click(studentCard);

    const dialog = screen.getByRole("dialog", { name: "Kumar" });
    expect(within(dialog).getByText("kumar@example.lk")).toBeTruthy();
    expect(within(dialog).getByText("0771234567")).toBeTruthy();
    expect(within(dialog).getByText("2014-05-12")).toBeTruthy();
    expect(within(dialog).getByRole("row", { name: "2026-03-01 Present" })).toBeTruthy();
    await u.click(within(dialog).getByRole("button", { name: "Close student details" }));
    expect(screen.queryByRole("dialog", { name: "Kumar" })).toBeNull();
  });

  it("shows a teacher only the details linked to that account, not a same-name colleague", async () => {
    base({ name: "Mr Ravi", email: "ravi@school.lk", role: "teacher" });
    put({ "srb-teachers": [
      { id: "own", accountId: "ravi@school.lk", name: "Mr Ravi", dateOfBirth: "1980-01-01", dateJoined: "2000-01-01", subject: "Mathematics", phone: "0771234567" },
      { id: "other", accountId: "other@school.lk", name: "Mr Ravi", dateOfBirth: "1960-01-01", dateJoined: "1980-01-01", subject: "Science", phone: "0711234567" },
    ] });
    render(<App />);
    expect(await screen.findByText("My pension")).toBeTruthy();
    expect(screen.getByText("1980-01-01")).toBeTruthy();
    expect(screen.queryByText("1960-01-01")).toBeNull();
    expect(screen.getByText("Mathematics")).toBeTruthy();
    expect(screen.queryByText("Science")).toBeNull();
  });

  it("lets a new class teacher request prior published records and shows them only after the old teacher approves", async () => {
    const newTeacher = { name: "New Teacher", username: "new-teacher", role: "teacher" };
    const oldTeacher = { name: "Old Teacher", username: "old-teacher", role: "teacher" };
    base(newTeacher);
    put({
      "srb-meta": { ...meta, year: "2027", grade: "Grade 7", className: "B" },
      "srb-users": [newTeacher, oldTeacher],
      "srb-academic-years": [{ year: "2027", current: true, closed: false }, { year: "2026", current: false, closed: true }],
      "srb-students": [{ index: "1001", name: "Kumar", grade: "Grade 7", division: "B" }],
      "srb-class-assignments": [
        { year: "2026", grade: "Grade 6", division: "A", classTeacherId: "old-teacher", subjects: [] },
        { year: "2027", grade: "Grade 7", division: "B", classTeacherId: "new-teacher", subjects: [] },
      ],
      "srb-enrollments": [
        { studentId: "1001", year: "2026", grade: "Grade 6", division: "A" },
        { studentId: "1001", year: "2027", grade: "Grade 7", division: "B" },
      ],
      "srb-results-workflow": { sheets: {}, audit: [], notifications: [], classes: {
        old: {
          year: "2026", term: "Term 1", grade: "Grade 6", division: "A", published: true,
          students: [{ index: "1001", name: "Kumar" }],
          scale: [],
          subjects: [{ subject: "Mathematics", marks: [{ studentId: "1001", name: "Kumar", formative: 40, summative: 50, credit: 1, activities: [{ name: "Quiz", score: 8, max: 10 }] }] }],
        },
      } },
    });
    const u = userEvent.setup();
    const first = render(<App />);
    await u.click(within(document.querySelector("nav")).getByRole("button", { name: "Class record" }));
    await u.click(screen.getByRole("tab", { name: "Promotions & sharing" }));
    await u.click(await screen.findByRole("button", { name: "Request records" }));
    expect(JSON.parse(localStorage.getItem("srb-history-requests"))[0]).toMatchObject({
      status: "Pending", senderId: "new-teacher", receiverId: "old-teacher", students: [{ studentId: "1001", name: "Kumar" }],
    });
    first.unmount();

    localStorage.setItem("srb-user", JSON.stringify(oldTeacher));
    const second = render(<App />);
    await u.click(within(document.querySelector("nav")).getByRole("button", { name: "Class record" }));
    await u.click(screen.getByRole("tab", { name: "Promotions & sharing" }));
    await u.click(await screen.findByRole("button", { name: "Approve and share records" }));
    expect(JSON.parse(localStorage.getItem("srb-history-requests"))[0].status).toBe("Accepted");
    second.unmount();

    localStorage.setItem("srb-user", JSON.stringify(newTeacher));
    render(<App />);
    const history = screen.getByRole("heading", { name: "Published student history · read-only" }).closest(".card");
    expect(within(history).getByText("1001")).toBeTruthy();
    expect(within(history).getByText("Quiz: 8/10")).toBeTruthy();
    expect([...history.querySelectorAll("thead th")].map((cell) => cell.textContent)).toContain("Final GPA");
    expect(within(history).getByRole("row", { name: /Kumar.*1001.*2026.*Mathematics/ })).toBeTruthy();
  });

  it("shares selected class records with a named teacher and keeps the recipient view read-only", async () => {
    const sender = { name: "Class Teacher", username: "class-teacher", email: "class@example.lk", role: "teacher" };
    const receiver = { name: "Receiving Teacher", username: "receiving-teacher", email: "receiver@example.lk", role: "teacher" };
    put({
      "srb-user": sender, "srb-users": [sender, receiver], "srb-meta": meta,
      "srb-students": students,
      "srb-academic-years": [{ year: "2026", current: true, closed: false }],
      "srb-class-assignments": [{ year: "2026", grade: "Grade 6", division: "A", classTeacherId: "class-teacher", subjects: [] }],
      "srb-enrollments": students.map((student) => ({ studentId: student.index, year: "2026", grade: "Grade 6", division: "A" })),
      "srb-attendance": { "2026-03-01": { "1001": { status: "Present" }, "1002": { status: "Absent" } } },
      "srb-results-workflow": { sheets: {}, classes: {}, audit: [], notifications: [] },
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const u = userEvent.setup();
    const first = render(<App />);
    await u.click(within(document.querySelector("nav")).getByRole("button", { name: "Class record" }));
    await u.click(screen.getByRole("tab", { name: "Promotions & sharing" }));
    const roster = screen.getByRole("heading", { name: "My class roster and attendance" }).closest(".card");
    expect(within(roster).getAllByText("Class Teacher").length).toBeGreaterThan(0);
    expect(within(roster).getByText("Attendance details")).toBeTruthy();
    await u.selectOptions(screen.getByLabelText("Share with teacher"), "receiving-teacher");
    await u.click(screen.getByLabelText("Share Kumar"));
    await u.click(screen.getByRole("button", { name: "Share selected records" }));
    expect(JSON.parse(localStorage.getItem("srb-record-shares"))[0]).toMatchObject({
      senderId: "class-teacher", receiverId: "receiving-teacher", status: "Shared",
      studentIds: ["1001"], sourceYear: "2026", attendance: { "2026-03-01": { "1001": { status: "Present" } } },
    });
    first.unmount();

    localStorage.setItem("srb-user", JSON.stringify(receiver));
    render(<App />);
    await u.click(within(document.querySelector("nav")).getByRole("button", { name: "Class record" }));
    await u.click(screen.getByRole("tab", { name: "Promotions & sharing" }));
    const shared = screen.getByRole("heading", { name: "Records shared with me · read-only" }).closest(".card");
    expect(within(shared).getByText("Kumar")).toBeTruthy();
    expect(within(shared).getByText("1001")).toBeTruthy();
    expect(within(shared).getByText("1/0/0/0")).toBeTruthy();
    expect(within(shared).getByText("1 marked day(s)")).toBeTruthy();
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("shows all class subject sheets to class teachers/admins and only a subject teacher's own entered marks", async () => {
    const classTeacher = { name: "Class Teacher", username: "class-teacher", role: "teacher" };
    const mathTeacher = { name: "Math Teacher", username: "math-teacher", role: "teacher" };
    const scienceTeacher = { name: "Science Teacher", username: "science-teacher", role: "teacher" };
    const assignment = {
      year: "2026", grade: "Grade 6", division: "A", classTeacherId: "class-teacher",
      subjects: [{ subject: "Mathematics", teacherId: "math-teacher" }, { subject: "Science", teacherId: "science-teacher" }],
    };
    const mathSheet = {
      year: "2026", term: "Term 1", grade: "Grade 6", division: "A", subject: "Mathematics",
      teacherId: "math-teacher", status: "Draft",
      marks: [{ studentId: "1001", name: "Kumar", formative: 50, summative: 20, activities: [{ name: "Quiz", score: 8, max: 10 }] }],
    };
    const scienceSheet = {
      ...mathSheet, subject: "Science", teacherId: "science-teacher",
      marks: [{ studentId: "1002", name: "Nisha", formative: 40, summative: 25, activities: [] }],
    };
    const storage = {
      "srb-meta": meta,
      "srb-students": students,
      "srb-academic-years": [{ year: "2026", current: true, closed: false }],
      "srb-class-assignments": [assignment],
      "srb-enrollments": students.map((student) => ({ studentId: student.index, year: "2026", grade: "Grade 6", division: "A" })),
      "srb-attendance": {
        "2025-10-14": { "1001": { status: "Present" } },
        "2026-10-14": { "1002": { status: "Absent" } },
      },
      "srb-results-workflow": {
        sheets: {
          "2026|term 1|grade 6|a|mathematics": mathSheet,
          "2026|term 1|grade 6|a|science": scienceSheet,
        },
        classes: {}, audit: [], notifications: [],
      },
    };
    const u = userEvent.setup();
    put({ ...storage, "srb-user": classTeacher, "srb-users": [classTeacher, mathTeacher, scienceTeacher] });
    const teacherView = render(<App />);
    await u.click(within(document.querySelector("nav")).getByRole("button", { name: "Class record" }));
    const marksTable = screen.getByRole("heading", { name: "Student marks and attendance" }).closest(".card");
    await u.click(within(marksTable).getByRole("button", { name: "View student details for Kumar" }));
    const kumarDetails = screen.getByRole("dialog", { name: "Kumar" });
    const kumarMarks = within(kumarDetails.querySelector(".student-record-marks-table"));
    expect(kumarMarks.getByText("Mathematics")).toBeTruthy();
    expect(kumarMarks.getByText("Science")).toBeTruthy();
    expect(kumarMarks.getByText("Quiz: 8/10")).toBeTruthy();
    expect(kumarMarks.getByText("Draft")).toBeTruthy();
    await u.click(within(kumarDetails).getByRole("button", { name: "Close student details" }));
    await u.type(within(marksTable).getByRole("searchbox", { name: "Search students" }), "Nisha");
    expect(within(marksTable).queryByRole("button", { name: "View student details for Kumar" })).toBeNull();
    expect(within(marksTable).getByRole("button", { name: "View student details for Nisha" })).toBeTruthy();
    teacherView.unmount();

    put({ ...storage, "srb-user": admin, "srb-users": [admin, classTeacher, mathTeacher, scienceTeacher] });
    const adminView = render(<App />);
    await u.click(within(document.querySelector("nav")).getByRole("button", { name: "Class record" }));
    const adminCard = screen.getByRole("heading", { name: "Student marks and attendance" }).closest(".card");
    await u.click(within(adminCard).getByRole("button", { name: "View student details for Kumar" }));
    const adminDetails = screen.getByRole("dialog", { name: "Kumar" });
    const adminMarksTable = adminDetails.querySelector(".student-record-marks-table");
    expect(within(adminMarksTable).getByText("Mathematics")).toBeTruthy();
    expect(within(adminMarksTable).getByText("Science")).toBeTruthy();
    expect(within(adminMarksTable).getByText("Quiz: 8/10")).toBeTruthy();
    expect(within(adminDetails).getByRole("row", { name: "2025-10-14 Present" })).toBeTruthy();
    await u.click(within(adminDetails).getByRole("button", { name: "Close student details" }));
    adminView.unmount();

    put({ ...storage, "srb-user": mathTeacher, "srb-users": [classTeacher, mathTeacher, scienceTeacher] });
    const subjectView = render(<App />);
    await u.click(within(document.querySelector("nav")).getByRole("button", { name: "Class record" }));
    const subjectMarks = screen.getByRole("heading", { name: "Student marks and attendance" }).closest(".card");
    expect(within(subjectMarks).getByRole("button", { name: "View student details for Kumar" })).toBeTruthy();
    expect(within(subjectMarks).queryByRole("button", { name: "View student details for Nisha" })).toBeNull();
    await u.click(within(subjectMarks).getByRole("button", { name: "View student details for Kumar" }));
    const subjectDetails = screen.getByRole("dialog", { name: "Kumar" });
    expect(within(subjectDetails.querySelector(".student-record-marks-table")).getByText("Mathematics")).toBeTruthy();
    expect(within(subjectDetails.querySelector(".student-record-marks-table")).queryByText("Science")).toBeNull();
    subjectView.unmount();

    put({ ...storage, "srb-user": admin, "srb-users": [admin, classTeacher, mathTeacher, scienceTeacher] });
    render(<App />);
    await u.click(within(document.querySelector("nav")).getByRole("button", { name: "Class record" }));
    const adminMarks = screen.getByRole("heading", { name: "Student marks and attendance" }).closest(".card");
    expect(within(adminMarks).getByRole("button", { name: "View student details for Kumar" })).toBeTruthy();
    expect(within(adminMarks).getByRole("button", { name: "View student details for Nisha" })).toBeTruthy();
  });

  it("admin profile photo appears in the avatar and class-teacher photo upload is removed from the builder", async () => {
    const teacherPhoto = "data:image/png;base64,TEACHER";
    const adminPhoto = "data:image/png;base64,ADMIN";
    base(admin);
    put({
      "srb-meta": { ...meta, teacherPhoto },
      "srb-user": { ...admin, photo: adminPhoto },
      "srb-users": [{ ...admin, photo: adminPhoto, hash: "admin-hash" }],
    });
    const u = userEvent.setup();
    render(<App />);
    const avatar = screen.getByRole("button", { name: "Profile menu" });
    expect(avatar.querySelector("img").getAttribute("src")).toBe(adminPhoto);
    await u.click(avatar);
    await u.click(screen.getByRole("menuitem", { name: "Edit profile" }));
    expect(await screen.findByRole("dialog", { name: "Edit profile" })).toBeTruthy();
    expect(screen.getByText("Role: Admin")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Cancel" }));
    await u.click(screen.getAllByRole("button", { name: /^Report builder/ })[0]);
    expect(screen.queryByText("Class teacher photo")).toBeNull();
    expect(screen.queryByRole("button", { name: "Upload photo" })).toBeNull();
  });

  it("admin dashboard keeps the school logo in profile controls, not the sidebar status box", () => {
    const adminPhoto = "data:image/png;base64,ADMIN-DASHBOARD";
    base(admin);
    put({
      "srb-user": admin,
      "srb-users": [{ ...admin, photo: adminPhoto, hash: "admin-hash" }],
      "srb-meta": { ...meta, logo: "data:image/png;base64,SCHOOL-LOGO" },
    });
    render(<App />);
    expect(document.querySelector(".hero .crest").getAttribute("src")).toBe(adminPhoto);
    expect(document.querySelector(".hero .crest").getAttribute("alt")).toBe("Admin profile");
    expect(document.querySelector(".sidecal .side-user-photo")).toBeNull();
    expect(document.querySelector(".sidecal .side-user").textContent).toBe("Signed in as Admin One");
    expect(screen.getByRole("button", { name: "Profile menu" }).querySelector("img").getAttribute("src")).toBe("data:image/png;base64,SCHOOL-LOGO");
  });

  it("admin and teachers see student photos, and admins see teacher photos in their lists", async () => {
    const studentPhoto = "data:image/png;base64,STUDENT";
    const teacherPhoto = "data:image/png;base64,TEACHER";
    base(admin);
    put({
      "srb-users": [
        { ...admin, hash: "admin-hash" },
        { name: "Kumar", username: "1001", role: "student", studentId: "1001", photo: studentPhoto, hash: "student-hash" },
        { name: "Nisha", username: "1002", role: "student", studentId: "1002", photo: studentPhoto, hash: "student-hash" },
        { name: "Mrs Silva", username: "silva", role: "teacher", photo: teacherPhoto, hash: "teacher-hash" },
      ],
      "srb-teachers": [{ id: "teacher-1", name: "Mrs Silva", subject: "Mathematics", phone: "123456789" }],
    });
    const u = userEvent.setup();
    const { unmount } = render(<App />);
    await u.click(screen.getAllByRole("button", { name: /^Students/ })[0]);
    expect(screen.getByRole("button", { name: "Add student" }).closest(".form-actions")).toBeTruthy();
    const studentHeaders = [...document.querySelectorAll(".tbl.stu thead th")].map((cell) => cell.textContent.trim());
    expect(studentHeaders[0]).toBe("Student");
    expect(studentHeaders[1]).toBe("Index no");
    expect(studentHeaders).not.toContain("No.");
    expect(document.querySelector(".tbl.stu tbody img").getAttribute("src")).toBe(studentPhoto);

    await u.click(screen.getAllByRole("button", { name: "Teacher details" })[0]);
    expect(screen.queryByRole("tab", { name: "Teachers" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Add teacher details" })).toBeTruthy();
    expect(document.querySelector(".tbl:not(.small) tbody img").getAttribute("src")).toBe(teacherPhoto);
    unmount();

    base({ name: "Mr Ravi", username: "ravi", role: "teacher" });
    put({
      "srb-users": [
        { name: "Mr Ravi", username: "ravi", role: "teacher", hash: "teacher-hash" },
        { name: "Kumar", username: "1001", role: "student", studentId: "1001", photo: studentPhoto, hash: "student-hash" },
      ],
    });
    render(<App />);
    const myStudents = screen.getByRole("heading", { name: "My students" }).closest(".card");
    expect(within(myStudents).getByRole("img", { name: "Kumar profile image" }).querySelector("img").getAttribute("src")).toBe(studentPhoto);
  });

  it("admin creates separate logins; the student signs in directly and sees only student pages", async () => {
    base(admin);
    put({
      "srb-users": [{ ...admin, hash: "x" }],
      "srb-attendance": {
        "2026-10-26": { "1001": { status: "Present" }, "1002": { status: "Absent" } },
        "2026-10-25": { "1001": { status: "Late" } },
      },
      "srb-teachers": [
        { id: "teacher-ravi", name: "Mr Ravi", subject: "Mathematics" },
        { id: "teacher-other", name: "Other", subject: "Science" },
      ],
    });
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getAllByRole("button", { name: /^User accounts/ })[0]);
    expect(screen.getByRole("button", { name: "Add teacher login" }).closest(".form-actions")).toBeTruthy();
    await u.selectOptions(screen.getByLabelText("Role"), "student");
    await u.selectOptions(screen.getByLabelText("Student"), "1001");
    expect(screen.getByLabelText("Student").value).toBe("1001");
    await u.type(screen.getByLabelText("Email address"), "kumar@school.lk");
    await u.type(screen.getByLabelText("Password"), "kumar-pass-1");
    await u.click(screen.getByRole("button", { name: "Create student login" }));
    expect(await screen.findByText(/Share these details with Kumar/)).toBeTruthy();
    await u.selectOptions(screen.getByLabelText("Role"), "teacher");
    expect(screen.getByLabelText("Teacher").tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: /Mr Ravi/ })).toBeTruthy();
    await u.selectOptions(screen.getByLabelText("Teacher"), "teacher-ravi");
    await u.clear(screen.getByLabelText("Username"));
    await u.type(screen.getByLabelText("Username"), "ravi");
    await u.type(screen.getByLabelText("Email address"), "ravi@school.lk");
    await u.type(screen.getByLabelText("Password"), "ravi-pass-22");
    await u.click(screen.getByRole("button", { name: "Add teacher login" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("srb-users")).length).toBe(3));
    const stored = JSON.parse(localStorage.getItem("srb-users"));
    expect(stored.every((x) => !JSON.stringify(x).includes("pass-"))).toBe(true); // passwords are hashed
    await u.selectOptions(screen.getByLabelText("Teacher"), "teacher-other");
    await u.clear(screen.getByLabelText("Username"));
    await u.type(screen.getByLabelText("Username"), "ravi"); // duplicate username is refused
    await u.type(screen.getByLabelText("Email address"), "other@school.lk");
    await u.type(screen.getByLabelText("Password"), "another-pass");
    await u.click(screen.getByRole("button", { name: "Add teacher login" }));
    expect(await screen.findByText("This username is already used.")).toBeTruthy();

    await signOut(u);
    await signIn(u, "1001", "wrong-password");
    expect(await screen.findByText("Username or password is incorrect.")).toBeTruthy();
    await u.clear(screen.getByLabelText("Password")); await u.type(screen.getByLabelText("Password"), "kumar-pass-1");
    await u.click(screen.getAllByRole("button", { name: "Sign in" }).pop());
    expect(await screen.findByText("Welcome to", {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Test College" })).toBeTruthy();
    expect(screen.getByText("Hello, Kumar")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Student dashboard", { selector: ".chip" })).toBeTruthy();
    const names = [...document.querySelector("nav").querySelectorAll("button")].map((b) => b.querySelector(".lbl").textContent);
    expect(names).toEqual(["Student dashboard", "My results", "My attendance", "Announcements", "Term calendar", "My profile"]);
    expect(screen.queryByText(/Report builder/)).toBeNull();
    // Legacy marks stay hidden until a class teacher publishes the results.
    expect(screen.getByText(/There are no published results for your class yet/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Mathematics/);
    expect(document.body.textContent).not.toMatch(/Nisha/);
    await u.click(within(document.querySelector("nav")).getByRole("button", { name: "My attendance" }));
    expect(await screen.findByRole("heading", { name: "My attendance" })).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
    const attendanceTable = within(document.querySelector(".student-attendance-table"));
    expect(attendanceTable.getByText("Present").closest("tr").textContent).toMatch(/2026-10-26/);
    expect(attendanceTable.getByText("Late").closest("tr").textContent).toMatch(/2026-10-25/);
    expect(screen.queryByText("Nisha")).toBeNull();
    expect(document.querySelector(".student-attendance-table select")).toBeNull();
    await u.click(within(screen.getByRole("navigation", { name: "Quick navigation" })).getByRole("button", { name: "Profile" }));
    expect(await screen.findByRole("heading", { name: "My profile" })).toBeTruthy();
    expect([...document.querySelectorAll(".profile-action b")].map((item) => item.textContent)).toEqual(["Edit profile", "Dark mode", "Change password", "Sign out"]);
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it("shows account profile photos and resets passwords in a centered app dialog", async () => {
    const teacherPhoto = "data:image/png;base64,ACCOUNT-TEACHER";
    base(admin);
    put({
      "srb-users": [
        { ...admin, hash: "admin-hash" },
        { name: "Mr Ravi", username: "ravi", role: "teacher", photo: teacherPhoto, hash: "teacher-hash" },
      ],
    });
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getAllByRole("button", { name: /^User accounts/ })[0]);
    const row = within(document.querySelector(".acctbl")).getByRole("row", { name: /Mr Ravi/ });
    expect(within(row).getByRole("img", { name: "Mr Ravi profile image" }).querySelector("img").getAttribute("src")).toBe(teacherPhoto);
    await u.click(within(row).getByRole("button", { name: "Reset password" }));
    const dialog = screen.getByRole("dialog", { name: "Reset password" });
    expect(dialog.closest(".modal")).toBeTruthy();
    await u.type(within(dialog).getByLabelText("New password"), "new-ravi-pass");
    await u.click(within(dialog).getByRole("button", { name: "Save password" }));
    expect(await screen.findByText(/Share these details with Mr Ravi/)).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Reset password" })).toBeNull();
    expect(JSON.parse(localStorage.getItem("srb-users")).find((account) => account.username === "ravi").hash).not.toBe("teacher-hash");
  });

  it("announcements: admin and teachers post, students only see the ones meant for them", async () => {
    base(admin);
    put({ "srb-announce": [
      { id: "a1", title: "Staff meeting on Friday", body: "Staff room at 2 pm", audience: "teachers", priority: "normal", author: "Admin One", role: "admin", at: Date.now() },
      { id: "a2", title: "Sports day", body: "Wear house colours", audience: "students", priority: "important", author: "Admin One", role: "admin", at: Date.now() },
    ] });
    const u = userEvent.setup();
    const { unmount } = render(<App />);
    await u.click(screen.getAllByRole("button", { name: /^Announcements/ })[0]);
    await u.type(screen.getByLabelText("Title"), "Exam timetable");
    await u.type(screen.getByLabelText("Message"), "Term 1 exams start on Monday");
    await u.click(screen.getByRole("button", { name: "Post announcement" }));
    expect(await screen.findByText("Exam timetable")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Post announcement" }));
    expect(await screen.findByText("Enter a title (at least 3 characters).")).toBeTruthy();
    unmount(); localStorage.removeItem("srb-user");
    put({ "srb-user": { name: "Kumar", username: "1001", role: "student", studentId: "1001" } });
    render(<App />);
    await u.click(screen.getAllByRole("button", { name: /^Announcements/ })[0]);
    expect(screen.getAllByText("Sports day").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Exam timetable").length).toBeGreaterThan(0);
    expect(screen.queryByText("Staff meeting on Friday")).toBeNull();
    expect(screen.queryByRole("button", { name: "Post announcement" })).toBeNull(); // students cannot post
  });

  it("teacher: own dashboard, can post announcements, leave form fixed to own name with days setting the end date, sees only own leave", async () => {
    base({ name: "Mr Ravi", username: "ravi", role: "teacher" });
    put({ "srb-leaves": [
      { id: "l1", no: "L-2026-001", teacher: "Mr Ravi", type: "sick", from: "2026-11-02", to: "2026-11-03", days: 2, status: "approved", submitted: "2026-10-30", reason: "Fever" },
      { id: "l2", no: "L-2026-002", teacher: "Mrs Other", type: "casual", from: "2026-11-09", to: "2026-11-09", days: 1, status: "pending", submitted: "2026-11-01", reason: "Private" },
    ] });
    const u = userEvent.setup();
    render(<App />);
    expect(screen.getAllByText("Teacher dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hello, Mr Ravi/).length).toBeGreaterThan(0);
    await u.click(screen.getAllByRole("button", { name: /^My leave/ })[0]);
    const form = document.getElementById("leave-form");
    expect(within(form).getByRole("button", { name: "Submit request" }).closest(".form-actions")).toBeTruthy();
    expect(within(form).getByLabelText("Teacher name").readOnly).toBe(true);
    expect(within(form).getByLabelText("Teacher name").value).toBe("Mr Ravi");
    await u.type(within(form).getByLabelText("Start date"), "2026-11-06"); // a Friday
    await u.type(within(form).getByRole("spinbutton", { name: "Number of days" }), "2");
    expect(within(form).getByLabelText("End date").value).toBe("2026-11-09"); // Friday + Monday
    await u.type(within(form).getByLabelText("Reason"), "Family function");
    await u.selectOptions(within(form).getByLabelText("Leave type"), "casual");
    await u.click(within(form).getByRole("button", { name: "Submit request" }));
    expect(await screen.findByText(/Leave L-2026-003 submitted for Mr Ravi: 2 casual days/)).toBeTruthy();
    const table = document.querySelector(".leavetbl");
    expect(within(table).queryByText(/Mrs Other/)).toBeNull(); // other teachers' leave is not shown
    expect(within(table).getByText("L-2026-003")).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Teachers" })).toBeNull();
    await u.click(screen.getAllByRole("button", { name: /^Announcements/ })[0]);
    expect(screen.getByRole("button", { name: "Post announcement" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Post announcement" }).closest(".announcement-actions")).toBeTruthy();
  });

  it("teacher dashboard loads the saved account photo even when the current session is stale", async () => {
    const photo = "data:image/png;base64,AAAA";
    base({ name: "Mr Ravi", username: "ravi", role: "teacher" });
    put({ "srb-users": [{ name: "Mr Ravi", username: "ravi", role: "teacher", photo, hash: "saved-hash" }] });
    render(<App />);
    expect(document.querySelector(".hero2 .avatar2 img").getAttribute("src")).toBe(photo);
    expect(document.querySelector(".hero2 .heroText").textContent).toContain("Test College");
  });

  it("teacher can search for a student and open marks from multiple terms", async () => {
    base({ name: "Mr Ravi", username: "ravi", role: "teacher" });
    put({
      "srb-marks": {
        "2026|Term 1": [{
          studentId: "1001", name: "Kumar", remark: "Good progress",
          modules: [{ moduleId: "math", moduleTitle: "Mathematics", formative: 50, summative: 25, credit: 1, activities: [{ mark: 8, max: 10 }] }],
        }],
        "2026|Term 2": [{
          studentId: "1001", name: "Kumar", remark: "",
          modules: [{ moduleId: "sci", moduleTitle: "Science", formative: 45, summative: 20, credit: 1, activities: [] }],
        }],
      },
    });
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getAllByRole("button", { name: /^Students/ })[0]);
    await u.type(screen.getByRole("searchbox", { name: "Search students" }), "1001");
    await u.click(screen.getByRole("button", { name: "View marks for Kumar" }));
    const detail = screen.getByRole("region", { name: "Kumar marks" });
    expect(within(detail).getByRole("heading", { name: "Marks for Kumar" })).toBeTruthy();
    expect(within(detail).getByText("Term 1 2026")).toBeTruthy();
    expect(within(detail).getByText("Term 2 2026")).toBeTruthy();
    expect(within(detail).getByText("Mathematics")).toBeTruthy();
    expect(within(detail).getByText("Science")).toBeTruthy();
    expect(within(detail).getByText("A1: 8/10")).toBeTruthy();
    expect(within(detail).getByText(/Teacher observation: Good progress/)).toBeTruthy();
    await u.click(within(detail).getByRole("button", { name: "Close marks" }));
    expect(screen.queryByRole("region", { name: "Kumar marks" })).toBeNull();
  });

  it("teachers cannot edit school names or upload the school logo, and Activities is in the action bar", async () => {
    base({ name: "Mr Ravi", username: "ravi", role: "teacher" });
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getAllByRole("button", { name: /^Report builder/ })[0]);

    expect(screen.getByLabelText("School name").readOnly).toBe(true);
    expect(screen.getByLabelText("School name (English)").readOnly).toBe(true);
    expect(screen.queryByRole("button", { name: "Upload logo" })).toBeNull();
    const formativeCell = document.querySelector(".formative-cell");
    expect(formativeCell.querySelector(".formative-control")).toBeTruthy();
    expect(within(formativeCell).queryByRole("button", { name: "Activities" })).toBeNull();
    expect(within(document.querySelector(".btngrid")).getByRole("button", { name: "Activities" })).toBeTruthy();
  });

  it("integrates assigned marks in Report builder without exposing unscoped legacy editing", async () => {
    base({ name: "Mr Ravi", username: "ravi", role: "teacher" });
    put({
      "srb-students": students,
      "srb-class-assignments": [{
        year: "2026", grade: "Grade 6", division: "A", classTeacherId: "class-teacher",
        subjects: [{ subject: "Mathematics", teacherId: "ravi" }, { subject: "Science", teacherId: "another-teacher" }],
      }],
    });
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getAllByRole("button", { name: /^Report builder/ })[0]);

    expect(screen.getByRole("heading", { name: "Report builder" })).toBeTruthy();
    expect(screen.getByLabelText("School name").readOnly).toBe(true);
    expect(screen.getByRole("heading", { name: /Marks entry/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Mathematics/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Science/ })).toBeNull();
    expect([...document.querySelectorAll(".scoped-marks-table thead th")].map((cell) => cell.textContent)).toEqual([
      "Index no", "Student name", "Subject", "Formative (0–70)", "Summative (0–30)", "Credit",
      "Total", "Grade", "GPV", "Points", "GPA", "Actions",
    ]);
    const creditField = screen.getByLabelText("Kumar credit");
    expect(creditField.parentElement.classList.contains("scoped-credit-control")).toBe(true);
    await u.click(screen.getByRole("button", { name: "Kumar decrease credit" }));
    expect(creditField.value).toBe("0.75");
    await u.click(screen.getByRole("button", { name: "Kumar increase credit" }));
    expect(creditField.value).toBe("1");
    expect(screen.getAllByRole("button", { name: "Remove" }).length).toBe(students.length);
    expect(screen.getAllByRole("button", { name: "Mark absent" }).length).toBe(students.length);
    for (const action of ["Choose module", "Activities", "Calculate", "Submit to class teacher", "Print report"]) {
      expect(screen.getByRole("button", { name: new RegExp(action) })).toBeTruthy();
    }
    expect(screen.getByLabelText(/Print grades only/)).toBeTruthy();
    expect(screen.queryByLabelText("Subject")).toBeNull();
    expect(screen.queryByRole("button", { name: "Upload workbook" })).toBeNull();
    expect(document.getElementById("records").textContent).not.toMatch(/Kumar|Nisha/);

    const sidebar = within(document.querySelector("nav"));
    const workflowNav = sidebar.getByRole("button", { name: "Results workflow" });
    expect(workflowNav.querySelector("svg path").getAttribute("d")).toBeTruthy();
    await u.click(workflowNav);
    expect(await screen.findByRole("heading", { name: "Results workflow" })).toBeTruthy();
  });

  it("does not expose legacy marks editing to a teacher outside configured assignments", async () => {
    base({ name: "Unassigned teacher", username: "unassigned", role: "teacher" });
    put({
      "srb-class-assignments": [{
        year: "2026", grade: "Grade 6", division: "A", classTeacherId: "another-teacher",
        subjects: [{ subject: "Mathematics", teacherId: "another-teacher" }],
      }],
    });
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getAllByRole("button", { name: /^Report builder/ })[0]);

    expect(screen.getByText(/No subject has been assigned to your teacher account/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add module" })).toBeNull();
    expect(screen.queryByLabelText("Index number")).toBeNull();
  });

  it("admin can add teacher logins, assign them to a class and subjects, and students see the assignments", async () => {
    base(admin);
    const classPhoto = "data:image/png;base64,CLASS";
    put({
      "srb-meta": { ...meta, classTeacher: "Mrs Silva", teacherPhoto: classPhoto },
      "srb-users": [{ ...admin, hash: "admin-hash" }],
      "srb-teachers": [{ id: "teacher-silva", name: "Mrs Silva", subject: "Mathematics", phone: "" }],
    });
    const u = userEvent.setup();
    const { unmount } = render(<App />);
    await u.click(screen.getAllByRole("button", { name: /^User accounts/ })[0]);
    expect(screen.getByLabelText("Teacher").tagName).toBe("SELECT");
    await u.selectOptions(screen.getByLabelText("Teacher"), "teacher-silva");
    await u.clear(screen.getByLabelText("Username"));
    await u.type(screen.getByLabelText("Username"), "silva");
    await u.type(screen.getByLabelText("Email address"), "silva@school.lk");
    await u.type(screen.getByLabelText("Password"), "silva-pass-1");
    await u.click(screen.getByRole("button", { name: "Add teacher login" }));
    expect(await screen.findByText(/Share these details with Mrs Silva/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("srb-users")).some((account) => account.username === "silva" && account.role === "teacher")).toBe(true);

    const nav = within(document.querySelector("nav"));
    expect(nav.queryByRole("button", { name: "Assign teachers" })).toBeNull();
    await u.click(nav.getByRole("button", { name: "Teacher details" }));
    await u.click(within(screen.getByRole("navigation", { name: "Teacher pages" })).getByRole("button", { name: "Assign teachers" }));
    expect(await screen.findByRole("heading", { name: "Assign teachers" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Teachers and class assignments" })).toBeTruthy();
    expect(within(screen.getByRole("heading", { name: "Teachers and class assignments" }).closest(".teacher-directory")).getByRole("img", { name: "Mrs Silva profile image" })).toBeTruthy();
    expect(document.querySelectorAll(".teacher-assignment-table")).toHaveLength(1);
    expect(screen.getByLabelText("Assignment grade").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Assignment division").tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: "Grade 6" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Grade 13" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "A" })).toBeTruthy();
    await u.selectOptions(screen.getByLabelText("Class teacher"), "silva");
    expect(screen.getByLabelText("Subject 1").tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: "Mathematics" })).toBeTruthy();
    await u.selectOptions(screen.getByLabelText("Subject 1"), "Mathematics");
    await u.selectOptions(screen.getByLabelText("Teacher for subject 1"), "silva");
    await u.click(within(document.querySelector(".card form")).getByRole("button", { name: "Assign teachers" }));
    expect(await screen.findByText("Grade 6 A", { selector: "td" })).toBeTruthy();
    const assignmentTable = document.querySelector(".teacher-assignment-table");
    const assignmentRow = within(assignmentTable).getByRole("row", { name: /Mrs Silva/ });
    expect(within(assignmentRow).getByText("Grade 6 A")).toBeTruthy();
    expect(within(assignmentRow).getByText("silva")).toBeTruthy();
    expect(within(assignmentRow).getByText("Mathematics: Mrs Silva")).toBeTruthy();
    const assignmentHeaders = [...assignmentTable.querySelectorAll("thead th")].map((cell) => cell.textContent.trim());
    expect(assignmentHeaders).toEqual(["Year", "Class", "Teacher logins", "Class teacher", "Assigned subjects", "Actions"]);
    expect(JSON.parse(localStorage.getItem("srb-class-assignments"))[0]).toMatchObject({
      grade: "Grade 6",
      division: "A",
      classTeacherId: "silva",
      subjects: [{ subject: "Mathematics", teacherId: "silva" }],
    });
    await u.click(within(assignmentRow).getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Assignment year").value).toBe("2026");
    expect(screen.getByLabelText("Class teacher").value).toBe("silva");
    await u.click(within(document.querySelector(".card form")).getByRole("button", { name: "Save assignments" }));
    expect(JSON.parse(localStorage.getItem("srb-class-assignments"))).toHaveLength(1);

    unmount();
    localStorage.setItem("srb-user", JSON.stringify({ name: "Kumar", username: "1001", role: "student", studentId: "1001" }));
    render(<App />);
    expect(screen.getByRole("heading", { name: "My teachers" })).toBeTruthy();
    const teachersTable = document.querySelector(".student-hero")?.parentElement?.querySelector(".card table");
    expect(teachersTable.textContent).toContain("Class teacher");
    expect(teachersTable.textContent).toContain("Mathematics");
    expect(teachersTable.textContent).toContain("Mrs Silva");
    expect(document.querySelector(".student-school .tcell2 img").getAttribute("src")).toBe(classPhoto);
    expect(teachersTable.querySelector("img").getAttribute("src")).toBe(classPhoto);
  });

  it("teachers can edit their own profile and keep their leave records linked to the updated name", async () => {
    base({ name: "Mr Ravi", username: "ravi", role: "teacher" });
    put({
      "srb-users": [{ name: "Mr Ravi", username: "ravi", role: "teacher", hash: "saved-hash" }],
      "srb-leaves": [{ id: "l1", no: "L-2026-001", teacher: "Mr Ravi", type: "casual", from: "2026-11-02", to: "2026-11-02", days: 1, status: "pending", submitted: "2026-10-27", reason: "Appointment" }],
    });
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getByRole("button", { name: "Profile menu" }));
    await u.click(screen.getByRole("menuitem", { name: "Edit profile" }));
    const dialog = screen.getByRole("dialog", { name: "Edit profile" });
    expect(within(dialog).getByRole("button", { name: "Add photo" })).toBeTruthy();
    expect(document.querySelector('input[type="file"]').accept).toContain("image/jpeg");
    await u.clear(within(dialog).getByLabelText("Name"));
    await u.type(within(dialog).getByLabelText("Name"), "Ravi Perera");
    await u.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Hello, Ravi Perera")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("srb-users"))[0]).toMatchObject({ name: "Ravi Perera", hash: "saved-hash" });
    expect(JSON.parse(localStorage.getItem("srb-leaves"))[0].teacher).toBe("Ravi Perera");
  });

  it("students can edit their profile and update their linked dashboard record", async () => {
    base({ name: "Kumar", username: "1001", role: "student", studentId: "1001" });
    put({ "srb-users": [{ name: "Kumar", username: "1001", role: "student", studentId: "1001", hash: "saved-hash" }] });
    const u = userEvent.setup();
    render(<App />);
    expect(screen.getByText("Welcome, Kumar")).toBeTruthy();
    expect(document.querySelector(".student-hero .student-avatar")).toBeTruthy();
    expect(document.querySelector(".student-school")).toBeTruthy();
    expect(document.querySelector(".student-hero .student-school-name").textContent).toBe("Test College");
    expect(document.querySelector(".student-hero .student-crest")).toBeNull();
    expect(screen.getByRole("button", { name: "Edit profile" })).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Profile menu" }));
    await u.click(screen.getByRole("menuitem", { name: "Edit profile" }));
    const dialog = screen.getByRole("dialog", { name: "Edit profile" });
    await u.clear(within(dialog).getByLabelText("Name"));
    await u.type(within(dialog).getByLabelText("Name"), "Kumar Silva");
    await u.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Welcome, Kumar Silva")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("srb-students")).find((student) => student.index === "1001").name).toBe("Kumar Silva");
    expect(JSON.parse(localStorage.getItem("srb-marks"))["2026|Term 1"][0].name).toBe("Kumar Silva");
    expect(JSON.parse(localStorage.getItem("srb-users"))[0]).toMatchObject({ name: "Kumar Silva", hash: "saved-hash" });
  });

  it("changing the password works with the current password only", async () => {
    base(admin);
    const u = userEvent.setup();
    const { hashFor } = await import("../src/auth.js");
    put({ "srb-users": [{ ...admin, hash: await hashFor("admin@school.lk", "old-password-1") }] });
    render(<App />);
    await u.click(screen.getByRole("button", { name: "Profile menu" }));
    await u.click(screen.getByRole("menuitem", { name: "Change password" }));
    const dlg = screen.getByRole("dialog");
    await u.type(within(dlg).getByLabelText("Current password"), "nope-nope-1");
    await u.type(within(dlg).getByLabelText("New password"), "new-password-2");
    await u.type(within(dlg).getByLabelText("Confirm new password"), "new-password-2");
    await u.click(within(dlg).getByRole("button", { name: "Change password" }));
    expect(await within(dlg).findByText("The current password is not correct.")).toBeTruthy();
    await u.clear(within(dlg).getByLabelText("Current password")); await u.type(within(dlg).getByLabelText("Current password"), "old-password-1");
    await u.click(within(dlg).getByRole("button", { name: "Change password" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(JSON.parse(localStorage.getItem("srb-users"))[0].hash).toBe(await hashFor("admin@school.lk", "new-password-2"));
  });
});
