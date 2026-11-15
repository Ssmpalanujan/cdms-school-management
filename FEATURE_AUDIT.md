# Feature audit: கல்வி வலை (React + Vite, browser storage)

> Update: admin, teacher and student dashboards, separate logins, announcements and the welcome screen were added. See the section "Roles, logins and announcements" at the end.
> Sidebar update: Student progress, Activity history, and Backups & restore are no longer listed in navigation. The admin dashboard retains shortcuts to progress and browser backups.

Status key: DONE = built and covered by an automated test or build check, PARTIAL = built with a stated limit, NOT DONE = left out on purpose.

The app is frontend-only. All data lives in the browser (localStorage). There is no server, so sign-in, roles and leave approval are screen-level controls, not real security.

## A. School profile and dashboard (Home dashboard, `Home.jsx`)
| Requirement | Status | Where / notes |
|---|---|---|
| School profile (name, address, phone, zone) | DONE | Home "School profile"; edit in Report builder > School details |
| Principal name | DONE (new) | Report builder > School details |
| Total, male, female student counts | DONE (new) | From the Students list. Students with no gender are counted in the total only |
| Division-wise count | DONE (new) | Chips such as "Grade 6 A: 12" |
| Dashboard cards | DONE | Students, subjects, class average, records saved |
| Leave summary and remaining balances | DONE (new) | Home "Leave summary" for the class teacher |
| Reminders | DONE (new) | Pending approvals, leave starting within 7 days, late submissions, low balances |
| Student/teacher daily attendance | NOT DONE | Only leave is tracked ("on approved leave today"). Daily attendance was not defined in the requirements |

## B. Student management (`Students.jsx`, `students.js`)
| Add, view, edit, delete | DONE (new) | Delete is admin only. Marks already entered are kept |
| Index, name, gender, grade, division, date of birth, guardian phone | DONE (new) | Validation per field |
| Duplicate index prevention | DONE (new) | Case-insensitive. Tested |
| Search and filters (grade, division, gender) | DONE (new) | |
| Import / export / template | DONE (new) | Rows with errors or duplicate indexes are skipped and listed |
| Students created from marks | DONE | Students that appear in marks are added automatically (gender blank) |

## C. Marks management (`Builder.jsx`, `grading.js`, `usePeriod.js`)
| Formative and summative | DONE | Weights configurable (admin) |
| Academic year and Term 1/2/3 | DONE (new) | Selectors in the top bar. Marks are stored per year and term. Older data moves into the current period once |
| Class (grade and division) selection | DONE | School details; index numbers suggest students of that class |
| Module-wise entry | DONE | |
| Multiple activities with marks and maximum | DONE (new) | "Activities" dialog. Formative = activity total scaled to the formative maximum |
| Credit and total | DONE | Credits, total and average shown per record |
| Validation and warnings | DONE (new) | Over-limit marks block saving. Empty marks and incomplete entries show warnings |
| Absent status and remark | DONE (new) | Absent subjects are excluded from GPA and credits and shown as AB |
| Duplicate protection | DONE (new) | Same student and subject twice in the table is blocked. Existing entries ask before they are replaced |

## D. GPA and grade
| Configurable grade scale | DONE | Starting values are only defaults. Edit them to match your school rules |
| GPA and grade display | DONE | |
| GPA verify | DONE (new) | "Verify GPA" compares manual values with the marks |
| GPA edit | DONE (new) | Admin only. Shown as Manual, with Reset to the calculated value |

## E. Saving, reports, printing (`Reports.jsx`, `PrintCards.jsx`)
| Auto-save and manual save | DONE (new) | Marks table auto-save can be switched off. Unsaved changes warning in the top bar and on closing the page |
| Student reports, class marks report | DONE (new) | |
| Marking sheet (blank, for handwriting) | DONE (new) | Grade 6 Art face-drawing score sheet (Tamil) plus the class marks sheet with 1 to 10 activity columns |
| Rubric chart | DONE (new) | All 36 Tamil charts from the Grade 6 Art teacher guide, plus an editable custom rubric |
| Absent list with remarks | DONE (new) | |
| Print grades only (no GPA) | DONE (new) | Report cards and class marks report |
| Clean print layout | PARTIAL | Print CSS hides navigation and buttons. Checked in code only, not in a print preview |

## F. Excel (`sheet.js`)
| Template, export, import | DONE | |
| Marks report columns (No., Full Name, Index Number, Grade, Division, Date, Activities, Credit, GPA, Grade, Remarks) | DONE (new) | One row per student and subject. Tested |
| Import validation, invalid rows, duplicates | DONE (new) | Valid rows import, invalid rows are listed. Duplicates are skipped unless you choose to replace |
| Importing activity columns | NOT DONE | Activities are exported but not imported |

## G. Authentication (`Login.jsx`)
| Sign up fields (name, school, phone, email, password) and role | DONE (new) | |
| Forgot password | Admin reset | Ask the school administrator to reset the password from User accounts |
| Roles | PARTIAL | Admin and Teacher. Teachers cannot edit GPA, grading, delete students, approve leave or manage teachers. Hidden in the screens only |
| Passwords | PARTIAL | Stored as a SHA-256 hash in the browser. This is a demo, not secure login. A real backend is needed |

