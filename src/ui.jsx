export function Field({ label, error, children }) {
  return (
    <div className={"fieldwrap" + (error ? " has-err" : "")}>
      <label className="field"><span>{label}</span>{children}</label>
      {error && <small className="ferr" role="alert">{error}</small>}
    </div>
  );
}
export function Head({ meta }) {
  return (
    <div className="phead">
      {meta.logo && <img src={meta.logo} alt="" />}
      <div><h2>{meta.schoolName || "School name"}</h2><p>{meta.schoolAddress}</p></div>
    </div>
  );
}
