# Escape Room Queue — Integration Guide

---

## Part 1: QR Code Handling on Your Main Webapp

### How the flow works

```
Admin panel calls GET /api/token
    → gets { token: "MTc0..." }
    → builds URL: http://localhost:5317/funtasia_app/?t=MTc0...
    → encodes that URL into a QR code (displayed at booth)

User opens camera app → scans QR
    → phone opens: http://localhost:5317/funtasia_app/?t=MTc0...
    → your webapp loads, reads ?t= from URL
    → validates token age client-side
    → if valid: shows name input immediately
    → user types name, clicks Join
    → POST /api/join { token, name }
    → on success: poll /api/status every 3s
```

---

### Step-by-step implementation

#### 1. On page load — detect and handle the token

```js
const API = "http://localhost:3000"; // your Vercel backend

window.addEventListener("DOMContentLoaded", init);

function init() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("t");

  if (token) {
    // Clean the token out of the URL bar immediately
    window.history.replaceState({}, "", window.location.pathname);
    handleToken(token);
    return;
  }

  const savedId = localStorage.getItem("q_id");
  if (savedId) {
    // Returning user — resume polling their existing session
    showScreen("screen-wait");
    startPolling(savedId);
    return;
  }

  // No token, no session — tell user to scan QR at booth
  showScreen("screen-instructions");
}
```

---

#### 2. Validate the token client-side

```js
const TWO_MINUTES = 2 * 60 * 1000;

function handleToken(token) {
  let tokenTime;

  try {
    tokenTime = parseInt(atob(token), 10);
    if (isNaN(tokenTime)) throw new Error("bad");
  } catch {
    showError("Invalid QR code. Please ask the booth to regenerate it.");
    showScreen("screen-instructions");
    return;
  }

  const age = Date.now() - tokenTime;

  if (age > TWO_MINUTES) {
    const secs = Math.floor(age / 1000);
    showError(`QR code expired ${secs}s ago. Ask the booth to regenerate it.`);
    showScreen("screen-instructions");
    return;
  }

  // Valid — store token and show the name input
  const secsLeft = Math.floor((TWO_MINUTES - age) / 1000);
  document.getElementById("token-timer").textContent = `Valid — join within ${secsLeft}s`;

  // Store token on the join button/form for use in step 3
  document.getElementById("join-form").dataset.token = token;

  showScreen("screen-join"); // shows name input + join button
}
```

---

#### 3. Join the queue

Called when user fills in their name and clicks Join.

```js
async function joinQueue() {
  const token = document.getElementById("join-form").dataset.token;
  const name = document.getElementById("name-input").value.trim();

  if (!name) {
    showError("Please enter your name.");
    return;
  }

  let res, data;
  try {
    res = await fetch(`${API}/api/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name }),
    });
    data = await res.json();
  } catch {
    showError("Network error. Please try again.");
    return;
  }

  if (!res.ok) {
    // data.error is always a human-readable string
    // possible values:
    //   "Token expired"
    //   "This QR code has already been used to join."
    //   "Invalid token"
    //   "Missing name"
    showError(data.error);
    return;
  }

  // Save session to localStorage so returning/refreshing works
  localStorage.setItem("q_id", data.id);
  localStorage.setItem("q_label", data.label);

  if (data.status === "notified") {
    // They joined an empty queue — it's already their turn
    handleNotified(data.notifiedAt);
  } else {
    showScreen("screen-wait");
    updateWaitUI(data.position, data.total);
    startPolling(data.id);
  }
}
```

---

#### 4. Poll for status updates

```js
const POLL_MS = 3000;
let pollTimer = null;
let lastStatus = null;

function startPolling(id) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => poll(id), POLL_MS);
  poll(id); // immediate first call
}

async function poll(id) {
  let res, data;
  try {
    // ?t= cache buster prevents browser from caching GET responses
    res = await fetch(`${API}/api/status?id=${id}&t=${Date.now()}`, {
      cache: "no-store",
    });
    data = await res.json();
  } catch {
    return; // network blip — try again next tick
  }

  if (res.status === 404) {
    // Removed from queue by admin or session expired
    clearInterval(pollTimer);
    localStorage.removeItem("q_id");
    localStorage.removeItem("q_label");
    showScreen("screen-instructions");
    return;
  }

  const prev = lastStatus;
  lastStatus = data.status;

  if (data.status === "notified") {
    clearInterval(pollTimer);

    if (prev !== "notified") {
      // Status just flipped — fire browser notification
      fireNotification("It's your turn!", "Head to the escape room booth. You have 10 minutes.");
    }

    if (data.expired) {
      handleExpired();
    } else {
      handleNotified(data.notifiedAt);
    }
    return;
  }

  // Still waiting — update position display
  updateWaitUI(data.position, data.total);
}

function updateWaitUI(position, total) {
  const label = localStorage.getItem("q_label");
  document.getElementById("my-name").textContent = label;
  document.getElementById("my-position").textContent = ordinal(position);
  document.getElementById("people-ahead").textContent = position - 1;
}

function ordinal(n) {
  if (n === 1) return "1st — you're next!";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}
```

---

#### 5. Handle "it's your turn" + countdown

```js
const TEN_MINUTES = 10 * 60 * 1000;
let countdownTimer = null;

