# Simple Canvas Tasks

A Chrome extension that replaces the Canvas dashboard **To Do** sidebar with a
tabbed widget and live due-date countdowns.

## What it does

On the Canvas home screen (dashboard), the right-hand **To Do** area is replaced
with a custom panel split into three tabs:

- **Assignments** *(shown by default)* — assignments, quizzes, discussions, and
  peer reviews you still need to submit. Each one shows a live
  **"x days, x hours and x minutes until due"** countdown that ticks every
  second and turns orange/red as the deadline approaches (and shows
  **"Overdue by …"** when it's past due).
- **Announcements** — recent course announcements.
- **Calendar** — upcoming calendar events.

A count badge on each tab shows how many items are in it.

## How it works

It uses the same data Canvas itself uses — the authenticated
[`/api/v1/planner/items`](https://canvas.instructure.com/doc/api/planner.html)
endpoint — fetched with your existing session cookie (`same-origin`), so there's
no login, API token, or external server involved. Everything runs locally in
your browser.

## Install (unpacked)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select this folder (`canvas-tasks`).
5. Open your Canvas dashboard (e.g. https://canvas.pitt.edu/) and reload.

The extension is scoped to `canvas.pitt.edu` and `*.instructure.com`. To use it
on a different Canvas host, add that domain to `host_permissions` and
`content_scripts[].matches` in `manifest.json`.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | MV3 extension manifest |
| `content.js` | Fetches planner data, categorizes it, renders the tabbed widget + countdowns |
| `styles.css` | Widget styling; hides the native To Do content |
| `icons/` | Toolbar icons |

## Notes & tweaks

- **Date window:** it loads items from 21 days ago through 120 days ahead. Adjust
  in `loadData()` in `content.js`.
- **Default tab:** change `state.activeTab` in `content.js`.
- **Submitted items** are hidden from the Assignments tab automatically.
- If Canvas changes its planner API or sidebar markup, tweaking the selectors /
  endpoint in `content.js` is where you'd start.
