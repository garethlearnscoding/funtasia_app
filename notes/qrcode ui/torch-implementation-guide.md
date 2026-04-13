# Torch Implementation Guide
## `getCapabilities()` · `getSettings()` · `torchOn` boolean

---

## Background: Why you need all three

The Web torch API has three separate concerns that are easy to conflate:

| Concern | Method | Purpose |
|---|---|---|
| **Does this track support torch?** | `getCapabilities()` | Feature detection |
| **Is the torch currently on?** | `getSettings()` | Read current hardware state |
| **What did my app last set?** | your own `torchOn` boolean | Source of truth for UI state |

The problem is that **`getSettings().torch` is unreliable on iOS 18.0–18.3** (returns stale values), and **`getCapabilities()` populates lazily** on Samsung/Xiaomi (returns `{}` if called too early). Neither alone is sufficient. You need all three layers working together.

---

## Layer 1 — `getCapabilities()`: Is torch supported?

`getCapabilities()` returns the static feature set of the current camera track. Call it **after** the video is playing and a short delay has passed.

```js
const caps = track.getCapabilities?.() ?? {};

// caps.torch is a boolean: true = supported, undefined/false = not supported
if (caps.torch === true) {
  console.log('Torch supported via getCapabilities');
}
```

### What each value means

| `caps.torch` value | Meaning |
|---|---|
| `true` | Torch is supported — safe to call `applyConstraints({ torch })` |
| `false` | Hardware present but torch explicitly disabled for this track |
| `undefined` | Property absent — either not supported or caps not yet populated |
| `{}` (empty object) | Called too early — wait for stream to stabilise and retry |

### Timing is critical

```js
// ❌ Wrong — called before stream is live
const stream = await navigator.mediaDevices.getUserMedia({ video: true });
const track = stream.getVideoTracks()[0];
const caps = track.getCapabilities(); // Returns {} on Samsung, Xiaomi

// ✅ Correct — wait for the video element to be playing + settle time
video.srcObject = stream;
await new Promise(resolve => {
  if (!video.paused && video.readyState >= 3) return resolve();
  video.addEventListener('playing', resolve, { once: true });
});
await new Promise(r => setTimeout(r, 400)); // Samsung/Xiaomi lazy init

const caps = track.getCapabilities?.() ?? {};
console.log('torch in caps:', caps.torch);
```

### Fallback: constraint probe

Some devices (older ColorOS, some Vivo) support torch but don't advertise it in `getCapabilities()`. Use a probe as a fallback:

```js
async function isTorchSupported(track) {
  // Method 1: getCapabilities
  const caps = track.getCapabilities?.() ?? {};
  if (caps.torch === true) return true;

  // Method 2: constraint probe — try applying torch:false (no-op if on)
  try {
    await track.applyConstraints({ advanced: [{ torch: false }] });
    return true; // Didn't throw = supported
  } catch (e) {
    // NotSupportedError = truly not supported
    // OverconstrainedError = wrong camera (e.g. ultrawide on Samsung)
    console.warn('Torch probe failed:', e.name, e.message);
    return false;
  }
}
```

---

## Layer 2 — `getSettings().torch`: Reading current hardware state

`getSettings()` returns the **live current state** of the track — including whether the torch is actually on at the hardware level.

```js
const settings = track.getSettings();
console.log('torch is currently:', settings.torch); // true | false | undefined
```

### When to use it

- **On app init** — to sync your UI if the torch was already on when you acquired the track
- **After `applyConstraints()`** — to verify the constraint was actually applied
- **On `track` events** — to detect if an external source (e.g. OS) turned the torch off

```js
async function verifyTorchApplied(track, expected) {
  // Give hardware time to respond
  await new Promise(r => setTimeout(r, 100));
  const settings = track.getSettings();
  return settings.torch === expected;
}

// Usage
await track.applyConstraints({ advanced: [{ torch: true }] });
const confirmed = await verifyTorchApplied(track, true);
if (!confirmed) {
  console.warn('Torch constraint applied but getSettings() disagrees');
}
```

### iOS version caveats

| iOS Version | `getSettings().torch` reliability |
|---|---|
| iOS < 17.2 | Property absent — torch not supported |
| iOS 17.2 – 18.3 | ⚠️ Returns **stale value** — do not trust for UI state |
| iOS 18.4+ | ✅ Correct and up to date |

