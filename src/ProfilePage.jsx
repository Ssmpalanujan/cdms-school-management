import Icon from "./Icon.jsx";

function Action({ title, description, icon, onClick, danger = false }) {
  return (
    <button type="button" className={"profile-action" + (danger ? " danger" : "")} onClick={onClick}>
      <Icon name={icon} />
      <span><b>{title}</b><small>{description}</small></span>
      {!danger && <Icon name="arrow" />}
    </button>
  );
}

export default function ProfilePage({ user, photo, theme, onTheme, onEdit, onPassword, onSignOut, go }) {
  const role = user.role === "teacher" ? "Teacher" : user.role === "student" ? "Student" : "Admin";
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "U";

  return (
    <>
      <div className="pagehead"><h2>My profile</h2></div>
      <section className="card profile-overview">
        <div className="profile-face">
          {photo ? <img src={photo} alt={`${role} profile`} /> : <span aria-hidden="true">{initials}</span>}
        </div>
        <div className="profile-identity">
          <h3>{user.name}</h3>
          <span>{user.email || user.username}</span>
          <span className="rolechip">{role}</span>
          {user.school && <span>{user.school}</span>}
        </div>
        <button type="button" className="btn ghost" onClick={onEdit}>Edit profile</button>
      </section>
      <section className="card profile-settings">
        <h3>Account and app settings</h3>
        <div className="profile-actions">
          <Action title="Edit profile" description="Change your name or profile photo." icon="pencil" onClick={onEdit} />
          <Action
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            description="Change the app's appearance on this device."
            icon="summary"
            onClick={onTheme}
          />
          {user.role !== "student" && <Action title="Excel tools" description="Open spreadsheet templates and import guidance." icon="guide" onClick={() => go("guide")} />}
          {user.role === "admin" && <Action title="Weights & GPV" description="Configure grading weights and grade settings." icon="progress" onClick={() => go("builder", "grading")} />}
          <Action title="Change password" description="Update the password for your account." icon="users" onClick={onPassword} />
          <Action title="Sign out" description="Sign out of this account on this device." icon="close" onClick={onSignOut} danger />
        </div>
      </section>
    </>
  );
}
