# Privacy Policy — Simple Canvas Tasks

**Last updated: September 25, 2026**

Simple Canvas Tasks ("the extension") is a browser extension that reorganizes the
Canvas "To Do" sidebar on the dashboard and course home pages. This policy
explains what it does and does not do with your information.

## Summary

- The extension does **not** collect, transmit, sell, or share any personal data.
- Everything runs **locally in your browser**.
- There is **no external server, analytics, tracking, or account**.

## What the extension accesses

To build the sidebar, the extension reads data from the Canvas site you are
already logged into, using your existing browser session:

- Your Canvas **planner items** (assignments, quizzes, discussions, peer reviews,
  announcements, and calendar events) via Canvas' own API
  (`/api/v1/planner/items`).
- Your **dashboard course colors** via Canvas' own API
  (`/api/v1/users/self/colors`).

This data is requested directly from your Canvas institution's servers by your
browser, exactly as the Canvas website itself does. The extension only reads it
to render the sidebar on the page. It is never sent anywhere else.

## What the extension stores

- The extension uses Chrome's local storage (`chrome.storage.local`) to remember:
  - which tasks you have marked "done," so they stay hidden across page reloads
  - custom tasks you create in the sidebar
  - UI preferences (time window, default tab, overdue visibility)
- This is stored **only on your device**. Done-markers are task identifiers (e.g.
  `assignment:12345`); nothing is transmitted.

You can clear this at any time by removing the extension's storage (or keys such
as `sctDone`, `sctCustom`, `sctPeriod`, `sctDefaultTab`, and `sctShowOverdue`)
in `chrome.storage.local`.

## What the extension does NOT do

- It does not collect or store your name, email, grades, or submissions.
- It does not send any data to the developer or any third party.
- It does not use cookies, analytics, advertising, or fingerprinting.
- It does not modify, submit, or delete anything in your Canvas account. (The
  "mark as done" button only hides items locally within the extension.)

## Permissions

- **`storage`** — to remember locally which tasks you marked done, custom tasks,
  and UI preferences.
- **Host access to Canvas domains** — so the extension can run on, and read
  planner data from, your Canvas dashboard and course home pages.

## Changes

If this policy changes, the "Last updated" date above will be revised.

## Contact

Questions about this policy can be directed to the developer via the extension's
Chrome Web Store support page.