## H. Teacher leave (`Leave.jsx`, `leave.js`)
| Record number, teacher, dates, type, reason, status | DONE (new) | Numbers like L-2026-001 |
| Types: sick, casual, duty, special | DONE (new) | |
| Day count | PARTIAL | Counts Monday to Friday. Public holidays and half days are not handled. A leave that spans two years is counted in the start year |
| Balances (total, used, remaining) | DONE | Per teacher and academic year; pending and approved count as used. Defaults are Casual 21, Sick 21, Special 0 and Duty 0. Admin can configure each year's entitlement; new years start with defaults |
| Overlap and balance validation | DONE (new) | Tested |
| Add, edit, cancel, approve, reject | DONE (new) | Approve and reject are admin only |
| Reminders and submission tracking | DONE (new) | Late submissions flagged |
| Teacher list, details and pension | PARTIAL | Add/edit/delete/search; admin can manage details, filter/export pension dates and see retirement groups; teachers see their own pension card. Date validation applies when DOB is supplied, so DOB/joined-date completeness is not enforced |

## I. Academic years, promotions and pension (new)
| Requirement | Status | Where / notes |
|---|---|---|
| Academic-year administration | DONE | `AcademicYears.jsx`: admin-only add, set current and close; closed years are read-only. Staff see the current year as text and cannot select another year |
| Yearly leave entitlements and migration | DONE | `academic.js`, `leave.js`: per-year defaults and balances; legacy flat entitlements migrate while preserving customized values. Legacy student records receive a current-year enrollment |
| Teacher details and pension countdown | PARTIAL | `Leave.jsx`, `pension.js`: details are linked to a teacher login by account ID, so teachers see only their own read-only details and pension data. Retirement date, time remaining, days left, service time, retired status, admin retirement groups and Excel export are included. DOB remains optional for backward compatibility |
| Promotion and previous-class data requests | PARTIAL | `Promotions.jsx`, `promotions.js`, `historyRequests.js`: class promotion flow plus class-teacher requests to prior teachers for published records. The prior teacher can approve/decline; approved history shows student name/index, activities, marks, grade and GPA read-only. Direct shares are limited to the named teacher, selected students and source class/year, and can be revoked. All requests and grants remain local-browser data, not a secure multi-user workflow |
| Class record and Report Builder marks | DONE (new) | The navigation is named "Class record". The default tab combines a searchable student/subject table with current academic-year/term Report Builder sheets, including Draft and not-entered rows. Admins and assigned class teachers can review every assigned subject across the class roster; subject teachers see only entered marks for their assigned subjects. The visibility rule is enforced by `visibleClassRecordMarks()` in `resultsWorkflow.js` |
| Class record attendance and teacher sharing | DONE (new) | Class record rows include attendance totals and expandable date/status details for every recorded date, plus class teacher names. Attendance storage has no academic-year field, so the view labels this all-date scope explicitly. A class teacher can share selected students' details, attendance and published history read-only with a named teacher; recipient/student/class/year access checks live in `recordSharing.js` and `promotions.js`, and grants can be revoked. Promotion/sharing panels are available on a separate tab |
| Notifications and audit | PARTIAL | Academic-year, teacher-detail, retirement-setting, promotion, previous-class data request/decision, record-sharing/revocation, and expiry activity is logged. Sharing and related notifications target local account IDs. Delivery is limited to this browser's localStorage |
| Real authorization and cross-device sharing | NOT DONE | All state remains in localStorage; role and history checks can only protect the current app UI, not data against a modified client or synchronize separate devices |
| Exact academic-year attendance history | PARTIAL | Attendance is stored by calendar date without an academic-year enrollment link. Class record summaries and shared attendance include dates whose year prefix matches the academic-year value; years spanning different calendar years need a future attendance-to-enrollment mapping |

## J. Search, filters, notifications
| Search and filters | DONE | Students, records, leave, teachers |
| Success and error messages | DONE (new) | Toast messages and inline alerts |
| Empty states | DONE | |
| Responsive layout | PARTIAL | Built for phone, tablet and desktop. Not checked on real devices |
| Tamil / English | PARTIAL | Tamil marking sheet and 36 rubric charts are available; the rest of the screens are English. The owl helper is bilingual |

## Checks run
- `npm test`: PASS — 9 test files, 83 tests, including Report Builder class-mark access, teacher-to-teacher sharing, scoping/revocation, prior-class request/approval, leave, academic-year, pension, migration and existing workflows.
- `npm run build`: PASS — Vite production build completed with a large JavaScript chunk warning (about 1,036 kB minified).
- Not done: manual testing in real browsers and phones, print preview, accessibility audit.


