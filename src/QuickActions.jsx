import Icon from "./Icon.jsx";

export default function QuickActions({ actions }) {
  return (
    <div className="qa">
      {actions.map(([ic, t, sub, fn]) => (
        <button className="card qcard" key={t} onClick={fn}>
          <span className="qi" aria-hidden="true"><Icon name={ic} size={24} /></span>
          <span><b>{t}</b><br /><span className="muted">{sub}</span></span>
        </button>
      ))}
    </div>
  );
}
