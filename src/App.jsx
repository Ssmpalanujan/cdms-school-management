import { useState, useEffect, useMemo, useCallback } from "react";
import { DEFAULT_SCALE, gradeFor, moduleResult, r2 } from "./grading.js";
import { downloadSample, downloadBlank, REQUIRED, OPTIONAL } from "./sheet.js";
import { status, SCHEDULES } from "./calendar.js";
import Home from "./Home.jsx";
import CalendarPage from "./CalendarPage.jsx";
import Login from "./Login.jsx";
import Owl from "./Owl.jsx";
import { useMedia } from "./useMedia.js";
import { buildTips } from "./tips.js";
import { owlReact } from "./owlBus.js";
import UserProfile from "./UserProfile.jsx";
import Sidebar from "./Sidebar.jsx";
import AvatarMenu from "./AvatarMenu.jsx";
import Icon from "./Icon.jsx";
import { useLocal, useDraft } from "./useLocal.js";
import { logActivity } from "./activity.js";
import { trimLogo } from "./image.js";
import TeacherAvatar from "./TeacherAvatar.jsx";
import Builder from "./Builder.jsx";
import Students from "./Students.jsx";
import Leave from "./Leave.jsx";
import Reports, { DEFAULT_RUBRIC } from "./Reports.jsx";
import Toasts from "./Toasts.jsx";
import TeacherHome from "./TeacherHome.jsx";
import StudentHome from "./StudentHome.jsx";
import MyResults from "./MyResults.jsx";
import Announcements from "./Announcements.jsx";
import Accounts from "./Accounts.jsx";
import ClassAssignments from "./ClassAssignments.jsx";
import TeacherPageNav from "./TeacherPageNav.jsx";
import Welcome from "./Welcome.jsx";
import ChangePassword from "./ChangePassword.jsx";
import { idOf, readUsers, writeUsers } from "./auth.js";
import { unreadCount } from "./announce.js";
import { toast } from "./toastBus.js";
import { usePeriodRecords } from "./usePeriod.js";
import { blankRow, blankMeta, TERMS } from "./defaults.js";
import { DEFAULT_ENT } from "./leave.js";
import { can as canDo } from "./perms.js";
import Attendance from "./Attendance.jsx";
import Progress from "./Progress.jsx";
import AuditLog from "./AuditLog.jsx";
import Backups from "./Backups.jsx";
import ProfilePage from "./ProfilePage.jsx";
import ResultsWorkflow from "./ResultsWorkflow.jsx";
import { migrateLegacyMarks, resultNotificationCount } from "./resultsWorkflow.js";
import AcademicYears from "./AcademicYears.jsx";
import Promotions from "./Promotions.jsx";
import { canWriteYear, getYearEntitlement, normalizeAcademicYears, normalizeEnrollments, setYearEntitlement, DEFAULT_RETIREMENT_AGE, DEFAULT_PROMOTION_EXPIRY_DAYS } from "./academic.js";
import { expiredPromotionRequests } from "./promotions.js";

const LABELS = { home: "Home dashboard", builder: "Report builder", students: "Students", summary: "Class summary", reports: "Reports", leave: "Teacher leave", teacherDetails: "Teacher details", announcements: "Announcements", accounts: "User accounts", assignments: "Assign teachers", workflow: "Results workflow", results: "My results", calendar: "Term calendar", guide: "Spreadsheet guide", attendance: "Attendance", profile: "My profile", academicYears: "Academic years", promotions: "Class record" };
const BY_ROLE = {
  admin: ["home", "builder", "students", "attendance", "summary", "reports", "leave", "teacherDetails", "academicYears", "promotions", "announcements", "accounts", "assignments", "workflow", "calendar", "guide", "profile"],
  teacher: ["home", "builder", "students", "attendance", "summary", "reports", "leave", "promotions", "announcements", "workflow", "calendar", "guide", "profile"],
  student: ["home", "results", "attendance", "announcements", "calendar", "profile"],
};
const HOME_LABEL = { admin: "Admin dashboard", teacher: "Teacher dashboard", student: "Student dashboard" };
const pagesFor = (role) => Object.fromEntries((BY_ROLE[role] || BY_ROLE.admin)
  .filter((k) => !(role === "admin" && (k === "leave" || k === "assignments")))
  .map((k) => [k, k === "home" ? HOME_LABEL[role] || HOME_LABEL.admin : k === "leave" && role === "teacher" ? "My leave" : k === "attendance" && role === "student" ? "My attendance" : LABELS[k]]));

