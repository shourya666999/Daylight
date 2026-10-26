# Daylight

> **Make space for the life you’re building.**
>
> Daylight brings your plans, routines, focus time, and money into one calm workspace that runs on your own computer.

<p align="center"><em>One thoughtful view of the day ahead—without another account to manage.</em></p>

## A clearer way to keep life moving

Most people do not need another complicated system. They need one reliable place to catch the next task, notice their habits, remember their goals, and understand where their time and money are going.

**Daylight is a personal life tracker designed to make that easier.** It combines everyday planning and useful reflection in a polished, animated glass interface, while keeping the database on your laptop.

### What you can do

- **Plan the day:** Capture thoughts in one step, organize tasks and projects, set deadlines, and see what is due in Today and Calendar.
- **Build consistency:** Keep a daily log, track habits and streaks, and record workouts.
- **Make progress visible:** Set monthly or yearly goals and follow task, habit, workout, focus, and money trends in daily, monthly, yearly, or custom Insights.
- **Protect your focus:** Run configurable Pomodoro focus and break sessions, link a session to a task, and review completed focus time later.
- **Know your cash flow:** Record income, expenses, and subscriptions. Indian rupees (INR) are the default; choose a different currency in Settings or on an individual transaction.
- **Keep useful context:** Write searchable notes, connect related notes, and create project records for portfolio work or hackathons.
- **Make the workspace yours:** Set the accent color, theme, motion, glass blur, currency, week start, categories, statuses, fields, sidebar sections, dashboard cards, and form layouts. Create custom record types and saved views.

### Made to feel good to use

Daylight pairs a quiet, premium glass look with animated surfaces and a focused layout. The interface is designed to make useful information easy to scan without turning personal planning into a wall of charts.

## Your data stays on your computer

Daylight runs a small server bound to your own computer and stores information in a local SQLite database. It does not require an account, contact a hosted service, or send your records to a cloud provider. Clicking **Local storage** in the sidebar opens the folder containing the database.

- **Windows database:** `%LOCALAPPDATA%\DaylightTracker\tracker.sqlite`
- **macOS/Linux database:** `~/.daylight-tracker/DaylightTracker/tracker.sqlite`
- **Automatic snapshots:** A local snapshot is created on first run and then at most once every 24 hours while Daylight is running. The 30 newest snapshots are kept.
- **Manual backup and restore:** Settings lets you create a snapshot or restore one after creating a safety snapshot.

The database is a regular local file and is **not encrypted by Daylight**. Your operating-system account protects access to it. Keep your laptop backups current if you want protection against device failure.

## Get started

### Windows

1. Install **Node.js 22.5 or later**. Daylight uses Node’s built-in SQLite support and does not need `npm install`.
2. Double-click **Start Daylight.bat** in the project folder.
3. Daylight opens in a separate browser-style window. If it does not, use the `http://127.0.0.1:...` address printed by the launcher.
4. To stop the local server, restore its minimized console and press **Ctrl+C**.

### macOS or Linux

1. Install **Node.js 22.5 or later**.
2. Open a terminal in the project folder and run:

   ```sh
   npm start
   ```

3. Open the local address printed in the terminal (normally `http://127.0.0.1:4173`).
4. Press **Ctrl+C** in the terminal to stop the server.

Node’s built-in SQLite module was added in Node 22.5. See the [official Node.js SQLite documentation](https://nodejs.org/api/sqlite.html).

## A quick tour

1. Start in **Today** to see tasks, habits, goals, recent activity, and money for the day.
2. Use **Quick capture** (default **Ctrl+Shift+Space** while the Daylight tab is active) to save a thought to Inbox before organizing it.
3. Turn inbox items into dated tasks, group work under projects, and use Calendar to see deadlines and upcoming charges.
4. Add notes, habits, logs, workouts, goals, and money records as you go.
5. Open **Pomodoro** when you want a timed focus block. Completed focus sessions are saved locally and appear in Insights.
6. Choose **Today**, **This month**, or **This year** in Insights to spot patterns. Select a custom date range for a closer look.
7. Visit **Settings** to tailor the app to your preferences.

## Personalization that goes beyond colors

Daylight is built to adapt as your routines change. You can rename the workspace, choose a currency and week format, set the theme and animation level, and decide which sections and dashboard cards you want to see. Add custom categories, statuses, fields, and record types. Reorder or hide form fields, move Today cards, and save frequently used task, project, or note views.

## What Daylight is—and is not

Daylight is a local-first web app with a desktop-style launcher, not a packaged native application. It is designed for one person using one computer. There is no account, online sync, multi-device sharing, operating-system-wide keyboard shortcut, **clear-all/reset-data option**, or **user-facing data export option**. Individual records can be edited or deleted. Local backups and restoring a snapshot are available in Settings.

## Project files

- `server.mjs` — local HTTP server, SQLite records, and snapshots
- `public/` — application interface, styling, and interactions
- `Start Daylight.bat` / `Start Daylight.ps1` — Windows launcher
- `SECURITY.md` — security and responsible reporting notes

## Security

Daylight does not need credentials. Runtime data, database files, backups, logs, and exports are excluded from Git by `.gitignore`. Before publishing changes, review `git status` and follow [SECURITY.md](SECURITY.md).

---

**A little more clarity. A little less friction. More room for what matters.**
