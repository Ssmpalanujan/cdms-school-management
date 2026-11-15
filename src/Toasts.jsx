import { useEffect, useState } from "react";

export default function Toasts() {
  const [list, setList] = useState([]);
  useEffect(() => {
    const on = (e) => {
      const id = Math.random().toString(36).slice(2, 8);
      setList((l) => [...l.slice(-3), { id, ...e.detail }]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 3800);
    };
    window.addEventListener("srb-toast", on);
    return () => window.removeEventListener("srb-toast", on);
  }, []);
  return (
    <div className="toasts no-print" role="status" aria-live="polite">
      {list.map((t) => <div key={t.id} className={"toast " + t.type}>{t.message}</div>)}
    </div>
  );
}
