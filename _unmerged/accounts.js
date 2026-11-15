// Frontend-only accounts. Passwords are stored as SHA-256 hashes in the browser, which is not real security.
export const sha = async (s) => {
  if (!crypto.subtle) return btoa(unescape(encodeURIComponent(s))); // fallback on non-secure origins
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const makeCode = () => {
  const b = crypto.getRandomValues(new Uint8Array(10));
  const s = [...b].map((x) => ALPHA[x % ALPHA.length]).join("");
  return s.slice(0, 5) + "-" + s.slice(5);
};
export const norm = (c) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const randomPassword = (n = 8) => {
  const A = "abcdefghjkmnpqrstuvwxyz23456789";
  return [...crypto.getRandomValues(new Uint8Array(n))].map((x) => A[x % A.length]).join("");
};
export const USERNAME_RE = /^[a-z0-9._-]{3,30}$/i;
export const uname = (u) => u.username || u.email || "";
export const hkOf = (u) => String(u.hk || u.email || u.username || "").toLowerCase();
export const hashPw = (key, pw) => sha(String(key).toLowerCase() + ":" + pw);
export const hashRecovery = (key, code) => sha(String(key).toLowerCase() + ":recovery:" + norm(code));
export const matches = (u, id) => { const v = String(id).trim().toLowerCase(); return !!v && (String(u.username || "").toLowerCase() === v || String(u.email || "").toLowerCase() === v); };
export const accountId = (u) => u.id || u.email || u.username;
export const toSession = (u) => ({ id: accountId(u), name: u.name, username: uname(u), email: u.email || "", role: u.role || "admin", linkId: u.linkId || "", school: u.school || "", phone: u.phone || "" });
export const usernameTaken = (users, name, exceptId) => users.some((u) => accountId(u) !== exceptId && [u.username, u.email].some((x) => String(x || "").toLowerCase() === name.trim().toLowerCase()));
export const slugName = (n) => String(n).toLowerCase().replace(/^(mr|mrs|miss|ms|dr)\.?\s+/, "").replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
