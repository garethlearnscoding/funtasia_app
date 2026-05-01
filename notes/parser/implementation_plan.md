# Refactor `parseModel` and Implement Synchronous Data Service

The goal is to eliminate "prop drilling" by using a shared module-level cache for `funtasiaData` and refactor `parseModel` into cleaner inner functions.

---

## Proposed Changes

### 1. New File — `src/js/helper/dataService.js` [NEW]
A simple singleton to hold the shared booth data.

```javascript
let _funtasiaData = null;

/**
 * Sets the global shared data. Called once in main.js after fetching.
 */
export function setFuntasiaData(data) {
  _funtasiaData = data;
}

/**
 * Directly returns the cached data. Used by modelParser and directory.
 */
export function getFuntasiaData() {
  return _funtasiaData;
}
```

---

### 2. `main.js` — [MODIFY]
- **Import** `setFuntasiaData` from `dataService.js`.
- In `initApp`, after fetching `rawData`, call `setFuntasiaData(rawData)`.
- Remove `appState.rawData = rawData` (unless needed elsewhere, but we should use the service now).

---

### 3. `modelParser.js` — [MODIFY]
- **Import** `getFuntasiaData` from `dataService.js`.
- **Update `parseModel` signature**: Remove `funtasiaData` parameter.
- **Access Data**: At the top of `parseModel`, `const funtasiaData = getFuntasiaData();`.
- **Inner Helpers**: Implement the refactor using inner functions as planned (Step 1-10), accessing `funtasiaData` and other locals via closure.

---

### 4. `floor.js` — [MODIFY]
- **Update `load` signature**: Remove `funtasiaData` parameter.
- **Update `parseModel` call**: Remove `funtasiaData` argument.

---

### 5. `navigation.js` — [MODIFY]
- **Update `switchFloor`**: Remove `appState.rawData` from the `targetFloor.load()` call.

---

### 6. `directory.js` — [MODIFY]
- **Import** `getFuntasiaData` from `dataService.js`.
- **Remove** local `cachedFuntasiaData` and its getter/setter.
- Replace all internal usages of `cachedFuntasiaData` with calls to `getFuntasiaData()`.

---

## Design Benefits
- **Sync Access**: `parseModel` stays synchronous and fast.
- **No Prop Drilling**: Data is no longer "thrown around" through 4 layers of functions.
- **Single Source of Truth**: Everyone works on the exact same object reference, ensuring coordinates injected by the parser are visible to the UI.

---

## Verification Plan

- **Startup**: Confirm the app loads without errors (data is fetched and set correctly).
- **Interactivity**: Verify clicking a booth in the directory still navigates and places a 3D marker (confirms shared data mutation is working).
- **Booth Info**: Verify booth names/descriptions still appear in the bottom sheet.
- **Lazy Loading**: Verify floors still load correctly when switched.
