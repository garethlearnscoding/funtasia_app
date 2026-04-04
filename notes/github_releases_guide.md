# GitHub Releases + Lazy GLB Loading + Workbox Caching

## Part 1: Setting Up GitHub Releases (No Zip Files Required)

GitHub Releases lets you attach **individual files** as release assets — you don't need to zip them. Each file gets its own direct download URL.

### Step-by-Step

1. Go to your repo on GitHub → **Releases** → **Draft a new release**
2. Create a tag, e.g. `models-v1.0`
3. Under **"Attach binaries"**, drag and drop each `.glb` file **individually**:
   ```
   njc-l1-v2-31-3.glb
   njc-l2-v2-31-3.glb
   njc-l3-v2-31-3.glb
   njc-l4-v2-31-3.glb
   njc-b1-v2-31-3.glb
   njc-b2-v2-31-3.glb
   njc-b3-v2-31-3.glb
   njc-l1-canteen.glb
   ```
4. Publish the release.

Each file is now available at a permanent URL:
```
https://github.com/{owner}/{repo}/releases/download/{tag}/{filename}
```

**For example:**
```
https://github.com/garethlearnscoding/funtasia_app/releases/download/models-v1.0/njc-l1-v2-31-3.glb
```

> **These URLs return proper CDN cache headers:**
> `Cache-Control: max-age=31536000` (1 year) — served by Fastly, globally distributed.

---

## Part 2: JS Integration — Replacing Static Imports

### Before (current `main.js`)
All models are statically imported, forcing the browser to resolve
all ~2.87MB of GLB files before anything renders.

```js
// ❌ Static imports — all 7 models bundled and downloaded upfront
import modelL4 from "@/assets/models/v2-31-3/njc-l4-v2-31-3.glb";
import modelL3 from "@/assets/models/v2-31-3/njc-l3-v2-31-3.glb";
import modelL2 from "@/assets/models/v2-31-3/njc-l2-v2-31-3.glb";
// ...etc
```

### After — URL-based model registry

Replace the imports with a plain URL dictionary pointing at your GitHub Release:

```js
// ✅ src/js/base/modelRegistry.js
const RELEASE_BASE = "https://github.com/garethlearnscoding/funtasia_app/releases/download/models-v1.0";

export const FLOOR_URLS = {
  l4: `${RELEASE_BASE}/njc-l4-v2-31-3.glb`,
  l3: `${RELEASE_BASE}/njc-l3-v2-31-3.glb`,
  l2: `${RELEASE_BASE}/njc-l2-v2-31-3.glb`,
  l1: `${RELEASE_BASE}/njc-l1-v2-31-3.glb`,
  b1: `${RELEASE_BASE}/njc-b1-v2-31-3.glb`,
  b2: `${RELEASE_BASE}/njc-b2-v2-31-3.glb`,
  b3: `${RELEASE_BASE}/njc-b3-v2-31-3.glb`,
};

export const CHILD_URLS = {
  canteen: `${RELEASE_BASE}/njc-l1-canteen.glb`,
};
```

### Updated `main.js`

```js
// ✅ No more GLB imports at the top
import { FLOOR_URLS, CHILD_URLS } from "@/js/base/modelRegistry.js";

// Pass URLs just like before — modelLoader receives string URLs
const { floors } = await loadModels(appState, FLOOR_URLS);
```

> `modelLoader.js` already uses `GLTFLoader.load(url, ...)` which accepts
> any URL string — **no changes needed there**. It will now fetch from
> GitHub's CDN instead of the bundled dist folder.

---

## Part 3: Lazy Loading — Only Load the Current Floor

Right now `loadModels()` fetches **all** floors in parallel on startup.
With external URLs, you can defer loading until the user actually switches to a floor.

### Lazy `modelLoader.js`

