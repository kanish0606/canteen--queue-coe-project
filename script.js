// Smart Canteen Queue - 100% build (client)
// All queue data lives on the server; this file renders it and sends actions.

const TICKET = "scq_ticket";
const $ = (id) => document.getElementById(id);
const fmt = (n) => "A-" + String(n).padStart(3, "0");

let S = null;                                   // latest state from the server
let staffToken = sessionStorage.getItem("scq_staff_token");
let stats = null;
let qrFor = null;

// ---------- Two modes ----------
// SERVER mode: talks to server.js (shared queue across devices).
// LOCAL mode: used automatically when no server is reachable (file:// or static hosting).
//   The same logic runs in the browser and saves to localStorage (one browser only).
let LOCAL = false;
const LKEY = "scq_local_db";
const LOCAL_PASSWORD = "canteen123";
let D = null;

const lfresh = () => ({ epoch: Date.now(), queue: [], next: 1, served: [], counters: 1, paused: false,
    peak: 0, lastServeAt: null, gaps: [], history: [], joins: [] });
const ldb = () => { try { return Object.assign(lfresh(), JSON.parse(localStorage.getItem(LKEY))); } catch (e) { return lfresh(); } };

function linterval() {
    let ewma = null;
    D.gaps.forEach((g) => { ewma = ewma === null ? g : 0.6 * g + 0.4 * ewma; });
    const hr = new Date().getHours();
    const same = D.history.filter((h) => new Date(h.t).getHours() === hr).map((h) => h.gap);
    const seasonal = same.length >= 3 ? same.reduce((a, b) => a + b, 0) / same.length : null;
    let ms;
    if (ewma !== null && seasonal !== null) ms = 0.6 * ewma + 0.4 * seasonal;
    else if (ewma !== null) ms = ewma;
    else if (seasonal !== null) ms = seasonal;
    else return 3 / D.counters;
    return Math.min(15, Math.max(0.5, ms / 60000));
}
const llevel = (n) => { const l = n / D.counters; return l <= 3 ? "low" : l <= 7 ? "medium" : "high"; };

function lview() {
    const i = linterval(), now = Date.now();
    const arr = D.joins.filter((t) => t > now - 15 * 60000).length / 15;
    const fq = Math.max(0, D.queue.length + arr * 15 - 15 / i);
    return { epoch: D.epoch, queue: D.queue.map((q) => ({ token: q.token, name: q.name })),
        recent: D.served.slice(0, 8).map((s) => s.token), counters: D.counters, paused: D.paused,
        intervalMin: +i.toFixed(2), samples: D.gaps.length, crowd: llevel(D.queue.length),
        forecast: { inMin: 15, queue: Math.round(fq), crowd: llevel(fq), arrivalsPerMin: +arr.toFixed(2) } };
}

function lsave() {
    localStorage.setItem(LKEY, JSON.stringify(D));
    S = lview();
    render();
    checkAlerts();
    if (staffToken) loadStats();
}

async function localApi(path, b) {
    b = b || {};
    D = ldb();
    const staff = () => { if (!staffToken) throw new Error("Staff login required"); };
    const done = (r) => { lsave(); return r; };
    switch (path) {
        case "stats": {
            staff();
            const w = D.served.map((s) => s.waitMs);
            return { served: D.served.length, peak: D.peak, intervalMin: +linterval().toFixed(1),
                avgWaitMin: w.length ? +(w.reduce((a, x) => a + x, 0) / w.length / 60000).toFixed(1) : 0 };
        }
        case "join": {
            if (D.paused) throw new Error("Joining is paused by canteen staff.");
            const e = { token: D.next++, name: String(b.name || "").trim().slice(0, 20),
                key: Math.random().toString(36).slice(2), joinedAt: Date.now() };
            D.queue.push(e);
            D.peak = Math.max(D.peak, D.queue.length);
            D.joins = D.joins.concat(e.joinedAt).slice(-200);
            return done({ token: e.token, key: e.key, epoch: D.epoch });
        }
        case "leave": {
            const n = D.queue.length;
            D.queue = D.queue.filter((q) => !(q.token === b.token && q.key === b.key));
            if (D.queue.length === n) throw new Error("Ticket not found");
            return done({ ok: true });
        }
        case "login":
            if (b.password !== LOCAL_PASSWORD) throw new Error("Wrong password");
            return { token: "local" };
        case "serve": {
            staff();
            if (!D.queue.length) throw new Error("The queue is empty.");
            const now = Date.now(), p = D.queue.shift();
            if (D.lastServeAt && now - D.lastServeAt < 15 * 60000) {
                const gap = now - D.lastServeAt;
                D.gaps = D.gaps.concat(gap).slice(-10);
                D.history = D.history.concat({ t: now, gap }).slice(-500);
            }
            D.lastServeAt = now;
            D.served.unshift({ token: p.token, waitMs: now - p.joinedAt });
            D.served = D.served.slice(0, 200);
            return done({ served: p.token });
        }
        case "pause": staff(); D.paused = !D.paused; return done({});
        case "counters": staff(); D.counters = Math.min(4, Math.max(1, D.counters + (Number(b.delta) || 0))); return done({});
        case "reset": staff(); D = Object.assign(lfresh(), { history: D.history }); return done({});
    }
    throw new Error("Not found");
}

