import { useRef, useState } from "react";
import { createBackup, createCheckpoint, downloadBackup, parseBackup, readCheckpoints, restoreData } from "./backup.js";
import { logActivity } from "./activity.js";

function bytes(data) {
  return new Blob([JSON.stringify(data)]).size;
}

export default function Backups() {
  const fileRef = useRef(null);
  const [checkpoints, setCheckpoints] = useState(() => readCheckpoints());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => setCheckpoints(readCheckpoints());
  const checkpoint = (reason = "Manual checkpoint") => {
    try {
      const item = createCheckpoint(reason);
      refresh();
      setError("");
      setMessage(`Checkpoint saved: ${new Date(item.createdAt).toLocaleString()}.`);
      logActivity("backup", `Saved checkpoint: ${reason}`);
    } catch (problem) {
      setError(problem.message);
    }
  };
  const exportBackup = () => {
    try {
      const backup = createBackup();
      downloadBackup(backup);
      setMessage(`Backup exported (${Object.keys(backup.data).length} data sections, ${(bytes(backup.data) / 1024).toFixed(1)} KB).`);
      setError("");
      logActivity("backup", "Exported school data backup");
    } catch (problem) {
      setError(problem.message);
    }
  };
  const restore = async (data, reason) => {
    if (!window.confirm(`Restore ${reason}? Current school data will first be saved as a checkpoint. The restore cannot be automatically undone.`)) return;
    setBusy(true);
    try {
      createCheckpoint(`Before restore: ${reason}`);
      restoreData(data);
      logActivity("restore", `Restored school data: ${reason}`);
      window.location.reload();
    } catch (problem) {
      setError(problem.message);
      refresh();
    } finally {
      setBusy(false);
    }
  };
  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setMessage("");
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Backup files must be 20 MB or smaller.");
      const backup = parseBackup(await file.text());
      await restore(backup.data, `backup from ${new Date(backup.createdAt).toLocaleString()}`);
    } catch (problem) {
      setError(problem.message);
    }
  };

  return (
    <>
      <div className="pagehead"><h2>Backups and restore</h2><span className="muted">Saved locally in this browser</span></div>
      <div className="card note">
        <b>Protect your data before major changes.</b>
        <p className="muted">A backup contains school records and settings, but never usernames, password hashes, or the signed-in session. Keep downloaded backups somewhere safe. Browser-only checkpoints do not sync across devices.</p>
      </div>
      {error && <div className="alert bad" role="alert">{error}</div>}
      {message && <div className="alert ok" role="status">{message}</div>}
      <section className="card">
        <h3>Export or restore school data</h3>
        <div className="row">
          <button className="btn" onClick={exportBackup}>Download full backup</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()} disabled={busy}>Import a backup</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importFile} />
          <button className="btn ghost" onClick={() => checkpoint()} disabled={busy}>Create checkpoint now</button>
        </div>
      </section>
      <section className="card">
        <div className="acthead"><h3>Recent checkpoints</h3><span className="muted">Up to 10 saved</span></div>
        {!checkpoints.length ? <p className="muted">No checkpoints saved yet.</p> : <div className="scroll"><table className="tbl">
          <thead><tr><th>Created</th><th>Reason</th><th>Size</th><th>Action</th></tr></thead>
          <tbody>{checkpoints.map((item) => <tr key={item.id}>
            <td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.reason}</td><td>{(bytes(item.data) / 1024).toFixed(1)} KB</td>
            <td><button className="btn ghost sm" onClick={() => restore(item.data, `checkpoint "${item.reason}"`)} disabled={busy}>Restore</button></td>
          </tr>)}</tbody>
        </table></div>}
      </section>
    </>
  );
}
