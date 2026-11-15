const P = {
  home: "M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6",
  builder: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h4",
  summary: "M5 20V10M12 20V4M19 20v-7",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  academicYears: "M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 14h3M14 14h3M8 18h3M14 18h3",
  guide: "M5 4h14v16H5zM9 4v16M12 9h4M12 13h4",
  left: "M15 6l-6 6 6 6",
  right: "M9 6l6 6-6 6",
  check: "M5 12l5 5 9-10",
  clock: "M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z",
  up: "M6 15l6-6 6 6",
  down: "M6 9l6 6 6-6",
  newfile: "M6 3h9l4 4v14H6zM14 3v5h5M12 11v6M9 14h6",
  upload: "M12 16V4M7 9l5-5 5 5M5 20h14",
  pencil: "M4 20l4-1 11-11-3-3L5 16zM14 6l3 3",
  print: "M7 9V3h10v6M7 17H5v-6h14v6h-2M7 14h10v7H7z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  students: "M9 11a3 3 0 100-6 3 3 0 000 6zM3 20v-1a5 5 0 0110 0v1M16 11a3 3 0 100-6M17 14a5 5 0 014 5v1",
  leave: "M5 4h14v16H5zM9 2v4M15 2v4M8 12l3 3 5-6",
  reports: "M7 9V3h10v6M7 17H5v-6h14v6h-2M7 14h10v7H7z",
  announce: "M3 11v2a1 1 0 001 1h3l6 4V6L7 10H4a1 1 0 00-1 1zM16 9a4 4 0 010 6",
  users: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
  announcements: "M3 11v2l12 5V6L3 11zM15 8a4 4 0 010 8M6 14v5h3v-4",
  accounts: "M14 10a4 4 0 11-3 6.5L4 20v-3l1-1h2v-2h2l1.5-1.5A4 4 0 0114 10z",
  assignments: "M8 5h12M8 12h12M8 19h12M3 5l1 1 2-2M3 12l1 1 2-2M3 19l1 1 2-2",
  results: "M5 20V10M12 20V4M19 20v-7",
  workflow: "M5 4h14v16H5zM9 8h6M9 12h6M9 16h3M17 8l1 1 2-2",
  profile: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  attendance: "M4 5h16v15H4zM8 3v4M16 3v4M7 11h4M7 15h3M14 13l2 2 3-4",
  records: "M4 5h10v14H4zM8 9h3M8 13h3M17 8h3v11h-4M14 11h3M14 15h3",
  progress: "M4 19V5M4 19h17M7 15l4-4 3 2 6-7",
  audit: "M4 5h16M4 10h16M4 15h10M4 20h8M18 16v5M16 19h4",
  backup: "M12 3v12M7 10l5 5 5-5M4 20h16",
  close: "M6 6l12 12M18 6L6 18",
  menu: "M4 6h16M4 12h16M4 18h16",
};

export default function Icon({ name, size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  );
}
