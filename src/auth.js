// Frontend-only accounts kept in this browser. A real server is needed for real security.
export const USERS_KEY = "srb-users";
export const readUsers = () => { try { const u = JSON.parse(localStorage.getItem(USERS_KEY)); return Array.isArray(u) ? u : []; } catch { return []; } };
export const writeUsers = (u) => localStorage.setItem(USERS_KEY, JSON.stringify(u));
export const sha = async (s) => {
  if (!crypto.subtle) return btoa(unescape(encodeURIComponent(s))); // fallback on non-secure origins
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const randomText = (n) => { const b = crypto.getRandomValues(new Uint8Array(n)); return [...b].map((x) => ALPHA[x % ALPHA.length]).join(""); };
export const makeCode = () => { const s = randomText(10); return s.slice(0, 5) + "-" + s.slice(5); };
export const norm = (c) => String(c).toUpperCase().replace(/[^A-Z0-9]/g, "");
// the sign-in name of an account: username when it has one, otherwise the email
export const idOf = (u) => String(u.username || u.email || "").trim().toLowerCase();
export const hashFor = (id, password) => sha(String(id).trim().toLowerCase() + ":" + password);
export const findUser = (users, id) => { const k = String(id).trim().toLowerCase(); return k ? users.find((u) => idOf(u) === k || String(u.email || "").toLowerCase() === k) : undefined; };
export const roleOf = (u) => u.role || "admin";
export const publicUser = (u) => ({ name: u.name, email: u.email || "", username: u.username || "", role: roleOf(u), school: u.school || "", phone: u.phone || "", studentId: u.studentId || "", photo: u.photo || "" });
export const validUsername = (v) => /^[a-z0-9._-]{3,24}$/.test(v);
