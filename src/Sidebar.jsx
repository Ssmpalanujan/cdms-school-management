import { useEffect } from "react";
import Icon from "./Icon.jsx";

function SchoolCard({ meta }) {
  const label = meta.schoolName || "School";
  return (
    <section className="schoolcard" aria-label={label}>
      <div className="slogo">{meta.logo ? <img src={meta.logo} alt={label} /> : <span aria-hidden="true">{label[0]}</span>}</div>
      {meta.zone && <span className="chip zone szone">{meta.zone}</span>}
    </section>
  );
}

const SHORT = { home: "Home", builder: "Builder", students: "Students", summary: "Summary", reports: "Reports", leave: "Leave", teacherDetails: "Teachers", academicYears: "Years", promotions: "Class record", announcements: "News", accounts: "Users", assignments: "Assign", workflow: "Workflow", results: "Results", calendar: "Calendar", guide: "Guide", attendance: "Attendance", profile: "Profile" };

export default function Sidebar({ page, go, pages, collapsed, setCollapsed, status, scheduleLabel, user, meta, owl, badges = {}, mobileNavOpen = false, setMobileNavOpen = () => {} }) {
  const importantPage = user.role === "student" ? "results" : "students";
  const mobilePages = (user.role === "student"
    ? ["home", importantPage, "attendance", "announcements"]
    : ["home", "announcements", importantPage]
  ).filter((key) => pages[key]);
  const profileInitials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "U";
  const navigate = (key) => { go(key); setMobileNavOpen(false); };
  useEffect(() => {
    if (!mobileNavOpen) return;
    const closeOnEscape = (event) => { if (event.key === "Escape") setMobileNavOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavOpen, setMobileNavOpen]);
  useEffect(() => { // on phones keep the active tab visible in the scrollable bar
    if (window.matchMedia("(max-width:900px)").matches) document.querySelector(".nav.on")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [page]);
  return (
    <>
      {mobileNavOpen && <button className="mobile-nav-backdrop no-print" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={"side no-print" + (mobileNavOpen ? " mobile-open" : "")} aria-label="Main navigation">
        <div className="sidehead">
          <h1 lang="ta">கல்வி வலை</h1>
          <button className="mobile-nav-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><Icon name="close" /></button>
          <button className="collapse" aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Minimize sidebar"} onClick={() => setCollapsed(!collapsed)}>
            <Icon name={collapsed ? "right" : "left"} />
          </button>
        </div>
        <SchoolCard meta={meta} />
        <nav aria-label="Pages">
          {Object.entries(pages).map(([k, l]) => (
            <button key={k} className={`nav${page === k ? " on" : ""}${k === "profile" ? " nav-profile" : ""}`} aria-current={page === k ? "page" : undefined} title={collapsed ? l : undefined} aria-label={collapsed ? l : undefined} onClick={() => navigate(k)}>
              <Icon name={k === "teacherDetails" ? "students" : k === "promotions" ? "records" : k} /><span className="lbl">{l}</span><span className="lbl-s" aria-hidden="true">{SHORT[k]}</span>{badges[k] > 0 && <span className="navbadge" aria-label={`${badges[k]} new`}>{badges[k]}</span>}
            </button>
          ))}
        </nav>
        {owl}
        {!collapsed && (
          <div className="sidecal">
            <b className={"tone-" + status.tone}>{status.label}</b>
            <span>{scheduleLabel}</span>
            <div className="side-user">
              <span>Signed in as {user.name}</span>
            </div>
          </div>
        )}
      </aside>
      <nav className="mobile-bottom-nav no-print" aria-label="Quick navigation">
        {mobilePages.map((key) => (
          <button key={key} className={page === key ? "quick-nav on" : "quick-nav"} aria-current={page === key ? "page" : undefined} onClick={(event) => {
            navigate(key);
            if (event.detail !== 0) event.currentTarget.blur();
          }}>
            <Icon name={key === "announcements" ? "announcements" : key === "promotions" ? "records" : key} />
            <span>{key === "home" ? "Home" : key === "announcements" ? "Announcements" : key === "attendance" && user.role === "student" ? "My attendance" : SHORT[key] || pages[key]}</span>
            {badges[key] > 0 && <span className="navbadge" aria-label={`${badges[key]} new`}>{badges[key]}</span>}
          </button>
        ))}
        <button className={page === "profile" ? "quick-nav quick-profile on" : "quick-nav quick-profile"} aria-current={page === "profile" ? "page" : undefined} onClick={(event) => {
          navigate("profile");
          if (event.detail !== 0) event.currentTarget.blur();
        }}>
          {user.photo ? <img src={user.photo} alt="" /> : <span className="avatar-initials" aria-hidden="true">{profileInitials}</span>}
          <span>Profile</span>
        </button>
      </nav>
    </>
  );
}
