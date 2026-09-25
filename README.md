# Simple Canvas Tasks

A **lightweight** Chrome extension that replaces the Canvas dashboard **To Do**
sidebar with a tabbed widget and live due-date countdowns — making your
assignments far easier to see at a glance.

It's intentionally small and private: no accounts, no ads, no trackers, no
servers, and it stays completely dormant on non-Canvas pages. Where other task
tools have grown bloated and invasive, this is a simple drop-in that does one
thing well and gets out of your way.

**Install from the
[Chrome Web Store](https://chromewebstore.google.com/detail/dejmhgkaogjhiannogiggcffkhodeoek).**

## What it does

On the Canvas **dashboard** and on a **course home** page (e.g.
`/courses/123456`), the right-hand **To Do** area is replaced with a custom
panel split into three tabs. Deeper pages — assignments, quizzes, grades,
modules, and similar — are left alone so Canvas can show grades and feedback
there.

- **Tasks** *(shown by default)* — assignments, quizzes, discussions, and peer
  reviews you still need to submit. Each one shows a live countdown of the time
  until it's due and a small checkbox to mark it done.
- **Posts** — recent course announcements.
- **Calendar** — upcoming calendar events.

Below the tabs, the native **Recent Feedback** section is preserved (cloned back
in from Canvas' own sidebar).

### Time-period selector

Next to the header is a small gray dropdown (defaulting to **Week**) for choosing
how far ahead the Tasks list looks: **Day**, **Week**, **2 Weeks**, or **Month**.
Your choice is remembered locally.

### Add task

An **Add task** button at the bottom of the Tasks list lets you create your own
tasks (title, course, and due date). They live alongside your Canvas assignments,
show the same countdowns and course color, and are stored locally.

### Settings

A gear icon opens a **Settings** panel with:

- **Default tab** — which tab (Tasks / Posts / Calendar) opens when the widget
  loads.
- **Show overdue tasks** — toggle whether past-due assignments stay in the list.
- **Restore all "Mark as Done" items** — bring back everything you've hidden.

All settings are saved locally via `chrome.storage.local`.

### Countdowns

Each task shows only the largest meaningful unit, to keep things short:

- `17 days until due`
- `9 hours until due` (once under a day)
- `45 minutes until due` (once under an hour)
- `Overdue` once past the due date

The countdown text turns **red when something is due within 24 hours** (and for
overdue items).

### Course colors

Each item's left color strip matches the color you picked for that class on the
dashboard (pulled from `/api/v1/users/self/colors`). Items without a custom color
fall back to a default blue strip.

### Mark as done

Every task has a small gray checkbox in its top-right corner. Clicking it hides
the task and remembers it (via `chrome.storage.local`), so it stays hidden across
reloads. This is a local-only action — it does **not** submit or check the item
off in Canvas itself.

Tasks are also hidden automatically when Canvas reports them as submitted,
excused, or marked complete.

## How it works

It uses the same data Canvas itself uses — the authenticated
[`/api/v1/planner/items`](https://canvas.instructure.com/doc/api/planner.html)
endpoint (plus `/api/v1/users/self/colors`) — fetched with your existing session
cookie (`same-origin`), so there's no login, API token, or external server
involved. Everything runs locally in your browser.

## Install (unpacked)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select this folder (`canvas-tasks`).
5. Open your Canvas dashboard (e.g. https://canvas.pitt.edu/) and reload.

The extension works on any Canvas site. It matches `https://*/*` in
`manifest.json` but stays completely dormant on non-Canvas pages — on each page
it checks for Canvas-specific markers and only activates on the dashboard and
course home. To limit it to specific domains instead, narrow `host_permissions`
and `content_scripts[].matches` in `manifest.json`.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | MV3 extension manifest (`storage` permission + Canvas host access) |
| `content.js` | Fetches planner data + colors, categorizes it, renders the tabbed widget, countdowns, mark-as-done, and Recent Feedback |
| `styles.css` | Widget styling; hides the native To Do content |
| `icons/` | Toolbar icons |

## Notes & tweaks

- **Where it runs:** dashboard (`/`) and course home (`/courses/<id>` only).
  Assignment, quiz, grades, and other drilled-down URLs are ignored.
- **Date window:** it loads items from 21 days ago through 120 days ahead. Adjust
  in `plannerUrl()` in `content.js`. Colors, courses, and planner items are
  fetched in parallel.
- **Time period:** choose Day / Week / 2 Weeks / Month from the header dropdown
  (the underlying `PERIODS` list lives in `content.js`).
- **Default tab & overdue visibility:** set these in the **Settings** panel (gear
  icon). They persist via `chrome.storage.local`.
- **"Due soon" (red) threshold:** the `< 24h` cutoff lives in `formatCountdown()`
  in `content.js`, with the color in `.ctp-countdown--soon` in `styles.css`.
- **Reset "marked done" items:** use **Restore all "Mark as Done" items** in the
  Settings panel (or remove the `sctDone` key from `chrome.storage.local`).
- If Canvas changes its planner API or sidebar markup, tweaking the selectors /
  endpoint in `content.js` is where you'd start.