export default function App() {
  const [page, setPage] = useState("home");
  const [storedMeta, setMeta] = useLocal("srb-meta", blankMeta);
  const meta = useMemo(() => storedMeta && typeof storedMeta === "object" && !Array.isArray(storedMeta) ? { ...blankMeta, ...storedMeta } : { ...blankMeta }, [storedMeta]);
  const [autosave, setAutosave] = useLocal("srb-autosave", true);
  const [rows, setRows, dirty, commitRows] = useDraft("srb-rows", [blankRow()], autosave);
  const { records, setRecords, setRecordsFor, store, setStore } = usePeriodRecords(meta);
  const [students, setStudents] = useLocal("srb-students", []);
  const [attendance, setAttendance] = useLocal("srb-attendance", {});
  const [teachers, setTeachers] = useLocal("srb-teachers", []);
  const [leaveTab, setLeaveTab] = useState("requests");
  const [classAssignments, setClassAssignments] = useLocal("srb-class-assignments", []);
  const [results, setResults] = useLocal("srb-results-workflow", { sheets: {}, classes: {}, audit: [], notifications: [] });
  const [academicYears, setAcademicYears] = useLocal("srb-academic-years", []);
  const [enrollments, setEnrollments] = useLocal("srb-enrollments", []);
  const [promotionRequests, setPromotionRequests] = useLocal("srb-promotion-requests", []);
  const [historyRequests, setHistoryRequests] = useLocal("srb-history-requests", []);
  const [recordShares, setRecordShares] = useLocal("srb-record-shares", []);
  const [settings, setSettings] = useLocal("srb-settings", { retirementAge: DEFAULT_RETIREMENT_AGE, promotionExpiryDays: DEFAULT_PROMOTION_EXPIRY_DAYS });
  const studentList = useMemo(() => Array.isArray(students) ? students.filter((item) => item && typeof item === "object" && !Array.isArray(item) && String(item.index || "").trim()) : [], [students]);
  const classAssignmentList = useMemo(() => Array.isArray(classAssignments)
    ? classAssignments.filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item) => ({
      ...item,
      year: String(item.year || meta.year),
      subjects: Array.isArray(item.subjects) ? item.subjects.filter((subject) => subject && typeof subject === "object" && !Array.isArray(subject)) : [],
    }))
    : [], [classAssignments, meta.year]);
  const [leaves, setLeaves] = useLocal("srb-leaves", []);
  const [ent, setEnt] = useLocal("srb-leave-ent", DEFAULT_ENT);
  const [rubric, setRubric] = useLocal("srb-rubric", DEFAULT_RUBRIC);
  const [gradeOnly, setGradeOnly] = useLocal("srb-grade-only", false);
  const [extraYears, setExtraYears] = useLocal("srb-years", []);
  const [storedCfg, setCfg] = useLocal("srb-cfg", { fmax: 70, scale: DEFAULT_SCALE });
  const cfg = useMemo(() => storedCfg && typeof storedCfg === "object" && !Array.isArray(storedCfg)
    ? { ...storedCfg, fmax: storedCfg.fmax ?? 70, scale: Array.isArray(storedCfg.scale) ? storedCfg.scale : DEFAULT_SCALE }
    : { fmax: 70, scale: DEFAULT_SCALE }, [storedCfg]);
  const [obs, setObs] = useLocal("srb-obs", false);
  const [theme, setTheme] = useLocal("srb-theme", "light");
  const [user, setUser] = useLocal("srb-user", null);
  const role = user?.role || "admin";
  const [collapsed, setCollapsed] = useLocal("srb-nav-collapsed", false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [printed, setPrinted] = useLocal("srb-printed", false);
  const [owlTips, setOwlTips] = useLocal("srb-owl-tips", true);
  const [owlLang, setOwlLang] = useLocal("srb-owl-lang", "en");
  const mobile = useMedia("(max-width:900px)");
  const [announcements, setAnnouncements] = useLocal("srb-announce", []);
  const [annSeen, setAnnSeen] = useLocal("srb-ann-seen", {});
  const announcementList = useMemo(() => Array.isArray(announcements) ? announcements.filter((item) => item && typeof item === "object" && typeof item.title === "string" && typeof item.body === "string") : [], [announcements]);
  const annSeenMap = annSeen && typeof annSeen === "object" && !Array.isArray(annSeen) ? annSeen : {};
  const [welcome, setWelcome] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [savedAt, setSavedAt] = useState(new Date());
  const academicYearList = useMemo(() => Array.isArray(academicYears) ? academicYears.filter((item) => item && typeof item === "object") : [], [academicYears]);
  const promotionRequestList = useMemo(() => Array.isArray(promotionRequests) ? promotionRequests.filter((item) => item && typeof item === "object" && item.id && Array.isArray(item.students)) : [], [promotionRequests]);
  const historyRequestList = useMemo(() => Array.isArray(historyRequests) ? historyRequests.filter((item) => item && typeof item === "object" && item.id && Array.isArray(item.students)) : [], [historyRequests]);
  const recordShareList = useMemo(() => Array.isArray(recordShares) ? recordShares.filter((item) => item && typeof item === "object" && item.id && Array.isArray(item.studentIds)) : [], [recordShares]);
  const teacherList = useMemo(() => Array.isArray(teachers) ? teachers.filter((item) => item && typeof item === "object" && typeof item.name === "string" && item.name.trim()) : [], [teachers]);
  const leaveList = useMemo(() => Array.isArray(leaves) ? leaves.filter((item) => item && typeof item === "object" && typeof item.teacher === "string" && typeof item.from === "string" && typeof item.to === "string") : [], [leaves]);
  const currentYear = String(academicYearList.find((item) => item.current)?.year || meta.year);
  const knownYearList = [...new Set([
    ...academicYearList.map((item) => String(item.year)),
    ...(Array.isArray(extraYears) ? extraYears.map(String) : []),
    ...Object.keys(store).map((key) => key.split("|")[0]),
    ...leaveList.map((item) => String(item.from || "").slice(0, 4)),
    ...Object.keys(ent && typeof ent === "object" ? ent : {}).filter((year) => /^\d{4}$/.test(year)),
    String(meta.year),
  ])].filter((year) => /^\d{4}$/.test(year)).sort();
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { if (!Array.isArray(students) || studentList.length !== students.length) setStudents(studentList); }, [students, studentList, setStudents]);
  useEffect(() => {
    const storedYears = new Set(academicYearList.map((item) => String(item.year)));
    const sourceYears = [...academicYearList, ...knownYearList.filter((year) => !storedYears.has(year)).map((year) => ({ year, current: year === currentYear }))];
    const normalized = normalizeAcademicYears(sourceYears, currentYear);
    if (JSON.stringify(normalized) !== JSON.stringify(academicYears)) setAcademicYears(normalized);
    const normalizedEnrollments = normalizeEnrollments(enrollments, studentList, currentYear, meta);
    if (JSON.stringify(normalizedEnrollments) !== JSON.stringify(enrollments)) setEnrollments(normalizedEnrollments);
    const yearly = getYearEntitlement(ent, currentYear);
    const entKeys = ent && typeof ent === "object" ? Object.keys(ent) : [];
    if (!ent?.[currentYear] || entKeys.some((key) => ["casual", "sick", "special", "duty"].includes(key))) {
      setEnt((value) => setYearEntitlement(value, currentYear, yearly));
    }
  }, [academicYearList, knownYearList.join(","), currentYear, enrollments, studentList, meta.grade, meta.className, ent, setAcademicYears, setEnrollments, setEnt]);
  useEffect(() => {
    if (role !== "admin" && String(meta.year) !== currentYear) setMeta((current) => ({ ...current, year: currentYear }));
  }, [role, currentYear, meta.year, setMeta]);
  useEffect(() => {
    const next = expiredPromotionRequests(promotionRequestList, settings?.promotionExpiryDays);
    const expired = next.filter((item, index) => item.status === "Expired" && promotionRequestList[index]?.status === "Pending");
    if (!expired.length) return;
    setPromotionRequests(next);
    expired.forEach((request) => {
      logActivity("promotion", `Promotion request expired for ${request.students.length} students`);
      const recipients = [...new Set([request.senderId, request.receiverId, ...readUsers().filter((account) => account?.role === "admin").map(idOf)].filter(Boolean))];
      setAnnouncements((items) => [...(Array.isArray(items) ? items : []), {
        id: `promotion-expired-${request.id}`, title: "Promotion request expired",
        body: `The pending request for ${request.students.length} student(s) from ${request.sourceGrade} ${request.sourceDivision} has expired.`,
        audience: "all", targetUserIds: recipients, priority: "important", author: "School notifications", role: "admin", at: Date.now(),
      }]);
    });
  }, [promotionRequestList, settings?.promotionExpiryDays, setPromotionRequests, setAnnouncements]);
  useEffect(() => { if (JSON.stringify(classAssignments) !== JSON.stringify(classAssignmentList)) setClassAssignments(classAssignmentList); }, [classAssignments, classAssignmentList, setClassAssignments]);
  useEffect(() => {
    const migrated = migrateLegacyMarks(results, store, meta);
    if (JSON.stringify(migrated) !== JSON.stringify(results)) setResults(migrated);
  }, [results, store, meta.grade, meta.className, studentList, setResults]);
  useEffect(() => setSavedAt(new Date()), [meta, rows, records, cfg, obs, students, leaves, teachers]);
  useEffect(() => {
    if (!dirty) return;
    const f = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty]);
  useEffect(() => { // remove white margins and the white background around an existing logo once
    if (!meta.logo || meta.logoCut === 1) return;
    const src = meta.logo;
    trimLogo(src).then((d) => setMeta((m) => (m.logo === src ? { ...m, logo: d, logoTrim: true, logoCut: 1 } : m)));
  }, [meta.logo, meta.logoCut, setMeta]);

  const uid = user ? idOf(user) : "";
  const pages = pagesFor(role);
  const can = (a) => canDo(role, a);
  const setCurrentYear = (year) => {
    const value = String(year);
    const entry = academicYearList.find((item) => item.year === value);
    if (!entry || entry.closed) return toast("Choose an open academic year.", "bad");
    setAcademicYears((items) => (Array.isArray(items) ? items : []).map((item) => ({ ...item, current: item.year === value })));
    setMeta((current) => ({ ...current, year: value }));
  };
  const writeAllowed = canWriteYear(role, meta.year, academicYears);
  const protectedSetRecords = useCallback((next) => {
    if (!writeAllowed) { toast("This academic year is read-only.", "bad"); return; }
    setRecords(next);
  }, [writeAllowed, setRecords]);
  const protectedSetRecordsFor = useCallback((year, term, next) => {
    if (!canWriteYear(role, year, academicYearList)) { toast("This academic year is read-only.", "bad"); return; }
    setRecordsFor(year, term, next);
  }, [role, academicYearList, setRecordsFor]);
  const protectedSetResults = useCallback((next) => {
    if (!writeAllowed) { toast("This academic year is read-only.", "bad"); return; }
    setResults(next);
  }, [writeAllowed, setResults]);
  const protectedSetAssignments = useCallback((update) => {
    const current = classAssignmentList;
    const next = typeof update === "function" ? update(current) : update;
    const closedYears = new Set(academicYearList.filter((item) => item.closed).map((item) => String(item.year)));
    const existingClosed = current.filter((item) => closedYears.has(String(item.year)));
    const updatedClosed = (Array.isArray(next) ? next : []).filter((item) => closedYears.has(String(item.year)));
    if (JSON.stringify(existingClosed) !== JSON.stringify(updatedClosed)) {
      toast("Class assignments for a closed academic year are read-only.", "bad");
      return;
    }
    setClassAssignments(next);
  }, [classAssignmentList, academicYearList, setClassAssignments]);
  const go = (p, anchor) => {
    if (!(BY_ROLE[role] || []).includes(p)) return toast("This page is not available for your role.", "bad");
    if (p === "teacherDetails") setLeaveTab("teachers");
    setPage(p);
    setTimeout(() => (anchor ? document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }) : window.scrollTo({ top: 0 })), 60);
  };
  const openTeacherDetails = () => {
    go("teacherDetails");
  };
  const tips = useMemo(() => buildTips({ page, meta, records, rows, cfg, printed, role: user?.role || "admin" }), [page, meta, records, rows, cfg, printed, user]);
  const print = () => { if (role !== "student") setPrinted(true); logActivity("print", "Printed a report"); window.print(); };
  const login = (u) => {
    setUser(u);
    setMeta((m) => ({ ...m, schoolName: m.schoolName || u.school || "", schoolPhone: m.schoolPhone || u.phone || "" }));
    logActivity("auth", `Signed in as ${u.name}`);
    setPage("home");
    setWelcome(true);
  };
  const endWelcome = () => { setWelcome(false); setTimeout(() => owlReact("wave", { en: `Welcome back, ${user.name}.`, ta: `மீண்டும் வருக, ${user.name}.` }), 400); };
  const signOut = () => { setLeaving(true); setTimeout(() => { setUser(null); setPage("home"); setLeaving(false); }, 300); };
  const saveUserProfile = ({ name, photo }) => {
    const oldName = user.name;
    const normalized = (value) => String(value || "").trim().toLowerCase();
    const next = { ...user, name, photo };
    try {
      const users = readUsers();
      const accountId = idOf(user);
      if (users.some((account) => idOf(account) === accountId)) {
        writeUsers(users.map((account) => idOf(account) === accountId ? { ...account, name, photo } : account));
      }
      if (role === "teacher" && normalized(oldName) !== normalized(name)) {
        setTeachers((list) => list.map((teacher) => normalized(teacher.name) === normalized(oldName) ? { ...teacher, name } : teacher));
        setLeaves((list) => list.map((leave) => normalized(leave.teacher) === normalized(oldName) ? { ...leave, teacher: name } : leave));
        setMeta((current) => normalized(current.classTeacher) === normalized(oldName) ? { ...current, classTeacher: name, teacherPhoto: photo } : current);
      } else if (role === "teacher" && normalized(oldName) === normalized(meta.classTeacher)) {
        setMeta((current) => ({ ...current, teacherPhoto: photo }));
      }
      if (role === "student" && user.studentId) {
        const studentId = normalized(user.studentId);
        setStudents((list) => list.map((student) => normalized(student.index) === studentId ? { ...student, name } : student));
        setStore((current) => Object.fromEntries(Object.entries(current || {}).map(([period, records]) => [
          period,
          Array.isArray(records) ? records.map((record) => normalized(record.studentId) === studentId ? { ...record, name } : record) : records,
        ])));
      }
      setUser(next);
      logActivity("profile", `${role === "teacher" ? "Teacher" : role === "student" ? "Student" : "Admin"} profile updated`);
      setProfileError("");
      return true;
    } catch (error) {
      console.error("Could not save profile", error);
      setProfileError("Could not save your profile. Check available browser storage and try again.");
      return false;
    }
  };
  useEffect(() => { if (user && !(BY_ROLE[role] || BY_ROLE.admin).includes(page)) setPage("home"); }, [user, role, page]);
  if (!user) return <><div className="scene" aria-hidden="true" /><Login onLogin={login} meta={meta} /><Toasts /></>;

  const s = { page, go, openTeacherDetails, leaveTab, setLeaveTab, openProfile: () => { setProfileError(""); setProfileOpen(true); }, print, printed, meta, setMeta, rows, setRows, dirty, commitRows, autosave, setAutosave, records, setRecords: protectedSetRecords, setRecordsFor: protectedSetRecordsFor, store, setStore, students: studentList, setStudents, attendance, setAttendance, teachers: teacherList, setTeachers, classAssignments: classAssignmentList, setClassAssignments: protectedSetAssignments, results, setResults: protectedSetResults, leaves: leaveList, setLeaves, ent, setEnt, rubric, setRubric, gradeOnly, setGradeOnly, cfg, setCfg, obs, setObs, user, role, can, uid, announcements: announcementList, setAnnouncements, annSeen: annSeenMap, setAnnSeen, academicYears: academicYearList, setAcademicYears, currentYear, setCurrentYear, enrollments: Array.isArray(enrollments) ? enrollments : [], setEnrollments, promotionRequests: promotionRequestList, setPromotionRequests, historyRequests: historyRequestList, setHistoryRequests, recordShares: recordShareList, setRecordShares, settings: settings && typeof settings === "object" && !Array.isArray(settings) ? settings : { retirementAge: DEFAULT_RETIREMENT_AGE, promotionExpiryDays: DEFAULT_PROMOTION_EXPIRY_DAYS }, setSettings };
  const key = meta.schedule || "tamil-sinhala";
  const years = knownYearList;
  const terms = [...new Set([...TERMS, meta.term])];
  const unread = unreadCount(announcementList, role, annSeenMap[uid], user.name, uid);
  const isStudent = role === "student";
  const classTeacherMe = String(user.name).trim().toLowerCase() === String(meta.classTeacher || "").trim().toLowerCase();
  const savedAccountPhoto = user.photo || readUsers().find((account) => idOf(account) === idOf(user))?.photo || "";
  const teacherPhoto = savedAccountPhoto || (classTeacherMe ? meta.teacherPhoto : "");
  const myPhoto = role === "admin" ? meta.logo || savedAccountPhoto : role === "teacher" ? teacherPhoto : savedAccountPhoto;
  const canProfile = true;
  const time = savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const viewUser = savedAccountPhoto && !user.photo ? { ...user, photo: savedAccountPhoto } : user;
  const viewState = viewUser === user ? s : { ...s, user: viewUser };
  return (
    <>
      <div className="scene" aria-hidden="true" />
      <div className={"shell enter" + (collapsed ? " collapsed" : "") + (leaving ? " leave" : "")}>
        <Sidebar page={page} go={go} pages={pages} badges={{ announcements: unread, workflow: resultNotificationCount(results, { ...user, id: role === "student" ? user.studentId : uid }, null), results: resultNotificationCount(results, { ...user, id: role === "student" ? user.studentId : uid }, null) }} collapsed={collapsed} setCollapsed={setCollapsed} status={status(key)} scheduleLabel={SCHEDULES[key].label} user={role === "admin" ? { ...viewUser, photo: meta.logo || savedAccountPhoto } : viewUser} meta={meta} mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} owl={!mobile && <Owl page={page} tips={tips} enabled={owlTips} setEnabled={setOwlTips} lang={owlLang} setLang={setOwlLang} go={go} compact={collapsed} />} />
        <div className="content">
          <header className="top no-print">
            <button className="mobile-nav-toggle" aria-label="Open navigation menu" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}><Icon name="menu" /></button>
            {role === "admin" ? <div className="period" role="group" aria-label="Academic period">
              <select aria-label="Academic year" value={meta.year} onChange={(e) => setMeta({ ...meta, year: e.target.value })}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select aria-label="Term" value={meta.term} onChange={(e) => setMeta({ ...meta, term: e.target.value })}>{terms.map((t) => <option key={t}>{t}</option>)}</select>
            </div> : <div className="period" aria-label="Academic period"><span className="muted">Academic year {currentYear}</span>{role === "teacher" && <select aria-label="Term" value={meta.term} onChange={(e) => setMeta({ ...meta, term: e.target.value })}>{terms.map((t) => <option key={t}>{t}</option>)}</select>}</div>}
            {(!isStudent || mobile) && <span className={"pill saved" + (dirty ? " unsaved" : "")}>{dirty ? "Unsaved changes" : <>Saved <span aria-hidden="true">|</span> {time}</>}</span>}
            <AvatarMenu user={user} photo={myPhoto} canProfile={canProfile} theme={theme} onTheme={() => setTheme(theme === "dark" ? "light" : "dark")} onGo={go} onSignOut={signOut} onProfile={() => { setProfileError(""); setProfileOpen(true); }} onPassword={() => setPwOpen(true)} />
          </header>
          <main className="main">
            {page === "home" && (role === "student" ? <StudentHome s={viewState} /> : role === "teacher" ? <TeacherHome s={viewState} /> : <Home s={viewState} />)}
            {page === "results" && <MyResults s={s} />}
            {page === "workflow" && (role === "admin" || role === "teacher") && <ResultsWorkflow s={s} />}
            {page === "announcements" && <Announcements s={s} />}
            {page === "accounts" && role === "admin" && <Accounts s={s} />}
            {page === "assignments" && role === "admin" && <><div className="pagehead"><h2 className="sr">Assign teachers</h2><TeacherPageNav page={page} go={go} setLeaveTab={setLeaveTab} /></div><ClassAssignments meta={meta} students={studentList} assignments={classAssignmentList} setAssignments={setClassAssignments} users={readUsers()} /></>}
            {page === "academicYears" && role === "admin" && <AcademicYears s={s} />}
            {page === "promotions" && (role === "admin" || role === "teacher") && <Promotions s={s} />}
            {page === "builder" && <Builder s={s} />}
            {page === "students" && <Students s={s} />}
            {page === "attendance" && <Attendance s={s} />}
            {page === "progress" && <Progress s={s} />}
            {page === "audit" && <AuditLog />}
            {page === "backups" && role === "admin" && <Backups />}
            {page === "summary" && <Summary s={s} />}
            {page === "reports" && <Reports s={s} />}
            {page === "leave" && <Leave s={s} />}
            {page === "teacherDetails" && role === "admin" && <Leave s={s} />}
            {page === "calendar" && <CalendarPage s={s} />}
            {page === "guide" && <Guide s={s} />}
            {page === "profile" && <ProfilePage
              user={viewUser}
              photo={myPhoto}
              theme={theme}
              onTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
              onEdit={() => { setProfileError(""); setProfileOpen(true); }}
              onPassword={() => setPwOpen(true)}
              onSignOut={signOut}
              go={go}
            />}
          </main>
        </div>
      </div>
      {mobile && <Owl floating page={page} tips={tips} enabled={owlTips} setEnabled={setOwlTips} lang={owlLang} setLang={setOwlLang} go={go} />}
      {pwOpen && <ChangePassword user={user} onClose={() => setPwOpen(false)} />}
      {welcome && <Welcome meta={meta} user={user} onDone={endWelcome} />}
      {profileOpen && <UserProfile user={user} initialPhoto={role === "teacher" ? teacherPhoto : savedAccountPhoto} onSave={saveUserProfile} onClose={() => setProfileOpen(false)} />}
      {profileError && <div className="profile-error alert bad" role="alert">{profileError}</div>}
      <Toasts />
    </>
  );
}

