import { useEffect, useRef, useState } from "react";

export default function AvatarMenu({ user, photo, canProfile, theme, onTheme, onGo, onSignOut, onProfile, onPassword }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(), btn = useRef();
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "U";

  useEffect(() => {
    if (!open) return;
    const down = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    wrap.current?.querySelector('[role="menuitem"]')?.focus();
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  const onMenuKey = (e) => {
    const items = [...wrap.current.querySelectorAll('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  };
  const pick = (fn) => () => { setOpen(false); fn(); };

  return (
    <div className="avwrap" ref={wrap}>
      <button ref={btn} className="avatar" aria-haspopup="menu" aria-expanded={open} aria-label="Profile menu" onClick={() => setOpen(!open)}>{photo ? <img src={photo} alt="" /> : <span className="avatar-initials">{initials}</span>}</button>
      {open && (
        <div className="menu" role="menu" onKeyDown={onMenuKey}>
          <div className="menuhead">
            <span className="mface" aria-hidden="true">{photo ? <img src={photo} alt="" /> : initials}</span>
            <span className="mtext"><b>{user.name}</b><span>{user.email || user.username}</span><span className="rolechip">{user.role === "teacher" ? "Teacher" : user.role === "student" ? "Student" : "Admin"}</span></span>
          </div>
          {canProfile && <button role="menuitem" className="mi" onClick={pick(onProfile)}>Edit profile</button>}
          <button role="menuitem" className="mi" onClick={pick(onTheme)}>{theme === "dark" ? "Light mode" : "Dark mode"}</button>
          {user.role !== "student" && <button role="menuitem" className="mi" onClick={pick(() => onGo("guide"))}>Excel tools</button>}
          {(user.role || "admin") === "admin" && <button role="menuitem" className="mi" onClick={pick(() => onGo("builder", "grading"))}>Weights &amp; GPV</button>}
          <button role="menuitem" className="mi" onClick={pick(onPassword)}>Change password</button>
          <button role="menuitem" className="mi out" onClick={pick(onSignOut)}>Sign out</button>
        </div>
      )}
    </div>
  );
}