function handleNotified(notifiedAt) {
  showScreen("screen-notified");
  if (countdownTimer) clearInterval(countdownTimer);

  countdownTimer = setInterval(() => {
    const remaining = Math.max(0, TEN_MINUTES - (Date.now() - notifiedAt));
    const m = String(Math.floor(remaining / 60000)).padStart(2, "0");
    const s = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
    document.getElementById("countdown").textContent = `${m}:${s}`;
    if (remaining === 0) {
      clearInterval(countdownTimer);
      handleExpired();
    }
  }, 1000);
}

function handleExpired() {
  localStorage.removeItem("q_id");
  localStorage.removeItem("q_label");
  showScreen("screen-expired");
}
```

---

#### 6. Browser notifications (optional)

```js
async function requestNotifPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

function fireNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

// Call requestNotifPermission() on join (must be triggered by a user gesture)
```

---

#### 7. Leave queue

```js
async function leaveQueue() {
  const id = localStorage.getItem("q_id");
  if (!id) return;

  await fetch(`${API}/api/leave?id=${id}`, { method: "POST" }).catch(() => {});

  clearInterval(pollTimer);
  localStorage.removeItem("q_id");
  localStorage.removeItem("q_label");
  showScreen("screen-instructions");
}
```

---

## Part 2: Local Testing with Redis

Rather than redeploying to Vercel every change, you can run the API locally against a local Redis instance. This lets you test everything end to end on your machine.

---

### Why Redis instead of /tmp?

`/tmp` on Vercel is per-instance and resets on cold starts — fine for a demo, bad for testing across multiple requests with `vercel dev`. Redis gives you a real persistent store locally that matches what you'd use in production.

---

### Setup

#### 1. Install Redis locally

**Mac:**
```bash
brew install redis
brew services start redis
# Redis now running on localhost:6379
```

**Windows:**
Use [Memurai](https://www.memurai.com/) (Redis-compatible for Windows) or run via WSL:
```bash
sudo apt install redis-server
sudo service redis-server start
```

**Linux:**
```bash
sudo apt install redis-server
sudo systemctl start redis
```

Verify it's running:
```bash
redis-cli ping
# should return: PONG
```

---

#### 2. Install the Redis client in your project

```bash
cd eq2
npm install ioredis
```

---

#### 3. Create a new `_queue.js` that switches between Redis and flat file

Replace `api/_queue.js` with this:

```js
// api/_queue.js
// Uses Redis when REDIS_URL is set, falls back to /tmp JSON for Vercel prod

let redisClient = null;
const KEY = "escape-queue";

function getRedis() {
  if (redisClient) return redisClient;
  const Redis = require("ioredis");
  redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  return redisClient;
}

async function read() {
  if (process.env.REDIS_URL || process.env.USE_REDIS) {
    const client = getRedis();
    const raw = await client.get(KEY);
    if (!raw) return { queue: [], served: 0, usedTokens: [] };
    try { return JSON.parse(raw); }
    catch { return { queue: [], served: 0, usedTokens: [] }; }
  }
  // Flat file fallback
  const fs = require("fs");
  const FILE = "/tmp/queue.json";
  if (!fs.existsSync(FILE)) return { queue: [], served: 0, usedTokens: [] };
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch { return { queue: [], served: 0, usedTokens: [] }; }
}

async function save(data) {
  if (process.env.REDIS_URL || process.env.USE_REDIS) {
    const client = getRedis();
    await client.set(KEY, JSON.stringify(data));
    return;
  }
  const fs = require("fs");
  fs.writeFileSync("/tmp/queue.json", JSON.stringify(data, null, 2));
}

module.exports = { read, save };
```

> **Note:** Because `read` and `save` are now async, all your API route files need to `await` them.
> Update every route that calls `read()` or `save()` to use `async/await`:
> ```js
> // before
> const data = read();
> // after
> const data = await read();
> ```

---

#### 4. Set up your local `.env` file

Create `.env` in the project root (already gitignored by Vercel):

```env
USE_REDIS=true
REDIS_URL=redis://localhost:6379
ALLOWED_ORIGIN=http://localhost:3000
```

---

#### 5. Run locally

```bash
vercel dev
# API available at http://localhost:3000
# Redis running on localhost:6379
```

Your GitHub Pages webapp can point its `API` constant at `http://localhost:3000` during dev:

```js
const API = window.location.hostname === "localhost"
  ? "http://localhost:3000"       // local dev
  : "https://your-vercel-app.vercel.app"; // production
```

---

#### 6. Inspect the queue in Redis at any time

```bash
redis-cli
> GET escape-queue
> DEL escape-queue   # clear/reset the queue
```

---

### Production on Vercel with Redis (optional upgrade)

When you're ready to move off `/tmp` for production, use [Upstash Redis](https://upstash.com) — it has a free tier and works with Vercel with zero config:

1. Create a free Upstash Redis database
2. Copy the `REDIS_URL` they give you
3. In Vercel dashboard → Settings → Environment Variables → add `REDIS_URL`

The same `_queue.js` code handles both — it switches automatically based on whether `REDIS_URL` is set.

---

## Summary of environment variables

| Variable | Local (`.env`) | Vercel dashboard |
|----------|---------------|-----------------|
| `USE_REDIS` | `true` | not needed (use `REDIS_URL` instead) |
| `REDIS_URL` | `redis://localhost:6379` | your Upstash URL |
| `ALLOWED_ORIGIN` | `http://localhost:3000` | `https://yourusername.github.io` |
