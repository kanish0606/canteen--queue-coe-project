// Smart Canteen Queue - 70% prototype
// Adds: persistence, cross-tab sync, adaptive wait time, multiple counters,
// notifications, staff PIN, analytics. (Backend + AI come in the final stage.)

const KEY = "scq_state_v2";
const MY = "scq_my_ticket";
const STAFF_PIN = "1234"; // demo only - real authentication arrives with the backend
const $ = (id) => document.getElementById(id);
const fmt = (n) => "A-" + String(n).padStart(3, "0");

const fresh = () => ({
    epoch: Date.now(), queue: [], next: 1, served: [],
    counters: 1, paused: false, peak: 0, lastServeAt: null, gaps: []
});

function load() {
    try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY))); }
    catch (e) { return fresh(); }
}

let state = load();

function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
    render();
    checkAlerts();
}

// ---------- Helpers ----------

// This browser's ticket (valid only for the current queue session)
function mine() {
    try {
        const t = JSON.parse(localStorage.getItem(MY));
        return t && t.epoch === state.epoch ? t.token : null;
    } catch (e) { return null; }
}

// Average service time = moving average of the last 5 gaps between serves (1-15 min)
function avgMin() {
    if (!state.gaps.length) return 3; // default until real data exists
    const m = state.gaps.reduce((a, b) => a + b, 0) / state.gaps.length / 60000;
    return Math.min(15, Math.max(1, m));
}

// Estimated wait for someone with `ahead` people in front, shared across counters
const waitFor = (ahead) => Math.round(ahead * avgMin() / state.counters);

function crowdLevel() {
    const load = state.queue.length / state.counters;
    return load <= 3 ? "low" : load <= 7 ? "medium" : "high";
}

// ---------- Student actions ----------

function joinQueue() {
    if (mine() !== null) return toast("You already have a token.");
    if (state.paused) return toast("Joining is paused by canteen staff.");

    const name = $("nameInput").value.trim().slice(0, 20);
    const token = state.next++;
    state.queue.push({ token, name, joinedAt: Date.now() });
    state.peak = Math.max(state.peak, state.queue.length);
    localStorage.setItem(MY, JSON.stringify({ token, epoch: state.epoch }));
    $("nameInput").value = "";

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
    save();
    toast("Token " + fmt(token) + " issued. We'll alert you when you're close.");
}

function leaveQueue() {
    const t = mine();
    if (t === null) return;
    state.queue = state.queue.filter((q) => q.token !== t);
    localStorage.removeItem(MY);
    save();
    toast("You left the queue.");
}

// ---------- Staff actions ----------

function staffLogin() {
    if ($("pinInput").value === STAFF_PIN) {
        sessionStorage.setItem("scq_staff", "1");
        $("pinInput").value = "";
        render();
    } else {
        toast("Wrong PIN. Try again.");
    }
}

function staffLogout() {
    sessionStorage.removeItem("scq_staff");
    render();
}

const isStaff = () => sessionStorage.getItem("scq_staff") === "1";

function serveNext() {
    if (!state.queue.length) return toast("The queue is empty.");
    const now = Date.now();
    const person = state.queue.shift();

    if (state.lastServeAt && now - state.lastServeAt < 15 * 60000) {
        state.gaps.push(now - state.lastServeAt);
        state.gaps = state.gaps.slice(-5);
    }
    state.lastServeAt = now;
    state.served.unshift({ token: person.token, name: person.name, waitMs: now - person.joinedAt });
    state.served = state.served.slice(0, 50);
    save();
    toast("Called " + fmt(person.token) + ".");
}

function togglePause() {
    state.paused = !state.paused;
    save();
}

function setCounters(d) {
    state.counters = Math.min(4, Math.max(1, state.counters + d));
    save();
}

function resetQueue() {
    if (!confirm("Reset the queue and clear today's statistics?")) return;
    state = fresh();
    localStorage.removeItem(MY);
    save();
    toast("Queue reset.");
}

// ---------- Rendering ----------

