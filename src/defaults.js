export const uid = () => Math.random().toString(36).slice(2, 9);
export const TERMS = ["Term 1", "Term 2", "Term 3"];
export const blankRow = () => ({ id: uid(), studentId: "", name: "", moduleId: "", moduleTitle: "", formative: "", summative: "", credit: 1, absent: false, absentRemark: "", activities: [] });
export const blankMeta = {
  schoolName: "", schoolNameEn: "", zone: "", principal: "", schoolPhone: "", schedule: "tamil-sinhala", schoolAddress: "",
  grade: "Grade 6", className: "A", medium: "English", classTeacher: "", term: "Term 1", year: String(new Date().getFullYear()), logo: "",
};
