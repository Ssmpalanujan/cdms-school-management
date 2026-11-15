import { useState, useEffect } from "react";

const KEY = "srb-activity";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };

export function logActivity(type, message) {
  let actor = "School user";
  try {
    const user = JSON.parse(localStorage.getItem("srb-user") || "null");
    if (user?.name) actor = `${user.name}${user.role ? ` (${user.role})` : ""}`;
  } catch { /* keep a generic actor if the saved session is unreadable */ }
  const list = [{ type, message, actor, at: Date.now() }, ...read()].slice(0, 500);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (error) { console.error("Could not save activity history", error); }
  window.dispatchEvent(new Event("srb-activity"));
}
export function clearActivity() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  window.dispatchEvent(new Event("srb-activity"));
}
export function useActivity() {
  const [list, setList] = useState(read);
  useEffect(() => {
    const f = () => setList(read());
    window.addEventListener("srb-activity", f);
    return () => window.removeEventListener("srb-activity", f);
  }, []);
  return list;
}
export function ago(t, now = Date.now()) {
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  if (h < 48) return "yesterday";
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
