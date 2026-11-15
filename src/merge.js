// Merges imported marks into the current records without silently overwriting anything.
export function countDuplicates(existing, incoming) {
  const by = new Map(existing.map((r) => [String(r.studentId), r]));
  let n = 0;
  incoming.forEach((r) => { const cur = by.get(String(r.studentId)); if (cur) r.modules.forEach((m) => { if (cur.modules.some((x) => x.moduleId === m.moduleId)) n++; }); });
  return n;
}
export function mergeRecords(existing, incoming, replace) {
  const by = new Map(existing.map((r) => [String(r.studentId), { ...r, modules: [...r.modules] }]));
  let added = 0, replaced = 0, skipped = 0;
  incoming.forEach((r) => {
    const k = String(r.studentId), isNew = !by.has(k);
    const cur = by.get(k) || { studentId: k, name: r.name, modules: [], remark: "" };
    r.modules.forEach((m) => {
      const i = cur.modules.findIndex((x) => x.moduleId === m.moduleId);
      if (i < 0) { cur.modules.push(m); added++; } else if (replace) { cur.modules[i] = m; replaced++; } else skipped++;
    });
    if (isNew) by.set(k, cur);
  });
  return { records: [...by.values()], added, replaced, skipped };
}
