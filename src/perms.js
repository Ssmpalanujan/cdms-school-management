// Frontend-only role checks. They hide actions in the UI; real security needs a backend.
const CAN = {
  teacher: ["marks", "students.write", "leave.submit", "reports", "announce.post", "announce.read"],
  student: ["announce.read", "results.own"],
};
export const can = (role, action) => (role === "admin" ? true : (CAN[role] || []).includes(action));
export const ROLES = [["admin", "Admin"], ["teacher", "Teacher"], ["student", "Student"]];
