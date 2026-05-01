# Camera Transitions — Funtasia 3D Map

A complete reference for every camera movement triggered by user interaction or system events.

---

## 1. The Animation Engine

All smooth transitions share a single lerp loop defined in `animate.js`. There is no concept of a "tween" library — the engine is a dead-simple exponential decay run every frame.

```js
// src/js/ui_ux/animate.js  (lines 20–41)
if (appState.cameraAnim && appState.cameraAnim.active) {
  const lerpFactor = 0.05;

  appState.camera.position.lerp(appState.cameraAnim.cameraTarget, lerpFactor);
  appState.controls.target.lerp(appState.cameraAnim.controlsTarget, lerpFactor);

  const posDist    = appState.camera.position.distanceTo(appState.cameraAnim.cameraTarget);
  const targetDist = appState.controls.target.distanceTo(appState.cameraAnim.controlsTarget);

  if (posDist < 0.1 && targetDist < 0.1) {
    appState.cameraAnim.active = false;
    appState.cameraAnim.isSystemAction = false;
  }
}
```

### Key properties on `appState.cameraAnim` (declared in `appState.js`)

| Property | Type | Purpose |
|---|---|---|
| `active` | `boolean` | Enables/disables the lerp loop |
| `cameraTarget` | `THREE.Vector3` | Where the camera body should end up |
| `controlsTarget` | `THREE.Vector3` | Where OrbitControls pivot point should end up |
| `isSystemAction` | `boolean` | When `true`, animation runs even if "Camera Auto-Focus" is disabled in Settings |

**Triggering any transition = writing to `cameraTarget` and `controlsTarget`, then setting `active = true`.**

---

## 2. Shared Direction Algorithm

Three of the four transition types use an identical direction-preservation algorithm. Understanding it once explains all of them.

```
┌─────────────────────────────────────────────────────┐
│  GOAL: Place the camera behind-and-above the target │
│  FROM the viewer's current viewing direction        │
└─────────────────────────────────────────────────────┘
```

```js
// Step 1 — Compute the current horizontal viewing direction
const direction = new THREE.Vector3().subVectors(camPos, controlsTarget);
direction.y = 0;                               // flatten to the XZ plane
if (direction.lengthSq() < 0.001) direction.set(0, 0, 1); // degenerate guard

direction.normalize();

// Step 2 — Cardinal snap: lock to the closest X or Z axis
if (Math.abs(direction.x) > Math.abs(direction.z)) {
  direction.set(Math.sign(direction.x), 0, 0); // snap to ±X
} else {
  direction.set(0, 0, Math.sign(direction.z)); // snap to ±Z
}

// Step 3 — Offset the camera from the object center
const newCamPos = objectCenter.clone()
  .add(direction.multiplyScalar(distance))
  .add(new THREE.Vector3(0, heightOffset, 0));
```

The cardinal snap is intentional — it ensures the camera always lands squarely in front of the model's face rather than at an awkward diagonal, which would make the highlight look misaligned.

---

## 3. Transition Types

### 3.1 — Interactive Object Click

> **Trigger:** User taps/clicks a coloured interactive mesh on the 3D map  
> **Entry point:** `src/js/helper/util.js` → `focusOnObject()`  
> **Called from:** `handleInteraction()` after a successful raycast

**What's different here:** The camera distance is derived from the physical size of the mesh itself, so small booths don't get a huge pull-back and large spaces don't feel cramped.

```js
// src/js/helper/util.js  (lines 58–112)
export function focusOnObject(targetObject, appState) {
  // ...

  const objectCenter = targetObject.getWorldPosition(new THREE.Vector3());

  const box         = new THREE.Box3().setFromObject(targetObject);
  const objectSize  = box.getSize(new THREE.Vector3());

  // distance and height are proportional to the mesh's bounding box
  const distance     = Math.max(objectSize.length(), 2) * 0.8;
  const heightOffset = Math.max(objectSize.y, 1) * 1.5 + 5;

  // [shared direction algorithm runs here]

  appState.cameraAnim.controlsTarget.copy(objectCenter);
  appState.cameraAnim.cameraTarget.copy(newCamPos);
  appState.cameraAnim.active = true;
}
```

**Distance formula summary:**

