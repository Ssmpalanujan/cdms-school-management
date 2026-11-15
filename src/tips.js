import { hasData, num } from "./grading.js";
import { upcoming, d } from "./calendar.js";

const PAGE_TIPS = {
  home: { en: "Welcome. Pick a quick action below to get started.", ta: "வணக்கம்! கீழே உள்ள விரைவுச் செயல்களில் ஒன்றைத் தேர்ந்தெடுங்கள்." },
  builder: { en: "Fill in the school details first, then add the marks.", ta: "முதலில் பள்ளி விவரங்களை நிரப்பி, பிறகு மதிப்பெண்களைச் சேருங்கள்." },
  summary: { en: "Choose a module to see its class average and grade spread.", ta: "ஒரு பாடத்தைத் தேர்ந்தெடுத்து வகுப்புச் சராசரியைப் பாருங்கள்." },
  calendar: { en: "Switch between the Tamil & Sinhala and Muslim school schedules.", ta: "தமிழ்/சிங்கள மற்றும் முஸ்லிம் பள்ளி அட்டவணைகளுக்கு இடையே மாறலாம்." },
  students: { en: "Add students once. The index number links them to their marks.", ta: "மாணவர்களை ஒருமுறை சேருங்கள். சுட்டெண் அவர்களின் மதிப்பெண்களுடன் இணைக்கும்." },
  reports: { en: "Pick a report type, then print it. Tick grades only to hide GPA.", ta: "அறிக்கை வகையைத் தேர்ந்தெடுத்து அச்சிடுங்கள். GPA மறைக்க grades only தேர்ந்தெடுங்கள்." },
  leave: { en: "Leave days count Monday to Friday. Balances update when you submit.", ta: "விடுப்பு நாட்கள் திங்கள் முதல் வெள்ளி வரை கணக்கிடப்படும். சமர்ப்பித்ததும் இருப்பு மாறும்." },
  announcements: { en: "Important notices stay at the top. Choose who should see each announcement.", ta: "முக்கிய அறிவிப்புகள் மேலே இருக்கும். ஒவ்வொரு அறிவிப்பையும் யார் பார்க்க வேண்டும் என்பதைத் தேர்ந்தெடுங்கள்." },
  users: { en: "Create a username and password for each teacher and student. Passwords cannot be shown again, so note them down.", ta: "ஒவ்வொரு ஆசிரியருக்கும் மாணவருக்கும் பயனர்பெயரும் கடவுச்சொல்லும் உருவாக்குங்கள். கடவுச்சொல்லை மீண்டும் காட்ட முடியாது, குறித்து வையுங்கள்." },
  accounts: { en: "Create one login for each teacher and student. Share the password only with that person.", ta: "ஒவ்வொரு ஆசிரியருக்கும் மாணவருக்கும் தனி உள்நுழைவை உருவாக்குங்கள். கடவுச்சொல்லை அவருடன் மட்டும் பகிருங்கள்." },
  results: { en: "Pick a year and term at the top to see your results. You can print your report card.", ta: "மேலே ஆண்டையும் தவணையையும் தேர்ந்தெடுத்து உங்கள் முடிவுகளைப் பாருங்கள். அறிக்கையை அச்சிடலாம்." },
  guide: { en: "Download the sample workbook to see the exact column order.", ta: "நெடுவரிசை வரிசையைப் பார்க்க மாதிரிப் பணிப்புத்தகத்தைப் பதிவிறக்குங்கள்." },
};

// Builds a list of tips from what the user has (and has not) done yet. Most useful tips come first.
export function buildTips({ page, meta, records, rows, cfg, printed, role = "admin" }) {
  const out = [];
  const add = (en, ta) => out.push({ en, ta });

  if (page === "builder") {
    const used = rows.filter(hasData);
    const smax = 100 - cfg.fmax;
    if (used.some((r) => (num(r.formative) ?? 0) > cfg.fmax || (num(r.summative) ?? 0) > smax)) {
      add(`Formative is out of ${cfg.fmax} and summative out of ${smax}. Change this in Weights & GPV if your marks use a different split.`,
        `Formative ${cfg.fmax}, Summative ${smax} என அமைக்கப்பட்டுள்ளது. வேறு பிரிவு என்றால் Weights & GPV-இல் மாற்றுங்கள்.`);
    }
  }
  if (role === "student") return [page === "home" ? { en: "Welcome. Your results and announcements are below.", ta: "வணக்கம்! உங்கள் முடிவுகளும் அறிவிப்புகளும் கீழே உள்ளன." } : PAGE_TIPS[page] || PAGE_TIPS.home];
  out.push(PAGE_TIPS[page] || PAGE_TIPS.home);
  if (role === "teacher") { if (!records.length) add("Enter marks for your class in the report builder.", "அறிக்கை உருவாக்கியில் உங்கள் வகுப்பின் மதிப்பெண்களை உள்ளிடுங்கள்."); return out; }
  if (!meta.schoolName || !meta.classTeacher) add("Add the school name and class teacher in the report builder.", "பள்ளியின் பெயரையும் வகுப்பாசிரியர் பெயரையும் நிரப்புங்கள்.");
  if (!meta.logo) add("Upload your school logo so it shows on the reports.", "அறிக்கைகளில் தோன்ற பள்ளிச் சின்னத்தை (logo) பதிவேற்றுங்கள்.");
  if (!records.length) add("Import marks from a workbook, or add a record by hand.", "பணிப்புத்தகத்திலிருந்து மதிப்பெண்களை இறக்குமதி செய்யுங்கள், அல்லது பதிவைக் கையால் சேருங்கள்.");
  else if (!printed) add("Print your first report card to finish setup.", "அமைப்பை முடிக்க முதல் அறிக்கையை அச்சிட்டுப் பாருங்கள்.");

  const next = upcoming(meta.schedule || "tamil-sinhala").find((x) => /starts$/.test(x.title));
  if (next) {
    const now = new Date(), t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const n = Math.round((d(next.date) - t) / 864e5);
    if (n >= 0 && n <= 14) add(`${next.title.replace(" starts", "")} starts ${n === 0 ? "today" : `in ${n} day${n === 1 ? "" : "s"}`}.`, `${next.title.replace(" starts", "")} ${n === 0 ? "இன்று" : `${n} நாட்களில்`} தொடங்குகிறது.`);
  }
  return out;
}
