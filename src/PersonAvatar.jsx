export default function PersonAvatar({ name, photo, className = "" }) {
  const initials = String(name || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "?";
  return (
    <span className={`person-avatar ${className}`.trim()} role="img" aria-label={`${name || "User"} profile image`}>
      {photo ? <img src={photo} alt="" /> : <span aria-hidden="true">{initials}</span>}
    </span>
  );
}
