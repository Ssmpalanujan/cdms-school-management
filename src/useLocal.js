import { useState, useEffect } from "react";

export function useLocal(key, init) {
  const [v, setV] = useState(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; } catch { return init; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full */ } }, [key, v]);
  return [v, setV];
}

// Like useLocal, but when `auto` is off the value is only written when commit() is called.
export function useDraft(key, init, auto) {
  const read = () => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; } catch { return init; } };
  const [v, setV] = useState(read);
  const [dirty, setDirty] = useState(false);
  const write = (x) => { try { localStorage.setItem(key, JSON.stringify(x)); } catch { /* storage full */ } };
  useEffect(() => { if (auto) { write(v); setDirty(false); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, auto]);
  const set = (x) => { setV(x); if (!auto) setDirty(true); };
  const commit = () => { write(v); setDirty(false); };
  return [v, set, dirty, commit];
}
