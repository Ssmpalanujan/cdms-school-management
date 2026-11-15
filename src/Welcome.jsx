import { useEffect } from "react";
import Icon from "./Icon.jsx";

const reduced = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ROLE = { admin: "Admin", teacher: "Teacher", student: "Student" };

// Full-screen greeting shown once after signing in, then the dashboard appears.
export default function Welcome({ meta, user, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, reduced() ? 1200 : 3000);
    const k = (e) => { if (e.key === "Escape" || e.key === "Enter") onDone(); };
    window.addEventListener("keydown", k);
    return () => { clearTimeout(t); window.removeEventListener("keydown", k); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="welcome" role="status" aria-live="polite" onClick={onDone}>
      <div className="wcard">
        <div className="slogo big wlogo">{meta.logo ? <img src={meta.logo} alt="" /> : <Icon name="guide" size={44} />}</div>
        <p className="wsmall">Welcome to</p>
        <h1 className="wname">{meta.schoolName || "கல்வி வலை"}</h1>
        <p className="whello">Hello, {user.name}</p>
        <span className="chip teal wrole">{ROLE[user.role] || "Admin"}</span>
        <button className="btn ghost wbtn" onClick={onDone} autoFocus>Continue</button>
      </div>
    </div>
  );
}
