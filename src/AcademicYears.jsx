import { useState } from "react";
import { toast } from "./toastBus.js";
import { logActivity } from "./activity.js";
import { addAcademicYear, setCurrentAcademicYear, closeAcademicYear } from "./academic.js";

export default function AcademicYears({ s }) {
  const { academicYears, setAcademicYears, currentYear, setCurrentYear } = s;
  const [year, setYear] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const sorted = [...academicYears]
    .sort((a, b) => b.year.localeCompare(a.year, undefined, { numeric: true }))
    .filter((item) => item.year.includes(query.trim()))
    .filter((item) => statusFilter === "all" || (statusFilter === "closed" ? item.closed : !item.closed));
  const openCount = academicYears.filter((item) => !item.closed).length;
  const closedCount = academicYears.length - openCount;
  const add = (event) => {
    event.preventDefault();
    const value = year.trim();
    let updated;
    try { updated = addAcademicYear(academicYears, value, { role: "admin" }); }
    catch (error) { return toast(error.message, "bad"); }
    setAcademicYears(updated);
    logActivity("academic-year", `Academic year ${value} added`);
    setYear("");
    toast(`Academic year ${value} added`);
  };
  const makeCurrent = (item) => {
    if (item.closed) return toast("A closed year cannot be set as current.", "bad");
    if (!window.confirm(`Set ${item.year} as the current academic year?`)) return;
    setAcademicYears(setCurrentAcademicYear(academicYears, item.year, { role: "admin" }));
    setCurrentYear(item.year);
    logActivity("academic-year", `Academic year ${item.year} set as current`);
    toast(`${item.year} is now the current academic year`);
  };
  const close = (item) => {
    if (!window.confirm(`Close ${item.year}? Marks, results and attendance for this year become read-only.`)) return;
    let updated;
    try { updated = closeAcademicYear(academicYears, item.year, { role: "admin" }); }
    catch (error) { return toast(error.message, "bad"); }
    setAcademicYears(updated);
    const newCurrent = updated.find((entry) => entry.current);
    if (item.current && newCurrent) setCurrentYear(newCurrent.year);
    logActivity("academic-year", `Academic year ${item.year} closed`);
    toast(`Academic year ${item.year} closed`);
  };

  return <>
    <div className="pagehead"><h2>Academic years</h2><span className="muted">Current year: {currentYear}</span></div>
    <section className="card">
      <form className="academic-year-form" onSubmit={add}>
        <label className="field"><span>New academic year</span><input aria-label="New academic year" type="number" min="1000" max="9999" step="1" value={year} onChange={(event) => setYear(event.target.value)} placeholder="2027" /></label>
        <button className="btn teal" type="submit">Add year</button>
      </form>
      <p className="muted">New academic years start with empty marks and results. Closing a year makes its records read-only; history is retained.</p>
    </section>
    <section className="kpis kpis3 academic-year-summary" aria-label="Academic year summary">
      <article className="card kpi"><span className="muted">Total years</span><b>{academicYears.length}</b><span>Academic year records</span></article>
      <article className="card kpi"><span className="muted">Open years</span><b>{openCount}</b><span>Available for school records</span></article>
      <article className="card kpi"><span className="muted">Closed years</span><b>{closedCount}</b><span>Read-only history</span></article>
    </section>
    <section className="card">
      <div className="acthead academic-year-list-head">
        <h3>Years</h3>
        <div className="filters academic-year-filters">
          <label className="sr" htmlFor="academic-year-search">Search academic years</label>
          <input id="academic-year-search" type="search" aria-label="Search academic years" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by year" />
          <label className="sr" htmlFor="academic-year-status">Filter academic years</label>
          <select id="academic-year-status" aria-label="Filter academic years" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>
      {!sorted.length ? <p className="muted">{academicYears.length ? "No academic years match these filters." : "No academic years have been added."}</p> : <div className="scroll"><table className="tbl academic-year-table">
        <thead><tr><th>Academic year</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{sorted.map((item) => <tr key={item.year}>
          <td>{item.year}</td><td><span className={`chip ${item.closed ? "st-rejected" : item.current ? "st-approved" : "plain"}`}>{item.closed ? "Closed · read-only" : item.current ? "Current year" : "Open"}</span></td>
          <td className="acts">{!item.current && !item.closed && <button className="linkbtn" onClick={() => makeCurrent(item)}>Set as current</button>}{!item.closed && <button className="linkbtn del" onClick={() => close(item)}>Close year</button>}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}