function render() {
    const n = state.queue.length;
    const level = crowdLevel();
    const last = state.served[0];

    $("queueCount").textContent = n;
    $("waitTime").textContent = waitFor(n);
    $("crowdStatus").textContent = level[0].toUpperCase() + level.slice(1);
    $("crowdStatus").dataset.level = level;
    $("nowServing").textContent = last ? fmt(last.token) : "—";
    $("avgInfo").textContent = state.gaps.length
        ? "Wait based on the last " + state.gaps.length + " services (" + avgMin().toFixed(1) + " min each), " + state.counters + " counter(s) open."
        : "Using a default of 3 min per person until live data builds up.";
    $("pauseNote").hidden = !state.paused;

    // Student ticket
    const t = mine();
    const idx = state.queue.findIndex((q) => q.token === t);
    $("joinBox").hidden = idx !== -1;
    $("myTicket").hidden = idx === -1;
    $("joinBtn").disabled = state.paused;
    if (idx !== -1) {
        $("tkNum").textContent = fmt(t);
        $("tkName").textContent = state.queue[idx].name;
        $("tkPos").textContent = idx + 1;
        $("tkWait").textContent = waitFor(idx);
    }

    // Queue list (textContent keeps typed names safe)
    const list = $("queueList");
    list.innerHTML = "";
    if (!n) {
        const e = document.createElement("div");
        e.className = "empty";
        e.textContent = "Nobody is waiting. Walk right up.";
        list.appendChild(e);
    }
    state.queue.forEach((q, i) => {
        const row = document.createElement("div");
        row.className = "item" + (q.token === t ? " me" : "");
        const a = document.createElement("b");
        a.textContent = fmt(q.token) + (q.name ? " · " + q.name : "") + (q.token === t ? " (you)" : "");
        const b = document.createElement("span");
        b.textContent = "Position " + (i + 1);
        row.append(a, b);
        list.appendChild(row);
    });

    // Staff panel
    $("pinBox").hidden = isStaff();
    $("staffPanel").hidden = !isStaff();
    $("cntVal").textContent = state.counters;
    $("pauseBtn").textContent = state.paused ? "Resume joining" : "Pause joining";
    $("sServed").textContent = state.served.length;
    $("sSvc").textContent = avgMin().toFixed(1);
    const avgWait = state.served.length
        ? state.served.reduce((a, s) => a + s.waitMs, 0) / state.served.length / 60000 : 0;
    $("sWait").textContent = avgWait.toFixed(1);
    $("sPeak").textContent = state.peak;

    const rec = $("recentList");
    rec.innerHTML = "";
    state.served.slice(0, 8).forEach((s) => {
        const c = document.createElement("span");
        c.className = "chip";
        c.textContent = fmt(s.token);
        rec.appendChild(c);
    });
}

// ---------- Alerts ----------

function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    $("toasts").appendChild(el);
    setTimeout(() => el.remove(), 5000);
}

function beep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        o.frequency.value = 880;
        o.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.25);
    } catch (e) { /* audio blocked - ignore */ }
}

function alertUser(msg) {
    toast(msg);
    beep();
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Smart Canteen Queue", { body: msg });
    }
}

// Fires when this student is nearly up, and when their token is called
function checkAlerts() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(MY)); } catch (e) {}
    if (!saved || saved.epoch !== state.epoch) return;

    const idx = state.queue.findIndex((q) => q.token === saved.token);
    const flag = "scq_near_" + state.epoch + "_" + saved.token;

    if (idx === -1) {
        if (state.served.some((s) => s.token === saved.token)) {
            alertUser("Token " + fmt(saved.token) + " is called. Please go to the counter!");
        }
        localStorage.removeItem(MY);
        render();
    } else if (idx <= 1 && !sessionStorage.getItem(flag)) {
        sessionStorage.setItem(flag, "1");
        alertUser("You're nearly up! Head to the canteen now.");
    }
}

// ---------- Sync between tabs / windows on this device ----------

window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
        state = load();
        render();
        checkAlerts();
    }
});

// Refresh every 30s so waits stay current
setInterval(render, 30000);

render();
checkAlerts();
