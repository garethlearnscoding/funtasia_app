# Implementation Plan — Per-Face Materials & Interactive Raycasting

## Overview

This plan covers the end-to-end pipeline for assigning split materials to 3D building models in Blender and consuming them interactively in Three.js. The system distinguishes wall faces from top faces on each mesh, assigns flat unlit materials, exports the result as a GLB, then maps the geometry groups back to application logic for raycasting and highlighting.

---

## 1. glTF Export — What Gets Written

When a mesh has multiple material slots with faces assigned to each, Blender writes **geometry groups** into the exported GLB. Each group describes a contiguous range of faces and the material slot index they belong to:

```
geometry.groups = [
  { start: 0,   count: 90,  materialIndex: 0 },  // wall faces
  { start: 90,  count: 18,  materialIndex: 1 },   // top faces
]
```

Three.js uses these groups to know which portion of the index buffer each material applies to. Without groups, the entire mesh renders with a single material.

### The Split Mesh Problem

When a mesh has multiple material slots, Blender's GLB exporter splits it into a **parent Group node** and **child Mesh nodes** — one child per material slot. The naming convention is:

```
ObjectName          ← Object3D (Group), carries custom properties / userData
  ObjectName_1      ← Mesh, material slot 0 (walls)
  ObjectName_2      ← Mesh, material slot 1 (top)
```

Custom properties defined in Blender (e.g. `ROLE`, `ZONE`) are exported onto the parent Group only. The child meshes carry no userData. This means application logic that reads `child.userData` directly will fail for split meshes — the data must be resolved from the parent.

---

## 2. Three.js — Loading & Material Assignment

### 2.1 userData Resolution

During the scene traverse after loading, each node must be checked for the presence of userData. If a mesh node has no userData but its parent does, the parent is the authoritative data source. The resolved data should be copied down to the child so all subsequent code can treat nodes uniformly without re-checking the parent.

### 2.2 Material Assignment by Slot

The `_1` / `_2` suffix on child mesh names directly encodes the material slot:

- `_1` → slot 0 → wall material
- `_2` → slot 1 → top material

This suffix is parsed from the node name at load time to determine which colour variant to apply. Colours are looked up from two dictionaries — one for walls, one for tops — keyed by `ROLE` or `ZONE` as appropriate, with a fallback default. Reference notes/new raycast/temp-server.js for how this double dictionary structure would look like.

```javascript
const wallColors = {
  GREEN:  0xA8C5A0,
  BLUE:   0xA3B8D8,
  RED:    0xD4908A,
  ORANGE: 0xD4AA7D,
  YELLOW: 0xD4CC7A,
  BROWN:  0xB89880,
  PURPLE: 0xB8A0CC,
  NONE:   0xBBBBBB,
};

const topColors = {
  GREEN:  0xC8DFC2,
  BLUE:   0xC2D4EC,
  RED:    0xE8B8B3,
  ORANGE: 0xE8CAA4,
  YELLOW: 0xE8E4A8,
  BROWN:  0xD4BCA6,
  PURPLE: 0xD4C2E4,
  NONE:   0xD5D5D5,
};
```
### 2.3 Object Registry

The `objects` array used for raycasting must contain **one entry per logical object**, not one per mesh child. The parent Group is the correct entry to push, since it represents the full logical building unit. Pushing both `_1` and `_2` would cause double selections and complicate highlight logic. A guard (`if (!objects.includes(dataNode))`) prevents duplicate registration.

---

## 3. Raycasting & Interactivity

### 3.1 Hit Resolution

`Raycaster.intersectObjects` with `recursive = true` returns hits against all descendant meshes. The hit object will be one of the child meshes (`_1` or `_2`), not the parent Group. Application logic needs the parent to access userData and to address all sibling meshes.

A `Map<Mesh, Group>` built during the traverse (meshToParent) provides O(1) lookup from any hit mesh to its logical parent. This is more reliable than walking `child.parent` at raycast time, which would require null checking and may break if the scene hierarchy changes.

### 3.2 Highlight Strategy

Highlighting must affect all child meshes of a logical object simultaneously — clicking the wall or the top should produce the same visual result across the whole model.

The highlight function receives the parent Group and iterates its children, replacing each mesh's current material with a highlight material. The original material reference is stored on `mesh.userData material` during the initial traverse so it can be restored on deselect without re-deriving the colour.

This pattern — store → replace → restore — is preferable to mutating the material's colour property directly, since it keeps the original material objects intact and avoids state management edge cases when switching selections.

### 3.3 Selection State

Because `objects[]` contains parent Groups rather than meshes, all existing selection logic that reads `userData` from the selected entry continues to work unchanged. The raycasting change is transparent to downstream logic — the resolved node behaves identically to how a single-mesh object did before the material split.

---

## 4. Pipeline Summary

```
  Three.js GLTFLoader
  │
  ├─ 1. Traverse scene
  │     ├─ Resolve userData from parent Group
  │     ├─ Parse _1/_2 suffix → wall or top slot
  │     ├─ Apply MeshBasicMaterial from colour dictionary
  │     ├─ Store material ref on userData for restore
  │     └─ Register parent Group in objects[] and meshToParent Map
  │
  └─ 2. Raycast
        ├─ Hit child mesh → resolve parent via meshToParent
        ├─ Read ROLE / ZONE from parent userData
        └─ Highlight by iterating parent's mesh children
```