function startLocal() {
    if (LOCAL) return;
    LOCAL = true;
    D = ldb();
    S = lview();
    $("conn").hidden = true;
    $("modeNote").hidden = false;
    window.addEventListener("storage", (e) => {
        if (e.key === LKEY) { D = ldb(); S = lview(); render(); checkAlerts(); }
    });
    setInterval(() => { D = ldb(); S = lview(); render(); }, 30000);
    render();
    checkAlerts();
}

// ---------- API ----------
async function api(path, method, body) {
    if (LOCAL) return localApi(path, body);
    const headers = { "Content-Type": "application/json" };
    if (staffToken) headers.Authorization = "Bearer " + staffToken;
    let res;
    try {
        res = await fetch("/api/" + path, { method: method || "GET", headers, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
        startLocal();                       // server unreachable -> switch to local mode
        return localApi(path, body);
    }
    if (res.status === 404 || res.status === 405) { startLocal(); return localApi(path, body); }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && staffToken && path !== "login") staffLogout(true);
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
}

const run = (p) => p.catch((e) => toast(e.message));

// ---------- Live connection (Server-Sent Events) ----------
function connect() {
    if (location.protocol === "file:") return startLocal();
    const es = new EventSource("/api/events");
    let opened = false;
    es.onopen = () => { opened = true; };
    es.onmessage = (e) => {
        S = JSON.parse(e.data);
        $("conn").hidden = true;
        render();
        checkAlerts();
        if (staffToken) loadStats();
    };
    es.onerror = () => {
        if (!opened) { es.close(); startLocal(); } else $("conn").hidden = false;
    };
}

async function addDemo() {
    for (let i = 1; i <= 5; i++) {
        try { await api("join", "POST", { name: "Demo " + i }); } catch (e) { toast(e.message); break; }
    }
}

// ---------- Ticket helpers ----------
function ticket() {
    try {
        const t = JSON.parse(localStorage.getItem(TICKET));
        return t && S && t.epoch === S.epoch ? t : null;
    } catch (e) { return null; }
}

const waitFor = (ahead) => Math.round(ahead * S.intervalMin);

// ---------- Student actions ----------
function joinQueue() {
    const name = $("nameInput").value.trim();
    run(api("join", "POST", { name }).then((t) => {
        localStorage.setItem(TICKET, JSON.stringify(t));
        render();
        $("nameInput").value = "";
        if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
        toast("Token " + fmt(t.token) + " issued. We'll alert you when you're close.");
    }));
}

function leaveQueue() {
    const t = ticket();
    if (!t) return;
    run(api("leave", "POST", { token: t.token, key: t.key }).then(() => {
        localStorage.removeItem(TICKET);
        render();
        toast("You left the queue.");
    }));
}

// ---------- Staff actions ----------
function staffLogin() {
    run(api("login", "POST", { password: $("pinInput").value }).then((r) => {
        staffToken = r.token;
        sessionStorage.setItem("scq_staff_token", staffToken);
        $("pinInput").value = "";
        loadStats();
        render();
    }));
}

function staffLogout(expired) {
    staffToken = null;
    stats = null;
    sessionStorage.removeItem("scq_staff_token");
    if (expired) toast("Staff session ended. Log in again.");
    if (S) render();
}

function loadStats() {
    api("stats").then((s) => { stats = s; render(); }).catch(() => {});
}

const serveNext = () => run(api("serve", "POST").then((r) => toast("Called " + fmt(r.served) + ".")));
const togglePause = () => run(api("pause", "POST"));
const setCounters = (d) => run(api("counters", "POST", { delta: d }));
const resetQueue = () => {
    if (confirm("Reset the queue and today's statistics? Learned prediction history is kept.")) {
        run(api("reset", "POST").then(() => toast("Queue reset.")));
    }
};

// ---------- QR codes ----------
function drawQR(el, text, size) {
    if (typeof QRCode === "undefined") return;   // library blocked/offline: skip quietly
    el.innerHTML = "";
    new QRCode(el, { text, width: size, height: size });
}

// ---------- Rendering ----------
function render() {
    if (!S) return;
    const n = S.queue.length;
    const t = ticket();
    const idx = t ? S.queue.findIndex((q) => q.token === t.token) : -1;
    const cap = (s) => s[0].toUpperCase() + s.slice(1);

    $("queueCount").textContent = n;
    $("waitTime").textContent = waitFor(n);
    $("crowdStatus").textContent = cap(S.crowd);
    $("crowdStatus").dataset.level = S.crowd;
    $("nowServing").textContent = S.recent.length ? fmt(S.recent[0]) : "—";
    $("avgInfo").textContent = S.samples
        ? "Wait predicted from " + S.samples + " recent services (" + S.intervalMin + " min each), " + S.counters + " counter(s) open."
        : "Using a default estimate until live service data builds up.";
    $("forecast").textContent = "In 15 min: about " + S.forecast.queue + " waiting (" + cap(S.forecast.crowd) +
        " crowd), with " + S.forecast.arrivalsPerMin + " arrivals per minute.";
    $("pauseNote").hidden = !S.paused;

    if (!$("siteQr").firstChild) drawQR($("siteQr"), location.href.split("#")[0], 88);

    // Student ticket
    $("joinBox").hidden = idx !== -1;
    $("myTicket").hidden = idx === -1;
    $("joinBtn").disabled = S.paused;
    if (idx !== -1) {
        $("tkNum").textContent = fmt(t.token);
        $("tkName").textContent = S.queue[idx].name;
        $("tkPos").textContent = idx + 1;
        $("tkWait").textContent = waitFor(idx);
        if (qrFor !== t.token) { qrFor = t.token; drawQR($("tkQr"), "SCQ|" + S.epoch + "|" + t.token, 96); }
    }

    // Queue list
    const list = $("queueList");
    list.innerHTML = "";
    if (!n) {
        const e = document.createElement("div");
        e.className = "empty";
        e.textContent = "Nobody is waiting. Walk right up.";
        list.appendChild(e);
    }
    S.queue.forEach((q, i) => {
        const mineRow = t && q.token === t.token;
        const row = document.createElement("div");
        row.className = "item" + (mineRow ? " me" : "");
        const a = document.createElement("b");
        a.textContent = fmt(q.token) + (q.name ? " · " + q.name : "") + (mineRow ? " (you)" : "");
        const b = document.createElement("span");
        b.textContent = "Position " + (i + 1);
        row.append(a, b);
        list.appendChild(row);
    });

    // Staff panel
    $("pinBox").hidden = !!staffToken;
    $("staffPanel").hidden = !staffToken;
    $("cntVal").textContent = S.counters;
    $("pauseBtn").textContent = S.paused ? "Resume joining" : "Pause joining";
    if (stats) {
        $("sServed").textContent = stats.served;
        $("sSvc").textContent = stats.intervalMin;
        $("sWait").textContent = stats.avgWaitMin;
        $("sPeak").textContent = stats.peak;
    }
    const rec = $("recentList");
    rec.innerHTML = "";
    S.recent.forEach((tk) => {
        const c = document.createElement("span");
        c.className = "chip";
        c.textContent = fmt(tk);
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
    } catch (e) { /* audio blocked */ }
}

function alertUser(msg) {
    toast(msg);
    beep();
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Smart Canteen Queue", { body: msg });
    }
}

function checkAlerts() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(TICKET)); } catch (e) {}
    if (!saved || !S) return;
    if (saved.epoch !== S.epoch) { localStorage.removeItem(TICKET); render(); return; }

    const idx = S.queue.findIndex((q) => q.token === saved.token);
    const flag = "scq_near_" + S.epoch + "_" + saved.token;

    if (idx === -1) {
        if (S.recent.includes(saved.token)) {
            alertUser("Token " + fmt(saved.token) + " is called. Please go to the counter!");
        }
        localStorage.removeItem(TICKET);
        qrFor = null;
        render();
    } else if (idx <= 1 && !sessionStorage.getItem(flag)) {
        sessionStorage.setItem(flag, "1");
        alertUser("You're nearly up! Head to the canteen now.");
    }
}

connect();
