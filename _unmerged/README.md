# Files that are not part of this build

While adding the admin, teacher and student dashboards, these files were found in the project folder. They were not written by this build and use a different account model (`linkId`, `s.users`, `ROLE_LABEL`), so they could not be mixed into the working app without breaking it:

- `Users.jsx` (user management page)
- `Results.jsx` (results page)
- `accounts.js` (account helpers)

They are kept here unchanged and are not imported anywhere. Their jobs are done in the app by `Accounts.jsx` (user accounts), `MyResults.jsx` (student results) and `auth.js`.

`LeaveRegister.jsx` and `ChangePassword.jsx` were also found in `src/`. `LeaveRegister.jsx` is used as it was (the compact leave register on the dashboards). `ChangePassword.jsx` was rewritten to use `auth.js` so that it works with the accounts that this app creates.

`Home.jsx` and `UpcomingDates.jsx` had been edited as well. Both were reconnected to the same announcement and account helpers as the other pages.