| Value | Formula | Effect |
|---|---|---|
| `distance` | `max(diagonal, 2) × 0.8` | Scales with booth footprint |
| `heightOffset` | `max(height, 1) × 1.5 + 5` | Always at least 6.5 units above |

The orbit pivot (`controls.target`) is set to **the raw world origin** of the mesh (from Blender), not a bounding box center. This is intentional — the Blender origin is the logical "door" of each booth.

---

### 3.2 — QR Code Scan / URL `?qrID=`

> **Trigger:** QR code successfully decoded, or page loads with `?qrID=` in the URL  
> **Entry point:** `src/js/events/navigation.js` → `Navigation.handleQRID()`  
> **Called from:** `handleQRSuccess()` in `map.html`, or `Navigation.handleURLQR()` on page load

This transition targets a **QR marker position** registered during model parsing, not a mesh. The offsets are fixed because markers are always point-sized.

```js
// src/js/events/navigation.js  (lines 162–211)
static async handleQRID(qrID, suppressWarning = false) {
  const markerInfo = QRMarker.allMarkers[qrID];
  // ...

  await Navigation.switchFloor(markerInfo.floorId);

  // Pivot is 1 unit above the marker (gives a slight look-down angle)
  const markerCenter = markerInfo.pos.clone().add(new THREE.Vector3(0, 1, 0));

  // [shared direction algorithm runs here]

  const distance     = 8;
  const heightOffset = 6;

  Navigation.appState.cameraAnim.controlsTarget.copy(markerCenter);
  Navigation.appState.cameraAnim.cameraTarget.copy(newCamPos);
  Navigation.appState.cameraAnim.active = true;
}
```

**Fixed offsets:** `distance = 8`, `heightOffset = 6`

Markers (`ROLE = "MARKER"`) are registered in `modelParser.js` at their world positions during the parsing traverse. Their positions are baked at load time:

```js
// src/js/floor/modelParser.js  (lines 220–226)
if (child.userData.ROLE === "MARKER") {
  const markerId = String(child.userData.MARKERID);
  const pos      = child.getWorldPosition(new THREE.Vector3());
  const entry    = { pos, floorId };
  QRMarker.allMarkers[markerId] = entry;
}
```

---

### 3.3 — Directory Booth Focus

> **Trigger:** User taps a booth in the Directory modal, or clicks the Escape Room location tag  
> **Entry point:** `src/js/feature/directory.js` → `focusOnBooth()`  
> **Called from:** `renderDirectory()` list item `onclick`, `escapeQueueUI.js` location tag

This uses the **same fixed offsets as QR scan** (distance=8, heightOffset=6), but targets the booth's `Location` property — a `THREE.Vector3` injected into the JSON data by the model parser at load time.

```js
// src/js/feature/directory.js  (lines 263–288)

// objectCenter: booth Location + 1 unit up (same pivot lift as QR)
const objectCenter = latestItem["Location"].clone().add(new THREE.Vector3(0, 1, 0));

// [shared direction algorithm runs here]

const distance     = 8;
const heightOffset = 6;

appStateRef.cameraAnim.controlsTarget.copy(objectCenter);
appStateRef.cameraAnim.cameraTarget.copy(newCamPos);
appStateRef.cameraAnim.active = true;
```

**How `Location` gets there:** During `parseModel()`, when a mesh's name matches a booth ID in `funtasiaData`, the parser injects the mesh's world position back into the data object:

```js
// src/js/floor/modelParser.js  (line 288)
entry["Location"] = logicalNode.getWorldPosition(new THREE.Vector3());
```

This means `focusOnBooth()` can only animate the camera if the target floor has already been loaded (so the Location has been resolved). If the floor isn't loaded yet, `Navigation.switchFloor()` is awaited first, which triggers the load.

---

### 3.4 — Floor Activation (Hard Snap)

> **Trigger:** User presses a floor button (L1, L2, B1...) OR a QR/directory focus causes a floor switch  
> **Entry point:** `src/js/floor/floor.js` → `Floor.activate()`  
> **Called from:** `Navigation.switchFloor()` after loading completes

This is **not a lerp** — it's a hard snap. The camera position and orbit target are immediately set to the values computed by `parseModel()` when the floor was parsed.

