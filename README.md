# milo. — رفيق الدراسة 🌱

**milo.** is a character-driven study companion for a nine-day study challenge (20–28 November 2026). Milo, a small sprout-headed creature, lives inside the app. Milo reads with you while the timer runs, sips tea on breaks, cheers when a unit is done, and wears a graduation cap during exam week.

The interface is in Palestinian Arabic (RTL), mobile-first, and works fully offline after the first load. It needs no login, no server and no database server.

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

> **Storage note:** data lives in this browser's IndexedDB on this device only. Nothing syncs between devices automatically. Use *Settings → Download backup* to move or protect your data.

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

The repository is already configured. `netlify.toml` sets the build command (`npm run build`), the publish directory (`dist`), Node 22, and the SPA redirect that keeps client-side routes working after a refresh. No environment variables or secrets are needed.

1. Push this repository to GitHub.
2. In Netlify, choose **Add new site → Import an existing project → GitHub** and pick the repository.
3. Netlify reads `netlify.toml`, so leave the build settings as detected and click **Deploy**.
4. Under **Site configuration → Build & deploy → Branches**, set the production branch you push to (for example `main`).

From then on, every push to the production branch triggers an automatic build and deploy. Pushes to other branches can get deploy previews if you enable them in Netlify.
