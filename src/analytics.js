import { moduleResult, studentTotals } from "./grading.js";

const periodOrder = (period) => {
  const match = /^(\d{4})\|Term\s*(\d+)$/i.exec(period);
  return match ? Number(match[1]) * 10 + Number(match[2]) : 0;
};

export function periodsInOrder(store) {
  return Object.keys(store || {}).filter((key) => Array.isArray(store[key])).sort((a, b) => periodOrder(a) - periodOrder(b));
}

function periodAverage(record, scale) {
  return record ? studentTotals(record.modules || [], scale).avg : null;
}

export function buildProgressAlerts({ store, students, meta, cfg, lowAverage = 50, dropThreshold = 10 }) {
  const key = `${meta.year}|${meta.term}`;
  const records = Array.isArray(store?.[key]) ? store[key] : [];
  const classStudents = students.filter((student) => student.grade === meta.grade && String(student.division).toLowerCase() === String(meta.className).toLowerCase());
  const roster = classStudents.length ? classStudents : students;
  const alerts = [];

  for (const student of roster) {
    const record = records.find((item) => String(item.studentId).toLowerCase() === String(student.index).toLowerCase());
    if (!record) {
      alerts.push({ id: `missing:${student.index}`, kind: "Missing marks", student, message: `${student.name} has no report for ${meta.term} ${meta.year}.` });
      continue;
    }
    const incomplete = (record.modules || []).filter((module) => !module.absent && moduleResult(module, cfg.scale).total == null);
    if (incomplete.length) {
      alerts.push({
        id: `incomplete:${student.index}`,
        kind: "Incomplete marks",
        student,
        message: `${student.name} is missing marks in ${incomplete.map((module) => module.moduleTitle || "a subject").join(", ")}.`,
      });
    }
    const average = periodAverage(record, cfg.scale);
    if (average < lowAverage) {
      alerts.push({ id: `low:${student.index}`, kind: "Support needed", student, message: `${student.name}'s current average is ${average.toFixed(1)}%.` });
    }

    const periods = periodsInOrder(store);
    const currentIndex = periods.indexOf(key);
    const previousKey = currentIndex > 0 ? periods[currentIndex - 1] : null;
    const previousRecord = previousKey && store[previousKey].find((item) => String(item.studentId).toLowerCase() === String(student.index).toLowerCase());
    const previousAverage = periodAverage(previousRecord, cfg.scale);
    if (previousAverage != null && average != null && previousAverage - average >= dropThreshold) {
      alerts.push({
        id: `fall:${student.index}`,
        kind: "Falling average",
        student,
        message: `${student.name}'s average fell ${(previousAverage - average).toFixed(1)} points since ${previousKey.replace("|", " ")}.`,
      });
    }
  }
  return alerts;
}

export function comparePeriods(store, earlierKey, laterKey, scale) {
  const earlier = new Map((store?.[earlierKey] || []).map((record) => [String(record.studentId).toLowerCase(), record]));
  const later = new Map((store?.[laterKey] || []).map((record) => [String(record.studentId).toLowerCase(), record]));
  const ids = new Set([...earlier.keys(), ...later.keys()]);
  return [...ids].map((id) => {
    const before = earlier.get(id), after = later.get(id);
    const beforeAverage = periodAverage(before, scale);
    const afterAverage = periodAverage(after, scale);
    const beforeSubjects = new Map((before?.modules || []).map((module) => [module.moduleId || module.moduleTitle, module]));
    const afterSubjects = new Map((after?.modules || []).map((module) => [module.moduleId || module.moduleTitle, module]));
    const subjects = [...new Set([...beforeSubjects.keys(), ...afterSubjects.keys()])].map((subject) => {
      const beforeTotal = beforeSubjects.has(subject) ? moduleResult(beforeSubjects.get(subject), scale).total : null;
      const afterTotal = afterSubjects.has(subject) ? moduleResult(afterSubjects.get(subject), scale).total : null;
      return { subject: afterSubjects.get(subject)?.moduleTitle || beforeSubjects.get(subject)?.moduleTitle || subject, before: beforeTotal, after: afterTotal, change: beforeTotal == null || afterTotal == null ? null : afterTotal - beforeTotal };
    });
    return {
      studentId: after?.studentId || before?.studentId || id,
      name: after?.name || before?.name || "Student",
      beforeAverage,
      afterAverage,
      averageChange: beforeAverage == null || afterAverage == null ? null : afterAverage - beforeAverage,
      subjects,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