```js
// src/js/floor/floor.js  (lines 77–103)
activate(camera, controls) {
  // ...
  controls.target.copy(this.cameraConfig.target);           // immediate
  camera.position.copy(this.cameraConfig.initialPosition);  // immediate
  controls.minDistance = this.cameraConfig.minDistance;
  controls.maxDistance = this.cameraConfig.maxDistance;
  // ...
  controls.update();
}
```

**`cameraConfig` is computed in `modelParser.js`** from the floor's bounding radius:

```js
// src/js/floor/modelParser.js  (lines 150–157)
const cameraConfig = {
  initialPosition: new THREE.Vector3(0, radius * 1, radius * 1),
  target:          new THREE.Vector3(0, 0, 0),
  minDistance:     radius * 0.06,
  maxDistance:     radius * 3,
  // ...
};
```

The initial camera lands at `(0, r, r)` — a 45° diagonal above the model's centroid — which is why every floor opens with the same isometric-ish viewing angle.

Note the model is also **re-centred to origin** before the radius is calculated:
```js
// modelParser.js  (lines 129–131)
let box = new THREE.Box3().setFromObject(model);
const center = box.getCenter(new THREE.Vector3());
model.position.sub(center); // shift model so its bbox center = world origin
```

---

### 3.5 — Rotation Lock (System Action)

> **Trigger:** User toggles "Rotation Lock" in Settings  
> **Entry point:** `src/js/base/main.js` (Settings toggle callback)

When rotation lock is enabled, the camera lerps back to the floor's default `initialPosition` — restoring the canonical top-down-ish view. This is the only transition flagged as a **system action**, which means it bypasses the "Camera Auto-Focus" user preference.

```js
// src/js/base/main.js  (lines 130–136)
if (isLocked && appState.currentFloor && appState.currentFloor.cameraConfig) {
  const config = appState.currentFloor.cameraConfig;
  appState.cameraAnim.controlsTarget.copy(config.target);
  appState.cameraAnim.cameraTarget.copy(config.initialPosition);
  appState.cameraAnim.isSystemAction = true;  // ← bypasses autoFocus check
  appState.cameraAnim.active = true;
}
```

---

## 4. Quick Comparison

| Transition | Smooth? | Distance | Height Offset | Pivot Point | Guard |
|---|---|---|---|---|---|
| **Object click** | ✅ lerp | `bbox.length × 0.8` (dynamic) | `bbox.y × 1.5 + 5` (dynamic) | Blender origin | None |
| **QR scan** | ✅ lerp | `8` (fixed) | `6` (fixed) | marker pos `+1y` | floor must be loaded |
| **Directory booth** | ✅ lerp | `8` (fixed) | `6` (fixed) | Location prop `+1y` | Location must be injected |
| **Floor switch** | ❌ hard snap | N/A | N/A | bbox center (origin) | floor must be loaded |
| **Rotation lock** | ✅ lerp | N/A | N/A | `config.target` | current floor must exist |

---

## 5. Auto-Focus Setting

The "Camera Auto-Focus" toggle in Settings (`main.js` lines 141–149) controls whether user-triggered transitions (types 3.1–3.3) actually run. The check lives in the animation loop:

```js
// animate.js  (lines 22–25)
if (appState.autoFocusEnabled === false && !appState.cameraAnim.isSystemAction) {
  appState.cameraAnim.active = false;
  return;
}
```

Floor switches (hard snap) and Rotation Lock are unaffected by this setting — they write directly to `camera.position` and `controls.target`, bypassing the anim loop entirely (floor switch) or using `isSystemAction = true` (rotation lock).

---

## 6. File Reference

| File | Role |
|---|---|
| `src/js/base/appState.js` | Declares `cameraAnim` object |
| `src/js/ui_ux/animate.js` | Lerp loop — runs every frame |
| `src/js/helper/util.js` → `focusOnObject()` | Object-click transition |
| `src/js/events/navigation.js` → `handleQRID()` | QR scan transition |
| `src/js/feature/directory.js` → `focusOnBooth()` | Directory transition |
| `src/js/floor/floor.js` → `activate()` | Floor-switch hard snap |
| `src/js/floor/modelParser.js` | Computes `cameraConfig`, injects `Location` |
| `src/js/base/main.js` | Rotation lock transition, auto-focus toggle |
