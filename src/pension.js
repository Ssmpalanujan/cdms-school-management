const DAY_MS = 86400000;

function parseLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addYearsClamped(dateValue, years) {
  const date = parseLocalDate(dateValue);
  if (!date) return "";
  const year = date.getFullYear() + Number(years);
  const month = date.getMonth();
  const day = Math.min(date.getDate(), new Date(year, month + 1, 0).getDate());
  return formatLocalDate(new Date(year, month, day));
}

export function addMonthsClamped(dateValue, months) {
  const date = parseLocalDate(dateValue);
  if (!date) return "";
  const target = new Date(date.getFullYear(), date.getMonth() + Number(months), 1);
  const day = Math.min(date.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate());
  return formatLocalDate(new Date(target.getFullYear(), target.getMonth(), day));
}

function localDayNumber(value) {
  const date = parseLocalDate(value);
  return date ? Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS : NaN;
}

export function datePartsBetween(fromValue, toValue) {
  const from = parseLocalDate(fromValue);
  const to = parseLocalDate(toValue);
  if (!from || !to || to < from) return { years: 0, months: 0, days: 0 };
  let cursor = fromValue;
  let years = 0;
  while (addYearsClamped(fromValue, years + 1) <= toValue) years++;
  cursor = addYearsClamped(fromValue, years);
  let months = 0;
  while (addMonthsClamped(cursor, months + 1) <= toValue) months++;
  cursor = addMonthsClamped(cursor, months);
  return { years, months, days: localDayNumber(toValue) - localDayNumber(cursor) };
}

export function formatDateParts(parts) {
  const units = [["year", parts.years], ["month", parts.months], ["day", parts.days]];
  return units.filter(([, value]) => value > 0).map(([unit, value]) => `${value} ${unit}${value === 1 ? "" : "s"}`).join(" ") || "0 days";
}

export function validateTeacherDates({ dateOfBirth, dateJoined }, today) {
  const errors = {};
  const dob = parseLocalDate(dateOfBirth);
  const joined = parseLocalDate(dateJoined);
  if (!dob || dateOfBirth >= today) errors.dateOfBirth = "Date of birth must be a valid date in the past.";
  if (!joined) errors.dateJoined = "Enter a valid service start date.";
  else if (dateJoined > today) errors.dateJoined = "Date joined cannot be in the future.";
  else if (!dob || dateJoined < addYearsClamped(dateOfBirth, 18)) errors.dateJoined = "The teacher must be at least 18 when joining the service.";
  return errors;
}

export function pensionDetails(teacher, retirementAge = 60, today = formatLocalDate(new Date())) {
  const retirementDate = addYearsClamped(teacher?.dateOfBirth, retirementAge);
  if (!retirementDate) return { retirementDate: "", remaining: null, daysLeft: null, service: null, retired: false };
  const daysLeft = localDayNumber(retirementDate) - localDayNumber(today);
  const retired = daysLeft < 0;
  const remaining = retired ? { years: 0, months: 0, days: 0 } : datePartsBetween(today, retirementDate);
  const service = parseLocalDate(teacher?.dateJoined) ? datePartsBetween(teacher.dateJoined, today) : null;
  return { retirementDate, remaining, daysLeft, service, retired };
}

export function retirementGroup(teacher, retirementAge = 60, today = formatLocalDate(new Date())) {
  const details = pensionDetails(teacher, retirementAge, today);
  if (details.daysLeft == null || details.daysLeft < 0) return "";
  if (details.retirementDate <= addMonthsClamped(today, 3)) return "3 months";
  if (details.retirementDate <= addMonthsClamped(today, 6)) return "6 months";
  if (details.retirementDate <= addMonthsClamped(today, 12)) return "12 months";
  return "";
}

export { formatLocalDate, parseLocalDate };
