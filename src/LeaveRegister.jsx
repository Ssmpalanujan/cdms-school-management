import { LEAVE_TYPES } from "./leave.js";

const label = (k) => LEAVE_TYPES.find((t) => t[0] === k)?.[1] || k;
const dates = (l) => (l.from === l.to ? l.from : `${l.from} to ${l.to}`);

// Compact register: leave number, teacher name, date, leave type and number of days
export default function LeaveRegister({ leaves, limit = 6, empty = "No leave records yet." }) {
  const list = [...leaves].sort((a, b) => b.from.localeCompare(a.from)).slice(0, limit);
  if (!list.length) return <p className="muted">{empty}</p>;
  const total = list.reduce((s, l) => s + (l.status === "cancelled" || l.status === "rejected" ? 0 : l.days), 0);
  return (
    <div className="scroll">
      <table className="tbl small lreg">
        <thead><tr><th>Leave no.</th><th>Teacher name</th><th>Date</th><th>Leave type</th><th className="c">Days</th><th>Status</th></tr></thead>
        <tbody>{list.map((l) => (
          <tr key={l.id}><td>{l.no}</td><td>{l.teacher}</td><td>{dates(l)}</td><td>{label(l.type)}</td><td className="c"><b>{l.days}</b></td><td><span className={"chip st-" + l.status}>{l.status}</span></td></tr>
        ))}</tbody>
        <tfoot><tr><td colSpan="4">Days counted in this list (not cancelled or rejected)</td><td className="c"><b>{total}</b></td><td /></tr></tfoot>
      </table>
    </div>
  );
}
