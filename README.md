# MiloNote — دفترك ورفيق دراستك 🌱

**MiloNote** is a character-driven study companion with accounts, a personal study plan per user, handwritten notebooks, and an admin dashboard. Milo, a small sprout-headed creature, lives inside the app. Milo reads with you while the timer runs, sips tea on breaks, cheers when a unit is done, and wears a graduation cap during exam week.

The interface is in Palestinian Arabic (RTL) and mobile-first. Data is local-first (IndexedDB, works offline) and syncs to the user's account in Supabase.

## Accounts & roles

- **Sign up / sign in** with email + password (Supabase Auth), with **no email verification**: accounts work immediately. Sign-up goes through the `milonote-signup` edge function, which creates an already-confirmed account without changing the shared project's email settings.
- **Admin:** `refaat@gmail.com`. This account starts with the original nine-day plan (20–28 Nov 2026). Every other account starts empty and builds its own plan with the **«خطتي»** wizard (units → days → daily goal).
- **Admin dashboard** (`/admin`, admins only, enforced by the database): lists every user with name, email, join date, last sign-in/activity, study hours, sessions, topic progress and notebooks, and can send a password-reset email. Passwords are never shown: Supabase stores only one-way hashes, so nobody can read them.
- **Playful ⇄ Serious switch:** one tap turns the whole app from the illustrated Milo world into a calm, professional look (no mascot, flat cards, a timeline instead of the map, a table instead of the garden), and back. The choice is saved on the account.

## MiloNote notebooks (`/notes`)

**PDF:** «استورد PDF» (or drag a PDF onto the shelf) turns any PDF into a notebook. Every PDF page becomes a page you can write on with all the pens, the highlighter, text boxes and stickers. Inside a notebook, *Page settings → أضف PDF أو صورة* inserts more PDF pages or a photo (worksheet, board) after the current page. *صدّر الدفتر PDF* exports the notebook back to a PDF: pages from an imported PDF keep the original sharp vector page, with your handwriting layered on top. The original files are stored privately in Supabase Storage (`milonote-files`, up to 100 MB each), so they open on every device. They are not covered by the notebook lock.

**Translation:** the «ترجمة» tool translates typed text or a selected text box (auto-detected language → Arabic, English, French, …) and can drop the result onto the page. It uses the free MyMemory service (no key, about 5000 characters a day); the text is sent to that service.


Unlimited notebooks and pages · 6 pens (ballpoint, fountain with nib angle, pencil with grain, marker, pressure brush, highlighter) with Apple Pencil pressure · any colour · writing stabilizer · ruler with 15° snapping · stroke eraser · text boxes · stickers (Milo, plants, labels) · 5 paper types and paper colours · 10 original covers · voice notes per page (uploaded to Storage) · password lock with real AES-256-GCM encryption (the password never leaves the device) · paper-scratch writing sound (ASMR) · reading mode · PNG export · undo/redo · stylus-only mode (palm rejection).

## Supabase

Everything lives in its own `milonote` schema (tables `profiles`, `records`; storage buckets `milonote-audio` and `milonote-files`) with row-level security, so it is isolated from other apps in the same project. The SQL is in `supabase/migrations/`, and the edge function is in `supabase/functions/milonote-signup/`. The browser uses only the public anon key; you can override it with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

After deploying to Netlify, add your site URL (e.g. `https://your-site.netlify.app/**`) under Supabase → Authentication → URL Configuration → Redirect URLs. Password-reset emails need this to link back to MiloNote.

## Features

| Area | What it does |
| --- | --- |
| **Study timer** (`/focus`) | Start / pause / resume / finish, reset with confirmation, unit + topic selection, optional 50/10 Pomodoro. Time is computed from persisted timestamps, so it stays accurate after a refresh, switching tabs, locking the phone or closing the browser. Paused time and Pomodoro breaks are never counted. Each session has a fixed id and is saved in one transaction, so it can never be saved twice. |
| **Daily goal** | 9-hour target by default (editable). A star jar fills with one paper star per ~20 minutes, with exact numbers shown next to it. |
| **Study garden** (`/garden`) | Six plants (tulip, sunflower, fern, lavender, cactus, blossom tree), one per unit. Each grows seed → sprout → leaves → flowering → full plant at 0/25/50/75/100% topic completion. Includes a text view of every unit with editable topics. |
| **Adventure map** (`/map`) | The nine days as illustrated destinations. Tap a day to see its tasks, logged sessions and unit progress, or to edit its date, title, units, destination and notes. |
| **Daily planner** (`/planner`) | A notebook-style planner, preloaded with the default schedule for every day. Add, edit, drag to reorder, delete, complete and assign tasks to units. |
| **Exam prep** (`/exams`) | A separate mock-exam timer (it automatically pauses the study timer, so no minute is counted twice), scores and history, weak topics, a mistake log, a revision checklist and an exam countdown. |
| **Statistics** (`/stats`) | Daily hours against the goal, time per unit, unit progress, challenge completion, streaks and exam scores. Every number comes from stored sessions and tasks. |
| **Backup** (`/settings`) | JSON export and import, plus a full reset. |

All days are calculated in **Asia/Hebron** time. A session that crosses midnight is split correctly between the two days, and daylight-saving changes are handled.

> **Sync:** every change is saved on the device first and pushed to the account in the background. Signing in on another device brings everything back. JSON export/import is still available as an extra backup.

## Tech

React 19 · Vite · TypeScript · Tailwind CSS v4 (configured in `src/styles/index.css` via `@theme`, so there is no `tailwind.config.ts`) · Motion for React · Lucide React · Recharts · Dexie (IndexedDB) · React Router.

All artwork (Milo, plants, destinations, the star jar) is original inline SVG with CSS/Motion animation. Animations respect `prefers-reduced-motion`.

```
src/
  components/
    character/   Milo SVG + animations
    timer/       study timer, dial, star jar, app-wide watcher
    garden/      plants + garden scene
    map/         adventure map, destinations, day sheet
    planner/     notebook planner
    exams/       mock-exam timer + score entry
    ui/          layout/nav, sheets, buttons, celebrations…
  pages/         Today, Focus, Map, Garden, Planner, Exams, Stats, Settings
  hooks/         live Dexie queries, clock, study stats
  lib/           db schema, timer engine, time zone math, stats, backup
  data/          seed: units, 9-day schedule, default daily plan
  styles/        Tailwind theme + paper styles
  assets/        paper texture
```

## Run locally

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run preview
```

## Deploy: GitHub → Netlify (automatic)

The repository is already configured. `netlify.toml` sets the build command (`npm run build`), the publish directory (`dist`), Node 22, and the SPA redirect that keeps client-side routes working after a refresh. No environment variables or secrets are needed: the public Supabase URL and anon key are built in.

1. Push this repository to GitHub.
2. In Netlify, choose **Add new site → Import an existing project → GitHub** and pick the repository.
3. Netlify reads `netlify.toml`, so leave the build settings as detected and click **Deploy**.
4. Under **Site configuration → Build & deploy → Branches**, set the production branch you push to (for example `main`).

From then on, every push to the production branch triggers an automatic build and deploy. Pushes to other branches can get deploy previews if you enable them in Netlify.
