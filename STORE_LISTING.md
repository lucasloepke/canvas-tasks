# Chrome Web Store Listing — Simple Canvas Tasks

Copy/paste-ready text for the Chrome Web Store Developer Dashboard, plus the
asset checklist and permission justifications reviewers ask for.

---

## Product name

Simple Canvas Tasks

## Summary (132 characters max)

A cleaner Canvas dashboard To Do: Tasks, Posts, and Calendar tabs with live
due-date countdowns and per-class colors.

## Category

Productivity

## Language

English (United States)

---

## Detailed description

Simple Canvas Tasks replaces the cluttered "To Do" sidebar on your Canvas
dashboard with a focused, organized panel — so you can see what's actually due
at a glance.

WHAT YOU GET

• Three clean tabs — Tasks (assignments, quizzes, discussions, peer reviews),
  Posts (announcements), and Calendar (upcoming events). Tasks show by default.

• Live countdowns — every task shows exactly how long until it's due, in plain
  language: "17 days until due," "9 hours until due," "45 minutes until due."
  The text turns red once something is due within 24 hours.

• Your class colors — each item is tagged with the same color you chose for that
  course on your Canvas dashboard, so you can tell classes apart instantly.

• Mark as done — a quick checkbox hides tasks you've finished, and remembers them
  across reloads.

• Recent Feedback stays — the native Recent Feedback section is preserved right
  below your tasks.

PRIVATE BY DESIGN

Everything runs locally in your browser. Simple Canvas Tasks uses the same data
Canvas already loads for you (your planner items and course colors) and never
sends anything to any server, developer, or third party. No account, no
tracking, no analytics.

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

**Host permission (Canvas domains)**
> The extension runs only on the user's Canvas site so it can read the user's
> planner items and dashboard course colors (via Canvas' own APIs, using the
> user's existing session) and render the replacement sidebar on the dashboard
> page. This access is required for the extension's core and only function.

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
3. **Decide host scope.** Currently the extension targets `canvas.pitt.edu` and
   `*.instructure.com`. If you want it usable at other schools that use custom
   Canvas domains, broaden the matches (this increases review scrutiny; the host
   justification above covers it). If it's just for you, leave as-is.
4. **Zip the extension folder** (the files, not the parent folder) and upload:
   `manifest.json`, `content.js`, `styles.css`, and `icons/`. You do not need to
   include the `.md` files in the uploaded zip.
5. **Bump the version** in `manifest.json` for each new upload.

### Quick zip command

```bash
cd canvas-tasks
zip -r simple-canvas-tasks.zip manifest.json content.js styles.css icons
```
