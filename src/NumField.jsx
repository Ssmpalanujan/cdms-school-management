import Icon from "./Icon.jsx";
import { num } from "./grading.js";

export default function NumField({ value, onChange, min, max, step = 1, label = "value", invalid = false, className = "", disabled = false }) {
  const n = num(value);
  const bump = (dir) => {
    let v = Math.round(((n ?? 0) + dir * step) * 100) / 100;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    onChange(String(v));
  };
  const onKey = (e) => {
    if (e.key === "ArrowUp") { e.preventDefault(); bump(1); }
    if (e.key === "ArrowDown") { e.preventDefault(); bump(-1); }
  };
  return (
    <span className={["numf", invalid && "bad", className].filter(Boolean).join(" ")}>
      <input type="number" value={value} min={min} max={max} step={step} aria-label={label} disabled={disabled} onChange={(e) => onChange(e.target.value)} onKeyDown={onKey} />
      <span className="numbtns">
        <button type="button" tabIndex={-1} aria-label={`Increase ${label}`} disabled={disabled || max != null && n != null && n >= max} onClick={() => bump(1)}><Icon name="up" size={12} /></button>
        <button type="button" tabIndex={-1} aria-label={`Decrease ${label}`} disabled={disabled || min != null && n != null && n <= min} onClick={() => bump(-1)}><Icon name="down" size={12} /></button>
      </span>
    </span>
  );
}
