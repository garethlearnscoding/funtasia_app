````md
## Goal
Add clean outlines to all buildings using post-processing (`EffectComposer`, `RenderPass`, `OutlinePass`) in Three.js.

---

## 1. Install / Import dependencies

```js
import * as THREE from 'three';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
````

---

## 2. Replace default renderer pipeline

Create a composer and passes:

```js
const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const outlinePass = new OutlinePass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  scene,
  camera
);

composer.addPass(outlinePass);
```

---

## 3. Collect all building meshes

After loading your model:

```js
const buildings = [];

model.traverse((child) => {
  if (child.isMesh) {
    buildings.push(child);
  }
});
```

Assign them to the outline pass:

```js
outlinePass.selectedObjects = buildings;
```

---

## 4. Configure outline appearance

```js
outlinePass.edgeStrength = 3;        // overall intensity
outlinePass.edgeThickness = 1;       // line thickness
outlinePass.edgeGlow = 0;            // glow amount

outlinePass.visibleEdgeColor.set(0x000000);
outlinePass.hiddenEdgeColor.set(0x000000);
```

---

## 5. Update render loop

Replace:

```js
renderer.render(scene, camera);
```

With:

```js
composer.render();
```

---

## 6. Handle resizing

```js
window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height);
  composer.setSize(width, height);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
});
```

---

## 7. Notes / Constraints

* Only Meshes that have a are in the zone dictionary will be outlined