## Roles, logins and announcements (new)
| Requirement | Status | Where / notes |
|---|---|---|
| Admin dashboard | DONE | `Home.jsx`: school profile, student counts, leave summary, leave register, pending leave, announcements, accounts, reminders |
| Teacher dashboard | DONE | `TeacherHome.jsx`: class size, marks entered, my leave balance and register, announcements, upcoming dates, quick actions |
| Student dashboard | DONE | `StudentHome.jsx`, `MyResults.jsx`: published results for the student's own grade/division and own marks only; GPA follows the setting saved at publication; report PDF print layout, announcements, term dates |
| Separate username and password per user | DONE | Admin creates teacher and student logins in User accounts (`Accounts.jsx`). One click creates logins for all students and downloads the passwords once as Excel. Passwords are hashed |
| Sign in with username or email | DONE | `Login.jsx`. First sign-up is the admin, later sign-ups are teachers. Students only get logins from the admin |
| Change own password / admin reset | DONE | Profile menu > Change password. Admin can reset any password |
| Welcome screen after sign in | DONE | "Welcome to <school name>", then the dashboard (`Welcome.jsx`). Tap, Enter or Continue to skip |
| Announcements | DONE | `Announcements.jsx`. Admin and teachers post for everyone, teachers only, or students only. Priority, optional end date, New tag and unread badge on the menu. Students cannot post |
| Leave: number, name, date, type, days | DONE | `Leave.jsx`, `LeaveRegister.jsx`. Casual, sick, duty, special. Number of days and end date follow each other (Monday to Friday). Teachers see and edit only their own leave, the admin approves |
| What each role sees | DONE | Admin: everything. Teacher: marks, students, reports, own leave, announcements. Student: dashboard, results, announcements, calendar |
| Real security | NOT DONE | Accounts, roles and data live in this browser. A student on another phone would not see the school's data. A backend is needed for that |

## Notes on this update
- Files from another editing session were found in the project folder. They are kept in `_unmerged/` (see its README). Home.jsx, UpcomingDates.jsx, ChangePassword.jsx and LeaveRegister.jsx were reconnected to this build.
- `npm test`: 16 automated tests pass (adds role dashboards, student sign-in with welcome screen, announcements, teacher leave, password change).
- Not checked in real browsers or phones.

## Results assignment, review and publication workflow
| Requirement | Status | Where / notes |
|---|---|---|
| Year-specific class teacher and subject teacher assignments | DONE | Admin Assign teachers page (`ClassAssignments.jsx`); one assignment per year/class, duplicate subjects blocked, setup gaps are shown on the admin dashboard |
| Subject-teacher-scoped marks entry | DONE | `Builder.jsx` preserves the Report builder school/grading sections and embeds `ScopedMarksEntry.jsx`. Once assignments exist for the current year, every teacher gets only their assigned subjects (or an empty state); unscoped legacy editing/import/printing is suppressed. The table includes formative/summative marks, credit, absence and remark, activities, total, grade, GPV, points, GPA and guarded row removal. Scoped mutations are permission-checked in `resultsWorkflow.js` |
| Report builder / workflow alignment | DONE | Workflow subject and preview tables expand to the available card width; marks entry retains a responsive horizontal scroll table on smaller screens |
| Legacy mark migration | DONE | `migrateLegacyMarks()` copies old period marks, credits, activities, absences and remarks into the scoped structure without deleting the old period store; a class stored on a record is retained, otherwise School details are used |
| Draft, submit, approve, request changes, publish | DONE | Results workflow page for teachers/admin; class teacher can review every subject in their class, changes require a comment, publish is blocked with specific missing marks/approval/validation reasons |
| Corrections, versioning and audit | DONE | Class teacher/admin can unpublish only with a reason; subject sheets return to Draft and republish increments the class version; admin can filter the audit log by action, class, year and term |
| Strict student results visibility | DONE | `publishedResultsForStudent()` checks published state, grade, division and student index, and returns a sanitized snapshot containing only that student's marks and identity |
| Class and individual result reports | PARTIAL | `resultsPdf.js` builds print-ready class, subject and student report layouts from saved data; browser print-to-PDF is used instead of a bundled PDF/font package, so Tamil rendering depends on fonts available to the browser/device |
| Notifications and dashboard summaries | DONE | Targeted workflow notifications, sidebar badges, subject/class teacher progress summaries, and an admin class readiness/approval overview |
| Backend authorization / cross-device delivery | NOT DONE | Workflow and roles remain browser-local, consistent with the existing app; real multi-user security and delivery require a backend |

### Results workflow test coverage
- Domain tests cover subject/class permissions, submission locks, publication blockers, request changes, guarded mark removal, sanitized student visibility, correction/version audit, legacy migration and print-layout content.
- Role integration tests cover the expanded table columns, embedded Report builder, an assigned subject teacher's available subjects, the empty state for an unassigned teacher, published-only student results, and the Results workflow sidebar icon.

### Final verification
- `npm test`: PASS — 9 test files, 80 tests.
- `npm run build`: PASS — Vite production build completed. Vite reports a large JavaScript chunk warning (about 903 kB minified).
- Still incomplete: real backend authorization and cross-device notifications/data; requiring complete DOB and joined-date details; embedded Tamil font in PDFs and in-browser/device print-preview verification.
