export default function TeacherPageNav({ page, go, setLeaveTab }) {
  const openLeave = () => {
    setLeaveTab?.("requests");
    go?.("leave");
  };
  return (
    <nav className="teacher-page-nav" aria-label="Teacher pages">
      <button type="button" className="btn teacher-page-button" aria-current={page === "teacherDetails" ? "page" : undefined} onClick={() => go?.("teacherDetails")}>Teacher details</button>
      <button type="button" className="btn teacher-page-button" aria-current={page === "leave" ? "page" : undefined} onClick={openLeave}>Teacher leave</button>
      <button type="button" className="btn teacher-page-button" aria-current={page === "assignments" ? "page" : undefined} onClick={() => go?.("assignments")}>Assign teachers</button>
    </nav>
  );
}
