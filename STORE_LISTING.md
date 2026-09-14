# Chrome Web Store Listing — Simple Canvas Tasks

Copy/paste-ready text for the Chrome Web Store Developer Dashboard, plus the
asset checklist and permission justifications reviewers ask for.

---

## Product name

Simple Canvas Tasks

## Summary (132 characters max)

A lightweight Canvas dashboard To Do: Tasks, Posts & Calendar tabs with live
due-date countdowns. Fast, private, no bloat.

## Category

Productivity

## Language

English (United States)

---

## Detailed description

Simple Canvas Tasks replaces the cluttered "To Do" sidebar on your Canvas
dashboard with a focused, organized panel — so you can see what's actually due
at a glance.

LIGHTWEIGHT ON PURPOSE

No accounts. No sign-ups. No ads. No trackers. No servers. No permissions beyond
what's needed to draw the sidebar. It's a small, fast add-on that does one thing
well — making your assignments easy to see — and then gets out of your way.
Other task tools have grown into heavy, invasive products; this is the opposite:
a simple, private drop-in that just works the moment you open your dashboard.

WHAT YOU GET

• Three clean tabs — Tasks (assignments, quizzes, discussions, peer reviews),
  Posts (announcements), and Calendar (upcoming events). Tasks show by default.

• Live countdowns — every task shows exactly how long until it's due, in plain
  language: "17 days until due," "9 hours until due," "45 minutes until due."
  The text turns red once something is due within 24 hours.

• Your class colors — each item is tagged with the same color you chose for that
  course on your Canvas dashboard, so you can tell classes apart instantly.

• Pick your time window — a quick dropdown shows what's due in the next Day, Week,
  2 Weeks, or Month.

• Add your own tasks — create personal to-dos with a title, course, and due date;
  they get the same countdowns and colors as your Canvas assignments.

• Mark as done — a quick checkbox hides tasks you've finished, and remembers them
  across reloads. A Settings panel lets you set your default tab, show or hide
  overdue tasks, and restore everything you've marked done.

• Recent Feedback stays — the native Recent Feedback section is preserved right
  below your tasks.

PRIVATE BY DESIGN

Everything runs locally in your browser. Simple Canvas Tasks uses the same data
Canvas already loads for you (your planner items and course colors) and never
sends anything to any server, developer, or third party. No account, no
tracking, no analytics — and it stays completely dormant on every non-Canvas
page you visit.

Open your Canvas dashboard and you're done — no setup required.

NOTE: This is an independent project and is not affiliated with, endorsed by, or
sponsored by Instructure or Canvas.

---

## Permission justifications

Paste these into the "Privacy practices" tab of the dashboard.

**Single purpose**
> The extension has one purpose: to replace the Canvas dashboard "To Do" sidebar
> with an organized, tabbed view of the user's upcoming tasks, announcements, and
> calendar events, including due-date countdowns.

**`storage` permission**
> Used to save, on the user's own device, which tasks they have marked as "done"
> so those tasks remain hidden after the page reloads. No personal data is stored
> and nothing is transmitted.

**Host permission (`https://*/*`)**
> Canvas is self-hosted by each school on its own domain (e.g.
> school.instructure.com, canvas.university.edu), so there is no single URL
> pattern that covers all Canvas installations. The extension therefore requests
> broad host access, but it is dormant everywhere by default: on every page it
> first checks for Canvas-specific markers and only activates on the Canvas
> dashboard. When active, it reads the user's planner items and dashboard course
> colors (via Canvas' own APIs, using the user's existing session) to render the
> replacement sidebar. It never sends data anywhere.

**Remote code**
> No. The extension contains no remote code; all JavaScript and CSS are bundled
> in the package.

**Data usage disclosures (check these boxes)**
> - Does NOT sell or share user data with third parties.
> - Does NOT use or transfer data for purposes unrelated to the item's single purpose.
> - Does NOT use or transfer data to determine creditworthiness or for lending.
> All "data collected" checkboxes can be left unchecked — no data leaves the device.

**Privacy policy URL**
> Host the contents of PRIVACY.md at a public URL (see "Before you submit" below)
> and paste that URL here.

---

## Asset checklist (upload in the dashboard)

- [ ] **Store icon** — 128×128 PNG (already have `icons/icon128.png`).
- [ ] **Screenshots** — at least 1, either 1280×800 or 640×400 PNG/JPEG.
      Recommended: 2–4 showing the Tasks tab with countdowns, the Posts tab, the
      Calendar tab, and the per-class colors.
- [ ] **Small promo tile** — 440×280 PNG/JPEG (required if you want to be
      featured; often required by the form).
- [ ] *(Optional)* Marquee promo tile — 1400×560.

---

## Before you submit

1. **Register** as a Chrome Web Store developer (one-time $5 fee).
2. **Host the privacy policy** at a public URL — e.g. GitHub Pages, or the raw
   file in a public repo — and put that URL in both the listing and manifest is
   not required, but the dashboard field is.
3. **Host scope.** The extension matches `https://*/*` so it works on any
   school's Canvas domain (including custom domains). It stays dormant on
   non-Canvas pages via runtime detection. Expect the store review to look
   closely at the broad host permission — the justification above is written to
   cover it. If you'd rather limit exposure, you can narrow the matches to the
   specific Canvas domains you care about.
4. **Zip the extension folder** (the files, not the parent folder) and upload:
   `manifest.json`, `content.js`, `styles.css`, and `icons/`. You do not need to
   include the `.md` files in the uploaded zip.
5. **Bump the version** in `manifest.json` for each new upload.

### Quick zip command

```bash
cd canvas-tasks
zip -r simple-canvas-tasks.zip manifest.json content.js styles.css icons
```
