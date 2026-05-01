// All API requests go through the Vite proxy at /queue-api
// Vite rewrites /queue-api/* → http://127.0.0.1:3000/api/*
// This means the phone can reach the queue API via the same tunneled origin.
const API = "";
const TWO_MINUTES = 2 * 60 * 1000;
const FIVE_MINUTES = 5 * 60 * 1000;
const POLL_MS = 1500;

let pollTimer = null;
let generalPollTimer = null;
let countdownTimer = null;
let lastStatus = null;
let currentToken = null;

// Callbacks provided by UI to update view
let uiCallbacks = {
  onWaiting: () => {},
  onNotified: () => {},
  onExpired: () => {},
  onRemoved: () => {},
  onTick: () => {},
  onGeneralStatus: () => {}
};

/**
 * Request browser notification permissions
 */
export async function requestNotifPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch (e) {
      console.warn("Notification permission request failed", e);
    }
  }
}

/**
 * Fire a browser notification
 */
function fireNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch (e) {
      console.warn("Failed to fire notification", e);
    }
  }
}

/**
 * Set the callbacks used to update the UI
 */
export function setCallbacks(callbacks) {
  uiCallbacks = { ...uiCallbacks, ...callbacks };
}

/**
 * Check existing session and return the screen to show
 */
export function init() {
  const savedId = localStorage.getItem("q_id");
  if (savedId) {
    return "resume";
  }
  return "instructions";
}

/**
 * Handle a QR code scanned via the camera
 */
export function handleScannedQR(decodedText) {
  try {
    const url = new URL(decodedText);
    const token = url.searchParams.get("t");
    if (!token) {
      return { valid: false, error: "Not a valid queue QR code" };
    }
    return handleURLToken(token);
  } catch (e) {
    return { valid: false, error: "Invalid QR code format" };
  }
}

/**
 * Validate a token from the URL
 */
export function handleURLToken(token) {
  let tokenTime;
  try {
    tokenTime = parseInt(atob(token), 10);
    if (isNaN(tokenTime)) throw new Error("bad");
  } catch {
    return { valid: false, error: "Invalid QR code. Please ask the booth to regenerate it." };
  }

  const age = Date.now() - tokenTime;
  if (age > TWO_MINUTES) {
    const secs = Math.floor(age / 1000);
    return { valid: false, error: `QR code expired ${secs}s ago. Ask the booth to regenerate it.` };
  }

  currentToken = token;
  const secsLeft = Math.floor((TWO_MINUTES - age) / 1000);
  return { valid: true, secsLeft, token };
}

/**
 * Join the queue
 */
export async function joinQueue(name) {
  if (!currentToken) {
    return { success: false, error: "Missing token. Please scan again." };
  }

  try {
    const res = await fetch(`/queue-api/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: currentToken, name }),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      return { success: false, error: data.error };
    }

    localStorage.setItem("q_id", data.id);
    localStorage.setItem("q_label", data.label);
    
    // Clear the token since it's used
    currentToken = null;
    requestNotifPermission();

    return { success: true, data };
  } catch (e) {
    console.error("Join error", e);
    return { success: false, error: "Network error. Please try again." };
  }
}

/**
 * Start polling the status API
 */
export function startPolling(id) {
  if (pollTimer) clearInterval(pollTimer);
  lastStatus = null;
  pollTimer = setInterval(() => poll(id), POLL_MS);
  poll(id); // immediate first call
}

export function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

/**
 * Start polling general queue status (e.g. for instructions screen)
 */
export function startGeneralPolling() {
  if (generalPollTimer) clearInterval(generalPollTimer);
  // Poll every 3 minutes as requested
  generalPollTimer = setInterval(pollGeneral, 0.5 * 60 * 1000);
  pollGeneral();
}

export function stopGeneralPolling() {
  if (generalPollTimer) clearInterval(generalPollTimer);
  generalPollTimer = null;
}

async function pollGeneral() {
  try {
    const res = await fetch(`/queue-api/queue?t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      uiCallbacks.onGeneralStatus(data.total);
    }
  } catch (e) {
    console.warn("Failed to fetch general queue status", e);
  }
}

async function poll(id) {
  let res, data;
  try {
    // ?t= cache buster prevents browser from caching GET responses
    res = await fetch(`/queue-api/status?id=${id}&t=${Date.now()}`, {
      cache: "no-store",
    });
    data = await res.json();
  } catch {
    return; // network blip — try again next tick
  }

  if (res.status === 404) {
    // Removed from queue by admin or session expired
    stopPolling();
    clearSession();
    uiCallbacks.onRemoved();
    return;
  }

  const prevStatus = lastStatus;
  lastStatus = data.status;

  if (data.status === "notified") {
    stopPolling();

    if (prevStatus !== "notified") {
      fireNotification("It's your turn!", "Head to the escape room booth. You have 5 minutes.");
    }

    if (data.expired) {
      uiCallbacks.onExpired();
    } else {
      uiCallbacks.onNotified(data.notifiedAt);
    }
    return;
  }

  // Still waiting
  uiCallbacks.onWaiting(data.position, data.total, data.ticketNumber);
}

/**
 * Start the 10-minute countdown timer
 */
export function startCountdown(notifiedAt) {
  if (countdownTimer) clearInterval(countdownTimer);

  const tick = () => {
    const remaining = Math.max(0, FIVE_MINUTES - (Date.now() - notifiedAt));
    const m = String(Math.floor(remaining / 60000)).padStart(2, "0");
    const s = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
    
    uiCallbacks.onTick(m, s);
    
    if (remaining === 0) {
      clearInterval(countdownTimer);
      clearSession();
      uiCallbacks.onExpired();
    }
  };

  countdownTimer = setInterval(tick, 1000);
  tick(); // Initial call
}

export function stopCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = null;
}

/**
 * Leave the queue voluntarily
 */
export async function leaveQueue() {
  const id = localStorage.getItem("q_id");
  if (!id) return;

  stopPolling();
  stopCountdown();
  
  await fetch(`/queue-api/leave?id=${id}`, { method: "POST" }).catch(() => {});
  
  clearSession();
}

/**
 * Get current session details
 */
export function getSession() {
  const id = localStorage.getItem("q_id");
  const label = localStorage.getItem("q_label");
  if (id && label) return { id, label };
  return null;
}

/**
 * Clear the local session
 */
export function clearSession() {
  localStorage.removeItem("q_id");
  localStorage.removeItem("q_label");
}

/**
 * Helper to format positions
 */
export function ordinal(n) {
  return `#${n}`;
}
