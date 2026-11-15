import { useCallback, useEffect } from "react";
import { useLocal } from "./useLocal.js";

const EMPTY = [];
// Marks are stored per academic year and term: { "2026|Term 1": [records] }
export function usePeriodRecords(meta) {
  const [raw, setStore] = useLocal("srb-marks", {});
  const [legacy, setLegacy] = useLocal("srb-records", []);
  const store = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const key = `${meta.year}|${meta.term}`;
  useEffect(() => { // older versions kept one list of records, move it into the current period once
    if (Array.isArray(legacy) && legacy.length) { setStore((s) => ((s && s[key] && s[key].length) ? s : { ...(s || {}), [key]: legacy })); setLegacy([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const records = Array.isArray(store[key]) ? store[key] : EMPTY;
  const setRecords = useCallback((v) => setStore((s) => { const o = s && typeof s === "object" ? s : {}; return { ...o, [key]: typeof v === "function" ? v(Array.isArray(o[key]) ? o[key] : EMPTY) : v }; }), [key, setStore]);
  const setRecordsFor = useCallback((year, term, v) => setStore((s) => ({ ...(s || {}), [`${year}|${term}`]: v })), [setStore]);
  return { records, setRecords, setRecordsFor, store, setStore };
}
