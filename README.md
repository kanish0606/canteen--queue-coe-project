# 🍴 Smart Canteen Queue

> Know the wait before you walk over.

A full-stack queue management system built under **Project Better Tomorrow**. Students waste break time in canteen queues because they can't see the crowd or the wait. Smart Canteen Queue shows the live queue on any device, issues a digital token with a QR code, predicts waiting time and crowd level, and alerts students when their turn is close.

**Status: 100% (v1.0)** · Node.js · HTML · CSS · JavaScript

---

## Features

**Students**
- Live board: now serving, people waiting, estimated wait, crowd level
- Digital token (e.g. `A-007`) with a **QR code** on the ticket
- Live position and personal wait estimate
- **Alerts** (toast, sound, browser notification) when nearly up and when called
- Leave the queue any time; scan the board QR to open the site on a phone
- **15-minute forecast** of queue size and crowd level

**Staff (password protected)**
- Serve next, pause or resume joining, reset the queue
- Set 1-4 open counters
- Statistics: served, average service time, average wait, peak queue

**System**
- **Real multi-device sync**: every phone and computer sees the same queue instantly
- **Persistent database**: the queue survives server restarts
- **Authentication**: staff sessions with rate-limited login
- **Prediction model** for wait time and crowd (see below)

---

## Architecture

```
 Student phones / Staff computer
        │  HTTP (actions)      ▲ Server-Sent Events (live updates)
        ▼                      │
 ┌─────────────────────────────────────┐
 │ server.js (Node.js, no dependencies)│
 │  REST API · auth · prediction model │
 └───────────────┬─────────────────────┘
                 ▼
            data.json (database)
```

| Layer | Files | Role |
|---|---|---|
| Presentation | `public/index.html`, `public/style.css` | Layout, design, responsive UI |
| Client logic | `public/script.js` | Renders server state, sends actions, alerts, QR |
| Server | `server.js` | Queue logic (FIFO), API, auth, live push, prediction |
| Storage | `data.json` (auto-created) | Queue, history, settings |

### API

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/state` | Public | Current queue, wait, forecast |
| GET | `/api/events` | Public | Live updates (SSE) |
| POST | `/api/join` | Public | Join, returns token and private key |
| POST | `/api/leave` | Ticket owner | Leave using token + key |
| POST | `/api/login` | Public | Staff login, returns session token |
| GET | `/api/stats` | Staff | Statistics |
| POST | `/api/serve` | Staff | Serve next (FIFO) |
| POST | `/api/pause` | Staff | Pause or resume joining |
| POST | `/api/counters` | Staff | Change open counters |
| POST | `/api/reset` | Staff | Reset the queue |

---

## Prediction model

A lightweight statistical model, trained on the canteen's own service history. It is not deep learning, and it is written to be easy to replace with a heavier model later.

```
interval = 0.6 × EWMA(last 10 service gaps)        recent trend
         + 0.4 × mean(gaps at this hour of day)    time-of-day pattern
         (default 3 min ÷ open counters until data exists)

wait(position)      = position × interval
queue in 15 min     = queue now + arrivals/min × 15 − 15 ÷ interval
crowd               = queue ÷ open counters:  ≤3 Low · ≤7 Medium · >7 High
```

Inputs used: current queue size, recent service speed, number of open counters, time of day, historical patterns, and recent arrival rate. Resetting the queue clears today's data but **keeps the history**, so predictions improve over time.

---

## Two ways to run

| Mode | How | What you get |
|---|---|---|
| **Demo mode** | Open `public/index.html` in a browser, or host `public/` on GitHub Pages | Works with no server. The queue is stored in that browser only (tabs stay in sync). Staff password: `canteen123`. A notice on the board says "Offline demo mode". |
| **Server mode** | `node server.js` (below) | Shared queue across all devices, database, real staff password |

The page detects the server automatically and falls back to demo mode if it can't reach one. This is what fixes the "failed to fetch" error when `index.html` is opened directly.

Staff also get an **Add 5 demo students** button for quick demonstrations.

## Run it (server mode)

Requires **Node.js 16+**. No `npm install` needed.

```bash
git clone https://github.com/<your-username>/smart-canteen-queue.git
cd smart-canteen-queue
STAFF_PASSWORD="choose-a-password" node server.js
# Windows PowerShell:  $env:STAFF_PASSWORD="choose-a-password"; node server.js
```

Open `http://localhost:3000`. The default staff password is `canteen123` if you don't set one.

**Use it from phones:** put your computer and phones on the same Wi-Fi, find the computer's local IP (for example `192.168.1.20`), and open `http://192.168.1.20:3000` on the phone. The QR on the board will then open the right address for other students.

**Try the full flow**
1. Open the site on a computer and on a phone.
2. On the computer, scroll to **Canteen staff** and log in.
3. On the phone, enter a name and tap **Get my token**.
4. On the computer, tap **Serve next** and watch the phone update and alert.

---

## Test scenarios

| # | Scenario | Expected result |
|---|---|---|
| 1 | Empty queue | 0 waiting, crowd Low, "Nobody is waiting" |
| 2 | Student joins | Token and QR issued, position 1 |
| 3 | Join from a second device | Both devices show the same queue |
| 4 | Serve next | FIFO order, positions shift, now-serving updates everywhere |
| 5 | Restart the server | Queue is restored from `data.json` |
| 6 | Near the front | Alert at position 2 or better |
| 7 | Token called | "Go to the counter" alert |
| 8 | Wrong staff password | Rejected; 5 failures lock login for a minute |
| 9 | Staff API without login | Returns 401 |
| 10 | Pause joining | Join disabled on all devices |
| 11 | Change counters | Wait, crowd and forecast recalculate |
| 12 | Leave queue | Entry removed; others move up |
| 13 | Reset queue | Cleared; history kept |
| 14 | Phone-width screen | Layout stacks, nothing overflows |

---

## Project structure

```
smart-canteen-queue/
├── server.js          # backend: API, auth, live sync, prediction
├── package.json
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── data.json          # created automatically (git-ignored)
└── README.md
```

## Development history

| Stage | Scope |
|---|---|
| 35% | FIFO queue, tokens, position, fixed 3-minute estimate, staff panel |
| 70% | Persistence, tab sync, adaptive wait, counters, alerts, staff PIN, statistics |
| **100%** | Node.js backend, database, multi-device live sync, real staff auth, QR codes, prediction and forecast |

## Limitations and future work

- The database is a JSON file, which suits one canteen. A larger deployment would move to SQLite or PostgreSQL.
- Staff sessions are kept in server memory, so they end when the server restarts. Use HTTPS when hosting publicly.
- The QR code on a ticket is displayed but not yet scanned by a staff camera. A scanner is a natural next step.
- The prediction model uses averages and trends. With more data it could be replaced by a regression or machine-learning model.

## Author

**Kanish**, Electronics and Communication Engineering, Rathinam Technical Campus
Project Better Tomorrow
