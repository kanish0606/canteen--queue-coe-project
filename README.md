# 🍴 Smart Canteen Queue

> Know the wait before you walk over.

A web-based queue management prototype built under **Project Better Tomorrow**. Students waste break time standing in canteen queues because they can't see how crowded it is or how long they'll wait. Smart Canteen Queue shows the live crowd, estimates the wait, issues a digital token, and alerts students when their turn is close.

**Current stage: 70% prototype** · HTML · CSS · JavaScript · GitHub

---

## Features

### Student side
- **Live board**: now serving token, people waiting, estimated wait, and crowd status (Low / Medium / High)
- **Digital token**: join with an optional name and get a ticket like `A-007`
- **Position tracking**: your position and personal wait estimate update as the queue moves
- **Leave queue**: give up your spot at any time
- **Alerts**: in-page toast, sound, and browser notification when you are nearly up and when your token is called
- **Queue list**: see everyone waiting, with your own entry highlighted

### Staff side (PIN protected)
- **Serve next**: call the first student in line (FIFO)
- **Pause / resume joining**: stop new entries during rushes or closing time
- **Open counters (1-4)**: wait times and crowd level adjust to the number of open counters
- **Live statistics**: students served, average service time, average wait, peak queue length
- **Recently served** tokens and **Reset queue**

### What's new since the 35% prototype

| Area | 35% | 70% |
|---|---|---|
| Data | In-memory array, lost on refresh | Saved in `localStorage`, survives refresh |
| Sync | None | Tabs and windows on the same browser stay in sync |
| Wait time | Fixed 3 min per person | Moving average of the last 5 real service gaps, divided across open counters |
| Alerts | None | Toast, beep, and browser notification |
| Staff panel | Open to everyone | PIN-protected, with pause, counters, and statistics |
| Student flow | Join only | Name, leave queue, personal ticket |
| UI | Basic cards | Redesigned live board, ticket view, responsive layout |

---

## How it works

**Queue (FIFO).** Students are appended to `state.queue` and served from the front with `shift()`.

**Shared state.** One object holds everything, saved to `localStorage` on every change:

```js
{ epoch, queue: [{token, name, joinedAt}], next, served: [...],
  counters, paused, peak, lastServeAt, gaps: [...] }
```

The browser `storage` event pushes changes to every other open tab, so a staff tab and a student tab update each other instantly.

**Adaptive wait time.**

```
avgServiceMin = mean(last 5 gaps between serves), clamped to 1-15 min (default 3)
estimatedWait = round(peopleAhead × avgServiceMin ÷ openCounters)
```

**Crowd status.** `queue length ÷ open counters`: up to 3 is Low, up to 7 is Medium, above 7 is High.

---

## Run locally

No build step or dependencies.

```bash
git clone https://github.com/<your-username>/smart-canteen-queue.git
cd smart-canteen-queue
# open index.html in your browser, or serve it:
python3 -m http.server 8000   # then visit http://localhost:8000
```

**Try the full flow:**
1. Open the page in two tabs. Use tab 1 as a student and tab 2 as staff.
2. In tab 2, scroll to **Canteen staff** and unlock with PIN `1234`.
3. In tab 1, enter a name and click **Get my token**.
4. In tab 2, click **Serve next** and watch tab 1 update and alert.

---

## Test scenarios

| # | Scenario | Expected result |
|---|---|---|
| 1 | Empty queue | 0 waiting, 0 min, crowd Low, "Nobody is waiting" |
| 2 | Student joins | Token issued, position 1, counters update |
| 3 | Several students join | Sequential tokens, correct positions |
| 4 | Serve next | First token removed, positions shift, "Now serving" updates |
| 5 | Refresh the page | Queue and your ticket are still there |
| 6 | Two tabs open | Change in one appears in the other |
| 7 | Near the front | Alert shown when position is 2 or better |
| 8 | Token called | "Please go to the counter" alert |
| 9 | Pause joining | Join button disabled, notice shown |
| 10 | Change counters | Wait time and crowd level recalculate |
| 11 | Wrong staff PIN | Rejected, panel stays locked |
| 12 | Reset queue | Everything cleared after confirmation |
| 13 | Phone-width screen | Layout stacks, nothing overflows |

---

## Project structure

```
smart-canteen-queue/
├── index.html   # structure: live board, ticket, queue list, staff panel
├── style.css    # design system and responsive layout
├── script.js    # queue logic, persistence, sync, alerts, statistics
└── README.md
```

---

## Known limitations (honest scope)

- **Sync is per browser, not per device.** `localStorage` is shared between tabs on the same browser only. A student's phone and the canteen's computer will not yet see the same queue. This is the main reason for the backend in the next stage.
- **The staff PIN is a demo.** It lives in the front-end code and is not real security.
- **No QR codes and no AI prediction yet.**

## Roadmap

| Stage | Scope |
|---|---|
| 35% ✅ | FIFO queue, tokens, position, fixed wait estimate, staff panel |
| **70% ✅ (current)** | Persistence, tab sync, adaptive wait time, counters, alerts, staff PIN, statistics |
| 100% | Node.js + database backend for true multi-device sync, real authentication, QR-code tokens, AI-based wait and crowd prediction (queue size, service time, counters, time of day, history) |

---

## Author

**Kanish**, Electronics and Communication Engineering, Rathinam Technical Campus
Project Better Tomorrow
