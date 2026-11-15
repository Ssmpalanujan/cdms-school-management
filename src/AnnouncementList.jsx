import { audienceLabel } from "./announce.js";

export default function AnnouncementList({ items, seenAt, go, empty = "No announcements yet." }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="annmini">
      {items.map((a) => (
        <li key={a.id} className={a.priority === "important" ? "imp" : ""}>
          <button onClick={() => go("announcements")}>
            <span className="annrow"><b>{a.title}</b>{a.at > (seenAt || 0) && <span className="chip teal sm">New</span>}{a.priority === "important" && <span className="chip amber sm">Important</span>}</span>
            <span className="annsnip">{a.body.length > 90 ? a.body.slice(0, 90) + "..." : a.body}</span>
            <span className="annmeta">{a.author} · {new Date(a.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {audienceLabel(a.audience)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