function Summary({ s }) {
  const { meta, records, cfg, go } = s;
  const mods = useMemo(() => { const o = {}; records.forEach((r) => r.modules.forEach((x) => { o[x.moduleId || x.moduleTitle] = x.moduleTitle || x.moduleId; })); return o; }, [records]);
  const [sel, setSel] = useState("");
  const key = mods[sel] ? sel : Object.keys(mods)[0] || "";
  const totals = records.flatMap((r) => r.modules.filter((x) => (x.moduleId || x.moduleTitle) === key).map((x) => moduleResult(x, cfg.scale).total)).filter((t) => t != null);
  const avg = totals.length ? r2(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
  const dist = cfg.scale.map(([g]) => { const c = totals.filter((t) => gradeFor(t, cfg.scale).grade === g).length; return [g, c, totals.length ? r2((c / totals.length) * 100) : 0]; });

  if (!key) return (
    <div className="card"><h2>Class summary</h2><p className="muted">No module data yet. Add student records or import a workbook first.</p>
      <div className="summary-back"><button className="btn" onClick={() => go("builder")}>Back to report builder</button></div></div>
  );
  return (
    <>
      <div className="pagehead"><h2>Class summary</h2><div className="savebox"><span className="muted">{meta.term} {meta.year}</span></div></div>
      <div className="toolbar no-print">
        <select value={key} onChange={(e) => setSel(e.target.value)} aria-label="Module">
          {Object.entries(mods).map(([k, t]) => <option key={k} value={k}>{t} ({k})</option>)}
        </select>
        <button className="btn summary-back-btn" onClick={() => go("builder")}>Back to report builder</button>
      </div>
      <section className="card">
        <div className="sumtop">
          <div className="sumid">
            <p className="muted">{meta.schoolName}</p>
            <h2 className="sumtitle"><span>{mods[key]}</span><span className="chip plain">Code: {key}</span></h2>
          </div>
          <button className="btn no-print" onClick={s.print}>Print this summary</button>
        </div>
        <div className="infostrip">
          <div className="icell"><span className="ilab">Class</span><b>{meta.grade} - {meta.className}</b><small>{meta.medium} medium</small></div>
          <div className="icell"><span className="ilab">Term label</span><b>{meta.term}</b><small>Year {meta.year}</small></div>
          <div className="icell tcell">
            <TeacherAvatar meta={meta} setMeta={s.setMeta} size={60} editable />
            <div className="tname"><span className="ilab">Class teacher</span><b>{meta.classTeacher || "Not set"}</b></div>
          </div>
        </div>
        <div className="stats">
          <div className="stat"><span>Class average</span><b>{avg.toFixed(2)}%</b><span>Grade {gradeFor(avg, cfg.scale).grade}</span></div>
          <div className="stat"><span>Total students</span><b>{totals.length}</b><span>Students</span></div>
          <div className="stat"><span>Print reference</span><b className="refb">{meta.grade} - {meta.className} · {key}</b><span>{meta.term} · {meta.year}</span></div>
        </div>
      </section>
      <section className="card">
        <h3>Grade distribution overview</h3>
        <div className="scroll">
          <table className="tbl dist">
            <colgroup><col style={{ width: 90 }} /><col style={{ width: 140 }} /><col /></colgroup>
            <thead><tr><th className="c">Grade</th><th className="c">Students</th><th>% of class</th></tr></thead>
            <tbody>{dist.map(([g, c, p]) => (
              <tr key={g}>
                <td className="c"><b>{g}</b></td>
                <td className="c">{c} {c === 1 ? "Student" : "Students"}</td>
                <td><span className="pcell"><span className="bar"><i style={{ width: p + "%" }} /></span><span className="pnum">{p.toFixed(1)}%</span></span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

const COLS = {
  studentId: ["Unique index number of the student", "1001"],
  gender: ["Male or Female (adds the student to the student list)", "Male"],
  absent: ["Type yes if the student was absent. Marks are then ignored", "yes"],
  absentRemark: ["Reason for the absence", "Sick leave"],
  name: ["Student full name", "A. Kumar"],
  grade: ["Grade of the class", "Grade 6"],
  medium: ["Medium of instruction", "English"],
  className: ["Class letter or name", "A"],
  classTeacher: ["Class teacher name", "Mr. S. Arigaran"],
  term: ["Term label", "Term 1"],
  year: ["Academic year", "2026"],
  moduleId: ["Short code for the subject", "aesth-01"],
  moduleTitle: ["Subject name", "Aesthetics"],
  summative: ["Summative mark", "26.9"],
  formative: ["Formative mark", "61.5"],
  credit: ["Credit of the subject. Defaults to 1", "1"],
  schoolName: ["School name for the report header", "Sample College"],
  schoolAddress: ["School address", "Karaitivu"],
  developer: ["Name of the person who prepared the file", "Optional"],
};

function Guide({ s }) {
  return (
    <>
      <div className="pagehead"><h2>Spreadsheet guide</h2></div>
      <section className="card note">
        <p>The workbook is an .xlsx file. Each row is one student in one module, and each column holds one piece of information such as name, grade or teacher.</p>
        <p>Think of it as a digital table: easy to edit, upload and download. You do not need Microsoft Excel. Any program that opens .xlsx works, including LibreOffice and Google Sheets.</p>
      </section>
      <div className="guidegrid">
        <section className="card">
          <h3>File format and layout</h3>
          <p className="muted">Use the first sheet. Row 1 holds the column names exactly as written below.</p>
          <div className="scroll">
            <table className="tbl guide">
              <thead><tr><th>Column</th><th>Type</th><th>What to enter</th><th>Example</th></tr></thead>
              <tbody>{[...REQUIRED.map((c) => [c, "Yes"]), ...OPTIONAL.map((c) => [c, "No"])].map(([c, r]) => (
                <tr key={c}><td>{c}</td><td><span className={"chip " + (r === "Yes" ? "teal" : "plain")}>{r === "Yes" ? "Required" : "Optional"}</span></td><td>{COLS[c][0]}</td><td>{COLS[c][1]}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="muted">formative and summative are marks out of the values set in Grading settings.</p>
        </section>
        <div>
          <section className="card">
            <h3>Ready-to-use workbooks</h3>
            <p className="muted">Start from a sample or a blank template that already matches the required column order.</p>
            <div className="stack">
              <button className="btn" onClick={downloadSample}>Download sample workbook</button>
              <button className="btn ghost" onClick={downloadBlank}>Download blank template</button>
            </div>
          </section>
          <section className="card">
            <h3>Quick tips</h3>
            <ul className="tips">
              <li>One row for each student in each subject.</li>
              <li>Marks must be numbers. Leave out units and the % sign.</li>
              <li>Keep the studentId the same on every row of the same student.</li>
              <li>Only the first sheet is read.</li>
            </ul>
            <div className="tipsfoot"><button className="btn" onClick={() => s.go("builder", "sheet")}>Go to import</button></div>
          </section>
        </div>
      </div>
    </>
  );
}