```js
// Detect the stale-getSettings iOS bug
function hasStaleSettingsBug() {
  const ua = navigator.userAgent;
  const match = ua.match(/OS (\d+)_(\d+)/); // e.g. "OS 18_2"
  if (!match) return false;
  const major = parseInt(match[1]);
  const minor = parseInt(match[2]);
  // iOS 17.2 to 18.3 inclusive
  return (major === 17 && minor >= 2) || (major === 18 && minor <= 3);
}
```

> **Rule of thumb:** never use `getSettings().torch` as the source of truth for your UI toggle. Use your own `torchOn` boolean for that.

---

## Layer 3 — `torchOn` boolean: Your source of truth

Because `getSettings()` can be stale (iOS 17.2–18.3) and hardware state can drift (OS torch lock, backgrounding), maintain your **own boolean** that tracks what your app most recently requested.

### Basic pattern

```js
// Module-level state
let torchOn = false;
let videoTrack = null;
let torchSupported = false;

async function toggleTorch() {
  if (!videoTrack || !torchSupported) return;

  const next = !torchOn; // What we WANT to set

  try {
    await videoTrack.applyConstraints({ advanced: [{ torch: next }] });
    torchOn = next; // ✅ Only update AFTER successful apply
    updateTorchUI(torchOn);
  } catch (e) {
    console.error('applyConstraints failed:', e.name, e.message);
    // torchOn stays as-is — constraint didn't apply
  }
}
```

### Why update AFTER the await, not before

```js
// ❌ Wrong — updates state optimistically before we know it worked
torchOn = !torchOn;
await track.applyConstraints({ advanced: [{ torch: torchOn }] });

// ✅ Correct — only updates if the Promise resolved without throwing
const next = !torchOn;
await track.applyConstraints({ advanced: [{ torch: next }] });
torchOn = next;
```

### Syncing `torchOn` with `getSettings()` on init

When you first acquire a camera track, use `getSettings()` to initialise `torchOn` — but only on iOS 18.4+ where it's reliable:

```js
async function initTorchState(track) {
  if (hasStaleSettingsBug()) {
    // Can't trust getSettings() — assume torch is off
    torchOn = false;
  } else {
    const settings = track.getSettings();
    torchOn = settings.torch ?? false;
  }
  console.log('Initial torchOn state:', torchOn);
  updateTorchUI(torchOn);
}
```

### Handling external torch state changes

The OS or another app can turn the torch off without going through your `applyConstraints()`. Listen for the `track`'s `mute`/`unmute` events and re-check `getSettings()`:

```js
videoTrack.addEventListener('mute', () => {
  console.warn('Track muted — OS may have taken camera resource');
  torchOn = false; // Assume off when track is muted
  updateTorchUI(false);
});

// On iOS 18.4+ only — can also poll getSettings() on visibility change
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && videoTrack && !hasStaleSettingsBug()) {
    const actual = videoTrack.getSettings().torch ?? false;
    if (actual !== torchOn) {
      console.warn(`Torch state drifted: expected ${torchOn}, actual ${actual}`);
      torchOn = actual;
      updateTorchUI(torchOn);
    }
  }
});
```

---

## Putting it all together

Here is a complete, production-ready `TorchController` class that layers all three approaches:

