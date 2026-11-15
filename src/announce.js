import { today } from "./leave.js";

export const AUDIENCES = [["all", "Everyone"], ["teachers", "Teachers only"], ["students", "Students only"]];
export const audienceLabel = (k) => AUDIENCES.find((a) => a[0] === k)?.[1] || k;
// staff see every announcement, students see the ones for everyone and for students
export const visibleTo = (a, role, userId) => {
  if (Array.isArray(a.targetUserIds)) return !!userId && a.targetUserIds.includes(userId);
  return role === "admin" || role === "teacher" || a.audience === "all" || a.audience === "students";
};
export const expired = (a, now = today()) => !!a.until && a.until < now;
export const latest = (list, role, n = 3, userId) => list.filter((a) => visibleTo(a, role, userId) && !(role === "student" && expired(a))).sort((x, y) => y.at - x.at).slice(0, n);
export const unreadCount = (list, role, seenAt, me, userId) => list.filter((a) => visibleTo(a, role, userId) && !(role === "student" && expired(a)) && a.at > (seenAt || 0) && a.author !== me).length;
export function validateAnnouncement(f) {
  const e = {};
  if (f.title.trim().length < 3) e.title = "Enter a title (at least 3 characters).";
  if (f.body.trim().length < 3) e.body = "Enter the message.";
  if (!AUDIENCES.some((a) => a[0] === f.audience)) e.audience = "Choose who should see it.";
  if (f.until && f.until < today()) e.until = "The end date is in the past.";
  return e;
}