```js
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { parseModel } from "@/js/floor/modelParser.js";
import { Floor } from "@/js/floor/floor.js";

const loader = new GLTFLoader();

// Load a single floor on-demand. Returns a promise.
export function loadFloor(appState, floorId, url) {
  return new Promise((resolve, reject) => {
    // If already loaded, resolve immediately
    const existing = Floor.floors[floorId];
    if (existing && existing.isLoaded()) {
      resolve(existing);
      return;
    }

    loader.load(
      url,
      (gltf) => {
        const result = parseModel(gltf, floorId, appState.scene);
        const floorInstance = Floor.floors[floorId];
        floorInstance.attachParsedData(result.model, result.interactiveObjects, result.cameraConfig);
        console.log(`Loaded ${floorId} on-demand.`);
        resolve(floorInstance);
      },
      (xhr) => {
        if (xhr.lengthComputable) {
          const pct = ((xhr.loaded / xhr.total) * 100).toFixed(1);
          console.log(`Fetching ${floorId}: ${pct}%`);
        }
      },
      reject
    );
  });
}
```

### Updated `navigation.js` — load on switch

```js
import { loadFloor } from "@/js/floor/modelLoader.js";
import { FLOOR_URLS } from "@/js/base/modelRegistry.js";

// Called when user taps a floor button
async function switchFloor(floorId, appState) {
  // Show a loading indicator while fetching
  document.getElementById("info").textContent = `Loading ${floorId}...`;

  await loadFloor(appState, floorId, FLOOR_URLS[floorId]);

  // Hide old floor, activate new one
  if (Floor.currentFloor) Floor.currentFloor.hide();
  Floor.currentFloor = Floor.floors[floorId];
  Floor.currentFloor.activate(appState.camera, appState.controls);

  document.getElementById("info").textContent = "";
}
```

**On first load, only the default floor (e.g. `l1`) is fetched — ~604KB instead of ~2.87MB.**
Every subsequent floor switch triggers a single targeted fetch.

---

## Part 4: Workbox Runtime Caching

The Service Worker we installed via `vite-plugin-pwa` precaches files that
are part of the Vite build output. External GitHub Release URLs are not part
of the build, so they need **runtime caching** instead.

Runtime caching intercepts `fetch` requests as they happen and stores
responses in the browser Cache API — the same result as `immutable` HTTP headers,
but client-controlled.

### Strategy for GLB files: `CacheFirst`

```
Request → Check Cache → Hit? Serve immediately.
                      → Miss? Fetch from network, store in cache, then serve.
```

This is ideal for `.glb` files because:
- First visit: downloaded from GitHub CDN (~seconds)
- All future visits: served from local browser cache (<10ms)

### Updated `vite.config.js`

```js
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    // Precache local build assets (JS, CSS, HTML)
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],

    // Runtime caching for external GitHub Release GLB files
    runtimeCaching: [
      {
        // Match any .glb URL from GitHub releases
        urlPattern: /^https:\/\/github\.com\/.*\.glb$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'glb-models-v1',
          expiration: {
            maxEntries: 20,
            // Keep cached for 30 days
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
          // Allow caching cross-origin responses from GitHub CDN
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
  },
})
```

### What `cacheableResponse: { statuses: [0, 200] }` means

GitHub Release downloads use CORS. When the Service Worker fetches a
cross-origin resource, the browser returns an **opaque response** (status `0`)
which cannot be inspected for security reasons. Workbox needs you to
explicitly allow `0` to cache these opaque cross-origin responses.

---

## Summary: The Full Loading Flow After Implementation

```
User visits map.html
        │
        ▼
Service Worker activates (from cache — instant)
        │
        ▼
App JS + CSS load from precache (instant on repeat visits)
        │
        ▼
Only default floor URL fetched (e.g. l1 ~604KB)
   ├─ First visit:  fetched from GitHub CDN, stored in 'glb-models-v1' cache
   └─ Repeat visit: served from browser cache in <10ms
        │
        ▼
User switches to L2 → single fetch for l2 (~826KB)
   ├─ First switch:  fetched + cached
   └─ Second switch: instant from cache
```