```js
class TorchController {
  #track = null;
  #supported = false;
  #on = false;

  /**
   * Call after video is playing + delay has passed.
   * @param {MediaStreamTrack} track - A live video track
   */
  async init(track) {
    this.#track = track;
    this.#supported = await this.#detectSupport();

    if (this.#supported) {
      await this.#syncInitialState();
    }

    // Watch for OS-level track interruptions
    track.addEventListener('mute', () => {
      this.#on = false;
    });

    return this.#supported;
  }

  get supported() { return this.#supported; }
  get isOn()      { return this.#on; }

  async turnOn()  { return this.#set(true); }
  async turnOff() { return this.#set(false); }
  async toggle()  { return this.#set(!this.#on); }

  // ── Private ────────────────────────────────────────────────

  async #detectSupport() {
    if (!this.#track) return false;

    // Method 1: getCapabilities
    const caps = this.#track.getCapabilities?.() ?? {};
    if (caps.torch === true) {
      console.log('[Torch] Supported via getCapabilities');
      return true;
    }

    // Method 2: constraint probe
    try {
      await this.#track.applyConstraints({ advanced: [{ torch: false }] });
      console.log('[Torch] Supported via constraint probe');
      return true;
    } catch (e) {
      console.log('[Torch] Not supported:', e.name);
      return false;
    }
  }

  async #syncInitialState() {
    if (this.#hasStaleSettingsBug()) {
      // iOS 17.2–18.3: getSettings().torch is unreliable — default to false
      this.#on = false;
      console.log('[Torch] Skipping getSettings() sync — stale bug present. Defaulting to off.');
    } else {
      const settings = this.#track.getSettings();
      this.#on = settings.torch ?? false;
      console.log('[Torch] Initial state from getSettings():', this.#on);
    }
  }

  async #set(value) {
    if (!this.#track || !this.#supported) return false;

    try {
      await this.#track.applyConstraints({ advanced: [{ torch: value }] });
      this.#on = value; // Update boolean ONLY on success
      console.log('[Torch] Set to:', value);

      // Optional: verify on platforms where getSettings() is reliable
      if (!this.#hasStaleSettingsBug()) {
        await new Promise(r => setTimeout(r, 100));
        const actual = this.#track.getSettings().torch;
        if (actual !== value) {
          console.warn(`[Torch] getSettings() reports ${actual} but expected ${value}`);
        }
      }

      return true;
    } catch (e) {
      console.error('[Torch] applyConstraints failed:', e.name, e.message);
      return false;
    }
  }

  #hasStaleSettingsBug() {
    // iOS 17.2 to 18.3 inclusive — getSettings().torch returns stale values
    const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    if (!match) return false;
    const [, major, minor] = match.map(Number);
    return (major === 17 && minor >= 2) || (major === 18 && minor <= 3);
  }

  destroy() {
    if (this.#track && this.#on) {
      // Best-effort: turn off torch before releasing track
      this.#track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
    }
    this.#track = null;
    this.#supported = false;
    this.#on = false;
  }
}
```

### Usage

```js
const torch = new TorchController();

// After camera is acquired and video is playing + 400ms settled:
const supported = await torch.init(videoTrack);

if (supported) {
  torchButton.disabled = false;
}

torchButton.addEventListener('click', async () => {
  const ok = await torch.toggle();
  if (ok) {
    torchButton.textContent = torch.isOn ? '🔦 On' : '🔦 Off';
  }
});

// On cleanup
torch.destroy();
```

---

## Decision flowchart

```
START
  │
  ▼
Wait for video `playing` event + 400ms delay
  │
  ▼
Call getCapabilities()
  │
  ├─ torch === true ──────────────────────────► SUPPORTED ✅
  │
  ├─ torch === false / undefined
  │     │
  │     ▼
  │   Run constraint probe (applyConstraints torch:false)
  │     │
  │     ├─ Resolves without error ──────────► SUPPORTED ✅
  │     │
  │     └─ Throws NotSupportedError ────────► NOT SUPPORTED ❌
  │
  └─ {} (empty object) ──► Too early, retry after more delay
  
  
SUPPORTED path:
  │
  ▼
Sync initial torchOn state
  │
  ├─ iOS 17.2–18.3 ──► torchOn = false (skip getSettings)
  │
  └─ Everything else ──► torchOn = getSettings().torch ?? false

  │
  ▼
User presses toggle
  │
  ▼
next = !torchOn
await applyConstraints({ torch: next })
  │
  ├─ Resolves ──► torchOn = next, update UI
  │
  └─ Throws ────► keep torchOn as-is, show error
```

---

## Quick reference: Error types from `applyConstraints`

| Error name | Meaning | Action |
|---|---|---|
| `NotSupportedError` | Torch not supported on this track | Mark as unsupported, hide button |
| `OverconstrainedError` | Wrong camera selected (e.g. Samsung ultrawide) | Try another camera by `deviceId` |
| `NotAllowedError` | Camera permission revoked mid-session | Stop stream, re-request permission |
| `InvalidStateError` | Track has ended/been stopped | Re-acquire stream |
| `AbortError` | Hardware conflict (e.g. another app took camera) | Retry after a short delay |

---

## Key rules summary

1. **Always check `getCapabilities()` first** — but only after `playing` + 400ms
2. **Use constraint probe as fallback** — catches ColorOS/Vivo devices that omit `torch` from capabilities
3. **Never use `getSettings().torch` for UI state** on iOS 17.2–18.3
4. **Update `torchOn` only after `applyConstraints()` resolves** — not before
5. **Reset `torchOn = false` on track mute** — OS may have interrupted the camera
6. **Call `applyConstraints({ torch: false })` before stopping the track** — prevents torch staying on after your stream ends
7. **On iOS, `deviceId`s change every page load** — never persist them across sessions
